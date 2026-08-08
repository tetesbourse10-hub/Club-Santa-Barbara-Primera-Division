// Arma el SVG de la tarjeta de preview de un jugador: vertical, 1080x1350
// (4:5), en paralelo al diseño visual de .pp-share-card (ver index.html).
//
// No usa satori: satori exige un archivo de fuente embebido explícito para
// dibujar cualquier texto (no hay forma de pedirle que use "la fuente que
// haya en la máquina"). Acá en cambio se arma el SVG directo con
// font-family "Inter" (la misma que usa el resto del sitio, ver
// --font-family en el <style> de index.html) seguida de la misma cadena de
// fallback (Segoe UI, system-ui, sans-serif) — es resvg (@resvg/resvg-js)
// quien la resuelve contra las fuentes instaladas en la máquina de build.
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

const FONT = "Inter, 'Segoe UI', system-ui, sans-serif";
const DEFENSOR_CODES = new Set(['LI', 'LD', 'DFI', 'DFD', 'DEF', 'DFC']);

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

function statCard({ x, y, w, h, val, label, valColor, big }) {
  const parts = [];
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${big ? '#141d2e' : 'rgba(255,255,255,0.035)'}" />`);
  const valSize = big ? 25 : 17;
  parts.push(`<text x="${x + w / 2}" y="${y + h / 2 - 2}" font-family="${FONT}" font-size="${valSize}" font-weight="900" fill="${valColor || '#ffffff'}" text-anchor="middle">${escapeXml(String(val))}</text>`);
  parts.push(`<text x="${x + w / 2}" y="${y + h / 2 + (big ? 26 : 20)}" font-family="${FONT}" font-size="13" font-weight="600" fill="#8a94ab" text-anchor="middle">${escapeXml(label)}</text>`);
  return parts.join('\n');
}

