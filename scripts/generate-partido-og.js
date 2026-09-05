#!/usr/bin/env node
// Genera, como parte del build (npm run build), la Ficha de Partido
// compartible de cada fecha que ya tenga el 11 titular cargado:
//   og/partido/<torneo>-<fecha>.png     — imagen de preview (og:image)
//   partido/<torneo>/<fecha>/index.html — página con meta og: reales
//
// Antes esto corría EN VIVO por cada visita (netlify/functions/partido.js +
// partido-og.js), pensando que el partido cambia semana a semana como los
// jugadores — pero un partido puntual en realidad solo cambia DOS veces
// (cuando se carga el 11 titular, y cuando termina y se cargan los
// incidentes). No hacía falta que fuera en vivo, y esa arquitectura terminó
// siendo la causa real de que la imagen a veces no se generara: jsdom
// completo + fetch en vivo a Sheets + descarga del escudo + resvg, todo
// adentro del límite de 10s de una Netlify Function en el plan actual — el
// mismo motivo (más simple: nunca falla porque no corre en runtime) por el
// que la ficha de jugador SÍ generaba bien. Ahora se hornea acá, como la de
// jugador, con el mismo trade-off ya aceptado: "actualizada a partir del
// último deploy", no verdaderamente en vivo.
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { Resvg } = require('@resvg/resvg-js');
const { getAllMatches, SITE_URL, TORNEO_CFG } = require('./_matchPartidoData');
const { buildMatchCardSvg } = require('./_matchCardSvg');
const { fetchInterFonts } = require('./fetch-font');
const { readTtfFamilyName } = require('./ttf-family');

