// Arma el SVG de la tarjeta de preview de un jugador a mano (1200×630,
// tamaño estándar Open Graph para que no se recorte en WhatsApp/Twitter/
// etc.), en paralelo al diseño visual de .pp-share-card (ver index.html).
//
// No usa satori: satori exige un archivo de fuente embebido explícito para
// dibujar cualquier texto (no hay forma de pedirle que use "la fuente que
// haya en la máquina"). Acá en cambio se arma el SVG directo con
// font-family "Inter" (la misma que usa el resto del sitio, ver
// --font-family en el <style> de index.html) seguida de la misma cadena de
// fallback (Segoe UI, system-ui, sans-serif) — es resvg (@resvg/resvg-js)
// quien la resuelve contra las fuentes instaladas en la máquina de build.
// Si esa máquina no tiene Inter instalada (lo más probable en un runner de
// CI genérico), resvg cae al siguiente nombre de la lista sin romper nada,
// pero el resultado no sería pixel-perfect contra el sitio — no hay forma
// de garantizar eso sin comitear el archivo de fuente real.

function hexAlpha(hex, alpha) {
  const h = String(hex || '#ffffff').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function escapeXml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

const FONT = "Inter, 'Segoe UI', system-ui, sans-serif";

// Parte un nombre largo en hasta 2 líneas, cortando en el espacio más
// cercano a la mitad en vez de a la mitad del string a lo bruto (para no
// cortar una palabra al medio).
function splitName(nombre, maxLine = 14) {
  const s = String(nombre || '');
  if (s.length <= maxLine) return [s];
  const words = s.split(' ');
  let line1 = '', line2 = '';
  for (const w of words) {
    if ((line1 + ' ' + w).trim().length <= maxLine || !line1) line1 = (line1 + ' ' + w).trim();
    else line2 = (line2 + ' ' + w).trim();
  }
  return line2 ? [line1, line2] : [line1];
}

function buildShareCardSvg({ nombre, pos, posColor, goles, asist, pj, gmas, titulos, promGol, pg, pe, pp, hasA, hasB, logros }) {
  const W = 1200, H = 630;
  const PAD_X = 32, PAD_TOP = 26, PAD_BOTTOM = 26;
  const initials = String(nombre || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const logrosList = (logros || []).slice(0, 4);
  const hasAsistLogro = logrosList.some(l => l.key === 'asist');
  const parts = [];

  // ── Header (ancho completo) ─────────────────────────────────────────
  parts.push(`<text x="${PAD_X}" y="${PAD_TOP + 24}" font-family="${FONT}" font-size="20" font-weight="700" fill="#ffffff">🛡️ Club Santa Bárbara</text>`);
  const badgeW = 168, badgeH = 34;
  parts.push(`<rect x="${W - PAD_X - badgeW}" y="${PAD_TOP}" width="${badgeW}" height="${badgeH}" rx="17" fill="#412402" />`);
  parts.push(`<text x="${W - PAD_X - badgeW / 2}" y="${PAD_TOP + 22}" font-family="${FONT}" font-size="15" font-weight="700" fill="#fac775" text-anchor="middle">Temporada 2026</text>`);

  const bodyTop = PAD_TOP + badgeH + 24;
  const bodyBottom = H - PAD_BOTTOM;
  const bodyHeight = bodyBottom - bodyTop;

  const leftX = PAD_X, leftW = 220;
  const rightX = leftX + leftW + 40, rightW = W - PAD_X - rightX;

  // ── Columna izquierda: altura total primero, para centrar vertical ──
  const nameLines = splitName(nombre);
  const AVATAR_D = 72;
  const nameBlockH = nameLines.length * 26;
  const badgesRowH = 26;
  const logrosBlockH = logrosList.length ? logrosList.length * 36 - 6 : 0;
  const vedRowH = 48;
  const gapAfterAvatar = 12, gapAfterName = 10, gapAfterBadges = 16, gapAfterLogros = 16;

  let leftTotalH = AVATAR_D + gapAfterAvatar + nameBlockH + gapAfterName + badgesRowH + gapAfterBadges;
  if (logrosList.length) leftTotalH += logrosBlockH + gapAfterLogros;
  leftTotalH += vedRowH;

  let ly = bodyTop + Math.max(0, (bodyHeight - leftTotalH) / 2);
  const leftCx = leftX + leftW / 2;

  // Avatar con iniciales
  const avatarCy = ly + AVATAR_D / 2;
  parts.push(`<circle cx="${leftCx}" cy="${avatarCy}" r="${AVATAR_D / 2}" fill="#412402" />`);
  parts.push(`<text x="${leftCx}" y="${avatarCy + 10}" font-family="${FONT}" font-size="28" font-weight="900" fill="#fac775" text-anchor="middle">${escapeXml(initials)}</text>`);
  ly += AVATAR_D + gapAfterAvatar;

  // Nombre (1-2 líneas)
  nameLines.forEach((line, i) => {
    parts.push(`<text x="${leftCx}" y="${ly + 20 + i * 26}" font-family="${FONT}" font-size="22" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(line)}</text>`);
  });
  ly += nameBlockH + gapAfterName;

  // Badges de posición y plantel
  const posLabel = pos || '—';
  const posW = Math.max(46, 20 + posLabel.length * 9);
  const teamLabels = [hasA ? '1ra A' : null, hasB ? '1ra B' : null].filter(Boolean);
  const teamW = 54;
  const badgesTotalW = posW + (teamLabels.length ? teamLabels.length * (teamW + 8) : 0);
  let bx = leftCx - badgesTotalW / 2;
  parts.push(`<rect x="${bx}" y="${ly}" width="${posW}" height="${badgesRowH}" rx="8" fill="${hexAlpha(posColor, 0.18)}" />`);
  parts.push(`<text x="${bx + posW / 2}" y="${ly + 17}" font-family="${FONT}" font-size="13" font-weight="700" fill="${posColor}" text-anchor="middle">${escapeXml(posLabel)}</text>`);
  bx += posW + 8;
  teamLabels.forEach(label => {
    parts.push(`<rect x="${bx}" y="${ly}" width="${teamW}" height="${badgesRowH}" rx="8" fill="rgba(255,255,255,0.08)" />`);
    parts.push(`<text x="${bx + teamW / 2}" y="${ly + 17}" font-family="${FONT}" font-size="13" font-weight="700" fill="#cbd5e1" text-anchor="middle">${label}</text>`);
    bx += teamW + 8;
  });
  ly += badgesRowH + gapAfterBadges;

  // Logros destacados (hasta 4), apilados
  if (logrosList.length) {
    logrosList.forEach(l => {
      parts.push(`<rect x="${leftX}" y="${ly}" width="${leftW}" height="30" rx="8" fill="${hexAlpha(l.color, 0.15)}" />`);
      parts.push(`<text x="${leftX + 10}" y="${ly + 20}" font-family="${FONT}" font-size="12" font-weight="700" fill="${l.color}">${l.pos}° ${escapeXml(l.text)}</text>`);
      ly += 36;
    });
    ly += gapAfterLogros - 6;
  }

  // Récord de resultados: PG / PE / PP
  const vedGap = 8, vedW = (leftW - vedGap * 2) / 3;
  const vedItems = [
    { val: pg, label: 'PG', color: '#97c459', bg: hexAlpha('#97c459', 0.1) },
    { val: pe, label: 'PE', color: '#fac775', bg: hexAlpha('#fac775', 0.1) },
    { val: pp, label: 'PP', color: '#f09595', bg: hexAlpha('#f09595', 0.1) },
  ];
  vedItems.forEach((it, i) => {
    const vx = leftX + i * (vedW + vedGap);
    parts.push(`<rect x="${vx}" y="${ly}" width="${vedW}" height="${vedRowH}" rx="10" fill="${it.bg}" />`);
    parts.push(`<text x="${vx + vedW / 2}" y="${ly + 22}" font-family="${FONT}" font-size="17" font-weight="800" fill="${it.color}" text-anchor="middle">${escapeXml(String(it.val))}</text>`);
    parts.push(`<text x="${vx + vedW / 2}" y="${ly + 38}" font-family="${FONT}" font-size="11" font-weight="700" fill="${it.color}" text-anchor="middle">${it.label}</text>`);
  });

  // ── Columna derecha: grid 3x2, centrado vertical ────────────────────
  const cardGap = 16, cardW = (rightW - cardGap * 2) / 3, cardH = 130;
  const rowGap = 24, secRowH = 50;
  const rightTotalH = cardH + rowGap + secRowH;
  let ry = bodyTop + Math.max(0, (bodyHeight - rightTotalH) / 2);

  const mainStats = [
    { val: goles, label: 'Goles', color: '#ef9f27' },
    { val: asist, label: 'Asistencias', color: hasAsistLogro ? '#97c459' : '#ffffff' },
    { val: pj, label: 'PJ', color: '#ffffff' },
  ];
  mainStats.forEach((st, i) => {
    const cx = rightX + i * (cardW + cardGap);
    parts.push(`<rect x="${cx}" y="${ry}" width="${cardW}" height="${cardH}" rx="16" fill="#141d2e" />`);
    parts.push(`<text x="${cx + cardW / 2}" y="${ry + cardH / 2 + 4}" font-family="${FONT}" font-size="34" font-weight="900" fill="${st.color}" text-anchor="middle">${escapeXml(String(st.val))}</text>`);
    parts.push(`<text x="${cx + cardW / 2}" y="${ry + cardH / 2 + 30}" font-family="${FONT}" font-size="13" font-weight="600" fill="#8a94ab" text-anchor="middle">${escapeXml(st.label)}</text>`);
  });
  ry += cardH + rowGap;

  const secStats = [
    { val: gmas, label: 'G+A' },
    { val: titulos, label: 'Títulos' },
    { val: String(promGol.toFixed(2)).replace('.', ','), label: 'Prom. Goles' },
  ];
  const secColW = rightW / 3;
  secStats.forEach((st, i) => {
    const cx = rightX + i * secColW + secColW / 2;
    parts.push(`<text x="${cx}" y="${ry + 20}" font-family="${FONT}" font-size="17" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(String(st.val))}</text>`);
    parts.push(`<text x="${cx}" y="${ry + 38}" font-family="${FONT}" font-size="11" font-weight="600" fill="#8a94ab" text-anchor="middle">${escapeXml(st.label)}</text>`);
  });

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d1a12" />
      <stop offset="60%" stop-color="#0b1220" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)" />
${parts.map(p => '  ' + p).join('\n')}
</svg>`;
}

module.exports = { buildShareCardSvg, hexAlpha, escapeXml };
