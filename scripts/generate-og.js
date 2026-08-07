#!/usr/bin/env node
// Genera, como parte del build (npm run build), un PNG de preview + una
// página HTML estática con meta og: por cada jugador conocido:
//   og/<slug>.png
//   jugador/<slug>/index.html
//
// Por qué así: WhatsApp/Facebook/X/etc. no ejecutan JS y nunca ven el
// fragmento #jugador/slug del SPA (nunca llega al servidor), así que hace
// falta una URL real por jugador con los meta tags ya resueltos. Generarlo
// en build time (en vez de en una función serverless por visita) evita el
// límite de 10s de las Netlify Functions en el plan actual y no consume
// cómputo por cada visita — el costo se paga una sola vez, acá.
//
// Para tener los datos reales (goles/asist/PJ/logros) sin reimplementar el
// motor de stats del sitio en Node (que arma cada jugador a partir de ~30
// fetches crudos a Sheets + miles de líneas de agregación, sin una hoja
// "maestra"), este script carga el index.html real dentro de jsdom y corre
// su mismo <script> ahí adentro, llamando después a las mismas funciones
// globales que ya usa el sitio (loadLiveData, _collectPlayerStats,
// _ppComputeTopLogros, slugify) — una sola fuente de verdad para las
// stats. jsdom no pinta nada de verdad (no hay Chart.js/canvas real acá),
// así que index.html trae guards en window.__OG_BUILD__ que saltan todo lo
// visual y dejan correr solo el fetch/cálculo de datos.
//
// El dibujo de la tarjeta en sí (para el PNG) NO reusa el HTML/CSS del
// sitio — se arma un SVG a mano en scripts/og-card-tree.js, con
// font-family genérica; es resvg quien la resuelve contra las fuentes
// instaladas en la máquina de build, sin depender de ningún .ttf propio
// (ver el comentario al principio de ese archivo).

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { Resvg } = require('@resvg/resvg-js');
const { buildShareCardSvg } = require('./og-card-tree');

const ROOT = path.join(__dirname, '..');
// En Netlify, URL/DEPLOY_PRIME_URL están seteadas en cada build (esta última
// es la del Deploy Preview de la rama, justo lo que hace falta para poder
// probar esto en una rama separada antes de mergear a producción).
const SITE_URL = (process.env.DEPLOY_PRIME_URL || process.env.URL || 'https://clubsantabarbara.netlify.app').replace(/\/$/, '');

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildPlayerPageHtml({ title, description, image, url, redirectTarget }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Club Santa Bárbara" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <!-- OJO: a propósito NO hay <meta http-equiv="refresh">. Los bots de
       preview (Facebook/WhatsApp) SÍ siguen ese redirect (a diferencia del
       script de abajo, que ignoran por no correr JS) — y como el destino es
       #jugador/:slug (un hash, que el servidor nunca ve), terminan leyendo
       los meta og: genéricos de la home en vez de los de este jugador. El
       redirect real para usuarios humanos queda solo en el script. -->
  <script>location.replace(${JSON.stringify(redirectTarget)});</script>
</head>
<body>
  <p>Redirigiendo a <a href="${escapeHtml(redirectTarget)}">${escapeHtml(title)}</a>…</p>
</body>
</html>`;
}

async function main() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const combinedScript = scripts.join('\n;\n');
  const htmlNoScripts = html.replace(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/g, '');

  console.log('Iniciando jsdom y cargando el motor de datos del sitio…');
  const dom = new JSDOM(htmlNoScripts, {
    url: SITE_URL + '/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  // Node 18+ trae fetch global; jsdom no implementa uno propio.
  window.fetch = (...args) => fetch(...args);
  window.__OG_BUILD__ = true;

  dom.window.eval(combinedScript);

  console.log('Corriendo loadLiveData()…');
  await window.loadLiveData();

  // El pool de jugadores de El Nido (_nidoMerged, detrás de _nidoGetMerged)
  // NO se llena como parte de loadLiveData() — es un fetch totalmente
  // aparte (fetchProxy('Jugadores Estadisticas', ...)) que en el sitio real
  // solo se dispara cuando el usuario abre la pestaña El Nido o un perfil
  // de jugador (ver _nidoLoad()/window._nidoEnsureLoaded en index.html).
  // Acá no hay usuario ni click, así que hay que pedirlo explícitamente.
  console.log('Cargando pool de jugadores de El Nido (_nidoEnsureLoaded)…');
  if (!window._nidoEnsureLoaded) {
    throw new Error('window._nidoEnsureLoaded no está definido — ¿cambió el nombre del export en index.html?');
  }
  await window._nidoEnsureLoaded();

  const merged = window._nidoGetMerged ? window._nidoGetMerged() : [];
  if (!merged.length) {
    throw new Error('window._nidoGetMerged() vino vacío después de loadLiveData() + _nidoEnsureLoaded() — revisar que el build tenga acceso de red a Google Sheets (incluido el proxy de Apps Script que usa _nidoLoad).');
  }
  console.log(`${merged.length} jugadores encontrados. Generando previews…`);

  const ogDir = path.join(ROOT, 'og');
  const jugadorDir = path.join(ROOT, 'jugador');
  fs.mkdirSync(ogDir, { recursive: true });
  fs.mkdirSync(jugadorDir, { recursive: true });

  let ok = 0, failed = 0;
  const seenSlugs = new Set();
  for (const p of merged) {
    const nombre = p.nombre;
    const slug = window.slugify(nombre);
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    try {
      const s = window._collectPlayerStats(nombre);
      const logros = window._ppComputeTopLogros(nombre);
      const posColor = window._plantelPosColor(s.pos);
      // Mismo cálculo que usa el perfil del jugador para su "Récord de
      // Resultados" (PG/PE/PP) — ver _buildPlayerPartidos + _ppRecordVED,
      // ambas top-level en index.html.
      const partidos = window._buildPlayerPartidos(nombre);
      const ved = window._ppRecordVED(partidos);

      const svg = buildShareCardSvg({
        nombre: s.nombre, pos: s.pos, posColor,
        goles: s.goles, asist: s.asist, pj: s.pj,
        gmas: s.goles + s.asist, titulos: s.titulos, promGol: s.promGol,
        pg: ved.v, pe: ved.e, pp: ved.d,
        hasA: s.hasA, hasB: s.hasB, logros,
      });

      // El SVG ya nace a 1200x630 (tamaño estándar Open Graph) — se renderiza
      // 1:1, sin reescalar.
      const png = new Resvg(svg).render().asPng();
      fs.writeFileSync(path.join(ogDir, `${slug}.png`), png);

      const title = `${s.nombre} — Club Santa Bárbara`;
      const description = `${s.pos || 'Jugador'} · ${s.goles} goles · ${s.asist} asistencias · ${s.pj} PJ — Club Santa Bárbara`;
      const playerDir = path.join(jugadorDir, slug);
      fs.mkdirSync(playerDir, { recursive: true });
      fs.writeFileSync(path.join(playerDir, 'index.html'), buildPlayerPageHtml({
        title, description,
        image: `${SITE_URL}/og/${slug}.png`,
        url: `${SITE_URL}/jugador/${slug}`,
        redirectTarget: `${SITE_URL}/#jugador/${slug}`,
      }));
      ok++;
    } catch (e) {
      console.error(`  ✗ Error generando preview de "${nombre}":`, e.message);
      failed++;
    }
  }

  console.log(`Listo: ${ok} jugadores generados, ${failed} con error.`);
  window.close();
  if (ok === 0 && failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('Error fatal generando previews de jugadores:', e);
  process.exit(1);
});