const ROOT = path.join(__dirname, '..');

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildMatchPageHtml({ title, description, image, url, redirectTarget }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Club Santa Bárbara" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <!-- Sin meta http-equiv="refresh" a propósito — ver el mismo comentario en
       scripts/generate-og.js (buildPlayerPageHtml): los bots de preview SÍ
       siguen ese redirect, y como el destino real es un hash (#partido/...,
       que el servidor nunca ve) terminarían leyendo estos mismos meta og:
       genéricos en vez de nada — el redirect real para humanos queda solo
       en el script de abajo. -->
  <script>location.replace(${JSON.stringify(redirectTarget)});</script>
</head>
<body>
  <p>Redirigiendo a <a href="${escapeHtml(redirectTarget)}">${escapeHtml(title)}</a>…</p>
</body>
</html>`;
}

// Baja el escudo del rival y lo convierte a PNG en memoria (resvg no soporta
// bien WEBP/JPG). best-effort con timeout corto: si falla o tarda, se sigue
// con el círculo de iniciales de siempre en vez de romper todo el build.
async function fetchCrestDataUri(url, timeoutMs = 5000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const png = await sharp(buf)
      .resize(240, 240, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

// Suma goles/asistencias por jugador y arma la lista de destacados.
function sumByStat(jugadores, key) {
  const map = new Map();
  for (const j of jugadores) {
    const n = j[key] || 0;
    if (n <= 0) continue;
    map.set(j.nombre, (map.get(j.nombre) || 0) + n);
  }
  return [...map.entries()].map(([nombre, count]) => ({ nombre, count }));
}

async function main() {
  console.log('Descargando la fuente Inter (Regular + Bold + Black)…');
  const fonts = await fetchInterFonts();
  for (const [label, buf] of [['Regular', fonts.regular], ['Bold', fonts.bold], ['Black', fonts.black]]) {
    const familyName = readTtfFamilyName(buf);
    if (!familyName || !/inter/i.test(familyName)) {
      throw new Error(`El .ttf de Inter ${label} no dice "Inter" en su tabla 'name' (dice "${familyName || '(nada)'}"). Build abortado.`);
    }
  }
  // font.fontBuffers puede fallar en silencio (ver la misma nota, ya
  // corregida, en scripts/generate-og.js) — font.fontFiles (leer el .ttf de
  // un path real en disco) es el camino confiable.
  const fontsDir = path.join(os.tmpdir(), 'csb-og-inter-fonts');
  fs.mkdirSync(fontsDir, { recursive: true });
  const fontFiles = {};
  for (const [weight, buf] of Object.entries(fonts)) {
    const fp = path.join(fontsDir, `inter-${weight}.ttf`);
    fs.writeFileSync(fp, buf);
    fontFiles[weight] = fp;
  }

  console.log('Convirtiendo el logo del club (webp → png)…');
  const logoPngBuffer = await sharp(path.join(ROOT, 'logo-csb.webp')).png().toBuffer();
  const clubLogoDataUri = `data:image/png;base64,${logoPngBuffer.toString('base64')}`;

  const ogDir = path.join(ROOT, 'og', 'partido');
  const partidoDir = path.join(ROOT, 'partido');
  fs.mkdirSync(ogDir, { recursive: true });

  let ok = 0, failed = 0;
  for (const torneo of Object.keys(TORNEO_CFG)) {
    console.log(`\nCargando partidos de ${TORNEO_CFG[torneo].badge}…`);
    const data = await getAllMatches(torneo);
    const { matches, helpers } = data;
    // Solo tiene sentido compartir una fecha que ya tenga el 11 titular
    // cargado — una fecha futura sin nada cargado no tiene nada que mostrar.
    const shareable = matches.filter(m => m.jugadores && m.jugadores.length);
    console.log(`  ${matches.length} fechas encontradas, ${shareable.length} con plantel cargado (se generan esas).`);

    for (const match of shareable) {
      try {
        const rivalCrestPath = helpers.RIVAL_CREST_URLS[String(match.rival || '').toUpperCase().trim()]
          || `escudos/${helpers.slugify(match.rival)}.webp`;
        const rivalCrestUrl = /^https?:\/\//i.test(rivalCrestPath) ? rivalCrestPath : `${SITE_URL}/${rivalCrestPath}`;
        const rivalCrestDataUri = await fetchCrestDataUri(rivalCrestUrl);
        const c = helpers.rivalAvatarColor(match.rival);
        const rivalCrest = rivalCrestDataUri
          ? { dataUri: rivalCrestDataUri }
          : { initials: helpers.rivalInitials(match.rival), bg: c.bg, border: c.color, color: c.color };
        const csbCrest = { dataUri: clubLogoDataUri };

        const isVisitante = /visit/i.test(match.local || '');
        const leftName = isVisitante ? match.rival : 'Santa Bárbara';
        const rightName = isVisitante ? 'Santa Bárbara' : match.rival;
        const leftCrest = isVisitante ? rivalCrest : csbCrest;
        const rightCrest = isVisitante ? csbCrest : rivalCrest;

        const dia = helpers.formatISODia(match.dia || '—');
        const hora = helpers.formatISOHora(match.hora || '—');
        const played = match.resultado !== null;
        const scoreText = played
          ? `${match.resultado}${match.penales ? ` (pen. ${match.penales})` : ''}`
          : (hora !== '—' ? `${hora} HS` : 'VS');
        let scoreColor = played ? '#ffffff' : '#cbd5e1';
        if (played && match.gf != null && match.gc != null) {
          const csbGoles = isVisitante ? match.gc : match.gf;
          const rivalGoles = isVisitante ? match.gf : match.gc;
          scoreColor = csbGoles > rivalGoles ? '#22c55e' : csbGoles < rivalGoles ? '#ef4444' : '#fbbf24';
        }

        const jugadores = match.jugadores || [];
        const titulares = jugadores.filter(j => j.titular);
        const banco = jugadores.filter(j => !j.titular && j.citado);
        const destacados = {
          goles: sumByStat(jugadores, 'goles'),
          asist: sumByStat(jugadores, 'asist'),
          rojas: jugadores.filter(j => j.rojas > 0).map(j => ({ nombre: j.nombre, count: 1 })),
        };

        const svg = buildMatchCardSvg({
          clubLogoDataUri, torneoBadge: match.torneoBadge,
          leftName, rightName, leftCrest, rightCrest,
          scoreText, scoreColor, played,
          fechaLabel: `Fecha ${match.fecha}`,
          diaLabel: dia !== '—' ? dia : '',
          lugar: match.lugar || '—',
          formacion: match.formacionCSB || '?',
          titulares, banco, destacados, helpers,
        });

        const png = new Resvg(svg, {
          font: {
            fontFiles: [fontFiles.regular, fontFiles.bold, fontFiles.black],
            loadSystemFonts: false, defaultFontFamily: 'Inter',
          },
        }).render().asPng();
        fs.writeFileSync(path.join(ogDir, `${torneo}-${match.fecha}.png`), png);

        const title = `Santa Bárbara vs ${match.rival} — Fecha ${match.fecha} · Club Santa Bárbara`;
        const description = played
          ? `Santa Bárbara ${match.resultado}${match.penales ? ` (pen. ${match.penales})` : ''} — Fecha ${match.fecha}, ${match.torneoBadge}`
          : `Fecha ${match.fecha}, ${match.torneoBadge} — a jugarse`;
        const imageUrl = `${SITE_URL}/og/partido/${torneo}-${match.fecha}.png`;
        const pageUrl = `${SITE_URL}/partido/${torneo}/${match.fecha}`;
        const redirectTarget = `${SITE_URL}/#partido/${torneo}/${encodeURIComponent(match.fecha)}`;
        const html = buildMatchPageHtml({ title, description, image: imageUrl, url: pageUrl, redirectTarget });

        const outDir = path.join(partidoDir, torneo, String(match.fecha));
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), html);

        ok++;
      } catch (e) {
        failed++;
        console.error(`  ✗ Fecha ${match.fecha} (${torneo}): ${e.message}`);
      }
    }
  }

  console.log(`\nListo: ${ok} fichas de partido generadas, ${failed} fallidas.`);
  if (failed > 0) {
    throw new Error(`${failed} ficha(s) de partido fallaron — ver el detalle arriba.`);
  }
}

main().catch(e => {
  console.error('generate-partido-og.js falló:', e);
  process.exit(1);
});
