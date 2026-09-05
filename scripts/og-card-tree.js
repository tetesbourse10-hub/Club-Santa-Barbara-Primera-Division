// Arma el SVG de la tarjeta de preview de un jugador: vertical, 1080x1350
// (4:5), en paralelo al diseño visual de .pp-share-card (ver index.html).
//
// No usa satori: satori exige un archivo de fuente embebido explícito para
// dibujar cualquier texto igual que resvg, así que no evitaba el problema,
// solo lo movía de lugar. Acá se arma el SVG directo con font-family
// "Inter" (la misma que usa el resto del sitio, ver --font-family en el
// <style> de index.html) — quien la resuelve de verdad es resvg
// (@resvg/resvg-js) en scripts/generate-og.js, al que se le pasa el .ttf
// real de Inter como buffer (bajado en build time por
// scripts/fetch-font.js) con loadSystemFonts:false, así el resultado no
// depende de qué fuentes tenga instaladas la máquina de build.
//
// Distribución vertical: en vez de espaciados fijos entre secciones, se
// calcula la altura de cada bloque (header, identidad, logros, récord,
// stats…) y se reparte el espacio sobrante EN PARTES IGUALES entre todos
// los bloques — el equivalente a "justify-content: space-between" de
// flexbox — para que el contenido llene el lienzo de punta a punta sin
// aire muerto al final, sin importar cuántos bloques haya (un jugador sin
// logros TOP 5 o un arquero sin fila secundaria tienen menos bloques, y el
// espacio se reparte distinto, pero siempre hasta el borde inferior).

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

// Antes: "Inter, 'Segoe UI', system-ui, sans-serif" (la misma cadena de
// fallback que usa index.html) — pero acá NO tiene sentido: resvg solo
// tiene cargados los 3 buffers de Inter (loadSystemFonts:false), así que
// "Segoe UI"/"system-ui"/"sans-serif" nunca van a matchear nada de todas
// formas. Sospecha real (reportado: el texto sale como una fuente serif
// tipo Times New Roman en vez de Inter): si por lo que sea el matching de
// "Inter" como PRIMER nombre de una lista con comas le genera algún
// problema al parser de font-family de resvg, la cadena entera termina
// cayendo a algún fallback interno — que puede ser justo ese serif
// genérico. Pedir directamente "Inter" a secas, sin lista, elimina esa
// ambigüedad por completo.
const FONT = 'Inter';
const DEFENSOR_CODES = new Set(['LI', 'LD', 'DFI', 'DFD', 'DEF', 'DFC']);

// Paleta Tailwind (Dark Slate + Verde Esmeralda + acentos Dorado/Celeste),
// pedida explícitamente para que la tarjeta se sienta como Wyscout/
// Sofascore/EA Sports en vez del verde/azul genérico de antes. Nombres de
// variable = nombre de la clase Tailwind correspondiente, para poder
// comparar 1 a 1 contra el diseño de referencia (HTML+Tailwind) del que
// sale esta paleta.
const COLORS = {
  slate950: '#020617',
  slate900: '#0f172a',
  slate800: '#1e293b',
  slate700: '#334155',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',
  white: '#f8fafc',
  emerald500: '#10b981',
  emerald400: '#34d399',
  emerald300: '#6ee7b7',
  amber500: '#f59e0b',
  amber400: '#fbbf24',
  amber300: '#fcd34d',
  sky400: '#38bdf8',
  rose500: '#f43f5e',
  rose400: '#fb7185',
  purple400: '#c084fc',
};
// Mismos colores por métrica que usa el perfil real (ver los kpi('pp-m-...')
// dentro de renderPlayerProfile en index.html), alineados a la paleta de
// arriba.
const STAT_COLORS = {
  goles: COLORS.emerald400,
  asist: COLORS.sky400,
  ga: COLORS.purple400,
  vallas: COLORS.sky400,
};
// Código de posición → nombre completo ("MD" → "Mediocampista Derecho") —
// mismo mapeo que POS_NOMBRE en index.html, duplicado a mano acá (en vez de
// leerlo vía window.POS_NOMBRE) porque ese objeto es un `const` de nivel
// superior: no queda expuesto en window dentro del jsdom de generate-og.js
// (mismo motivo, real, documentado en netlify/functions/_matchData.js para
// GS/RIVAL_CREST_URLS) — como es un mapa chico y estático que casi nunca
// cambia, duplicarlo acá es más simple y confiable que resolver ese problema
// para un solo uso.
const POS_NOMBRE = {
  ARQ: 'Arquero', DFC: 'Defensor Central', DFI: 'Defensor Izquierdo', DFD: 'Defensor Derecho',
  LI: 'Lateral Izquierdo', LD: 'Lateral Derecho', MC: 'Mediocampista', MCO: 'Mediocampista Ofensivo',
  MCE: 'Mediocampista', MI: 'Mediocampista Izquierdo', MD: 'Mediocampista Derecho', DC: 'Delantero Centro',
  ED: 'Extremo Derecho', EI: 'Extremo Izquierdo',
  DEL: 'Delantero', AT: 'Delantero',
};