function buildShareCardSvg({ nombre, pos, posColor, goles, asist, pj, gmas, titulos, promGol, promAsist, vallas, vallasProm, pg, pe, pp, hasA, hasB, logros }) {
  const W = 1080, H = 1350;
  const PAD_X = 56, PAD_TOP = 44, PAD_BOTTOM = 44;
  const bodyTop = PAD_TOP, bodyBottom = H - PAD_BOTTOM, bodyHeight = bodyBottom - bodyTop;
  const contentW = W - PAD_X * 2;

  const isArquero = pos === 'ARQ';
  const isDefensor = DEFENSOR_CODES.has(pos);
  const initials = String(nombre || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const logrosList = (logros || []).slice(0, 4);
  const nameLines = splitName(nombre);

  const blocks = []; // { height, render(y) }

  // ── 1. Header ────────────────────────────────────────────────────────
  blocks.push({
    height: 56,
    render(y) {
      const parts = [];
      parts.push(`<text x="${PAD_X}" y="${y + 32}" font-family="${FONT}" font-size="22" font-weight="700" fill="#ffffff">🛡️ Club Santa Bárbara</text>`);
      const badgeW = 92, badgeH = 40;
      parts.push(`<rect x="${W - PAD_X - badgeW}" y="${y + (56 - badgeH) / 2}" width="${badgeW}" height="${badgeH}" rx="20" fill="#412402" />`);
      parts.push(`<text x="${W - PAD_X - badgeW / 2}" y="${y + 32}" font-family="${FONT}" font-size="17" font-weight="700" fill="#fac775" text-anchor="middle">2026</text>`);
      return parts.join('\n');
    },
  });

  // ── 2. Identidad ─────────────────────────────────────────────────────
  const AVATAR_D = 130;
  const nameGap = 14, nameLineH = 34, badgesGap = 16, badgesRowH = 34;
  const identityH = AVATAR_D + nameGap + nameLines.length * nameLineH + badgesGap + badgesRowH;
  blocks.push({
    height: identityH,
    render(y) {
      const parts = [];
      const cx = W / 2;
      const avatarCy = y + AVATAR_D / 2;
      parts.push(`<circle cx="${cx}" cy="${avatarCy}" r="${AVATAR_D / 2}" fill="${hexAlpha(posColor, 0.18)}" stroke="${hexAlpha(posColor, 0.4)}" stroke-width="3" />`);
      parts.push(`<text x="${cx}" y="${avatarCy + 16}" font-family="${FONT}" font-size="46" font-weight="900" fill="${posColor}" text-anchor="middle">${escapeXml(initials)}</text>`);
      let ny = y + AVATAR_D + nameGap;
      nameLines.forEach((line, i) => {
        parts.push(`<text x="${cx}" y="${ny + 26 + i * nameLineH}" font-family="${FONT}" font-size="32" font-weight="800" fill="#ffffff" text-anchor="middle">${escapeXml(line)}</text>`);
      });
      ny += nameLines.length * nameLineH + badgesGap;
      const posLabel = pos || '—';
      const posW = Math.max(60, 24 + posLabel.length * 12);
      const teamLabels = [hasA ? '1ra A' : null, hasB ? '1ra B' : null].filter(Boolean);
      const teamW = 70;
      const totalBadgesW = posW + (teamLabels.length ? teamLabels.length * (teamW + 10) : 0);
      let bx = cx - totalBadgesW / 2;
      parts.push(`<rect x="${bx}" y="${ny}" width="${posW}" height="${badgesRowH}" rx="10" fill="${hexAlpha(posColor, 0.18)}" />`);
      parts.push(`<text x="${bx + posW / 2}" y="${ny + 22}" font-family="${FONT}" font-size="15" font-weight="700" fill="${posColor}" text-anchor="middle">${escapeXml(posLabel)}</text>`);
      bx += posW + 10;
      teamLabels.forEach(label => {
        parts.push(`<rect x="${bx}" y="${ny}" width="${teamW}" height="${badgesRowH}" rx="10" fill="rgba(255,255,255,0.08)" />`);
        parts.push(`<text x="${bx + teamW / 2}" y="${ny + 22}" font-family="${FONT}" font-size="15" font-weight="700" fill="#cbd5e1" text-anchor="middle">${label}</text>`);
        bx += teamW + 10;
      });
      return parts.join('\n');
    },
  });

  // ── 3. Logros TOP 5 (condicional) ───────────────────────────────────
  if (logrosList.length) {
    const rowH = 50, rowGap = 12;
    blocks.push({
      height: logrosList.length * rowH + (logrosList.length - 1) * rowGap,
      render(y) {
        const parts = [];
        let ly = y;
        logrosList.forEach(l => {
          parts.push(`<rect x="${PAD_X}" y="${ly}" width="${contentW}" height="${rowH}" rx="12" fill="${hexAlpha(l.color, 0.15)}" />`);
          parts.push(`<text x="${PAD_X + 18}" y="${ly + 32}" font-family="${FONT}" font-size="17" font-weight="700" fill="${l.color}">${l.pos}° ${escapeXml(l.text)}</text>`);
          ly += rowH + rowGap;
        });
        return parts.join('\n');
      },
    });
  }

  // ── 4. Récord con la camiseta (siempre) ─────────────────────────────
  blocks.push({
    height: 64,
    render(y) {
      const parts = [];
      parts.push(`<rect x="${PAD_X}" y="${y}" width="${contentW}" height="64" rx="20" fill="rgba(239,159,39,0.08)" stroke="rgba(239,159,39,0.3)" stroke-width="1.5" />`);
      const cx = W / 2;
      parts.push(`<text x="${cx}" y="${y + 40}" font-family="${FONT}" font-size="20" font-weight="700" text-anchor="middle">` +
        `<tspan>👕 </tspan>` +
        `<tspan fill="#97c459">${escapeXml(String(pg))}</tspan><tspan fill="#4a5268"> PG — </tspan>` +
        `<tspan fill="#fac775">${escapeXml(String(pe))}</tspan><tspan fill="#4a5268"> PE — </tspan>` +
        `<tspan fill="#f09595">${escapeXml(String(pp))}</tspan><tspan fill="#4a5268"> PP</tspan>` +
        `</text>`);
      return parts.join('\n');
    },
  });

  // ── 5. Stats principales (3 cards) ──────────────────────────────────
  const mainH = 190;
  const cardGap = 20, cardW = (contentW - cardGap * 2) / 3;
  blocks.push({
    height: mainH,
    render(y) {
      const parts = [];
      let mainStats;
      if (isArquero) {
        const promVallasVal = pj > 0 ? String(vallasProm.toFixed(2)).replace('.', ',') : '—';
        mainStats = [
          { val: pj, label: 'PJ' },
          { val: vallas, label: 'Vallas Invictas', valColor: '#85b7eb' },
          { val: promVallasVal, label: 'Prom. Vallas Invictas' },
        ];
      } else {
        mainStats = [
          { val: goles, label: 'Goles', valColor: '#ef9f27' },
          { val: asist, label: 'Asistencias' },
          { val: pj, label: 'PJ' },
        ];
      }
      mainStats.forEach((st, i) => {
        const x = PAD_X + i * (cardW + cardGap);
        parts.push(statCard({ x, y, w: cardW, h: mainH, val: st.val, label: st.label, valColor: st.valColor, big: true }));
      });
      return parts.join('\n');
    },
  });

  // ── 6. Stats secundarias (3 cards, no aplica a arqueros) ────────────
  if (!isArquero) {
    const secH = 140;
    blocks.push({
      height: secH,
      render(y) {
        const parts = [];
        const promVallasVal = pj > 0 ? String(vallasProm.toFixed(2)).replace('.', ',') : '—';
        // Prom. G+A = Prom. Goles + Prom. Asistencias (mismo pj en ambos
        // términos, así que es exacto, sin necesitar otra división).
        const promGmasVal = String((promGol + promAsist).toFixed(2)).replace('.', ',');
        const stats = isDefensor
          ? [
              { val: promGmasVal, label: 'Prom. G+A' },
              { val: vallas, label: 'Vallas Invictas' },
              { val: promVallasVal, label: 'Prom. Vallas Invictas' },
            ]
          : [
              { val: gmas, label: 'G+A' },
              { val: String(promGol.toFixed(2)).replace('.', ','), label: 'Prom. Goles' },
              { val: String(promAsist.toFixed(2)).replace('.', ','), label: 'Prom. Asistencias' },
            ];
        stats.forEach((st, i) => {
          const x = PAD_X + i * (cardW + cardGap);
          parts.push(statCard({ x, y, w: cardW, h: secH, val: st.val, label: st.label, big: false }));
        });
        return parts.join('\n');
      },
    });
  }

  // ── Distribución tipo "space-between": reparte el espacio sobrante en
  // partes iguales entre bloques, para llenar el lienzo sin aire al final.
  const totalFixed = blocks.reduce((sum, b) => sum + b.height, 0);
  const gapCount = Math.max(1, blocks.length - 1);
  const gap = Math.max(10, (bodyHeight - totalFixed) / gapCount);

  const rendered = [];
  let cursor = bodyTop;
  blocks.forEach((b, i) => {
    rendered.push(b.render(cursor));
    cursor += b.height + gap;
  });

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d1a12" />
      <stop offset="60%" stop-color="#0b1220" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)" />
${rendered.map(p => '  ' + p).join('\n')}
</svg>`;
}

module.exports = { buildShareCardSvg, hexAlpha, escapeXml };
