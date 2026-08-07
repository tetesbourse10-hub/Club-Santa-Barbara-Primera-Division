// Lógica compartida por jugador.js (HTML con meta og:) y og-image.js (PNG).
//
// Por qué headless en vez de reimplementar las stats en Node: las stats de
// cada jugador (goles, asist, PJ, logros TOP 5) se calculan en el cliente a
// partir de ~30 fetches crudos a Google Sheets + miles de líneas de lógica
// de agregación en index.html (_collectPlayerStats, _nidoGetMerged,
// _ppComputeTopLogros, etc.). No existe una sola hoja "maestra" con los
// totales ya calculados. Reimplementar ese pipeline acá adentro duplicaría
// esa lógica en dos lenguajes/lugares, con riesgo de que se desincronicen.
// En cambio, este módulo abre el sitio real en un Chromium headless, deja
// que termine de cargar los datos en vivo (loadLiveData) y llama
// directamente a las mismas funciones globales que ya usa el botón
// "Compartir" (_ppBuildShareCardHtml, slugify, etc.) — una sola fuente de
// verdad.
//
// El resultado (PNG de la tarjeta + metadata de texto para los meta og:) se
// cachea en Netlify Blobs por slug, con un TTL corto, para no relanzar un
// Chromium headless en cada visita — solo cuando el cache expira o no
// existe.

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { getStore } = require('@netlify/blobs');

// Cuánto tiempo se sirve un resultado cacheado antes de regenerarlo. Las
// stats cambian cuando se juega una fecha, no en tiempo real, así que un par
// de horas es un buen compromiso entre frescura y no regenerar de más.
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas
const NAV_TIMEOUT_MS = 25000;
const DATA_WAIT_TIMEOUT_MS = 20000;

function store() {
  return getStore('og-cache');
}

async function getCached(slug) {
  const s = store();
  const meta = await s.get(`${slug}.json`, { type: 'json' }).catch(() => null);
  if (!meta) return null;
  if (Date.now() - meta.generatedAt > CACHE_TTL_MS) return null;
  return meta;
}

async function getCachedImage(slug) {
  const s = store();
  return s.get(`${slug}.png`, { type: 'arrayBuffer' }).catch(() => null);
}

async function launchBrowser() {
  const executablePath = await chromium.executablePath();
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 600, height: 800, deviceScaleFactor: 2 },
    executablePath,
    headless: chromium.headless,
  });
}

// Navega al sitio, espera a que carguen los datos en vivo, resuelve el slug
// a un nombre real de jugador, arma la tarjeta de preview y la fotografía.
// Devuelve { nombre, pos, goles, asist, pj, pngBuffer } o null si el slug no
// corresponde a ningún jugador conocido.
async function generate(siteUrl, slug) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(`${siteUrl}/#jugador/${slug}`, {
      waitUntil: 'networkidle2',
      timeout: NAV_TIMEOUT_MS,
    });

    // El pool de jugadores (window._nidoGetMerged) solo existe una vez que
    // loadLiveData() terminó al menos una pasada completa.
    await page.waitForFunction(
      () => typeof window._nidoGetMerged === 'function' && window._nidoGetMerged().length > 0,
      { timeout: DATA_WAIT_TIMEOUT_MS }
    );

    const nombre = await page.evaluate((slugParam) => {
      const merged = window._nidoGetMerged();
      const found = merged.find(p => window.slugify(p.nombre) === slugParam);
      return found ? found.nombre : null;
    }, slug);

    if (!nombre) return null;

    const meta = await page.evaluate((nombreParam) => {
      const s = window._collectPlayerStats(nombreParam);
      return { nombre: s.nombre, pos: s.pos, goles: s.goles, asist: s.asist, pj: s.pj };
    }, nombre);

    // Monta la tarjeta fuera de pantalla (mismo HTML/CSS que ya existe en
    // el sitio, ver .pp-share-card) y la fotografía directo, sin depender
    // de html2canvas — Puppeteer puede capturar un nodo del DOM tal cual.
    await page.evaluate((nombreParam) => {
      const el = document.createElement('div');
      el.id = '__og_capture__';
      el.className = 'pp-share-card';
      el.style.position = 'fixed';
      el.style.left = '0';
      el.style.top = '0';
      el.innerHTML = window._ppBuildShareCardHtml(nombreParam);
      document.body.appendChild(el);
    }, nombre);

    const cardHandle = await page.$('#__og_capture__');
    if (!cardHandle) return null;
    const pngBuffer = await cardHandle.screenshot({ type: 'png' });

    return { ...meta, pngBuffer };
  } finally {
    await browser.close();
  }
}

// Devuelve la metadata (texto) + PNG para un slug, usando el cache de Blobs
// cuando es válido, o generando (y guardando) uno nuevo si no.
async function getOrGenerate(siteUrl, slug) {
  const cachedMeta = await getCached(slug);
  if (cachedMeta) {
    const cachedPng = await getCachedImage(slug);
    if (cachedPng) return { ...cachedMeta, pngBuffer: Buffer.from(cachedPng) };
  }

  const result = await generate(siteUrl, slug);
  if (!result) return null;

  const { pngBuffer, ...meta } = result;
  const metaToStore = { ...meta, generatedAt: Date.now() };
  const s = store();
  await Promise.all([
    s.set(`${slug}.json`, JSON.stringify(metaToStore)),
    s.set(`${slug}.png`, pngBuffer),
  ]);

  return { ...metaToStore, pngBuffer };
}

module.exports = { getOrGenerate, CACHE_TTL_MS };
