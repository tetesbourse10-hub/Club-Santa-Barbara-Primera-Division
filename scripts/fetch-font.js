// Descarga los .ttf de Inter (Regular 400 + Bold 700 — los mismos pesos
// que usa el resto del sitio) desde Google Fonts en build time, para
// pasárselos a resvg como buffer real. Sin esto, resvg no tiene ninguna
// fuente "Inter" instalada y cae a lo que sea que tenga la máquina de
// build — que es exactamente el bug reportado (texto en una fuente
// serif/default en vez de Inter).
//
// El truco: la API CSS2 de Google Fonts sirve WOFF2 a navegadores
// modernos (según el header User-Agent), pero sirve TTF de toda la vida a
// clientes con un User-Agent viejo/sin soporte reconocido — un truco
// bien conocido (lo usan varios tutoriales de satori/resvg y la librería
// google-fonts-helper) para conseguir el binario TTF crudo que resvg
// necesita, sin tener que decodificar WOFF2 nosotros mismos (cosa que
// resvg no hace).
const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap';
// Chrome 24 es anterior al soporte de WOFF2 (llegó en Chrome 36) — Google
// le sirve TTF a este UA.
const OLD_UA = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/24.0.1312.57 Safari/537.36';

// Separado de fetchInterFonts() para poder testearlo con un CSS de
// muestra, sin red — ver unit_test_fetch_font.js.
function parseTtfUrlsByWeight(css) {
  const fontUrlsByWeight = {};
  for (const block of css.split('@font-face').slice(1)) {
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    const urlMatch = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s*format\('truetype'\)/);
    if (!weightMatch || !urlMatch) continue;
    fontUrlsByWeight[weightMatch[1]] = urlMatch[1];
  }
  return fontUrlsByWeight;
}

async function fetchInterFonts() {
  const cssRes = await fetch(FONT_CSS_URL, { headers: { 'User-Agent': OLD_UA } });
  if (!cssRes.ok) {
    throw new Error(`No se pudo descargar el CSS de Google Fonts para Inter (status ${cssRes.status}).`);
  }
  const css = await cssRes.text();
  const fontUrlsByWeight = parseTtfUrlsByWeight(css);

  if (!fontUrlsByWeight['400'] || !fontUrlsByWeight['700']) {
    throw new Error(
      'No se encontraron URLs de Inter 400/700 en formato truetype en la respuesta de Google Fonts ' +
      '(¿cambió el formato de la API, o dejó de servir TTF al User-Agent viejo que usamos?). ' +
      `Pesos encontrados: ${Object.keys(fontUrlsByWeight).join(', ') || 'ninguno'}.`
    );
  }

  const [regular, bold] = await Promise.all([
    fetch(fontUrlsByWeight['400']).then(r => r.arrayBuffer()).then(Buffer.from),
    fetch(fontUrlsByWeight['700']).then(r => r.arrayBuffer()).then(Buffer.from),
  ]);

  return { regular, bold };
}

module.exports = { fetchInterFonts, parseTtfUrlsByWeight };
