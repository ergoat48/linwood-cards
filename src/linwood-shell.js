/* Linwood Shell v1.4.0 — replaces the sidebar's panel list with Linwood room navigation, restyles the sidebar to match the
 * Linwood dashboard, and hides the stock dashboard toolbar (title / back arrow / edit menu) on the Linwood dashboard.
 *  - Sidebar: our <linwood-nav> is slotted into ha-sidebar's "main-navigation" slot (a supported slot in the frontend), so the
 *    native list (Overview, Map, History, HACS …) is replaced while Settings / Notifications / Profile stay untouched below.
 *  - Header: hidden on the DASHES dashboards, never in edit mode. "Edit dashboard" sits at the bottom of the nav; /<dash>/<view>?edit=1 also works.
 *  - Phone: anything inside the dashboard carrying a data-lw-menu attribute opens the sidebar drawer (the stock header is gone).
 *  - iPhone scroll guard (v1.3.0): a tap no longer throws the page back to the top. See "scroll guard" below.
 *  - v1.3.1: Living Room lives in home-v2 (/home-v2/living-room). After any navigation (and on first load) the header check
 *    runs every frame for 1.5 s, so a freshly built dashboard panel gets its header hidden before it can flash.
 *  - v1.3.2: three living-room grow lights (side, mantel left, mantel right) instead of one; Plant Care and Living Room show
 *    how many are on.
 *  - v1.3.3: taps inside an element carrying data-lw-jump (the Linwood Jump Bar) are intentional scrolls, so the scroll
 *    guard ignores them — otherwise it would undo every jump back up the page.
 *  - v1.4.0: iPhone status bar. With the stock header hidden, the view's top spacing used only HA's --safe-area-inset-top,
 *    which follows the Companion app's --app-safe-area-inset-top when the app sets one — and that can come through smaller
 *    than the real status bar / Dynamic Island, so the top of every view slid under the clock. The spacing now uses the
 *    larger of that variable and the browser's own env(safe-area-inset-top) (what the Jump Bar and plant popup already
 *    trust). A frosted strip the height of the status bar also stays pinned at the top, so content scrolled up passes
 *    under it instead of colliding with the time and battery. Desktop and edit mode are unchanged (the inset is 0 / the
 *    stock header is back).
 * Everything is configured in NAV below.
 */
