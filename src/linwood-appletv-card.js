/* Linwood Apple TV Card v1.3.0 — read-only "now playing" card for Apple TV media players.
 * Tap: iPhone/iPad -> runs an iOS Shortcut that opens the Apple TV Remote for this TV.
 *      Everything else -> opens a popup containing your remote card (e.g. Firemote).
 * v1.3.0: re-renders patch the DOM in place (LinwoodMorph) instead of replacing it — fixes the iOS jump-to-top on tap.
 */
  /* LinwoodMorph — patch live DOM to match new markup instead of replacing it (innerHTML).
   * Replacing recreated every ha-icon, which renders a frame late at zero width: the card briefly shrank and iOS
   * (no scroll anchoring) clamped the page upward — the "jumps to the top when I tap" bug. Shared by every Linwood card. */
  const LwMorph = (() => {
    if (window.LinwoodMorph && window.LinwoodMorph.v >= 2) return window.LinwoodMorph;
    const syncAttrs = (f, t) => {
      for (const a of Array.from(f.attributes)) if (!t.hasAttribute(a.name)) f.removeAttribute(a.name);
      for (const a of Array.from(t.attributes)) if (f.getAttribute(a.name) !== a.value) f.setAttribute(a.name, a.value);
    };
    const syncOne = (f, t, name) => {
      const v = t.getAttribute(name);
      if (f.getAttribute(name) === v) return;
      if (v == null) f.removeAttribute(name); else f.setAttribute(name, v);
    };
    const focused = (el) => { const r = el.getRootNode && el.getRootNode(); return !!r && r.activeElement === el; };
    /* Same kind of node: type + tag, and for elements the first class name (so "dev" matches "dev on"). */
    const cls0 = (n) => (n.getAttribute && (n.getAttribute('class') || '').split(' ')[0]) || '';
    const kind = (a, b) => !!a && !!b && a.nodeType === b.nodeType && a.nodeName === b.nodeName;
    const same = (a, b) => kind(a, b) && (a.nodeType !== 1 || cls0(a) === cls0(b));
    /* Worth looking ahead for an inserted/removed node? Not when the tag matches and only a state class was toggled
     * (class="cur" → class=""), which is a plain update. */
    const differ = (a, b) => !kind(a, b) || (!!cls0(a) && !!cls0(b) && cls0(a) !== cls0(b));
    const nextEl = (n) => { let x = n.nextSibling; while (x && x.nodeType !== 1) x = x.nextSibling; return x; };
    const update = (f, t) => {
      if (f.nodeType !== 1) { if (f.nodeValue !== t.nodeValue) f.nodeValue = t.nodeValue; return; }
      if (f.nodeName === 'HA-ICON') { syncOne(f, t, 'icon'); syncOne(f, t, 'style'); syncOne(f, t, 'class'); return; }
      syncAttrs(f, t);
      morphKids(f, t);
      if (f.nodeName === 'BUTTON') f.disabled = t.hasAttribute('disabled');
      else if (f.nodeName === 'INPUT' && !focused(f)) {
        const v = t.getAttribute('value') || '';
        if (f.value !== v) f.value = v;
        f.checked = t.hasAttribute('checked');
      } else if (f.nodeName === 'SELECT') { const o = t.querySelector('option[selected]'); if (o && f.value !== o.value) f.value = o.value; }
    };
    /* Walks both lists together. When a node appears or disappears (a conditional chip, a status row), it is inserted
     * or removed on its own, so everything after it — and every icon in it — stays put instead of being rebuilt. */
    const morphKids = (from, to) => {
      let f = from.firstChild;
      for (let t = to.firstChild; t; t = t.nextSibling) {
        let guard = 64;
        while (f && differ(f, t) && guard--) {
          const tn = t.nextSibling;
          if (same(f.nextSibling, t) && !same(f, tn)) { const d = f; f = f.nextSibling; from.removeChild(d); continue; }
          if (t.nodeType === 1 && f.nodeType === 1 && same(nextEl(f), t) && !same(f, nextEl(t))) {
            const d = f; f = f.nextSibling; from.removeChild(d); continue;
          }
          break;
        }
        if (!f) { from.appendChild(document.importNode(t, true)); continue; }
        if (!differ(f, t)) { update(f, t); f = f.nextSibling; continue; }
        if (same(f, t.nextSibling) || (t.nodeType === 1 && f.nodeType === 1 && same(f, nextEl(t)))) {
          from.insertBefore(document.importNode(t, true), f); continue;      // t is new: insert, keep f for later
        }
        if (kind(f, t)) { update(f, t); f = f.nextSibling; continue; }
        const n = document.importNode(t, true);
        from.replaceChild(n, f); f = n.nextSibling;
      }
      while (f) { const n = f.nextSibling; from.removeChild(f); f = n; }
    };
    /* Always walks the tree (no string cache): cards also mutate their DOM directly during drags, so the live DOM can
     * differ from the last markup even when the new markup is identical. Unchanged nodes are left alone. */
    const patch = (el, html) => {
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      morphKids(el, tpl.content);
    };
    return (window.LinwoodMorph = { v: 2, patch, morphKids });
  })();
