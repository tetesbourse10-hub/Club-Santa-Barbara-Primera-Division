// Motor de datos de partidos para la Ficha de Partido compartible — carga el
// motor REAL del sitio (index.html) dentro de jsdom, la misma técnica que ya
// usa scripts/generate-og.js, para no duplicar (y arriesgar desincronizar)
// la lógica de fetch/parseo de Fecha a Fecha en una segunda copia a mano. No
// se llama loadLiveData() completo (dispara ~30 fetches en paralelo, pensado
// para el jugador) — se piden solo los 2 fetches puntuales (detalle +
// resumen básico) que hacen falta para el torneo actual y sus fechas.
//
// Esquema híbrido: la ficha se hornea en build time (scripts/generate-
// partido-og.js, ver getAllMatches) para no depender de una Netlify Function
// en vivo para el caso común — pero cargar el 11/los incidentes de un
// partido no amerita gastar uno de los minutos de build limitados (300/mes)
// solo para que el link comparta datos frescos. netlify/functions/partido.js
// y partido-og.js usan getMatchData (acá abajo) como FALLBACK en vivo: la
// regla de netlify.toml solo los invoca cuando el archivo horneado para esa
// fecha todavía no existe (Netlify sirve un archivo estático real antes que
// aplicar cualquier redirect, así que esto es automático, no hace falta
// chequearlo a mano). Ese camino en vivo es deliberadamente LIVIANO (jsdom +
// 2 fetches puntuales, no loadLiveData() completo) para entrar cómodo en el
// límite de 10s de una Function.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
// DEPLOY_PRIME_URL primero: `URL` es SIEMPRE el dominio canónico de
// producción (constante en todos los contextos de deploy de Netlify),
// mientras que DEPLOY_PRIME_URL es el del deploy ACTUAL — coincide con URL
// en producción, pero en una Deploy Preview es el subdominio propio de esa
// preview. Invertido (URL primero) fue un bug real: en cualquier Deploy
// Preview, las URLs de imagen/página de partido terminaban apuntando a
// producción (que todavía no tiene ese archivo) en vez de a la preview
// donde sí existía — Facebook lo reportaba como "tipo de contenido de
// imagen no válido" al pedir la imagen en el dominio equivocado. Mismo
// criterio que ya usa correctamente scripts/generate-og.js.
const SITE_URL = (process.env.DEPLOY_PRIME_URL || process.env.URL || 'https://clubsantabarbara.netlify.app').replace(/\/$/, '');

