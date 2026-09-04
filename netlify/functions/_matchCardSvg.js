// Arma el SVG de la tarjeta de preview de un partido (Fecha a Fecha),
// paralelo al diseño de .fd-share-card (ver index.html, shareFechaCard) pero
// dibujado a mano en SVG para poder rasterizarlo server-side con resvg — así
// el texto sale siempre nítido (sin las limitaciones de html2canvas) y el
// escudo real del rival se puede embeber sin ningún riesgo de CORS (acá no
// hay <canvas> de navegador: es Node bajando la imagen por HTTP directo).
//
// Sin emoji: Inter (la única fuente que resvg tiene cargada, ver
// scripts/fetch-font.js) no trae glifos de emoji — cualquier ⚽/🎯 saldría
// como una casilla vacía. Se usan badges de color + texto en vez de íconos,
// mismo criterio que ya resolvió esto para el logo del club en
// scripts/og-card-tree.js.

function escapeXml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

const FONT = 'Inter';
const W = 1080;
const PAD_X = 64;

function textMiddle(cx, y, text, { size = 28, weight = 700, fill = '#ffffff', opacity = 1 } = {}) {
  return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" opacity="${opacity}">${escapeXml(text)}</text>`;
}

// Círculo de iniciales (fallback) o <image> real (si se pudo embeber como
// data URI) para el escudo de cada equipo en el marcador.
function crestSvg({ cx, cy, r, dataUri, initials, bg, border, color }) {
  if (dataUri) {
    return `<g>
      <clipPath id="clip-${cx}-${cy}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff"/>
      <image x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" href="${dataUri}" clip-path="url(#clip-${cx}-${cy})" preserveAspectRatio="xMidYMid meet"/>
    </g>`;
  }
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}" stroke="${border}" stroke-width="2"/>
    ${textMiddle(cx, cy + r * 0.34, initials, { size: r * 0.85, weight: 900, fill: color })}
  </g>`;
}

// Marcas de cancha (vertical, se ataca hacia arriba) — mismas proporciones
// relativas que .ap-pitch-portrait en index.html, pasadas de % a píxeles.
function pitchMarkingsSvg(px, py, pw, ph) {
  const L = 'rgba(255,255,255,0.30)';
  const line = (x1, y1, x2, y2, w = 2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${L}" stroke-width="${w}"/>`;
  const rect = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${L}" stroke-width="2"/>`;
  const circle = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${L}" stroke-width="2"/>`;
  const pct = (v, total) => (v / 100) * total;
  return `
    ${line(px, py + ph / 2, px + pw, py + ph / 2)}
    ${circle(px + pw / 2, py + ph / 2, pct(14, pw))}
    <circle cx="${px + pw / 2}" cy="${py + ph / 2}" r="4" fill="rgba(255,255,255,0.5)"/>
    ${rect(px + pct(22, pw), py, pct(56, pw), pct(12, ph))}
    ${rect(px + pct(37, pw), py, pct(26, pw), pct(4, ph))}
    ${rect(px + pct(22, pw), py + ph - pct(12, ph), pct(56, pw), pct(12, ph))}
    ${rect(px + pct(37, pw), py + ph - pct(4, ph), pct(26, pw), pct(4, ph))}
  `;
}

