/* Linwood Climate Card v1.5.1 — custom dial thermostat for Home Assistant
 * v1.5.1: the Comfort icon stays on the same line as its label on phones.
 * v1.5.0: the Comfort tile is a dropdown (like Mode) instead of tap-to-cycle: Schedule (presses `resume:` to clear the
 *         hold and go back to the thermostat's schedule) then each comfort option (Home / Sleep / Away).
 * v1.4.1: on narrow cards the Rooms header drops the word "Targeting" (crosshair icon + room name), so the name isn't cut off.
 * v1.4.0: `targeting:` (an entity with an `active_sensors` attribute, e.g. the ecobee cloud climate entity) shows which
 *         room(s) the thermostat is actually following: "Targeting Office" / "Averaging 3 rooms" in the Rooms header,
 *         a Target / In average tag on those rows and a ring on their rail dots. Replaces the "Occupied" row label
 *         (occupancy still shows as the teal presence dot). `sleep:` (a schedule / binary entity) adds "· sleep" while on.
 *         Rooms match `active_sensors` by `sensor:` if set, otherwise by `name:`.
 * v1.3.1: the Thermostat tag on a room row hides when the column is narrow instead of clipping.
 * v1.3.0: `rooms:` list → Rooms panel: a shared temperature rail (every room as a dot against the setpoint and its comfort
 *         band) plus one row per room with temperature, humidity where the room has it, a 24 h sparkline on a shared
 *         scale, live presence (motion / occupancy, "quiet · 12 min") and battery warnings. `comfort:` (a select such as the
 *         ecobee Home / Sleep / Away mode) replaces the Preset tile; `resume:` (a button such as ecobee Clear Hold) adds a
 *         Resume chip to the header. The single `room:` reading still works for configs without `rooms:`.
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
const LCC_ROOM_COLORS = ['#f5b83d', '#38bdf8', '#a78bfa', '#2dd4bf', '#f472b6', '#4ade80'];
const LCC_COMFORT = {
  home: { label: 'Home', icon: 'mdi:home-outline' },
  sleep: { label: 'Sleep', icon: 'mdi:power-sleep' },
  away: { label: 'Away', icon: 'mdi:exit-run' },
};
const LCC_SCHEDULE = '__schedule__';
const lccEsc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lccAgo = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h${m % 60 && h < 6 ? ' ' + (m % 60) + ' min' : ''}`;
  return `${Math.floor(h / 24)} d`;
};
/* HA history rows, compressed (s / lc / lu, epoch seconds) or full (state / last_changed) → [{ t, v }] */
const lccRows = (rows) => {
  const out = [];
  (rows || []).forEach((e) => {
    const ts = e.lc != null ? e.lc : e.lu;
    const t = ts != null ? ts * 1000 : Date.parse(e.last_changed || e.last_updated);
    const v = parseFloat(e.s != null ? e.s : e.state);
    if (isFinite(t)) out.push({ t, v: isFinite(v) ? v : null });
  });
  return out.sort((a, b) => a.t - b.t);
};
/* average into n buckets so a day of readings draws as a light path; gaps (unavailable) survive as breaks */
const lccThin = (pts, t0, t1, n) => {
  const w = (t1 - t0) / n, out = [];
  let k = null, sum = 0, cnt = 0;
  const flush = () => { if (cnt) out.push({ t: t0 + (k + 0.5) * w, v: sum / cnt }); sum = 0; cnt = 0; };
  pts.forEach((p) => {
    if (p.t < t0) { if (p.v != null) { k = 0; sum = p.v; cnt = 1; } return; }   // the reading in force when the window opens
    if (p.v == null) { flush(); k = null; out.push(p); return; }
    const kk = Math.max(0, Math.min(n - 1, Math.floor((p.t - t0) / w)));
    if (kk !== k) { flush(); k = kk; }
    sum += p.v; cnt++;
  });
  flush();
  return out;
};

class LinwoodClimateCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity || !config.entity.startsWith('climate.')) throw new Error('Set "entity" to a climate entity');
    this._config = config;
    this._rooms = (Array.isArray(config.rooms) ? config.rooms : [])
      .filter((r) => r && (r.temperature || r.motion))
      .map((r, i) => Object.assign({ color: LCC_ROOM_COLORS[i % LCC_ROOM_COLORS.length] }, r));
    this._pending = null;
    this._side = 'low';
    this._drag = false;
    this._sig = null;
    this._hist = null;
    this._histT = 0;
    this._histVer = 0;
    if (!this.shadowRoot) { this.attachShadow({ mode: 'open' }); this._wire(); }
    if (this._hass) this._render(true);
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._drag) this._render(false);
    this._history();
  }

  connectedCallback() {
    // relative times ("quiet · 12 min") move on even when no state changes
    clearInterval(this._clock);
    this._clock = setInterval(() => { if (!this._drag) this._render(false); }, 30000);
    this._history();
  }

  disconnectedCallback() { clearInterval(this._clock); this._clock = null; }

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

  /* Which rooms the thermostat follows right now, from `targeting:`'s active_sensors (ecobee cloud: ["Bedroom", ...]).
   * null = no `targeting:` configured (rows keep the old Occupied label); { known:false } = configured but no data. */
  _targeting() {
    if (!this._config.targeting) return null;
    const s = this._st(this._config.targeting);
    const raw = s && s.state !== 'unavailable' && Array.isArray(s.attributes.active_sensors) ? s.attributes.active_sensors : null;
    if (!raw || !raw.length) return { known: false, keys: new Set(), rooms: [] };
    const key = (n) => String(n).replace(/\s*\([0-9a-f]{8,}\)\s*$/i, '').trim().toLowerCase();
    const keys = new Set(raw.map(key));
    const rooms = this._rooms.filter((r) => keys.has(key(r.sensor || r.name || '')));
    const sl = this._st(this._config.sleep);
    return { known: true, keys, key, rooms, count: keys.size, sleep: !!sl && sl.state === 'on' };
  }
  _isTarget(tg, r) { return !!(tg && tg.known && tg.keys.has(tg.key(r.sensor || r.name || ''))); }

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
    const ids = [c.weather, c.humidity, c.humidifier, c.comfort, c.room && c.room.temperature, c.room && c.room.humidity];
    this._rooms.forEach((r) => ids.push(r.temperature, r.humidity, r.motion, r.occupancy, r.battery));
    ids.push(c.sleep);
    const tg = this._st(c.targeting);
    parts.push(tg ? tg.state + '|' + JSON.stringify(tg.attributes.active_sensors || null) : '-');
    ids.forEach((id) => {
      const s = this._st(id);
      parts.push(s ? s.state + '|' + s.last_changed + (s.attributes.temperature != null ? '|' + s.attributes.temperature : '') : '-');
    });
    parts.push(JSON.stringify(this._pending), this._side, this._histVer);
    if (this._rooms.length) parts.push(Math.floor(Date.now() / 60000));
    return parts.join('§');
  }

  /* ---------- room history (sparklines) ---------- */
  _histHours() { return Math.max(1, Number(this._config.history_hours) || 24); }

  _history() {
    if (!this._hass || !this._rooms.length || this._fetching || !this.isConnected) return;
    if (this._histT && Date.now() - this._histT < 600000) { this._histLive(); return; }
    this._fetchHistory();
  }

  async _fetchHistory() {
    const ids = this._rooms.map((r) => r.temperature).filter(Boolean);
    if (!ids.length || !this._hass.callWS) return;
    this._fetching = true;
    this._histT = Date.now();
    const t1 = Date.now(), t0 = t1 - this._histHours() * 3600000;
    try {
      const r = await this._hass.callWS({
        type: 'history/history_during_period', start_time: new Date(t0).toISOString(), end_time: new Date(t1).toISOString(),
        entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false,
      });
      const h = {};
      ids.forEach((id) => { h[id] = lccRows(r && r[id]); });
      this._hist = h;
      this._histVer++;
    } catch (e) {
      this._histT = Date.now() - 480000;   // retry in ~2 minutes; the rows keep their last lines meanwhile
    }
    this._fetching = false;
    if (!this._drag) this._render(false);
  }

  /* new readings are appended as they arrive, so sparklines keep moving between the 10-minute refetches */
  _histLive() {
    if (!this._hist) return;
    let grew = false;
    this._rooms.forEach((r) => {
      const arr = r.temperature && this._hist[r.temperature], s = this._st(r.temperature);
      if (!arr || !s) return;
      const t = Date.parse(s.last_changed), last = arr[arr.length - 1];
      if (!isFinite(t) || (last && last.t >= t)) return;
      const v = parseFloat(s.state);
      arr.push({ t, v: isFinite(v) ? v : null });
      grew = true;
    });
    if (grew) { this._histVer++; if (!this._drag) this._render(false); }
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
    const cf = this._st(this._config.comfort);
    let fourth;
    if (cf) {
      // a comfort select (ecobee Home / Sleep / Away); "unknown" means the thermostat is simply running its schedule
      const opts4 = (cf.attributes.options || []), known = opts4.includes(cf.state);
      const lk = LCC_COMFORT[cf.state] || {};
      const lab = known ? (lk.label || this._cap(cf.state)) : (cf.state === 'unavailable' ? 'Offline' : 'Schedule');
      // a dropdown: "Schedule" (presses `resume:` to clear the hold) plus each comfort option
      const canResume = !!this._st(this._config.resume);
      const dis = !opts4.length || cf.state === 'unavailable';
      const copts = [];
      if (canResume || !known) copts.push(`<option value="${LCC_SCHEDULE}"${known ? '' : ' selected'}${canResume ? '' : ' disabled'}>Schedule</option>`);
      opts4.forEach((o) => copts.push(`<option value="${lccEsc(o)}"${o === cf.state ? ' selected' : ''}>${lccEsc((LCC_COMFORT[o] || {}).label || this._cap(o))}</option>`));
      fourth = `<label class="stat sel${known ? ' act' : ''}"><span class="k">COMFORT<ha-icon icon="mdi:chevron-down"></ha-icon></span><span class="sv svf"><ha-icon class="svi" icon="${known ? (lk.icon || 'mdi:tune-variant') : 'mdi:calendar-clock'}"></ha-icon>${lccEsc(lab)}</span>
      <select class="msel csel" aria-label="Comfort setting" ${dis ? 'disabled' : ''}>${copts.join('')}</select></label>`;
    } else {
      fourth = `<button class="stat${presetAct ? ' act' : ''}" data-act="preset" ${presets.length ? '' : 'disabled'}><span class="k">PRESET<ha-icon icon="${presetAct ? 'mdi:leaf' : 'mdi:home-outline'}"></ha-icon></span><span class="sv">${presetTxt}</span></button>`;
    }
    const targetTxt = off ? '—' : dual ? `${this._fmt(t.low)}–${this._fmt(t.high)}°` : `${this._fmt(t.single)}°`;
    const opts = (a.hvac_modes || []).map((hm) => {
      const lab = (LCC_MODES[hm] || {}).label || this._cap(hm);
      return `<option value="${hm}"${hm === mode ? ' selected' : ''}>${lab}</option>`;
    }).join('');

    // flat readings (with a rooms list, the weather moves into the Rooms panel header)
    const reads = [];
    const wx = this._st(this._config.weather);
    const roomsPanel = this._rooms.length ? this._roomsHtml(st, look, t, dual, off, wx) : '';
    if (wx && !roomsPanel) {
      const wt = wx.attributes.temperature != null ? Math.round(wx.attributes.temperature) : null;
      reads.push(this._read(LCC_WX[wx.state] || 'mdi:weather-partly-cloudy', ['sunny', 'clear-night', 'partlycloudy'].includes(wx.state) ? '#fbbf24' : '#cbd5e1',
        'Outside', `${this._fmt(wt)}°`, LCC_WXL[wx.state] || this._cap(wx.state)));
    }
    const room = this._config.room;
    if (room && !roomsPanel) {
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
    ${this._st(this._config.resume) ? `<button class="resume" data-act="resume" title="Resume the thermostat schedule (clears any hold)"><ha-icon icon="mdi:calendar-sync"></ha-icon><span>Resume</span></button>` : ''}
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
    ${fourth}
  </div>
  ${roomsPanel}
  ${reads.length ? `<div class="reads">${reads.join('')}</div>` : ''}
</div>`;
  }

  /* ---------- Rooms panel ---------- */
  _roomsHtml(st, look, t, dual, off, wx) {
    const now = Date.now(), t0 = now - this._histHours() * 3600000;
    const rows = this._rooms.map((r, i) => ({
      r, i, temp: this._num(r.temperature), hum: this._num(r.humidity), bat: this._num(r.battery),
      ms: this._st(r.motion), os: this._st(r.occupancy),
    }));
    const vals = rows.map((x) => x.temp).filter((v) => v != null);
    const tl = off ? null : (dual ? t.low : t.single), th = off ? null : (dual ? t.high : t.single);

    const tg = this._targeting();
    let meta = '';
    if (tg) {
      const why = tg.sleep ? ' <span class="tw">· sleep</span>' : '';
      const ic = '<ha-icon icon="mdi:crosshairs-gps"></ha-icon>';
      if (!tg.known) meta = `${ic}<span class="tl">Target</span> unknown`;
      else if (tg.count === 1 && tg.rooms.length === 1) {
        const r = tg.rooms[0];
        meta = `${ic}<span class="tl">Targeting </span><b style="color:${r.color}">${lccEsc(r.name || 'Room')}</b>${why}`;
      } else {
        const all = tg.rooms.length === this._rooms.length && tg.count === this._rooms.length;
        meta = `${ic}<span class="tl">Averaging </span><b>${all ? 'all rooms' : tg.count + ' rooms'}</b>${why}`;
      }
    } else if (vals.length > 1) {
      const sp = Math.max(...vals) - Math.min(...vals), avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      meta = `${this._fmt(Math.round(sp * 10) / 10)}° spread · avg ${this._fmt(Math.round(avg * 10) / 10)}°`;
    }
    let wxp = '';
    if (wx) {
      const wt = wx.attributes.temperature;
      const sunny = ['sunny', 'clear-night', 'partlycloudy'].includes(wx.state);
      wxp = `<button class="wxp" data-act="info" data-val="${lccEsc(wx.entity_id)}" title="${lccEsc(LCC_WXL[wx.state] || this._cap(wx.state))}"><ha-icon icon="${LCC_WX[wx.state] || 'mdi:weather-partly-cloudy'}" style="color:${sunny ? '#fbbf24' : '#cbd5e1'}"></ha-icon><span class="wxt">${wt != null ? Math.round(wt) : '--'}°</span><span class="wxl">outside</span></button>`;
    }

    // one scale for every sparkline, so a flat line really means a steady room
    let lo = Infinity, hi = -Infinity;
    const series = rows.map((x) => {
      const pts = this._hist && x.r.temperature ? this._hist[x.r.temperature] : null;
      if (!pts || !pts.length) return null;
      const thin = lccThin(pts, t0, now, 60);
      thin.forEach((p) => { if (p.v != null) { lo = Math.min(lo, p.v); hi = Math.max(hi, p.v); } });
      return thin;
    });
    vals.forEach((v) => { lo = Math.min(lo, v); hi = Math.max(hi, v); });
    if (!isFinite(lo)) { lo = 60; hi = 80; }
    if (hi - lo < 2) { const m = (hi + lo) / 2; lo = m - 1; hi = m + 1; }

    const rail = vals.length ? this._rail(rows, tl, th, tg) : '';
    const list = rows.map((x, k) => this._roomRow(x, series[k], t0, now, lo, hi, tl, th, tg)).join('');
    return `<div class="roomsbox">
    <div class="rhead"><span class="rtitle">ROOMS</span>${meta ? `<span class="rmeta${tg ? ' tgt' : ''}">${meta}</span>` : ''}${wxp}</div>
    ${rail}
    <div class="rlist">${list}</div>
  </div>`;
  }

  /* every room on one horizontal temperature scale, against the setpoint and a ±1° comfort band */
  _rail(rows, tl, th, tgt) {
    const pts = rows.filter((x) => x.temp != null);
    const all = pts.map((x) => x.temp);
    if (tl != null) all.push(tl, th);
    let lo = Math.floor(Math.min(...all) - 0.6), hi = Math.ceil(Math.max(...all) + 0.6);
    for (let g = 0; hi - lo < 4 && g < 6; g++) { if (g % 2) hi++; else lo--; }
    const X = (v) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
    // dots that would overlap stack upward on stems
    const placed = pts.map((x) => ({ x, p: X(x.temp) })).sort((a, b) => a.p - b.p);
    const lastAt = [];
    placed.forEach((o) => {
      let L = 0;
      while (lastAt[L] != null && o.p - lastAt[L] < 9 && L < 3) L++;
      o.L = L;
      lastAt[L] = o.p;
    });
    const levels = Math.max(1, ...placed.map((o) => o.L + 1));
    const dots = placed.map((o) => {
      const r = o.x.r, live = o.x.ms && o.x.ms.state === 'on', on = this._isTarget(tgt, r);
      return `<button class="rdot${live ? ' live' : ''}${on ? ' tgt' : ''}" data-act="info" data-val="${lccEsc(r.temperature)}" style="left:${o.p.toFixed(2)}%;--rc:${r.color};--lvl:${o.L}" title="${lccEsc(r.name || 'Room')} · ${this._fmt(Math.round(o.x.temp * 10) / 10)}°" aria-label="${lccEsc(r.name || 'Room')}"><ha-icon icon="${r.icon || 'mdi:home-thermometer-outline'}"></ha-icon></button>`;
    }).join('');
    let ticks = '';
    for (let v = lo; v <= hi; v++) ticks += `<i class="rtk" style="left:${X(v).toFixed(2)}%"></i>`;
    let band = '', tg = '';
    if (tl != null) {
      const a = X(tl === th ? tl - 1 : tl), b = X(tl === th ? th + 1 : th);
      band = `<i class="rband" style="left:${a.toFixed(2)}%;width:${(b - a).toFixed(2)}%"></i>`;
      const marks = tl === th ? [tl] : [tl, th];
      tg = marks.map((v) => `<span class="rtg" style="left:${X(v).toFixed(2)}%"><i></i>${this._fmt(v)}°</span>`).join('');
    }
    return `<div class="rail" style="--levels:${levels}">
      <div class="rdots">${dots}</div>
      <div class="rtrack">${band}${ticks}</div>
      <div class="rscale"><span class="rend l">${lo}°</span><span class="rend r">${hi}°</span>${tg}</div>
    </div>`;
  }

  _roomRow(x, pts, t0, t1, lo, hi, tl, th, tg) {
    const r = x.r, now = Date.now();
    const motion = x.ms && x.ms.state === 'on', occ = x.os && x.os.state === 'on';
    const offline = [x.ms, x.os].some((s) => s && s.state === 'unavailable') || (r.temperature && !this._st(r.temperature)) ||
      (this._st(r.temperature) && this._st(r.temperature).state === 'unavailable');
    let pres = '', pcls = '';
    if (offline) { pres = 'Offline'; pcls = 'off'; }
    else if (motion) { pres = 'Motion now'; pcls = 'live'; }
    else if (occ) { pcls = 'occ'; if (!tg) pres = 'Occupied'; }   // with `targeting:` the Target tag says more
    else if (x.ms || x.os) {
      const ref = x.ms || x.os, ago = now - Date.parse(ref.last_changed);
      pres = isFinite(ago) ? `Quiet · ${lccAgo(ago)}` : 'Quiet';
    }
    const bits = [], on = this._isTarget(tg, r);
    if (on) bits.push(`<span class="tg"><ha-icon icon="mdi:crosshairs-gps"></ha-icon>${tg.count > 1 ? 'In average' : 'Target'}</span>`);
    if (pres) bits.push(`<span class="p">${pres}</span>`);
    if (x.hum != null) bits.push(`<span class="h"><ha-icon icon="mdi:water-percent"></ha-icon>${Math.round(x.hum)}%</span>`);
    if (x.bat != null && x.bat <= (r.battery_low || 20)) bits.push(`<span class="warn"><ha-icon icon="mdi:battery-alert-variant-outline"></ha-icon>${Math.round(x.bat)}%</span>`);
    let delta = '', dcls = '';
    if (tl != null && x.temp != null) {
      const d = x.temp < tl ? x.temp - tl : x.temp > th ? x.temp - th : 0;
      const dr = Math.round(d * 10) / 10;
      if (Math.abs(dr) < 0.05) { delta = tl === th ? 'on target' : 'in range'; dcls = 'ok'; }
      else { delta = `${dr > 0 ? '+' : '−'}${this._fmt(Math.abs(dr))}°`; dcls = Math.abs(dr) <= 1 ? 'near' : dr < 0 ? 'cold' : 'warm'; }
    }
    return `<button class="room ${pcls}${on ? ' tgt' : ''}" data-act="info" data-val="${lccEsc(r.temperature || r.motion)}" style="--rc:${r.color}">
      <span class="ric"><ha-icon icon="${r.icon || 'mdi:home-thermometer-outline'}"></ha-icon><i class="pdot"></i></span>
      <span class="rmain"><span class="rname">${lccEsc(r.name || 'Room')}${r.thermostat ? '<em>Thermostat</em>' : ''}</span><span class="rsub">${bits.join('')}</span></span>
      <span class="rspark">${this._spark(pts, t0, t1, lo, hi, r.color, x.i, x.temp)}</span>
      <span class="rtemp"><span class="rtv">${x.temp != null ? this._fmt(Math.round(x.temp * 10) / 10) : '--'}<small>°</small></span>${delta ? `<span class="rdl ${dcls}">${delta}</span>` : ''}</span>
    </button>`;
  }

  /* 24 h sparkline: line + soft fill; the latest reading holds to "now" and ends in a dot */
  _spark(pts, t0, t1, lo, hi, color, i, cur) {
    const W = 100, H = 32, P = 4;
    const X = (tm) => Math.min(W, Math.max(0, ((tm - t0) / (t1 - t0)) * W));
    const Y = (v) => P + (1 - (v - lo) / (hi - lo)) * (H - 2 * P);
    const segs = [];
    let seg = [];
    (pts || []).forEach((p) => {
      if (p.v == null) { if (seg.length) segs.push(seg); seg = []; return; }
      seg.push([X(p.t), Y(p.v)]);
    });
    if (seg.length) segs.push(seg);
    if (cur != null) {
      const last = segs[segs.length - 1];
      if (last) last.push([W, Y(cur)]); else segs.push([[W - 4, Y(cur)], [W, Y(cur)]]);
    }
    if (!segs.length) return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" class="spk-none"/></svg>`;
    let line = '', area = '';
    segs.forEach((s) => {
      if (s.length === 1) s.push([Math.min(W, s[0][0] + 2), s[0][1]]);
      const d = s.map((q, k) => `${k ? 'L' : 'M'}${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join(' ');
      line += d + ' ';
      area += `${d} L${s[s.length - 1][0].toFixed(2)} ${H} L${s[0][0].toFixed(2)} ${H} Z `;
    });
    // the end dot is HTML, not SVG: the sparkline stretches (preserveAspectRatio none) and would squash a circle
    const end = cur != null ? `<i class="spk-dot" style="top:${((Y(cur) / H) * 100).toFixed(1)}%"></i>` : '';
    const gid = `lccsg${i}`;
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".32"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#${gid})"/><path d="${line}" class="spk-line" style="stroke:${color}"/>
    </svg>${end}`;
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
      if (el && el.classList && el.classList.contains('csel')) {
        const cf = this._st(this._config.comfort);
        if (el.value === LCC_SCHEDULE) { if (cf && (cf.attributes.options || []).includes(cf.state)) this._act('resume'); }
        else if (cf && el.value !== cf.state) {
          this._hass.callService('select', 'select_option', { entity_id: this._config.comfort, option: el.value })
            .catch((err) => this._toast(`Comfort: ${err.message || err}`));
        }
        return;
      }
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
      case 'comfort': {
        const cf = this._st(this._config.comfort), op = (cf && cf.attributes.options) || [];
        if (!op.length) return;
        const next = op[(op.indexOf(cf.state) + 1) % op.length];
        this._hass.callService('select', 'select_option', { entity_id: this._config.comfort, option: next })
          .catch((err) => this._toast(`Comfort: ${err.message || err}`));
        break;
      }
      case 'resume':
        if (!this._config.resume) return;
        this._hass.callService('button', 'press', { entity_id: this._config.resume })
          .then(() => this._toast('Schedule resumed'))
          .catch((err) => this._toast(`Resume: ${err.message || err}`));
        break;
      case 'info': if (val) this._moreInfo(val); break;
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

  _toast(message) {
    this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message }, bubbles: true, composed: true }));
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
.card { position:relative; overflow:hidden; container-type:inline-size; container-name:lccard; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.07); border-radius:28px; padding:22px; color:#f3f4f6; font-family:var(--ha-font-family-body, Roboto, sans-serif); transition:border-color .4s; }
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
.stat .sv.svf { display:flex; align-items:center; gap:6px; min-width:0; max-width:100%; white-space:nowrap; }
.stat .sv .svi { --mdc-icon-size:18px; flex:none; color:var(--c2); }
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
.resume { display:flex; align-items:center; gap:6px; height:32px; padding:0 11px; border-radius:10px; font-size:13px; font-weight:600; color:#cbd5e1; background:rgba(255,255,255,0.05); }
.resume ha-icon { --mdc-icon-size:16px; color:var(--c2); }
.resume:hover { background:rgba(255,255,255,0.09); }
.resume:active { transform:scale(.96); }
@container lccard (max-width: 360px) { .resume span { display:none; } .resume { padding:0 8px; } }
/* Rooms panel */
.roomsbox { margin-top:16px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.07); container-type:inline-size; container-name:rooms; }
.rhead { display:flex; align-items:center; gap:10px; min-height:30px; }
.rtitle { font-size:11px; letter-spacing:.14em; font-weight:700; color:#8b919c; }
.rmeta { flex:1; font-size:12px; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.wxp { margin-left:auto; display:flex; align-items:center; gap:6px; height:30px; padding:0 10px; border-radius:10px; background:rgba(255,255,255,0.045); border:1px solid rgba(255,255,255,0.06); white-space:nowrap; }
.wxp ha-icon { --mdc-icon-size:17px; }
.wxt { font-size:14px; font-weight:700; }
.wxl { font-size:12px; color:#8b919c; }
.rail { position:relative; margin:10px 4px 4px; }
.rdots { position:relative; height:calc(var(--levels) * 28px + 6px); }
.rdot { position:absolute; bottom:calc(6px + var(--lvl) * 28px); transform:translateX(-50%); width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:var(--rc); color:#111318; box-shadow:0 0 0 3px #15171c, 0 4px 12px color-mix(in srgb, var(--rc) 35%, transparent); transition:left .6s cubic-bezier(.2,.8,.2,1), transform .15s; z-index:1; }
.rdot ha-icon { --mdc-icon-size:15px; }
.rdot:hover { transform:translateX(-50%) scale(1.12); z-index:2; }
.rdot::after { content:''; position:absolute; left:50%; top:100%; width:2px; margin-left:-1px; height:calc(6px + var(--lvl) * 28px); background:linear-gradient(var(--rc), color-mix(in srgb, var(--rc) 20%, transparent)); border-radius:1px; pointer-events:none; }
.rdot.live::before { content:''; position:absolute; inset:-3px; border-radius:50%; border:2px solid var(--rc); animation:radar 1.8s ease-out infinite; pointer-events:none; }
.rtrack { position:relative; height:6px; border-radius:3px; background:rgba(255,255,255,0.07); }
.rband { position:absolute; top:0; bottom:0; border-radius:3px; background:linear-gradient(90deg, color-mix(in srgb, var(--c2) 18%, transparent), color-mix(in srgb, var(--c2) 42%, transparent), color-mix(in srgb, var(--c2) 18%, transparent)); transition:left .5s, width .5s; }
.fx-off .rband { display:none; }
.rtk { position:absolute; top:9px; width:1px; height:4px; margin-left:-.5px; background:rgba(255,255,255,0.14); }
.rscale { position:relative; height:24px; margin-top:4px; font-size:11px; font-weight:600; color:#6b7280; font-variant-numeric:tabular-nums; }
.rend { position:absolute; top:7px; }
.rend.l { left:0; transform:translateX(-30%); }
.rend.r { right:0; transform:translateX(30%); }
.rtg { position:absolute; top:4px; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; color:var(--c2); font-size:11.5px; font-weight:700; line-height:1.1; padding:0 4px; background:#16181d; border-radius:6px; transition:left .5s; }
.rtg i { width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-bottom:5px solid var(--c2); margin-bottom:1px; }
.rlist { display:flex; flex-direction:column; gap:6px; margin-top:8px; }
.room { display:grid; grid-template-columns:38px minmax(0,1fr) minmax(48px,84px) auto; align-items:center; column-gap:12px; width:100%; padding:9px 12px 9px 9px; border-radius:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); text-align:left; transition:background .15s, border-color .3s; }
.room:hover { background:rgba(255,255,255,0.06); }
.room.live { border-color:color-mix(in srgb, #4ade80 30%, transparent); background:linear-gradient(100deg, color-mix(in srgb, #4ade80 9%, transparent), rgba(255,255,255,0.03) 55%); }
.ric { position:relative; width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:var(--rc); background:color-mix(in srgb, var(--rc) 14%, transparent); }
.ric ha-icon { --mdc-icon-size:19px; }
.pdot { position:absolute; right:-2px; top:-2px; width:10px; height:10px; border-radius:50%; background:#4b5563; border:2px solid #16181d; }
.room.occ .pdot { background:#2dd4bf; }
.room.live .pdot { background:#4ade80; box-shadow:0 0 8px #4ade80; animation:ping-g 1.6s ease-out infinite; }
.room.off .pdot { background:#ef4444; }
.rmain { display:flex; flex-direction:column; min-width:0; gap:3px; }
.rname { display:flex; align-items:center; gap:7px; font-size:14.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rname em { font-style:normal; font-size:9.5px; letter-spacing:.1em; text-transform:uppercase; font-weight:700; color:#8b919c; padding:2px 6px; border-radius:6px; background:rgba(255,255,255,0.06); }
.rsub { display:flex; align-items:center; flex-wrap:wrap; gap:4px 10px; font-size:12px; color:#8b919c; white-space:nowrap; }
.rsub ha-icon { --mdc-icon-size:13px; margin-right:1px; }
.rsub .h { display:inline-flex; align-items:center; color:#7dd3fc; }
.room.live .rsub .p { color:#4ade80; font-weight:600; }
.room.occ .rsub .p { color:#5eead4; }
.room.off .rsub .p { color:#f87171; }
.rsub .warn { display:inline-flex; align-items:center; color:#fbbf24; }
.rsub .tg { display:inline-flex; align-items:center; gap:2px; color:var(--rc); font-weight:700; }
.room.tgt { border-color:color-mix(in srgb, var(--rc) 38%, transparent); }
.room.tgt.live { border-color:color-mix(in srgb, #4ade80 30%, transparent); }
.rmeta.tgt { color:#8b919c; }
.rmeta.tgt b { font-weight:700; color:#e5e7eb; }
.rmeta .tw { color:#a78bfa; }
.rmeta.tgt ha-icon { --mdc-icon-size:14px; margin-right:4px; vertical-align:-2px; color:#8b919c; }
@container rooms (max-width: 400px) { .rmeta.tgt .tl { display:none; } }
.rdot.tgt { box-shadow:0 0 0 2px #15171c, 0 0 0 4px var(--rc), 0 4px 14px color-mix(in srgb, var(--rc) 50%, transparent); }
.rspark { position:relative; height:32px; min-width:0; }
.spark { width:100%; height:100%; display:block; overflow:visible; }
.spk-line { fill:none; stroke-width:1.8; stroke-linejoin:round; stroke-linecap:round; vector-effect:non-scaling-stroke; }
.spk-none { stroke:rgba(255,255,255,0.08); stroke-width:1.5; stroke-dasharray:3 4; vector-effect:non-scaling-stroke; }
.spk-dot { position:absolute; right:-3px; width:6px; height:6px; margin-top:-3px; border-radius:50%; background:var(--rc); box-shadow:0 0 0 2px #16181d, 0 0 8px var(--rc); }
.rtemp { display:flex; flex-direction:column; align-items:flex-end; min-width:52px; }
.rtv { font-size:21px; font-weight:700; letter-spacing:-0.02em; font-variant-numeric:tabular-nums; line-height:1.05; }
.rtv small { font-size:13px; font-weight:600; color:#9aa0aa; margin-left:1px; vertical-align:top; }
.rdl { font-size:11px; font-weight:700; margin-top:2px; font-variant-numeric:tabular-nums; white-space:nowrap; }
.rdl.ok { color:#4ade80; }
.rdl.near { color:#9aa0aa; }
.rdl.cold { color:#7dd3fc; }
.rdl.warm { color:#fb923c; }
@container rooms (max-width: 330px) { .room { grid-template-columns:36px minmax(0,1fr) auto; } .rspark { display:none; } .rname em { display:none; } }
@keyframes radar { 0% { transform:scale(1); opacity:.9; } 100% { transform:scale(1.9); opacity:0; } }
@keyframes ping-g { 0% { box-shadow:0 0 0 0 rgba(74,222,128,.6); } 100% { box-shadow:0 0 0 7px rgba(74,222,128,0); } }
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
  window.customCards.push({ type: 'linwood-climate-card', name: 'Linwood Climate Card', description: 'Dial thermostat with mode, fan, comfort/preset and a Rooms panel (temperature rail, sparklines, presence)', preview: false });
}
