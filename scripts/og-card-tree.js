// Árbol de elementos (formato satori, similar a JSX/React) que reproduce a
// mano el diseño visual de .pp-share-card (ver index.html). satori no puede
// leer clases CSS de una hoja de estilos — solo estilos inline — así que
// esta es una segunda expresión del mismo diseño, pensada para cambiar poco
// (colores/layout ya definidos, no contenido). Si el diseño de la tarjeta
// cambia en index.html, hay que replicar el cambio acá también.

function hexAlpha(hex, alpha) {
  const h = String(hex || '#ffffff').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function el(type, props, ...children) {
  return { type, props: { ...props, children: children.flat().filter(x => x !== null && x !== undefined && x !== false) } };
}

function buildShareCardTree({ nombre, pos, posColor, goles, asist, pj, gmas, titulos, promGol, hasA, hasB, logros }) {
  const colorFor = (key) => {
    const l = (logros || []).find(x => x.key === key);
    return l ? l.color : '#ffffff';
  };

  const logroRow = (l) => el('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
      borderRadius: 10, background: hexAlpha(l.color, 0.15), color: l.color,
      fontSize: 15, fontWeight: 700, marginBottom: 6,
    },
  }, el('span', {}, l.icon), el('span', {}, `${l.pos}° ${l.text}`));

  const statCard = (val, label, key) => el('div', {
    style: {
      display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1,
      background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '16px 0',
    },
  },
    el('div', { style: { display: 'flex', fontSize: 32, fontWeight: 900, color: colorFor(key) } }, String(val)),
    el('div', { style: { display: 'flex', fontSize: 12, color: '#8a94ab', marginTop: 4, fontWeight: 600 } }, label)
  );

  const statSec = (val, label) => el('div', {
    style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 },
  },
    el('div', { style: { display: 'flex', fontSize: 18, fontWeight: 800, color: '#fff' } }, String(val)),
    el('div', { style: { display: 'flex', fontSize: 11, color: '#8a94ab', marginTop: 2 } }, label)
  );

  const teamBadge = (label) => el('div', {
    style: {
      display: 'flex', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1',
      borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700,
    },
  }, label);

  const initials = String(nombre || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const logrosList = (logros || []).slice(0, 4);

  return el('div', {
    style: {
      display: 'flex', flexDirection: 'column', width: 600, height: 800, padding: 32,
      backgroundColor: '#0b1220',
      backgroundImage: 'linear-gradient(160deg, #0d1a12 0%, #0b1220 65%)',
      fontFamily: 'Inter', color: '#fff',
    },
  },
    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 } },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#fff' } },
        el('span', { style: { display: 'flex', fontSize: 20 } }, '🛡️'),
        el('span', { style: { display: 'flex' } }, 'Club Santa Bárbara')),
      el('div', { style: { display: 'flex', background: '#412402', color: '#fac775', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 700 } }, 'Temporada 2026')
    ),
    el('div', { style: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 } },
      el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 36, background: '#412402', color: '#fac775', fontSize: 26, fontWeight: 900 } }, initials),
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        el('div', { style: { display: 'flex', fontSize: 24, fontWeight: 800, color: '#fff' } }, nombre),
        el('div', { style: { display: 'flex', gap: 8 } },
          el('div', { style: { display: 'flex', background: hexAlpha(posColor, 0.15), color: posColor, borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700 } }, pos || '—'),
          hasA ? teamBadge('1ra A') : null,
          hasB ? teamBadge('1ra B') : null,
        )
      )
    ),
    logrosList.length ? el('div', { style: { display: 'flex', flexDirection: 'column', marginBottom: 20 } }, ...logrosList.map(logroRow)) : null,
    el('div', { style: { display: 'flex', gap: 12, marginBottom: 20 } },
      statCard(goles, 'Goles', 'goles'), statCard(asist, 'Asistencias', 'asist'), statCard(pj, 'PJ', 'pj')
    ),
    el('div', { style: { display: 'flex', gap: 12 } },
      statSec(gmas, 'G+A'), statSec(titulos, 'Títulos'), statSec(String(promGol.toFixed(2)).replace('.', ','), 'Prom. Goles')
    ),
  );
}

module.exports = { buildShareCardTree, hexAlpha };
