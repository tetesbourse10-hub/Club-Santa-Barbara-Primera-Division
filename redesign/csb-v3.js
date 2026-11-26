/* ════════════════════════════════════════════════════════════════════
   CLUB SANTA BÁRBARA — Rediseño v3: shell, home y funciones nuevas.
   Archivo aparte (no inline) a propósito: los scripts de build
   (scripts/_matchPartidoData.js, generate-og.js) evalúan TODOS los
   <script> inline de index.html dentro de jsdom — este archivo toca el
   DOM apenas carga, así que tiene que quedar afuera de esa evaluación.
   Todo lo de acá se apoya en las funciones globales que ya existen
   (openSection, showTab, _navGoTab, goToPlayer, goBack...) — no duplica
   lógica de datos.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__v3Booted) return;
  window.__v3Booted = true;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const initials = n => String(n || '').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const g = name => (typeof window[name] === 'function' ? window[name] : null);
  const safe = fn => { try { return fn(); } catch (e) { return undefined; } };

  // Acceso a los `const`/`let` de nivel superior de index.html (DATA_A,
  // DATA_B, currentData, _navStack): no son propiedades de window, pero sí
  // comparten el entorno léxico global con este script clásico.
  const getData = k => safe(() => (k === 'a' ? DATA_A : DATA_B));
  const getCurrent = () => safe(() => currentData);
  const getNavStackLen = () => safe(() => _navStack.length) || 0;

  const TABS = ['resumen', 'posiciones', 'jugadores', 'historial', 'graficos'];
  const TAB_TITLES = ['Resumen', 'En Vivo', 'Jugadores', 'Historial vs Clubes', 'Torneos'];

  // ── Íconos (trazos simples, mismo grosor en todo el shell) ──
  const I = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>',
    resumen: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    vivo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"/><path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/></svg>',
    jugadores: '<svg viewBox="0 0 24 24"><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3.5"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35"/><path d="M15 4.6a3.5 3.5 0 0 1 0 6.8"/></svg>',
    historial: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3.5 2"/></svg>',
    torneos: '<svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/></svg>',
    nido: '<svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>',
    h2h: '<svg viewBox="0 0 24 24"><path d="M7 4 3 8l4 4"/><path d="M3 8h11"/><path d="m17 12 4 4-4 4"/><path d="M21 16H10"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 9 12l6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  };

  // ── Estado del shell ──
  let prefSq = safe(() => localStorage.getItem('v3-sq')) || 'a';
  const setPrefSq = sq => { prefSq = sq; safe(() => localStorage.setItem('v3-sq', sq)); };

  function view() {
    const landing = $('#landing');
    const landingOn = landing && landing.style.display !== 'none' && getComputedStyle(landing).display !== 'none';
    const nidoEl = $('#tab-nido');
    const nidoOn = !landingOn && nidoEl && nidoEl.style.display !== 'none' && nidoEl.classList.contains('active');
    const overlay = $('#player-profile-overlay');
    const profileOn = !!overlay && overlay.style.display === 'block';
    const btns = $$('#main-nav button');
    const idx = btns.findIndex(b => b.classList.contains('active'));
    const cd = getCurrent();
    const sq = cd && cd === getData('b') ? 'b' : (cd ? 'a' : prefSq);
    return { landingOn, nidoOn, profileOn, idx, sq };
  }

  // ── Navegación (todo pasa por las funciones originales) ──
  function closeProfileIfOpen() {
    const ov = $('#player-profile-overlay');
    if (ov && ov.style.display === 'block' && g('closePlayerProfile')) closePlayerProfile();
  }
  function goHome() { closeProfileIfOpen(); closeMore(); if (g('goBack')) goBack(); window.scrollTo(0, 0); }
  function goNido() { closeProfileIfOpen(); closeMore(); openSection('nido'); window.scrollTo(0, 0); }
  function goTab(name, sq) {
    closeProfileIfOpen(); closeMore();
    const v = view();
    const target = sq || v.sq || prefSq;
    if (v.landingOn || v.nidoOn || !getCurrent() || (target !== v.sq)) openSection(target);
    const idx = TABS.indexOf(name);
    if (name !== 'resumen' || idx !== view().idx) _navGoTab(name, $$('#main-nav button')[idx]);
    window.scrollTo(0, 0);
  }
  function switchSquad(sq) {
    setPrefSq(sq);
    const v = view();
    if (v.landingOn || v.nidoOn || !getCurrent()) { sync(); return; }
    if (v.sq === sq) return;
    closeProfileIfOpen();
    const tab = TABS[v.idx] || 'resumen';
    openSection(sq);
    if (tab !== 'resumen') _navGoTab(tab, $$('#main-nav button')[TABS.indexOf(tab)]);
    window.scrollTo(0, 0);
  }

  // ── Construcción del shell ──
  function navItem(key, label, icon, extra = '') {
    return `<button class="v3-nav-item" data-nav="${key}">${icon}<span>${label}</span>${extra}</button>`;
  }
  function buildShell() {
    const sb = document.createElement('aside');
    sb.id = 'v3-sidebar';
    sb.innerHTML = `
      <a class="v3-brand" data-nav="home" href="#" aria-label="Inicio">
        <img src="logo-csb.webp" alt="">
        <span class="v3-brand-name">Santa Bárbara<small>ESTADÍSTICAS · 2026</small></span>
      </a>
      <button class="v3-search-btn" data-act="search">${I.search}<span>Buscar…</span><span class="v3-kbd">⌘K</span></button>
      <div class="v3-nav-label">Club</div>
      <div class="v3-nav">
        ${navItem('home', 'Inicio', I.home)}
        ${navItem('nido', 'El Nido', I.nido)}
        ${navItem('h2h', 'Cara a cara', I.h2h, '<span class="v3-new">NUEVO</span>')}
      </div>
      <div class="v3-nav-label">Plantel <span class="v3-sq-tag" id="v3-sb-sqtag" data-sq="a">Primera A</span></div>
      <div class="v3-squad-switch" role="tablist" aria-label="Plantel">
        <button data-sq="a">Primera A</button><button data-sq="b">Primera B</button>
      </div>
      <div class="v3-nav" style="margin-top:10px">
        ${navItem('resumen', 'Resumen', I.resumen)}
        ${navItem('posiciones', 'En Vivo · Torneo', I.vivo)}
        ${navItem('jugadores', 'Estadísticas jugadores', I.jugadores)}
        ${navItem('historial', 'Historial vs Clubes', I.historial)}
        ${navItem('graficos', 'Torneos antiguos', I.torneos)}
      </div>
      <div class="v3-sb-foot">
        <button class="v3-notif-btn" data-act="notif"><span class="v3-notif-ico" id="v3-notif-ico">🔕</span><span id="v3-notif-txt">Activar notificaciones</span></button>
        <div class="v3-updated" id="v3-updated"><span class="v3-dot"></span><span id="v3-updated-txt">Conectando con la planilla…</span></div>
      </div>`;
    document.body.prepend(sb);

    const top = document.createElement('div');
    top.id = 'v3-topbar';
    top.innerHTML = `
      <button class="v3-top-back" data-act="back" aria-label="Volver">${I.back}<span>Volver</span></button>
      <img class="v3-top-crest" src="logo-csb.webp" alt="Inicio" data-nav="home">
      <div class="v3-top-titles"><span class="v3-top-kicker" id="v3-kicker">Club Santa Bárbara</span><span class="v3-top-title" id="v3-title">Inicio</span></div>
      <div class="v3-top-right">
        <span class="v3-top-badge" id="v3-badge"></span>
        <div class="v3-top-sq"><button data-sq="a">A</button><button data-sq="b">B</button></div>
        <button class="v3-icon-btn v3-top-search" data-act="search" aria-label="Buscar">${I.search}</button>
        <button class="v3-icon-btn v3-top-notif" data-act="notif" aria-label="Notificaciones">${I.bell}</button>
      </div>`;
    // El topbar vive arriba de #landing y de #app (los dos son hermanos en
    // body) — se inserta antes del primero de los dos.
    const landing = $('#landing');
    landing.parentNode.insertBefore(top, landing);

    const bn = document.createElement('nav');
    bn.id = 'v3-bottomnav';
    bn.setAttribute('aria-label', 'Navegación principal');
    bn.innerHTML = `
      <button data-nav="home">${I.home}<span>Inicio</span></button>
      <button data-nav="resumen">${I.resumen}<span>Plantel</span></button>
      <button data-nav="posiciones">${I.vivo}<span>En Vivo</span></button>
      <button data-nav="jugadores">${I.jugadores}<span>Jugadores</span></button>
      <button data-nav="more">${I.more}<span>Más</span></button>`;
    document.body.appendChild(bn);

    const more = document.createElement('div');
    more.id = 'v3-more';
    more.innerHTML = `<div class="v3-more-backdrop" data-act="close-more"></div>
      <div class="v3-more-sheet" role="dialog" aria-label="Más secciones">
        <div class="v3-more-grab"></div>
        <div class="v3-more-grid">
          <button class="v3-more-item" data-nav="historial">${I.historial}Historial vs Clubes<small>Récord contra cada rival</small></button>
          <button class="v3-more-item" data-nav="graficos">${I.torneos}Torneos antiguos<small>Campañas desde 2016</small></button>
          <button class="v3-more-item" data-nav="nido">${I.nido}El Nido<small>Todos nuestros jugadores</small></button>
          <button class="v3-more-item" data-nav="h2h">${I.h2h}Cara a cara<small>Compará dos jugadores</small></button>
          <button class="v3-more-item" data-act="search">${I.user}Buscar jugador<small>Ir directo a un perfil</small></button>
          <button class="v3-more-item" data-act="notif">${I.bell}<span id="v3-more-notif">Notificaciones</span><small>Goles y resultados al instante</small></button>
        </div>
      </div>`;
    document.body.appendChild(more);

    document.addEventListener('click', onShellClick);
  }

  function onShellClick(e) {
    const el = e.target.closest('[data-nav],[data-act],[data-sq]');
    if (!el || !el.closest('#v3-sidebar,#v3-topbar,#v3-bottomnav,#v3-more,.v3-home')) return;
    if (el.matches('[data-sq]') && el.closest('.v3-squad-switch,.v3-top-sq')) { switchSquad(el.dataset.sq); return; }
    const nav = el.dataset.nav, act = el.dataset.act;
    if (nav) {
      e.preventDefault();
      if (nav === 'home') goHome();
      else if (nav === 'nido') goNido();
      else if (nav === 'h2h') { closeMore(); openH2H(); }
      else if (nav === 'more') toggleMore();
      else goTab(nav, el.dataset.sqTarget);
      return;
    }
    if (act === 'search') { closeMore(); openSearch(); }
    else if (act === 'notif') { closeMore(); if (window._togglePush) window._togglePush(); setTimeout(syncNotif, 400); }
    else if (act === 'close-more') closeMore();
    else if (act === 'back') {
      const v = view();
      if (v.profileOn && g('_ppVolver')) _ppVolver();
      else if (g('volverAtras')) volverAtras();
    }
  }
  function toggleMore() { $('#v3-more').classList.toggle('open'); }
  function closeMore() { const m = $('#v3-more'); if (m) m.classList.remove('open'); }

  // ── Sincronización del shell con el estado real de la app ──
  let syncQueued = false;
  function queueSync() { if (syncQueued) return; syncQueued = true; requestAnimationFrame(() => { syncQueued = false; sync(); }); }
  function sync() {
    if (!$('#v3-kicker') || !$('#v3-title')) return;
    const v = view();
    let active = 'home', kicker = 'Club Santa Bárbara', title = 'Inicio';
    const sqLabel = v.sq === 'b' ? 'Primera B' : 'Primera A';
    if (v.profileOn) { active = null; kicker = 'El Nido'; title = 'Perfil de jugador'; }
    else if (v.landingOn) { active = 'home'; }
    else if (v.nidoOn) { active = 'nido'; kicker = 'Nuestros jugadores'; title = 'El Nido'; }
    else if (v.idx >= 0) { active = TABS[v.idx]; kicker = sqLabel; title = TAB_TITLES[v.idx]; }
    $$('#v3-sidebar [data-nav], #v3-bottomnav [data-nav], #v3-more [data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === active));
    const bnMore = $('#v3-bottomnav [data-nav="more"]');
    if (bnMore && ['historial', 'graficos', 'nido'].includes(active)) bnMore.classList.add('active');
    $('#v3-kicker').textContent = kicker;
    $('#v3-title').textContent = title;
    document.title = v.landingOn ? 'Club Santa Bárbara' : `${title} · Club Santa Bárbara`;
    const showSq = v.landingOn || v.nidoOn ? prefSq : v.sq;
    $$('.v3-squad-switch button, .v3-top-sq button').forEach(b => b.classList.toggle('active', b.dataset.sq === showSq));
    const tag = $('#v3-sb-sqtag');
    if (tag) { tag.dataset.sq = showSq; tag.textContent = showSq === 'b' ? 'Primera B' : 'Primera A'; }
    const oldBadge = $('#section-badge');
    const badgeEl = $('#v3-badge'); if (badgeEl) badgeEl.textContent = (!v.landingOn && oldBadge && oldBadge.style.display !== 'none') ? oldBadge.textContent.trim() : '';
    const backEl = $('.v3-top-back'); if (backEl) backEl.classList.toggle('show', !v.landingOn && (getNavStackLen() > 0 || v.profileOn));
    // Selector A/B del topbar mobile: solo tiene sentido dentro de un plantel
    const topSq = $('.v3-top-sq');
    if (topSq) topSq.style.display = (v.landingOn || v.nidoOn || v.profileOn) ? 'none' : '';
    document.body.classList.toggle('v3-on-home', v.landingOn);
    document.body.classList.toggle('v3-profile', v.profileOn);
    if (v.landingOn) renderHeroStats();
  }

  function syncNotif() {
    const on = !!$('#header-notif-btn.header-notif-on') || /🔔/.test(($('#header-notif-btn') || {}).textContent || '');
    const ico = $('#v3-notif-ico'), txt = $('#v3-notif-txt'), mtxt = $('#v3-more-notif');
    if (ico) ico.textContent = on ? '🔔' : '🔕';
    if (txt) txt.textContent = on ? 'Notificaciones activadas' : 'Activar notificaciones';
    if (mtxt) mtxt.textContent = on ? 'Notificaciones activadas' : 'Activar notificaciones';
  }
  function syncUpdated() {
    const st = $('#refresh-status'), tm = $('#refresh-time'), box = $('#v3-updated'), txt = $('#v3-updated-txt');
    if (!box || !txt) return;
    box.classList.toggle('loading', !!st && st.classList.contains('loading'));
    box.classList.toggle('error', !!st && st.classList.contains('error'));
    const t = (tm && tm.textContent.trim()) || '';
    const errTxt = st && st.classList.contains('error') ? st.textContent.trim() : '';
    txt.textContent = errTxt || t || 'Conectando con la planilla…';
  }

  // Envuelve las funciones de navegación originales: llaman a la original
  // tal cual y después re-sincronizan el shell.
  function wrapNav() {
    ['openSection', 'goBack', 'showTab', 'showTorneo', 'showHistoricoTorneo', 'showJugSub', 'goToPlayer',
      'closePlayerProfile', 'volverAtras', '_navPush', '_updateBackBtnVisibility', 'renderPlayerProfile', 'goToMatchFecha',
      'renderLandingCardStats'].forEach(name => {
      const orig = window[name];
      if (typeof orig !== 'function' || orig.__v3) return;
      const wrapped = function () { const r = orig.apply(this, arguments); queueSync(); return r; };
      wrapped.__v3 = true;
      window[name] = wrapped;
    });
    window.addEventListener('popstate', () => setTimeout(queueSync, 0));
    const mo = new MutationObserver(queueSync);
    ['#landing', '#app', '#tab-nido', '#section-badge'].forEach(s => { const el = $(s); if (el) mo.observe(el, { attributes: true, attributeFilter: ['style', 'class'] }); });
    const mn = $('#main-nav'); if (mn) mo.observe(mn, { attributes: true, subtree: true, attributeFilter: ['class'] });
    const sb = $('#section-badge'); if (sb) mo.observe(sb, { childList: true, characterData: true, subtree: true });
    // El overlay del perfil se crea recién la primera vez que se abre uno.
    const bodyMo = new MutationObserver(() => {
      const ov = $('#player-profile-overlay');
      if (ov && !ov.__v3) { ov.__v3 = true; mo.observe(ov, { attributes: true, attributeFilter: ['style'] }); queueSync(); }
    });
    bodyMo.observe(document.body, { childList: true });
    const upMo = new MutationObserver(syncUpdated);
    ['#refresh-status', '#refresh-time'].forEach(s => { const el = $(s); if (el) upMo.observe(el, { attributes: true, childList: true, characterData: true, subtree: true }); });
    const nb = $('#header-notif-btn');
    if (nb) new MutationObserver(syncNotif).observe(nb, { attributes: true, childList: true, characterData: true, subtree: true });
  }

  // ════════════════ HOME ════════════════
  const PITCH_SVG = `<svg class="v3-hero-lines" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#c8ffe0" stroke-width="2">
    <rect x="20" y="20" width="1160" height="260" rx="4"/><line x1="600" y1="20" x2="600" y2="280"/><circle cx="600" cy="150" r="62"/><circle cx="600" cy="150" r="4" fill="#c8ffe0"/>
    <rect x="20" y="70" width="150" height="160"/><rect x="20" y="110" width="56" height="80"/><path d="M170 112a48 48 0 0 1 0 76"/>
    <rect x="1030" y="70" width="150" height="160"/><rect x="1124" y="110" width="56" height="80"/><path d="M1030 112a48 48 0 0 0 0 76"/></svg>`;

  function buildHome() {
    const landing = $('#landing');
    if (!landing || $('.v3-home', landing)) return;
    const home = document.createElement('div');
    home.className = 'v3-home';

    const hero = document.createElement('section');
    hero.className = 'v3-hero';
    hero.innerHTML = PITCH_SVG;
    const logo = $('.landing-logo', landing);
    const textCol = document.createElement('div');
    ['.landing-title', '.landing-sub', '#landing-sub-meta'].forEach(s => { const el = $(s, landing); if (el) textCol.appendChild(el); });
    if (logo) hero.appendChild(logo);
    hero.appendChild(textCol);
    const stats = document.createElement('div');
    stats.className = 'v3-hero-stats';
    stats.id = 'v3-hero-stats';
    hero.appendChild(stats);
    home.appendChild(hero);

    const matches = document.createElement('section');
    matches.innerHTML = `<div class="v3-sec-head"><span class="v3-sec-title" id="v3-matches-title">Próximos partidos</span><span class="v3-sec-sub">Tocá un partido para ver la ficha</span></div>`;
    const row = $('.next-match-row', landing), car = $('.pm-carousel-wrap', landing);
    if (row) matches.appendChild(row);
    if (car) matches.appendChild(car);
    home.appendChild(matches);
    // Reusa el texto "Partidos en vivo"/"Próximos partidos" que ya calcula renderLandingNextMatch
    const lbl = $('#pm-carousel-label');
    if (lbl) new MutationObserver(() => { $('#v3-matches-title').textContent = lbl.textContent || 'Próximos partidos'; }).observe(lbl, { childList: true, characterData: true, subtree: true });

    const squads = document.createElement('section');
    squads.innerHTML = `<div class="v3-sec-head"><span class="v3-sec-title">Planteles</span><span class="v3-sec-sub">Clausura AIFA 2026</span></div>`;
    const cards = $('.landing-cards', landing);
    if (cards) squads.appendChild(cards);
    home.appendChild(squads);

    const extra = document.createElement('section');
    extra.className = 'v3-grid-2';
    extra.innerHTML = `
      <div class="v3-card" id="v3-leaders">
        <div class="v3-sec-head"><span class="v3-sec-title">Líderes históricos</span><span class="v3-sec-sub">Primera A + Primera B, toda la historia</span><button class="v3-sec-link" data-nav="nido">Ver El Nido ›</button></div>
        <div class="v3-tabs" id="v3-leader-tabs"></div>
        <div id="v3-leader-list"><div class="v3-skel"></div><div class="v3-skel"></div><div class="v3-skel"></div></div>
      </div>
      <div class="v3-card v3-h2h-teaser">
        <div class="v3-sec-head" style="margin:0"><span class="v3-sec-title">Cara a cara</span></div>
        <p>Elegí dos jugadores del club y comparalos estadística por estadística: partidos, goles, asistencias, títulos, vallas invictas y promedios.</p>
        <div><button class="v3-btn" data-nav="h2h">${I.h2h.replace('<svg', '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')} Comparar jugadores</button></div>
        <div class="v3-quick">
          <button data-act="search">${I.search.replace(' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"', '')}<span>Buscar jugador<small>Ir directo a su perfil</small></span></button>
          <button data-nav="historial">${I.historial}<span>vs Clubes<small>Récord contra cada rival</small></span></button>
          <button data-nav="graficos">${I.torneos}<span>Torneos<small>Todas las campañas</small></span></button>
          <button data-nav="posiciones">${I.vivo}<span>En Vivo<small>Fecha a fecha</small></span></button>
        </div>
      </div>`;
    home.appendChild(extra);

    landing.appendChild(home);
    renderHeroStats();
    initLeaders();
  }

  function ownRow(k) {
    const d = getData(k);
    return d && Array.isArray(d.tabla) ? d.tabla.find(t => t.csb) : null;
  }
  function renderHeroStats() {
    const box = $('#v3-hero-stats');
    if (!box) return;
    const items = [];
    ['a', 'b'].forEach(k => {
      const own = ownRow(k);
      const pos = own ? String(own.pos).replace(/[°º]/g, '') : '–';
      items.push(`<div class="v3-hero-stat" data-nav="resumen" data-sq-target="${k}">
        <div class="v3-hero-stat-lbl">Primera ${k.toUpperCase()}</div>
        <div class="v3-hero-stat-val">${esc(pos)}<small style="margin-left:1px">º</small></div>
        <div class="v3-hero-stat-sub">${own ? `${esc(own.pts)} pts · ${esc(own.pj != null ? own.pj + ' PJ' : 'Clausura')}` : 'Cargando…'}</div></div>`);
    });
    const tit = ((getData('a') || {}).titulos || []).length + ((getData('b') || {}).titulos || []).length;
    items.push(`<div class="v3-hero-stat" data-nav="resumen"><div class="v3-hero-stat-lbl">Títulos</div><div class="v3-hero-stat-val">${tit || '–'}</div><div class="v3-hero-stat-sub">Primera A + B</div></div>`);
    const html = items.join('');
    if (box.__last !== html) { box.innerHTML = html; box.__last = html; }
  }

  // ── Líderes históricos (datos de El Nido) ──
  const LEADER_METRICS = [
    { key: 'goles', label: 'Goles' },
    { key: 'asist', label: 'Asistencias' },
    { key: 'gmas', label: 'G+A' },
    { key: 'pj', label: 'Partidos' },
    { key: 'titulos', label: 'Títulos' },
    { key: 'vallas', label: 'Vallas invictas' },
  ];
  let leaderKey = 'goles';
  function nidoList() { const l = safe(() => window._nidoGetMerged && window._nidoGetMerged()); return Array.isArray(l) ? l : null; }
  let nidoPromise = null;
  function ensureNido() {
    if (nidoList() && nidoList().length) return Promise.resolve(nidoList());
    if (!nidoPromise) {
      nidoPromise = (window._nidoEnsureLoaded ? Promise.resolve(window._nidoEnsureLoaded()) : Promise.resolve())
        .catch(() => {}).then(() => { nidoPromise = null; return nidoList() || []; });
    }
    return nidoPromise;
  }
  function initLeaders() {
    const tabs = $('#v3-leader-tabs');
    tabs.innerHTML = LEADER_METRICS.map(m => `<button class="v3-tab${m.key === leaderKey ? ' active' : ''}" data-lk="${m.key}">${m.label}</button>`).join('');
    tabs.addEventListener('click', e => {
      const b = e.target.closest('[data-lk]'); if (!b) return;
      leaderKey = b.dataset.lk;
      $$('.v3-tab', tabs).forEach(t => t.classList.toggle('active', t === b));
      renderLeaders();
    });
    $('#v3-leader-list').addEventListener('click', e => {
      const r = e.target.closest('[data-player]'); if (r) openPlayer(r.dataset.player);
    });
    // Espera a que el motor termine su carga inicial antes de pedir El Nido
    setTimeout(() => ensureNido().then(renderLeaders), 1800);
  }
  function renderLeaders() {
    const list = nidoList();
    const box = $('#v3-leader-list');
    if (!box) return;
    if (!list || !list.length) { box.innerHTML = '<div class="v3-empty">Todavía no llegaron los datos de El Nido. Probá de nuevo en un momento.</div>'; return; }
    const top = [...list].filter(p => (p[leaderKey] || 0) > 0).sort((a, b) => (b[leaderKey] || 0) - (a[leaderKey] || 0) || (a.pj || 0) - (b.pj || 0)).slice(0, 5);
    const max = top.length ? top[0][leaderKey] : 1;
    box.innerHTML = top.map((p, i) => `
      <div class="v3-leader" data-player="${esc(p.nombre)}" role="button" tabindex="0">
        <span class="v3-rank">${i + 1}</span>
        <span class="v3-avatar">${esc(initials(p.nombre))}</span>
        <div style="min-width:0">
          <div class="v3-leader-name">${esc(p.nombre)}</div>
          <div class="v3-leader-meta">${p.pos ? `<span class="v3-pos">${esc(p.pos)}</span>` : ''}<span>${p.pj || 0} PJ</span>${(p.teams || []).map(t => `<span class="v3-sq-tag" data-sq="${t}">${t.toUpperCase()}</span>`).join('')}</div>
          <div class="v3-bar"><i style="width:${Math.max(6, Math.round((p[leaderKey] / max) * 100))}%"></i></div>
        </div>
        <span class="v3-leader-val">${p[leaderKey]}</span>
      </div>`).join('') || '<div class="v3-empty">Sin datos para este ranking.</div>';
  }
  function openPlayer(nombre) {
    closeSearch(); closeH2H(); closeMore();
    if (g('goToPlayer')) goToPlayer(nombre);
  }

  // ════════════════ BUSCADOR ════════════════
  const SECTIONS = [
    { label: 'Inicio', sub: 'Página principal del club', icon: I.home, run: () => goHome() },
    { label: 'El Nido', sub: 'Base de datos de todos los jugadores', icon: I.nido, run: () => goNido() },
    { label: 'Cara a cara', sub: 'Comparar dos jugadores', icon: I.h2h, run: () => openH2H() },
  ];
  ['a', 'b'].forEach(k => {
    const L = 'Primera ' + k.toUpperCase();
    SECTIONS.push(
      { label: `Resumen · ${L}`, sub: 'Posición, forma y destacados', icon: I.resumen, run: () => goTab('resumen', k) },
      { label: `En Vivo · ${L}`, sub: 'Torneo en curso, tabla y fecha a fecha', icon: I.vivo, run: () => goTab('posiciones', k) },
      { label: `Estadísticas jugadores · ${L}`, sub: 'Totales, anuales, debuts e inferiores', icon: I.jugadores, run: () => goTab('jugadores', k) },
      { label: `Historial vs Clubes · ${L}`, sub: 'Récord contra cada rival', icon: I.historial, run: () => goTab('historial', k) },
      { label: `Torneos antiguos · ${L}`, sub: 'Campañas anteriores y copas', icon: I.torneos, run: () => goTab('graficos', k) },
    );
  });
  let srItems = [], srSel = 0;
  function buildSearch() {
    const el = document.createElement('div');
    el.id = 'v3-search';
    el.innerHTML = `<div class="v3-modal-backdrop" data-close></div>
      <div class="v3-search-box" role="dialog" aria-label="Buscar">
        <div class="v3-search-input-row">${I.search}<input id="v3-search-input" type="search" placeholder="Buscá un jugador, un plantel o una sección…" autocomplete="off" spellcheck="false"><button class="v3-icon-btn" data-close aria-label="Cerrar" style="width:32px;height:32px">${I.close}</button></div>
        <div class="v3-search-results" id="v3-search-results"></div>
        <div class="v3-search-foot"><span>↑↓ moverse</span><span>Enter abrir</span><span>Esc cerrar</span></div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { closeSearch(); return; }
      const it = e.target.closest('[data-sr]'); if (it) runSr(+it.dataset.sr);
    });
    const inp = $('#v3-search-input');
    inp.addEventListener('input', renderSearch);
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); srSel = Math.min(srItems.length - 1, srSel + 1); paintSel(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); srSel = Math.max(0, srSel - 1); paintSel(); }
      else if (e.key === 'Enter') { e.preventDefault(); runSr(srSel); }
      else if (e.key === 'Escape') closeSearch();
    });
    document.addEventListener('keydown', e => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); openSearch(); }
      else if (e.key === 'Escape') { closeSearch(); closeH2H(); closeMore(); }
    });
  }
  function openSearch() {
    const el = $('#v3-search'); el.classList.add('open');
    const inp = $('#v3-search-input'); inp.value = ''; renderSearch();
    setTimeout(() => inp.focus(), 30);
    ensureNido().then(() => { if (el.classList.contains('open')) renderSearch(); });
  }
  function closeSearch() { const el = $('#v3-search'); if (el) el.classList.remove('open'); }
  function renderSearch() {
    const q = norm($('#v3-search-input').value);
    const players = nidoList() || [];
    let pl = [];
    if (q) {
      pl = players.map(p => {
        const n = norm(p.nombre);
        const score = n.startsWith(q) ? 0 : n.split(/\s+/).some(w => w.startsWith(q)) ? 1 : n.includes(q) ? 2 : 9;
        return { p, score };
      }).filter(x => x.score < 9).sort((a, b) => a.score - b.score || (b.p.pj || 0) - (a.p.pj || 0)).slice(0, 8).map(x => x.p);
    } else {
      pl = [...players].sort((a, b) => (b.pj || 0) - (a.pj || 0)).slice(0, 5);
    }
    const secs = SECTIONS.filter(s => !q || norm(s.label + ' ' + s.sub).includes(q)).slice(0, q ? 6 : 4);
    srItems = [...pl.map(p => ({ type: 'p', p })), ...secs.map(s => ({ type: 's', s }))];
    srSel = 0;
    let html = '', i = 0;
    if (pl.length) {
      html += `<div class="v3-sr-group">${q ? 'Jugadores' : 'Más partidos en el club'}</div>`;
      html += pl.map(p => `<div class="v3-sr-item" data-sr="${i++}"><span class="v3-avatar">${esc(initials(p.nombre))}</span>
        <div class="v3-sr-main"><div class="v3-sr-name">${esc(p.nombre)}</div><div class="v3-sr-sub">${esc(p.pos || 'Jugador')} · ${(p.teams || []).map(t => 'Primera ' + t.toUpperCase()).join(' y ')}</div></div>
        <div class="v3-sr-stats"><span><b>${p.pj || 0}</b>PJ</span><span><b>${p.goles || 0}</b>G</span><span><b>${p.asist || 0}</b>A</span></div></div>`).join('');
    } else if (q && !players.length) {
      html += '<div class="v3-sr-group">Jugadores</div><div class="v3-empty">Cargando la base de jugadores…</div>';
    }
    if (secs.length) {
      html += '<div class="v3-sr-group">Secciones</div>';
      html += secs.map(s => `<div class="v3-sr-item" data-sr="${i++}"><span class="v3-sr-ico">${s.icon}</span><div class="v3-sr-main"><div class="v3-sr-name">${esc(s.label)}</div><div class="v3-sr-sub">${esc(s.sub)}</div></div></div>`).join('');
    }
    if (!html) html = '<div class="v3-empty">No encontramos nada con esa búsqueda.</div>';
    $('#v3-search-results').innerHTML = html;
    paintSel();
  }
  function paintSel() { $$('#v3-search-results [data-sr]').forEach(el => el.classList.toggle('sel', +el.dataset.sr === srSel)); const s = $(`#v3-search-results [data-sr="${srSel}"]`); if (s) s.scrollIntoView({ block: 'nearest' }); }
  function runSr(i) {
    const it = srItems[i]; if (!it) return;
    closeSearch();
    if (it.type === 'p') openPlayer(it.p.nombre); else it.s.run();
  }

  // ════════════════ CARA A CARA ════════════════
  const H2H_ROWS = [
    { key: 'pj', label: 'Partidos' },
    { key: 'titular', label: 'Titular' },
    { key: 'goles', label: 'Goles' },
    { key: 'asist', label: 'Asistencias' },
    { key: 'gmas', label: 'G + A' },
    { key: 'promGol', label: 'Prom. gol', f: 2 },
    { key: 'promAsist', label: 'Prom. asist.', f: 2 },
    { key: 'promGmas', label: 'Prom. G+A', f: 2 },
    { key: 'titulos', label: 'Títulos' },
    { key: 'vallas', label: 'Vallas inv.' },
    { key: 'rojas', label: 'Rojas', low: true },
  ];
  const h2h = { l: null, r: null };
  function buildH2H() {
    const el = document.createElement('div');
    el.id = 'v3-h2h';
    el.innerHTML = `<div class="v3-modal-backdrop" data-close></div>
      <div class="v3-h2h-box" role="dialog" aria-label="Cara a cara">
        <div class="v3-h2h-head"><span style="color:var(--v3-brand);display:inline-flex">${I.h2h.replace('<svg', '<svg width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')}</span><h3>Cara a cara</h3><button class="v3-icon-btn" data-close aria-label="Cerrar">${I.close}</button></div>
        <div class="v3-h2h-pickers">
          <div class="v3-h2h-pick" data-side="l"><label>Jugador 1</label><input placeholder="Escribí un nombre…" autocomplete="off"><div class="v3-h2h-sugg"></div></div>
          <div class="v3-h2h-vs">VS</div>
          <div class="v3-h2h-pick" data-side="r"><label>Jugador 2</label><input placeholder="Escribí un nombre…" autocomplete="off"><div class="v3-h2h-sugg"></div></div>
        </div>
        <div id="v3-h2h-body"></div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { closeH2H(); return; }
      const s = e.target.closest('[data-pick]');
      if (s) { const side = s.closest('.v3-h2h-pick').dataset.side; pickH2H(side, s.dataset.pick); return; }
      const c = e.target.closest('[data-player]'); if (c) openPlayer(c.dataset.player);
      if (!e.target.closest('.v3-h2h-pick')) $$('.v3-h2h-sugg', el).forEach(x => x.classList.remove('open'));
    });
    $$('.v3-h2h-pick input', el).forEach(inp => {
      inp.addEventListener('input', () => suggest(inp));
      inp.addEventListener('focus', () => suggest(inp));
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { const f = $('.v3-h2h-sugg [data-pick]', inp.parentNode); if (f) pickH2H(inp.parentNode.dataset.side, f.dataset.pick); }
      });
    });
  }
  function suggest(inp) {
    const box = $('.v3-h2h-sugg', inp.parentNode);
    const q = norm(inp.value);
    const list = (nidoList() || []).filter(p => !q || norm(p.nombre).includes(q)).sort((a, b) => (b.pj || 0) - (a.pj || 0)).slice(0, 8);
    box.innerHTML = list.length ? list.map(p => `<div data-pick="${esc(p.nombre)}">${esc(p.nombre)}<span>${esc(p.pos || '')} · ${p.pj || 0} PJ</span></div>`).join('') : '<div style="cursor:default;color:var(--v3-muted)">Sin resultados</div>';
    box.classList.add('open');
  }
  function findPlayer(n) { return (nidoList() || []).find(p => norm(p.nombre) === norm(n)) || null; }
  function pickH2H(side, nombre) {
    h2h[side] = findPlayer(nombre);
    const pick = $(`#v3-h2h .v3-h2h-pick[data-side="${side}"]`);
    $('input', pick).value = nombre;
    $('.v3-h2h-sugg', pick).classList.remove('open');
    renderH2H();
  }
  function openH2H() {
    closeSearch();
    $('#v3-h2h').classList.add('open');
    renderH2H();
    ensureNido().then(list => {
      if (!h2h.l && !h2h.r && list.length) {
        const byG = [...list].sort((a, b) => (b.goles || 0) - (a.goles || 0));
        if (byG[0]) pickH2H('l', byG[0].nombre);
        if (byG[1]) pickH2H('r', byG[1].nombre);
      } else renderH2H();
    });
  }
  // Abre Cara a cara con un jugador ya elegido (botón ⇄ de El Nido)
  function compareWith(nombre) {
    closeSearch();
    $('#v3-h2h').classList.add('open');
    ensureNido().then(list => {
      pickH2H('l', nombre);
      if (!h2h.r || norm(h2h.r.nombre) === norm(nombre)) {
        const other = [...list].sort((a, b) => (b.pj || 0) - (a.pj || 0)).find(p => norm(p.nombre) !== norm(nombre));
        if (other) pickH2H('r', other.nombre);
      }
      const inp = $('#v3-h2h .v3-h2h-pick[data-side="r"] input');
      if (inp && window.matchMedia('(min-width: 641px)').matches) { inp.select(); inp.focus(); }
    });
  }
  function closeH2H() { const el = $('#v3-h2h'); if (el) el.classList.remove('open'); }
  function fmtN(v, f) { const n = Number(v) || 0; return f ? n.toFixed(f).replace('.', ',') : String(n); }
  function renderH2H() {
    const body = $('#v3-h2h-body');
    if (!body) return;
    const L = h2h.l, R = h2h.r;
    if (!nidoList()) { body.innerHTML = '<div class="v3-h2h-rows"><div class="v3-skel"></div><div class="v3-skel"></div><div class="v3-skel"></div></div>'; return; }
    if (!L || !R) { body.innerHTML = '<div class="v3-h2h-rows"><div class="v3-empty">Elegí dos jugadores para compararlos.</div></div>'; return; }
    const card = (p, side) => `<div class="v3-h2h-card" data-side="${side}" data-player="${esc(p.nombre)}" title="Ver perfil">
      <span class="v3-avatar">${esc(initials(p.nombre))}</span>
      <div><div class="v3-h2h-card-name">${esc(p.nombre)}</div><div class="v3-h2h-card-sub">${esc(p.pos || 'Jugador')} · ${(p.teams || []).map(t => 'Primera ' + t.toUpperCase()).join(' y ')}</div></div></div>`;
    let wl = 0, wr = 0;
    const rows = H2H_ROWS.map(m => {
      const a = Number(L[m.key]) || 0, b = Number(R[m.key]) || 0, max = Math.max(a, b) || 1;
      const lw = m.low ? a < b : a > b, rw = m.low ? b < a : b > a;
      if (lw) wl++; if (rw) wr++;
      return `<div class="v3-h2h-row">
        <span class="v3-h2h-val l${lw ? ' win' : ''}">${fmtN(a, m.f)}</span>
        <div class="v3-h2h-track l"><i style="width:${Math.round((a / max) * 100)}%"></i></div>
        <span class="v3-h2h-lbl">${m.label}</span>
        <div class="v3-h2h-track r"><i style="width:${Math.round((b / max) * 100)}%"></i></div>
        <span class="v3-h2h-val r${rw ? ' win' : ''}">${fmtN(b, m.f)}</span></div>`;
    }).join('');
    const verdict = wl === wr ? `Empate técnico: <b>${wl}</b> rubros para cada uno.`
      : `<b>${esc(wl > wr ? L.nombre : R.nombre)}</b> gana en ${Math.max(wl, wr)} de ${H2H_ROWS.length} rubros (contra ${Math.min(wl, wr)}).`;
    body.innerHTML = `<div class="v3-h2h-cards">${card(L, 'l')}${card(R, 'r')}</div><div class="v3-h2h-rows">${rows}</div><div class="v3-h2h-verdict">${verdict} <span style="color:var(--v3-muted)">Totales de carrera en el club (Primera A + B). Tocá un jugador para ver su perfil completo.</span></div>`;
  }

  // ════════════════ ARRANQUE ════════════════
  function boot() {
    if (!$('#landing') || !$('#app')) return;
    buildShell();
    buildHome();
    buildSearch();
    buildH2H();
    wrapNav();
    sync(); syncNotif(); syncUpdated();
    // Las cifras del hero dependen de la tabla en vivo — se refrescan cuando llega.
    let tries = 0;
    const iv = setInterval(() => { renderHeroStats(); if (++tries > 40 || (ownRow('a') && ownRow('b'))) clearInterval(iv); }, 1500);
    window.v3 = { openSearch, openH2H, compareWith, goTab, goHome, goNido, switchSquad, sync };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