// Paleta dinámica por LÍNEA de posición (pedida explícitamente): arquero
// violeta, defensores celeste, mediocampistas esmeralda, delanteros dorado —
// se usa en el avatar, sus bordes y los glows de fondo de la tarjeta. Es
// deliberadamente DISTINTA de _plantelPosColor (index.html), que pinta cada
// código de posición individual con un color propio para las tablas del
// sitio — acá se agrupa por línea, no por posición puntual.
const POS_GROUP = {
  ARQ: 'arq',
  DFC: 'def', DFI: 'def', DFD: 'def', LI: 'def', LD: 'def', DEF: 'def',
  MC: 'med', MCO: 'med', MCE: 'med', MI: 'med', MD: 'med',
  DC: 'del', ED: 'del', EI: 'del', DEL: 'del', AT: 'del',
};
const GROUP_COLORS = {
  arq: { solid: '#a855f7', light: '#c084fc' }, // purple-500/400
  def: { solid: '#0ea5e9', light: '#38bdf8' }, // sky-500/400
  med: { solid: '#10b981', light: '#34d399' }, // emerald-500/400
  del: { solid: '#f59e0b', light: '#fbbf24' }, // amber-500/400
};
function posGroupColor(pos) {
  const group = POS_GROUP[String(pos || '').toUpperCase()] || 'med';
  return GROUP_COLORS[group];
}

// Ícono de trofeo sin depender de ningún glifo de fuente (Inter no tiene
// emoji 🏆) — copa + 2 asas + base, armado con primitivas SVG.
function trophyIconSvg(cx, cy, s, color) {
  const bodyW = s, bodyH = s * 0.55, topY = cy - s * 0.5;
  const handleR = s * 0.16, handleSw = s * 0.09;
  return [
    `<path d="M ${cx - bodyW / 2} ${topY} h ${bodyW} v ${bodyH * 0.45} a ${bodyW / 2} ${bodyH * 0.75} 0 0 1 ${-bodyW} 0 z" fill="${color}"/>`,
    `<circle cx="${cx - bodyW / 2 - s * 0.14}" cy="${topY + bodyH * 0.18}" r="${handleR}" fill="none" stroke="${color}" stroke-width="${handleSw}"/>`,
    `<circle cx="${cx + bodyW / 2 + s * 0.14}" cy="${topY + bodyH * 0.18}" r="${handleR}" fill="none" stroke="${color}" stroke-width="${handleSw}"/>`,
    `<rect x="${cx - s * 0.06}" y="${topY + bodyH * 0.5}" width="${s * 0.12}" height="${s * 0.3}" fill="${color}"/>`,
    `<rect x="${cx - s * 0.3}" y="${topY + bodyH * 0.5 + s * 0.3}" width="${s * 0.6}" height="${s * 0.12}" rx="${s * 0.04}" fill="${color}"/>`,
  ].join('');
}

// Ancho aproximado de un carácter en Inter Bold/Black, como fracción del
// font-size — no es exacto (no hay métricas reales de la fuente acá), pero
// alcanza para centrar una línea corta con varios <tspan> de colores
// distintos SIN depender de que el motor SVG calcule bien el ancho
// combinado de varios tspans bajo text-anchor="middle" (confirmado con un
// motor de prueba: pierde caracteres en ese escenario exacto — bug de ESE
// motor, pero como no hay forma de probarlo contra resvg desde acá, la
// solución elegida no depende de ningún motor en particular: cada tspan
// lleva su propio x calculado a mano).
const CHAR_W = { ' ': 0.28, '—': 0.85, '-': 0.34, '.': 0.28, ',': 0.28 };
function estimateTextWidth(text, fontSize) {
  let w = 0;
  for (const ch of String(text)) {
    const frac = CHAR_W[ch] ?? (/[0-9]/.test(ch) ? 0.6 : /[A-ZÁÉÍÓÚÑ]/.test(ch) ? 0.72 : 0.6);
    w += frac * fontSize;
  }
  return w;
}

