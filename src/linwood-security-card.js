/* Linwood Security Card v1.0.1 — motion overview for Home Assistant
 * v1.0.1: the radar no longer spins — static rings, with room blips that still pulse while motion is live.
 * A radar status hero ("All quiet" / "Motion · Office" / "Garage open"), one tile per sensor with live motion,
 * last-seen time and event count, a swimlane timeline of every motion burst (and garage-door open spans) over the last
 * 6 h / 24 h / 3 days, and a recent-activity feed. History comes from the recorder; new states are appended live.
 *
 * type: custom:linwood-security-card
 * title: Security                       # optional
 * hours: 24                             # default range: 6, 24 or 72
 * sensors:
 *   - name: Office
 *     icon: mdi:desk
 *     color: '#38bdf8'                  # optional; matches the room's colour elsewhere
 *     motion: binary_sensor.office_sensor_motion
 *     occupancy: binary_sensor.office_sensor_occupancy   # optional
 *     battery: sensor.office_sensor_battery              # optional; warns at battery_low (default 20 %)
 *   - name: Garage
 *     motion: binary_sensor.garage_motion
 *     door: cover.garage_door           # optional; open spans join the lane, open door raises the status
 */
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
  const cls0 = (n) => (n.getAttribute && (n.getAttribute('class') || '').split(' ')[0]) || '';
  const kind = (a, b) => !!a && !!b && a.nodeType === b.nodeType && a.nodeName === b.nodeName;
  const same = (a, b) => kind(a, b) && (a.nodeType !== 1 || cls0(a) === cls0(b));
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
        from.insertBefore(document.importNode(t, true), f); continue;
      }
      if (kind(f, t)) { update(f, t); f = f.nextSibling; continue; }
      const n = document.importNode(t, true);
      from.replaceChild(n, f); f = n.nextSibling;
    }
    while (f) { const n = f.nextSibling; from.removeChild(f); f = n; }
  };
  const patch = (el, html) => {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    morphKids(el, tpl.content);
  };
  return (window.LinwoodMorph = { v: 2, patch, morphKids });
})();

