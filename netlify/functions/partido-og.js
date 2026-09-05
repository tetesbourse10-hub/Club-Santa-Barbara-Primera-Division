// Genera, EN VIVO (por request, no en build), la imagen PNG de preview
// (og:image) de un partido de Fecha a Fecha — ver netlify/functions/
// partido.js (la página HTML que la referencia) y _matchData.js/
// _matchCardSvg.js (de dónde salen los datos y el dibujo). A diferencia de
// scripts/generate-og.js (jugadores, horneado una vez por deploy), acá hace
// falta que sea en vivo: el resultado/plantel citado de un partido de la
// temporada en curso puede cambiar de un día para el otro, y este sitio no
// se redeploya todo el tiempo.
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { Resvg } = require('@resvg/resvg-js');
const { getMatchData, SITE_URL } = require('./_matchData');
const { buildMatchCardSvg } = require('./_matchCardSvg');
const { fetchInterFonts } = require('../../scripts/fetch-font');
const { readTtfFamilyName } = require('../../scripts/ttf-family');

const ROOT = path.join(__dirname, '..', '..');

// Memoizados a nivel de módulo — en una instancia "tibia" (warm) de la
// función, invocaciones sucesivas no vuelven a decodificar los .woff2 ni a
// releer/convertir el logo.
let _fontsPromise = null;
function loadFonts() {
  if (!_fontsPromise) _fontsPromise = fetchInterFonts();
  return _fontsPromise;
}

// BUG REAL encontrado (confirmado con ?debug=fonts: los 3 .ttf decodifican
// bien y dicen "Inter"/"Inter Black", pero la imagen sale con TODO el texto
// invisible — sin ninguna excepción): scripts/generate-og.js le pasa los
// buffers a Resvg vía `font.fontBuffers`, y eso funciona en el build de
// Netlify — pero en el entorno de Netlify Functions (un contenedor Lambda
// mucho más acotado, sin fontconfig instalado) esa misma opción parece
// fallar en silencio del lado de Rust/fontdb. `font.fontFiles` (leer los
// .ttf de un path real en disco) es el camino "de toda la vida" de resvg y
// mucho más probado — se escriben los 3 pesos una sola vez a /tmp (el único
// directorio con permiso de escritura en Lambda) y se referencian por
// archivo en vez de por buffer.
let _fontFilesPromise = null;
async function loadFontFiles() {
  if (!_fontFilesPromise) {
    _fontFilesPromise = (async () => {
      const fonts = await loadFonts();
      const dir = path.join(os.tmpdir(), 'inter-fonts');
      fs.mkdirSync(dir, { recursive: true });
      const files = {};
      for (const [weight, buf] of Object.entries(fonts)) {
        const p = path.join(dir, `inter-${weight}.ttf`);
        if (!fs.existsSync(p)) fs.writeFileSync(p, buf);
        files[weight] = p;
      }
      return files;
    })();
  }
  return _fontFilesPromise;
}
let _logoPromise = null;
function loadLogoDataUri() {
  if (!_logoPromise) {
    _logoPromise = sharp(path.join(ROOT, 'logo-csb.webp')).png().toBuffer()
      .then(buf => `data:image/png;base64,${buf.toString('base64')}`);
  }
  return _logoPromise;
}

// Baja el escudo del rival y lo convierte a PNG en memoria (resvg no
// soporta bien WEBP/JPG, ver nota en scripts/generate-og.js) — acá NO hay
// ningún problema de CORS como en el navegador: es Node pidiendo el archivo
// por HTTP directo. best-effort con timeout corto: si falla o tarda, se
// sigue con el círculo de iniciales de siempre en vez de romper toda la
// imagen.
async function fetchCrestDataUri(url, timeoutMs = 3500) {
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

// Suma goles/asistencias por jugador (una fila por evento en algunas hojas
// viejas, no relevante acá pero se agrupa igual por prolijidad) y arma la
// lista de destacados para la tarjeta.
function sumByStat(jugadores, key) {
  const map = new Map();
  for (const j of jugadores) {
    const n = j[key] || 0;
    if (n <= 0) continue;
    map.set(j.nombre, (map.get(j.nombre) || 0) + n);
  }
  return [...map.entries()].map(([nombre, count]) => ({ nombre, count }));
}

exports.handler = async (event) => {
  try {
    const { torneo, fecha, debug } = event.queryStringParameters || {};
    const data = await getMatchData(torneo, fecha);
    if (!data) return { statusCode: 404, body: 'Partido no encontrado' };
    const { match, helpers } = data;

    const [fonts, clubLogoDataUri] = await Promise.all([loadFonts(), loadLogoDataUri()]);

    // Chequeo explícito (mismo que scripts/generate-og.js hace en build):
    // si la tabla 'name' del .ttf no dice "Inter", resvg nunca va a poder
    // matchearlo contra font-family="Inter" del SVG — y eso puede pasar en
    // silencio (texto invisible o con otra fuente) en vez de tirar una
    // excepción. Con ?debug=1 se puede ver el resultado sin generar la
    // imagen entera.
    const fontCheck = {
      regular: { bytes: fonts.regular.length, family: readTtfFamilyName(fonts.regular) },
      bold: { bytes: fonts.bold.length, family: readTtfFamilyName(fonts.bold) },
      black: { bytes: fonts.black.length, family: readTtfFamilyName(fonts.black) },
    };
    const fontsOk = Object.values(fontCheck).every(f => f.family && /inter/i.test(f.family));
    if (debug === 'fonts') {
      return {
        statusCode: fontsOk ? 200 : 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: `fontsOk=${fontsOk}\n${JSON.stringify(fontCheck, null, 2)}`,
      };
    }
    if (!fontsOk) {
      console.error('partido-og: la fuente Inter no se decodificó bien:', fontCheck);
    }

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
    // Marcador central: resultado si el partido ya se jugó; si es pendiente,
    // la hora (ej. "17:00 HS") en vez de un genérico "vs" — solo cae a "VS"
    // si ni siquiera hay hora cargada.
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

    const fontFiles = await loadFontFiles();
    const png = new Resvg(svg, {
      font: {
        fontFiles: [fontFiles.regular, fontFiles.bold, fontFiles.black],
        loadSystemFonts: false, defaultFontFamily: 'Inter',
      },
    }).render().asPng();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/png',
        // 5 min: lo bastante para que WhatsApp/Facebook no vuelvan a pedirla
        // en cada preview, poco como para que un resultado recién cargado
        // no tarde en verse.
        'Cache-Control': 'public, max-age=300',
      },
      body: png.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    console.error('partido-og:', e);
    return { statusCode: 500, body: 'Error generando la imagen: ' + (e && e.message) };
  }
};