// Un jugador en la cancha: círculo + iniciales + nombre + posición, mismos
// datos/criterio que buildPitch() en index.html (ver apBand/AP_BAND_Y/
// AP_BAND_OF, pasados como helpers para no duplicar el agrupamiento).
function playerMarkerSvg({ x, y, jug, plantelPosColor }) {
  const R = 37;
  const isCap = /\(c\)/i.test(jug.nombre || '');
  const parts = (jug.nombre || '').replace(/\s*\(c\)/i, '').trim().split(/\s+/);
  const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (parts[0] || '?').substring(0, 2).toUpperCase();
  const displayName = parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : (parts[0] || '');
  const goles = jug.goles || 0, asist = jug.asist || 0, rojas = jug.rojas || 0;
  const nameColor = goles > 0 ? '#fbbf24' : asist > 0 ? '#4ade80' : '#ffffff';

  let badges = '';
  // Badges de goles/asistencias/roja — sin emoji (ver nota arriba): un
  // círculo chico de color con el número, apilados en la esquina superior
  // derecha del dot.
  let bi = 0;
  const badge = (fill, label) => {
    const bx = x + R * 0.62 + bi * 26, by = y - R * 0.62;
    bi++;
    return `<circle cx="${bx}" cy="${by}" r="13" fill="${fill}"/>${textMiddle(bx, by + 5, label, { size: 14, weight: 900, fill: '#0B0E14' })}`;
  };
  if (goles > 0) badges += badge('#fbbf24', String(goles));
  if (asist > 0) badges += badge('#4ade80', String(asist));
  if (rojas > 0) badges += badge('#ef4444', 'R');

  const capBadge = isCap
    ? `<circle cx="${x - R * 0.72}" cy="${y - R * 0.72}" r="13" fill="#fbbf24"/>${textMiddle(x - R * 0.72, y - R * 0.72 + 5, 'C', { size: 14, weight: 900, fill: '#1a1206' })}`
    : '';

  const pc = plantelPosColor ? plantelPosColor(jug.pos) : '#94a3b8';
  const nameW = Math.max(70, displayName.length * 15 + 20);
  return `<g>
    <circle cx="${x}" cy="${y}" r="${R}" fill="#111827" stroke="#60a5fa" stroke-width="3"/>
    ${textMiddle(x, y + 9, initials, { size: 24, weight: 900, fill: '#ffffff' })}
    ${badges}
    ${capBadge}
    <rect x="${x - nameW / 2}" y="${y + R + 8}" width="${nameW}" height="34" rx="5" fill="rgba(0,0,0,0.82)"/>
    ${textMiddle(x, y + R + 31, displayName, { size: 20, weight: 700, fill: nameColor })}
    ${jug.pos ? `<rect x="${x - 26}" y="${y + R + 46}" width="52" height="22" rx="4" fill="rgba(0,0,0,0.55)"/>${textMiddle(x, y + R + 62, jug.pos, { size: 15, weight: 700, fill: 'rgba(255,255,255,0.7)' })}` : ''}
  </g>`;
}

function pitchSvg({ px, py, pw, ph, titulares, helpers }) {
  const { apBand, AP_BAND_Y, AP_BAND_OF, plantelPosColor } = helpers;
  const bands = [[], [], [], [], []];
  for (const jug of titulares) {
    const b = apBand(jug.pos);
    bands[b].push({ ...jug, _horder: AP_BAND_OF[(jug.pos || '').toUpperCase()] ?? 1 });
  }
  bands.forEach(b => b.sort((a, z) => a._horder - z._horder));
  let markers = '';
  for (let bi = 0; bi < 5; bi++) {
    const group = bands[bi];
    const n = group.length;
    if (!n) continue;
    const yFrac = AP_BAND_Y[bi];
    group.forEach((jug, i) => {
      const xFrac = n === 1 ? 50 : (100 * (2 * i + 1)) / (2 * n);
      const x = px + (xFrac / 100) * pw;
      const y = py + (yFrac / 100) * ph;
      markers += playerMarkerSvg({ x, y, jug, plantelPosColor });
    });
  }
  return `
    <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="10" fill="#166534"/>
    ${pitchMarkingsSvg(px, py, pw, ph)}
    ${markers}
  `;
}