// Memoizado a nivel de módulo: generate-partido-og.js pide los 2 torneos
// (a/b) en la misma corrida — esto evita volver a parsear/evaluar las
// ~18.000 líneas de index.html una segunda vez.
let _enginePromise = null;
function _loadEngine() {
  if (!_enginePromise) {
    _enginePromise = (async () => {
      const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
      // BUG REAL encontrado ("Cannot read properties of undefined (reading
      // 'A_MAIN')"): un `const`/`let` de nivel superior en index.html (GS,
      // RIVAL_CREST_URLS, AP_BAND_Y, AP_BAND_OF...) NO queda como propiedad
      // de `window` — a diferencia de `function`/`var`, que sí (misma
      // semántica que en cualquier navegador real, no un tema de jsdom).
      // scripts/generate-og.js nunca pisó esto porque todo lo que usa ahí
      // son funciones (`window.loadLiveData`, `window._collectPlayerStats`,
      // etc.), nunca un objeto `const` a secas. Confirmado a mano que un
      // SEGUNDO `window.eval(...)` separado NO ve esos bindings (jsdom no
      // los comparte entre llamadas a eval) — la única forma que funciona es
      // agregar el `window.X = X` DENTRO del mismo string evaluado, así
      // comparte el scope léxico real donde se declararon.
      const exposeConsts = "\n;window.GS=GS;window.RIVAL_CREST_URLS=RIVAL_CREST_URLS;window.AP_BAND_Y=AP_BAND_Y;window.AP_BAND_OF=AP_BAND_OF;window.JUG_COL=JUG_COL;window.JUG_COL_B=JUG_COL_B;\n";
      const combinedScript = scripts.join('\n;\n') + exposeConsts;
      // Antes se le pasaba a jsdom el HTML REAL completo (~18.000 líneas,
      // menos los <script>) para que arme el documento — pero nada de lo
      // que este fallback en vivo usa (parseDetailedMatches, formatISODia/
      // Hora, slugify, rivalInitials, rivalAvatarColor, plantelPosColor,
      // apBand, fetchProxy) lee un solo elemento del DOM: son funciones
      // puras sobre arrays/strings. Parsear y montar ese árbol DOM entero
      // solo para nunca leerlo era el costo más caro y más fácil de sacar
      // del arranque en vivo (medido a mano: ~320ms con el HTML real
      // contra ~20ms con un shell vacío). Cualquier código de index.html
      // que SÍ toque el DOM al nivel superior (fuera de una función) ya
      // tiene que estar gateado detrás de `if (window.__OG_BUILD__)` desde
      // que se armó el build de fichas de jugador (ver generate-og.js) —
      // ese mismo gate es lo que hace seguro no tener acá ni un solo
      // elemento real.
      const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: SITE_URL + '/', runScripts: 'outside-only', pretendToBeVisual: true });
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
    // Tabla de Posiciones en vivo: mismo sheet dedicado (GS.POSICIONES) y
    // pestaña ("Posiciones_A") que ya usa loadLiveData() — ver el
    // comentario junto a GS.POSICIONES en index.html.
    posicionesGid: 22569147,
  },
  b: {
    tab: 'CLAUSURA 2026 AIFA B', sheetKey: 'B_HIST',
    detRange: 'A19:J561', basicRange: 'A1:J16',
    badge: 'Clausura AIFA B 2026', color: '#3b82f6',
    posicionesGid: 1670392238,
  },
};
const POSICIONES_RANGE = 'A1:K17';

const _helpersCache = new WeakMap();
function buildHelpers(window) {
  if (!_helpersCache.has(window)) {
    _helpersCache.set(window, {
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
      parseTablaSheet: window.parseTablaSheet,
      GS: window.GS,
      fetchGvizByGid: window.fetchGvizByGid,
    });
  }
  return _helpersCache.get(window);
}

// Núcleo real: todos los partidos de un torneo + los helpers, a partir de
// un `window` YA bootstrapeado (jsdom + index.html evaluado). Separado de
// getAllMatches de abajo para que scripts/generate-og.js pueda reusar el
// MISMO window que ya bootstrapeó para las fichas de jugador, en vez de
// levantar un segundo jsdom completo (build real: agregar un segundo boot
// —parsear/evaluar las ~18.000 líneas de index.html otra vez— fue lo que
// hizo que el build se pasara del límite de tiempo de Netlify).
async function getAllMatchesFromWindow(window, torneo) {
  const cfg = TORNEO_CFG[torneo];
  if (!cfg) return null;
  const sheetId = window.GS[cfg.sheetKey];

  const [detRows, basicRows] = await Promise.all([
    window.fetchProxy(cfg.tab, cfg.detRange, sheetId),
    window.fetchProxy(cfg.tab, cfg.basicRange, sheetId),
  ]);
  const detailed = window.parseDetailedMatches(detRows, true);
  let basicByFecha = new Map();
  try {
    const basicMatches = window.parseMatches(basicRows);
    basicByFecha = new Map(basicMatches.map(b => [String(b.fecha), b.local]));
  } catch (e) { /* la tabla resumen es un enriquecimiento, no algo crítico */ }

  const matches = detailed.map(m => ({
    rival: m.rival, fecha: m.fecha, dia: m.dia, hora: m.hora, lugar: m.lugar,
    formacionCSB: m.formacionCSB, formacionRival: m.formacionRival,
    resultado: m.resultado, gf: m.gf, gc: m.gc, penales: m.penales,
    jugadores: m.jugadores || [], local: basicByFecha.get(String(m.fecha)) || null,
    torneoBadge: cfg.badge, torneoColor: cfg.color,
  }));

  return { matches, helpers: buildHelpers(window) };
}

