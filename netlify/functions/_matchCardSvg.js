// Arma el SVG de la tarjeta de preview de un partido (Fecha a Fecha),
// paralelo al diseño de .fd-share-card (ver index.html, shareFechaCard) pero
// dibujado a mano en SVG para poder rasterizarlo server-side con resvg — así
// el texto sale siempre nítido (sin las limitaciones de html2canvas) y el
// escudo real del rival se puede embeber sin ningún riesgo de CORS (acá no
// hay <canvas> de navegador: es Node bajando la imagen por HTTP directo).
//
// Rediseño pedido a partir de una referencia HTML+Tailwind (Dark Slate +
// Verde Esmeralda + acentos Dorado/Celeste, mismo lenguaje visual que ya se
// usa en scripts/og-card-tree.js para la ficha de jugador) — paleta, helpers
// de texto (hexAlpha/escapeXml/estimateTextWidth) y la lógica de color por
// línea de posición (posGroupColor) se REUSAN de ahí en vez de duplicarse.
//
// Sin emoji: Inter (la única fuente que resvg tiene cargada, ver
// scripts/fetch-font.js) no trae glifos de emoji — cualquier ⚽/🎯/👑 saldría
// como una casilla vacía. Se usan badges de color + texto/vectores en vez de
// íconos de fuente.
const { hexAlpha, escapeXml, COLORS, FONT, posGroupColor, estimateTextWidth } = require('../../scripts/og-card-tree');

const W = 1080;
const PAD_X = 64;
const contentW = W - PAD_X * 2;
const cx = W / 2;

function panelRect({ x, y, w, h, rx = 28, fill, fillOpacity, stroke, strokeWidth = 1.5 }) {
  const fo = fillOpacity != null ? ` fill-opacity="${fillOpacity}"` : '';
  const st = stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}"` : '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${fo}${st}/>`;
}

function textAt(x, y, text, { size = 24, weight = 700, fill = COLORS.white, anchor = 'start', letterSpacing } = {}) {
  const ls = letterSpacing != null ? ` letter-spacing="${letterSpacing}"` : '';
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls}>${escapeXml(text)}</text>`;
}

// Ícono de ubicación (pin) — path vectorial puro, no depende de ningún
// glifo de fuente (a diferencia de un emoji de mapa).
function locationIconSvg(x, y, size, color) {
  const s = size / 24;
  return `<g transform="translate(${x - size / 2},${y - size / 2}) scale(${s})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
  </g>`;
}

// Ícono "banco de suplentes" (flechas de cambio) — mismo criterio, path
// vectorial en vez de un emoji de recambio (🔄).
function swapIconSvg(x, y, size, color) {
  const s = size / 24;
  return `<g transform="translate(${x - size / 2},${y - size / 2}) scale(${s})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
  </g>`;
}

// Círculo de iniciales (fallback) o <image> real (si se pudo embeber como
// data URI) para el escudo de cada equipo en el marcador.
function crestSvg({ cx: ccx, cy, r, dataUri, initials, bg, border, color }) {
  if (dataUri) {
    const clipId = `clip-${Math.round(ccx)}-${Math.round(cy)}`;
    return `<g>
      <defs><clipPath id="${clipId}"><circle cx="${ccx}" cy="${cy}" r="${r - 4}"/></clipPath></defs>
      <circle cx="${ccx}" cy="${cy}" r="${r}" fill="${COLORS.slate950}" stroke="${border}" stroke-width="3"/>
      <circle cx="${ccx}" cy="${cy}" r="${r - 4}" fill="#ffffff"/>
      <image x="${ccx - r + 4}" y="${cy - r + 4}" width="${(r - 4) * 2}" height="${(r - 4) * 2}" href="${dataUri}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid meet"/>
    </g>`;
  }
  return `<g>
    <circle cx="${ccx}" cy="${cy}" r="${r}" fill="${bg}" stroke="${border}" stroke-width="3"/>
    ${textAt(ccx, cy + r * 0.34, initials, { size: r * 0.85, weight: 900, fill: color, anchor: 'middle' })}
  </g>`;
}

// Marcas de cancha (vertical, se ataca hacia arriba) — trazo fino esmeralda
// translúcido sobre el panel-gradiente de fondo (ya NO hay un rect verde
// "césped" sólido detrás, ver buildMatchCardSvg: el panel en sí ya es
// oscuro/degradado, esto es solo la traza táctica encima).
function pitchMarkingsSvg(px, py, pw, ph) {
  const L = hexAlpha(COLORS.emerald500, 0.35);
  const line = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${L}" stroke-width="2"/>`;
  const rect = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${L}" stroke-width="2"/>`;
  const circle = (ccx, ccy, r) => `<circle cx="${ccx}" cy="${ccy}" r="${r}" fill="none" stroke="${L}" stroke-width="2"/>`;
  const pct = (v, total) => (v / 100) * total;
  return `
    ${rect(px, py, pw, ph)}
    ${line(px, py + ph / 2, px + pw, py + ph / 2)}
    ${circle(px + pw / 2, py + ph / 2, pct(14, pw))}
    <circle cx="${px + pw / 2}" cy="${py + ph / 2}" r="4" fill="${L}"/>
    ${rect(px + pct(22, pw), py, pct(56, pw), pct(12, ph))}
    ${rect(px + pct(37, pw), py, pct(26, pw), pct(4, ph))}
    ${rect(px + pct(22, pw), py + ph - pct(12, ph), pct(56, pw), pct(12, ph))}
    ${rect(px + pct(37, pw), py + ph - pct(4, ph), pct(26, pw), pct(4, ph))}
  `;
}