// data: { clubLogoDataUri, torneoBadge, torneoColor, leftName, rightName,
//   leftCrest: {dataUri?, initials, bg, border, color}, rightCrest: {...},
//   scoreText, scoreColor, metaLine, formacion, titulares, banco, destacados:
//   {goles:[], asist:[], rojas:[]}, helpers }
function buildMatchCardSvg(data) {
  const {
    clubLogoDataUri, torneoBadge, leftName, rightName, leftCrest, rightCrest,
    scoreText, scoreColor, metaLine, formacion, titulares, banco, destacados, helpers,
  } = data;

  let y = 56;
  const header = `
    <image x="${PAD_X}" y="${y}" width="64" height="64" href="${clubLogoDataUri}"/>
    ${(() => { const t = `<text x="${PAD_X + 82}" y="${y + 34}" font-family="${FONT}" font-size="34" font-weight="900" fill="#ffffff">Club Santa Bárbara</text>
      <text x="${PAD_X + 82}" y="${y + 62}" font-family="${FONT}" font-size="20" font-weight="700" fill="#fbbf24">${escapeXml(torneoBadge)}</text>`; return t; })()}
  `;
  y += 64 + 56;

  const cy = y + 60;
  const scoreRow = `
    ${crestSvg({ cx: PAD_X + 60, cy, r: 60, ...leftCrest })}
    ${textMiddle(PAD_X + 60, cy + 100, leftName, { size: 26, weight: 800 })}
    ${textMiddle(W / 2, cy + 15, scoreText, { size: 56, weight: 900, fill: scoreColor })}
    ${crestSvg({ cx: W - PAD_X - 60, cy, r: 60, ...rightCrest })}
    ${textMiddle(W - PAD_X - 60, cy + 100, rightName, { size: 26, weight: 800 })}
  `;
  y = cy + 100 + 44;

  const metaRow = metaLine ? textMiddle(W / 2, y, metaLine, { size: 22, weight: 600, fill: '#8a94ab' }) : '';
  y += metaLine ? 40 : 0;

  const formLabel = textMiddle(W / 2, y, `FORMACIÓN · ${formacion}`, { size: 20, weight: 700, fill: '#8a94ab' });
  y += 36;

  const pw = 780, ph = Math.round(pw * 105 / 68), px = (W - pw) / 2;
  const pitch = pitchSvg({ px, py: y, pw, ph, titulares, helpers });
  y += ph + 40;

  let bancoBlock = '';
  if (banco && banco.length) {
    const rowH = 46, perRow = 2, rows = Math.ceil(banco.length / perRow);
    const blockH = 56 + rows * rowH;
    bancoBlock += `<rect x="${PAD_X}" y="${y}" width="${W - PAD_X * 2}" height="${blockH}" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)"/>`;
    bancoBlock += `<text x="${PAD_X + 24}" y="${y + 38}" font-family="${FONT}" font-size="22" font-weight="800" fill="#8a94ab">BANCO DE SUPLENTES</text>`;
    banco.forEach((j, i) => {
      const col = i % perRow, row = Math.floor(i / perRow);
      const bx = PAD_X + 24 + col * ((W - PAD_X * 2 - 48) / perRow);
      const by = y + 66 + row * rowH;
      bancoBlock += `<text x="${bx}" y="${by}" font-family="${FONT}" font-size="20" font-weight="700" fill="#ffffff">${escapeXml(j.pos || '')} ${escapeXml(j.nombre)}${j.entro ? ' ▲' : ''}</text>`;
    });
    y += blockH + 28;
  }

  let destBlock = '';
  const destGroups = [
    ['GOLES', '#fbbf24', destacados.goles],
    ['ASISTENCIAS', '#4ade80', destacados.asist],
    ['ROJAS', '#ef4444', destacados.rojas],
  ].filter(([, , list]) => list && list.length);
  if (destGroups.length) {
    const blockH = 56 + destGroups.length * 44;
    destBlock += `<rect x="${PAD_X}" y="${y}" width="${W - PAD_X * 2}" height="${blockH}" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)"/>`;
    destBlock += `<text x="${PAD_X + 24}" y="${y + 38}" font-family="${FONT}" font-size="24" font-weight="800" fill="#ffffff">DESTACADOS DEL PARTIDO</text>`;
    destGroups.forEach(([label, color, list], i) => {
      const ly = y + 74 + i * 44;
      destBlock += `<text x="${PAD_X + 24}" y="${ly}" font-family="${FONT}" font-size="19" font-weight="800" fill="${color}">${label}</text>`;
      destBlock += `<text x="${PAD_X + 240}" y="${ly}" font-family="${FONT}" font-size="19" font-weight="700" fill="#ffffff">${escapeXml(list.map(j => j.nombre + (j.count > 1 ? ` ×${j.count}` : '')).join('  ·  '))}</text>`;
    });
    y += blockH + 24;
  }

  y += 20;
  const footer = textMiddle(W / 2, y, 'CLUB SANTA BÁRBARA', { size: 20, weight: 800, fill: '#8a94ab' });
  y += 40;

  const H = y;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#0B0E14"/>
    ${header}
    ${scoreRow}
    ${metaRow}
    ${formLabel}
    ${pitch}
    ${bancoBlock}
    ${destBlock}
    ${footer}
  </svg>`;
}

module.exports = { buildMatchCardSvg };
