#!/usr/bin/env node
// Genera, como parte del build, la Ficha de Partido compartible de cada
// fecha que ya tenga el 11 titular cargado:
//   og/partido/<torneo>-<fecha>.png     — imagen de preview (og:image)
//   partido/<torneo>/<fecha>/index.html — página con meta og: reales
//
// BUG REAL de build (Netlify: "Command did not finish within the time
// limit", ~18 min): esto vivía como un script totalmente aparte que
// levantaba SU PROPIO jsdom (parseaba/evaluaba las ~18.000 líneas de
// index.html una SEGUNDA vez, además de la que ya hace scripts/generate-
// og.js para los jugadores) y volvía a descargar la fuente Inter + convertir
// el logo por su cuenta — trabajo duplicado que, sumado, empujó el build
// entero por encima del límite de tiempo de Netlify. Por eso `run()` de acá
// abajo NO bootstrapea nada: recibe el `window` (ya con index.html
// evaluado), los fontFiles y el logoDataUri YA armados por quien la llama.
// scripts/generate-og.js la llama al final de su propio main(), reusando
// exactamente ese mismo trabajo — un solo jsdom, una sola descarga de
// fuente, una sola conversión de logo por build entero, no dos.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Resvg } = require('@resvg/resvg-js');
const { getAllMatchesFromWindow, SITE_URL, TORNEO_CFG } = require('./_matchPartidoData');
const { buildMatchCardSvg } = require('./_matchCardSvg');
const { svgDims } = require('./og-card-tree');

const ROOT = path.join(__dirname, '..');

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildMatchPageHtml({ title, description, image, imageWidth, imageHeight, url, redirectTarget }) {
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
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="${imageWidth}" />
  <meta property="og:image:height" content="${imageHeight}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <!-- Sin meta http-equiv="refresh" a propósito — ver el mismo comentario en
       scripts/generate-og.js (buildPlayerPageHtml). -->
  <script>location.replace(${JSON.stringify(redirectTarget)});</script>
</head>
<body>
  <p>Redirigiendo a <a href="${escapeHtml(redirectTarget)}">${escapeHtml(title)}</a>…</p>
</body>
</html>`;
}

// Baja el escudo del rival y lo convierte a PNG en memoria (resvg no
// soporta bien WEBP/JPG). best-effort con timeout corto: si falla o tarda,
// se sigue con el círculo de iniciales de siempre en vez de romper el
// build. Se llama en paralelo entre partidos (Promise.all en run()), no
// serializada una espera de hasta N segundos por cada uno de los N
// partidos — eso solo (20 partidos × hasta 5s c/u si fallaban) ya sumaba
// hasta 100s reales al build.
async function fetchCrestDataUri(url, timeoutMs = 4000) {
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

async function generateOne({ match, helpers, fontFiles, clubLogoDataUri, ogDir, partidoDir }) {
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

  const torneo = Object.keys(TORNEO_CFG).find(k => TORNEO_CFG[k].badge === match.torneoBadge) || 'a';
  fs.writeFileSync(path.join(ogDir, `${torneo}-${match.fecha}.png`), png);

  const title = `Santa Bárbara vs ${match.rival} — Fecha ${match.fecha} · Club Santa Bárbara`;
  const description = played
    ? `Santa Bárbara ${match.resultado}${match.penales ? ` (pen. ${match.penales})` : ''} — Fecha ${match.fecha}, ${match.torneoBadge}`
    : `Fecha ${match.fecha}, ${match.torneoBadge} — a jugarse`;
  const imageUrl = `${SITE_URL}/og/partido/${torneo}-${match.fecha}.png`;
  const pageUrl = `${SITE_URL}/partido/${torneo}/${match.fecha}`;
  const redirectTarget = `${SITE_URL}/#partido/${torneo}/${encodeURIComponent(match.fecha)}`;
  const dims = svgDims(svg) || { width: 1080, height: 1350 };
  const html = buildMatchPageHtml({
    title, description, image: imageUrl,
    imageWidth: dims.width, imageHeight: dims.height,
    url: pageUrl, redirectTarget,
  });

  const outDir = path.join(partidoDir, torneo, String(match.fecha));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
}

// BUG REAL de build (Netlify: "Error: 404" en fetchProxy, build entero
// abortado): getAllMatchesFromWindow no tenía ningún reintento — un solo
// fallo transitorio del proxy de Apps Script (cold-start, rate limit, un
// 404/503 pasajero — el mismo tipo de falla que ya se documentó y toleró
// para Torneos Antiguos en generate-og.js) tiraba abajo el build COMPLETO,
// incluidas las 106 fichas de jugador que ya habían generado bien. Reintenta
// unas pocas veces con backoff antes de darse por vencido; si el torneo
// sigue fallando después de eso, se salta SOLO ESE torneo (con un warning
// bien visible) en vez de abortar todo lo demás.
async function loadTorneoWithRetry(window, torneo, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await getAllMatchesFromWindow(window, torneo);
    } catch (e) {
      if (attempt === maxAttempts) throw e;
      const backoffMs = 2000 * attempt;
      console.warn(`  ⚠ ${TORNEO_CFG[torneo].badge}: fetch falló (intento ${attempt}/${maxAttempts}): ${e.message} — reintento en ${backoffMs}ms…`);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
}

// `window` ya tiene index.html evaluado (con GS/RIVAL_CREST_URLS/etc.
// expuestos en window, ver la nota de _matchPartidoData.js); `fontFiles` son
// los 3 .ttf de Inter YA escritos a disco (paths); `clubLogoDataUri` es el
// logo YA convertido a PNG/base64 — todo reusado del build de jugadores,
// nada de esto se vuelve a descargar/convertir acá.
async function run({ window, fontFiles, clubLogoDataUri }) {
  const ogDir = path.join(ROOT, 'og', 'partido');
  const partidoDir = path.join(ROOT, 'partido');
  fs.mkdirSync(ogDir, { recursive: true });

  let ok = 0, failed = 0;
  for (const torneo of Object.keys(TORNEO_CFG)) {
    console.log(`Cargando partidos de ${TORNEO_CFG[torneo].badge}…`);
    let data;
    try {
      data = await loadTorneoWithRetry(window, torneo);
    } catch (e) {
      console.error(`  ✗ ${TORNEO_CFG[torneo].badge}: no se pudo cargar después de reintentar — se saltan sus fichas de partido. Causa: ${e.message}`);
      continue;
    }
    const { matches, helpers } = data;
    // Solo tiene sentido compartir una fecha que ya tenga el 11 titular
    // cargado — una fecha futura sin nada cargado no tiene nada que mostrar.
    const shareable = matches.filter(m => m.jugadores && m.jugadores.length);
    console.log(`  ${matches.length} fechas encontradas, ${shareable.length} con plantel cargado (se generan esas).`);

    // En paralelo entre partidos (antes: un for...of con await secuencial —
    // 20 partidos esperando uno detrás del otro el fetch del escudo rival,
    // hasta 4s cada uno si fallaba, sumaba minutos reales al build).
    const results = await Promise.allSettled(
      shareable.map(match => generateOne({ match, helpers, fontFiles, clubLogoDataUri, ogDir, partidoDir }))
    );
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') { ok++; }
      else { failed++; console.error(`  ✗ Fecha ${shareable[i].fecha} (${torneo}): ${r.reason && r.reason.message}`); }
    });
  }

  console.log(`Listo: ${ok} fichas de partido generadas, ${failed} fallidas.`);
  if (failed > 0) {
    throw new Error(`${failed} ficha(s) de partido fallaron — ver el detalle arriba.`);
  }
}

module.exports = { run };
