/* Linwood Kit v1.3.0 — light, switch and garage cards for Home Assistant.
 *   custom:linwood-light-card   — glow dimmer, warmth strip, colour swatches, per-light chips
 *   custom:linwood-switch-card  — list of switches with big toggles + optional live wattage
 *   custom:linwood-garage-card  — animated garage door, hold-to-open, sensor/accessory chips
 *   (custom:linwood-theater-card lives in linwood-theater-card.js and reuses LinwoodKit.Base)
 * v1.3.0: re-renders patch the DOM in place (LinwoodMorph) instead of replacing it — fixes the iOS jump-to-top on tap.
 */
(() => {
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
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const kelvinToRgb = (k) => {
    const t = clamp(k, 1000, 40000) / 100;
    let r, g, b;
    if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
    else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255; }
    return [r, g, b].map((v) => Math.round(clamp(v, 0, 255)));
  };
  const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;
  const ago = (iso) => {
    if (!iso) return '';
    const d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (d >= today) return `since ${t}`;
    const y = new Date(today); y.setDate(y.getDate() - 1);
    if (d >= y) return `since yesterday ${t}`;
    return `since ${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  };
  const moreInfo = (el, entityId) => el.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId } }));

  const BASE_CSS = `
:host { display:block; }
* { box-sizing:border-box; }
button { font:inherit; color:inherit; background:none; border:none; padding:0; margin:0; cursor:pointer; -webkit-tap-highlight-color:transparent; }
button:disabled { cursor:default; opacity:.45; }
ha-icon { display:inline-flex; --mdc-icon-size:18px; }
.card { position:relative; overflow:hidden; isolation:isolate; border-radius:28px; padding:20px; color:#f3f4f6;
  background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.07); font-family:var(--ha-font-family-body, Roboto, sans-serif); }
.hd { display:flex; align-items:center; gap:10px; }
.ttl { flex:1; font-size:13px; letter-spacing:.14em; font-weight:600; color:#8b919c; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.meta { font-size:14px; font-weight:600; color:#9aa0aa; white-space:nowrap; }
.empty { color:#9aa0aa; padding:6px 0; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation:none !important; transition:none !important; } }`;

  class LinwoodBase extends HTMLElement {
    setConfig(config) {
      this._config = config;
      this._sig = null;
      if (!this.shadowRoot) { this.attachShadow({ mode: 'open' }); this._wire(); }
      if (this._hass) this._render(true);
    }
    set hass(hass) { this._hass = hass; if (!this._busy) this._render(false); }
    getCardSize() { return 4; }
    getGridOptions() { return { columns: 12, rows: 'auto', min_columns: 6 }; }
    _st(id) { return id && this._hass ? this._hass.states[id] : undefined; }
    _name(id, fallback) { const s = this._st(id); return fallback || (s && s.attributes.friendly_name) || id; }
    _call(domain, service, data) {
      return this._hass.callService(domain, service, data).catch((err) => {
        this.dispatchEvent(new CustomEvent('hass-notification', { bubbles: true, composed: true, detail: { message: `${domain}.${service}: ${err.message || err}` } }));
        this._render(true);
      });
    }
    _render(force) {
      if (!this._hass || !this._config) return;
      const sig = this._signature();
      if (!force && sig === this._sig) return;
      this._sig = sig;
      LwMorph.patch(this.shadowRoot, `<style>${BASE_CSS}${this._css()}</style>${this._html()}`);
      if (this._after) this._after();
    }
    _wire() {}
  }

  /* =========================================================================================
   * LIGHT CARD
   * =======================================================================================*/
  const SWATCHES = [[255, 147, 41], [255, 82, 54], [255, 45, 120], [196, 77, 255], [99, 102, 241], [56, 189, 248], [45, 212, 191], [132, 204, 22]];
  class LinwoodLightCard extends LinwoodBase {
    setConfig(config) {
      if (!config || (!config.entities && !config.entity)) throw new Error('Set "entities" (list of lights) or "entity"');
      const list = (config.entities || [config.entity]).map((e) => (typeof e === 'string' ? { entity: e } : e));
      this._items = list;
      this._group = config.group || null;
      this._focus = this._focus && [this._group, ...list.map((i) => i.entity)].includes(this._focus) ? this._focus : (this._group || list[0].entity);
      this._pending = {};
      super.setConfig(config);
    }
    getCardSize() { return 5; }
    _item(id) { return this._items.find((i) => i.entity === id) || {}; }
    _label(id) { if (id === this._group) return this._config.group_name || 'All'; const it = this._item(id); return it.name || this._name(id); }
    _isLight(id) { return id && id.startsWith('light.'); }
    _caps(st) {
      if (!st || !this._isLight(st.entity_id)) return { dim: false, ct: false, color: false };
      const m = st.attributes.supported_color_modes || [];
      return { dim: m.some((x) => x !== 'onoff'), ct: m.includes('color_temp'), color: m.some((x) => ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'].includes(x)) };
    }
    _pct(st) {
      const p = this._pending[st.entity_id];
      if (p && p.b != null && Date.now() - p.t < 6000) return p.b;
      if (st.state !== 'on') return 0;
      const b = st.attributes.brightness;
      return b == null ? 100 : Math.max(1, Math.round((b / 255) * 100));
    }
    _color(st) {
      const p = this._pending[st.entity_id];
      if (p && p.rgb && Date.now() - p.t < 6000) return p.rgb;
      if (p && p.k && Date.now() - p.t < 6000) return kelvinToRgb(p.k);
      const a = st.attributes;
      if (st.state === 'on') {
        if (a.color_mode === 'color_temp' && a.color_temp_kelvin) return kelvinToRgb(a.color_temp_kelvin);
        if (a.rgb_color) return a.rgb_color;
      }
      const caps = this._caps(st);
      return caps.ct || caps.color ? [255, 176, 96] : [245, 184, 61];
    }
    _kelvinRange(st) {
      const a = st.attributes;
      return [Math.max(2000, a.min_color_temp_kelvin || 2000), Math.min(6500, a.max_color_temp_kelvin || 6500)];
    }
    _signature() {
      const ids = [this._group, ...this._items.map((i) => i.entity)].filter(Boolean);
      return ids.map((id) => { const s = this._st(id); return s ? `${s.state}|${s.attributes.brightness}|${s.attributes.color_temp_kelvin}|${(s.attributes.rgb_color || []).join(',')}|${s.attributes.color_mode}` : '-'; }).join('§') + this._focus + JSON.stringify(this._pending);
    }
    _css() {
      return `
.card { padding:20px 20px 18px; }
.amb { position:absolute; z-index:-1; top:-140px; right:-120px; width:380px; height:380px; border-radius:50%; pointer-events:none;
  background:radial-gradient(closest-side, rgba(var(--lc), calc(.32 * var(--lv))), transparent); transition:background .5s; }
.pwr { width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.07);
  border:1px solid rgba(255,255,255,0.1); color:#9aa0aa; transition:all .25s; }
.pwr ha-icon { --mdc-icon-size:22px; }
.pwr.on { background:rgb(var(--lc)); border-color:transparent; color:#1a1206; box-shadow:0 0 22px rgba(var(--lc), .55); }
.chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
.chip { flex:none; display:flex; align-items:center; gap:8px; padding:7px 12px 7px 8px; border-radius:14px; background:rgba(255,255,255,0.05);
  border:1px solid rgba(255,255,255,0.06); font-size:13px; font-weight:600; color:#cbd5e1; transition:background .2s, border-color .2s; }
.chip .bulb { width:22px; height:22px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.08); color:#6b7280; }
.chip .bulb ha-icon { --mdc-icon-size:14px; }
.chip.on .bulb { background:rgb(var(--cc)); color:#1a1206; box-shadow:0 0 10px rgba(var(--cc), .6); }
.chip .pc { font-size:11.5px; color:#8b919c; font-variant-numeric:tabular-nums; }
.chip.sel { background:rgba(255,255,255,0.11); border-color:rgba(255,255,255,0.18); color:#fff; }
.focus { margin-top:16px; }
.fname { display:flex; align-items:baseline; gap:10px; }
.fname b { font-size:22px; font-weight:700; letter-spacing:-0.01em; }
.fname span { font-size:14px; color:#9aa0aa; }
.slider { position:relative; margin-top:12px; height:64px; border-radius:20px; overflow:hidden; cursor:pointer; touch-action:pan-y;
  background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.07); user-select:none; -webkit-user-select:none; }
.slider .fill { position:absolute; inset:0 auto 0 0; width:0; border-radius:20px 14px 14px 20px;
  background:linear-gradient(90deg, rgba(var(--lc), .55), rgb(var(--lc))); box-shadow:0 0 30px rgba(var(--lc), .45); transition:width .25s ease; }
.slider.drag .fill { transition:none; }
.slider .grip { position:absolute; top:14px; bottom:14px; width:4px; margin-left:-12px; border-radius:2px; background:rgba(255,255,255,.85); transition:left .25s ease; }
.slider.drag .grip { transition:none; }
.slider .lbl { position:absolute; inset:0; display:flex; align-items:center; justify-content:space-between; padding:0 18px; pointer-events:none; }
.slider .lbl .v { font-size:26px; font-weight:700; letter-spacing:-0.02em; font-variant-numeric:tabular-nums; mix-blend-mode:normal; }
.slider .lbl ha-icon { --mdc-icon-size:22px; opacity:.8; }
.slider.off .lbl .v { color:#6b7280; }
.slider.dark .lbl { color:#1a1206; }
.bigtog { margin-top:12px; height:64px; width:100%; border-radius:20px; display:flex; align-items:center; justify-content:center; gap:10px; font-size:18px; font-weight:700;
  background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.07); color:#9aa0aa; transition:all .25s; }
.bigtog ha-icon { --mdc-icon-size:24px; }
.bigtog.on { background:linear-gradient(90deg, rgba(var(--lc), .6), rgb(var(--lc))); color:#1a1206; border-color:transparent; box-shadow:0 0 30px rgba(var(--lc), .4); }
.row2 { display:flex; align-items:center; gap:12px; margin-top:14px; }
.rk { flex:none; width:52px; font-size:10.5px; letter-spacing:.12em; font-weight:700; color:#8b919c; text-transform:uppercase; }
.warm { position:relative; flex:1; height:26px; border-radius:13px; cursor:pointer; touch-action:pan-y; border:1px solid rgba(255,255,255,0.08); }
.warm .mk { position:absolute; top:50%; width:20px; height:20px; margin:-10px 0 0 -10px; border-radius:50%; border:3px solid #fff; box-shadow:0 1px 6px rgba(0,0,0,.5); pointer-events:none; transition:left .25s; }
.warm.drag .mk { transition:none; }
.sw { flex:1; display:grid; grid-template-columns:repeat(8, minmax(0, 26px)); justify-content:space-between; gap:6px; }
.sw button { width:100%; aspect-ratio:1; padding:0; border-radius:50%; border:2px solid rgba(255,255,255,0.12); transition:transform .15s; }
.sw button:hover { transform:scale(1.12); }
.sw button.cur { border-color:#fff; box-shadow:0 0 0 2px rgba(255,255,255,0.25); }
.xpt { width:100%; display:flex; align-items:center; gap:10px; margin-top:12px; padding:10px 12px; border-radius:16px; background:rgba(255,255,255,0.035);
  border:1px solid rgba(255,255,255,0.06); font-size:13px; font-weight:600; color:#cbd5e1; text-align:left; transition:background .2s; }
.xpt:hover { background:rgba(255,255,255,0.06); }
.xdot { width:14px; height:14px; border-radius:50%; flex:none; box-shadow:0 0 10px var(--xc); border:1px solid rgba(255,255,255,0.25); }
.xl { flex:1; }
.xv { color:#8b919c; font-size:12.5px; font-variant-numeric:tabular-nums; }
.xpt ha-icon { --mdc-icon-size:20px; color:#8b919c; transition:transform .25s; }
.xpt.open ha-icon { transform:rotate(180deg); }
.xp { display:grid; grid-template-rows:0fr; transition:grid-template-rows .28s ease; }
.xp.open { grid-template-rows:1fr; }
.xpi { overflow:hidden; min-height:0; padding:0 2px; }
.xp .row2:last-child { margin-bottom:4px; }`;
    }
    _html() {
      const ids = this._items.map((i) => i.entity);
      const states = ids.map((id) => this._st(id)).filter(Boolean);
      const onCount = states.filter((s) => s.state === 'on').length;
      const fst = this._st(this._focus);
      const anyOn = fst ? fst.state === 'on' : false;
      const title = this._config.title || 'Lights';
      if (!fst) return `<div class="card"><div class="hd"><span class="ttl">${esc(title)}</span></div><div class="empty">Entity not found: ${esc(this._focus)}</div></div>`;
      const caps = this._caps(fst);
      const on = fst.state === 'on';
      const pct = this._pct(fst);
      const col = this._color(fst);
      const unavailable = fst.state === 'unavailable';
      const lv = on ? (0.35 + pct / 150) : 0.08;
      const meta = ids.length > 1 ? `${onCount} of ${ids.length} on` : (on ? 'On' : unavailable ? 'Offline' : 'Off');
      const showChips = ids.length > 1 || this._group;
      const chipIds = [...(this._group ? [this._group] : []), ...ids];
      const chips = showChips ? `<div class="chips">${chipIds.map((id) => {
        const s = this._st(id); if (!s) return '';
        const c = this._color(s), o = s.state === 'on', p = this._pct(s);
        const it = this._item(id);
        const icon = id === this._group ? 'mdi:lightbulb-group' : (it.icon || (this._isLight(id) ? 'mdi:lightbulb' : 'mdi:power-socket-us'));
        return `<button class="chip${o ? ' on' : ''}${id === this._focus ? ' sel' : ''}" data-act="focus" data-id="${id}" style="--cc:${c.join(',')}"><span class="bulb"><ha-icon icon="${icon}"></ha-icon></span>${esc(this._label(id))}${o && this._caps(s).dim ? `<span class="pc">${p}%</span>` : ''}</button>`;
      }).join('')}</div>` : '';
      let stateTxt;
      if (unavailable) stateTxt = 'Offline';
      else if (!on) stateTxt = 'Off';
      else {
        const bits = [];
        if (caps.dim) bits.push(`${pct}%`);
        if (fst.attributes.color_mode === 'color_temp' && fst.attributes.color_temp_kelvin) bits.push(`${Math.round(fst.attributes.color_temp_kelvin / 100) * 100}K`);
        else if (caps.color && fst.attributes.color_mode && fst.attributes.color_mode !== 'color_temp' && fst.attributes.color_mode !== 'brightness') bits.push('Colour');
        stateTxt = bits.join(' · ') || 'On';
      }
      const dark = on && (col[0] * 0.299 + col[1] * 0.587 + col[2] * 0.114) > 150 && pct > 22;
      const control = caps.dim
        ? `<div class="slider${on ? '' : ' off'}${dark ? ' dark' : ''}" data-act="slider" ${unavailable ? 'aria-disabled="true"' : ''}>
             <div class="fill" style="width:${on ? pct : 0}%"></div><div class="grip" style="left:${on ? pct : 0}%; ${on ? '' : 'display:none'}"></div>
             <div class="lbl"><span class="v">${on ? pct + '%' : 'Off'}</span><ha-icon icon="${on ? 'mdi:brightness-6' : 'mdi:lightbulb-outline'}"></ha-icon></div></div>`
        : `<button class="bigtog${on ? ' on' : ''}" data-act="toggle" data-id="${this._focus}" ${unavailable ? 'disabled' : ''}><ha-icon icon="${on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline'}"></ha-icon>${on ? 'On' : 'Off'}</button>`;
      let warm = '';
      if (caps.ct) {
        const [kmin, kmax] = this._kelvinRange(fst);
        const stops = [0, 0.25, 0.5, 0.75, 1].map((f) => rgb(kelvinToRgb(kmin + (kmax - kmin) * f))).join(',');
        const p = this._pending[this._focus];
        const k = (p && p.k && Date.now() - p.t < 6000) ? p.k : (fst.attributes.color_mode === 'color_temp' ? fst.attributes.color_temp_kelvin : null);
        const pos = k ? clamp((k - kmin) / (kmax - kmin), 0, 1) * 100 : null;
        warm = `<div class="row2"><span class="rk">Warmth</span><div class="warm" data-act="warm" style="background:linear-gradient(90deg, ${stops})">${pos != null ? `<span class="mk" style="left:${pos}%; background:${rgb(kelvinToRgb(k))}"></span>` : ''}</div></div>`;
      }
      let sw = '';
      if (caps.color) {
        const cur = fst.attributes.color_mode !== 'color_temp' && on ? (fst.attributes.rgb_color || []).join(',') : '';
        sw = `<div class="row2"><span class="rk">Colour</span><div class="sw">${SWATCHES.map((c) => `<button data-act="rgb" data-val="${c.join(',')}" style="background:${rgb(c)}" class="${cur === c.join(',') ? 'cur' : ''}" aria-label="Colour"></button>`).join('')}</div></div>`;
      }
      let extra = '';
      if (warm || sw) {
        const open = this._xpOpen();
        const what = caps.ct && caps.color ? 'Warmth & colour' : caps.ct ? 'Warmth' : 'Colour';
        const a = fst.attributes;
        const now = !on ? 'Off' : a.color_mode === 'color_temp' && a.color_temp_kelvin ? `${Math.round(a.color_temp_kelvin / 100) * 100}K` : (caps.color && a.rgb_color ? 'Colour' : '—');
        extra = `<button class="xpt${open ? ' open' : ''}" data-act="xp" aria-expanded="${open}"><span class="xdot" style="--xc:${on ? rgb(col) : 'transparent'}; background:${on ? rgb(col) : 'rgba(255,255,255,0.12)'}"></span><span class="xl">${what}</span><span class="xv">${now}</span><ha-icon icon="mdi:chevron-down"></ha-icon></button>
    <div class="xp${open ? ' open' : ''}"><div class="xpi">${warm}${sw}</div></div>`;
      }
      return `<div class="card" style="--lc:${col.join(',')}; --lv:${lv}">
  <div class="amb"></div>
  <div class="hd"><span class="ttl">${esc(title)}</span><span class="meta">${meta}</span>
    <button class="pwr${anyOn ? ' on' : ''}" data-act="master" aria-label="Turn ${esc(this._label(this._focus))} ${anyOn ? 'off' : 'on'}"><ha-icon icon="mdi:power"></ha-icon></button></div>
  ${chips}
  <div class="focus">
    <div class="fname"><b>${esc(this._label(this._focus))}</b><span>${stateTxt}</span></div>
    ${control}${extra}
  </div>
</div>`;
    }
    _wire() {
      const root = this.shadowRoot;
      root.addEventListener('click', (ev) => {
        const el = ev.composedPath().find((x) => x.dataset && x.dataset.act);
        if (!el || el.disabled) return;
        const act = el.dataset.act;
        if (act === 'focus') { this._focus = el.dataset.id; this._render(true); }
        else if (act === 'xp') {
          const open = !this._xpOpen(); this._xpSave(open);
          el.classList.toggle('open', open); el.setAttribute('aria-expanded', open);
          const xp = el.nextElementSibling; if (xp) xp.classList.toggle('open', open);
        }
        else if (act === 'toggle') this._toggle(el.dataset.id);
        else if (act === 'master') this._master();
        else if (act === 'rgb') { const c = el.dataset.val.split(',').map(Number); this._pending[this._focus] = { rgb: c, t: Date.now() }; this._render(true); this._call('light', 'turn_on', { entity_id: this._focus, rgb_color: c }); }
      });
      root.addEventListener('pointerdown', (ev) => {
        const el = ev.composedPath().find((x) => x.dataset && (x.dataset.act === 'slider' || x.dataset.act === 'warm'));
        if (!el || el.getAttribute('aria-disabled') === 'true') return;
        const kind = el.dataset.act, rect = el.getBoundingClientRect();
        const st = this._st(this._focus); if (!st) return;
        const startX = ev.clientX, startY = ev.clientY; let dragging = false, lastF = null;
        const f = (e) => clamp((e.clientX - rect.left) / rect.width, 0, 1);
        const paint = (fr) => {
          lastF = fr;
          if (kind === 'slider') {
            const p = Math.round(fr * 100);
            const fill = el.querySelector('.fill'), grip = el.querySelector('.grip'), v = el.querySelector('.v');
            if (fill) fill.style.width = `${p}%`;
            if (grip) { grip.style.display = p ? '' : 'none'; grip.style.left = `${p}%`; }
            if (v) v.textContent = p ? `${p}%` : 'Off';
            el.classList.toggle('off', p === 0);
          } else {
            const [kmin, kmax] = this._kelvinRange(st), k = kmin + (kmax - kmin) * fr;
            let mk = el.querySelector('.mk');
            if (!mk) { mk = document.createElement('span'); mk.className = 'mk'; el.appendChild(mk); }
            mk.style.left = `${fr * 100}%`; mk.style.background = rgb(kelvinToRgb(k));
          }
        };
        const move = (e) => {
          if (!dragging) {
            if (Math.abs(e.clientX - startX) < 6) { if (Math.abs(e.clientY - startY) > 10) cleanup(); return; }
            dragging = true; this._busy = true; el.classList.add('drag');
            try { el.setPointerCapture(ev.pointerId); } catch (x) { /* ignore */ }
          }
          paint(f(e));
        };
        const up = (e) => {
          const fr = dragging ? lastF : f(e);
          cleanup();
          if (fr == null) return;
          if (kind === 'slider') this._setBrightness(Math.round(fr * 100));
          else { const [kmin, kmax] = this._kelvinRange(st); this._setKelvin(Math.round((kmin + (kmax - kmin) * fr) / 50) * 50); }
        };
        const cleanup = () => {
          window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel);
          el.classList.remove('drag'); this._busy = false;
        };
        const cancel = () => { cleanup(); this._render(true); };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
      });
    }
    _setBrightness(p) {
      const id = this._focus;
      this._pending[id] = { b: p, t: Date.now() };
      this._render(true);
      if (p <= 0) this._call('light', 'turn_off', { entity_id: id });
      else this._call('light', 'turn_on', { entity_id: id, brightness_pct: p });
    }
    _setKelvin(k) {
      const id = this._focus;
      this._pending[id] = { k, t: Date.now() };
      this._render(true);
      this._call('light', 'turn_on', { entity_id: id, color_temp_kelvin: k });
    }
    _toggle(id) {
      const s = this._st(id); if (!s) return;
      this._call('homeassistant', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: id });
    }
    _xpKey() { return `linwood-light-xp:${this._config.title || ''}:${this._items.map((i) => i.entity).join(',')}`; }
    _xpOpen() {
      if (this._xpState != null) return this._xpState;
      try { this._xpState = window.localStorage.getItem(this._xpKey()) === '1'; } catch (e) { this._xpState = false; }
      return this._xpState;
    }
    _xpSave(open) { this._xpState = open; try { window.localStorage.setItem(this._xpKey(), open ? '1' : '0'); } catch (e) { /* private mode */ } }
    _master() {
      // acts on whatever is selected: the group chip ("All") or a single light
      const id = this._focus, s = this._st(id);
      if (!s || s.state === 'unavailable') return;
      if (id === this._group) this._pending = {}; else delete this._pending[id];
      this._call('homeassistant', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: id });
    }
  }

  /* =========================================================================================
   * SWITCH CARD
   * =======================================================================================*/
  class LinwoodSwitchCard extends LinwoodBase {
    setConfig(config) {
      if (!config || !Array.isArray(config.entities) || !config.entities.length) throw new Error('Set "entities"');
      this._items = config.entities.map((e) => (typeof e === 'string' ? { entity: e } : e));
      super.setConfig(config);
    }
    getCardSize() { return 1 + this._items.length; }
    _signature() {
      return this._items.map((i) => { const s = this._st(i.entity), p = this._st(i.power); return `${s ? s.state + s.last_changed : '-'}|${p ? p.state : ''}`; }).join('§') + Math.floor(Date.now() / 60000);
    }
    _css() {
      return `
.list { display:flex; flex-direction:column; gap:10px; margin-top:14px; }
.row { position:relative; display:grid; grid-template-columns:46px minmax(0,1fr) auto; align-items:center; gap:14px; padding:12px 14px 12px 12px; border-radius:20px; overflow:hidden;
  background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); cursor:pointer; text-align:left; width:100%; transition:background .25s, border-color .25s; }
.row:hover { background:rgba(255,255,255,0.065); }
.row.on { background:linear-gradient(110deg, color-mix(in srgb, var(--ac) 20%, transparent), rgba(255,255,255,0.03) 70%); border-color:color-mix(in srgb, var(--ac) 40%, transparent); }
.ic { width:46px; height:46px; border-radius:15px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.07); color:#9aa0aa; transition:all .25s; }
.ic ha-icon { --mdc-icon-size:23px; }
.row.on .ic { background:var(--ac); color:#0e1014; box-shadow:0 0 20px color-mix(in srgb, var(--ac) 55%, transparent); }
.tx { min-width:0; display:flex; flex-direction:column; gap:2px; }
.nm { font-size:16px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sb { font-size:13px; color:#9aa0aa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.row.on .sb { color:color-mix(in srgb, var(--ac) 75%, white 15%); }
.tg { position:relative; width:52px; height:30px; border-radius:15px; background:rgba(255,255,255,0.12); transition:background .25s; }
.tg::after { content:''; position:absolute; top:3px; left:3px; width:24px; height:24px; border-radius:50%; background:#e5e7eb; box-shadow:0 1px 4px rgba(0,0,0,.45); transition:transform .25s cubic-bezier(.3,1.4,.5,1); }
.row.on .tg { background:var(--ac); }
.row.on .tg::after { transform:translateX(22px); background:#fff; }
.row.na { cursor:default; opacity:.55; }
.watt { position:absolute; left:0; bottom:0; height:3px; background:var(--ac); opacity:.7; transition:width .6s; }`;
    }
    _html() {
      const title = this._config.title || 'Switches';
      const onN = this._items.filter((i) => (this._st(i.entity) || {}).state === 'on').length;
      const rows = this._items.map((it, idx) => {
        const s = this._st(it.entity);
        const name = it.name || (s && s.attributes.friendly_name) || it.entity;
        if (!s) return `<div class="row na"><span class="ic"><ha-icon icon="mdi:alert"></ha-icon></span><span class="tx"><span class="nm">${esc(name)}</span><span class="sb">Not found</span></span></div>`;
        const on = s.state === 'on', na = s.state === 'unavailable';
        const ac = it.color || '#f5b83d';
        const icon = on ? (it.icon_on || it.icon || 'mdi:power') : (it.icon || 'mdi:power');
        let sub = na ? 'Offline' : on ? (it.on_text || 'On') : (it.off_text || 'Off');
        let watt = '';
        const p = this._st(it.power);
        if (p && on && !isNaN(parseFloat(p.state))) {
          const w = parseFloat(p.state);
          sub += ` · ${w >= 100 ? Math.round(w) : w.toFixed(1)} ${p.attributes.unit_of_measurement || 'W'}`;
          if (it.max_power) watt = `<span class="watt" style="width:${clamp(w / it.max_power, 0, 1) * 100}%"></span>`;
        }
        if (!na && it.show_since !== false) sub += ` · ${ago(s.last_changed)}`;
        return `<button class="row${on ? ' on' : ''}${na ? ' na' : ''}" data-idx="${idx}" ${na ? 'disabled' : ''} style="--ac:${ac}" role="switch" aria-checked="${on}">
          <span class="ic"><ha-icon icon="${icon}"></ha-icon></span>
          <span class="tx"><span class="nm">${esc(name)}</span><span class="sb">${esc(sub)}</span></span>
          <span class="tg"></span>${watt}</button>`;
      }).join('');
      return `<div class="card"><div class="hd"><span class="ttl">${esc(title)}</span><span class="meta">${onN ? `${onN} on` : 'All off'}</span></div><div class="list">${rows}</div></div>`;
    }
    _wire() {
      this.shadowRoot.addEventListener('click', (ev) => {
        const el = ev.composedPath().find((x) => x.dataset && x.dataset.idx != null);
        if (!el || el.disabled) return;
        const it = this._items[Number(el.dataset.idx)], s = this._st(it.entity);
        if (!s) return;
        if (it.confirm && !window.confirm(`${s.state === 'on' ? 'Turn off' : 'Turn on'} ${it.name || s.attributes.friendly_name}?`)) return;
        this._call('homeassistant', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: it.entity });
      });
      this.shadowRoot.addEventListener('contextmenu', (ev) => {
        const el = ev.composedPath().find((x) => x.dataset && x.dataset.idx != null);
        if (!el) return; ev.preventDefault(); moreInfo(this, this._items[Number(el.dataset.idx)].entity);
      });
    }
  }

  /* =========================================================================================
   * GARAGE CARD
   * =======================================================================================*/
  class LinwoodGarageCard extends LinwoodBase {
    setConfig(config) {
      if (!config || !config.entity || !config.entity.startsWith('cover.')) throw new Error('Set "entity" to a cover');
      super.setConfig(config);
    }
    getCardSize() { return 6; }
    _signature() {
      const c = this._config;
      return [c.entity, c.obstruction, c.motion, c.vehicle, c.lock, c.light, c.laser, c.openings].map((id) => { const s = this._st(id); return s ? `${s.state}|${s.attributes.current_position}|${s.last_changed}` : '-'; }).join('§') + Math.floor(Date.now() / 60000);
    }
    _css() {
      return `
.card { padding:20px; }
.stat { display:flex; align-items:baseline; gap:10px; margin-top:4px; }
.stat b { font-size:26px; font-weight:700; letter-spacing:-0.02em; color:var(--gc); }
.stat span { font-size:14px; color:#9aa0aa; }
.scene { position:relative; margin:14px -6px 0; }
.scene svg { display:block; width:100%; height:auto; }
.door { transition:transform 1.2s cubic-bezier(.45,.05,.3,1); }
.door.moving { transition-duration:var(--dur, 13s); transition-timing-function:linear; }
.slat { fill:url(#slat); stroke:rgba(0,0,0,.35); stroke-width:1; }
.win { fill:rgba(160,190,230,.18); stroke:rgba(255,255,255,.12); }
.bulbglow { transition:opacity .5s; }
.beam { stroke:#ef4444; stroke-width:2; stroke-dasharray:6 5; filter:drop-shadow(0 0 4px #ef4444); animation:dash 0.6s linear infinite; }
.mot { fill:none; stroke:var(--mc, #f5b83d); stroke-width:2; opacity:0; }
.mot.on { animation:ping 1.6s ease-out infinite; }
.car { transition:opacity .6s, transform .8s; }
.act { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; margin-top:14px; }
.hold { position:relative; overflow:hidden; height:58px; border-radius:18px; display:flex; align-items:center; justify-content:center; gap:10px; font-size:16px; font-weight:700;
  background:rgba(255,255,255,0.06); border:1px solid color-mix(in srgb, var(--gc) 45%, rgba(255,255,255,0.08)); color:#f3f4f6; user-select:none; -webkit-user-select:none; touch-action:manipulation; }
.hold .prog { position:absolute; inset:0 auto 0 0; width:0; background:linear-gradient(90deg, color-mix(in srgb, var(--gc) 35%, transparent), color-mix(in srgb, var(--gc) 65%, transparent)); }
.hold.pressing .prog { width:100%; transition:width var(--hold, .8s) linear; }
.hold > * { position:relative; }
.hold ha-icon { --mdc-icon-size:22px; color:var(--gc); }
.hold.stop { background:color-mix(in srgb, #ef4444 25%, transparent); border-color:#ef4444; }
.hold.stop ha-icon { color:#fff; }
.mi { width:58px; height:58px; border-radius:18px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); color:#cbd5e1; }
.mi ha-icon { --mdc-icon-size:22px; }
.chips { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; margin-top:12px; }
.chip { display:flex; flex-direction:column; align-items:flex-start; gap:6px; padding:10px 12px; border-radius:16px; text-align:left;
  background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); min-width:0; transition:all .2s; }
.chip.tap:hover { background:rgba(255,255,255,0.075); }
.chip ha-icon { --mdc-icon-size:18px; color:#8b919c; }
.chip .k { font-size:10.5px; letter-spacing:.1em; font-weight:700; color:#8b919c; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
.chip .v { font-size:14px; font-weight:600; white-space:nowrap; }
.chip.hot { background:color-mix(in srgb, var(--hc) 16%, transparent); border-color:color-mix(in srgb, var(--hc) 45%, transparent); }
.chip.hot ha-icon, .chip.hot .v { color:var(--hc); }
.foot { margin-top:12px; font-size:12.5px; color:#8b919c; display:flex; justify-content:space-between; }
@keyframes dash { to { stroke-dashoffset:-11; } }
@keyframes ping { 0% { opacity:.8; r:6; } 100% { opacity:0; r:22; } }`;
    }
    _html() {
      const c = this._config, st = this._st(c.entity);
      if (!st) return `<div class="card"><div class="empty">Entity not found: ${esc(c.entity)}</div></div>`;
      const s = st.state, a = st.attributes;
      const moving = s === 'opening' || s === 'closing';
      let pos = a.current_position != null ? Number(a.current_position) : (s === 'open' ? 100 : s === 'opening' ? 100 : 0);
      if (s === 'closing' && a.current_position == null) pos = 0;
      const colors = { closed: '#34d399', open: '#f59e0b', opening: '#f59e0b', closing: '#38bdf8', stopped: '#f59e0b', unavailable: '#6b7280' };
      const gc = colors[s] || '#9aa0aa';
      const label = { closed: 'Closed', open: 'Open', opening: 'Opening…', closing: 'Closing…', stopped: 'Stopped', unavailable: 'Offline' }[s] || s;
      const sub = moving ? (a.current_position != null ? `${pos}% open` : 'In motion') : ago(st.last_changed);
      const on = (id) => (this._st(id) || {}).state === 'on';
      const obst = on(c.obstruction), motion = on(c.motion), vehicle = on(c.vehicle), lightOn = on(c.light);
      const lockSt = this._st(c.lock), laserSt = this._st(c.laser), openings = this._st(c.openings);
      const dur = c.travel_seconds || 13;
      // door geometry inside the svg (opening at x=70..250, y=62..182 => 180x120)
      const lift = (pos / 100) * 112;
      const slats = [0, 1, 2, 3].map((i) => `<rect class="slat" x="70" y="${62 + i * 30}" width="180" height="30" rx="2"/>`).join('')
        + [0, 1, 2, 3, 4].map((i) => `<rect class="win" x="${82 + i * 33}" y="70" width="24" height="12" rx="2"/>`).join('');
      const svg = `<svg viewBox="0 0 320 196" aria-hidden="true">
  <defs>
    <linearGradient id="slat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f49"/><stop offset=".5" stop-color="#2b2f37"/><stop offset="1" stop-color="#22252c"/></linearGradient>
    <linearGradient id="inside" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0c10"/><stop offset="1" stop-color="#16181e"/></linearGradient>
    <radialGradient id="bulb" cx="50%" cy="0%" r="80%"><stop offset="0" stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${gc}" stop-opacity=".22"/><stop offset="1" stop-color="${gc}" stop-opacity="0"/></linearGradient>
    <clipPath id="opening"><rect x="70" y="62" width="180" height="120"/></clipPath>
  </defs>
  <path d="M40 182 V58 L160 14 L280 58 V182" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.12)" stroke-width="2" stroke-linejoin="round"/>
  <rect x="64" y="56" width="192" height="126" rx="4" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)"/>
  <g clip-path="url(#opening)">
    <rect x="70" y="62" width="180" height="120" fill="url(#inside)"/>
    <rect class="bulbglow" x="70" y="62" width="180" height="120" fill="url(#bulb)" opacity="${lightOn ? 1 : 0}"/>
    <circle cx="160" cy="66" r="3" fill="${lightOn ? '#ffd27a' : '#3a3f49'}"/>
    <g class="car" opacity="${vehicle ? 1 : 0}" transform="translate(0 ${vehicle ? 0 : 10})">
      <path d="M104 170 q4 -22 26 -26 l14 -14 q6 -5 16 -5 h22 q10 0 16 7 l12 13 q20 3 26 25 z" fill="#4b5563"/>
      <path d="M150 133 h30 q6 0 10 5 l8 8 h-56 z" fill="#1f2937"/>
      <circle cx="128" cy="172" r="9" fill="#111" stroke="#6b7280" stroke-width="3"/><circle cx="208" cy="172" r="9" fill="#111" stroke="#6b7280" stroke-width="3"/>
      <rect x="216" y="152" width="8" height="4" rx="2" fill="#fca5a5"/>
    </g>
    <g class="door${moving && a.current_position == null ? ' moving' : ''}" style="transform:translateY(-${this._lastLift == null ? lift : this._lastLift}px); --dur:${dur}s">${slats}</g>
    ${obst ? '<line class="beam" x1="72" y1="176" x2="248" y2="176"/>' : ''}
  </g>
  <rect x="20" y="182" width="280" height="2" rx="1" fill="rgba(255,255,255,0.18)"/>
  <rect x="70" y="184" width="180" height="12" fill="url(#floor)"/>
  ${motion ? `<circle class="mot on" cx="262" cy="40" r="6" style="--mc:#f5b83d"/><circle cx="262" cy="40" r="3.5" fill="#f5b83d"/>` : ''}
</svg>`;
      const action = moving ? 'stop' : (s === 'closed' ? 'open' : 'close');
      const btn = moving
        ? `<button class="hold stop" data-act="stop"><ha-icon icon="mdi:stop"></ha-icon><span>Stop</span></button>`
        : `<button class="hold" data-act="hold" data-dir="${action}" ${s === 'unavailable' ? 'disabled' : ''}><span class="prog"></span><ha-icon icon="${action === 'open' ? 'mdi:arrow-up-bold' : 'mdi:arrow-down-bold'}"></ha-icon><span class="hl">Hold to ${action}</span></button>`;
      this._targetLift = lift;
      const chip = (k, v, icon, hot, hc, act, id) => `<button class="chip${hot ? ' hot' : ''}${act ? ' tap' : ''}" ${act ? `data-act="${act}" data-id="${id}"` : `data-act="info" data-id="${id}"`} style="--hc:${hc}"><ha-icon icon="${icon}"></ha-icon><span class="k">${k}</span><span class="v">${v}</span></button>`;
      const chips = [];
      if (c.light) chips.push(chip('Light', lightOn ? 'On' : 'Off', lightOn ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline', lightOn, '#f5b83d', 'toggle', c.light));
      if (c.laser && laserSt) chips.push(chip('Laser', laserSt.state === 'on' ? 'On' : 'Off', 'mdi:laser-pointer', laserSt.state === 'on', '#ef4444', 'toggle', c.laser));
      if (c.lock && lockSt) chips.push(chip('Remotes', lockSt.state === 'locked' ? 'Locked' : 'Unlocked', lockSt.state === 'locked' ? 'mdi:lock' : 'mdi:lock-open-variant', lockSt.state === 'locked', '#a78bfa', 'lock', c.lock));
      if (c.motion) chips.push(chip('Motion', motion ? 'Detected' : 'Clear', motion ? 'mdi:motion-sensor' : 'mdi:motion-sensor-off', motion, '#f5b83d', null, c.motion));
      if (c.vehicle) chips.push(chip('Vehicle', vehicle ? 'Parked' : 'Away', vehicle ? 'mdi:car' : 'mdi:car-off', vehicle, '#38bdf8', null, c.vehicle));
      if (c.obstruction) chips.push(chip('Beam', obst ? 'Blocked' : 'Clear', obst ? 'mdi:alert-octagon' : 'mdi:check-circle-outline', obst, '#ef4444', null, c.obstruction));
      return `<div class="card" style="--gc:${gc}; --hold:${(c.hold_ms || 800) / 1000}s">
  <div class="hd"><span class="ttl">${esc(c.title || 'Garage door')}</span><span class="meta">${a.current_position != null ? `${pos}%` : ''}</span></div>
  <div class="stat"><b>${label}</b><span>${esc(sub)}</span></div>
  <div class="scene">${svg}</div>
  <div class="act">${btn}<button class="mi" data-act="info" data-id="${c.entity}" aria-label="Details"><ha-icon icon="mdi:dots-horizontal"></ha-icon></button></div>
  ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
  ${openings && !isNaN(parseFloat(openings.state)) ? `<div class="foot"><span>${Math.round(parseFloat(openings.state)).toLocaleString()} openings</span><span>Hold ${((c.hold_ms || 800) / 1000).toFixed(1)}s to move</span></div>` : ''}
</div>`;
    }
    _after() {
      // animate the door from where it was drawn last time to where it should be now
      const door = this.shadowRoot.querySelector('.door');
      const target = this._targetLift;
      if (!door || target == null) return;
      if (this._lastLift == null || this._lastLift === target) { this._lastLift = target; return; }
      requestAnimationFrame(() => requestAnimationFrame(() => { door.style.transform = `translateY(-${target}px)`; }));
      this._lastLift = target;
    }
    _wire() {
      const root = this.shadowRoot;
      root.addEventListener('click', (ev) => {
        const el = ev.composedPath().find((x) => x.dataset && x.dataset.act);
        if (!el || el.disabled) return;
        const act = el.dataset.act, id = el.dataset.id;
        if (act === 'info') moreInfo(this, id);
        else if (act === 'toggle') { const s = this._st(id); if (s) this._call('homeassistant', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: id }); }
        else if (act === 'lock') { const s = this._st(id); if (s) this._call('lock', s.state === 'locked' ? 'unlock' : 'lock', { entity_id: id }); }
        else if (act === 'stop') this._call('cover', 'stop_cover', { entity_id: this._config.entity });
      });
      root.addEventListener('pointerdown', (ev) => {
        const el = ev.composedPath().find((x) => x.dataset && x.dataset.act === 'hold');
        if (!el || el.disabled) return;
        ev.preventDefault();
        const dir = el.dataset.dir, ms = this._config.hold_ms || 800;
        this._busy = true;
        el.classList.add('pressing');
        const hl = el.querySelector('.hl'); if (hl) hl.textContent = 'Keep holding…';
        let done = false;
        const timer = setTimeout(() => {
          done = true;
          if (navigator.vibrate) navigator.vibrate(30);
          if (hl) hl.textContent = dir === 'open' ? 'Opening…' : 'Closing…';
          this._call('cover', dir === 'open' ? 'open_cover' : 'close_cover', { entity_id: this._config.entity });
        }, ms);
        const end = () => {
          window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
          clearTimeout(timer); this._busy = false;
          if (!done) { el.classList.remove('pressing'); if (hl) hl.textContent = `Hold to ${dir}`; }
          else setTimeout(() => this._render(true), 400);
        };
        window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
      });
      root.addEventListener('contextmenu', (ev) => { if (ev.composedPath().some((x) => x.dataset && x.dataset.act === 'hold')) ev.preventDefault(); });
    }
  }


  const defs = [
    ['linwood-light-card', LinwoodLightCard, 'Linwood Light Card', 'Glow dimmer with warmth, colour and per-light chips'],
    ['linwood-switch-card', LinwoodSwitchCard, 'Linwood Switch Card', 'List of switches with big toggles and live wattage'],
    ['linwood-garage-card', LinwoodGarageCard, 'Linwood Garage Card', 'Animated garage door with hold-to-open'],
  ];
  window.customCards = window.customCards || [];
  defs.forEach(([tag, cls, name, description]) => {
    if (!customElements.get(tag)) customElements.define(tag, cls);
    if (!window.customCards.find((c) => c.type === tag)) window.customCards.push({ type: tag, name, description, preview: false });
  });
  window.LinwoodKit = { esc, clamp, kelvinToRgb, rgb, ago, moreInfo, BASE_CSS, Base: LinwoodBase, version: '1.3.0' };
})();
