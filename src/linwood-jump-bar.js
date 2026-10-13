/* Linwood Jump Bar v1.0.0 — "jump to" chips for the Plant Care view.
 *  - One chip per plant tile in linwood-plant-card (tiles carry id="lpc-<i>", Plant Card 3.6+) plus one for the
 *    linwood-grow-lights-card. Plant names and colours come from the plant card's own config, so new plants appear here
 *    automatically. A small amber dot marks a plant that needs something today (feed, water, water change, never logged).
 *  - Sits under the view header. Once it scrolls off the top it docks as a floating bar just below the iPhone status bar
 *    (plus the stock header when that's showing, e.g. in edit mode), with a back-to-top button, and highlights the
 *    section currently under it.
 *  - A tap scrolls so the section starts just below the docked bar, and briefly outlines it. If the plant card is filtered
 *    (Side light / Left bar / Right bar), the filter is reset to All first so every plant can be reached.
 *  - The host carries data-lw-jump so Linwood Shell 1.3.3+ lets these intentional upward jumps past its iPhone scroll guard.
 * Config:
 *   type: custom:linwood-jump-bar
 *   lights_label: Grow lights   # optional
 *   dock: true                  # optional — false keeps it inline only
 */
(() => {
  if (customElements.get('linwood-jump-bar')) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  /* breadth-first search for a custom element by tag, through light DOM and open shadow roots */
  const deepFind = (start, tag, maxDepth = 8) => {
    let level = [start];
    for (let d = 0; d <= maxDepth && level.length; d++) {
      const next = [];
      for (const n of level) {
        const kids = n.children ? Array.from(n.children) : [];
        for (const k of kids) {
          if (k.localName === tag) return k;
          next.push(k);
          if (k.shadowRoot) next.push(k.shadowRoot);
        }
      }
      level = next;
    }
    return null;
  };

  class LinwoodJumpBar extends HTMLElement {
    constructor() {
      super();
      this._found = {};
      this._miss = {};
      this._active = null;
      this._lockUntil = 0;
      this._keySig = '';
      this._onScroll = () => {
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => { this._raf = 0; this._spy(); });
      };
    }

    setConfig(config) {
      this._cfg = { lights_label: 'Grow lights', dock: true, ...(config || {}) };
      if (!this.shadowRoot) this._init();
      this._keySig = '';
      this._sync();
    }

    set hass(hass) {
      this._hass = hass;
      /* the plant card repaints in its own hass setter; read its tiles a frame later */
      cancelAnimationFrame(this._syncRaf);
      this._syncRaf = requestAnimationFrame(() => this._sync());
    }

    getCardSize() { return 1; }
    getGridOptions() { return { columns: 'full', rows: 'auto' }; }

    connectedCallback() {
      this.setAttribute('data-lw-jump', '');
      document.addEventListener('scroll', this._onScroll, { capture: true, passive: true });
      window.addEventListener('resize', this._onScroll, { passive: true });
      this._sync();
      this._onScroll();
    }

    disconnectedCallback() {
      document.removeEventListener('scroll', this._onScroll, { capture: true });
      window.removeEventListener('resize', this._onScroll);
      this._setDock(false);
      this._found = {};
      this._miss = {};
      this._hdr = null;
    }

    _init() {
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = `${this._css()}
<span class="probe" aria-hidden="true"></span>
<nav class="bar" aria-label="Jump to a plant"><div class="row"></div></nav>
<nav class="dock" aria-label="Jump to a plant">
  <button class="top" data-go="top" aria-label="Back to top"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
  <div class="row"></div>
</nav>`;
      this._bar = this.shadowRoot.querySelector('.bar');
      this._dock = this.shadowRoot.querySelector('.dock');
      this._probe = this.shadowRoot.querySelector('.probe');
      this._rows = Array.from(this.shadowRoot.querySelectorAll('.row'));
      this.shadowRoot.addEventListener('click', (ev) => {
        const b = ev.composedPath().find((x) => x.dataset && x.dataset.go);
        if (b) this._go(b.dataset.go);
      });
    }

    /* ---------- finding the other cards ---------- */
    _find(tag) {
      const hit = this._found[tag];
      if (hit && hit.isConnected) return hit;
      const now = performance.now();
      if (this._miss[tag] && now - this._miss[tag] < 2000) return null;   // don't re-walk the page on every update
      let node = this;
      for (let i = 0; i < 6 && node; i++) {
        const root = node.getRootNode();
        const el = deepFind(root, tag);
        if (el) { this._found[tag] = el; delete this._miss[tag]; return el; }
        node = root.host;
      }
      this._miss[tag] = now;
      return null;
    }
    _plantCard() { return this._find('linwood-plant-card'); }
    _lightsCard() { return this._find('linwood-grow-lights-card'); }
    _target(key, prep) {
      if (key === 'lights') return this._lightsCard();
      const pc = this._plantCard();
      if (!pc || !pc.shadowRoot) return null;
      let t = pc.shadowRoot.getElementById(key);
      if (!t && prep && pc._filter && pc._filter !== 'all' && typeof pc._paint === 'function') {
        pc._filter = 'all';
        pc._paint();
        t = pc.shadowRoot.getElementById(key);
      }
      return t;
    }

    /* ---------- chips ---------- */
    _items() {
      const pc = this._plantCard();
      const plants = pc && pc._config && Array.isArray(pc._config.plants) ? pc._config.plants : [];
      const items = plants.map((p, i) => ({ key: `lpc-${i}`, name: p.name || `Plant ${i + 1}`, color: p.color || '#4ade80' }));
      if (this._lightsCard()) items.push({ key: 'lights', name: this._cfg.lights_label, lights: true });
      return items;
    }

    _sync() {
      if (!this.shadowRoot || !this._cfg) return;
      const items = this._items();
      const sig = items.map((it) => `${it.key}:${it.name}:${it.color || ''}`).join('|');
      if (sig !== this._keySig) {
        this._keySig = sig;
        this._keys = items.map((it) => it.key);
        const chips = items.map((it) => (it.lights
          ? `<button class="chip gl" data-go="lights" title="Jump to ${esc(it.name)}"><ha-icon icon="mdi:lightbulb-outline"></ha-icon><span>${esc(it.name)}</span><i class="ct"></i></button>`
          : `<button class="chip" data-go="${it.key}" style="--pc:${esc(it.color)}" title="Jump to ${esc(it.name)}"><span class="dot"></span><span>${esc(it.name)}</span><span class="nd" aria-hidden="true"></span></button>`)).join('');
        this._rows.forEach((r, i) => { r.innerHTML = (i === 0 ? '<span class="lbl">Jump to</span>' : '') + chips; });
        this.toggleAttribute('empty', !items.length);
        this._paintActive();
      }
      this._paintState();
    }

    _paintState() {
      const sr = this.shadowRoot;
      (this._keys || []).forEach((key) => {
        const chips = sr.querySelectorAll(`[data-go="${key}"]`);
        if (key === 'lights') {
          const lc = this._lightsCard();
          const ls = lc && lc._config && Array.isArray(lc._config.lights) ? lc._config.lights : [];
          const h = this._hass;
          const on = h ? ls.filter((l) => h.states[l.entity] && h.states[l.entity].state === 'on').length : 0;
          chips.forEach((c) => {
            c.classList.toggle('lit', on > 0);
            const ic = c.querySelector('ha-icon');
            const icon = on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline';
            if (ic && ic.getAttribute('icon') !== icon) ic.setAttribute('icon', icon);
            const ct = c.querySelector('.ct');
            const txt = on ? `${on}/${ls.length}` : '';
            if (ct && ct.textContent !== txt) ct.textContent = txt;
          });
          return;
        }
        const t = this._target(key);
        const due = '.wat.s-due:not(.lrn), .wat.s-overdue, .water.s-due, .water.s-overdue';
        const need = !!t && (t.matches('.s-overdue, .s-due, .s-unlogged') || !!t.querySelector(due));
        const late = !!t && (t.matches('.s-overdue') || !!t.querySelector('.wat.s-overdue, .water.s-overdue'));
        chips.forEach((c) => { c.classList.toggle('need', need); c.classList.toggle('late', late); });
      });
    }

    _setActive(key) {
      if (key === this._active) return;
      this._active = key;
      this._paintActive();
      const chip = key && this._dock.querySelector(`[data-go="${key}"]`);
      const row = this._rows[1];
      if (chip && row && this.hasAttribute('docked')) {
        const l = chip.offsetLeft, r = l + chip.offsetWidth;   // .row is position:relative, so these are row content coords
        if (l < row.scrollLeft + 16 || r > row.scrollLeft + row.clientWidth - 24) {
          row.scrollTo({ left: Math.max(0, l - 24), behavior: reduce() ? 'auto' : 'smooth' });
        }
      }
    }
    _paintActive() {
      this.shadowRoot.querySelectorAll('.chip').forEach((c) => {
        const on = c.dataset.go === this._active;
        c.classList.toggle('on', on);
        c.setAttribute('aria-current', on ? 'true' : 'false');
      });
    }

    /* ---------- geometry ---------- */
    _inset() {
      /* px covered at the top of the viewport: the status bar / notch, or the stock header when it's showing */
      const safe = this._probe ? this._probe.offsetHeight : 0;
      let hdr = 0;
      if (!this._hdr || !this._hdr.isConnected) {
        this._hdr = null;
        let n = this;
        for (let i = 0; i < 12 && n; i++) {
          const root = n.getRootNode();
          if (!root.host) break;
          if (root.host.localName === 'hui-root') { this._hdr = root.host.shadowRoot.querySelector('.header'); break; }
          n = root.host;
        }
      }
      if (this._hdr && getComputedStyle(this._hdr).display !== 'none') {
        const r = this._hdr.getBoundingClientRect();
        if (r.height && r.bottom > 0) hdr = r.bottom;
      }
      return Math.max(safe, hdr);
    }
    _dockH() { return (this._dock && this._dock.offsetHeight) || 50; }

    _setDock(on, br, inset) {
      if (!this._dock) return;
      on = !!on && this._cfg && this._cfg.dock !== false && !this.hasAttribute('empty');
      if (on && br) {
        this.style.setProperty('--dt', `${Math.round(inset + 6)}px`);
        this.style.setProperty('--dl', `${Math.round(br.left)}px`);
        this.style.setProperty('--dw', `${Math.round(br.width)}px`);
      }
      if (on === this.hasAttribute('docked')) return;
      this.toggleAttribute('docked', on);
      this._dock.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (this._pop) {
        try { if (on) this._dock.showPopover(); else if (this._dock.matches(':popover-open')) this._dock.hidePopover(); } catch (e) { /* ignore */ }
      }
      if (on) this._checkFixed(inset);
    }

    /* position:fixed breaks if an ancestor is ever transformed; then fall back to the top layer (popover) */
    _checkFixed(inset) {
      if (this._checked || this._pop) return;
      this._checked = true;
      setTimeout(() => {
        if (!this.hasAttribute('docked')) { this._checked = false; return; }
        const r = this._dock.getBoundingClientRect();
        if (Math.abs(r.top - (inset + 6)) > 8 && typeof this._dock.showPopover === 'function') {
          this._pop = true;
          this._dock.setAttribute('popover', 'manual');
          try { this._dock.showPopover(); } catch (e) { /* ignore */ }
        }
      }, 450);
    }

    _spy() {
      if (!this.isConnected || !this._bar) return;
      const inset = this._inset();
      const br = this._bar.getBoundingClientRect();
      const docked = br.height > 0 && br.bottom < inset + 2;
      this._setDock(docked, br, inset);
      if (performance.now() < this._lockUntil) return;
      if (!docked) { this._setActive(null); return; }
      const line = inset + this._dockH() + 28;
      let best = null, bestTop = -Infinity;
      (this._keys || []).forEach((key) => {
        const t = this._target(key);
        if (!t) return;
        const r = t.getBoundingClientRect();
        if (r.height && r.top <= line && r.bottom > line && r.top > bestTop) { best = key; bestTop = r.top; }
      });
      if (best) this._setActive(best);
    }

    /* ---------- jumping ---------- */
    _go(key) {
      this.dispatchEvent(new CustomEvent('haptic', { detail: 'selection', bubbles: true, composed: true }));
      const behavior = reduce() ? 'auto' : 'smooth';
      if (key === 'top') {
        this._lockUntil = performance.now() + 1200;
        this._setActive(null);
        window.scrollTo({ top: 0, behavior });
        return;
      }
      const t = this._target(key, true);
      if (!t) return;
      const y = t.getBoundingClientRect().top + window.scrollY - (this._inset() + this._dockH() + 12);
      this._lockUntil = performance.now() + 1500;
      this._setActive(key);
      window.scrollTo({ top: Math.max(0, Math.round(y)), behavior });
      this._settle(() => {
        this._lockUntil = 0;
        this._flash(key, t);
      });
    }

    /* wait until the smooth scroll stops (no scrollend on older iOS) */
    _settle(done) {
      let last = window.scrollY, still = 0;
      const t0 = performance.now();
      const step = () => {
        const y = window.scrollY;
        still = Math.abs(y - last) < 1 ? still + 1 : 0;
        last = y;
        if (still >= 4 || performance.now() - t0 > 1600) done();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    _flash(key, t) {
      let el = t, c = '#fde68a';
      if (key === 'lights') {
        el = (t.shadowRoot && t.shadowRoot.querySelector('.card')) || t;
      } else {
        const chip = this.shadowRoot.querySelector(`[data-go="${key}"]`);
        c = (chip && chip.style.getPropertyValue('--pc')) || '#4ade80';
      }
      if (typeof el.animate !== 'function') return;
      el.animate([
        { boxShadow: '0 0 0 0 transparent' },
        { boxShadow: `0 0 0 3px ${c}, 0 0 34px -4px ${c}`, offset: 0.3 },
        { boxShadow: '0 0 0 0 transparent' },
      ], { duration: 1400, easing: 'ease-out' });
    }

    _css() {
      return `<style>
:host { display:block; position:relative; }
:host([empty]) { display:none; }
* { box-sizing:border-box; }
.probe { position:absolute; top:0; left:0; width:0; height:env(safe-area-inset-top, 0px); visibility:hidden; pointer-events:none; }
button { font:inherit; color:inherit; background:none; border:none; padding:0; margin:0; cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
ha-icon { --mdc-icon-size:16px; display:inline-flex; flex:none; }
.row { position:relative; display:flex; align-items:center; gap:6px; overflow-x:auto; overscroll-behavior-x:contain; scrollbar-width:none; -webkit-overflow-scrolling:touch;
  -webkit-mask-image:linear-gradient(90deg, #000 0, #000 calc(100% - 28px), transparent); mask-image:linear-gradient(90deg, #000 0, #000 calc(100% - 28px), transparent); padding-right:24px; }
.row::-webkit-scrollbar { display:none; }
.lbl { flex:none; margin:0 4px 0 2px; font-size:11px; letter-spacing:.14em; font-weight:700; color:#8b919c; text-transform:uppercase; font-family:var(--ha-font-family-body, Roboto, sans-serif); }
.chip { position:relative; flex:none; display:inline-flex; align-items:center; gap:7px; height:38px; padding:0 13px 0 11px; border-radius:12px; white-space:nowrap;
  background:rgba(255,255,255,0.045); border:1px solid rgba(255,255,255,0.07); color:#cbd5e1; font-family:var(--ha-font-family-body, Roboto, sans-serif); font-size:13px; font-weight:600;
  transition:background .2s, border-color .2s, color .2s, transform .1s; }
.chip:hover { background:rgba(255,255,255,0.08); }
.chip:active { transform:scale(.96); }
.chip:focus-visible, .top:focus-visible { outline:2px solid #f5b83d; outline-offset:1px; }
.dot { width:9px; height:9px; border-radius:50%; background:var(--pc); box-shadow:0 0 0 2px color-mix(in srgb, var(--pc) 22%, transparent); }
.nd { display:none; width:7px; height:7px; margin-left:-2px; border-radius:50%; background:#f5b83d; box-shadow:0 0 8px rgba(245,184,61,.8); }
.chip.need .nd { display:block; }
.chip.late .nd { background:#f87171; box-shadow:0 0 8px rgba(248,113,113,.8); }
.chip.gl ha-icon { color:#8b919c; }
.chip.gl.lit { color:#fde68a; }
.chip.gl.lit ha-icon { color:#f5b83d; }
.ct { font-style:normal; font-weight:600; font-size:12px; color:#9aa0aa; font-variant-numeric:tabular-nums; }
.ct:empty { display:none; }
.chip.on { background:rgba(245,184,61,0.15); border-color:rgba(245,184,61,0.45); color:#fde68a; }
.chip.on .ct { color:#f5b83d; }
.bar { padding:2px 0; }
/* docked copy — fixed to the viewport, aligned to the inline bar's column */
.dock { position:fixed; z-index:6; inset:auto; top:var(--dt, 8px); left:var(--dl, 12px); right:auto; bottom:auto; width:var(--dw, calc(100vw - 24px)); height:auto; margin:0; overflow:visible;
  display:flex; align-items:center; gap:6px; padding:6px; border-radius:18px; color:inherit;
  background:rgba(16,18,24,.80); -webkit-backdrop-filter:blur(16px) saturate(140%); backdrop-filter:blur(16px) saturate(140%);
  border:1px solid rgba(255,255,255,0.08); box-shadow:0 14px 34px -14px rgba(0,0,0,.85);
  opacity:0; visibility:hidden; pointer-events:none; transform:translateY(-12px);
  transition:opacity .2s ease, transform .26s cubic-bezier(.2,.8,.2,1), visibility 0s linear .26s; }
:host([docked]) .dock { opacity:1; visibility:visible; pointer-events:auto; transform:none; transition:opacity .2s ease, transform .26s cubic-bezier(.2,.8,.2,1), visibility 0s; }
.dock[popover]:not(:popover-open) { display:none; }
.dock .row { flex:1; min-width:0; }
.dock .chip { height:36px; }
.top { flex:none; width:36px; height:36px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.07); color:#cbd5e1; }
.top ha-icon { --mdc-icon-size:18px; }
.top:active { transform:scale(.94); }
@media (prefers-reduced-motion: reduce) { .dock, :host([docked]) .dock, .chip { transition:none; } }
</style>`;
    }
  }

  customElements.define('linwood-jump-bar', LinwoodJumpBar);
  window.customCards = window.customCards || [];
  if (!window.customCards.find((c) => c.type === 'linwood-jump-bar')) {
    window.customCards.push({ type: 'linwood-jump-bar', name: 'Linwood Jump Bar', description: 'Jump-to chips for each plant and the grow lights; docks to the top while you scroll', preview: false });
  }
})();
