// Descarga los .ttf de Inter (Regular 400 + Bold 700 — los mismos pesos
// que usa el resto del sitio) para pasárselos a resvg como buffer real.
// Sin esto, resvg no tiene ninguna fuente "Inter" instalada y cae a lo que
// sea que tenga la máquina de build — que es exactamente el bug original
// (texto en una fuente serif/default en vez de Inter).
//
// Historial de por qué esto terminó así: la API CSS2 de Google Fonts
// decide qué formato de fuente devolver (woff2 vs. truetype) según el
// header User-Agent del pedido — pero qué UA produce qué formato resultó
// bastante menos predecible de lo que documentación/tutoriales sugieren:
// un User-Agent viejo (Chrome 24) devolvió woff2 en vez de truetype; sin
// ningún User-Agent (default de fetch) tampoco devolvió woff2. En vez de
// seguir adivinando un cuarto User-Agent "correcto", el parser ahora
// acepta CUALQUIERA de los dos formatos que venga en la respuesta —
// truetype se usa tal cual, woff2 se descomprime acá con `wawoff2`
// (decodificador puro JS) — así que no importa cuál termine sirviendo
// Google para el User-Agent que mandemos, el build no se rompe por eso.
// Se manda igual un User-Agent de navegador moderno (el más probable para
// conseguir woff2, más liviano de bajar) pero ya no es una apuesta de la
// que dependa todo.
const wawoff2 = require('wawoff2');

const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap';
const MODERN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Separado de fetchInterFonts() para poder testearlo con un CSS de
// muestra, sin red — ver unit_test_fetch_font.js. Devuelve, por peso,
// { url, format } — format es 'woff2' o 'truetype', lo que haya ofrecido
// ese @font-face (se prueban ambos formatos por bloque; si un bloque
// ofreciera los dos — no pasa en la práctica, cada @font-face trae un solo
// src — woff2 gana por ser el que menos hay que procesar después).
function parseFontUrlsByWeight(css) {
  const fontsByWeight = {};
  for (const block of css.split('@font-face').slice(1)) {
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    if (!weightMatch) continue;
    const weight = weightMatch[1];
    const woff2Match = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s*format\('woff2'\)/);
    const ttfMatch = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s*format\('truetype'\)/);
    if (woff2Match) fontsByWeight[weight] = { url: woff2Match[1], format: 'woff2' };
    else if (ttfMatch) fontsByWeight[weight] = { url: ttfMatch[1], format: 'truetype' };
  }
  return fontsByWeight;
}

async function downloadFont({ url, format }) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar ${url} (status ${res.status}).`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (format === 'woff2') {
    const ttfBuffer = await wawoff2.decompress(buffer);
    return Buffer.from(ttfBuffer);
  }
  return buffer; // truetype: resvg lo puede usar tal cual, sin procesar.
}

async function fetchInterFonts() {
  const cssRes = await fetch(FONT_CSS_URL, { headers: { 'User-Agent': MODERN_UA } });
  if (!cssRes.ok) {
    throw new Error(`No se pudo descargar el CSS de Google Fonts para Inter (status ${cssRes.status}).`);
  }
  const css = await cssRes.text();
  const fontsByWeight = parseFontUrlsByWeight(css);

  if (!fontsByWeight['400'] || !fontsByWeight['700']) {
    throw new Error(
      'No se encontraron URLs de Inter 400/700 (ni woff2 ni truetype) en la respuesta de Google Fonts ' +
      '(¿cambió el formato de la respuesta de la API?). ' +
      `Pesos encontrados: ${Object.keys(fontsByWeight).join(', ') || 'ninguno'}.`
    );
  }

  const [regular, bold] = await Promise.all([
    downloadFont(fontsByWeight['400']),
    downloadFont(fontsByWeight['700']),
  ]);

  return { regular, bold };
}

module.exports = { fetchInterFonts, parseFontUrlsByWeight };
