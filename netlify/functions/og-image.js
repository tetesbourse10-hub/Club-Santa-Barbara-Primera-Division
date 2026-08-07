// Sirve el PNG de la tarjeta de un jugador en /jugador-img/:slug.png,
// referenciado como og:image por jugador.js. Reusa el mismo cache de Blobs
// (getOrGenerate ya guarda ambas cosas juntas la primera vez que se pide
// cualquiera de las dos rutas para un slug dado).

const { getOrGenerate, CACHE_TTL_MS } = require('./_shared');

exports.handler = async (event) => {
  const slug = (event.path.match(/\/jugador-img\/([^/]+)\.png$/) || [])[1];
  if (!slug) {
    return { statusCode: 404, body: 'Not found' };
  }

  const siteUrl = process.env.URL || `https://${event.headers.host}`;

  let result = null;
  try {
    result = await getOrGenerate(siteUrl, slug);
  } catch (e) {
    console.error('Error generando imagen de jugador:', e);
  }

  if (!result || !result.pngBuffer) {
    return { statusCode: 404, body: 'Jugador no encontrado' };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}, stale-while-revalidate=604800`,
    },
    body: result.pngBuffer.toString('base64'),
    isBase64Encoded: true,
  };
};
