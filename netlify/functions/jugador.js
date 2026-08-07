// Sirve /jugador/:slug con los meta og: correctos para ese jugador
// (og:title, og:description, og:image) para que WhatsApp/Facebook/X/Slack/
// Telegram etc. muestren una preview real — esos bots no ejecutan JS y
// nunca ven el fragmento #jugador/slug del SPA, así que esta ruta con path
// real es indispensable.
//
// A un usuario real (con JS) lo redirige de inmediato a /#jugador/:slug,
// que es donde vive la app de verdad; el HTML de acá solo importa para el
// primer GET que hace el bot de preview.

const { getOrGenerate } = require('./_shared');

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

exports.handler = async (event) => {
  const slug = (event.path.match(/\/jugador\/([^/]+)/) || [])[1];
  if (!slug) {
    return { statusCode: 404, body: 'Not found' };
  }

  const siteUrl = process.env.URL || `https://${event.headers.host}`;
  const redirectTarget = `${siteUrl}/#jugador/${slug}`;

  let meta = null;
  try {
    meta = await getOrGenerate(siteUrl, slug);
  } catch (e) {
    console.error('Error generando preview de jugador:', e);
  }

  const title = meta ? `${meta.nombre} — Club Santa Bárbara` : 'Club Santa Bárbara';
  const description = meta
    ? `${meta.pos || 'Jugador'} · ${meta.goles} goles · ${meta.asist} asistencias · ${meta.pj} PJ — Club Santa Bárbara`
    : 'Estadísticas, resultados y jugadores de Club Santa Bárbara.';
  const image = meta ? `${siteUrl}/jugador-img/${slug}.png` : `${siteUrl}/logo-csb.webp`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Club Santa Bárbara" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(siteUrl + '/jugador/' + slug)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <meta http-equiv="refresh" content="0; url=${escapeHtml(redirectTarget)}" />
  <script>location.replace(${JSON.stringify(redirectTarget)});</script>
</head>
<body>
  <p>Redirigiendo a <a href="${escapeHtml(redirectTarget)}">${escapeHtml(title)}</a>…</p>
</body>
</html>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Cache corto en el borde: si el cache de Blobs ya está frío, un
      // segundo bot pidiendo la misma preview 2 minutos después no debería
      // relanzar Chromium — igual queda cubierto por el cache de Blobs
      // adentro de getOrGenerate, esto es una capa extra en el CDN.
      'Cache-Control': 'public, max-age=300, s-maxage=1800',
    },
    body: html,
  };
};
