// FALLBACK EN VIVO de la página (con meta og: reales) de un partido — la
// ficha real se hornea en build time (ver scripts/generate-partido-og.js,
// que genera partido/<torneo>/<fecha>/index.html). netlify.toml solo
// redirige acá cuando ESE archivo estático todavía no existe (partido
// cargado después del último deploy): Netlify sirve el archivo real antes
// que aplicar cualquier redirect, así que este código nunca corre para un
// partido ya horneado. Los bots de preview (WhatsApp/Facebook/X) leen los
// meta tags de acá mismo, sin ejecutar JS; los usuarios humanos son
// redirigidos al SPA real (ver el <script> del final).
const { getMatchData, SITE_URL, TORNEO_CFG } = require('../../scripts/_matchPartidoData');

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function redirectPage(target) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" /><script>location.replace(${JSON.stringify(target)});</script></head><body></body></html>`,
  };
}

exports.handler = async (event) => {
  const { torneo, fecha, debug } = event.queryStringParameters || {};
  const cfg = TORNEO_CFG[torneo];
  if (!cfg) return redirectPage(`${SITE_URL}/`);

  // Una excepción real (Apps Script caído, timeout) y una fecha
  // genuinamente inexistente se distinguen para no confundir un bug real
  // con "todavía no hay datos" — con ?debug=1 se puede inspeccionar el
  // mensaje tal cual en vez de ver siempre el mismo redirect a la home.
  let data, fetchError = null;
  try {
    data = await getMatchData(torneo, fecha);
  } catch (e) {
    fetchError = e;
    console.error('partido.js — getMatchData tiró una excepción:', e);
  }
  if (fetchError) {
    if (debug) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: `getMatchData('${torneo}', '${fecha}') tiró una excepción:\n\n${fetchError.stack || fetchError.message || fetchError}`,
      };
    }
    return redirectPage(`${SITE_URL}/#${torneo === 'b' ? 'b' : 'a'}`);
  }
  if (!data) {
    if (debug) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: `getMatchData('${torneo}', '${fecha}') resolvió sin encontrar ese partido (sin excepción) — ¿la fecha existe en el sheet?`,
      };
    }
    // Fecha inexistente (todavía no llegó, o número inválido) — a la vista
    // general del torneo en vez de una página rota.
    return redirectPage(`${SITE_URL}/#${torneo === 'b' ? 'b' : 'a'}`);
  }

  const { match } = data;
  const played = match.resultado !== null;
  const title = `Santa Bárbara vs ${match.rival} — Fecha ${match.fecha} · Club Santa Bárbara`;
  const description = played
    ? `Santa Bárbara ${match.resultado}${match.penales ? ` (pen. ${match.penales})` : ''} — Fecha ${match.fecha}, ${match.torneoBadge}`
    : `Fecha ${match.fecha}, ${match.torneoBadge} — a jugarse`;
  const imageUrl = `${SITE_URL}/.netlify/functions/partido-og?torneo=${encodeURIComponent(torneo)}&fecha=${encodeURIComponent(fecha)}`;
  const pageUrl = `${SITE_URL}/partido/${torneo}/${fecha}`;
  const redirectTarget = `${SITE_URL}/#partido/${torneo}/${encodeURIComponent(fecha)}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Club Santa Bárbara" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
  <!-- Sin meta http-equiv="refresh" a propósito — ver el mismo comentario en
       scripts/generate-og.js (buildPlayerPageHtml): los bots de preview SÍ
       siguen ese redirect, y como el destino real es un hash (#partido/...,
       que el servidor nunca ve) terminarían leyendo estos mismos meta og:
       genéricos en vez de nada — el redirect real para humanos queda solo
       en el script de abajo. -->
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
      'Cache-Control': 'public, max-age=120',
    },
    body: html,
  };
};