(() => {
  if (window.__linwoodShell) return;
  window.__linwoodShell = '1.4.0';

  const DASHES = ['home-v2', 'living-room'];   // dashboards that get the Linwood treatment (no stock header, Edit link in the nav)
  const BRAND = 'Linwood';
  const GROW = ['switch.side_grow_light', 'switch.living_room_mantle_left_grow_light', 'switch.mantle_right_grow_light'];
  const on = (h, id) => !!h && !!h.states[id] && h.states[id].state === 'on';
  const st = (h, id) => (h && h.states[id] ? h.states[id].state : undefined);
  const countOn = (h, ids) => ids.filter((id) => on(h, id)).length;
  const lights = (n) => (n ? `${n} light${n > 1 ? 's' : ''}` : '');
  /* meta(hass) → { text, hot, alert } — `hot` lights the amber dot, `alert` turns it red */
  const NAV = [
    { group: 'Home', items: [
      { name: 'Home', icon: 'mdi:home-variant', path: '/home-v2/home', match: ['/home-v2', '/home-v2/home'],
        meta: (h) => { const w = h && h.states['weather.forecast_home']; return { text: w && w.attributes.temperature != null ? `${Math.round(w.attributes.temperature)}°` : '' }; } },
      { name: 'Plant Care', icon: 'mdi:sprout', path: '/home-v2/plants',
        meta: (h) => { const s = window.LinwoodPlantSummary ? window.LinwoodPlantSummary(h) : null; const g = countOn(h, GROW);
          if (s && s.due) return { text: `${s.due} due`, hot: true, alert: s.overdue };
          return { text: g ? `${g} light${g > 1 ? 's' : ''} on` : '', hot: g > 0 }; } },
    ] },
    { group: 'Rooms', items: [
      { name: 'Bedroom', icon: 'mdi:bed-king-outline', path: '/home-v2/bedroom',
        meta: (h) => { const n = countOn(h, ['light.bedroom_main_lights', 'light.bedroom_lamp_1', 'light.bedroom_lamp_2']); const tv = !['off', 'standby', 'unavailable', undefined].includes(st(h, 'media_player.lg_g4_oled')); return { text: [tv ? 'TV' : '', lights(n)].filter(Boolean).join(' · '), hot: n > 0 || tv }; } },
      { name: 'Living Room', icon: 'mdi:sofa-outline', path: '/home-v2/living-room',
        meta: (h) => { const tv = ['on', 'playing', 'paused', 'idle'].includes(st(h, 'media_player.television_2')); const g = countOn(h, GROW) > 0; return { text: [tv ? 'TV' : '', g ? 'Grow lights' : ''].filter(Boolean).join(' · '), hot: tv || g }; } },
      { name: 'Office', icon: 'mdi:desk', path: '/home-v2/office',
        meta: (h) => { const n = countOn(h, ['light.office_office_main_lights']); return { text: lights(n), hot: n > 0 }; } },
      { name: 'Basement', icon: 'mdi:stairs-down', path: '/home-v2/basement',
        meta: (h) => { const t = !['off', 'unavailable', undefined].includes(st(h, 'media_player.home_theater')); const l = on(h, 'light.basement_lamp'); return { text: [t ? 'Theater' : '', l ? 'Lamp' : ''].filter(Boolean).join(' · '), hot: t || l }; } },
      { name: 'Garage', icon: 'mdi:garage', path: '/home-v2/garage',
        meta: (h) => { const d = st(h, 'cover.ratgdo32disco_ce0244_door'); const open = d && !['closed', 'unavailable'].includes(d); const l = on(h, 'light.garage_dimmer'); return { text: open ? `Door ${d}` : l ? 'Light' : '', hot: l, alert: open }; } },
    ] },
  ];

  /* ---------- tokens (same palette as the Linwood cards) ---------- */
  const T = { bg: '#0f1116', line: 'rgba(255,255,255,0.06)', text: '#f3f4f6', soft: '#cbd5e1', muted: '#9aa0aa', label: '#6b7280', amber: '#f5b83d', red: '#f87171' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const navigate = (path) => {
    if (location.pathname + location.search === path) return;
    history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  };
  const matches = (it, p) => (it.match || [it.path]).some((m) => p === m || p.startsWith(`${m}/`)) || p === it.path;

  /* ---------- sidebar navigation ---------- */
  class LinwoodNav extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `<style>${this._css()}</style><div class="nav"></div>`;
      this._box = this.shadowRoot.querySelector('.nav');
      this.shadowRoot.addEventListener('click', (ev) => {
        const a = ev.composedPath().find((x) => x.dataset && x.dataset.path);
        if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
        ev.preventDefault();
        navigate(a.dataset.path);
      });
    }
    update(hass) {
      const p = location.pathname;
      const admin = !!(hass && hass.user && hass.user.is_admin);
      const onDash = DASHES.includes(p.split('/')[1]);
      const groups = NAV.map((g) => `<div class="grp"><div class="gl">${esc(g.group)}</div>${g.items.map((it) => {
        const m = it.meta ? it.meta(hass) || {} : {};
        const sel = matches(it, p);
        const dot = m.alert ? ' alert' : m.hot ? ' hot' : '';
        const tip = m.text ? `${it.name} · ${m.text}` : it.name;
        return `<a class="it${sel ? ' sel' : ''}" href="${esc(it.path)}" data-path="${esc(it.path)}" title="${esc(tip)}" aria-current="${sel ? 'page' : 'false'}">
          <span class="ic${dot}"><ha-icon icon="${esc(it.icon)}"></ha-icon></span><span class="nm">${esc(it.name)}</span><span class="mt${m.alert ? ' a' : ''}">${esc(m.text || '')}</span></a>`;
      }).join('')}</div>`).join('');
      const edit = admin && onDash
        ? `<a class="it tool" href="${esc(p)}?edit=1" data-path="${esc(p)}?edit=1" title="Edit this dashboard"><span class="ic"><ha-icon icon="mdi:pencil-outline"></ha-icon></span><span class="nm">Edit dashboard</span><span class="mt"></span></a>`
        : '';
      const html = groups + (edit ? `<div class="grp tools">${edit}</div>` : '');
      if (html !== this._last) { this._box.innerHTML = html; this._last = html; }
    }
    _css() {
      return `
:host { display:block; }
* { box-sizing:border-box; }
.nav { display:flex; flex-direction:column; gap:14px; padding:4px 0 8px; }
.grp { display:flex; flex-direction:column; gap:3px; }
.gl { height:18px; padding:0 18px; font-size:10.5px; letter-spacing:.16em; font-weight:700; text-transform:uppercase; color:${T.label}; white-space:nowrap; overflow:hidden; transition:opacity .2s; }
:host(:not([expanded])) .gl { opacity:0; height:6px; }
.it { position:relative; display:flex; align-items:center; gap:12px; height:46px; margin:0 8px; padding:0 8px 0 6px; border-radius:16px; text-decoration:none; color:${T.soft};
  border:1px solid transparent; transition:background .2s, border-color .2s, width .2s; -webkit-tap-highlight-color:transparent; }
:host(:not([expanded])) .it { width:44px; margin:0 6px; padding:0 5px; gap:0; }
.it:hover { background:rgba(255,255,255,0.045); }
.it:focus-visible { outline:2px solid ${T.amber}; outline-offset:1px; }
.ic { position:relative; flex:none; width:32px; height:32px; border-radius:11px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.06); color:${T.muted}; transition:all .2s; }
.ic ha-icon { --mdc-icon-size:19px; display:flex; }
.ic.hot::after, .ic.alert::after { content:''; position:absolute; top:-2px; right:-2px; width:8px; height:8px; border-radius:50%; background:${T.amber}; box-shadow:0 0 0 2px ${T.bg}, 0 0 8px rgba(245,184,61,.8); }
.ic.alert::after { background:${T.red}; box-shadow:0 0 0 2px ${T.bg}, 0 0 8px rgba(248,113,113,.8); }
.nm { flex:1; min-width:0; font-size:14.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:opacity .2s; }
.mt { flex:none; max-width:96px; font-size:12px; color:${T.muted}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:opacity .2s; }
.mt.a { color:${T.red}; }
:host(:not([expanded])) .nm, :host(:not([expanded])) .mt { opacity:0; width:0; flex:0 0 0; }
.it.sel { color:${T.text}; background:linear-gradient(145deg, rgba(245,184,61,0.17), rgba(245,184,61,0.04)); border-color:rgba(245,184,61,0.40); }
.it.sel .ic { background:${T.amber}; color:#1a1206; box-shadow:0 0 16px rgba(245,184,61,.35); }
.it.sel .mt { color:${T.amber}; }
:host(:not([expanded])) .it.sel { background:none; border-color:transparent; }
.tools { padding-top:10px; border-top:1px solid ${T.line}; margin:0 12px; }
.tools .it { margin:0 -4px; height:40px; color:${T.muted}; }
.tools .ic { background:none; }
:host(:not([expanded])) .tools { margin:0 6px; }
:host(:not([expanded])) .tools .it { margin:0; }
@media (prefers-reduced-motion: reduce) { * { transition:none !important; } }`;
    }
  }
  if (!customElements.get('linwood-nav')) customElements.define('linwood-nav', LinwoodNav);

  /* ---------- styles injected into the stock components ---------- */
  const SIDEBAR_VARS = {
    '--sidebar-background-color': T.bg, '--sidebar-icon-color': T.muted, '--sidebar-text-color': T.soft,
    '--sidebar-selected-icon-color': T.amber, '--sidebar-selected-text-color': T.amber, '--sidebar-menu-button-text-color': T.text,
    '--sidebar-menu-button-background-color': 'transparent', '--divider-color': T.line, '--dark-divider-opacity': '0.14',
  };
  const SIDEBAR_CSS = `
.menu { border-bottom:1px solid ${T.line}; }
.title { font-size:18px; font-weight:700; letter-spacing:-.01em; color:${T.text}; }
ha-list-nav.before-spacer { margin-block:12px 8px; }
ha-list-nav.after-spacer { margin-block:6px 10px; padding-top:8px; border-top:1px solid ${T.line}; }
ha-list-item-button { border-radius:14px; }
ha-list-item-button.selected::before { border-radius:14px; }
ha-list-item-button::part(headline) { font-weight:600; }`;
  const DRAWER_CSS = `.sidebar-shell { border-inline-end:1px solid ${T.line} !important; }`;
  const ROOT_CSS = `
:host([lw-nohdr]) { --lw-safe-top:max(var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px)); }
:host([lw-nohdr]) .header { display:none !important; }
:host([lw-nohdr]) hui-view-container,
:host([lw-nohdr]) hui-view-container.has-tab-bar { padding-top:calc(var(--lw-safe-top) + var(--view-container-padding-top, 0px)) !important; }
:host([lw-nohdr])::before { content:''; position:fixed; z-index:5; top:0; left:0; right:0; height:var(--lw-safe-top); pointer-events:none;
  background:rgba(13,15,19,0.82); -webkit-backdrop-filter:blur(14px) saturate(140%); backdrop-filter:blur(14px) saturate(140%); }`;
  const inject = (root, id, css) => {
    if (!root || root.getElementById?.(id) || root.querySelector?.(`#${id}`)) return;
    const s = document.createElement('style'); s.id = id; s.textContent = css; root.appendChild(s);
  };

  /* ---------- wiring ---------- */
  const els = () => {
    const ha = document.querySelector('home-assistant');
    const main = ha && ha.shadowRoot && ha.shadowRoot.querySelector('home-assistant-main');
    const mr = main && main.shadowRoot;
    return { ha, main, sidebar: mr && mr.querySelector('ha-sidebar'), drawer: mr && mr.querySelector('ha-drawer'), resolver: mr && mr.querySelector('partial-panel-resolver') };
  };
  let nav = null;
  const tick = () => {
    const { ha, sidebar, drawer, resolver } = els();
    const hass = ha && ha.hass;
    if (sidebar) {
      if (!nav || nav.parentNode !== sidebar) {
        nav = sidebar.querySelector(':scope > linwood-nav') || document.createElement('linwood-nav');
        nav.setAttribute('slot', 'main-navigation');
        if (nav.parentNode !== sidebar) sidebar.appendChild(nav);
        Object.entries(SIDEBAR_VARS).forEach(([k, v]) => sidebar.style.setProperty(k, v));
        if (sidebar.sidebarTitle !== BRAND) sidebar.sidebarTitle = BRAND;
      }
      if (sidebar.shadowRoot) inject(sidebar.shadowRoot, 'lw-sidebar-css', SIDEBAR_CSS);
      nav.toggleAttribute('expanded', sidebar.hasAttribute('expanded'));
      nav.update(hass);
    }
    if (drawer && drawer.shadowRoot) inject(drawer.shadowRoot, 'lw-drawer-css', DRAWER_CSS);
    if (resolver) {
      resolver.querySelectorAll('ha-panel-lovelace').forEach((panel) => {
        const root = panel.shadowRoot && panel.shadowRoot.querySelector('hui-root');
        if (!root || !root.shadowRoot) return;
        inject(root.shadowRoot, 'lw-root-css', ROOT_CSS);
        const lv = root.lovelace;
        const dash = (root.route && root.route.prefix ? root.route.prefix.slice(1) : null) || (lv && lv.urlPath);
        const hide = !!lv && DASHES.includes(dash) && !lv.editMode;
        if (root.hasAttribute('lw-nohdr') !== hide) root.toggleAttribute('lw-nohdr', hide);
      });
    }
  };
  /* After a navigation (or on first load) a new dashboard panel is built asynchronously, so a single check one frame later
   * usually finds nothing yet and the stock header shows until the 700 ms poll. Run the check every frame for 1.5 s instead. */
  let burstUntil = 0;
  const burst = () => { tick(); if (performance.now() < burstUntil) requestAnimationFrame(burst); };
  const kick = () => {
    const idle = performance.now() >= burstUntil;
    burstUntil = performance.now() + 1500;
    if (idle) requestAnimationFrame(burst);
  };
  window.addEventListener('location-changed', kick);
  window.addEventListener('popstate', kick);
  setInterval(tick, 700);
  tick();
  kick();

  /* ---------- scroll guard (touch only, Linwood dashboards only, never in edit mode) ----------
   * iOS has no scroll anchoring: when a tap changes a card and the page is shorter for even one frame (an icon or
   * template re-rendering), WebKit clamps the scroll position and the page jumps up. The Linwood cards no longer do
   * that, but stock tiles and button-cards can. Two layers:
   *  1. From touchstart until 1.5 s after the finger lifts, the view container keeps at least its current height,
   *     so a transient shrink cannot clamp the scroll position.
   *  2. If the page still jumps up by more than 120 px within 1.5 s of a tap that wasn't a scroll gesture and didn't
   *     navigate anywhere, it is put back where it was (at most 3 times per tap).
   * Taps inside [data-lw-jump] (the Linwood Jump Bar) are meant to scroll the page, so neither layer applies to them. */
  const liveRoot = () => {
    const { resolver } = els();
    const panel = resolver && resolver.querySelector('ha-panel-lovelace');
    const root = panel && panel.shadowRoot && panel.shadowRoot.querySelector('hui-root');
    return root && root.hasAttribute('lw-nohdr') && root.shadowRoot ? root : null;   // lw-nohdr = Linwood dashboard, not editing
  };
  const isJump = (ev) => ev.composedPath().some((x) => x && x.hasAttribute && x.hasAttribute('data-lw-jump'));
  let held = null, relT = 0;
  const free = () => { clearTimeout(relT); if (held) held.style.removeProperty('min-height'); held = null; };
  const hold = () => {
    const root = liveRoot();
    const box = root && root.shadowRoot.querySelector('hui-view-container');
    if (!box) return;
    if (held && held !== box) free();
    clearTimeout(relT);
    const h = Math.ceil(box.getBoundingClientRect().height);
    if (!held || h > (held._lwH || 0)) { box.style.setProperty('min-height', `max(100vh, ${h}px)`); box._lwH = h; }
    held = box;
  };
  const freeSoon = () => { clearTimeout(relT); relT = setTimeout(free, 1500); };

  let tap = null, lastY = window.scrollY, movedAt = 0;
  document.addEventListener('touchstart', (ev) => {
    if (ev.touches.length !== 1 || !liveRoot() || isJump(ev)) { tap = null; return; }
    const t = ev.touches[0];
    tap = { x: t.clientX, y: t.clientY, path: location.pathname, at: 0, fixes: 0 };
    lastY = window.scrollY;
    hold();
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', (ev) => {
    const t = ev.touches[0];
    if (tap && t && (Math.abs(t.clientX - tap.x) > 10 || Math.abs(t.clientY - tap.y) > 10)) { movedAt = Date.now(); tap = null; }
  }, { capture: true, passive: true });
  const lift = () => { if (tap) tap.at = Date.now(); if (held) freeSoon(); };
  document.addEventListener('touchend', lift, { capture: true, passive: true });
  document.addEventListener('touchcancel', () => { tap = null; if (held) freeSoon(); }, { capture: true, passive: true });
  window.addEventListener('location-changed', () => { free(); tap = null; });
  window.addEventListener('popstate', () => { free(); tap = null; });
  window.addEventListener('scroll', () => {
    const y = window.scrollY, now = Date.now();
    const recent = tap && location.pathname === tap.path && (!tap.at || now - tap.at < 1500) && now - movedAt > 1000;
    if (recent && lastY - y > 120 && tap.fixes < 3 && liveRoot()) {
      tap.fixes++;
      const to = lastY;
      requestAnimationFrame(() => window.scrollTo(0, to));
      return;                                   // keep lastY: this was a jump, not the user scrolling
    }
    lastY = y;
  }, { passive: true });

  /* Phone: no stock header on the dashboard, so [data-lw-menu] elements open the sidebar drawer.
   * The button lives inside a button-card, whose action handler calls preventDefault() on touchend — iOS then never
   * produces a click. So taps are taken from pointer events (fire before the touch events), then touchend, then click,
   * in the capture phase, de-duplicated so one tap opens the drawer once.
   * Note: a button-card with no actions sets pointer-events:none on its card, so the button itself needs pointer-events:auto. */
  const isMenu = (ev) => ev.composedPath().some((x) => x && x.hasAttribute && x.hasAttribute('data-lw-menu'));
  let lastOpen = 0;
  const openMenu = () => {
    if (Date.now() - lastOpen < 700) return;
    lastOpen = Date.now();
    const { main } = els();
    if (main) main.dispatchEvent(new CustomEvent('hass-toggle-menu', { bubbles: true, composed: true }));
  };
  const far = (a, b) => Math.abs(a.x - b.x) > 12 || Math.abs(a.y - b.y) > 12;

  let pDown = null;
  document.addEventListener('pointerdown', (ev) => {
    pDown = ev.pointerType !== 'mouse' && isMenu(ev) ? { x: ev.clientX, y: ev.clientY } : null;
  }, true);
  document.addEventListener('pointerup', (ev) => {
    if (!pDown) return;
    const d = pDown; pDown = null;
    if (!far(d, { x: ev.clientX, y: ev.clientY })) openMenu();
  }, true);
  document.addEventListener('pointercancel', () => { pDown = null; }, true);

  let tDown = null;
  document.addEventListener('touchstart', (ev) => {
    tDown = ev.touches.length === 1 && isMenu(ev) ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY } : null;
  }, { capture: true, passive: true });
  document.addEventListener('touchend', (ev) => {
    if (!tDown) return;
    const d = tDown; tDown = null;
    const t = ev.changedTouches[0];
    ev.stopPropagation();                       // keep button-card from treating it as its own tap
    if (t && far(d, { x: t.clientX, y: t.clientY })) return;   // a scroll, not a tap
    if (ev.cancelable) ev.preventDefault();     // no ghost click landing on the drawer's scrim
    openMenu();
  }, { capture: true });
  document.addEventListener('click', (ev) => {
    if (!isMenu(ev)) return;
    ev.preventDefault(); ev.stopPropagation();
    openMenu();
  }, true);
})();