// Standalone: bootstrapea su PROPIO window (levanta un jsdom nuevo la
// primera vez que se llama). La usa el fallback en vivo
// (netlify/functions/partido.js/partido-og.js, por request — ahí SÍ hace
// falta su propio jsdom, no hay ningún build corriendo para reusar) y
// cualquier otro consumidor que no tenga ya un window bootstrapeado a mano.
async function getAllMatches(torneo) {
  const window = await _loadEngine();
  return getAllMatchesFromWindow(window, torneo);
}

// Tabla de Posiciones completa de un torneo — reusa parseTablaSheet/
// fetchGvizByGid, las MISMAS funciones que ya usa loadLiveData() para esto
// mismo en el sitio en vivo, en vez de reimplementar el parseo de la tabla
// acá (columnas detectadas por header, no por posición fija — ver el
// comentario de parseTablaSheet en index.html). Usada por
// netlify/functions/push-scheduler.js para la regla de "subió/bajó/puntero"
// y "próximo rival".
async function getTabla(torneo) {
  const cfg = TORNEO_CFG[torneo];
  if (!cfg) return null;
  const window = await _loadEngine();
  const rows = await window.fetchGvizByGid(window.GS.POSICIONES, cfg.posicionesGid, POSICIONES_RANGE);
  return window.parseTablaSheet(rows);
}

// El Nido — mismo criterio de fetch+armado que usa _nidoLoad() en vivo
// (index.html): tabla "Jugadores Estadisticas" de A_MAIN y B_HIST, cada fila
// pasada por _mergeDuplicatePlayerRows (top-level, ya expuesta en window sin
// hacer nada extra) y normA/normB (expuestas a propósito en window.normA/
// normB dentro del IIFE de El Nido — ver ese comentario en index.html), y
// combinadas con mergeAB (misma función real que arma el ranking "General").
// Usada por netlify/functions/push-scheduler.js para la regla de "entró al
// Top 10 de El Nido".
const EL_NIDO_EXCLUIR = ['jugador', 'team totals', 'totales', 'total'];
function _rowsToNidoObjects(rows, COL, normFn, window) {
  if (!rows || rows.length < 2) return [];
  const cols = rows[0].map(c => String(c).trim());
  const parsed = rows.slice(1)
    .filter(r => r.some(c => c !== '' && c !== null))
    .map(r => cols.map((_, i) => String(r[i] ?? '').trim()))
    .filter(r => !EL_NIDO_EXCLUIR.includes(String(r[COL.nombre] || '').toLowerCase().trim()));
  const merged = window._mergeDuplicatePlayerRows(parsed, COL);
  return merged.map(normFn).filter(Boolean);
}
async function getElNidoRankings() {
  const window = await _loadEngine();
  const [rowsA, rowsB] = await Promise.all([
    window.fetchProxy('Jugadores Estadisticas', null, window.GS.A_MAIN),
    // Primera B: el nombre de tab sin tilde a veces no existe en alguna
    // temporada — mismo fallback con tilde que ya usa _ensureJugTotalesB.
    window.fetchProxy('Jugadores Estadisticas', null, window.GS.B_HIST)
      .catch(() => window.fetchProxy('Jugadores Estadísticas', null, window.GS.B_HIST)),
  ]);
  const a = _rowsToNidoObjects(rowsA, window.JUG_COL, window.normA, window);
  const b = _rowsToNidoObjects(rowsB, window.JUG_COL_B, window.normB, window);
  const general = window.mergeAB(a, b);
  return { general, a, b };
}

// Un solo partido por torneo+fecha — lo usa el fallback en vivo
// (netlify/functions/partido.js/partido-og.js). Internamente pide la MISMA
// lista completa que getAllMatches (mismos 2 fetches, no hay un tercer
// camino a mantener sincronizado) y busca la fecha pedida.
async function getMatchData(torneo, fecha) {
  if (!fecha) return null;
  const data = await getAllMatches(torneo);
  if (!data) return null;
  const match = data.matches.find(m => String(m.fecha) === String(fecha));
  if (!match) return null;
  return { match, helpers: data.helpers };
}

module.exports = { getAllMatches, getAllMatchesFromWindow, getMatchData, getTabla, getElNidoRankings, SITE_URL, TORNEO_CFG };
