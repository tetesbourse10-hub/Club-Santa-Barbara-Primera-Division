// Lee la tabla 'name' de un .ttf y devuelve el Font Family Name (nameID 1)
// — parser mínimo a mano (sin dependencias) del formato sfnt/TrueType.
// Usado como diagnóstico (build de scripts/generate-og.js y la función
// scripts/generate-partido-og.js): si el nombre real embebido en el
// archivo no dice "Inter", resvg nunca va a poder matchearlo contra
// font-family="Inter" del SVG — y eso puede pasar en silencio, sin tirar
// ninguna excepción (el texto sale con otra fuente, o directamente
// invisible si no hay ningún fallback disponible).
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
      // .subarray() es una VISTA sobre el buffer real de la fuente (el mismo
      // que después se le pasa a Resvg para renderizar de verdad) —
      // .swap16() muta en el lugar, así que hace falta copiar con
      // Buffer.from() ANTES de tocarlo. Mutar el original acá corrompería
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

module.exports = { readTtfFamilyName };