const LAT_APPS = {
  youtube: { c: '#ff2d2d', i: 'mdi:youtube' }, 'youtube tv': { c: '#ff2d2d', i: 'mdi:youtube-tv' },
  netflix: { c: '#e50914', i: 'mdi:netflix' }, 'disney+': { c: '#2f6bff', i: 'mdi:castle' },
  'hbo max': { c: '#7b3fe4', i: 'mdi:alpha-m-box' }, max: { c: '#2e5bff', i: 'mdi:alpha-m-box' },
  'prime video': { c: '#1aa7e8', i: 'mdi:amazon' }, hulu: { c: '#1ce783', i: 'mdi:alpha-h-box' },
  'paramount+': { c: '#2a6bff', i: 'mdi:image-filter-hdr' }, peacock: { c: '#f5b83d', i: 'mdi:feather' },
  plex: { c: '#e5a00d', i: 'mdi:plex' }, twitch: { c: '#9146ff', i: 'mdi:twitch' },
  spotify: { c: '#1db954', i: 'mdi:spotify' }, music: { c: '#fa2d48', i: 'mdi:music-note' },
  podcasts: { c: '#b150e2', i: 'mdi:podcast' }, tv: { c: '#e5e7eb', i: 'mdi:apple' },
  'apple tv': { c: '#e5e7eb', i: 'mdi:apple' }, nfl: { c: '#3b82f6', i: 'mdi:football' },
  espn: { c: '#ef4444', i: 'mdi:alpha-e-box' }, tubi: { c: '#fbbf24', i: 'mdi:alpha-t-box' },
  photos: { c: '#f59e0b', i: 'mdi:image-multiple' }, fitness: { c: '#a3e635', i: 'mdi:run' },
  arcade: { c: '#f43f5e', i: 'mdi:gamepad-variant' }, 'app store': { c: '#3b82f6', i: 'mdi:apple' },
  settings: { c: '#9ca3af', i: 'mdi:cog' }, starz: { c: '#e5e7eb', i: 'mdi:star' },
  cnn: { c: '#ef4444', i: 'mdi:newspaper-variant' }, facetime: { c: '#22c55e', i: 'mdi:video' },
};
const LAT_DEFAULT = { c: '#a78bfa', i: 'mdi:apple' };

class LinwoodAppleTvCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity || !config.entity.startsWith('media_player.')) throw new Error('Set "entity" to an Apple TV media_player');
    this._config = config;
    this._sig = null;
    this._artColor = null;
    this._artFor = null;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.addEventListener('click', () => this._tap());
      this.shadowRoot.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this._tap(); } });
    }
    if (this._hass) this._render(true);
  }

  set hass(hass) {
    this._hass = hass;
    this._render(false);
    if (this._popupCard) this._popupCard.hass = hass;
    if (this._config.debug_open_popup && !this._debugOpened) { this._debugOpened = true; setTimeout(() => this._openPopup(), 600); }
  }

  connectedCallback() { this._startTicker(); }
  disconnectedCallback() { this._stopTicker(); this._closePopup(); }
  getCardSize() { return 3; }
  getGridOptions() { return { columns: 12, rows: 'auto', min_columns: 6 }; }
  static getStubConfig(hass) {
    const e = Object.keys(hass.states).find((k) => k.startsWith('media_player.') && (hass.states[k].attributes.app_id !== undefined));
    return { entity: e || 'media_player.apple_tv' };
  }

  /* ---------- helpers ---------- */
  _st() { return this._hass && this._hass.states[this._config.entity]; }
  _esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  _app(name) { return (name && LAT_APPS[String(name).toLowerCase()]) || LAT_DEFAULT; }
  _clock(sec) {
    if (sec == null || !isFinite(sec) || sec < 0) return '--:--';
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }
  _position(st) {
    const a = st.attributes;
    if (a.media_position == null || !a.media_duration) return null;
    let pos = Number(a.media_position);
    if (st.state === 'playing' && a.media_position_updated_at) pos += (Date.now() - new Date(a.media_position_updated_at).getTime()) / 1000;
    return Math.max(0, Math.min(pos, Number(a.media_duration)));
  }
  _isIOS() {
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  _subtitle(st) {
    const a = st.attributes, parts = [];
    if (a.media_series_title) {
      parts.push(a.media_series_title);
      if (a.media_season != null && a.media_episode != null) parts.push(`S${a.media_season} · E${a.media_episode}`);
    } else {
      if (a.media_artist) parts.push(a.media_artist);
      if (a.media_album_name) parts.push(a.media_album_name);
    }
    return parts.join(' — ');
  }

  /* ---------- artwork colour ---------- */
  _sampleArt(url) {
    if (!url || this._artFor === url) return;
    this._artFor = url;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = 24; c.height = 24;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data;
        let best = null, bestScore = -1, sr = 0, sg = 0, sb = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, sat = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
          const score = sat * (1 - Math.abs(l - 0.55) * 1.6);
          if (score > bestScore) { bestScore = score; best = [r, g, b]; }
          sr += r; sg += g; sb += b; n++;
        }
        const pick = bestScore > 0.25 ? best : [sr / n, sg / n, sb / n];
        this._artColor = `rgb(${pick.map((v) => Math.round(v)).join(',')})`;
      } catch (e) { this._artColor = null; }
      if (this._artFor === url) this._render(true);
    };
    img.onerror = () => { this._artColor = null; };
    img.src = url;
  }

  /* ---------- render ---------- */
  _render(force) {
    if (!this._hass || !this._config) return;
    const st = this._st();
    const a = st ? st.attributes : {};
    const sig = st ? [st.state, a.media_title, a.media_artist, a.media_series_title, a.media_season, a.media_episode, a.app_name, a.entity_picture, a.media_duration, a.media_position, a.media_position_updated_at, this._artColor].join('§') : 'missing';
    if (!force && sig === this._sig) return;
    this._sig = sig;
    if (!st) { LwMorph.patch(this.shadowRoot, `${this._css()}<div class="card empty">Entity not found: ${this._esc(this._config.entity)}</div>`); return; }
    if (a.entity_picture) this._sampleArt(a.entity_picture); else { this._artFor = null; this._artColor = null; }
    LwMorph.patch(this.shadowRoot, this._css() + this._html(st));
    this._tick();
  }

  _html(st) {
    const a = st.attributes, s = st.state;
    const room = this._config.name || a.friendly_name || 'Apple TV';
    const unavailable = s === 'unavailable' || s === 'unknown';
    const off = s === 'off' || s === 'standby' || unavailable;
    const playing = s === 'playing', paused = s === 'paused', live = playing || paused;
    const app = this._app(a.app_name);
    const accent = (live && this._artColor) || (off ? '#6b7280' : app.c);
    const art = live && a.entity_picture ? a.entity_picture : null;

    let title, sub, pill;
    if (unavailable) { title = 'Unavailable'; sub = 'Can’t reach this Apple TV'; pill = ['Offline', 'off']; }
    else if (off) { title = 'Asleep'; sub = 'Tap to wake it with the remote'; pill = ['Off', 'off']; }
    else if (live && (a.media_title || a.app_name)) { title = a.media_title || a.app_name; sub = this._subtitle(st); pill = playing ? ['Playing', 'play'] : ['Paused', 'pause']; }
    else { title = a.app_name ? `In ${a.app_name}` : 'Home screen'; sub = 'Nothing playing'; pill = ['Idle', 'idle']; }

    const hasProg = live && a.media_duration > 0 && a.media_position != null;
    const ios = this._isIOS();
    const hint = ios && this._config.remote_shortcut ? 'Tap to open the iPhone remote' : 'Tap for remote';
    const hintIcon = ios && this._config.remote_shortcut ? 'mdi:cellphone-arrow-down-variant' : 'mdi:remote-tv';
    const glyph = off ? 'mdi:power-sleep' : (live || a.app_name ? app.i : 'mdi:apple');

    return `
<div class="card s-${pill[1]}${art ? ' has-art' : ''}${this._config.embedded ? ' emb' : ''}" style="--ac:${accent}" role="button" tabindex="0" aria-label="${this._esc(room)} — ${this._esc(title)}. ${this._esc(hint)}">
  <div class="bg">
    ${art ? `<div class="bgart" style="background-image:url('${this._esc(art)}')"></div>` : ''}
    <div class="aurora a1"></div><div class="aurora a2"></div>
    <div class="scan"></div>
  </div>
  <div class="head">
    <span class="dev"><ha-icon icon="mdi:apple"></ha-icon>${this._esc(room.toUpperCase())}</span>
    <span class="pill p-${pill[1]}">${pill[1] === 'play' || pill[1] === 'pause' ? '<span class="eq"><i></i><i></i><i></i><i></i></span>' : '<span class="dot"></span>'}${pill[0]}</span>
  </div>
  <div class="hero">
    <div class="tile${art ? ' art' : ''}">
      ${art ? `<img src="${this._esc(art)}" alt="" loading="lazy">` : `<ha-icon icon="${glyph}"></ha-icon>`}
      <span class="sheen"></span>
    </div>
    <div class="meta">
      ${a.app_name && !off ? `<span class="appchip"><ha-icon icon="${app.i}"></ha-icon>${this._esc(a.app_name)}</span>` : ''}
      <div class="title">${this._esc(title)}</div>
      ${sub ? `<div class="sub">${this._esc(sub)}</div>` : ''}
    </div>
  </div>
  ${hasProg ? `
  <div class="prog">
    <div class="bar"><div class="fill"></div><div class="knob"></div></div>
    <div class="times"><span class="el">--:--</span><span class="rem">--:--</span></div>
  </div>` : ''}
  <div class="foot"><ha-icon icon="${hintIcon}"></ha-icon><span>${hint}</span><ha-icon class="chev" icon="mdi:chevron-right"></ha-icon></div>
</div>`;
  }

  _tick() {
    const st = this._st();
    if (!st || !this.shadowRoot) return;
    const fill = this.shadowRoot.querySelector('.fill');
    if (!fill) return;
    const pos = this._position(st), dur = Number(st.attributes.media_duration);
    const pct = pos != null && dur ? (pos / dur) * 100 : 0;
    fill.style.width = `${pct}%`;
    const knob = this.shadowRoot.querySelector('.knob'); if (knob) knob.style.left = `${pct}%`;
    const el = this.shadowRoot.querySelector('.el'), rem = this.shadowRoot.querySelector('.rem');
    if (el) el.textContent = this._clock(pos);
    if (rem) rem.textContent = `-${this._clock(dur - pos)}`;
  }
  _startTicker() { this._stopTicker(); this._timer = setInterval(() => { const st = this._st(); if (st && st.state === 'playing') this._tick(); }, 1000); }
  _stopTicker() { if (this._timer) clearInterval(this._timer); this._timer = null; }

  /* ---------- tap ---------- */
  _tap() {
    const mode = this._config.tap_mode || 'auto';
    const useApp = mode === 'remote_app' || (mode === 'auto' && this._isIOS() && this._config.remote_shortcut);
    if (useApp) {
      const url = `shortcuts://run-shortcut?name=${encodeURIComponent(this._config.remote_shortcut)}`;
      this.dispatchEvent(new CustomEvent('hass-action', { bubbles: true, composed: true, detail: { config: { tap_action: { action: 'url', url_path: url } }, action: 'tap' } }));
      return;
    }
    if (this._config.popup_card) this._openPopup();
    else this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId: this._config.entity } }));
  }

  async _openPopup() {
    if (this._overlay) return;
    const host = document.createElement('div');
    host.setAttribute('data-linwood-appletv-popup', '');
    const root = host.attachShadow({ mode: 'open' });
    const st = this._st();
    const a = st ? st.attributes : {};
    const room = this._config.name || a.friendly_name || 'Apple TV';
    const accent = this._artColor || this._app(a.app_name).c;
    root.innerHTML = `${this._popupCss()}
<div class="ov" part="overlay"><div class="dlg" role="dialog" aria-modal="true" aria-label="${this._esc(room)} remote" style="--ac:${accent}">
  <div class="dh"><span class="dt"><ha-icon icon="mdi:apple"></ha-icon>${this._esc(room)}</span><button class="x" aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button></div>
  <div class="slot"><div class="ld">Loading remote…</div></div>
</div></div>`;
    document.body.appendChild(host);
    this._overlay = host;
    const close = () => this._closePopup();
    root.querySelector('.x').addEventListener('click', close);
    root.querySelector('.ov').addEventListener('click', (ev) => { if (ev.target === ev.currentTarget) close(); });
    this._esc_h = (ev) => { if (ev.key === 'Escape') close(); };
    window.addEventListener('keydown', this._esc_h);
    requestAnimationFrame(() => root.querySelector('.ov').classList.add('in'));
    try {
      const helpers = await window.loadCardHelpers();
      const el = await helpers.createCardElement(this._config.popup_card);
      el.hass = this._hass;
      this._popupCard = el;
      if (!this._overlay) return;
      const slot = root.querySelector('.slot');
      slot.innerHTML = '';
      slot.appendChild(el);
    } catch (err) {
      const slot = root.querySelector('.slot');
      if (slot) slot.innerHTML = `<div class="ld">Couldn’t load the remote card: ${this._esc(err && err.message ? err.message : err)}</div>`;
    }
  }

  _closePopup() {
    if (!this._overlay) return;
    window.removeEventListener('keydown', this._esc_h);
    this._overlay.remove();
    this._overlay = null;
    this._popupCard = null;
  }

  /* ---------- styles ---------- */
  _css() {
    return `<style>
:host { display:block; }
* { box-sizing:border-box; }
ha-icon { display:inline-flex; --mdc-icon-size:18px; }
.card { position:relative; overflow:hidden; isolation:isolate; border-radius:28px; padding:20px 20px 16px; cursor:pointer; color:#f3f4f6;
  background:#121419; border:1px solid color-mix(in srgb, var(--ac) 22%, rgba(255,255,255,0.07));
  font-family:var(--ha-font-family-body, Roboto, sans-serif); transition:transform .18s ease, border-color .3s; -webkit-tap-highlight-color:transparent; outline:none; }
.card:hover { border-color:color-mix(in srgb, var(--ac) 45%, rgba(255,255,255,0.1)); }
.card:active { transform:scale(.985); }
.card:focus-visible { box-shadow:0 0 0 2px var(--ac); }
.empty { padding:24px; color:#9aa0aa; cursor:default; }
/* embedded in the Theater card: sizes come from inherited --lat-* variables so the host can switch to a tall "screen" layout */
.card.emb { height:100%; display:flex; flex-direction:column; border-radius:24px; padding:16px 16px 12px; background:#0e1014; }
.card.emb .hero { flex:var(--lat-grow, 0) 1 auto; display:flex; flex-direction:var(--lat-dir, row); justify-content:center; align-items:center; gap:var(--lat-gap, 16px); text-align:var(--lat-align, left); }
.card.emb .tile { flex:none; width:var(--lat-tile, 76px); height:var(--lat-tile, 76px); border-radius:var(--lat-radius, 20px); transition:width .3s, height .3s; }
.card.emb .tile ha-icon, .card.emb.s-off .tile ha-icon { --mdc-icon-size:var(--lat-icon, 40px); }
.card.emb .meta { width:var(--lat-meta-w, auto); flex:var(--lat-meta-flex, 1); align-items:var(--lat-items, stretch); }
.card.emb .appchip { align-self:var(--lat-self, flex-start); }
.card.emb .title { font-size:var(--lat-title, 20px); }
.card.emb .foot { margin-top:12px; padding-top:10px; }
.bg { position:absolute; inset:0; z-index:-1; pointer-events:none; }
.bgart { position:absolute; inset:-30%; background-size:cover; background-position:center; filter:blur(38px) saturate(1.4); opacity:.45; transform:scale(1.1); }
.aurora { position:absolute; border-radius:50%; filter:blur(30px); opacity:.55; }
.a1 { width:70%; height:120%; top:-40%; left:-20%; background:radial-gradient(closest-side, color-mix(in srgb, var(--ac) 55%, transparent), transparent); }
.a2 { width:60%; height:90%; bottom:-50%; right:-15%; background:radial-gradient(closest-side, color-mix(in srgb, var(--ac) 30%, #6366f1 12%), transparent); opacity:.4; }
.s-play .a1 { animation:drift 14s ease-in-out infinite alternate; }
.s-play .a2 { animation:drift2 18s ease-in-out infinite alternate; }
.s-off .aurora, .s-idle .a2 { opacity:.12; }
.s-off .bgart { display:none; }
.scan { position:absolute; inset:0; background:linear-gradient(180deg, rgba(18,20,25,0) 0%, rgba(18,20,25,.55) 55%, rgba(18,20,25,.92) 100%),
  repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 3px); }
.head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.dev { display:flex; align-items:center; gap:6px; font-size:12px; letter-spacing:.16em; font-weight:700; color:#9aa0aa; }
.dev ha-icon { --mdc-icon-size:15px; color:#d1d5db; margin-top:-2px; }
.pill { display:inline-flex; align-items:center; gap:7px; padding:5px 11px 5px 9px; border-radius:999px; font-size:12.5px; font-weight:700; letter-spacing:.02em;
  background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.08); color:#e5e7eb; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
.p-play { background:color-mix(in srgb, var(--ac) 22%, rgba(0,0,0,0.25)); border-color:color-mix(in srgb, var(--ac) 50%, transparent); color:#fff; }
.p-off { color:#9aa0aa; }
.dot { width:7px; height:7px; border-radius:50%; background:currentColor; opacity:.8; }
.eq { display:inline-flex; align-items:flex-end; gap:2px; height:11px; }
.eq i { width:2.5px; height:100%; border-radius:2px; background:currentColor; transform-origin:bottom; }
.p-play .eq i { animation:eq 1s ease-in-out infinite; }
.p-play .eq i:nth-child(2) { animation-delay:-.4s; animation-duration:.8s; }
.p-play .eq i:nth-child(3) { animation-delay:-.2s; animation-duration:1.15s; }
.p-play .eq i:nth-child(4) { animation-delay:-.6s; animation-duration:.9s; }
.p-pause .eq i { transform:scaleY(.35); }
.hero { display:grid; grid-template-columns:auto minmax(0,1fr); gap:16px; align-items:center; margin-top:16px; }
.tile { position:relative; width:84px; height:84px; border-radius:22px; display:flex; align-items:center; justify-content:center; overflow:hidden;
  background:linear-gradient(150deg, color-mix(in srgb, var(--ac) 85%, white 8%), color-mix(in srgb, var(--ac) 55%, #0b0d11));
  box-shadow:0 14px 30px -10px color-mix(in srgb, var(--ac) 70%, transparent), inset 0 1px 0 rgba(255,255,255,0.25); }
.tile ha-icon { --mdc-icon-size:42px; color:#fff; filter:drop-shadow(0 2px 6px rgba(0,0,0,.35)); }
.tile.art { background:#000; }
.tile.art img { width:100%; height:100%; object-fit:cover; display:block; }
.sheen { position:absolute; inset:0; background:linear-gradient(130deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 42%); pointer-events:none; }
.s-off .tile { background:linear-gradient(150deg, #2a2d34, #15171c); box-shadow:inset 0 1px 0 rgba(255,255,255,0.08); }
.s-off .tile ha-icon { color:#6b7280; filter:none; --mdc-icon-size:36px; }
.s-idle .tile { box-shadow:0 10px 24px -12px color-mix(in srgb, var(--ac) 50%, transparent), inset 0 1px 0 rgba(255,255,255,0.2); }
.meta { min-width:0; display:flex; flex-direction:column; gap:5px; }
.appchip { align-self:flex-start; display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--ac); }
.appchip ha-icon { --mdc-icon-size:14px; }
.s-off .appchip { color:#6b7280; }
.title { font-size:20px; line-height:1.18; font-weight:700; letter-spacing:-0.01em; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.s-off .title { color:#9aa0aa; }
.sub { font-size:13.5px; color:#a1a7b1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.prog { margin-top:16px; }
.bar { position:relative; height:5px; border-radius:3px; background:rgba(255,255,255,0.1); }
.fill { position:absolute; inset:0 auto 0 0; width:0; border-radius:3px; background:linear-gradient(90deg, color-mix(in srgb, var(--ac) 70%, white 10%), var(--ac)); box-shadow:0 0 12px color-mix(in srgb, var(--ac) 70%, transparent); transition:width .9s linear; }
.knob { position:absolute; top:50%; left:0; width:11px; height:11px; margin:-5.5px 0 0 -5.5px; border-radius:50%; background:#fff; box-shadow:0 0 0 3px color-mix(in srgb, var(--ac) 45%, transparent); transition:left .9s linear; }
.s-pause .fill { opacity:.6; box-shadow:none; }
.times { display:flex; justify-content:space-between; margin-top:7px; font-size:11.5px; font-weight:600; color:#9aa0aa; font-variant-numeric:tabular-nums; }
.foot { display:flex; align-items:center; gap:8px; margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.07); font-size:12.5px; font-weight:600; color:#9aa0aa; }
.foot ha-icon { --mdc-icon-size:16px; color:color-mix(in srgb, var(--ac) 70%, white 20%); }
.s-off .foot ha-icon { color:#9aa0aa; }
.foot .chev { margin-left:auto; color:#6b7280; transition:transform .2s; }
.card:hover .chev { transform:translateX(3px); }
@keyframes eq { 0%,100% { transform:scaleY(.3); } 50% { transform:scaleY(1); } }
@keyframes drift { from { transform:translate(0,0) scale(1); } to { transform:translate(18%,10%) scale(1.15); } }
@keyframes drift2 { from { transform:translate(0,0); } to { transform:translate(-14%,-12%) scale(1.1); } }
@media (prefers-reduced-motion: reduce) { .aurora, .eq i, .fill, .knob { animation:none !important; transition:none !important; } }
</style>`;
  }

  _popupCss() {
    return `<style>
* { box-sizing:border-box; }
ha-icon { display:inline-flex; --mdc-icon-size:20px; }
.ov { position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; padding:24px;
  background:rgba(5,6,9,0); backdrop-filter:blur(0px); -webkit-backdrop-filter:blur(0px); transition:background .22s, backdrop-filter .22s; font-family:Roboto, sans-serif; }
.ov.in { background:rgba(5,6,9,0.62); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); }
.dlg { position:relative; max-height:calc(100vh - 48px); overflow:auto; min-width:280px; padding:16px 18px 20px; border-radius:28px; color:#f3f4f6;
  background:radial-gradient(120% 60% at 0% 0%, color-mix(in srgb, var(--ac) 22%, transparent), transparent 60%), #15171c;
  border:1px solid color-mix(in srgb, var(--ac) 30%, rgba(255,255,255,0.08)); box-shadow:0 30px 80px -20px rgba(0,0,0,.8);
  opacity:0; transform:translateY(12px) scale(.97); transition:opacity .22s, transform .22s; }
.ov.in .dlg { opacity:1; transform:none; }
.dh { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
.dt { display:flex; align-items:center; gap:8px; font-size:15px; font-weight:700; letter-spacing:.02em; }
.dt ha-icon { --mdc-icon-size:18px; color:#d1d5db; margin-top:-2px; }
.x { width:36px; height:36px; border-radius:12px; border:none; cursor:pointer; color:#e5e7eb; background:rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; }
.x:hover { background:rgba(255,255,255,0.14); }
.slot { display:flex; justify-content:center; }
.ld { padding:40px 20px; color:#9aa0aa; font-size:14px; }
@media (prefers-reduced-motion: reduce) { .ov, .dlg { transition:none; } }
</style>`;
  }
}

if (!customElements.get('linwood-appletv-card')) customElements.define('linwood-appletv-card', LinwoodAppleTvCard);
window.customCards = window.customCards || [];
if (!window.customCards.find((c) => c.type === 'linwood-appletv-card')) {
  window.customCards.push({ type: 'linwood-appletv-card', name: 'Linwood Apple TV Card', description: 'Read-only now-playing card for Apple TV; tap opens the iPhone remote or a remote popup', preview: false });
}