// Línea de <tspan> de colores distintos, centrada como UN bloque en cx —
// cada tspan lleva su propio x= (calculado a partir del ancho estimado de
// los anteriores), así que el resultado no depende de que el motor SVG
// sepa centrar varios tspans juntos.
function coloredLineSvg({ cx, y, fontSize, fontWeight = 700, segments }) {
  const widths = segments.map(s => estimateTextWidth(s.text, fontSize));
  const totalW = widths.reduce((a, b) => a + b, 0);
  let x = cx - totalW / 2;
  const parts = segments.map((s, i) => {
    const tspan = `<tspan x="${x}" y="${y}" fill="${s.fill}">${escapeXml(s.text)}</tspan>`;
    x += widths[i];
    return tspan;
  });
  return `<text font-family="${FONT}" font-size="${fontSize}" font-weight="${fontWeight}" xml:space="preserve">${parts.join('')}</text>`;
}

function splitName(nombre, maxLine = 16) {
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

// Rediseño pedido a partir de una referencia HTML+Tailwind (Dark Slate +
// Verde Esmeralda + acentos Dorado/Celeste, estilo Wyscout/Sofascore/EA
// Sports) — traducido a mano a SVG (no se migra el motor a Satori/Puppeteer,
// ver la explicación dada en el chat: mismo problema de fuentes que ya
// resolvimos acá, más el costo/riesgo de una infraestructura nueva en
// Netlify Functions). Sin emoji (👑🎯🔄⚽🅰️🟥 de la referencia): Inter no
// tiene esos glifos, se reemplazan por badges de color con texto/iniciales.
function panelRect({ x, y, w, h, rx = 28, fill, fillOpacity, stroke, strokeWidth = 1.5 }) {
  const fo = fillOpacity != null ? ` fill-opacity="${fillOpacity}"` : '';
  const st = stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}"` : '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${fo}${st}/>`;
}

