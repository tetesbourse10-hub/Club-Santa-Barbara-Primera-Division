// Motor de datos compartido por partido.js (página HTML con meta og:) y
// partido-og.js (la imagen PNG en sí) — carga el motor REAL del sitio
// (index.html) dentro de jsdom, la misma técnica que ya usa
// scripts/generate-og.js en build time, para no duplicar (y arriesgar
// desincronizar) la lógica de fetch/parseo de Fecha a Fecha en una segunda
// copia a mano. A diferencia del build, acá NO se llama loadLiveData()
// completo (dispara ~30 fetches en paralelo, pensado para correr una vez por
// deploy, no por cada visita) — se piden solo los 2 fetches puntuales
// (detalle + resumen básico) que hacen falta para ESTE partido.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const SITE_URL = (process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://clubsantabarbara.netlify.app').replace(/\/$/, '');

// Memoizado a nivel de módulo: en una instancia "tibia" (warm) de la función,
// invocaciones sucesivas reusan el mismo jsdom en vez de volver a parsear/
// evaluar las ~18.000 líneas de index.html en cada request.
let _enginePromise = null;
function _loadEngine() {
  if (!_enginePromise) {
    _enginePromise = (async () => {
      const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
      const combinedScript = scripts.join('\n;\n');
      const htmlNoScripts = html.replace(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/g, '');
      const dom = new JSDOM(htmlNoScripts, { url: SITE_URL + '/', runScripts: 'outside-only', pretendToBeVisual: true });
      const { window } = dom;
      window.fetch = (...args) => fetch(...args);
      window.__OG_BUILD__ = true;
      dom.window.eval(combinedScript);
      return window;
    })();
  }
  return _enginePromise;
}

// torneo: 'a' (Clausura AIFA A 2026) | 'b' (Clausura AIFA B 2026) — los dos
// únicos torneos cubiertos por ahora (los mismos que ya usa el botón
// "Compartir" de Fecha a Fecha del lado del cliente). Sumar copas o
// temporadas viejas más adelante es agregar un caso más acá, no reescribir
// nada de esto.
const TORNEO_CFG = {
  a: {
    tab: 'Clausura 2026', sheetKey: 'A_MAIN',
    detRange: 'A22:I532', basicRange: 'A1:J18',
    badge: 'Clausura AIFA A 2026', color: '#fbbf24',
  },
  b: {
    tab: 'CLAUSURA 2026 AIFA B', sheetKey: 'B_HIST',
    detRange: 'A19:J561', basicRange: 'A1:J16',
    badge: 'Clausura AIFA B 2026', color: '#3b82f6',
  },
};

// Devuelve { match, helpers } o null si el torneo/fecha no existe (todavía,
// o nunca). `helpers` expone las mismas funciones puras que ya usa el
// cliente (RIVAL_CREST_URLS, slugify, _rivalInitials, _rivalAvatarColor,
// _plantelPosColor, apBand/AP_BAND_Y/AP_BAND_OF para la cancha) sin
// duplicarlas a mano.
async function getMatchData(torneo, fecha) {
  const cfg = TORNEO_CFG[torneo];
  if (!cfg || !fecha) return null;
  const window = await _loadEngine();
  const sheetId = window.GS[cfg.sheetKey];

  const [detRows, basicRows] = await Promise.all([
    window.fetchProxy(cfg.tab, cfg.detRange, sheetId),
    window.fetchProxy(cfg.tab, cfg.basicRange, sheetId),
  ]);
  const detailed = window.parseDetailedMatches(detRows, true);
  const m = detailed.find(mm => String(mm.fecha) === String(fecha));
  if (!m) return null;

  let local = null;
  try {
    const basicMatches = window.parseMatches(basicRows);
    const b = basicMatches.find(bb => String(bb.fecha) === String(fecha));
    local = b ? b.local : null;
  } catch (e) { /* la tabla resumen es un enriquecimiento, no algo crítico */ }

  return {
    match: {
      rival: m.rival, fecha: m.fecha, dia: m.dia, hora: m.hora, lugar: m.lugar,
      formacionCSB: m.formacionCSB, formacionRival: m.formacionRival,
      resultado: m.resultado, gf: m.gf, gc: m.gc, penales: m.penales,
      jugadores: m.jugadores || [], local, torneoBadge: cfg.badge, torneoColor: cfg.color,
    },
    helpers: {
      slugify: window.slugify,
      RIVAL_CREST_URLS: window.RIVAL_CREST_URLS,
      rivalInitials: window._rivalInitials,
      rivalAvatarColor: window._rivalAvatarColor,
      plantelPosColor: window._plantelPosColor,
      apBand: window.apBand,
      AP_BAND_Y: window.AP_BAND_Y,
      AP_BAND_OF: window.AP_BAND_OF,
      formatISODia: window.formatISODia,
      formatISOHora: window.formatISOHora,
    },
  };
}

module.exports = { getMatchData, SITE_URL, TORNEO_CFG };
