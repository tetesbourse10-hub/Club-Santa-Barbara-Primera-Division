// Lee los .ttf de Inter (Regular 400 + Bold 700 + Black 900 — los mismos
// pesos que usa el resto del sitio, incluida la tarjeta de share) para
// pasárselos a resvg como buffer real.
// Sin esto, resvg no tiene ninguna fuente "Inter" instalada y cae a lo que
// sea que tenga la máquina de build — que es exactamente el bug original
// (texto en una fuente serif/default en vez de Inter).
//
// BUG REAL encontrado (reportado como "el texto y los números no son
// acordes a los de la página" + "se ve muy chico"): esta función ANTES
// scrapeaba el CSS dinámico de Google Fonts (fonts.googleapis.com/css2).
// Verificado a mano: para el subset "latin" (el que realmente se usa acá,
// sin unicode-range restringido) Google devuelve HOY el mismo archivo
// .woff2 para los 3 pesos pedidos (400/700/900) — confirmado por hash: los
// 3 buffers descargados salían byte-por-byte IDÉNTICOS. Ese .woff2 resultó
// ser una fuente VARIABLE (trae tabla 'fvar'), no 3 estáticas — resvg no
// instancia el eje de peso de una variable font a partir de sólo
// font-weight="900" en el SVG, así que terminaba dibujando siempre el
// mismo maestro (más parecido a Regular) sin importar qué peso pidiera
// cada texto. Como la tabla 'name' de esa variable font sí dice "Inter"
// (ver el chequeo en generate-og.js), el build nunca tiraba error — el
// texto salía con la fuente "correcta" de nombre pero con un peso
// incorrecto, más fino y por eso más chico/gris de lo esperado.
//
// Fix: en vez de depender del CSS dinámico de Google (que puede volver a
// cambiar de variable a estática sin aviso), se leen directamente los 3
// archivos .woff2 ESTÁTICOS del paquete npm @fontsource/inter (ver
// package.json) — cada peso es un archivo propio, sin ambigüedad de eje
// variable, versionado y reproducible entre builds.
const fs = require('fs');
const path = require('path');
const wawoff2 = require('wawoff2');

// Ruta a los .woff2 que trae el paquete — falla temprano y con mensaje
// claro si @fontsource/inter no está instalado en vez de un ENOENT crudo
// más abajo.
function fontsDir() {
  try {
    // require.resolve encuentra el propio package.json del paquete sin
    // asumir la ubicación de node_modules (funciona igual si el build
    // corre desde otro cwd).
    return path.join(path.dirname(require.resolve('@fontsource/inter/package.json')), 'files');
  } catch (e) {
    throw new Error(
      'No se encontró el paquete "@fontsource/inter" (ver package.json → dependencies). ' +
      'Corré "npm install" antes del build. Error original: ' + e.message
    );
  }
}

async function loadWeight(dir, weight) {
  const file = path.join(dir, `inter-latin-${weight}-normal.woff2`);
  if (!fs.existsSync(file)) {
    throw new Error(`No se encontró ${file} — ¿cambió el layout de archivos de @fontsource/inter?`);
  }
  const woff2Buf = fs.readFileSync(file);
  return Buffer.from(await wawoff2.decompress(woff2Buf));
}

async function fetchInterFonts() {
  const dir = fontsDir();
  // BUG REAL encontrado en el build de Netlify (después de este mismo
  // cambio): descomprimir los 3 .woff2 en paralelo vía Promise.all corrompe
  // silenciosamente 2 de los 3 buffers — `wawoff2` decodifica sobre una
  // instancia de WASM compartida, y descomprimir 3 archivos DISTINTOS al
  // mismo tiempo pisa la memoria lineal compartida entre llamadas
  // concurrentes (confirmado a mano: en paralelo, 2 de los 3 buffers
  // salían con bytes de arranque que no son un sfnt/TTF válido — ni
  // siquiera tiraban excepción, el .ttf quedaba corrupto en silencio, así
  // que el chequeo de la tabla 'name' fallaba con "(no encontrado)"). Antes
  // este mismo Promise.all no lo mostraba porque los 3 pesos resolvían a
  // la MISMA URL (el bug de la fuente variable, ver más abajo) — 3
  // descompresiones concurrentes de datos IDÉNTICOS no se pisan de forma
  // visible entre sí. Con 3 archivos realmente distintos, sí. Se
  // descomprime secuencial (await uno por uno) para no correr wawoff2 en
  // paralelo — 3 archivos chicos, el costo extra es insignificante.
  const regular = await loadWeight(dir, 400);
  const bold = await loadWeight(dir, 700);
  const black = await loadWeight(dir, 900);

  // Red de seguridad barata contra esta MISMA clase de bug si la fuente
  // volviera a servirse consolidada (variable) por cualquier motivo: si
  // dos pesos terminan siendo el mismo archivo, el build falla fuerte acá
  // en vez de generar imágenes con el peso equivocado en silencio.
  const md5 = buf => require('crypto').createHash('md5').update(buf).digest('hex');
  const hashes = { regular: md5(regular), bold: md5(bold), black: md5(black) };
  const unique = new Set(Object.values(hashes));
  if (unique.size !== 3) {
    throw new Error(
      `Los 3 pesos de Inter (Regular/Bold/Black) deberían ser 3 archivos distintos, pero al menos dos son idénticos ` +
      `(hashes: ${JSON.stringify(hashes)}). Esto es exactamente el bug de "texto con el peso equivocado" — build abortado.`
    );
  }

  return { regular, bold, black };
}

module.exports = { fetchInterFonts };