const LSC_COLORS = ['#f5b83d', '#38bdf8', '#a78bfa', '#2dd4bf', '#f87171', '#f472b6', '#4ade80'];
const LSC_RANGES = [[6, '6 h'], [24, '24 h'], [72, '3 days']];
const LSC_OPEN = ['open', 'opening', 'closing'];
const lscEsc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lscAgo = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};
const lscDur = (ms) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`;
};
const lscClock = (t) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const lscDay = (t) => {
  const d = new Date(t), now = new Date();
  const k = (x) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  if (k(d) === k(now)) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (k(d) === k(y)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};
/* HA history rows, compressed (s / lc / lu, epoch seconds) or full (state / last_changed) → [{ t, s }] */
const lscRows = (rows) => {
  const out = [];
  (rows || []).forEach((e) => {
    const ts = e.lc != null ? e.lc : e.lu;
    const t = ts != null ? ts * 1000 : Date.parse(e.last_changed || e.last_updated);
    const s = e.s != null ? e.s : e.state;
    if (isFinite(t)) out.push({ t, s });
  });
  return out.sort((a, b) => a.t - b.t);
};
/* [{ t, s }] → spans [{ a, b }] where test(s) holds; the last open span runs to `now` */
const lscSpans = (rows, test, now) => {
  const out = [];
  let a = null;
  rows.forEach((r) => {
    const on = test(r.s);
    if (on && a == null) a = r.t;
    else if (!on && a != null) { out.push({ a, b: r.t }); a = null; }
  });
  if (a != null) out.push({ a, b: now, live: true });
  return out;
};

class LinwoodSecurityCard extends HTMLElement {
  setConfig(config) {
    if (!config || !Array.isArray(config.sensors) || !config.sensors.length) throw new Error('Add a "sensors" list (name + motion)');
    this._config = config;
    this._sensors = config.sensors.filter((s) => s && (s.motion || s.door))
      .map((s, i) => Object.assign({ color: LSC_COLORS[i % LSC_COLORS.length] }, s));
    const h = Number(config.hours);
    this._range = LSC_RANGES.some((r) => r[0] === h) ? h : 24;
    this._hist = null;
    this._histT = 0;
    this._ver = 0;
    this._sig = null;
    this._sel = null;
    this._more = false;
    if (!this.shadowRoot) { this.attachShadow({ mode: 'open' }); this._wire(); }
    if (this._hass) this._render(true);
  }

  set hass(hass) {
    this._hass = hass;
    this._live();
    this._render(false);
    this._history();
  }

  connectedCallback() {
    clearInterval(this._clock);
    this._clock = setInterval(() => { this._render(false); this._history(); }, 30000);
    this._history();
  }

  disconnectedCallback() { clearInterval(this._clock); this._clock = null; }

  getCardSize() { return 9; }
  getGridOptions() { return { columns: 12, rows: 'auto', min_columns: 6 }; }
  static getStubConfig(hass) {
    const m = Object.keys(hass.states).filter((k) => k.startsWith('binary_sensor.') && hass.states[k].attributes.device_class === 'motion').slice(0, 4);
    return { sensors: m.map((e) => ({ name: hass.states[e].attributes.friendly_name || e, motion: e })) };
  }

  /* ---------- data ---------- */
  _st(id) { return id && this._hass ? this._hass.states[id] : undefined; }
  _ids() {
    const ids = [];
    this._sensors.forEach((s) => { if (s.motion) ids.push(s.motion); if (s.door) ids.push(s.door); });
    return ids;
  }

  _history(force) {
    if (!this._hass || !this.isConnected || this._fetching || !this._hass.callWS) return;
    if (!force && this._histT && Date.now() - this._histT < 300000 && this._hist && this._hist.range === this._range) return;
    this._fetch();
  }

  async _fetch() {
    const ids = this._ids(), range = this._range;
    if (!ids.length) return;
    this._fetching = true;
    this._histT = Date.now();
    const t1 = Date.now(), t0 = t1 - range * 3600000;
    try {
      const r = await this._hass.callWS({
        type: 'history/history_during_period', start_time: new Date(t0).toISOString(), end_time: new Date(t1).toISOString(),
        entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false,
      });
      const rows = {};
      ids.forEach((id) => { rows[id] = lscRows(r && r[id]); });
      this._hist = { range, rows };
      this._err = null;
    } catch (e) {
      this._err = (e && e.message) || 'Couldn’t load history';
      this._histT = Date.now() - 240000;   // try again in about a minute
    }
    this._fetching = false;
    this._ver++;
    this._render(true);
    if (range !== this._range) this._history(true);
  }

  /* append state changes between fetches so bars grow and the feed updates the moment motion starts */
  _live() {
    if (!this._hist) return;
    this._ids().forEach((id) => {
      const s = this._st(id), arr = this._hist.rows[id];
      if (!s || !arr) return;
      const t = Date.parse(s.last_changed), last = arr[arr.length - 1];
      if (!isFinite(t) || (last && (last.t > t || (last.t === t && last.s === s.state)))) return;
      if (last && last.s === s.state) return;
      arr.push({ t, s: s.state });
      this._ver++;
    });
  }

  _model() {
    const now = Date.now(), t0 = now - this._range * 3600000;
    const rows = this._hist ? this._hist.rows : {};
    const lanes = this._sensors.map((s) => {
      const ms = this._st(s.motion), ds = this._st(s.door), os = this._st(s.occupancy);
      const mRows = rows[s.motion] || [], dRows = rows[s.door] || [];
      const motion = s.motion ? lscSpans(mRows, (x) => x === 'on', now) : [];
      const door = s.door ? lscSpans(dRows, (x) => LSC_OPEN.includes(x), now) : [];
      const inWin = (sp) => sp.b >= t0;
      const live = !!(ms && ms.state === 'on');
      const open = !!(ds && LSC_OPEN.includes(ds.state));
      const offline = (ms && ms.state === 'unavailable') || (s.motion && !ms);
      let last = null;
      if (live) last = now;
      else if (ms && isFinite(Date.parse(ms.last_changed)) && ms.state === 'off') last = Date.parse(ms.last_changed);
      const lastSpan = motion.length ? motion[motion.length - 1] : null;
      if (lastSpan && (!last || lastSpan.b > last)) last = lastSpan.b;
      const bat = this._st(s.battery), bv = bat ? parseFloat(bat.state) : NaN;
      return {
        s, ms, ds, os, live, open, offline, last,
        occ: !!(os && os.state === 'on'),
        motion: motion.filter(inWin), door: door.filter(inWin),
        count: motion.filter((sp) => sp.a >= t0).length,
        lowBat: isFinite(bv) && bv <= (s.battery_low || 20) ? Math.round(bv) : null,
      };
    });
    const events = [];
    lanes.forEach((l, i) => {
      l.motion.forEach((sp) => { if (sp.a >= t0) events.push({ kind: 'motion', t: sp.a, sp, l, i }); });
      l.door.forEach((sp) => { if (sp.a >= t0) events.push({ kind: 'door', t: sp.a, sp, l, i }); });
    });
    events.sort((a, b) => b.t - a.t);
    return { now, t0, lanes, events };
  }

  /* ---------- render ---------- */
  _render(force) {
    if (!this._hass || !this._config) return;
    const parts = [this._range, this._ver, this._sel, this._more, this._err, Math.floor(Date.now() / 60000)];
    this._ids().concat(this._sensors.map((s) => s.occupancy), this._sensors.map((s) => s.battery)).forEach((id) => {
      const s = this._st(id); parts.push(s ? s.state + '|' + s.last_changed : '-');
    });
    const sig = parts.join('§');
    if (!force && sig === this._sig) return;
    this._sig = sig;
    LwMorph.patch(this.shadowRoot, this._css() + this._html(this._model()));
  }

  _status(m) {
    const live = m.lanes.filter((l) => l.live), open = m.lanes.filter((l) => l.open), off = m.lanes.filter((l) => l.offline);
    if (open.length) return { tone: 'alert', icon: 'mdi:shield-alert', title: `${open.map((l) => l.s.name).join(' & ')} open`, chip: 'Door open' };
    if (live.length) {
      const names = live.map((l) => l.s.name);
      const title = names.length > 2 ? `Motion in ${names.length} rooms` : `Motion · ${names.join(' & ')}`;
      return { tone: 'live', icon: 'mdi:motion-sensor', title, chip: 'Activity' };
    }
    if (off.length) return { tone: 'warn', icon: 'mdi:shield-off-outline', title: `${off.map((l) => l.s.name).join(' & ')} offline`, chip: 'Check sensors' };
    return { tone: 'calm', icon: 'mdi:shield-check', title: 'All quiet', chip: 'Secure' };
  }

  _html(m) {
    const st = this._status(m);
    const lastEv = m.lanes.filter((l) => !l.live && l.last).sort((a, b) => b.last - a.last)[0];
    let sub;
    if (st.tone === 'live') {
      const starts = m.lanes.filter((l) => l.live).map((l) => { const sp = l.motion[l.motion.length - 1]; return sp && sp.live ? sp.a : null; }).filter(Boolean);
      sub = starts.length ? `Started ${lscAgo(m.now - Math.min(...starts))} · ${lscClock(Math.min(...starts))}` : 'Right now';
    } else if (st.tone === 'alert') {
      const op = m.lanes.find((l) => l.open), sp = op && op.door[op.door.length - 1];
      sub = sp ? `Opened ${lscAgo(m.now - sp.a)} · ${lscClock(sp.a)}` : 'Check the door';
    } else if (lastEv) sub = `Last motion · ${lscEsc(lastEv.s.name)} · ${lscAgo(m.now - lastEv.last)}`;
    else sub = this._hist ? `No motion in ${this._rangeLabel()}` : 'Loading history…';

    const total = m.lanes.reduce((n, l) => n + l.count, 0);
    const busiest = m.lanes.slice().sort((a, b) => b.count - a.count)[0];

    return `
