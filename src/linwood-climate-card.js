/* Linwood Climate Card v1.2.0 — custom dial thermostat for Home Assistant
 * v1.2.0: re-renders patch the DOM in place (LinwoodMorph) instead of replacing it — fixes the iOS jump-to-top on tap. */
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
const LCC_MODES = {
  heat: { label: 'Heat', icon: 'mdi:fire' },
  cool: { label: 'Cool', icon: 'mdi:snowflake' },
  heat_cool: { label: 'Auto', icon: 'mdi:sun-snowflake-variant' },
  auto: { label: 'Auto', icon: 'mdi:thermostat-auto' },
  dry: { label: 'Dry', icon: 'mdi:water-percent' },
  fan_only: { label: 'Fan', icon: 'mdi:fan' },
  off: { label: 'Off', icon: 'mdi:power' },
};
/* visual state palettes: [light, mid, deep] */
const LCC_LOOK = {
  heating: { c: ['#fde68a', '#fb923c', '#ef4444'], label: 'Heating', icon: 'mdi:fire', fx: 'heat' },
  cooling: { c: ['#cffafe', '#38bdf8', '#3b82f6'], label: 'Cooling', icon: 'mdi:snowflake', fx: 'cool' },
  idle_heat: { c: ['#fcd9b6', '#f0a774', '#d97757'], label: 'Idle', icon: 'mdi:fire', fx: 'idle' },
  idle_cool: { c: ['#bae6fd', '#7cc4ec', '#5b8fd6'], label: 'Idle', icon: 'mdi:snowflake', fx: 'idle' },
  idle_auto: { c: ['#f0c4a4', '#b59ae0', '#7cc4ec'], label: 'Idle', icon: 'mdi:sun-snowflake-variant', fx: 'idle' },
  fan: { c: ['#e5e7eb', '#94a3b8', '#64748b'], label: 'Fan only', icon: 'mdi:fan', fx: 'idle' },
  drying: { c: ['#ccfbf1', '#2dd4bf', '#0ea5e9'], label: 'Drying', icon: 'mdi:water-percent', fx: 'idle' },
  off: { c: ['#6b7280', '#4b5563', '#374151'], label: 'Off', icon: 'mdi:power', fx: 'off' },
};
const LCC_WX = {
  'clear-night': 'mdi:weather-night', cloudy: 'mdi:weather-cloudy', fog: 'mdi:weather-fog', hail: 'mdi:weather-hail',
  lightning: 'mdi:weather-lightning', 'lightning-rainy': 'mdi:weather-lightning-rainy', partlycloudy: 'mdi:weather-partly-cloudy',
  pouring: 'mdi:weather-pouring', rainy: 'mdi:weather-rainy', snowy: 'mdi:weather-snowy', 'snowy-rainy': 'mdi:weather-snowy-rainy',
  sunny: 'mdi:weather-sunny', windy: 'mdi:weather-windy', 'windy-variant': 'mdi:weather-windy-variant', exceptional: 'mdi:alert-circle-outline',
};
const LCC_WXL = { partlycloudy: 'Partly cloudy', 'clear-night': 'Clear', 'lightning-rainy': 'Storms', 'snowy-rainy': 'Sleet', 'windy-variant': 'Windy', exceptional: 'Alert' };
const A0 = 135, SWEEP = 270, CX = 150, CY = 150, R = 118;

class LinwoodClimateCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity || !config.entity.startsWith('climate.')) throw new Error('Set "entity" to a climate entity');
    this._config = config;
    this._pending = null;
    this._side = 'low';
    this._drag = false;
    this._sig = null;
    if (!this.shadowRoot) { this.attachShadow({ mode: 'open' }); this._wire(); }
    if (this._hass) this._render(true);
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._drag) this._render(false);
  }

  getCardSize() { return 10; }
  getGridOptions() { return { columns: 12, rows: 'auto', min_columns: 6 }; }
  static getStubConfig(hass) {
    const e = Object.keys(hass.states).find((k) => k.startsWith('climate.'));
    return { entity: e || 'climate.thermostat' };
  }

  /* ---------- helpers ---------- */
  _st(id) { return id && this._hass ? this._hass.states[id] : undefined; }
  _num(id) { const s = this._st(id); const v = s ? parseFloat(s.state) : NaN; return isNaN(v) ? null : v; }
  _unit() { return (this._hass.config && this._hass.config.unit_system && this._hass.config.unit_system.temperature) || '°'; }
  _range(a) { return [a.min_temp != null ? a.min_temp : 45, a.max_temp != null ? a.max_temp : 95]; }
  _step(a) { return a.target_temp_step || (this._unit() === '°C' ? 0.5 : 1); }
  _dual(st) { return st.state === 'heat_cool' && st.attributes.target_temp_low != null && st.attributes.target_temp_high != null; }
  _fmt(v) { if (v == null || isNaN(v)) return '--'; const r = Math.round(v * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); }
  _cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : ''; }
  _presetLabel(p) { return !p || p === 'none' ? 'Home' : this._cap(p); }

  _look(st) {
    const mode = this._config.preview_mode || st.state, act = this._config.preview_action || st.attributes.hvac_action;
    if (mode === 'off' || mode === 'unavailable' || act === 'off') return LCC_LOOK.off;
    if (act === 'heating' || act === 'preheating') return LCC_LOOK.heating;
    if (act === 'cooling') return LCC_LOOK.cooling;
    if (act === 'fan') return LCC_LOOK.fan;
    if (act === 'drying') return LCC_LOOK.drying;
    if (mode === 'cool') return LCC_LOOK.idle_cool;
    if (mode === 'heat_cool' || mode === 'auto') return LCC_LOOK.idle_auto;
    return LCC_LOOK.idle_heat;
  }

  _targets(st) {
    const a = st.attributes, p = this._pending;
    if (this._dual(st)) {
      return {
        low: p && p.key === 'low' ? p.value : a.target_temp_low,
        high: p && p.key === 'high' ? p.value : a.target_temp_high,
      };
    }
    return { single: p && p.key === 'single' ? p.value : a.temperature };
  }

  _angle(v, a) { const [mn, mx] = this._range(a); const f = Math.min(1, Math.max(0, (v - mn) / (mx - mn))); return A0 + f * SWEEP; }
  _pt(deg, r) { const t = (deg * Math.PI) / 180; return [CX + r * Math.cos(t), CY + r * Math.sin(t)]; }
  _arc(d0, d1, r) {
    if (d1 - d0 < 0.5) d1 = d0 + 0.5;
    const [x0, y0] = this._pt(d0, r), [x1, y1] = this._pt(d1, r);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  _sigOf(st) {
    const c = this._config, parts = [JSON.stringify(st.attributes), st.state];
    [c.weather, c.humidity, c.humidifier, c.room && c.room.temperature, c.room && c.room.humidity].forEach((id) => {
      const s = this._st(id); parts.push(s ? s.state + (s.attributes.temperature != null ? '|' + s.attributes.temperature : '') : '-');
    });
    parts.push(JSON.stringify(this._pending), this._side);
    return parts.join('§');
  }

  /* ---------- render ---------- */
  _render(force) {
    if (!this._hass || !this._config) return;
    const st = this._st(this._config.entity);
    if (this._pending && st && Date.now() - this._pending.t > 8000) this._pending = null;
    if (this._pending && st) {
      const a = st.attributes, p = this._pending;
      const cur = p.key === 'low' ? a.target_temp_low : p.key === 'high' ? a.target_temp_high : a.temperature;
      if (cur === p.value && !this._timer) this._pending = null;
    }
    const sig = st ? this._sigOf(st) : 'missing';
    if (!force && sig === this._sig) return;
    this._sig = sig;
    if (!st) {
      LwMorph.patch(this.shadowRoot, `${this._css()}<div class="card"><div class="empty">Entity not found: ${this._config.entity}</div></div>`);
      return;
    }
    LwMorph.patch(this.shadowRoot, this._css() + this._html(st));
  }

  _fx(kind) {
    // particles inside the dial: embers rise when heating, frost falls when cooling
    if (kind !== 'heat' && kind !== 'cool') return '';
    const xs = [112, 128, 141, 152, 163, 176, 188, 120, 146, 170, 134, 182];
    let out = `<g class="fx ${kind}">`;
    xs.forEach((x, i) => {
      const r = kind === 'heat' ? (1.6 + (i % 3) * 0.7) : (1.3 + (i % 3) * 0.6);
      const y = kind === 'heat' ? 212 + (i % 4) * 4 : 88 - (i % 4) * 4;
      out += `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" style="animation-delay:${(i * 0.37).toFixed(2)}s;animation-duration:${(2.6 + (i % 5) * 0.45).toFixed(2)}s"/>`;
    });
    return out + '</g>';
  }

  _html(st) {
    const a = st.attributes, mode = st.state, mm = LCC_MODES[mode] || { label: this._cap(mode), icon: 'mdi:thermostat' };
    const look = this._look(st), c = look.c;
    const off = look.fx === 'off';
    const active = look.fx === 'heat' || look.fx === 'cool';
    const dual = this._dual(st);
    const t = this._targets(st);
    const [mn, mx] = this._range(a);
    const cur = a.current_temperature;

    // ticks
    let ticks = '';
    const n = 54;
    const hiA = dual ? this._angle(t.high, a) : this._angle(t.single != null ? t.single : mn, a);
    const loA = dual ? this._angle(t.low, a) : A0;
    for (let i = 0; i <= n; i++) {
      const d = A0 + (i / n) * SWEEP;
      const [x0, y0] = this._pt(d, 92), [x1, y1] = this._pt(d, i % 9 === 0 ? 82 : 86);
      const lit = !off && d >= loA - 0.01 && d <= hiA + 0.01;
      ticks += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="tick${lit ? ' lit' : ''}"/>`;
    }

    // arc + knobs
    let arc = '', glow = '', knobs = '';
    if (!off) {
      const d = dual ? this._arc(this._angle(t.low, a), this._angle(t.high, a), R) : (t.single != null ? this._arc(A0, this._angle(t.single, a), R) : '');
      if (d) {
        glow = active ? `<path id="arcglow" d="${d}" class="arcglow"/>` : '';
        arc = `<path id="arc" d="${d}" class="arc"/>`;
      }
      if (dual) {
        ['low', 'high'].forEach((k) => {
          const [kx, ky] = this._pt(this._angle(t[k], a), R);
          knobs += `<circle id="knob-${k}" cx="${kx.toFixed(2)}" cy="${ky.toFixed(2)}" r="${this._side === k ? 13 : 10}" class="knob${this._side === k ? ' sel' : ''}"/>`;
        });
      } else if (t.single != null) {
        const [kx, ky] = this._pt(this._angle(t.single, a), R);
        knobs = `<circle id="knob-single" cx="${kx.toFixed(2)}" cy="${ky.toFixed(2)}" r="13" class="knob sel"/>`;
      }
    }
    let curMark = '';
    if (cur != null) {
      const [cx, cy] = this._pt(this._angle(cur, a), R);
      curMark = `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="4.5" class="cur"/>`;
    }
    const [lx, ly] = this._pt(A0, R + 22), [hx, hy] = this._pt(A0 + SWEEP, R + 22);

    // center
    let verb;
    if (off) verb = 'SYSTEM OFF';
    else if (look.fx === 'heat') verb = dual ? 'HEATING · KEEP' : 'HEATING TO';
    else if (look.fx === 'cool') verb = dual ? 'COOLING · KEEP' : 'COOLING TO';
    else verb = dual ? 'HOLDING BETWEEN' : 'HOLDING AT';
    let big;
    if (off) big = `<span class="v dim">${this._fmt(cur)}</span><span class="deg">°</span>`;
    else if (dual) big = `<span class="v sm${this._side === 'low' ? ' on' : ''}" data-act="side" data-val="low">${this._fmt(t.low)}</span><span class="dash">–</span><span class="v sm${this._side === 'high' ? ' on' : ''}" data-act="side" data-val="high">${this._fmt(t.high)}</span><span class="deg">°</span>`;
    else big = `<span class="v" id="val">${this._fmt(t.single)}</span><span class="deg">°</span>`;
    const hum = this._num(this._config.humidity) != null ? this._num(this._config.humidity) : a.current_humidity;
    const sub = off ? 'Indoor now' : `Indoor ${this._fmt(cur)}°${hum != null ? ' · ' + Math.round(hum) + '%' : ''}`;

    // stats
    const fanModes = a.fan_modes || [], presets = a.preset_modes || [];
    const fanOn = a.fan_mode === 'on';
    const presetTxt = this._presetLabel(a.preset_mode);
    const presetAct = a.preset_mode && a.preset_mode !== 'none';
    const targetTxt = off ? '—' : dual ? `${this._fmt(t.low)}–${this._fmt(t.high)}°` : `${this._fmt(t.single)}°`;
    const opts = (a.hvac_modes || []).map((hm) => {
      const lab = (LCC_MODES[hm] || {}).label || this._cap(hm);
      return `<option value="${hm}"${hm === mode ? ' selected' : ''}>${lab}</option>`;
    }).join('');

    // flat readings
    const reads = [];
    const wx = this._st(this._config.weather);
    if (wx) {
      const wt = wx.attributes.temperature != null ? Math.round(wx.attributes.temperature) : null;
      reads.push(this._read(LCC_WX[wx.state] || 'mdi:weather-partly-cloudy', ['sunny', 'clear-night', 'partlycloudy'].includes(wx.state) ? '#fbbf24' : '#cbd5e1',
        'Outside', `${this._fmt(wt)}°`, LCC_WXL[wx.state] || this._cap(wx.state)));
    }
    const room = this._config.room;
    if (room) {
      const rt = this._num(room.temperature), rh = this._num(room.humidity);
      reads.push(this._read(room.icon || 'mdi:bed-king-outline', '#2dd4bf', room.name || 'Room', `${rt != null ? Math.round(rt) : '--'}°`, rh != null ? `${Math.round(rh)}% humidity` : ''));
    }
    const hf = this._st(this._config.humidifier);
    if (hf) {
      const on = hf.state === 'on', dis = hf.state === 'unavailable';
      reads.push(`<div class="rd"><div class="rk"><ha-icon icon="mdi:air-humidifier" style="color:#2dd4bf"></ha-icon>Humidifier</div>
        <button class="sw${on ? ' on' : ''}" data-act="humidifier" ${dis ? 'disabled' : ''} role="switch" aria-checked="${on}" aria-label="Humidifier"><span class="knobsw"></span></button>
        <div class="rs">${dis ? 'Offline' : on ? 'Running' : 'Off'}</div></div>`);
    }

    const fxClass = `fx-${look.fx}`;
    return `
<div class="card ${fxClass}" style="--c1:${c[0]};--c2:${c[1]};--c3:${c[2]}">
  <div class="head">
    <span class="title">CLIMATE</span>
    <span class="status"><i class="dot${active ? ' pulse' : ''}"></i>${look.label}</span>
    <button class="more" data-act="more" title="Details"><ha-icon icon="mdi:dots-horizontal"></ha-icon></button>
  </div>
  <div class="dialwrap">
    <svg class="dial" viewBox="0 0 300 300">
      <defs>
        <linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--c1)"/><stop offset="55%" stop-color="var(--c2)"/><stop offset="100%" stop-color="var(--c3)"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--c2)" stop-opacity="${off ? 0 : active ? 0.3 : 0.1}"/><stop offset="72%" stop-color="var(--c2)" stop-opacity="0"/>
        </radialGradient>
        <clipPath id="innerclip"><circle cx="150" cy="150" r="73"/></clipPath>
      </defs>
      <circle cx="150" cy="150" r="104" fill="url(#glow)" class="halo"/>
      <circle cx="150" cy="150" r="74" class="inner"/>
      <g clip-path="url(#innerclip)">${this._fx(look.fx)}</g>
      ${ticks}
      <path d="${this._arc(A0, A0 + SWEEP, R)}" class="track"/>
      ${glow}${arc}${curMark}${knobs}
      <text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" class="lim" text-anchor="middle">${mn}°</text>
      <text x="${hx.toFixed(1)}" y="${(hy + 4).toFixed(1)}" class="lim" text-anchor="middle">${mx}°</text>
      ${off ? '' : `<path d="${this._arc(A0, A0 + SWEEP, R)}" class="hit"/>`}
    </svg>
    <div class="center">
      <ha-icon class="cicon" icon="${look.icon}"></ha-icon>
      <div class="verb">${verb}</div>
      <div class="big">${big}</div>
      <div class="sub">${sub}</div>
    </div>
    ${off ? `<button class="power" data-act="mode" data-val="${(a.hvac_modes || []).includes('heat') ? 'heat' : (a.hvac_modes || []).filter((x) => x !== 'off')[0]}"><ha-icon icon="mdi:power"></ha-icon><span>Turn on</span></button>` : `
    <button class="step minus" data-act="step" data-val="-1" aria-label="Lower"><ha-icon icon="mdi:minus"></ha-icon></button>
    <button class="step plus" data-act="step" data-val="1" aria-label="Raise"><ha-icon icon="mdi:plus"></ha-icon></button>`}
  </div>
  <div class="stats">
    <button class="stat" data-act="more"><span class="k">TARGET</span><span class="sv">${targetTxt}</span></button>
    <label class="stat sel"><span class="k">MODE<ha-icon icon="mdi:chevron-down"></ha-icon></span><span class="sv mode">${mm.label}</span>
      <select class="msel" aria-label="HVAC mode">${opts}</select></label>
    <button class="stat${fanOn ? ' act' : ''}" data-act="fan" ${fanModes.length ? '' : 'disabled'}><span class="k">FAN<ha-icon icon="mdi:fan${fanOn ? '' : '-off'}"${fanOn ? ' class="spin"' : ''}></ha-icon></span><span class="sv">${fanModes.length ? (fanOn ? 'On' : 'Auto') : '—'}</span></button>
    <button class="stat${presetAct ? ' act' : ''}" data-act="preset" ${presets.length ? '' : 'disabled'}><span class="k">PRESET<ha-icon icon="${presetAct ? 'mdi:leaf' : 'mdi:home-outline'}"></ha-icon></span><span class="sv">${presetTxt}</span></button>
  </div>
  ${reads.length ? `<div class="reads">${reads.join('')}</div>` : ''}
</div>`;
  }

  _read(icon, color, k, v, s) {
    return `<div class="rd"><div class="rk"><ha-icon icon="${icon}" style="color:${color}"></ha-icon>${k}</div><div class="rv">${v}</div><div class="rs">${s || ''}</div></div>`;
  }

  /* ---------- interaction ---------- */
  _wire() {
    const root = this.shadowRoot;
    root.addEventListener('click', (ev) => {
      const el = ev.composedPath().find((x) => x.dataset && x.dataset.act);
      if (el && !el.disabled) this._act(el.dataset.act, el.dataset.val);
    });
    root.addEventListener('change', (ev) => {
      const el = ev.composedPath()[0];
      if (el && el.classList && el.classList.contains('msel')) {
        const st = this._st(this._config.entity);
        if (st && el.value !== st.state) this._call('climate', 'set_hvac_mode', { hvac_mode: el.value });
      }
    });
    root.addEventListener('pointerdown', (ev) => {
      const hit = ev.composedPath().find((x) => x.classList && x.classList.contains('hit'));
      if (!hit) return;
      const svg = root.querySelector('svg.dial');
      if (!svg) return;
      ev.preventDefault();
      this._drag = true;
      this._svg = svg;
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
      const st = this._st(this._config.entity);
      if (st && this._dual(st)) {
        const v = this._valFromPointer(ev, st);
        const t = this._targets(st);
        this._side = Math.abs(v - t.low) <= Math.abs(v - t.high) ? 'low' : 'high';
      }
      this._dragMove(ev);
      const move = (e) => this._dragMove(e);
      const up = () => {
        svg.removeEventListener('pointermove', move);
        svg.removeEventListener('pointerup', up);
        svg.removeEventListener('pointercancel', up);
        this._drag = false;
        this._commit(0);
        this._render(true);
      };
      svg.addEventListener('pointermove', move);
      svg.addEventListener('pointerup', up);
      svg.addEventListener('pointercancel', up);
    });
  }

  _valFromPointer(ev, st) {
    const a = st.attributes, rect = this._svg.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 300 - CX;
    const y = ((ev.clientY - rect.top) / rect.height) * 300 - CY;
    let deg = (Math.atan2(y, x) * 180) / Math.PI;
    deg = (deg + 360) % 360;
    let rel = deg - A0; if (rel < 0) rel += 360;
    if (rel > SWEEP) rel = rel > SWEEP + (360 - SWEEP) / 2 ? 0 : SWEEP;
    const [mn, mx] = this._range(a), step = this._step(a);
    const v = mn + (rel / SWEEP) * (mx - mn);
    return Math.min(mx, Math.max(mn, Math.round(v / step) * step));
  }

  _dragMove(ev) {
    const st = this._st(this._config.entity);
    if (!st) return;
    const key = this._dual(st) ? this._side : 'single';
    let v = this._valFromPointer(ev, st);
    if (key === 'low') v = Math.min(v, this._targets(st).high - this._step(st.attributes) * 2);
    if (key === 'high') v = Math.max(v, this._targets(st).low + this._step(st.attributes) * 2);
    this._pending = { key, value: v, t: Date.now() };
    this._paintLive(st);
  }

  _paintLive(st) {
    const a = st.attributes, root = this.shadowRoot, t = this._targets(st);
    const d = this._dual(st) ? this._arc(this._angle(t.low, a), this._angle(t.high, a), R) : this._arc(A0, this._angle(t.single, a), R);
    ['arc', 'arcglow'].forEach((id) => { const el = root.getElementById(id); if (el) el.setAttribute('d', d); });
    if (this._dual(st)) {
      ['low', 'high'].forEach((k) => {
        const kn = root.getElementById('knob-' + k); if (!kn) return;
        const [x, y] = this._pt(this._angle(t[k], a), R); kn.setAttribute('cx', x); kn.setAttribute('cy', y);
      });
      const vals = root.querySelectorAll('.big .v');
      if (vals.length === 2) { vals[0].textContent = this._fmt(t.low); vals[1].textContent = this._fmt(t.high); }
    } else {
      const kn = root.getElementById('knob-single');
      if (kn) { const [x, y] = this._pt(this._angle(t.single, a), R); kn.setAttribute('cx', x); kn.setAttribute('cy', y); }
      const v = root.getElementById('val'); if (v) v.textContent = this._fmt(t.single);
    }
  }

  _act(act, val) {
    const st = this._st(this._config.entity);
    if (!st) return;
    const a = st.attributes;
    switch (act) {
      case 'step': {
        const dual = this._dual(st), key = dual ? this._side : 'single', t = this._targets(st);
        const base = dual ? t[key] : t.single;
        if (base == null) return;
        const [mn, mx] = this._range(a), step = this._step(a);
        let v = Math.min(mx, Math.max(mn, Math.round((base + Number(val) * step) / step) * step));
        if (key === 'low') v = Math.min(v, t.high - step * 2);
        if (key === 'high') v = Math.max(v, t.low + step * 2);
        this._pending = { key, value: v, t: Date.now() };
        this._render(true);
        this._commit(900);
        break;
      }
      case 'side': this._side = val; this._render(true); break;
      case 'mode': if (val) this._call('climate', 'set_hvac_mode', { hvac_mode: val }); break;
      case 'fan': {
        const fm = a.fan_modes || []; if (!fm.length) return;
        const next = a.fan_mode === 'on' ? (fm.includes('off') ? 'off' : fm.find((x) => x !== 'on')) : (fm.includes('on') ? 'on' : fm[(fm.indexOf(a.fan_mode) + 1) % fm.length]);
        this._call('climate', 'set_fan_mode', { fan_mode: next });
        break;
      }
      case 'preset': {
        const pm = a.preset_modes || []; if (!pm.length) return;
        const next = pm[(pm.indexOf(a.preset_mode) + 1) % pm.length];
        this._call('climate', 'set_preset_mode', { preset_mode: next });
        break;
      }
      case 'humidifier':
        if (this._config.humidifier) this._hass.callService('homeassistant', 'toggle', { entity_id: this._config.humidifier });
        break;
      case 'more': this._moreInfo(this._config.entity); break;
      default: break;
    }
  }

  _commit(delay) {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      const st = this._st(this._config.entity), p = this._pending;
      if (!st || !p) return;
      if (p.key === 'single') this._call('climate', 'set_temperature', { temperature: p.value });
      else {
        const t = this._targets(st);
        this._call('climate', 'set_temperature', { target_temp_low: t.low, target_temp_high: t.high });
      }
    }, delay);
  }

  _call(domain, service, data) {
    this._hass.callService(domain, service, Object.assign({ entity_id: this._config.entity }, data)).catch((err) => {
      this._pending = null;
      this._render(true);
      this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message: `Thermostat: ${err.message || err}` }, bubbles: true, composed: true }));
    });
  }

  _moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
  }

  /* ---------- styles ---------- */
  _css() {
    return `<style>
:host { display:block; }
* { box-sizing:border-box; }
button { font:inherit; color:inherit; background:none; border:none; padding:0; cursor:pointer; -webkit-tap-highlight-color:transparent; }
button:disabled { cursor:default; opacity:.5; }
ha-icon { --mdc-icon-size:18px; display:inline-flex; }
.card { position:relative; overflow:hidden; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.07); border-radius:28px; padding:22px; color:#f3f4f6; font-family:var(--ha-font-family-body, Roboto, sans-serif); transition:border-color .4s; }
.card::before { content:''; position:absolute; top:-130px; right:-130px; width:360px; height:360px; border-radius:50%; background:radial-gradient(closest-side, color-mix(in srgb, var(--c2) 24%, transparent), transparent); pointer-events:none; opacity:.35; transition:opacity .4s; }
.card.fx-heat::before, .card.fx-cool::before { opacity:1; animation:breathe 4s ease-in-out infinite; }
.card.fx-off::before { opacity:0; }
.card.fx-heat, .card.fx-cool { border-color:color-mix(in srgb, var(--c2) 28%, rgba(255,255,255,0.07)); }
.empty { padding:24px; color:#9aa0aa; }
.head { position:relative; display:flex; align-items:center; gap:12px; }
.title { font-size:13px; letter-spacing:.14em; font-weight:600; color:#8b919c; flex:1; }
.status { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:600; color:var(--c2); }
.fx-idle .status { color:#9aa0aa; }
.fx-off .status { color:#6b7280; }
.dot { width:8px; height:8px; border-radius:50%; display:inline-block; background:currentColor; }
.dot.pulse { box-shadow:0 0 0 0 currentColor; animation:ping 1.8s ease-out infinite; }
.more { width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#9aa0aa; background:rgba(255,255,255,0.05); }
.more:hover { background:rgba(255,255,255,0.09); }
.dialwrap { position:relative; width:100%; max-width:330px; margin:6px auto 0; aspect-ratio:1/1; container-type:inline-size; }
.dial { width:100%; height:100%; display:block; overflow:visible; user-select:none; -webkit-user-select:none; }
.inner { fill:rgba(255,255,255,0.025); stroke:rgba(255,255,255,0.05); stroke-width:1; }
.fx-off .inner { fill:rgba(255,255,255,0.015); }
.track { fill:none; stroke:rgba(255,255,255,0.07); stroke-width:16; stroke-linecap:round; }
.arc { fill:none; stroke:url(#g); stroke-width:16; stroke-linecap:round; }
.fx-idle .arc { opacity:.7; }
.arcglow { fill:none; stroke:var(--c2); stroke-width:22; stroke-linecap:round; opacity:.35; filter:blur(8px); animation:glowpulse 2.6s ease-in-out infinite; }
.halo { transform-origin:150px 150px; }
.fx-heat .halo, .fx-cool .halo { animation:halo 3.2s ease-in-out infinite; }
.tick { stroke:rgba(255,255,255,0.12); stroke-width:2; stroke-linecap:round; }
.tick.lit { stroke:color-mix(in srgb, var(--c2) 75%, white 10%); }
.fx-idle .tick.lit { stroke:color-mix(in srgb, var(--c2) 45%, rgba(255,255,255,0.15)); }
.knob { fill:#fff; stroke:color-mix(in srgb, var(--c2) 60%, transparent); stroke-width:6; paint-order:stroke; filter:drop-shadow(0 2px 6px rgba(0,0,0,.5)); }
.knob:not(.sel) { fill:#d1d5db; }
.cur { fill:#fff; opacity:.85; }
.lim { font-size:12px; fill:#6b7280; font-weight:600; }
.hit { fill:none; stroke:transparent; stroke-width:48; stroke-linecap:round; cursor:grab; touch-action:none; pointer-events:stroke; }
.fx circle { transform-box:fill-box; transform-origin:center; opacity:0; animation-iteration-count:infinite; animation-timing-function:ease-in; }
.fx.heat circle { fill:var(--c2); animation-name:rise; filter:drop-shadow(0 0 3px var(--c2)); }
.fx.cool circle { fill:var(--c1); animation-name:fall; filter:drop-shadow(0 0 2px var(--c2)); }
.center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; text-align:center; }
.cicon { --mdc-icon-size:clamp(14px, 6cqw, 20px); color:var(--c2); margin-bottom:1cqw; }
.fx-heat .cicon { animation:flicker 1.6s ease-in-out infinite; }
.fx-cool .cicon { animation:spin 9s linear infinite; }
.fx-idle .cicon { opacity:.6; }
.fx-off .cicon { color:#6b7280; }
.verb { font-size:clamp(9px, 3.3cqw, 11px); letter-spacing:.2em; font-weight:700; color:var(--c2); }
.fx-idle .verb { color:#9aa0aa; }
.fx-off .verb { color:#6b7280; }
.big { display:flex; align-items:flex-start; justify-content:center; line-height:1; margin:1.5cqw 0 2cqw; }
.big .v { font-size:22cqw; font-weight:700; letter-spacing:-0.04em; font-variant-numeric:tabular-nums; }
.big .v.dim { color:#9aa0aa; }
.big .v.sm { font-size:14cqw; pointer-events:auto; cursor:pointer; opacity:.45; padding:0 2px; border-radius:10px; }
.big .v.sm.on { opacity:1; }
.big .dash { font-size:10cqw; color:#6b7280; margin:1.5cqw 1.5cqw 0; }
.big .deg { font-size:8cqw; font-weight:600; color:#9aa0aa; margin-top:1.5cqw; }
.sub { font-size:clamp(10px, 4.2cqw, 13px); color:#9aa0aa; white-space:nowrap; }
.step { position:absolute; bottom:1%; width:clamp(38px, 14cqw, 48px); height:clamp(38px, 14cqw, 48px); border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1); color:#f3f4f6; transition:background .15s, transform .1s; }
.step ha-icon { --mdc-icon-size:22px; }
.step:hover { background:rgba(255,255,255,0.12); }
.step:active { transform:scale(.94); background:color-mix(in srgb, var(--c2) 35%, transparent); }
.minus { left:31%; }
.plus { right:31%; }
.power { position:absolute; bottom:1%; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:8px; padding:10px 18px; border-radius:16px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); font-weight:600; white-space:nowrap; }
.stats { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; margin-top:14px; }
.stat { position:relative; display:flex; flex-direction:column; align-items:flex-start; padding:12px 14px; border-radius:18px; background:rgba(255,255,255,0.045); border:1px solid rgba(255,255,255,0.06); text-align:left; transition:background .15s, border-color .15s; cursor:pointer; }
.stat:hover:not(:disabled) { background:rgba(255,255,255,0.075); }
.stat.sel:focus-within { border-color:color-mix(in srgb, var(--c2) 55%, transparent); }
.stat.act { background:linear-gradient(145deg, color-mix(in srgb, var(--c2) 18%, transparent), rgba(255,255,255,0.03)); border-color:color-mix(in srgb, var(--c2) 45%, transparent); }
.k { display:flex; align-items:center; gap:6px; width:100%; font-size:11px; letter-spacing:.12em; color:#8b919c; font-weight:600; }
.k ha-icon { --mdc-icon-size:15px; margin-left:auto; opacity:.75; }
.k ha-icon.spin { animation:spin 2.4s linear infinite; }
.sv { font-size:21px; font-weight:700; margin-top:4px; }
.sv.mode { color:var(--c2); }
.fx-off .sv.mode { color:#9aa0aa; }
.msel { position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; font-size:16px; color-scheme:dark; -webkit-appearance:none; appearance:none; border:none; }
.msel option { background:#1b1e24; color:#f3f4f6; }
.reads { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); margin-top:16px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.07); }
.rd { display:flex; flex-direction:column; align-items:flex-start; gap:3px; min-width:0; padding:0 10px; }
.rd + .rd { border-left:1px solid rgba(255,255,255,0.07); }
.rd:first-child { padding-left:2px; }
.rk { display:flex; align-items:center; gap:5px; font-size:10px; letter-spacing:.1em; font-weight:700; color:#8b919c; text-transform:uppercase; white-space:nowrap; }
.rk ha-icon { --mdc-icon-size:14px; }
.rv { font-size:20px; font-weight:700; letter-spacing:-0.01em; }
.rs { font-size:11.5px; line-height:1.25; color:#9aa0aa; }
.sw { position:relative; width:42px; height:24px; border-radius:12px; background:rgba(255,255,255,0.12); margin:3px 0 1px; transition:background .2s; }
.sw .knobsw { position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#e5e7eb; box-shadow:0 1px 3px rgba(0,0,0,.4); transition:transform .2s; }
.sw.on { background:#2dd4bf; }
.sw.on .knobsw { transform:translateX(18px); background:#fff; }
@keyframes rise { 0% { transform:translateY(0) scale(1); opacity:0; } 15% { opacity:.95; } 100% { transform:translateY(-118px) scale(.4); opacity:0; } }
@keyframes fall { 0% { transform:translate(0,0); opacity:0; } 15% { opacity:.9; } 100% { transform:translate(6px,118px); opacity:0; } }
@keyframes glowpulse { 0%,100% { opacity:.18; } 50% { opacity:.5; } }
@keyframes halo { 0%,100% { transform:scale(1); opacity:.85; } 50% { transform:scale(1.06); opacity:1; } }
@keyframes breathe { 0%,100% { opacity:.65; } 50% { opacity:1; } }
@keyframes flicker { 0%,100% { transform:scale(1); opacity:1; } 40% { transform:scale(1.1) rotate(-3deg); opacity:.85; } 70% { transform:scale(.95) rotate(2deg); } }
@keyframes spin { to { transform:rotate(360deg); } }
@keyframes ping { 0% { box-shadow:0 0 0 0 color-mix(in srgb, currentColor 60%, transparent); } 100% { box-shadow:0 0 0 8px transparent; } }
@media (prefers-reduced-motion: reduce) { .fx, .arcglow { display:none; } *, .card::before { animation:none !important; } }
</style>`;
  }
}

if (!customElements.get('linwood-climate-card')) customElements.define('linwood-climate-card', LinwoodClimateCard);
window.customCards = window.customCards || [];
if (!window.customCards.find((c) => c.type === 'linwood-climate-card')) {
  window.customCards.push({ type: 'linwood-climate-card', name: 'Linwood Climate Card', description: 'Dial thermostat with mode, fan, preset and room readings', preview: false });
}
