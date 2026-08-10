#!/usr/bin/env node
// Genera, como parte del build (npm run build), lo siguiente por cada
// jugador conocido:
//   og/<slug>.png              — imagen de preview (og:image)
//   jugador/<slug>/index.html  — página con meta og: reales
//   data/jugador/<slug>.json   — récord V-E-D + Fecha a Fecha, PERO SOLO de
//                                 los torneos CERRADOS (Torneos Antiguos
//                                 2016-2025, Apertura AIFA D 2024, Apertura
//                                 AIFA A/B 2026 — ver `historic: true` en
//                                 _allPlayerTorneoSources, index.html) — ver
//                                 más abajo por qué los torneos EN JUEGO
//                                 (Clausura AIFA A/B 2026, Recopa 2026)
//                                 quedan afuera a propósito
//   data/records.json          — {v,e,d,pj} histórico de TODOS los
//                                 jugadores en un solo archivo, para el
//                                 ranking de El Nido
//
// Antes, el perfil de jugador y el ranking recalculaban el récord V-E-D
// (partido a partido, cruzando ~30 fuentes de Sheets incluidas las ~14
// temporadas lazy de Torneos Antiguos) EN VIVO cada vez que alguien entraba
// — con algunas de esas cargas fallando por rate limiting, el usuario podía
// esperar hasta un minuto y ver números parciales de paso, y abrir un
// perfil disparaba de arranque ~30 requests fragmentados a Sheets.
//
// La solución NO es precalcular la carrera completa: eso dejaría la
// temporada 2026 en curso (la única que realmente cambia semana a semana)
// congelada en el estado del último build hasta el próximo deploy. En
// cambio, acá solo se precalculan las temporadas CERRADAS e inmutables
// (Torneos Antiguos) — exactamente las que hoy se cargan lazy y generan la
// ráfaga de requests. La temporada actual + copas dedicadas ya se cargan
// eager en cada visita real (loadLiveData(), sin este script) y se leen sin
// fetch extra vía _buildPlayerLivePartidos en index.html; el perfil arma el
// total combinando las dos mitades (_ppMergePartidos). Mismo cálculo/lógica
// que ya usaba el cliente (_buildPlayerHistoricPartidos + _ppRecordVED), el
// navegador solo lee un JSON chico ya resuelto para la mitad histórica — el
// único momento en que ESA mitad puede tardar es el build/deploy, no la
// visita de un jugador real.
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
// sitio — se arma un SVG a mano en scripts/og-card-tree.js. El SVG declara
// font-family "Inter" (la misma que --font-family en index.html), pero
// resvg (el motor que rasteriza a PNG) no hereda nada del sitio ni tiene
// fuentes de sistema garantizadas en la máquina de build — así que
// scripts/fetch-font.js baja el .ttf real de Inter (Regular + Bold +
// Black) desde Google Fonts acá abajo, y se lo pasamos a resvg como buffer
// explícito (con loadSystemFonts:false) antes de renderizar cada imagen.
//
// Por el mismo motivo (loadSystemFonts:false, sin fuentes de sistema)
// cualquier emoji (🛡️, 👕) sale como una casilla vacía — Inter no tiene
// glifos de emoji, y no hay ninguna fuente de emoji cargada. En vez de
// depender de una fuente de emoji (nada garantiza que resvg la sepa
// rasterizar bien en color), se embebe el logo real del club
// (logo-csb.webp, el mismo que favicon/landing) como imagen rasterizada
// dentro del SVG — resvg no soporta WEBP de forma confiable, así que se
// convierte a PNG en memoria con `sharp` antes de embeberlo en base64.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');
const { buildShareCardSvg } = require('./og-card-tree');
const { fetchInterFonts } = require('./fetch-font');

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