// Un jugador en la cancha: círculo + iniciales + nombre + posición.
// El color del anillo/insignia sigue el evento más relevante del jugador en
// ESE partido (rojo > gol > asistencia > sin evento) — más consistente que
// pintar solo a los goleadores, y usa la misma paleta esmeralda/celeste/rosa
// que el resto del rediseño en vez de un celeste genérico fijo.
function playerMarkerSvg({ x, y, jug }) {
  const R = 37;
  const isCap = /\(c\)/i.test(jug.nombre || '');
  const parts = (jug.nombre || '').replace(/\s*\(c\)/i, '').trim().split(/\s+/);
  const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (parts[0] || '?').substring(0, 2).toUpperCase();
  const displayName = parts.length > 1 ? `${parts[0][0]}. ${parts[parts.length - 1]}` : (parts[0] || '');
  const goles = jug.goles || 0, asist = jug.asist || 0, rojas = jug.rojas || 0;

  const tier = rojas > 0 ? 'rojas' : goles > 0 ? 'goles' : asist > 0 ? 'asist' : null;
  const tierColor = { rojas: COLORS.rose400, goles: COLORS.emerald400, asist: COLORS.sky400 }[tier] || COLORS.slate700;
  const ringWidth = tier ? 4 : 2;
  const nameColor = tier ? tierColor : COLORS.slate300;
  const nameBorder = tier ? hexAlpha(tierColor, 0.4) : COLORS.slate800;

  let badges = '';
  let bi = 0;
  const numBadge = (fill, label) => {
    const bx = x + R * 0.62 + bi * 27, by = y - R * 0.62;
    bi++;
    return `<circle cx="${bx}" cy="${by}" r="14" fill="${fill}" stroke="${COLORS.slate950}" stroke-width="2.5"/>${textAt(bx, by + 5, label, { size: 15, weight: 900, fill: COLORS.slate950, anchor: 'middle' })}`;
  };
  if (goles > 0) badges += numBadge(COLORS.emerald500, goles > 1 ? `G${goles}` : 'G');
  if (asist > 0) badges += numBadge(COLORS.sky400, asist > 1 ? `A${asist}` : 'A');
  if (rojas > 0) {
    const bx = x + R * 0.62 + bi * 27, by = y - R * 0.62;
    badges += `<rect x="${bx - 7}" y="${by - 9}" width="14" height="18" rx="3" fill="${COLORS.rose500}" stroke="${COLORS.slate950}" stroke-width="2.5"/>`;
  }
  const capBadge = isCap
    ? `<circle cx="${x - R * 0.72}" cy="${y - R * 0.72}" r="14" fill="${COLORS.amber400}" stroke="${COLORS.slate950}" stroke-width="2.5"/>${textAt(x - R * 0.72, y - R * 0.72 + 5, 'C', { size: 15, weight: 900, fill: COLORS.slate950, anchor: 'middle' })}`
    : '';

  const nameW = Math.max(76, estimateTextWidth(displayName, 20) + 28);
  return `<g>
    <circle cx="${x}" cy="${y}" r="${R}" fill="${COLORS.slate950}" stroke="${tierColor}" stroke-width="${ringWidth}"/>
    ${textAt(x, y + 9, initials, { size: 24, weight: 900, fill: COLORS.white, anchor: 'middle' })}
    ${badges}
    ${capBadge}
    ${panelRect({ x: x - nameW / 2, y: y + R + 8, w: nameW, h: 36, rx: 8, fill: COLORS.slate950, stroke: nameBorder })}
    ${textAt(x, y + R + 32, displayName, { size: 20, weight: tier ? 900 : 700, fill: nameColor, anchor: 'middle' })}
    ${jug.pos ? `${panelRect({ x: x - 28, y: y + R + 48, w: 56, h: 24, rx: 6, fill: hexAlpha(COLORS.slate800, 0.7) })}${textAt(x, y + R + 65, jug.pos, { size: 15, weight: 700, fill: COLORS.slate400, anchor: 'middle' })}` : ''}
  </g>`;
}

