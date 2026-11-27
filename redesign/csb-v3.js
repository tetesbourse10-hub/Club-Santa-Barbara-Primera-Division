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
  const TAB_TITLES_M = ['Equipo', 'En Vivo', 'Estadísticas', 'vs Clubes', 'Torneos'];

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
        ${navItem('graficos', 'Todos los torneos', I.torneos)}
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
      <button data-nav="resumen">${I.resumen}<span>Equipo</span></button>
      <button data-nav="posiciones">${I.vivo}<span>En Vivo</span></button>
      <button data-nav="jugadores" data-cat="jug">${I.jugadores}<span>Jugadores</span></button>
      <button data-nav="graficos" data-cat="hist">${I.torneos}<span>Historia</span></button>`;
    document.body.appendChild(bn);

    // Barra de categoría (solo celular): sub-secciones de Jugadores e Historia
    const cat = document.createElement('div');
    cat.id = 'v3-catbar';
    cat.innerHTML = `<div class="v3-cat" data-cat="jug">
        <button data-nav="nido">${I.nido}<span>El Nido</span></button>
        <button data-nav="jugadores">${I.jugadores}<span>Estadísticas</span></button>
        <button data-nav="h2h">${I.h2h}<span>Cara a cara</span></button>
      </div>
      <div class="v3-cat" data-cat="hist">
        <button data-nav="graficos">${I.torneos}<span>Torneos</span></button>
        <button data-nav="historial">${I.historial}<span>vs Clubes</span></button>
        <button data-act="titles"><span class="v3-cat-emo">🏆</span><span>Títulos</span></button>
      </div>`;
    const tb = $('#v3-topbar');
    if (tb) tb.after(cat); else document.body.appendChild(cat);

    const more = document.createElement('div');
    more.id = 'v3-more';
    more.innerHTML = `<div class="v3-more-backdrop" data-act="close-more"></div>
      <div class="v3-more-sheet" role="dialog" aria-label="Más secciones">
        <div class="v3-more-grab"></div>
        <div class="v3-more-grid">
          <button class="v3-more-item" data-nav="historial">${I.historial}Historial vs Clubes<small>Récord contra cada rival</small></button>
          <button class="v3-more-item" data-nav="graficos">${I.torneos}Todos los torneos<small>Actual y anteriores</small></button>
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
    if (!el || !el.closest('#v3-sidebar,#v3-topbar,#v3-bottomnav,#v3-more,.v3-home,#v3-mhome,#v3-catbar')) return;
    if (el.matches('[data-sq]') && el.closest('.v3-squad-switch,.v3-top-sq')) { switchSquad(el.dataset.sq); return; }
    const nav = el.dataset.nav, act = el.dataset.act;
    if (nav) {
      e.preventDefault();
      if (nav === 'home') goHome();
      else if (nav === 'nido') goNido();
      else if (nav === 'h2h') { closeMore(); openH2H(el.dataset.h2hMode); }
      else if (nav === 'more') toggleMore();
      else goTab(nav, el.dataset.sqTarget);
      return;
    }
    if (act === 'titles') { openTitles(); return; }
    if (act === 'close-titles') { closeTitles(); return; }
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
    safe(animateView);
    const v = view();
    let active = 'home', kicker = 'Club · Temporada 2026', title = 'Santa Bárbara';
    const sqLabel = v.sq === 'b' ? 'Primera B' : 'Primera A';
    if (v.profileOn) { active = null; kicker = 'El Nido'; title = 'Perfil de jugador'; }
    else if (v.landingOn) { active = 'home'; }
    else if (v.nidoOn) { active = 'nido'; kicker = 'Jugadores'; title = 'El Nido'; }
    else if (v.idx >= 0) { active = TABS[v.idx]; kicker = (v.idx === 2 ? 'Jugadores · ' : v.idx >= 3 ? 'Historia · ' : '') + sqLabel; title = (window.matchMedia('(max-width: 768px)').matches ? TAB_TITLES_M : TAB_TITLES)[v.idx]; }
    $$('#v3-sidebar [data-nav], #v3-bottomnav [data-nav], #v3-more [data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === active));
    const catKey = ['nido', 'jugadores'].includes(active) ? 'jug' : ['graficos', 'historial'].includes(active) ? 'hist' : '';
    $$('#v3-bottomnav [data-cat]').forEach(b => b.classList.toggle('active', b.dataset.cat === catKey));
    $$('#v3-catbar .v3-cat').forEach(c => c.classList.toggle('on', c.dataset.cat === catKey));
    $$('#v3-catbar [data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === active));
    document.body.classList.toggle('v3-catbar-on', !!catKey && !v.profileOn);
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

    const champ = document.createElement('section');
    champ.id = 'v3-champ';
    home.appendChild(champ);

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

    const nums = document.createElement('section');
    nums.innerHTML = `<div class="v3-sec-head"><span class="v3-sec-title">El club en números</span><span class="v3-sec-sub">Todos los torneos oficiales, Primera A y Primera B</span><button class="v3-sec-link" data-nav="graficos">Ver todos los torneos ›</button></div><div id="v3-club-nums"></div>`;
    home.appendChild(nums);

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
        <p>Compará estadística por estadística: dos jugadores, un mismo jugador en dos temporadas o torneos, o dos campañas del equipo.</p>
        <div class="v3-h2h-modes-teaser">
          <button data-nav="h2h" data-h2h-mode="pp">${I.h2h}<span>Jugador vs jugador<small>Carrera, temporada o torneo</small></span></button>
          <button data-nav="h2h" data-h2h-mode="self">${I.jugadores}<span>Un jugador, dos épocas<small>Por ejemplo 2024 vs 2026</small></span></button>
          <button data-nav="h2h" data-h2h-mode="team">${I.torneos}<span>Equipo vs equipo<small>Cualquier torneo de la A o la B</small></span></button>
        </div>
        <div class="v3-quick-h">Accesos rápidos</div>
        <div class="v3-quick">
          <button data-act="search">${I.search.replace(' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"', '')}<span>Buscar jugador<small>Ir directo a su perfil</small></span></button>
          <button data-nav="historial">${I.historial}<span>vs Clubes<small>Récord contra cada rival</small></span></button>
          <button data-nav="graficos">${I.torneos}<span>Todos los torneos<small>Actual y anteriores</small></span></button>
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
      const d = getData(k);
      const est = own && g('_csbEstadoTorneo') ? safe(() => _csbEstadoTorneo(d.tabla)) : null;
      const tag = est && est.estado === 'campeon' ? '<span class="v3-hs-tag gold">Campeón</span>' : est && est.estado === 'descendido' ? '<span class="v3-hs-tag red">Descendido</span>' : '';
      items.push(`<div class="v3-hero-stat${est && est.estado === 'campeon' ? ' is-champ' : ''}" data-nav="resumen" data-sq-target="${k}">
        <div class="v3-hero-stat-lbl">Primera ${k.toUpperCase()}</div>
        <div class="v3-hero-stat-val">${esc(pos)}<small style="margin-left:1px">º</small></div>
        <div class="v3-hero-stat-sub">${own ? `${esc(own.pts)} pts · ${esc(own.pj != null ? own.pj + ' PJ' : 'Clausura')}` : 'Cargando…'}</div>${tag}</div>`);
    });
    const tit = ((getData('a') || {}).titulos || []).length + ((getData('b') || {}).titulos || []).length;
    items.push(`<div class="v3-hero-stat" data-act="titles" role="button" tabindex="0"><div class="v3-hero-stat-lbl">Títulos</div><div class="v3-hero-stat-val">${tit || '–'}</div><div class="v3-hero-stat-sub">Primera A + B</div></div>`);
    const html = items.join('');
    if (box.__last !== html) { box.innerHTML = html; box.__last = html; }
    renderChamp();
    renderClubNums();
    safe(renderMHome);
  }

  // ── Cartel de títulos (Primera A + Primera B) ──
  function openTitles() {
    closeTitles();
    const block = k => {
      const d = getData(k) || {};
      const list = [...(d.titulos || [])].sort((a, b) => String(b.anio).localeCompare(String(a.anio)));
      return `<div class="v3-tt-sq"><div class="v3-tt-sq-h"><span class="lc-crest sm"><img src="logo-csb.webp" alt=""><b>${k.toUpperCase()}</b></span><b>Primera ${k.toUpperCase()}</b><small>${list.length} título${list.length !== 1 ? 's' : ''}</small></div>
        ${list.length ? list.map(t => `<div class="v3-tt-row"><span class="v3-tt-cup">🏆</span><span class="v3-tt-n">${esc(String(t.nombre || '').replace(/^Campe[oó]n\s+/i, ''))}</span><span class="v3-tt-y">${esc(t.anio)}</span></div>`).join('') : '<div class="v3-empty">Todavía sin títulos.</div>'}
        <button class="v3-tt-go" data-nav="graficos" data-sq-target="${k}">Ver todos los torneos de Primera ${k.toUpperCase()} ›</button></div>`;
    };
    const total = ['a', 'b'].reduce((n, k) => n + ((getData(k) || {}).titulos || []).length, 0);
    const wrap = document.createElement('div');
    wrap.id = 'v3-titles';
    wrap.innerHTML = `<div class="v3-tt-back" data-act="close-titles"></div>
      <div class="v3-tt-box v3-home" role="dialog" aria-label="Títulos del club">
        <div class="v3-tt-head"><span class="v3-tt-big">🏆</span><div><span class="v3-champ-k">Palmarés del club</span><h3>${total} título${total !== 1 ? 's' : ''}</h3></div>
          <button class="v3-tt-x" data-act="close-titles" aria-label="Cerrar">✕</button></div>
        <div class="v3-tt-body">${block('a')}${block('b')}</div>
      </div>`;
    wrap.addEventListener('click', e => {
      const el = e.target.closest('[data-act="close-titles"],[data-nav]');
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      closeTitles();
      if (el.dataset.nav) goTab(el.dataset.nav, el.dataset.sqTarget);
    });
    document.body.appendChild(wrap);
    document.addEventListener('keydown', titlesEsc);
  }
  function titlesEsc(e) { if (e.key === 'Escape') closeTitles(); }
  function closeTitles() { const w = $('#v3-titles'); if (w) w.remove(); document.removeEventListener('keydown', titlesEsc); }

  // ── Banner de campeón (torneo en curso) ──
  function renderChamp() {
    const box = $('#v3-champ');
    if (!box) return;
    const out = [];
    ['a', 'b'].forEach(k => {
      const d = getData(k), own = ownRow(k);
      if (!d || !own || !g('_csbEstadoTorneo')) return;
      const est = safe(() => _csbEstadoTorneo(d.tabla));
      if (!est || est.estado !== 'campeon') return;
      const torneo = (d.badge || ('Clausura AIFA ' + k.toUpperCase() + ' 2026'));
      const pj = Number(own.pj) || 0, pts = Number(own.pts) || 0;
      const efec = pj ? Math.round(pts / (pj * 3) * 100) : 0;
      const tabla = [...(d.tabla || [])].sort((a, b) => (parseInt(a.pos) || 0) - (parseInt(b.pos) || 0));
      const second = tabla[1];
      const diff = second ? pts - (Number(second.pts) || 0) : null;
      const left = Math.max(0, 15 - pj);
      const ventaja = diff != null ? ` con ${diff} punto${diff !== 1 ? 's' : ''} de ventaja sobre ${esc(second.equipo)}` : '';
      const champText = left > 0
        ? `Santa Bárbara ya es campeón asegurado con ${left === 1 ? 'una fecha' : left + ' fechas'} de anticipación: nadie lo puede alcanzar en lo que queda del torneo.`
        : `Santa Bárbara se consagró campeón${ventaja}.`;
      out.push(`<div class="v3-champ">
        <div class="v3-champ-cup">🏆</div>
        <div class="v3-champ-id"><span class="v3-champ-k">Primera ${k.toUpperCase()} · ¡Campeones!</span><h2>${esc(torneo)}</h2>
          <p>${champText}</p></div>
        <div class="v3-champ-nums">
          <div><b>${pts}</b><span>Puntos</span></div>
          <div><b>${own.pg}-${own.pe}-${own.pp}</b><span>G-E-P</span></div>
          <div><b>${own.gf}:${own.gc}</b><span>Goles</span></div>
          <div><b>${efec}%</b><span>Efectividad</span></div>
        </div>
        <div class="v3-champ-act"><button class="v3-btn" data-nav="posiciones" data-sq-target="${k}">Ver el torneo</button><button class="v3-btn-ghost" data-nav="graficos" data-sq-target="${k}">Palmarés</button></div>
      </div>`);
    });
    const html = out.join('');
    if (box.__last !== html) { box.innerHTML = html; box.__last = html; }
  }

  // ── El club en números (A + B, todos los torneos) ──
  function renderClubNums() {
    const box = $('#v3-club-nums');
    if (!box || !g('_grafSource')) return;
    const srcA = safe(() => window._grafSource(false)) || [], srcB = safe(() => window._grafSource(true)) || [];
    const all = [...srcA, ...srcB];
    if (!all.length) return;
    const sum = k => all.reduce((s, t) => s + (Number(t[k]) || 0), 0);
    const isSub = p => /subcampe/i.test(p || '');
    const isCamp = t => t.forceColor ? t.forceColor === 'oro' : (!isSub(t.pos) && /campe[oó]n/i.test(t.pos || ''));
    const tit = all.filter(isCamp).length, asc = all.filter(t => /ascenso/i.test(t.pos || '')).length;
    const years = new Set(all.map(t => t.anio));
    const pg = sum('pg'), pe = sum('pe'), pp = sum('pp'), tt = Math.max(1, pg + pe + pp);
    const html = `<div class="v3-nums">
      <div class="v3-nums-rec">
        <div class="w"><b>${pg}</b><span>Ganados</span></div><div class="d"><b>${pe}</b><span>Empatados</span></div><div class="l"><b>${pp}</b><span>Perdidos</span></div>
        <span class="v3-nums-bar"><i class="w" style="width:${(pg / tt * 100).toFixed(1)}%"></i><i class="d" style="width:${(pe / tt * 100).toFixed(1)}%"></i><i class="l" style="width:${(pp / tt * 100).toFixed(1)}%"></i></span>
      </div>
      <div class="v3-nums-grid">
        <div><b>${sum('pj')}</b><span>Partidos</span></div>
        <div><b>${sum('gf')}</b><span>Goles a favor</span></div>
        <div><b>${all.length}</b><span>Torneos</span></div>
        <div><b>${years.size}</b><span>Temporadas</span></div>
        <div class="gold"><b>${tit}</b><span>Títulos</span></div>
        <div><b>${asc}</b><span>Ascensos</span></div>
      </div>
    </div>`;
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
      { label: `Todos los torneos · ${L}`, sub: 'Torneo actual, anteriores y copas', icon: I.torneos, run: () => goTab('graficos', k) },
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
  const h2h = { mode: 'pp', l: null, r: null, lp: 'all', rp: 'all', self: null, sl: '', sr: '', tl: '', tr: '' };
  const matchCache = {};
  function playerMatches(nombre) {
    const k = norm(nombre);
    if (!matchCache[k]) {
      matchCache[k] = (g('_csbPlayerMatches') ? Promise.resolve(window._csbPlayerMatches(nombre)) : Promise.resolve([]))
        .catch(() => []).then(list => { matchCache[k] = Array.isArray(list) ? list : []; return matchCache[k]; });
    }
    return Promise.resolve(matchCache[k]);
  }
  const cachedMatches = nombre => { const v = matchCache[norm(nombre)]; return Array.isArray(v) ? v : null; };
  const isGK = p => /ARQ/i.test((p && p.pos) || '');
  const resOf = m => { if (m.gf == null || m.gc == null) return null; const gg = safe(() => _csbGoles(m)) || { csb: m.gf, riv: m.gc }; return gg.csb > gg.riv ? 'w' : gg.csb < gg.riv ? 'l' : 'd'; };
  const rivZero = m => { if (m.gf == null || m.gc == null) return false; const gg = safe(() => _csbGoles(m)) || { csb: m.gf, riv: m.gc }; return gg.riv === 0; };
  function clubTitles() { return ['a', 'b'].flatMap(k => ((getData(k) || {}).titulos || []).map(t => ({ ...t, k }))); }
  function titlesIn(list) {
    const ts = new Set(list.map(m => `${m.torneo}`));
    return clubTitles().filter(t => [...ts].some(tn => norm(tn).includes(norm(String(t.nombre).replace(/^Campe[oó]n\s+/i, ''))) && String(tn).includes(String(t.anio)))).length;
  }
  function periodOptions(list) {
    const years = [...new Set(list.map(m => String(m.anio)).filter(Boolean))].sort((a, b) => b - a);
    const torneos = [];
    list.forEach(m => { if (m.torneo && !torneos.includes(m.torneo)) torneos.push(m.torneo); });
    return { years, torneos };
  }
  function periodLabel(p) { return p === 'all' ? 'Toda la carrera' : p.startsWith('y:') ? 'Temporada ' + p.slice(2) : p.slice(2); }
  function periodSelect(side, list, val) {
    const o = periodOptions(list || []);
    return `<select class="v3-h2h-period" data-period="${side}">
      <option value="all"${val === 'all' ? ' selected' : ''}>Toda la carrera</option>
      ${o.years.length ? `<optgroup label="Temporadas">${o.years.map(y => `<option value="y:${y}"${val === 'y:' + y ? ' selected' : ''}>Temporada ${y}</option>`).join('')}</optgroup>` : ''}
      ${o.torneos.length ? `<optgroup label="Torneos">${o.torneos.map(t => `<option value="t:${esc(t)}"${val === 't:' + t ? ' selected' : ''}>${esc(t)}</option>`).join('')}</optgroup>` : ''}
    </select>`;
  }
  // Estadísticas de un jugador en un período
  function playerStats(p, period) {
    const all = cachedMatches(p.nombre) || [];
    const list = period === 'all' ? all : period.startsWith('y:') ? all.filter(m => String(m.anio) === period.slice(2)) : all.filter(m => m.torneo === period.slice(2));
    const rec = { w: 0, d: 0, l: 0 };
    list.forEach(m => { const r = resOf(m); if (r) rec[r]++; });
    const n = rec.w + rec.d + rec.l;
    const sum = k => list.reduce((a, m) => a + (Number(m[k]) || 0), 0);
    let o;
    if (period === 'all') {
      o = { pj: p.pj || 0, titular: p.titular || 0, sup: p.suplente != null ? p.suplente : (p.sup || 0), goles: p.goles || 0, asist: p.asist || 0, titulos: p.titulos || 0, vallas: p.vallas || 0, rojas: p.rojas || 0 };
    } else {
      o = { pj: list.length, titular: list.filter(m => m.condCorta === 'Titular').length, sup: list.filter(m => m.condCorta === 'Suplente').length,
        goles: sum('goles'), asist: sum('asist'), titulos: titlesIn(list), vallas: list.filter(rivZero).length, rojas: sum('rojas') };
    }
    o.gmas = o.goles + o.asist;
    o.promGol = o.pj ? o.goles / o.pj : 0; o.promAsist = o.pj ? o.asist / o.pj : 0; o.promGmas = o.pj ? o.gmas / o.pj : 0;
    o.w = rec.w; o.d = rec.d; o.l = rec.l; o.efec = n ? Math.round((rec.w * 3 + rec.d) / (n * 3) * 100) : 0;
    o.capitan = list.filter(m => m.esCapitan).length;
    o._matches = list.length;
    return o;
  }
  const PLAYER_ROWS = [
    { key: 'pj', label: 'Partidos' }, { key: 'titular', label: 'Titular' }, { key: 'sup', label: 'Suplente', neutral: true },
    { key: 'goles', label: 'Goles' }, { key: 'asist', label: 'Asistencias' }, { key: 'gmas', label: 'G + A' },
    { key: 'promGol', label: 'Prom. gol', f: 2 }, { key: 'promAsist', label: 'Prom. asist.', f: 2 }, { key: 'promGmas', label: 'Prom. G+A', f: 2 },
    { key: 'titulos', label: 'Títulos' }, { key: 'vallas', label: 'Vallas inv.' }, { key: 'capitan', label: 'Capitán' },
    { sep: 'Resultados del equipo con él en cancha' },
    { key: 'w', label: 'Ganados' }, { key: 'd', label: 'Empatados', neutral: true }, { key: 'l', label: 'Perdidos', low: true },
    { key: 'efec', label: 'Efectividad', suf: '%' }, { key: 'rojas', label: 'Rojas', low: true },
  ];
  // Campañas (equipo)
  function teamCampaigns() {
    const out = [];
    [['a', false], ['b', true]].forEach(([k, isB]) => {
      (safe(() => window._grafSource(isB)) || []).forEach(t => {
        if (t.pj == null) return;
        out.push({ ...t, k, id: `${k}|${t.anio}|${t.competencia}` });
      });
    });
    return out.sort((a, b) => b.anio - a.anio || a.k.localeCompare(b.k) || String(a.competencia).localeCompare(String(b.competencia)));
  }
  function posNum(t) {
    const p = String(t.pos || '');
    if (t.forceColor === 'oro' || (/campe[oó]n/i.test(p) && !/subcampe/i.test(p))) return 1;
    if (t.forceColor === 'plata' || /subcampe/i.test(p)) return 2;
    const n = parseInt(p); return isNaN(n) ? null : n;
  }
  function teamStats(t) {
    const pj = t.pj || 0, w = t.pg || 0, d = t.pe || 0, l = t.pp || 0;
    return { pos: posNum(t), pts: t.pts, pj, w, d, l, gf: t.gf || 0, gc: t.gc || 0, dif: (t.gf || 0) - (t.gc || 0),
      efec: pj ? Math.round((w * 3 + d) / (pj * 3) * 100) : 0, promGf: pj ? (t.gf || 0) / pj : 0, promGc: pj ? (t.gc || 0) / pj : 0, vi: t.vi };
  }
  const TEAM_ROWS = [
    { key: 'pos', label: 'Posición', low: true, fmt: v => v == null ? '—' : v + '°' },
    { key: 'pts', label: 'Puntos' }, { key: 'pj', label: 'Partidos', neutral: true },
    { key: 'w', label: 'Ganados' }, { key: 'd', label: 'Empatados', neutral: true }, { key: 'l', label: 'Perdidos', low: true },
    { key: 'gf', label: 'Goles a favor' }, { key: 'gc', label: 'Goles en contra', low: true }, { key: 'dif', label: 'Diferencia', sign: true },
    { key: 'efec', label: 'Efectividad', suf: '%' }, { key: 'promGf', label: 'Gol a favor x PJ', f: 2 }, { key: 'promGc', label: 'Gol en contra x PJ', f: 2, low: true },
    { key: 'vi', label: 'Vallas invictas' },
  ];
  function fmtN(v, f) { const n = Number(v) || 0; return f ? n.toFixed(f).replace('.', ',') : String(n); }
  function compareRows(rows, A, B, opts) {
    let wl = 0, wr = 0, n = 0;
    const html = rows.map(m => {
      if (m.sep) return `<div class="v3-h2h-sep">${m.sep}</div>`;
      if (m.gk && !opts.gk) return '';
      const av = A[m.key], bv = B[m.key];
      if ((av == null || av === '') && (bv == null || bv === '')) return '';
      const a = Number(av) || 0, b = Number(bv) || 0;
      const comparable = av != null && bv != null && !m.neutral;
      const lw = comparable && (m.low ? a < b : a > b), rw = comparable && (m.low ? b < a : b > a);
      if (comparable) { n++; if (lw) wl++; if (rw) wr++; }
      const max = Math.max(Math.abs(a), Math.abs(b)) || 1;
      const f = v => v == null ? '—' : m.fmt ? m.fmt(v) : (m.sign && v > 0 ? '+' : '') + fmtN(v, m.f) + (m.suf || '');
      const wa = m.key === 'pos' ? (av == null ? 0 : 100 / Math.max(1, a)) : Math.abs(a) / max * 100;
      const wb = m.key === 'pos' ? (bv == null ? 0 : 100 / Math.max(1, b)) : Math.abs(b) / max * 100;
      return `<div class="v3-h2h-row">
        <span class="v3-h2h-val l${lw ? ' win' : ''}">${f(av)}</span>
        <div class="v3-h2h-track l"><i style="width:${Math.round(wa)}%"></i></div>
        <span class="v3-h2h-lbl">${m.label}</span>
        <div class="v3-h2h-track r"><i style="width:${Math.round(wb)}%"></i></div>
        <span class="v3-h2h-val r${rw ? ' win' : ''}">${f(bv)}</span></div>`;
    }).join('');
    return { html, wl, wr, n };
  }
  function verdictHtml(r, nameL, nameR, note) {
    const v = r.wl === r.wr ? `Empate técnico: <b>${r.wl}</b> rubros para cada lado.`
      : `<b>${esc(r.wl > r.wr ? nameL : nameR)}</b> gana en ${Math.max(r.wl, r.wr)} de ${r.n} rubros (contra ${Math.min(r.wl, r.wr)}).`;
    return `<div class="v3-h2h-verdict">${v} <span style="color:var(--v3-muted)">${note}</span></div>`;
  }

  function buildH2H() {
    const el = document.createElement('div');
    el.id = 'v3-h2h';
    el.innerHTML = `<div class="v3-modal-backdrop" data-close></div>
      <div class="v3-h2h-box" role="dialog" aria-label="Cara a cara">
        <div class="v3-h2h-head"><span style="color:var(--v3-brand);display:inline-flex">${I.h2h.replace('<svg', '<svg width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')}</span><h3>Cara a cara</h3><button class="v3-icon-btn" data-close aria-label="Cerrar">${I.close}</button></div>
        <div class="v3-h2h-modes">
          <button data-mode="pp">Jugador vs jugador</button>
          <button data-mode="self">Un jugador, dos épocas</button>
          <button data-mode="team">Equipo vs equipo</button>
        </div>
        <div id="v3-h2h-pickers"></div>
        <div id="v3-h2h-body"></div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { closeH2H(); return; }
      const md = e.target.closest('[data-mode]');
      if (md) { setMode(md.dataset.mode); return; }
      const s = e.target.closest('[data-pick]');
      if (s) { const side = s.closest('.v3-h2h-pick').dataset.side; pickH2H(side, s.dataset.pick); return; }
      const sw = e.target.closest('[data-swap]');
      if (sw) { swapSides(); return; }
      const c = e.target.closest('[data-player]'); if (c) openPlayer(c.dataset.player);
      if (!e.target.closest('.v3-h2h-pick')) $$('.v3-h2h-sugg', el).forEach(x => x.classList.remove('open'));
    });
    el.addEventListener('change', e => {
      const sel = e.target.closest('select');
      if (!sel) return;
      const k = sel.dataset.period || sel.dataset.team;
      if (sel.dataset.period) { if (k === 'l') h2h.lp = sel.value; else if (k === 'r') h2h.rp = sel.value; else if (k === 'sl') h2h.sl = sel.value; else if (k === 'sr') h2h.sr = sel.value; }
      if (sel.dataset.team) { if (k === 'l') h2h.tl = sel.value; else h2h.tr = sel.value; }
      renderH2H();
    });
    el.addEventListener('input', e => { const inp = e.target.closest('.v3-h2h-pick input'); if (inp) suggest(inp); });
    el.addEventListener('focusin', e => { const inp = e.target.closest('.v3-h2h-pick input'); if (inp) suggest(inp); });
    el.addEventListener('keydown', e => {
      const inp = e.target.closest('.v3-h2h-pick input');
      if (inp && e.key === 'Enter') { const f = $('.v3-h2h-sugg [data-pick]', inp.parentNode); if (f) pickH2H(inp.parentNode.dataset.side, f.dataset.pick); }
    });
    renderPickers();
  }
  function pickBox(side, label, p) {
    return `<div class="v3-h2h-pick" data-side="${side}"><label>${label}</label><input placeholder="Escribí un nombre…" autocomplete="off" value="${p ? esc(p.nombre) : ''}"><div class="v3-h2h-sugg"></div></div>`;
  }
  function teamSelect(side, val) {
    const camps = teamCampaigns();
    const lbl = t => `${t.k === 'a' ? 'Primera A' : 'Primera B'} · ${t.competencia} ${t.anio}${t.pos ? ' · ' + t.pos : ''}${t.live ? ' (actual)' : ''}`;
    const years = [...new Set(camps.map(t => t.anio))];
    return `<div class="v3-h2h-pick" data-side="${side}"><label>Equipo ${side === 'l' ? '1' : '2'}</label>
      <select class="v3-h2h-period v3-h2h-team" data-team="${side}">${years.map(y => `<optgroup label="${y}">${camps.filter(t => t.anio === y).map(t => `<option value="${esc(t.id)}"${t.id === val ? ' selected' : ''}>${esc(lbl(t))}</option>`).join('')}</optgroup>`).join('')}</select></div>`;
  }
  function renderPickers() {
    const box = $('#v3-h2h-pickers');
    if (!box) return;
    $$('#v3-h2h [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === h2h.mode));
    const swap = `<button class="v3-h2h-vs" data-swap title="Invertir lados">VS<small>⇄</small></button>`;
    if (h2h.mode === 'pp') {
      box.innerHTML = `<div class="v3-h2h-pickers">
        <div>${pickBox('l', 'Jugador 1', h2h.l)}${h2h.l ? periodSelect('l', cachedMatches(h2h.l.nombre), h2h.lp) : ''}</div>${swap}
        <div>${pickBox('r', 'Jugador 2', h2h.r)}${h2h.r ? periodSelect('r', cachedMatches(h2h.r.nombre), h2h.rp) : ''}</div></div>`;
    } else if (h2h.mode === 'self') {
      const list = h2h.self ? cachedMatches(h2h.self.nombre) : null;
      box.innerHTML = `<div class="v3-h2h-pickers v3-h2h-self">
        <div class="v3-h2h-self-name">${pickBox('s', 'Jugador', h2h.self)}</div>
        <div><label class="v3-h2h-mini">Época 1</label>${h2h.self ? periodSelect('sl', list, h2h.sl) : '<div class="v3-h2h-ph">Elegí un jugador</div>'}</div>${swap}
        <div><label class="v3-h2h-mini">Época 2</label>${h2h.self ? periodSelect('sr', list, h2h.sr) : '<div class="v3-h2h-ph">Elegí un jugador</div>'}</div></div>`;
    } else {
      box.innerHTML = `<div class="v3-h2h-pickers">${teamSelect('l', h2h.tl)}${swap}${teamSelect('r', h2h.tr)}</div>`;
    }
  }
  function swapSides() {
    if (h2h.mode === 'pp') { [h2h.l, h2h.r] = [h2h.r, h2h.l]; [h2h.lp, h2h.rp] = [h2h.rp, h2h.lp]; }
    else if (h2h.mode === 'self') { [h2h.sl, h2h.sr] = [h2h.sr, h2h.sl]; }
    else { [h2h.tl, h2h.tr] = [h2h.tr, h2h.tl]; }
    renderPickers(); renderH2H();
  }
  function setMode(m) {
    h2h.mode = m;
    if (m === 'team' && (!h2h.tl || !h2h.tr)) {
      const camps = teamCampaigns();
      const isC = t => posNum(t) === 1;
      const a = camps.find(t => t.k === 'a' && isC(t)) || camps[0];
      const b = camps.find(t => t.k === 'b' && isC(t)) || camps.find(t => t !== a);
      h2h.tl = a ? a.id : ''; h2h.tr = b ? b.id : '';
    }
    if (m === 'self' && !h2h.self) {
      const base = h2h.l || [...(nidoList() || [])].sort((a, b) => (b.pj || 0) - (a.pj || 0))[0];
      if (base) { pickH2H('s', base.nombre); return; }
    }
    renderPickers(); renderH2H();
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
    const p = findPlayer(nombre);
    if (!p) return;
    if (side === 'l') { h2h.l = p; h2h.lp = 'all'; }
    else if (side === 'r') { h2h.r = p; h2h.rp = 'all'; }
    else { h2h.self = p; h2h.sl = ''; h2h.sr = ''; }
    renderPickers(); renderH2H();
    playerMatches(p.nombre).then(list => {
      if (side === 's' && h2h.self === p) {
        const ys = periodOptions(list).years;
        h2h.sl = ys[1] ? 'y:' + ys[1] : 'all'; h2h.sr = ys[0] ? 'y:' + ys[0] : 'all';
      }
      renderPickers(); renderH2H();
    });
  }
  function openH2H(mode) {
    closeSearch();
    $('#v3-h2h').classList.add('open');
    if (mode && typeof mode === 'string') h2h.mode = mode;
    renderPickers(); renderH2H();
    ensureNido().then(list => {
      if (!h2h.l && !h2h.r && list.length) {
        const byG = [...list].sort((a, b) => (b.goles || 0) - (a.goles || 0));
        if (byG[0]) pickH2H('l', byG[0].nombre);
        if (byG[1]) pickH2H('r', byG[1].nombre);
      }
      setMode(h2h.mode);
    });
  }
  // Abre Cara a cara con un jugador ya elegido (botón ⇄ de El Nido)
  function compareWith(nombre) {
    closeSearch();
    h2h.mode = 'pp';
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
  function pCard(p, side, sub) {
    return `<div class="v3-h2h-card" data-side="${side}" data-player="${esc(p.nombre)}" title="Ver perfil">
      <span class="v3-avatar">${esc(initials(p.nombre))}</span>
      <div><div class="v3-h2h-card-name">${esc(p.nombre)}</div><div class="v3-h2h-card-sub">${sub}</div></div></div>`;
  }
  function renderH2H() {
    const body = $('#v3-h2h-body');
    if (!body) return;
    if (h2h.mode === 'team') {
      const camps = teamCampaigns();
      const A = camps.find(t => t.id === h2h.tl), B = camps.find(t => t.id === h2h.tr);
      if (!A || !B) { body.innerHTML = '<div class="v3-h2h-rows"><div class="v3-empty">Elegí dos campañas para compararlas.</div></div>'; return; }
      const tcard = (t, side) => `<div class="v3-h2h-card v3-h2h-tcard" data-side="${side}">
        <span class="lc-crest sm"><img src="logo-csb.webp" alt=""><b>${t.k.toUpperCase()}</b></span>
        <div><div class="v3-h2h-card-name">${esc(t.competencia)} ${t.anio}</div><div class="v3-h2h-card-sub">Primera ${t.k.toUpperCase()} · ${esc(t.pos || '—')}${t.live ? ' · torneo actual' : ''}</div></div></div>`;
      const r = compareRows(TEAM_ROWS, teamStats(A), teamStats(B), {});
      const nm = t => `${t.competencia} ${t.anio}`;
      body.innerHTML = `<div class="v3-h2h-cards">${tcard(A, 'l')}${tcard(B, 'r')}</div><div class="v3-h2h-rows">${r.html}</div>${verdictHtml(r, nm(A), nm(B), 'Los torneos pueden tener distinta cantidad de partidos: mirá la efectividad y los promedios por partido.')}`;
      return;
    }
    if (!nidoList()) { body.innerHTML = '<div class="v3-h2h-rows"><div class="v3-skel"></div><div class="v3-skel"></div><div class="v3-skel"></div></div>'; return; }
    if (h2h.mode === 'self') {
      const p = h2h.self;
      if (!p) { body.innerHTML = '<div class="v3-h2h-rows"><div class="v3-empty">Elegí un jugador para comparar dos momentos de su carrera.</div></div>'; return; }
      if (!cachedMatches(p.nombre)) { body.innerHTML = '<div class="v3-h2h-rows"><div class="v3-skel"></div><div class="v3-skel"></div></div>'; return; }
      const A = playerStats(p, h2h.sl || 'all'), B = playerStats(p, h2h.sr || 'all');
      const sub = per => `${esc(periodLabel(per || 'all'))}`;
      const r = compareRows(PLAYER_ROWS, A, B, { gk: isGK(p) });
      body.innerHTML = `<div class="v3-h2h-cards">${pCard(p, 'l', sub(h2h.sl))}${pCard(p, 'r', sub(h2h.sr))}</div><div class="v3-h2h-rows">${r.html}</div>
        ${verdictHtml(r, periodLabel(h2h.sl || 'all'), periodLabel(h2h.sr || 'all'), 'Por temporada o torneo se cuentan los partidos cargados en el Fecha a Fecha.')}`;
      return;
    }
    const L = h2h.l, R = h2h.r;
    if (!L || !R) { body.innerHTML = '<div class="v3-h2h-rows"><div class="v3-empty">Elegí dos jugadores para compararlos.</div></div>'; return; }
    const A = playerStats(L, h2h.lp), B = playerStats(R, h2h.rp);
    const sub = (p, per) => `${esc(p.pos || 'Jugador')} · ${esc(periodLabel(per))}`;
    const r = compareRows(PLAYER_ROWS, A, B, { gk: isGK(L) || isGK(R) });
    const partial = h2h.lp !== 'all' || h2h.rp !== 'all';
    body.innerHTML = `<div class="v3-h2h-cards">${pCard(L, 'l', sub(L, h2h.lp))}${pCard(R, 'r', sub(R, h2h.rp))}</div><div class="v3-h2h-rows">${r.html}</div>
      ${verdictHtml(r, L.nombre, R.nombre, partial ? 'Por temporada o torneo se cuentan los partidos cargados en el Fecha a Fecha. Los resultados del equipo salen de esos mismos partidos.' : 'Totales de carrera en el club (Primera A + B). Los resultados del equipo salen de los partidos cargados en el Fecha a Fecha.')}`;
  }


  // ════════════════ EN VIVO · TORNEO EN CURSO ════════════════
  // Portada nueva arriba del torneo en curso (solo dentro de "En Vivo", no
  // cuando el mismo componente se abre desde Torneos Antiguos) + colores de
  // resultado en el selector de fechas del Fecha a Fecha. Se engancha por
  // MutationObserver porque renderTorneoApertura() reescribe todo el
  // contenido (y redefine apSwitchTab) en cada render.
  function liveTorneoHero() {
    const d = getCurrent();
    if (!d || !Array.isArray(d.partidos)) return null;
    const tabla = d.tabla || [];
    const own = tabla.find(t => t.csb);
    const total = d.partidos.length || 15;
    const played = d.partidos.filter(p => p.resultado != null && p.gf != null);
    const res = p => { const g = safe(() => _csbGoles(p)) || { csb: p.gf, riv: p.gc }; return g.csb > g.riv ? 'G' : g.csb < g.riv ? 'P' : 'E'; };
    const last5 = played.slice(-5).reverse();
    const est = safe(() => _csbEstadoTorneo(tabla, total));
    const next = safe(() => _nextPendingPartido(d));
    const nm = next && next.m;
    const pj = own ? Number(own.pj) || played.length : played.length;
    const status = est && est.estado === 'campeon' ? '<span class="v3-tv-status champ">🏆 Campeón</span>'
      : est && est.estado === 'descendido' ? '<span class="v3-tv-status down">Descendido</span>'
      : nm ? '<span class="v3-tv-status live"><i></i>En juego</span>' : '<span class="v3-tv-status">Finalizado</span>';
    const sqLabel = d === getData('b') ? 'Primera B' : 'Primera A';
    const crest = n => safe(() => _crestImgHtml(n)) || '';
    const el = document.createElement('section');
    el.id = 'v3-tv-hero';
    el.className = 'v3-tv-hero';
    el.innerHTML = `
      <div class="v3-tv-id">
        <div class="v3-tv-kicker">${esc(sqLabel)} · Torneo en curso ${status}</div>
        <h2 class="v3-tv-title">${esc(d.badge || 'Torneo')}</h2>
        <div class="v3-tv-prog"><i style="width:${Math.min(100, pj / total * 100).toFixed(1)}%"></i></div>
        <div class="v3-tv-prog-lbl">${pj} de ${total} fechas jugadas${nm ? ` · Próxima: <b>Fecha ${esc(nm.fecha)} vs ${esc(nm.rival)}</b>` : ''}</div>
      </div>
      ${own ? `<div class="v3-tv-stats">
        <div class="v3-tv-stat"><b>${esc(String(own.pos).replace(/[°º]/g, ''))}°</b><span>Posición</span></div>
        <div class="v3-tv-stat"><b class="gold">${esc(own.pts)}</b><span>Puntos</span></div>
        <div class="v3-tv-stat"><b><em class="g">${esc(own.pg)}</em>-<em class="e">${esc(own.pe)}</em>-<em class="p">${esc(own.pp)}</em></b><span>G-E-P</span></div>
        <div class="v3-tv-stat"><b>${(own.gf - own.gc) >= 0 ? '+' : ''}${own.gf - own.gc}</b><span>Dif. gol</span></div>
        <div class="v3-tv-stat v3-tv-form"><div>${last5.map((p, i) => `<span class="r${res(p)}${i === 0 ? ' first' : ''}" title="F${esc(p.fecha)} vs ${esc(p.rival)}">${res(p)}<u>${crest(p.rival)}</u></span>`).join('')}</div><span>← Últimos 5</span></div>
      </div>` : ''}`;
    return el;
  }
  function decorateFechaButtons(root) {
    const d = getCurrent();
    if (!d || !Array.isArray(d.partidos)) return;
    const byFecha = {};
    d.partidos.forEach(p => { if (p.resultado != null && p.gf != null) { const g = safe(() => _csbGoles(p)) || { csb: p.gf, riv: p.gc }; byFecha[String(p.fecha)] = g.csb > g.riv ? 'w' : g.csb < g.riv ? 'l' : 'd'; } });
    $$('.ap-fecha-btn', root).forEach(b => {
      const m = (b.textContent || '').match(/F\s*(\d+)/i);
      const r = m && byFecha[m[1]];
      b.classList.remove('v3-fw', 'v3-fd', 'v3-fl');
      if (r) b.classList.add('v3-f' + r);
    });
  }
  function watchTorneo() {
    const root = $('#torneo-apertura-content');
    if (!root) return;
    let busy = false;
    const apply = () => {
      if (busy) return; busy = true;
      try {
        const isLive = view().idx === 1;
        const has = $('#v3-tv-hero', root);
        if (isLive && root.children.length && !has) {
          const hero = liveTorneoHero();
          if (hero) { root.prepend(hero); root.classList.add('v3-has-hero'); }
        } else if (!isLive && has) { has.remove(); root.classList.remove('v3-has-hero'); }
        if (isLive) decorateFechaButtons(root);
      } finally { busy = false; }
    };
    new MutationObserver(() => requestAnimationFrame(apply)).observe(root, { childList: true, subtree: true });
    apply();
  }


  // ════════════════ ESTADÍSTICAS JUGADORES: barra de secciones ════════════════
  // Barra fija arriba de Totales/Anuales/Debuts/Inferiores para saltar entre
  // las cuatro sin volver al menú.
  function jugSubBar(active) {
    const isB = getCurrent() === getData('b');
    const items = [['totales', 'Totales'], ['anuales', 'Anuales'], ...(isB ? [] : [['debuts', 'Debuts'], ['inferiores', 'Inferiores']])];
    return `<div class="jsx-bar" role="tablist">${items.map(([k, l]) => `<button class="${k === active ? 'on' : ''}" onclick="showJugSub('${k}')">${l}</button>`).join('')}</div>`;
  }
  function placeJugSubBar(key) {
    ['totales', 'anuales', 'debuts', 'inferiores'].forEach(k => {
      const panel = $('#tab-jug-' + k);
      if (!panel) return;
      let bar = $(':scope > .jsx-bar', panel);
      if (k !== key) { if (bar) bar.remove(); return; }
      const html = jugSubBar(key);
      if (bar) bar.outerHTML = html; else panel.insertAdjacentHTML('afterbegin', html);
    });
  }
  function wrapJugSub() {
    const orig = window.showJugSub;
    if (typeof orig !== 'function' || orig.__v3jug) return;
    const w = function (key) { const r = orig.apply(this, arguments); try { placeJugSubBar(key); } catch (e) {} return r; };
    w.__v3jug = true; w.__v3 = true;
    window.showJugSub = w;
  }



  // ════════════════ INICIO MÓVIL (dashboard tipo app) ════════════════
  let mhLeader = 'goles';
  function mhSquad(k) {
    const d = getData(k) || {}, own = ownRow(k);
    const est = own ? safe(() => _csbEstadoTorneo(d.tabla)) : null;
    const played = (d.partidos || []).filter(p => p.resultado != null && p.gf != null);
    const res = p => { const gg = safe(() => _csbGoles(p)) || { csb: p.gf, riv: p.gc }; return gg.csb > gg.riv ? 'w' : gg.csb < gg.riv ? 'l' : 'd'; };
    const last = played.slice(-5);
    const tag = est && est.estado === 'campeon' ? '<em class="gold">Campeón</em>' : est && est.estado === 'descendido' ? '<em class="red">Descendido</em>' : '';
    return `<button class="mh-sq${est && est.estado === 'campeon' ? ' champ' : ''}" data-nav="resumen" data-sq-target="${k}">
      <span class="mh-sq-top"><span class="lc-crest sm"><img src="logo-csb.webp" alt=""><b>${k.toUpperCase()}</b></span><b>Primera ${k.toUpperCase()}</b></span>
      <span class="mh-sq-pos">${own ? esc(String(own.pos).replace(/[°º]/g, '')) : '–'}<small>°</small></span>
      <span class="mh-sq-sub">${own ? `${esc(own.pts)} pts · ${esc(own.pj)} PJ` : 'Cargando…'}</span>
      <span class="mh-sq-form">${last.map(p => `<i class="${res(p)}"></i>`).join('')}</span>
      ${tag ? `<span class="mh-sq-tag">${tag}</span>` : ''}
    </button>`;
  }
  function mhMatch(k) {
    const d = getData(k);
    const m = k === 'a' ? (safe(() => _liveMatchInfo(d, 'a')) || safe(() => _primeraANextMatch())) : (safe(() => _liveMatchInfo(d, 'b')) || safe(() => _teamNextMatch(d, 'b')));
    if (!m) return '';
    const meta = safe(() => _fmtProximoMeta(m)) || {};
    const cd = (!m.isLive && m.dt) ? safe(() => _countdownParts(m.dt)) : null;
    const cdVal = cd ? (cd.days > 0 ? `${cd.days}d ${cd.hours}h` : `${cd.hours}h ${cd.minutes}m`) : '';
    const vis = /visit/i.test(m.local || '');
    const us = `<span class="mh-m-t"><span class="mh-m-c us"><img src="logo-csb.webp" alt=""></span><b>Santa Bárbara</b></span>`;
    const rv = `<span class="mh-m-t"><span class="mh-m-c">${safe(() => _crestImgHtml(m.rival)) || ''}</span><b>${esc(m.rival)}</b></span>`;
    const loc = m.locator != null ? m.locator : m.fecha;
    const nk = m.navKey || k;
    const maps = vis ? safe(() => _mapsUrlFor(m)) : null;
    const center = m.isLive ? `<span class="mh-m-vs live"><b>${esc(m.marcadorTxt || 'VS')}</b><small>${m.final ? 'Final' : esc(m.clockLabel || 'En vivo')}</small></span>`
      : `<span class="mh-m-vs"><b>${esc(meta.horaTxt || 'VS')}</b><small>${esc([meta.weekday ? meta.weekday.slice(0, 3) : '', meta.diaMes].filter(Boolean).join(' ') || 'A confirmar')}</small></span>`;
    return `<div class="mh-m" ${loc != null ? `data-fecha-nav="${esc(nk)}" data-fecha-loc="${esc(String(loc))}"` : ''}>
      <div class="mh-m-h"><span class="mh-chip">Primera ${k.toUpperCase()}</span>${m.fecha ? `<span>Fecha ${esc(m.fecha)}</span>` : ''}<span class="mh-m-lv">${vis ? 'Visitante' : 'Local'}</span>${cdVal ? `<span class="mh-m-cd">${esc(cdVal)}</span>` : ''}</div>
      <div class="mh-m-row">${vis ? rv : us}${center}${vis ? us : rv}</div>
      ${vis && m.lugar ? `<div class="mh-m-place"><span>📍 ${esc(m.lugar)}</span>${maps ? `<a href="${esc(maps)}" target="_blank" rel="noopener">Cómo llegar</a>` : ''}</div>` : ''}
    </div>`;
  }
  function mhLeaders() {
    const list = nidoList();
    const M = [['goles', 'Goles'], ['asist', 'Asist.'], ['pj', 'PJ'], ['vallas', 'Vallas'], ['titulos', 'Títulos']];
    const top = (list || []).filter(p => (p[mhLeader] || 0) > 0).sort((a, b) => (b[mhLeader] || 0) - (a[mhLeader] || 0)).slice(0, 3);
    return `<div class="mh-chips" data-noptr>${M.map(([k, l]) => `<button class="${k === mhLeader ? 'on' : ''}" data-mh-leader="${k}">${l}</button>`).join('')}</div>
      <div class="mh-lead">${top.length ? top.map((p, i) => `<button class="mh-lead-r" data-player="${esc(p.nombre)}"><span class="mh-rk r${i + 1}">${i + 1}</span><span class="v3-avatar">${esc(initials(p.nombre))}</span><span class="mh-lead-n"><b>${esc(p.nombre)}</b><small>${esc(p.pos || '')} · ${p.pj || 0} PJ</small></span><span class="mh-lead-v">${p[mhLeader]}</span></button>`).join('') : '<div class="v3-skel"></div><div class="v3-skel"></div>'}</div>`;
  }
  function mhNums() {
    const all = [...(safe(() => window._grafSource(false)) || []), ...(safe(() => window._grafSource(true)) || [])];
    if (!all.length) return '';
    const sum = k => all.reduce((s, t) => s + (Number(t[k]) || 0), 0);
    const tit = ['a', 'b'].reduce((n, k) => n + ((getData(k) || {}).titulos || []).length, 0);
    const items = [[sum('pj'), 'Partidos'], [sum('pg'), 'Ganados', 'w'], [sum('pe'), 'Empatados', 'd'], [sum('pp'), 'Perdidos', 'l'], [sum('gf'), 'Goles'], [all.length, 'Torneos'], [new Set(all.map(t => t.anio)).size, 'Temporadas'], [tit, 'Títulos', 'gold']];
    return `<div class="mh-strip" data-noptr>${items.map(([v, l, c]) => `<div class="${c || ''}"><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;
  }
  function renderMHome() {
    const home = $('#v3-mhome'); if (!home) return;
    const tit = ['a', 'b'].reduce((n, k) => n + ((getData(k) || {}).titulos || []).length, 0);
    const champs = ['a', 'b'].filter(k => { const d = getData(k); const e = d && ownRow(k) ? safe(() => _csbEstadoTorneo(d.tabla)) : null; return e && e.estado === 'campeon'; });
    const html = `
      ${champs.map(k => `<button class="mh-champ" data-nav="posiciones" data-sq-target="${k}"><span>🏆</span><span><small>¡Campeones! · Primera ${k.toUpperCase()}</small><b>${esc((getData(k) || {}).badge || 'Torneo')}</b></span><i>›</i></button>`).join('')}
      <div class="mh-squads">${mhSquad('a')}${mhSquad('b')}</div>
      <div class="mh-qa">
        <button data-nav="resumen"><span>${I.resumen}</span>Equipo</button>
        <button data-nav="posiciones"><span>${I.vivo}</span>En Vivo</button>
        <button data-nav="nido"><span>${I.nido}</span>El Nido</button>
        <button data-nav="jugadores"><span>${I.jugadores}</span>Estadísticas</button>
        <button data-nav="h2h"><span>${I.h2h}</span>Cara a cara</button>
        <button data-nav="graficos"><span>${I.torneos}</span>Torneos</button>
        <button data-nav="historial"><span>${I.historial}</span>vs Clubes</button>
        <button data-act="titles"><span>🏆</span>Títulos (${tit})</button>
      </div>
      ${(() => { const ms = mhMatch('a') + mhMatch('b'); return ms ? `<section><div class="mh-sec"><b>Próximos partidos</b></div><div class="mh-matches" data-noptr>${ms}</div></section>` : ''; })()}
      <section><div class="mh-sec"><b>Líderes históricos</b><button data-nav="nido">Ver todos ›</button></div>${mhLeaders()}</section>
      <section><div class="mh-sec"><b>El club en números</b><button data-nav="graficos">Torneos ›</button></div>${mhNums()}</section>
      <section><div class="mh-sec"><b>Cara a cara</b></div><div class="mh-h2h">
        <button data-nav="h2h" data-h2h-mode="pp">${I.h2h}<span>Jugador<br>vs jugador</span></button>
        <button data-nav="h2h" data-h2h-mode="self">${I.jugadores}<span>Un jugador,<br>dos épocas</span></button>
        <button data-nav="h2h" data-h2h-mode="team">${I.torneos}<span>Equipo<br>vs equipo</span></button>
      </div></section>`;
    if (home.__last !== html) { home.innerHTML = html; home.__last = html; }
  }
  function buildMHome() {
    const landing = $('#landing');
    if (!landing || $('#v3-mhome')) return;
    const el = document.createElement('div');
    el.id = 'v3-mhome';
    landing.appendChild(el);
    el.addEventListener('click', e => {
      const lb = e.target.closest('[data-mh-leader]');
      if (lb) { mhLeader = lb.dataset.mhLeader; renderMHome(); return; }
      const pl = e.target.closest('[data-player]');
      if (pl) { openPlayer(pl.dataset.player); return; }
      if (e.target.closest('a')) return;
      const mf = e.target.closest('[data-fecha-nav]');
      if (mf && g('goToMatchFecha')) goToMatchFecha(mf.dataset.fechaNav, mf.dataset.fechaLoc);
    });
    renderMHome();
    setInterval(renderMHome, 60000);
    setTimeout(() => ensureNido().then(renderMHome), 1800);
  }

  // ════════════════ MODO APP (celular / web app instalada) ════════════════
  const mqApp = window.matchMedia('(max-width: 768px)');
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const haptic = ms => { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) {} };
  function toast(msg) {
    let t = $('#v3-toast');
    if (!t) { t = document.createElement('div'); t.id = 'v3-toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function doBack() {
    const v = view();
    if ($('#v3-h2h.open')) { closeH2H(); return true; }
    if ($('#v3-titles')) { closeTitles(); return true; }
    if ($('#v3-more.open')) { closeMore(); return true; }
    if (v.profileOn && g('_ppVolver')) { _ppVolver(); return true; }
    if (v.landingOn) return false;
    const btn = $$('#app .volver-btn, #app [onclick*="volverAtras"], #app [onclick*="goBack"]').find(b => b.offsetParent);
    if (btn) { btn.click(); return true; }
    if (g('volverAtras')) { volverAtras(); return true; }
    goHome(); return true;
  }
  // Transición suave al cambiar de pantalla
  let lastKey = '';
  function animateView() {
    if (!mqApp.matches) return;
    const v = view();
    const key = [v.landingOn, v.nidoOn, v.profileOn, v.idx, v.sq, location.hash].join('|');
    if (key === lastKey) return;
    lastKey = key;
    const target = v.profileOn ? $('#player-profile-overlay') : v.landingOn ? $('#landing') : $('#app .panel.active') || $('#app');
    if (!target) return;
    target.classList.remove('v3-enter'); void target.offsetWidth; target.classList.add('v3-enter');
  }
  // Barra superior que se "asienta" al scrollear
  function initTopbarScroll() {
    const tb = $('#v3-topbar');
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => { ticking = false; if (tb) tb.classList.toggle('scrolled', window.scrollY > 8); });
    }, { passive: true });
  }
  // Deslizar hacia abajo para actualizar
  function initPullToRefresh() {
    const ptr = document.createElement('div');
    ptr.id = 'v3-ptr';
    ptr.innerHTML = '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg></span>';
    document.body.appendChild(ptr);
    let y0 = null, dy = 0, busy = false;
    const blocked = el => el.closest('#v3-h2h,#v3-search,#v3-titles,#v3-more,.v3-tt-box,input,select,textarea,iframe,[data-noptr]');
    document.addEventListener('touchstart', e => {
      if (!mqApp.matches || busy || window.scrollY > 0 || blocked(e.target)) { y0 = null; return; }
      y0 = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    document.addEventListener('touchmove', e => {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (dy <= 0 || window.scrollY > 0) { ptr.style.transform = ''; ptr.classList.remove('vis', 'ready'); return; }
      const d = Math.min(110, dy * 0.5);
      ptr.classList.add('vis');
      ptr.style.transform = `translate(-50%, ${d}px) rotate(${d * 3}deg)`;
      ptr.classList.toggle('ready', d >= 64);
    }, { passive: true });
    document.addEventListener('touchend', () => {
      if (y0 == null) return;
      const ready = ptr.classList.contains('ready');
      y0 = null;
      if (!ready) { ptr.style.transform = ''; ptr.classList.remove('vis'); return; }
      busy = true; haptic(12);
      ptr.classList.add('spin'); ptr.style.transform = 'translate(-50%, 64px)';
      Promise.resolve(g('loadLiveData') ? window.loadLiveData() : null).catch(() => {}).then(() => {
        safe(renderHeroStats);
        busy = false; ptr.classList.remove('spin', 'vis', 'ready'); ptr.style.transform = '';
        toast('Datos actualizados');
      });
    });
  }
  // Deslizar desde el borde izquierdo para volver
  function initEdgeBack() {
    let x0 = null, y0 = 0;
    const hint = document.createElement('div'); hint.id = 'v3-edge'; document.body.appendChild(hint);
    document.addEventListener('touchstart', e => {
      const t = e.touches[0];
      x0 = (mqApp.matches && t.clientX < 24) ? t.clientX : null; y0 = t.clientY;
    }, { passive: true });
    document.addEventListener('touchmove', e => {
      if (x0 == null) return;
      const dx = e.touches[0].clientX - x0;
      hint.style.opacity = Math.min(1, dx / 90); hint.style.transform = `translateX(${Math.min(40, dx / 3)}px)`;
    }, { passive: true });
    document.addEventListener('touchend', e => {
      if (x0 == null) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dyy = Math.abs(t.clientY - y0);
      x0 = null; hint.style.opacity = 0; hint.style.transform = '';
      if (dx > 90 && dyy < 70 && doBack()) haptic(10);
    });
  }
  // Pantalla de inicio (solo web app instalada)
  function splash() {
    if (!isStandalone() || sessionStorage.getItem('v3splash')) return;
    sessionStorage.setItem('v3splash', '1');
    const s = document.createElement('div');
    s.id = 'v3-splash';
    s.innerHTML = '<img src="logo-csb.webp" alt=""><b>Santa Bárbara</b><span>Estadísticas</span>';
    document.body.appendChild(s);
    setTimeout(() => s.classList.add('out'), 900);
    setTimeout(() => s.remove(), 1400);
  }
  // Accesos rápidos tipo app en el Inicio
  function buildQuickActions() {
    const home = $('.v3-home'); if (!home || $('#v3-qa', home)) return;
    const qa = document.createElement('section');
    qa.id = 'v3-qa';
    const it = (attrs, icon, label) => `<button ${attrs}><span>${icon}</span><b>${label}</b></button>`;
    qa.innerHTML = it('data-nav="nido"', I.nido, 'El Nido') + it('data-nav="h2h"', I.h2h, 'Cara a cara') + it('data-nav="graficos"', I.torneos, 'Torneos') + it('data-nav="historial"', I.historial, 'vs Clubes') + it('data-act="search"', I.search, 'Buscar');
    const champ = $('#v3-champ', home);
    (champ || home.firstChild).after(qa);
  }
  function initApp() {
    document.documentElement.classList.toggle('v3-app', mqApp.matches);
    document.documentElement.classList.toggle('v3-standalone', isStandalone());
    mqApp.addEventListener && mqApp.addEventListener('change', () => document.documentElement.classList.toggle('v3-app', mqApp.matches));
    splash();
    buildQuickActions();
    buildMHome();
    initTopbarScroll();
    initPullToRefresh();
    initEdgeBack();
    document.addEventListener('click', e => { if (e.target.closest('#v3-bottomnav button, .v3-tab, .jx-tabs button, #v3-qa button')) haptic(6); }, true);
    // Botón "atrás" de Android en la web app: cierra hojas abiertas antes de salir
    window.addEventListener('popstate', () => { closeMore(); closeTitles(); });
  }

  // ════════════════ ARRANQUE ════════════════
  function boot() {
    if (!$('#landing') || !$('#app')) return;
    buildShell();
    buildHome();
    buildSearch();
    buildH2H();
    wrapNav();
    wrapJugSub();
    watchTorneo();
    initApp();
    sync(); syncNotif(); syncUpdated();
    // Las cifras del hero dependen de la tabla en vivo — se refrescan cuando llega.
    let tries = 0;
    const iv = setInterval(() => { renderHeroStats(); if (++tries > 40 || (ownRow('a') && ownRow('b'))) clearInterval(iv); }, 1500);
    window.v3 = { openSearch, openH2H, compareWith, goTab, goHome, goNido, switchSquad, sync };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
