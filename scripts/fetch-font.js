// Descarga los .ttf de Inter (Regular 400 + Bold 700 — los mismos pesos
// que usa el resto del sitio) para pasárselos a resvg como buffer real.
// Sin esto, resvg no tiene ninguna fuente "Inter" instalada y cae a lo que
// sea que tenga la máquina de build — que es exactamente el bug original
// (texto en una fuente serif/default en vez de Inter).
//
// Versión anterior de este archivo pedía la API CSS2 de Google Fonts con
// un User-Agent viejo, apostando a que Google respondiera con TTF en vez
// de WOFF2 para clientes "sin soporte moderno" — es un truco conocido,
// pero resultó frágil: Google puede (y en la práctica lo hizo) devolver
// WOFF2 igual, rompiendo el build entero por depender de una decisión de
// content-negotiation que no controlamos.
//
// Ahora en cambio se pide el CSS2 tal cual (sin fingir ningún User-Agent
// especial — Google le sirve WOFF2 a cualquier cliente moderno, siempre,
// de forma confiable) y el WOFF2 se descomprime acá mismo con `wawoff2`
// (decodificador puro JS) a TTF/OTF crudo, que es lo único que resvg
// puede usar. Así no dependemos de ninguna decisión del lado de Google.
const wawoff2 = require('wawoff2');

const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap';

// Separado de fetchInterFonts() para poder testearlo con un CSS de
// muestra, sin red — ver unit_test_fetch_font.js.
function parseWoff2UrlsByWeight(css) {
  const fontUrlsByWeight = {};
  for (const block of css.split('@font-face').slice(1)) {
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    const urlMatch = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s*format\('woff2'\)/);
    if (!weightMatch || !urlMatch) continue;
    fontUrlsByWeight[weightMatch[1]] = urlMatch[1];
  }
  return fontUrlsByWeight;
}

async function downloadAndDecompress(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar ${url} (status ${res.status}).`);
  const woff2Buffer = Buffer.from(await res.arrayBuffer());
  const ttfBuffer = await wawoff2.decompress(woff2Buffer);
  return Buffer.from(ttfBuffer);
}

async function fetchInterFonts() {
  const cssRes = await fetch(FONT_CSS_URL);
  if (!cssRes.ok) {
    throw new Error(`No se pudo descargar el CSS de Google Fonts para Inter (status ${cssRes.status}).`);
  }
  const css = await cssRes.text();
  const fontUrlsByWeight = parseWoff2UrlsByWeight(css);

  if (!fontUrlsByWeight['400'] || !fontUrlsByWeight['700']) {
    throw new Error(
      'No se encontraron URLs de Inter 400/700 en formato woff2 en la respuesta de Google Fonts ' +
      '(¿cambió el formato de la respuesta de la API?). ' +
      `Pesos encontrados: ${Object.keys(fontUrlsByWeight).join(', ') || 'ninguno'}.`
    );
  }

  const [regular, bold] = await Promise.all([
    downloadAndDecompress(fontUrlsByWeight['400']),
    downloadAndDecompress(fontUrlsByWeight['700']),
  ]);

  return { regular, bold };
}

module.exports = { fetchInterFonts, parseWoff2UrlsByWeight };