function pitchSvg({ px, py, pw, ph, titulares, helpers }) {
  const { apBand, AP_BAND_Y, AP_BAND_OF } = helpers;
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
      markers += playerMarkerSvg({ x, y, jug });
    });
  }
  return `${pitchMarkingsSvg(px, py, pw, ph)}${markers}`;
}

const POS_GROUP_LABEL = { arq: 'ARQ', def: 'DEF', med: 'MED', del: 'DEL' };
function posGroupLabel(pos) {
  // posGroupColor no expone el nombre del grupo, solo el color — se
  // recalcula acá con el mismo criterio (ver POS_GROUP en og-card-tree.js)
  // para el badge de posición del banco de suplentes.
  const p = String(pos || '').toUpperCase();
  if (p === 'ARQ') return 'ARQ';
  if (['DFC', 'DFI', 'DFD', 'LI', 'LD', 'DEF'].includes(p)) return 'DEF';
  if (['MC', 'MCO', 'MCE', 'MI', 'MD'].includes(p)) return 'MED';
  if (['DC', 'ED', 'EI', 'DEL', 'AT'].includes(p)) return 'DEL';
  return p || '—';
}

// data: { clubLogoDataUri, torneoBadge, leftName, rightName,
//   leftCrest: {dataUri?, initials, bg, border, color}, rightCrest: {...},
//   scoreText, scoreColor, played, fechaLabel, diaLabel, lugar, formacion,
//   titulares, banco, destacados: {goles:[], asist:[], rojas:[]}, helpers }
function buildMatchCardSvg(data) {
  const {
    torneoBadge, leftName, rightName, leftCrest, rightCrest,
    scoreText, scoreColor, played, fechaLabel, diaLabel, lugar,
    formacion, titulares, banco, destacados, helpers,
  } = data;

  const parts = [];
  let y = 48;

  // ── 1. Header / marcador ────────────────────────────────────────────
  const HEADER_PAD = 32;
  const topRowH = 30, gap1 = 20, crestRowH = 200, gap2 = 24, locRowH = 64;
  const headerInnerH = topRowH + gap1 + crestRowH + gap2 + locRowH;
  const headerH = HEADER_PAD * 2 + headerInnerH;
  parts.push(panelRect({ x: PAD_X, y, w: contentW, h: headerH, rx: 28, fill: COLORS.slate900, fillOpacity: 0.7, stroke: COLORS.slate800 }));

  let iy = y + HEADER_PAD;
  parts.push(textAt(PAD_X + HEADER_PAD, iy + 20, torneoBadge || '', { size: 21, weight: 900, fill: COLORS.emerald400 }));
  const fechaText = [fechaLabel, diaLabel].filter(Boolean).join('  •  ');
  parts.push(textAt(W - PAD_X - HEADER_PAD, iy + 20, fechaText, { size: 18, weight: 800, fill: COLORS.slate400, anchor: 'end' }));
  parts.push(`<line x1="${PAD_X + HEADER_PAD}" y1="${iy + topRowH + 6}" x2="${W - PAD_X - HEADER_PAD}" y2="${iy + topRowH + 6}" stroke="${COLORS.slate800}" stroke-width="1.5"/>`);
  iy += topRowH + gap1 + 14;

  const isLeftCsb = leftName === 'Santa Bárbara';
  const isRightCsb = rightName === 'Santa Bárbara';
  const crestCy = iy + 70;
  const crestR = 64;
  // Escudo/anillo/nombre: el club (Santa Bárbara) siempre lleva el
  // tratamiento esmeralda destacado, sea local o visitante en ESTE
  // partido en particular — la etiqueta LOCAL/VISITANTE sí refleja la
  // condición real del partido.
  parts.push(crestSvg({ cx: PAD_X + HEADER_PAD + crestR, cy: crestCy, r: crestR, ...leftCrest, border: isLeftCsb ? hexAlpha(COLORS.emerald500, 0.6) : COLORS.slate700 }));
  parts.push(textAt(PAD_X + HEADER_PAD + crestR, crestCy + crestR + 32, leftName, { size: 24, weight: isLeftCsb ? 900 : 800, fill: isLeftCsb ? COLORS.white : COLORS.slate200, anchor: 'middle' }));
  parts.push(textAt(PAD_X + HEADER_PAD + crestR, crestCy + crestR + 54, 'LOCAL', { size: 14, weight: 800, fill: isLeftCsb ? COLORS.emerald400 : COLORS.slate500, anchor: 'middle', letterSpacing: 1 }));

  parts.push(crestSvg({ cx: W - PAD_X - HEADER_PAD - crestR, cy: crestCy, r: crestR, ...rightCrest, border: isRightCsb ? hexAlpha(COLORS.emerald500, 0.6) : COLORS.slate700 }));
  parts.push(textAt(W - PAD_X - HEADER_PAD - crestR, crestCy + crestR + 32, rightName, { size: 24, weight: isRightCsb ? 900 : 800, fill: isRightCsb ? COLORS.white : COLORS.slate200, anchor: 'middle' }));
  parts.push(textAt(W - PAD_X - HEADER_PAD - crestR, crestCy + crestR + 54, 'VISITANTE', { size: 14, weight: 800, fill: isRightCsb ? COLORS.emerald400 : COLORS.slate500, anchor: 'middle', letterSpacing: 1 }));

  // Marcador central: resultado si ya se jugó, hora/"VS" si es pendiente.
  const scoreW = Math.max(160, estimateTextWidth(scoreText, 44) + 56), scoreH = 92;
  parts.push(panelRect({ x: cx - scoreW / 2, y: crestCy - scoreH / 2, w: scoreW, h: scoreH, rx: 18, fill: COLORS.slate950, stroke: hexAlpha(COLORS.emerald500, 0.5) }));
  parts.push(textAt(cx, crestCy + 14, scoreText, { size: played === false ? 26 : 44, weight: 900, fill: scoreColor, anchor: 'middle', letterSpacing: played === false ? 1 : 0 }));
  iy = crestCy + crestR + 54 + gap2;

  // Ubicación + formación, en su propio panel anidado.
  parts.push(panelRect({ x: PAD_X + HEADER_PAD, y: iy, w: contentW - HEADER_PAD * 2, h: locRowH, rx: 16, fill: COLORS.slate950, stroke: COLORS.slate800 }));
  const locCy = iy + locRowH / 2;
  parts.push(locationIconSvg(PAD_X + HEADER_PAD + 26, locCy, 22, COLORS.emerald400));
  parts.push(textAt(PAD_X + HEADER_PAD + 46, locCy + 7, 'Cancha:', { size: 20, weight: 700, fill: COLORS.slate300 }));
  parts.push(textAt(PAD_X + HEADER_PAD + 46 + estimateTextWidth('Cancha: ', 20), locCy + 7, lugar || '—', { size: 20, weight: 900, fill: COLORS.white }));
  const formLabel = `${formacion}`;
  const formPillW = Math.max(90, estimateTextWidth(formLabel, 20) + 32), formPillH = 40;
  parts.push(panelRect({ x: W - PAD_X - HEADER_PAD - formPillW, y: locCy - formPillH / 2, w: formPillW, h: formPillH, rx: 10, fill: hexAlpha(COLORS.emerald500, 0.1), stroke: hexAlpha(COLORS.emerald500, 0.3) }));
  parts.push(textAt(W - PAD_X - HEADER_PAD - formPillW / 2, locCy + 7, formLabel, { size: 20, weight: 900, fill: COLORS.emerald400, anchor: 'middle' }));

  y += headerH + 32;

  // ── 2. Cancha táctica ────────────────────────────────────────────────
  const pw = contentW, ph = Math.round(pw * 340 / 400);
  const pitchPad = 24;
  const pitchOuterH = ph + pitchPad * 2;
  parts.push(`<defs><linearGradient id="pitchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="${hexAlpha(COLORS.emerald500, 0.16)}"/>
    <stop offset="100%" stop-color="${COLORS.slate900}"/>
  </linearGradient></defs>`);
  parts.push(panelRect({ x: PAD_X, y, w: contentW, h: pitchOuterH, rx: 28, fill: 'url(#pitchGrad)', stroke: hexAlpha(COLORS.emerald500, 0.3) }));
  parts.push(pitchSvg({ px: PAD_X + pitchPad, py: y + pitchPad, pw, ph, titulares, helpers }));
  y += pitchOuterH + 32;

  // ── 3. Sección inferior dinámica: Destacados o Banco de Suplentes ───
  // Prioridad: si hay CUALQUIER evento cargado (gol/asistencia/roja) se
  // muestran los Destacados del Match — sea que el partido ya terminó o
  // que se hayan cargado goles en vivo. Si no hay ningún evento (partido
  // pendiente sin novedades, o terminado 0-0 sin tarjetas) se muestra el
  // Banco de Suplentes en su lugar, que sí tiene algo que mostrar.
  const destGroups = [
    ['GOLES', COLORS.emerald400, destacados.goles],
    ['ASISTENCIAS', COLORS.sky400, destacados.asist],
    ['EXPULSADOS', COLORS.rose400, destacados.rojas],
  ].filter(([, , list]) => list && list.length);

  if (destGroups.length) {
    const PAD = 28, headerH2 = 44, headerGap = 18, cellH = 150;
    const innerH = headerH2 + headerGap + cellH;
    const blockH = PAD * 2 + innerH;
    parts.push(panelRect({ x: PAD_X, y, w: contentW, h: blockH, rx: 28, fill: COLORS.slate900, fillOpacity: 0.7, stroke: COLORS.slate800 }));
    parts.push(textAt(PAD_X + PAD, y + PAD + 18, 'DESTACADOS DEL MATCH', { size: 19, weight: 900, fill: COLORS.slate300, letterSpacing: 1 }));
    parts.push(`<line x1="${PAD_X + PAD}" y1="${y + PAD + headerH2 - 8}" x2="${W - PAD_X - PAD}" y2="${y + PAD + headerH2 - 8}" stroke="${hexAlpha(COLORS.slate800, 0.8)}" stroke-width="1.5"/>`);

    const gridTop = y + PAD + headerH2 + headerGap;
    const colGap = 16, colW = (contentW - PAD * 2 - colGap * 2) / 3;
    destGroups.forEach(([label, color, list], i) => {
      const bx = PAD_X + PAD + i * (colW + colGap);
      parts.push(panelRect({ x: bx, y: gridTop, w: colW, h: cellH, rx: 16, fill: COLORS.slate950, stroke: hexAlpha(color, 0.3) }));
      parts.push(textAt(bx + 16, gridTop + 28, label, { size: 15, weight: 900, fill: color, letterSpacing: 0.5 }));
      const shown = list.slice(0, 3);
      shown.forEach((j, li) => {
        const label2 = j.count > 1 ? `${j.nombre} ×${j.count}` : j.nombre;
        const short = label2.length > 18 ? label2.slice(0, 17) + '…' : label2;
        parts.push(textAt(bx + 16, gridTop + 58 + li * 28, short, { size: 17, weight: 700, fill: COLORS.white }));
      });
      if (list.length > shown.length) {
        parts.push(textAt(bx + 16, gridTop + 58 + shown.length * 28, `+${list.length - shown.length} más`, { size: 15, weight: 700, fill: COLORS.slate400 }));
      }
    });
    y += blockH + 32;
  } else if (banco && banco.length) {
    const PAD = 28, headerH2 = 44, headerGap = 18, rowH = 52, rowGap = 12, cols = 3;
    const rows = Math.ceil(banco.length / cols);
    const gridH = rows * rowH + (rows - 1) * rowGap;
    const blockH = PAD * 2 + headerH2 + headerGap + gridH;
    parts.push(panelRect({ x: PAD_X, y, w: contentW, h: blockH, rx: 28, fill: COLORS.slate900, fillOpacity: 0.7, stroke: COLORS.slate800 }));
    const iconCx = PAD_X + PAD + 11, iconCy = y + PAD + 12;
    parts.push(swapIconSvg(iconCx, iconCy, 20, COLORS.emerald400));
    parts.push(textAt(iconCx + 20, iconCy + 7, 'BANCO DE SUPLENTES', { size: 19, weight: 900, fill: COLORS.slate300, letterSpacing: 1 }));
    parts.push(textAt(W - PAD_X - PAD, iconCy + 7, `${banco.length} Convocado${banco.length === 1 ? '' : 's'}`, { size: 16, weight: 800, fill: COLORS.slate400, anchor: 'end' }));
    parts.push(`<line x1="${PAD_X + PAD}" y1="${y + PAD + headerH2 - 8}" x2="${W - PAD_X - PAD}" y2="${y + PAD + headerH2 - 8}" stroke="${hexAlpha(COLORS.slate800, 0.8)}" stroke-width="1.5"/>`);

    const gridTop = y + PAD + headerH2 + headerGap;
    const colGap = 12, colW = (contentW - PAD * 2 - colGap * (cols - 1)) / cols;
    banco.forEach((j, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const bx = PAD_X + PAD + c * (colW + colGap), by = gridTop + r * (rowH + rowGap);
      const posGrp = posGroupLabel(j.pos);
      const grpColor = posGroupColor(j.pos).light;
      parts.push(panelRect({ x: bx, y: by, w: colW, h: rowH, rx: 12, fill: COLORS.slate950, stroke: j.entro ? hexAlpha(COLORS.emerald500, 0.4) : COLORS.slate800 }));
      const name = (j.nombre || '').length > 14 ? j.nombre.slice(0, 13) + '…' : (j.nombre || '');
      parts.push(textAt(bx + 14, by + rowH / 2 + 6, name, { size: 16, weight: 700, fill: j.entro ? COLORS.emerald300 : COLORS.slate200 }));
      const badgeW = 46, badgeH = 24;
      parts.push(panelRect({ x: bx + colW - badgeW - 10, y: by + rowH / 2 - badgeH / 2, w: badgeW, h: badgeH, rx: 6, fill: hexAlpha(grpColor, 0.12) }));
      parts.push(textAt(bx + colW - badgeW / 2 - 10, by + rowH / 2 + 5, posGrp, { size: 13, weight: 900, fill: grpColor, anchor: 'middle' }));
    });
    y += blockH + 32;
  }

  // ── 4. Footer ─────────────────────────────────────────────────────────
  parts.push(textAt(cx, y + 8, 'CLUB SANTA BÁRBARA', { size: 18, weight: 700, fill: COLORS.slate500, anchor: 'middle', letterSpacing: 2 }));
  y += 40;

  const H = y;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="${COLORS.slate950}"/>
${parts.map(p => '  ' + p).join('\n')}
</svg>`;
}

module.exports = { buildMatchCardSvg };