function buildShareCardSvg({ nombre, pos, posColor, goles, asist, pj, gmas, titulos, titulosList, promGol, promAsist, vallas, vallasProm, pg, pe, pp, hasA, hasB, logros, logoDataUri }) {
  // W/H_BASE: el formato "de base" es 1080x1350 (4:5) — pero la altura NO
  // es fija de verdad: cuántos bloques entran (logros, títulos, si es
  // arquero o no…) varía por jugador, y con el bloque de Títulos Obtenidos
  // sumado el contenido puede pesar más que esos 1350px. Antes el alto se
  // quedaba fijo y lo que no entraba se dibujaba fuera del <svg> (recortado
  // sin ningún error, "se corta la imagen" reportado) — ahora el alto real
  // se recalcula MÁS ABAJO, después de saber cuánto miden todos los
  // bloques, y el canvas crece si hace falta.
  const W = 1080, H_BASE = 1350;
  const PAD_X = 64, PAD_TOP = 48, PAD_BOTTOM = 48;
  const bodyTop = PAD_TOP;
  const contentW = W - PAD_X * 2;
  const cx = W / 2;

  const isArquero = pos === 'ARQ';
  const initials = String(nombre || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const logrosList = (logros || []).slice(0, 4);
  const nameLines = splitName(nombre);
  const posFull = POS_NOMBRE[pos] || pos || '—';
  const teamLabels = [hasA ? '1ra A' : null, hasB ? '1ra B' : null].filter(Boolean);
  // Paleta dinámica según la línea de la posición (arquero/defensor/
  // mediocampista/delantero) — pisa el `posColor` puntual que manda
  // generate-og.js (ver _plantelPosColor), que es más granular pero no es
  // el agrupamiento que se pidió acá.
  const pc = posGroupColor(pos);

  const blocks = []; // { height, render(y) }

  // ── 1. Header: escudo + nombre de club + pestaña de temporada ───────
  const HEADER_H = 100;
  blocks.push({
    height: HEADER_H,
    render(y) {
      const parts = [];
      const iconR = 34, iconCx = PAD_X + iconR, iconCy = y + iconR;
      parts.push(`<circle cx="${iconCx}" cy="${iconCy}" r="${iconR}" fill="${hexAlpha(COLORS.emerald500, 0.15)}" stroke="${hexAlpha(COLORS.emerald500, 0.4)}" stroke-width="2"/>`);
      if (logoDataUri) {
        const logoR = iconR - 6;
        parts.push(`<defs><clipPath id="hdrLogoClip"><circle cx="${iconCx}" cy="${iconCy}" r="${logoR}"/></clipPath></defs>`);
        parts.push(`<image x="${iconCx - logoR}" y="${iconCy - logoR}" width="${logoR * 2}" height="${logoR * 2}" href="${logoDataUri}" clip-path="url(#hdrLogoClip)" preserveAspectRatio="xMidYMid slice"/>`);
      }
      const textX = iconCx + iconR + 22;
      parts.push(`<text x="${textX}" y="${y + 30}" font-family="${FONT}" font-size="30" font-weight="900" fill="${COLORS.white}">Club Santa Bárbara</text>`);
      parts.push(`<text x="${textX}" y="${y + 54}" font-family="${FONT}" font-size="17" font-weight="700" letter-spacing="1" fill="${COLORS.slate400}">FICHA OFICIAL DE JUGADOR</text>`);
      const badgeW = 220, badgeH = 48;
      parts.push(panelRect({ x: W - PAD_X - badgeW, y: y + 8, w: badgeW, h: badgeH, rx: 24, fill: hexAlpha(COLORS.emerald500, 0.1), stroke: hexAlpha(COLORS.emerald500, 0.25) }));
      parts.push(`<text x="${W - PAD_X - badgeW / 2}" y="${y + 38}" font-family="${FONT}" font-size="20" font-weight="900" fill="${COLORS.emerald400}" text-anchor="middle">TEMPORADA 2026</text>`);
      parts.push(`<line x1="${PAD_X}" y1="${y + HEADER_H - 4}" x2="${W - PAD_X}" y2="${y + HEADER_H - 4}" stroke="${COLORS.slate800}" stroke-width="1.5"/>`);
      return parts.join('\n');
    },
  });

  // ── 2. Tarjeta de identidad: avatar + nombre + pos/equipo + logros ──
  const PAD_INNER = 44;
  const AVATAR_D = 200, AVATAR_R = AVATAR_D / 2;
  const gapAvatarName = 30, nameLineH = 60, gapNamePills = 24, pillsRowH = 56;
  const logroRowH = 68, logroGap = 16;
  const logrosBlockH = logrosList.length ? logrosList.length * logroRowH + (logrosList.length - 1) * logroGap : 0;
  const identityInnerH = AVATAR_D + gapAvatarName + nameLines.length * nameLineH + gapNamePills + pillsRowH
    + (logrosList.length ? 28 + logrosBlockH : 0);
  const identityPanelH = PAD_INNER * 2 + identityInnerH;
  blocks.push({
    height: identityPanelH,
    render(y) {
      const parts = [];
      parts.push(panelRect({ x: PAD_X, y, w: contentW, h: identityPanelH, rx: 28, fill: COLORS.slate900, fillOpacity: 0.6, stroke: COLORS.slate800 }));

      const avatarCy = y + PAD_INNER + AVATAR_R;
      parts.push(`<defs><linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${COLORS.slate800}"/><stop offset="100%" stop-color="${COLORS.slate900}"/></linearGradient></defs>`);
      parts.push(`<circle cx="${cx}" cy="${avatarCy}" r="${AVATAR_R}" fill="url(#avatarGrad)" stroke="${hexAlpha(pc.solid, 0.5)}" stroke-width="4"/>`);
      parts.push(`<text x="${cx}" y="${avatarCy + 20}" font-family="${FONT}" font-size="56" font-weight="900" fill="${pc.light}" text-anchor="middle">${escapeXml(initials)}</text>`);
      // Badge de posición superpuesto (abajo-derecha del avatar).
      const posBadgeLabel = pos || '—';
      const posBadgeW = Math.max(74, 34 + posBadgeLabel.length * 22), posBadgeH = 46;
      const pbCx = cx + AVATAR_R * 0.62, pbCy = avatarCy + AVATAR_R * 0.62;
      parts.push(panelRect({ x: pbCx - posBadgeW / 2, y: pbCy - posBadgeH / 2, w: posBadgeW, h: posBadgeH, rx: 14, fill: pc.solid, stroke: COLORS.slate950, strokeWidth: 3 }));
      parts.push(`<text x="${pbCx}" y="${pbCy + 8}" font-family="${FONT}" font-size="22" font-weight="900" fill="${COLORS.slate950}" text-anchor="middle">${escapeXml(posBadgeLabel)}</text>`);

      let ny = y + PAD_INNER + AVATAR_D + gapAvatarName;
      nameLines.forEach((line, i) => {
        parts.push(`<text x="${cx}" y="${ny + 46 + i * nameLineH}" font-family="${FONT}" font-size="52" font-weight="900" fill="${COLORS.white}" text-anchor="middle">${escapeXml(line)}</text>`);
      });
      ny += nameLines.length * nameLineH + gapNamePills;

      // Pills: posición completa + equipo(s) — centrados como un solo bloque.
      const posPillW = Math.max(140, 44 + posFull.length * 15.5);
      const teamPillW = 118, pillsGap = 14;
      const totalPillsW = posPillW + teamLabels.length * (teamPillW + pillsGap);
      let px = cx - totalPillsW / 2;
      parts.push(panelRect({ x: px, y: ny, w: posPillW, h: pillsRowH, rx: 14, fill: COLORS.slate950, stroke: COLORS.slate800 }));
      parts.push(`<text x="${px + posPillW / 2}" y="${ny + pillsRowH / 2 + 8}" font-family="${FONT}" font-size="22" font-weight="700" fill="${COLORS.slate400}" text-anchor="middle">${escapeXml(posFull)}</text>`);
      px += posPillW + pillsGap;
      teamLabels.forEach(label => {
        parts.push(panelRect({ x: px, y: ny, w: teamPillW, h: pillsRowH, rx: 14, fill: hexAlpha(COLORS.emerald500, 0.1), stroke: hexAlpha(COLORS.emerald500, 0.3) }));
        parts.push(`<text x="${px + teamPillW / 2}" y="${ny + pillsRowH / 2 + 8}" font-family="${FONT}" font-size="22" font-weight="900" fill="${COLORS.emerald400}" text-anchor="middle">${escapeXml(label)}</text>`);
        px += teamPillW + pillsGap;
      });
      ny += pillsRowH;

      // Hitos/logros TOP 5 — cada uno ya trae su color (ver
      // _ppComputeTopLogros en index.html: dorado para récords históricos,
      // esmeralda para logros de la temporada en curso, etc.)
      if (logrosList.length) {
        ny += 28;
        logrosList.forEach(l => {
          parts.push(panelRect({ x: PAD_X + PAD_INNER, y: ny, w: contentW - PAD_INNER * 2, h: logroRowH, rx: 16, fill: hexAlpha(l.color, 0.12), stroke: hexAlpha(l.color, 0.3) }));
          parts.push(`<text x="${PAD_X + PAD_INNER + 26}" y="${ny + logroRowH / 2 + 8}" font-family="${FONT}" font-size="24" font-weight="700" fill="${l.color}">${l.pos}° ${escapeXml(l.text)}</text>`);
          ny += logroRowH + logroGap;
        });
      }
      return parts.join('\n');
    },
  });

  // ── 3. Récord de resultados (PG — PE — PP) ──────────────────────────
  const RECORD_H = 110;
  blocks.push({
    height: RECORD_H,
    render(y) {
      const parts = [];
      parts.push(panelRect({ x: PAD_X, y, w: contentW, h: RECORD_H, rx: 24, fill: COLORS.slate900, fillOpacity: 0.6, stroke: COLORS.slate800 }));
      const groups = [
        { val: pg, label: 'PG', color: COLORS.emerald400, bg: hexAlpha(COLORS.emerald500, 0.12) },
        { val: pe, label: 'PE', color: COLORS.amber400, bg: hexAlpha(COLORS.amber500, 0.12) },
        { val: pp, label: 'PP', color: COLORS.rose400, bg: hexAlpha(COLORS.rose500, 0.12) },
      ];
      // Ancho REAL de cada grupo (pill + separación + ancho estimado del
      // label), no un slot fijo — un slot fijo más ancho que el contenido
      // real dejaba "aire muerto" al final de cada grupo y el conjunto
      // terminaba viéndose corrido a la izquierda en vez de centrado
      // (bug reportado: "no está centralizada").
      const pillW = 62, pillH = 42, labelGap = 16, dashSlotW = 46;
      const groupWidths = groups.map(g => pillW + labelGap + estimateTextWidth(g.label, 20));
      const totalW = groupWidths.reduce((a, b) => a + b, 0) + (groups.length - 1) * dashSlotW;
      let gx = cx - totalW / 2;
      const midY = y + RECORD_H / 2;
      groups.forEach((g, i) => {
        parts.push(panelRect({ x: gx, y: midY - pillH / 2, w: pillW, h: pillH, rx: 10, fill: g.bg }));
        parts.push(`<text x="${gx + pillW / 2}" y="${midY + 8}" font-family="${FONT}" font-size="24" font-weight="900" fill="${g.color}" text-anchor="middle">${escapeXml(String(g.val))}</text>`);
        parts.push(`<text x="${gx + pillW + labelGap}" y="${midY + 7}" font-family="${FONT}" font-size="20" font-weight="700" fill="${COLORS.slate400}">${g.label}</text>`);
        gx += groupWidths[i];
        if (i < groups.length - 1) {
          parts.push(`<text x="${gx + dashSlotW / 2}" y="${midY + 7}" font-family="${FONT}" font-size="24" font-weight="700" fill="${COLORS.slate700}" text-anchor="middle">—</text>`);
          gx += dashSlotW;
        }
      });
      return parts.join('\n');
    },
  });

  // ── 3b. Títulos obtenidos (lista real, no solo el contador) ─────────
  // titulosList viene de _collectPlayerTitulos (index.html): los títulos
  // reales del jugador (torneo + año), no solo el total acumulado.
  const titulosArr = titulosList || [];
  const TIT_SHOWN_MAX = 6;
  const titulosShown = titulosArr.slice(0, TIT_SHOWN_MAX);
  const titulosExtra = titulosArr.length - titulosShown.length;
  if (titulos > 0 && titulosShown.length) {
    const TIT_PAD = 28;
    const TIT_HEADER_H = 44, TIT_HEADER_GAP = 18;
    const TIT_ROW_H = 56, TIT_ROW_GAP = 12, TIT_COL_GAP = 12;
    const titRows = Math.ceil(titulosShown.length / 2);
    const titGridH = titRows * TIT_ROW_H + (titRows - 1) * TIT_ROW_GAP;
    const titExtraH = titulosExtra > 0 ? 32 + 10 : 0;
    const titInnerH = TIT_HEADER_H + TIT_HEADER_GAP + titGridH + titExtraH;
    const titPanelH = TIT_PAD * 2 + titInnerH;
    blocks.push({
      height: titPanelH,
      render(y) {
        const parts = [];
        parts.push(panelRect({ x: PAD_X, y, w: contentW, h: titPanelH, rx: 28, fill: COLORS.slate900, fillOpacity: 0.6, stroke: COLORS.slate800 }));
        const innerX = PAD_X + TIT_PAD, innerW = contentW - TIT_PAD * 2;
        // Header: ícono trofeo + "TÍTULOS OBTENIDOS" a la izquierda, conteo a la derecha.
        const iconCx = innerX + 12, iconCy = y + TIT_PAD + 12;
        parts.push(trophyIconSvg(iconCx, iconCy, 22, COLORS.amber400));
        parts.push(`<text x="${iconCx + 22}" y="${iconCy + 7}" font-family="${FONT}" font-size="19" font-weight="900" letter-spacing="1" fill="${COLORS.slate400}">TÍTULOS OBTENIDOS</text>`);
        const campLabel = `${titulos} Campeonato${titulos === 1 ? '' : 's'}`;
        parts.push(`<text x="${innerX + innerW}" y="${iconCy + 7}" font-family="${FONT}" font-size="19" font-weight="900" fill="${COLORS.amber400}" text-anchor="end">${escapeXml(campLabel)}</text>`);
        const headerBottomY = y + TIT_PAD + TIT_HEADER_H - 8;
        parts.push(`<line x1="${innerX}" y1="${headerBottomY}" x2="${innerX + innerW}" y2="${headerBottomY}" stroke="${hexAlpha(COLORS.slate800, 0.8)}" stroke-width="1.5"/>`);

        const gridTop = y + TIT_PAD + TIT_HEADER_H + TIT_HEADER_GAP;
        const colW = (innerW - TIT_COL_GAP) / 2;
        // Agrupar en filas de a 2 primero: así, si una fila queda con un
        // solo título (el total es impar, o directamente hay uno solo), esa
        // fila se centra a todo el ancho en vez de quedar pegada a la
        // columna izquierda con medio panel vacío al lado (bug reportado).
        const titRowsArr = [];
        for (let i = 0; i < titulosShown.length; i += 2) titRowsArr.push(titulosShown.slice(i, i + 2));
        titRowsArr.forEach((row, r) => {
          const by = gridTop + r * (TIT_ROW_H + TIT_ROW_GAP);
          const renderBox = (t, bx, bw) => {
            parts.push(panelRect({ x: bx, y: by, w: bw, h: TIT_ROW_H, rx: 12, fill: COLORS.slate950, stroke: hexAlpha(COLORS.amber500, 0.3) }));
            const label = t.torneo || 'Título';
            const maxChars = row.length === 1 ? 34 : 20;
            const shortLabel = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;
            parts.push(`<text x="${bx + 20}" y="${by + TIT_ROW_H / 2 + 7}" font-family="${FONT}" font-size="20" font-weight="700" fill="${COLORS.white}">${escapeXml(shortLabel)}</text>`);
            parts.push(`<text x="${bx + bw - 18}" y="${by + TIT_ROW_H / 2 + 7}" font-family="${FONT}" font-size="20" font-weight="900" fill="${COLORS.amber400}" text-anchor="end">${escapeXml(String(t.anio || ''))}</text>`);
          };
          if (row.length === 1) {
            renderBox(row[0], innerX, innerW);
          } else {
            renderBox(row[0], innerX, colW);
            renderBox(row[1], innerX + colW + TIT_COL_GAP, colW);
          }
        });
        if (titulosExtra > 0) {
          const extraY = gridTop + titGridH + 10 + 22;
          parts.push(`<text x="${innerX + innerW / 2}" y="${extraY}" font-family="${FONT}" font-size="18" font-weight="700" fill="${COLORS.slate400}" text-anchor="middle">+${titulosExtra} más</text>`);
        }
        return parts.join('\n');
      },
    });
  }

  // ── 4. Matriz de estadísticas (grilla 3xN "encasillada") ────────────
  const cellH = 190, outerPad = 10;
  const rows = isArquero
    ? [[
        { val: pj, label: 'PJ', color: COLORS.white },
        { val: vallas, label: 'Vallas Invictas', color: STAT_COLORS.vallas },
        { val: pj > 0 ? String(vallasProm.toFixed(2)).replace('.', ',') : '—', label: 'Prom. Vallas', color: STAT_COLORS.vallas },
      ]]
    : [
        [
          { val: goles, label: 'Goles', color: STAT_COLORS.goles },
          { val: asist, label: 'Asistencias', color: STAT_COLORS.asist },
          { val: pj, label: 'Partidos', color: COLORS.white },
        ],
        [
          { val: gmas, label: 'G + A', color: STAT_COLORS.ga },
          { val: String(promGol.toFixed(2)).replace('.', ','), label: 'Prom. Gol', color: STAT_COLORS.goles },
          { val: String(promAsist.toFixed(2)).replace('.', ','), label: 'Prom. Asist.', color: STAT_COLORS.asist },
        ],
      ];
  const gridOuterH = rows.length * cellH + outerPad * 2;
  blocks.push({
    height: gridOuterH,
    render(y) {
      const parts = [];
      parts.push(panelRect({ x: PAD_X, y, w: contentW, h: gridOuterH, rx: 28, fill: COLORS.slate900, fillOpacity: 0.6, stroke: COLORS.slate800 }));
      const innerX = PAD_X + outerPad, innerY = y + outerPad, innerW = contentW - outerPad * 2, innerH = gridOuterH - outerPad * 2;
      parts.push(panelRect({ x: innerX, y: innerY, w: innerW, h: innerH, rx: 20, fill: COLORS.slate950 }));
      const cellW = innerW / 3;
      // Líneas divisorias (divide-x/divide-y de la referencia).
      for (let c = 1; c < 3; c++) {
        parts.push(`<line x1="${innerX + c * cellW}" y1="${innerY}" x2="${innerX + c * cellW}" y2="${innerY + innerH}" stroke="${hexAlpha(COLORS.slate800, 0.8)}" stroke-width="1.5"/>`);
      }
      for (let r = 1; r < rows.length; r++) {
        parts.push(`<line x1="${innerX}" y1="${innerY + r * cellH}" x2="${innerX + innerW}" y2="${innerY + r * cellH}" stroke="${hexAlpha(COLORS.slate800, 0.8)}" stroke-width="1.5"/>`);
      }
      rows.forEach((row, r) => {
        row.forEach((st, c) => {
          const ccx = innerX + c * cellW + cellW / 2, ccy = innerY + r * cellH + cellH / 2;
          parts.push(`<text x="${ccx}" y="${ccy - 8}" font-family="${FONT}" font-size="56" font-weight="900" letter-spacing="-1" fill="${st.color}" text-anchor="middle">${escapeXml(String(st.val))}</text>`);
          parts.push(`<text x="${ccx}" y="${ccy + 38}" font-family="${FONT}" font-size="20" font-weight="800" letter-spacing="1.5" fill="${COLORS.slate400}" text-anchor="middle">${escapeXml(st.label.toUpperCase())}</text>`);
        });
      });
      return parts.join('\n');
    },
  });

  // ── 5. Footer discreto ───────────────────────────────────────────────
  blocks.push({
    height: 36,
    render(y) {
      return `<text x="${cx}" y="${y + 20}" font-family="${FONT}" font-size="17" font-weight="700" letter-spacing="2" fill="${COLORS.slate500}" text-anchor="middle">CLUB SANTA BÁRBARA</text>`;
    },
  });

  // ── Distribución tipo "space-between": reparte el espacio sobrante en
  // partes iguales entre bloques, para llenar el lienzo sin aire al final.
  // El alto del canvas es el MAYOR entre el base (1350) y lo que realmente
  // necesitan los bloques + un gap mínimo entre todos — así un jugador con
  // muchos títulos/logros nunca queda con contenido recortado fuera del
  // <svg> (bug real reportado: "se corta la imagen y la fila de abajo no
  // se ve").
  const MIN_GAP = 10;
  const totalFixed = blocks.reduce((sum, b) => sum + b.height, 0);
  const gapCount = Math.max(1, blocks.length - 1);
  const minBodyHeight = H_BASE - PAD_TOP - PAD_BOTTOM;
  const neededBodyHeight = totalFixed + gapCount * MIN_GAP;
  const bodyHeight = Math.max(minBodyHeight, neededBodyHeight);
  const gap = Math.max(MIN_GAP, (bodyHeight - totalFixed) / gapCount);
  const H = PAD_TOP + bodyHeight + PAD_BOTTOM;

  const rendered = [];
  let cursor = bodyTop;
  blocks.forEach((b, i) => {
    rendered.push(b.render(cursor));
    cursor += b.height + gap;
  });

  // Fondo slate-950 + 2 glows esmeralda difuminados (esquina superior-
  // derecha e inferior-izquierda) — mismo efecto que los
  // "absolute ... blur-3xl" decorativos de la referencia Tailwind.
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="cardGlowBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="70"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="${COLORS.slate950}"/>
  <circle cx="${W - 60}" cy="60" r="200" fill="${pc.solid}" opacity="0.10" filter="url(#cardGlowBlur)"/>
  <circle cx="40" cy="${H - 60}" r="200" fill="${pc.solid}" opacity="0.06" filter="url(#cardGlowBlur)"/>
${rendered.map(p => '  ' + p).join('\n')}
</svg>`;
}

// COLORS/FONT/posGroupColor/estimateTextWidth se re-exportan para que
// netlify/functions/_matchCardSvg.js (la Ficha de Partido) use exactamente
// la misma paleta Dark Slate + Verde Esmeralda y el mismo criterio de color
// por línea de posición, en vez de duplicar los valores a mano.
module.exports = {
  buildShareCardSvg, hexAlpha, escapeXml,
  COLORS, FONT, posGroupColor, estimateTextWidth,
};
