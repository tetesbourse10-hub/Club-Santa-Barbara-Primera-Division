// Página real (con meta og: resueltos) para /partido/:torneo/:fecha —
// mismo patrón que scripts/generate-og.js usa para /jugador/:slug, pero
// generada EN VIVO (ver netlify/functions/partido-og.js para el porqué) en
// vez de una vez por deploy. Los bots de preview (WhatsApp/Facebook/X) leen
// los meta tags de acá mismo, sin ejecutar JS; los usuarios humanos son
// redirigidos al SPA real (ver el <script> del final).
const { getMatchData, SITE_URL, TORNEO_CFG } = require('./_matchData');

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

  // BUG REAL encontrado (reportado: el link siempre termina en la home):
  // antes, un fetch real fallando (Apps Script caído, timeout, lo que sea)
  // y una fecha genuinamente inexistente terminaban en la MISMA rama — el
  // catch(() => null) de abajo tapaba cualquier excepción real detrás del
  // mismo "no encontrado" silencioso. Ahora se distinguen: una excepción
  // real se ve (y con ?debug=1 se puede inspeccionar el mensaje tal cual),
  // "no encontrado" solo cuando getMatchData resolvió bien pero de verdad
  // no hay ese partido todavía.
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