<div class="card tone-${st.tone}">
  <div class="head">
    <span class="title">${lscEsc(this._config.title || 'Security').toUpperCase()}</span>
    <span class="status"><i class="dot"></i>${st.chip}</span>
  </div>
  <div class="hero">
    <div class="radar" aria-hidden="true">
      <i class="ring r1"></i><i class="ring r2"></i><i class="ring r3"></i>
      ${m.lanes.map((l, i) => this._blip(l, i, m)).join('')}
      <span class="core"><ha-icon icon="${st.icon}"></ha-icon></span>
    </div>
    <div class="htext">
      <div class="htitle">${lscEsc(st.title)}</div>
      <div class="hsub">${sub}</div>
      <div class="hstats">
        <span><b>${total}</b> motion event${total === 1 ? '' : 's'}</span>
        ${busiest && busiest.count ? `<span>busiest · <b style="color:${busiest.s.color}">${lscEsc(busiest.s.name)}</b></span>` : ''}
      </div>
    </div>
  </div>
  <div class="tiles">${m.lanes.map((l) => this._tile(l, m)).join('')}</div>
  ${this._timeline(m)}
  ${this._feed(m)}
</div>`;
  }

  _rangeLabel() { const r = LSC_RANGES.find((x) => x[0] === this._range); return r[0] === 24 ? '24 h' : r[1]; }

  /* rooms as blips around the radar: lit while motion is live, faint once quiet */
  _blip(l, i, m) {
    const n = m.lanes.length, ang = (-90 + (360 / n) * i) * (Math.PI / 180), rr = 34;
    const x = 50 + rr * Math.cos(ang), y = 50 + rr * Math.sin(ang);
    const fresh = l.last ? Math.max(0, 1 - (m.now - l.last) / (3600000 * 2)) : 0;   // fades over two hours
    return `<i class="blip${l.live ? ' on' : ''}${l.open ? ' open' : ''}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--bc:${l.s.color};--fresh:${(0.18 + fresh * 0.6).toFixed(2)}"></i>`;
  }

  _tile(l, m) {
    const s = l.s;
    let state, scls = '';
    if (l.offline) { state = 'Offline'; scls = 'off'; }
    else if (l.open) { state = `Door ${l.ds.state}`; scls = 'open'; }
    else if (l.live) { state = 'Motion'; scls = 'live'; }
    else if (l.occ) { state = 'Occupied'; scls = 'occ'; }
    else state = 'Clear';
    const seen = l.live ? 'now' : l.last ? lscAgo(m.now - l.last) : 'no motion';
    const doorTxt = s.door && !l.open && l.ds ? `<span class="door"><ha-icon icon="mdi:garage-variant"></ha-icon>${lscEsc(l.ds.state)}</span>` : '';
    return `<button class="tile ${scls}" data-act="info" data-val="${lscEsc(l.open ? s.door : s.motion || s.door)}" style="--tc:${s.color}">
      <span class="tic"><ha-icon icon="${s.icon || 'mdi:motion-sensor'}"></ha-icon>${l.live ? '<i class="wave"></i><i class="wave w2"></i>' : ''}</span>
      <span class="tname">${lscEsc(s.name || 'Sensor')}</span>
      <span class="tstate">${state}</span>
      <span class="tmeta"><span>${seen}</span>${l.count ? `<span class="cnt">${l.count}×</span>` : ''}</span>
      ${doorTxt || (l.lowBat != null ? `<span class="bat"><ha-icon icon="mdi:battery-alert-variant-outline"></ha-icon>${l.lowBat}%</span>` : '')}
    </button>`;
  }

  _timeline(m) {
    const span = m.now - m.t0, X = (t) => Math.min(100, Math.max(0, ((t - m.t0) / span) * 100));
    // hour grid: every hour for 6 h, every 3 h for a day, every 12 h for 3 days
    const step = this._range <= 6 ? 1 : this._range <= 24 ? 3 : 12;
    const ticks = [];
    const d = new Date(m.t0); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1);
    for (let t = d.getTime(); t < m.now; t += 3600000) {
      const h = new Date(t).getHours();
      if (h % step) continue;
      const lab = h === 0 ? (this._range > 24 ? new Date(t).toLocaleDateString(undefined, { weekday: 'short' }) : '12a')
        : `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;
      ticks.push({ x: X(t), lab, mid: h === 0, near: X(t) > 92 });
    }
    // night shading from sun.sun is not in history here, so a plain 9 pm – 6 am band reads well enough
    const nights = [];
    const n0 = new Date(m.t0); n0.setHours(21, 0, 0, 0); n0.setDate(n0.getDate() - 1);
    for (let a = n0.getTime(); a < m.now; a += 86400000) {
      const b = a + 9 * 3600000;
      if (b > m.t0) nights.push({ l: X(a), w: X(b) - X(a) });
    }
    const sel = this._sel;
    const lanes = m.lanes.map((l, i) => {
      const bars = l.motion.map((sp, k) => {
        const a = X(sp.a), b = X(sp.b), id = `m${i}-${k}`;
        return `<button class="bar${sp.live ? ' live' : ''}${sel === id ? ' sel' : ''}" data-act="sel" data-val="${id}" style="left:${a.toFixed(3)}%;width:max(3px, ${(b - a).toFixed(3)}%)" title="${lscEsc(l.s.name)} · ${lscClock(sp.a)}${sp.live ? ' – now' : ' – ' + lscClock(sp.b)}"></button>`;
      }).join('');
      const doors = l.door.map((sp, k) => {
        const a = X(sp.a), b = X(sp.b), id = `d${i}-${k}`;
        return `<button class="dbar${sel === id ? ' sel' : ''}" data-act="sel" data-val="${id}" style="left:${a.toFixed(3)}%;width:max(3px, ${(b - a).toFixed(3)}%)" title="${lscEsc(l.s.name)} door open · ${lscClock(sp.a)} – ${sp.live ? 'now' : lscClock(sp.b)}"></button>`;
      }).join('');
      return `<div class="lane" style="--tc:${l.s.color}"><span class="lname"><i style="background:${l.s.color}"></i>${lscEsc(l.s.name)}</span><div class="ltrack">${doors}${bars}</div></div>`;
    }).join('');

    let detail = '';
    if (sel) {
      const kind = sel[0], [i, k] = sel.slice(1).split('-').map(Number), l = m.lanes[i];
      const sp = l && (kind === 'm' ? l.motion[k] : l.door[k]);
      if (sp) {
        detail = `<div class="detail" style="--tc:${l.s.color}"><ha-icon icon="${kind === 'm' ? 'mdi:motion-sensor' : 'mdi:garage-open-variant'}"></ha-icon>
          <span><b>${lscEsc(l.s.name)}</b> · ${kind === 'm' ? 'motion' : 'door open'} ${lscDay(sp.a).toLowerCase() === 'today' ? '' : lscDay(sp.a) + ' '}${lscClock(sp.a)} – ${sp.live ? 'now' : lscClock(sp.b)}</span>
          <span class="dd">${lscDur(sp.b - sp.a)}</span><button class="x" data-act="sel" data-val="" aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button></div>`;
      }
    }
    const rangeBtns = LSC_RANGES.map(([h, lab]) => `<button class="rng${h === this._range ? ' on' : ''}" data-act="range" data-val="${h}">${lab}</button>`).join('');
    return `<div class="tl">
    <div class="tlhead"><span class="sec">TIMELINE</span><span class="rngs">${rangeBtns}</span></div>
    <div class="tlbody">
      <div class="grid">${nights.map((n) => `<i class="night" style="left:${n.l.toFixed(2)}%;width:${n.w.toFixed(2)}%"></i>`).join('')}${ticks.map((t) => `<i class="gl${t.mid ? ' mid' : ''}" style="left:${t.x.toFixed(2)}%"></i>`).join('')}<i class="now"></i></div>
      ${this._hist ? lanes : `<div class="loading">${this._err ? lscEsc(this._err) : 'Loading history…'}</div>`}
      <div class="axis">${ticks.filter((t) => !t.near).map((t) => `<span style="left:${t.x.toFixed(2)}%">${t.lab}</span>`).join('')}<span class="nowlab">now</span></div>
    </div>
    ${detail}
  </div>`;
  }

  _feed(m) {
    if (!this._hist) return '';
    const max = this._more ? 14 : 5, list = m.events.slice(0, max);
    if (!list.length) return `<div class="feed"><div class="sec">RECENT ACTIVITY</div><div class="empty"><ha-icon icon="mdi:sleep"></ha-icon>Nothing in ${this._rangeLabel()}</div></div>`;
    let lastDay = null;
    const items = list.map((e) => {
      const day = lscDay(e.t);
      const hdr = day !== lastDay && (lastDay !== null || day !== 'Today') ? `<div class="fday">${day}</div>` : '';
      lastDay = day;
      const dur = e.sp.live ? (e.kind === 'door' ? 'still open' : 'ongoing') : lscDur(e.sp.b - e.sp.a);
      const what = e.kind === 'door' ? `${lscEsc(e.l.s.name)} door opened` : `Motion in ${lscEsc(e.l.s.name)}`;
      return `${hdr}<div class="fi${e.sp.live ? ' live' : ''}${e.kind === 'door' ? ' isdoor' : ''}" style="--tc:${e.l.s.color}">
        <i class="fdot"></i><span class="fwhat">${what}</span><span class="fdur">${dur}</span><span class="ft">${lscClock(e.t)}</span></div>`;
    }).join('');
    const moreBtn = m.events.length > 5 ? `<button class="more" data-act="more">${this._more ? 'Show less' : `Show ${Math.min(14, m.events.length) - 5} more`}</button>` : '';
    return `<div class="feed"><div class="sec">RECENT ACTIVITY</div><div class="flist">${items}</div>${moreBtn}</div>`;
  }

  /* ---------- interaction ---------- */
  _wire() {
    this.shadowRoot.addEventListener('click', (ev) => {
      const el = ev.composedPath().find((x) => x.dataset && x.dataset.act);
      if (!el) return;
      const v = el.dataset.val;
      switch (el.dataset.act) {
        case 'info': if (v) this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: v }, bubbles: true, composed: true })); break;
        case 'range': this._range = Number(v); this._sel = null; this._render(true); this._history(true); break;
        case 'sel': this._sel = v && v !== this._sel ? v : null; this._render(true); break;
        case 'more': this._more = !this._more; this._render(true); break;
        default: break;
      }
    });
  }

  /* ---------- styles ---------- */
  _css() {
    return `<style>
:host { display:block; }
* { box-sizing:border-box; }
button { font:inherit; color:inherit; background:none; border:none; padding:0; cursor:pointer; -webkit-tap-highlight-color:transparent; text-align:inherit; }
ha-icon { --mdc-icon-size:18px; display:inline-flex; }
.card { --accent:#4ade80; position:relative; overflow:hidden; container-type:inline-size; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.07); border-radius:28px; padding:22px; color:#f3f4f6; font-family:var(--ha-font-family-body, Roboto, sans-serif); transition:border-color .4s; }
.card.tone-live { --accent:#f5b83d; border-color:rgba(245,184,61,0.28); }
.card.tone-alert { --accent:#f87171; border-color:rgba(248,113,113,0.35); }
.card.tone-warn { --accent:#fbbf24; }
.card::before { content:''; position:absolute; top:-140px; left:-120px; width:360px; height:360px; border-radius:50%; background:radial-gradient(closest-side, color-mix(in srgb, var(--accent) 16%, transparent), transparent); pointer-events:none; transition:background .6s; }
.head { position:relative; display:flex; align-items:center; gap:12px; }
.title { font-size:13px; letter-spacing:.14em; font-weight:600; color:#8b919c; flex:1; }
.status { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:600; color:var(--accent); }
.dot { width:8px; height:8px; border-radius:50%; background:currentColor; box-shadow:0 0 10px currentColor; }
.tone-live .dot, .tone-alert .dot { animation:ping 1.6s ease-out infinite; }
/* hero */
.hero { position:relative; display:flex; align-items:center; gap:18px; margin-top:16px; }
.radar { position:relative; flex:none; width:96px; height:96px; border-radius:50%; background:radial-gradient(circle, color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%); }
.ring { position:absolute; border-radius:50%; border:1px solid color-mix(in srgb, var(--accent) 22%, transparent); }
.r1 { inset:0; } .r2 { inset:16%; } .r3 { inset:32%; border-color:color-mix(in srgb, var(--accent) 30%, transparent); }
.core { position:absolute; left:50%; top:50%; width:34px; height:34px; margin:-17px 0 0 -17px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:color-mix(in srgb, var(--accent) 22%, #15171c); color:var(--accent); box-shadow:0 0 18px color-mix(in srgb, var(--accent) 35%, transparent); }
.core ha-icon { --mdc-icon-size:19px; }
.blip { position:absolute; width:8px; height:8px; margin:-4px 0 0 -4px; border-radius:50%; background:var(--bc); opacity:var(--fresh); }
.blip.on, .blip.open { opacity:1; box-shadow:0 0 0 0 var(--bc); animation:blip 1.4s ease-out infinite; }
.htext { min-width:0; }
.htitle { font-size:clamp(20px, 6cqw, 26px); font-weight:700; letter-spacing:-0.02em; line-height:1.15; }
.tone-live .htitle, .tone-alert .htitle { color:var(--accent); }
.hsub { font-size:13.5px; color:#9aa0aa; margin-top:5px; }
.hstats { display:flex; flex-wrap:wrap; gap:4px 14px; margin-top:8px; font-size:12px; color:#6b7280; }
.hstats b { color:#d1d5db; font-weight:700; }
/* tiles */
.tiles { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }
.tile { position:relative; flex:1 1 112px; min-width:0; display:grid; grid-template-columns:minmax(0,1fr); gap:2px; padding:12px; min-height:112px; border-radius:20px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); transition:background .2s, border-color .3s, transform .1s; overflow:hidden; }
.tile:hover { background:rgba(255,255,255,0.07); }
.tile:active { transform:scale(.98); }
.tile.live { background:linear-gradient(150deg, color-mix(in srgb, var(--tc) 24%, transparent), rgba(255,255,255,0.03)); border-color:color-mix(in srgb, var(--tc) 55%, transparent); }
.tile.occ { border-color:color-mix(in srgb, var(--tc) 22%, transparent); }
.tile.open { background:linear-gradient(150deg, rgba(248,113,113,0.22), rgba(255,255,255,0.03)); border-color:rgba(248,113,113,0.55); }
.tile.off { opacity:.6; }
.tic { position:relative; width:36px; height:36px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:var(--tc); background:color-mix(in srgb, var(--tc) 15%, transparent); margin-bottom:8px; }
.tile.live .tic { background:var(--tc); color:#111318; }
.tic ha-icon { --mdc-icon-size:19px; position:relative; z-index:1; }
.wave { position:absolute; inset:0; border-radius:12px; border:2px solid var(--tc); animation:wave 1.8s ease-out infinite; }
.wave.w2 { animation-delay:.9s; }
.tname { font-size:14.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tstate { font-size:12.5px; font-weight:600; color:#9aa0aa; }
.tile.live .tstate { color:var(--tc); }
.tile.occ .tstate { color:color-mix(in srgb, var(--tc) 75%, white); }
.tile.open .tstate { color:#fca5a5; text-transform:capitalize; }
.tile.off .tstate { color:#f87171; }
.tmeta { display:flex; align-items:center; justify-content:space-between; gap:6px; margin-top:auto; padding-top:6px; font-size:11.5px; color:#6b7280; white-space:nowrap; }
.cnt { font-weight:700; color:#9aa0aa; font-variant-numeric:tabular-nums; }
.door, .bat { position:absolute; top:12px; right:12px; display:flex; align-items:center; gap:3px; font-size:11px; font-weight:600; color:#9aa0aa; text-transform:capitalize; }
.door ha-icon, .bat ha-icon { --mdc-icon-size:14px; }
.bat { color:#fbbf24; }
/* timeline */
.sec { font-size:11px; letter-spacing:.14em; font-weight:700; color:#8b919c; }
.tl { margin-top:20px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.07); }
.tlhead { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.rngs { display:flex; gap:2px; padding:3px; border-radius:11px; background:rgba(255,255,255,0.05); }
.rng { padding:5px 10px; border-radius:8px; font-size:12px; font-weight:600; color:#8b919c; white-space:nowrap; }
.rng.on { background:rgba(255,255,255,0.1); color:#f3f4f6; }
.tlbody { position:relative; margin-top:12px; padding-left:82px; }
.grid { position:absolute; left:82px; right:0; top:0; bottom:20px; pointer-events:none; }
.night { position:absolute; top:0; bottom:0; background:rgba(99,102,241,0.06); border-radius:6px; }
.gl { position:absolute; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.05); }
.gl.mid { background:rgba(255,255,255,0.12); }
.now { position:absolute; right:0; top:-4px; bottom:0; width:2px; border-radius:1px; background:var(--accent); box-shadow:0 0 8px var(--accent); }
.lane { position:relative; display:flex; align-items:center; height:26px; }
.lname { position:absolute; left:-82px; width:76px; display:flex; align-items:center; gap:7px; font-size:12px; font-weight:600; color:#9aa0aa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.lname i { flex:none; width:7px; height:7px; border-radius:50%; }
.ltrack { position:relative; flex:1; height:12px; border-radius:6px; background:rgba(255,255,255,0.035); }
.bar { position:absolute; top:0; bottom:0; border-radius:4px; background:var(--tc); opacity:.85; box-shadow:0 0 6px color-mix(in srgb, var(--tc) 40%, transparent); transition:opacity .15s, transform .15s; }
.bar:hover, .bar.sel { opacity:1; transform:scaleY(1.35); z-index:2; }
.bar.sel { outline:2px solid #f3f4f6; outline-offset:1px; }
.bar.live { animation:barpulse 1.6s ease-in-out infinite; }
.dbar { position:absolute; top:-2px; bottom:-2px; border-radius:4px; background:repeating-linear-gradient(135deg, rgba(248,113,113,0.55) 0 4px, rgba(248,113,113,0.25) 4px 8px); border:1px solid rgba(248,113,113,0.7); }
.dbar.sel { outline:2px solid #f3f4f6; outline-offset:1px; }
.axis { position:relative; height:20px; margin-top:4px; font-size:10.5px; font-weight:600; color:#6b7280; font-variant-numeric:tabular-nums; }
.axis span { position:absolute; top:4px; transform:translateX(-50%); white-space:nowrap; }
.axis .nowlab { right:0; left:auto; transform:none; color:var(--accent); }
.loading { padding:18px 0; font-size:13px; color:#6b7280; }
.detail { display:flex; align-items:center; gap:10px; margin-top:10px; padding:10px 12px; border-radius:14px; background:color-mix(in srgb, var(--tc) 12%, rgba(255,255,255,0.03)); border:1px solid color-mix(in srgb, var(--tc) 35%, transparent); font-size:13px; color:#d1d5db; }
.detail ha-icon { color:var(--tc); }
.detail span:first-of-type { flex:1; min-width:0; }
.detail .dd { color:#9aa0aa; font-variant-numeric:tabular-nums; white-space:nowrap; }
.x { width:26px; height:26px; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#9aa0aa; }
.x ha-icon { --mdc-icon-size:16px; color:#9aa0aa; }
/* feed */
.feed { margin-top:18px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.07); }
.flist { margin-top:8px; position:relative; }
.flist::before { content:''; position:absolute; left:4px; top:8px; bottom:8px; width:1px; background:rgba(255,255,255,0.08); }
.fday { font-size:11px; font-weight:700; color:#6b7280; letter-spacing:.08em; text-transform:uppercase; margin:10px 0 2px 18px; }
.fi { position:relative; display:grid; grid-template-columns:10px minmax(0,1fr) auto auto; align-items:center; column-gap:10px; padding:7px 0; font-size:13.5px; }
.fdot { width:9px; height:9px; border-radius:50%; background:var(--tc); box-shadow:0 0 0 3px #15171c; z-index:1; }
.fi.live .fdot { animation:ping 1.6s ease-out infinite; color:var(--tc); }
.fi.isdoor .fdot { border-radius:2px; background:#f87171; }
.fi.isdoor.live .fdur { color:#f87171; }
.fwhat { font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fdur { font-size:12px; color:#6b7280; white-space:nowrap; }
.fi.live .fdur { color:var(--tc); font-weight:600; }
.ft { font-size:12.5px; color:#9aa0aa; font-variant-numeric:tabular-nums; min-width:62px; text-align:right; white-space:nowrap; }
.more { margin-top:6px; margin-left:18px; padding:6px 12px; border-radius:10px; font-size:12.5px; font-weight:600; color:#9aa0aa; background:rgba(255,255,255,0.045); }
.more:hover { background:rgba(255,255,255,0.08); }
.empty { display:flex; align-items:center; gap:8px; margin-top:10px; font-size:13px; color:#6b7280; }
@container (max-width: 380px) {
  .hero { gap:14px; } .radar { width:78px; height:78px; }
  .tile { flex-basis:40%; }
  .tlbody { padding-left:76px; } .grid { left:76px; } .lname { left:-76px; width:72px; font-size:11px; gap:6px; }
  .fdur { display:none; }
}
@keyframes ping { 0% { box-shadow:0 0 0 0 color-mix(in srgb, currentColor 60%, transparent); } 100% { box-shadow:0 0 0 8px transparent; } }
@keyframes blip { 0% { box-shadow:0 0 0 0 color-mix(in srgb, var(--bc) 70%, transparent); } 100% { box-shadow:0 0 0 9px transparent; } }
@keyframes wave { 0% { transform:scale(1); opacity:.8; } 100% { transform:scale(1.7); opacity:0; } }
@keyframes barpulse { 0%,100% { opacity:.65; } 50% { opacity:1; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation:none !important; } }
</style>`;
  }
}

if (!customElements.get('linwood-security-card')) customElements.define('linwood-security-card', LinwoodSecurityCard);
window.customCards = window.customCards || [];
if (!window.customCards.find((c) => c.type === 'linwood-security-card')) {
  window.customCards.push({ type: 'linwood-security-card', name: 'Linwood Security Card', description: 'Motion radar, room tiles, swimlane timeline and activity feed', preview: false });
}