// Lee la tabla 'name' de un .ttf y devuelve el Font Family Name (nameID 1)
// — parser mínimo a mano (sin dependencias) del formato sfnt/TrueType.
// Usado solo como diagnóstico de build (ver el chequeo en main()): si el
// nombre real embebido en el archivo no dice "Inter", resvg nunca va a
// poder matchearlo contra font-family="Inter" del SVG, y eso es
// exactamente el bug de "la imagen sale en una fuente serif tipo Times New
// Roman" — silencioso, sin ningún error, porque resvg simplemente cae a
// otra cosa en vez de tirar una excepción.
function readTtfFamilyName(buf) {
  try {
    const numTables = buf.readUInt16BE(4);
    let nameTableOffset = null;
    for (let i = 0; i < numTables; i++) {
      const recordOffset = 12 + i * 16;
      const tag = buf.toString('ascii', recordOffset, recordOffset + 4);
      if (tag === 'name') {
        nameTableOffset = buf.readUInt32BE(recordOffset + 8);
        break;
      }
    }
    if (nameTableOffset == null) return null;
    const count = buf.readUInt16BE(nameTableOffset + 2);
    const stringAreaOffset = nameTableOffset + buf.readUInt16BE(nameTableOffset + 4);
    let best = null;
    for (let i = 0; i < count; i++) {
      const recOffset = nameTableOffset + 6 + i * 12;
      const platformID = buf.readUInt16BE(recOffset);
      const nameID = buf.readUInt16BE(recOffset + 6);
      const length = buf.readUInt16BE(recOffset + 8);
      const strOffset = buf.readUInt16BE(recOffset + 10);
      if (nameID !== 1) continue; // 1 = Font Family Name
      // .subarray() es una VISTA sobre el buffer real de la fuente (el
      // mismo que después se le pasa a Resvg para renderizar de verdad) —
      // .swap16() muta en el lugar, así que hace falta copiar con
      // Buffer.from() ANTES de tocarlo. Mutar el original acá corromperia
      // silenciosamente la fuente real usada en las imágenes.
      const raw = Buffer.from(buf.subarray(stringAreaOffset + strOffset, stringAreaOffset + strOffset + length));
      // Windows (platformID 3) y la mayoría de Mac (platformID 0) vienen en
      // UTF-16BE; platformID 1 (Mac Roman clásico) viene en ASCII/Latin-1 —
      // se prefiere la primera que aparezca, cualquiera sirve para el chequeo.
      const decoded = (platformID === 1 || raw.length % 2 !== 0) ? raw.toString('latin1') : raw.swap16().toString('utf16le');
      if (!best) best = decoded;
    }
    return best;
  } catch (e) {
    return null; // parser propio, sin garantías — un fallo acá solo hace que el chequeo de arriba lo reporte como "no encontrado"
  }
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
  console.log(`${merged.length} jugadores encontrados.`);

  // El PG/PE/PP de la tarjeta sale de _buildPlayerPartidos(nombre), que arma
  // el historial partido a partido recorriendo _allPlayerTorneoSources() —
  // eso incluye las temporadas viejas de "Torneos Antiguos" (HISTORICO_GENERIC,
  // ~14 temporadas) más un par de fuentes "bespoke" (ver index.html). ESAS
  // fuentes NO se cargan como parte de loadLiveData(): son lazy, y en el
  // sitio real solo se disparan cuando un usuario de verdad hace click en
  // "Torneos Antiguos" y abre esa temporada puntual. Acá no hay clicks de
  // nadie, así que sin este paso, cualquier jugador con partidos en esas
  // temporadas viejas terminaba con un PG/PE/PP incompleto (no sumaba el PJ
  // real) — la causa real del bug reportado, no un simple "falta un await".
  // BUG REAL encontrado (records.json con V-E-D en 0-0-0 para ~79 de 104
  // jugadores, no un problema de matching de nombres): _loadHistoricoGeneric
  // dispara hasta 4 fetches gviz por temporada (fecha/plantel/tabla/basico)
  // y los envuelve en su PROPIO Promise.allSettled interno — si Google
  // rate-limitea alguno, esa promesa se resuelve "fulfilled" igual (con
  // valor null) y la temporada queda marcada `_historicoGenericLoaded[key]
  // = true` con `dataObj.apertura`/`.partidos` vacíos, SIN lanzar ningún
  // error. Disparar las 14 temporadas en paralelo (hasta ~56 requests
  // simultáneos a docs.google.com desde una sola IP de build) es exactamente
  // el patrón que gatilla ese rate-limit — silencioso, así que ni los logs
  // de build lo mostraban. Cualquier jugador cuyos partidos viejos caían
  // SOLO en una temporada así quedaba con el array `partidos` completamente
  // vacío (no parcial), que es justo el patrón "todo o nada" reportado.
  const historicoKeys = Object.keys(window.HISTORICO_GENERIC || {});
  // Diagnóstico explícito pedido tras el reporte de que segundo-bourse.json
  // (y todos los demás) solo traía partidos de "Apertura AIFA D 2024" —
  // NINGUNA temporada de HISTORICO_GENERIC. Este log deja registrado, ANTES
  // de intentar nada, exactamente cuántas hojas encontró el script y cuáles
  // son, para poder comparar contra cuántas terminan con datos reales más
  // abajo — así la próxima corrida real deja evidencia dura en vez de
  // depender de inspeccionar el JSON de salida a mano.
  console.log(`Torneos Antiguos: encontré ${historicoKeys.length} hojas en HISTORICO_GENERIC: ${historicoKeys.join(', ')}`);
  console.log('Cargando temporadas viejas de Torneos Antiguos (necesarias para PG/PE/PP completo)…');
  const HIST_CONCURRENCY = 3;
  const HIST_MAX_ATTEMPTS = 4;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function loadHistoricoSeasonWithRetry(key) {
    const cfg = window.HISTORICO_GENERIC[key];
    for (let attempt = 1; attempt <= HIST_MAX_ATTEMPTS; attempt++) {
      window._historicoGenericLoaded[key] = false; // fuerza que _loadHistoricoGeneric no haga early-return
      try {
        await window._loadHistoricoGeneric(key, cfg.d, cfg);
      } catch (e) {
        console.error(`  ✗ "${key}" (intento ${attempt}/${HIST_MAX_ATTEMPTS}): excepción inesperada:`, e.message);
      }
      const matchCount = (cfg.d.apertura && cfg.d.apertura.length) || (cfg.d.partidos && cfg.d.partidos.length) || 0;
      if (matchCount > 0) {
        console.log(`  ✓ "${key}": ${matchCount} partidos cargados (intento ${attempt}/${HIST_MAX_ATTEMPTS})`);
        return true;
      }
      if (attempt < HIST_MAX_ATTEMPTS) {
        const backoffMs = 1500 * attempt;
        console.warn(`  ⚠ "${key}": vino vacío (posible rate limit de Google), reintento ${attempt + 1}/${HIST_MAX_ATTEMPTS} en ${backoffMs}ms…`);
        await sleep(backoffMs);
      } else {
        console.error(`  ✗ "${key}": vino vacío en los ${HIST_MAX_ATTEMPTS} intentos — se cuenta como fallida.`);
      }
    }
    return false;
  }

  // Concurrencia acotada (3 a la vez, no las 14 juntas) para no volver a
  // gatillar el mismo rate limit con los reintentos.
  const failedSeasons = [];
  for (let i = 0; i < historicoKeys.length; i += HIST_CONCURRENCY) {
    const batch = historicoKeys.slice(i, i + HIST_CONCURRENCY);
    const results = await Promise.all(batch.map(loadHistoricoSeasonWithRetry));
    batch.forEach((key, idx) => { if (!results[idx]) failedSeasons.push(key); });
  }
  console.log(`Torneos Antiguos: ${historicoKeys.length - failedSeasons.length} de ${historicoKeys.length} hojas procesadas con datos reales. Fallidas: ${failedSeasons.length ? failedSeasons.join(', ') : 'ninguna'}.`);

  // Apertura AIFA D 2024 (DATA_B_2024D) es una fuente "bespoke" totalmente
  // aparte de HISTORICO_GENERIC — su propia función (_loadBApt2024d, en
  // index.html), NO pasa por el loop de arriba. Se loguea por separado a
  // propósito: si HISTORICO_GENERIC queda en 0/14 pero esta sí tiene datos,
  // es la firma exacta de "el burst de 56 requests simultáneos rate-limiteó
  // TODAS las 14 temporadas, pero esta (una sola tanda de 4 fetches, después
  // del burst) zafó" — no un loop que corta después de la primera iteración.
  let bApt2024dCount = 0;
  if (window._loadBApt2024d) {
    await window._loadBApt2024d().catch(e => console.error('  ✗ Error cargando Apertura AIFA D 2024:', e.message));
    bApt2024dCount = (window.DATA_B_2024D && window.DATA_B_2024D.apertura && window.DATA_B_2024D.apertura.length) || 0;
  }
  console.log(`Apertura AIFA D 2024 (fuente aparte, no es parte de HISTORICO_GENERIC): ${bApt2024dCount} partidos cargados.`);

  // Fallar fuerte y abortar el build en vez de publicar de nuevo un
  // records.json con V-E-D en 0-0-0 para una porción de los jugadores sin
  // ningún aviso — mejor un deploy rojo visible que datos incorrectos
  // silenciosos en producción.
  if (failedSeasons.length) {
    throw new Error(`Temporadas históricas que NUNCA devolvieron datos después de ${HIST_MAX_ATTEMPTS} intentos cada una: ${failedSeasons.join(', ')} — build abortado.`);
  }

  console.log('Descargando la fuente Inter (Regular + Bold + Black) para las imágenes…');
  const fonts = await fetchInterFonts();
  // Diagnóstico real pedido (el usuario reportó que el texto de la imagen
  // sale como una fuente serif tipo Times New Roman en vez de Inter, pese a
  // que el build no tira ningún error): valida que cada buffer descargado
  // sea un .ttf real y que su tabla 'name' realmente diga "Inter" — así, si
  // algún día Google Fonts cambia el nombre interno de la fuente (o el
  // buffer viene corrupto/truncado), el build falla fuerte con un mensaje
  // claro en vez de generar 104 imágenes con la fuente mal calladamente.
  for (const [label, buf] of [['Regular', fonts.regular], ['Bold', fonts.bold], ['Black', fonts.black]]) {
    const familyName = readTtfFamilyName(buf);
    console.log(`  Inter ${label}: ${buf.length} bytes, tabla 'name' dice familia = "${familyName || '(no encontrado)'}"`);
    if (!familyName || !/inter/i.test(familyName)) {
      throw new Error(
        `El .ttf de Inter ${label} descargado no dice "Inter" en su tabla 'name' (dice "${familyName || '(nada)'}"). ` +
        `resvg pide font-family="Inter" en el SVG — si esto no coincide, cae a algún fallback (el "se ve como Times New Roman" reportado) sin tirar ningún error visible. Build abortado.`
      );
    }
  }

  console.log('Convirtiendo el logo del club (webp → png) para embeberlo en la imagen…');
  const logoPngBuffer = await sharp(path.join(ROOT, 'logo-csb.webp')).png().toBuffer();
  const logoDataUri = `data:image/png;base64,${logoPngBuffer.toString('base64')}`;

  console.log('Generando previews y JSON precalculado…');
  const ogDir = path.join(ROOT, 'og');
  const jugadorDir = path.join(ROOT, 'jugador');
  const dataJugadorDir = path.join(ROOT, 'data', 'jugador');
  fs.mkdirSync(ogDir, { recursive: true });
  fs.mkdirSync(jugadorDir, { recursive: true });
  fs.mkdirSync(dataJugadorDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const recordsIndex = {}; // { [slug]: { v, e, d, pj } } — un solo archivo para el ranking

  let ok = 0, failed = 0;
  let vedMismatches = 0;
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
      // PG/PE/PP de la tarjeta (imagen OG) sigue siendo el total de carrera
      // completo — ahí no hay problema de estar "en vivo", es una imagen
      // estática que ya se regenera en cada build.
      const partidos = window._buildPlayerPartidos(nombre);
      const ved = window._ppRecordVED(partidos);
      // Para el JSON que lee el perfil de jugador en el navegador (y para
      // records.json/El Nido) usamos SOLO los torneos CERRADOS (`historic:
      // true` en _allPlayerTorneoSources, index.html) — ver
      // _buildPlayerHistoricPartidos. Los torneos EN JUEGO (Clausura AIFA
      // A/B 2026, Recopa 2026) NO se precalculan a propósito: cambian
      // semana a semana, y el navegador ya los tiene en memoria sin fetch
      // extra (_buildPlayerLivePartidos) — así el perfil combina
      // histórico-precalculado + actual-en-vivo y nunca muestra un número
      // desactualizado entre deploys.
      const historicoPartidos = window._buildPlayerHistoricPartidos(nombre);
      const vedHistorico = window._ppRecordVED(historicoPartidos);

      // Validación explícita en vez de generar igual con datos parciales:
      // campos requeridos ausentes son un bug real (falla el build, no un
      // player individual) — un PG/PE/PP que no suma el PJ total es la
      // señal exacta del bug que motivó todo este chequeo, así que se
      // loguea fuerte por jugador y al final se resume cuántos casos hubo.
      const requiredFields = { goles: s.goles, asist: s.asist, pj: s.pj, pg: ved.v, pe: ved.e, pp: ved.d };
      for (const [field, val] of Object.entries(requiredFields)) {
        if (val === undefined || val === null || Number.isNaN(val)) {
          throw new Error(`Campo requerido "${field}" vino ${val} para "${nombre}" — datos incompletos, no se genera la imagen con esto a medias.`);
        }
      }
      const vedSum = ved.v + ved.e + ved.d;
      if (vedSum !== s.pj) {
        vedMismatches++;
        console.error(`  ⚠ "${nombre}": PG+PE+PP (${vedSum}) no coincide con PJ (${s.pj}) — partidos sin resultado registrado en alguna fuente, o alguna temporada histórica no cargó bien.`);
      }

      const svg = buildShareCardSvg({
        nombre: s.nombre, pos: s.pos, posColor,
        goles: s.goles, asist: s.asist, pj: s.pj,
        gmas: s.goles + s.asist, titulos: s.titulos,
        promGol: s.promGol, promAsist: s.promAsist,
        vallas: s.vallas, vallasProm: s.vallasProm,
        pg: ved.v, pe: ved.e, pp: ved.d,
        hasA: s.hasA, hasB: s.hasB, logros,
        logoDataUri,
      });

      // El SVG ya nace a 1080x1350 (formato 4:5) — se renderiza 1:1, sin
      // reescalar. loadSystemFonts:false fuerza a resvg a usar SOLO estos
      // buffers (nunca lo que tenga instalado la máquina de build) — así
      // el resultado es siempre Inter, determinístico, sin depender de qué
      // fuentes tenga ese runner en particular.
      const png = new Resvg(svg, {
        font: {
          fontBuffers: [fonts.regular, fonts.bold, fonts.black],
          loadSystemFonts: false,
          defaultFontFamily: 'Inter',
        },
      }).render().asPng();
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

      // Récord V-E-D + Fecha a Fecha del histórico cerrado (Torneos
      // Antiguos), ya calculados — el perfil de jugador los lee directo de
      // acá (ver _ppFetchStaticRecord en index.html) y los combina con la
      // temporada 2026 en curso, leída en vivo desde memoria sin fetch (ver
      // _buildPlayerLivePartidos/_ppMergePartidos). `partidos` ya es
      // JSON-serializable tal cual (strings/números/bools, mismo shape que
      // ya consumen _ppStatRowHtml y compañía del lado del cliente) — no
      // hace falta transformar nada.
      fs.writeFileSync(path.join(dataJugadorDir, `${slug}.json`), JSON.stringify({
        nombre: s.nombre, pos: s.pos, hasA: s.hasA, hasB: s.hasB,
        vedHistorico: { v: vedHistorico.v, e: vedHistorico.e, d: vedHistorico.d },
        partidos: historicoPartidos,
        generatedAt,
      }));
      recordsIndex[slug] = { v: vedHistorico.v, e: vedHistorico.e, d: vedHistorico.d, pj: s.pj };

      ok++;
    } catch (e) {
      console.error(`  ✗ Error generando preview de "${nombre}":`, e.message);
      failed++;
    }
  }

  fs.writeFileSync(path.join(ROOT, 'data', 'records.json'), JSON.stringify({ generatedAt, records: recordsIndex }));
  console.log(`Listo: ${ok} jugadores generados, ${failed} con error, ${vedMismatches} con PG+PE+PP ≠ PJ (ver advertencias arriba).`);
  window.close();
  if (ok === 0 && failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('Error fatal generando previews de jugadores:', e);
  process.exit(1);
});
