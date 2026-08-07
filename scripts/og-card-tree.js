// Arma el SVG de la tarjeta de preview de un jugador a mano, en paralelo al
// diseño visual de .pp-share-card (ver index.html). No usa satori: satori
// exige un archivo de fuente embebido explícito para dibujar cualquier
// texto (no hay forma de pedirle que use "la fuente que haya en la
// máquina"), y eso significaba tener que conseguir y comitear un .ttf de
// Inter. Acá en cambio se arma el SVG directo con font-family genérica
// ("Arial, Helvetica, sans-serif") y es resvg (@resvg/resvg-js) quien la
// resuelve contra las fuentes instaladas en la máquina de build — sin
// depender de ningún archivo propio.
//
// Por la misma razón se evitan emojis en el texto: si la máquina de build
// no tiene una fuente de emoji instalada, se dibujan como un cuadrado
// vacío ("tofu"). El escudo/iconos quedan como formas simples en vez de
// caracteres emoji.

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

const FONT = 'Arial, Helvetica, sans-serif';

function buildShareCardSvg({ nombre, pos, posColor, goles, asist, pj, gmas, titulos, promGol, hasA, hasB, logros }) {
  const W = 600, H = 800, PAD = 32;
  const initials = String(nombre || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const colorFor = (key) => {
    const l = (logros || []).find(x => x.key === key);
    return l ? l.color : '#ffffff';
  };
  const logrosList = (logros || []).slice(0, 4);
  const parts = [];
  let y = PAD;

  // Header: nombre del club + badge de temporada.
  parts.push(`<text x="${PAD}" y="${y + 20}" font-family="${FONT}" font-size="18" font-weight="700" fill="#ffffff">Club Santa Bárbara</text>`);
  const badgeW = 150;
  parts.push(`<rect x="${W - PAD - badgeW}" y="${y}" width="${badgeW}" height="30" rx="15" fill="#412402" />`);
  parts.push(`<text x="${W - PAD - badgeW / 2}" y="${y + 20}" font-family="${FONT}" font-size="14" font-weight="700" fill="#fac775" text-anchor="middle">Temporada 2026</text>`);
  y += 30 + 34;

  // Identidad: avatar con iniciales + nombre + badges de posición/plantel.
  const avatarR = 36, avatarCx = PAD + avatarR, avatarCy = y + avatarR;
  parts.push(`<circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR}" fill="#412402" />`);
  parts.push(`<text x="${avatarCx}" y="${avatarCy + 9}" font-family="${FONT}" font-size="26" font-weight="900" fill="#fac775" text-anchor="middle">${escapeXml(initials)}</text>`);
  const nameX = PAD + avatarR * 2 + 16;
  parts.push(`<text x="${nameX}" y="${y + 28}" font-family="${FONT}" font-size="24" font-weight="800" fill="#ffffff">${escapeXml(nombre)}</text>`);
  let bx = nameX;
  const posLabel = pos || '—';
  const posW = Math.max(40, 20 + posLabel.length * 9);
  parts.push(`<rect x="${bx}" y="${y + 42}" width="${posW}" height="26" rx="8" fill="${hexAlpha(posColor, 0.18)}" />`);
  parts.push(`<text x="${bx + posW / 2}" y="${y + 59}" font-family="${FONT}" font-size="13" font-weight="700" fill="${posColor}" text-anchor="middle">${escapeXml(posLabel)}</text>`);
  bx += posW + 8;
  if (hasA) {
    const w = 54;
    parts.push(`<rect x="${bx}" y="${y + 42}" width="${w}" height="26" rx="8" fill="rgba(255,255,255,0.08)" />`);
    parts.push(`<text x="${bx + w / 2}" y="${y + 59}" font-family="${FONT}" font-size="13" font-weight="700" fill="#cbd5e1" text-anchor="middle">1ra A</text>`);
    bx += w + 8;
  }
  if (hasB) {
    const w = 54;
    parts.push(`<rect x="${bx}" y="${y + 42}" width="${w}" height="26" rx="8" fill="rgba(255,255,255,0.08)" />`);
    parts.push(`<text x="${bx + w / 2}" y="${y + 59}" font-family="${FONT}" font-size="13" font-weight="700" fill="#cbd5e1" text-anchor="middle">1ra B</text>`);
    bx += w + 8;
  }
  y += avatarR * 2 + 20;

  // Logros destacados (hasta 4, ya vienen ordenados/limitados desde
  // _ppComputeTopLogros).
  for (const l of logrosList) {
    const rowH = 38;
    parts.push(`<rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="${rowH}" rx="10" fill="${hexAlpha(l.color, 0.15)}" />`);
    parts.push(`<text x="${PAD + 14}" y="${y + 25}" font-family="${FONT}" font-size="15" font-weight="700" fill="${l.color}">${l.pos}° ${escapeXml(l.text)}</text>`);
    y += rowH + 6;
  }
  y += 10;

  // Stats principales (3 cards).
  const cardGap = 12, cardW = (W - PAD * 2 - cardGap * 2) / 3, cardH = 90;
  [[goles, 'Goles', 'goles'], [asist, 'Asistencias', 'asist'], [pj, 'PJ', 'pj']].forEach(([val, label, key], i) => {
    const cx = PAD + i * (cardW + cardGap);
    parts.push(`<rect x="${cx}" y="${y}" width="${cardW}" height="${cardH}" rx="12" fill="rgba(255,255,255,0.04)" />`);
    parts.push(`<text x="${cx + cardW / 2}" y="${y + 46}" font-family="${FONT}" font-size="32" font-weight="900" fill="${colorFor(key)}" text-anchor="middle">${escapeXml(String(val))}</text>`);
    parts.push(`<text x="${cx + cardW / 2}" y="${y + 68}" font-family="${FONT}" font-size="12" font-weight="600" fill="#8a94ab" text-anchor="middle">${escapeXml(label)}</text>`);
  });
  y += cardH + 20;

  // Stats secundarias (texto, sin card).
  const secW = (W - PAD * 2) / 3;
  [[gmas, 'G+A'], [titulos, 'Títulos'], [String(promGol.toFixed(2)).replace('.', ','), 'Prom. Goles']].forEach(([val, label], i) => {
    const cx = PAD + i * secW + secW / 2;
    parts.push(`<text x="${cx}" y="${y + 18}" font-family="${FONT}" font-size="18" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(String(val))}</text>`);
    parts.push(`<text x="${cx}" y="${y + 34}" font-family="${FONT}" font-size="11" font-weight="600" fill="#8a94ab" text-anchor="middle">${escapeXml(label)}</text>`);
  });

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="70%" y2="100%">
      <stop offset="0%" stop-color="#0d1a12" />
      <stop offset="65%" stop-color="#0b1220" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="url(#bg)" />
${parts.map(p => '  ' + p).join('\n')}
</svg>`;
}

module.exports = { buildShareCardSvg, hexAlpha, escapeXml };
