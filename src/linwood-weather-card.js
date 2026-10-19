/* Linwood Weather Card v1.0.0 — current conditions, hourly and weekly forecast for Home Assistant
 * A live sky scene that matches the conditions (sun, moon and stars, clouds, rain, snow, lightning), the temperature
 * with today's high and low and a one-line outlook, wind / humidity / UV / pressure, an hourly strip whose temperatures
 * ride a colour-coded curve (sunset, sunrise and midnight marked in place), and the week as range bars on one scale.
 * Forecasts come from weather/subscribe_forecast, so they update the moment the integration refreshes.
 *
 * type: custom:linwood-weather-card
 * entity: weather.forecast_home
 * title: Weather            # optional
 * hours: 24                 # optional; hourly columns to show (default 24)
 * days: 7                   # optional; days to show (default 7, or as many as the forecast has)
 * sun: sun.sun              # optional; sunrise / sunset (default sun.sun)
 */
const LwwMorph = (() => {
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

/* condition → label, day / night icon, icon colour, card accent, sky scene */
const LWW_COND = {
  'sunny': { label: 'Sunny', icon: 'mdi:weather-sunny', night: 'mdi:weather-night', c: '#f5b83d', nc: '#c4b5fd', sky: 'sun' },
  'clear-night': { label: 'Clear', icon: 'mdi:weather-night', c: '#c4b5fd', sky: 'moon' },
  'partlycloudy': { label: 'Partly cloudy', icon: 'mdi:weather-partly-cloudy', night: 'mdi:weather-night-partly-cloudy', c: '#fcd34d', nc: '#a5b4fc', sky: 'partly' },
  'cloudy': { label: 'Cloudy', icon: 'mdi:weather-cloudy', c: '#94a3b8', sky: 'cloud' },
  'fog': { label: 'Fog', icon: 'mdi:weather-fog', c: '#9ca3af', sky: 'fog' },
  'rainy': { label: 'Rain', icon: 'mdi:weather-rainy', c: '#38bdf8', sky: 'rain' },
  'pouring': { label: 'Heavy rain', icon: 'mdi:weather-pouring', c: '#0ea5e9', sky: 'pour' },
  'snowy': { label: 'Snow', icon: 'mdi:weather-snowy', c: '#e0f2fe', sky: 'snow' },
  'snowy-rainy': { label: 'Sleet', icon: 'mdi:weather-snowy-rainy', c: '#7dd3fc', sky: 'sleet' },
  'hail': { label: 'Hail', icon: 'mdi:weather-hail', c: '#bae6fd', sky: 'snow' },
  'lightning': { label: 'Lightning', icon: 'mdi:weather-lightning', c: '#facc15', sky: 'storm' },
  'lightning-rainy': { label: 'Thunderstorms', icon: 'mdi:weather-lightning-rainy', c: '#facc15', sky: 'storm' },
  'windy': { label: 'Windy', icon: 'mdi:weather-windy', c: '#a7f3d0', sky: 'wind' },
  'windy-variant': { label: 'Windy', icon: 'mdi:weather-windy-variant', c: '#a7f3d0', sky: 'wind' },
  'exceptional': { label: 'Weather alert', icon: 'mdi:alert-circle-outline', c: '#f87171', sky: 'cloud' },
};
const LWW_WET = ['rainy', 'pouring', 'snowy', 'snowy-rainy', 'hail', 'lightning-rainy'];
const LWW_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/* one cold → hot scale (°F) for the hourly curve and the weekly bars, so a colour means the same temperature everywhere */
const LWW_SCALE = [[20, [165, 180, 252]], [40, [56, 189, 248]], [55, [74, 222, 128]], [68, [245, 184, 61]], [80, [251, 146, 60]], [92, [248, 113, 113]]];
const lwwEsc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lwwClock = (t) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const lwwHour = (t) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric' }).replace(/\s/g, ' ');
const lwwDayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const lwwCol = (f) => {
  if (f == null || !isFinite(f)) return '#9aa0aa';
  const s = LWW_SCALE;
  if (f <= s[0][0]) return `rgb(${s[0][1].join(',')})`;
  for (let i = 1; i < s.length; i++) {
    if (f <= s[i][0]) {
      const k = (f - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
      const c = s[i - 1][1].map((v, j) => Math.round(v + (s[i][1][j] - v) * k));
      return `rgb(${c.join(',')})`;
    }
  }
  return `rgb(${s[s.length - 1][1].join(',')})`;
};
/* smooth path through points (Catmull–Rom → cubic Bézier) */
const lwwPath = (p) => {
  if (!p.length) return '';
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
};
const LWW_CW = 58;   // hourly column width (px)

class LinwoodWeatherCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity) throw new Error('Set "entity" to a weather entity');
    const changed = !this._config || this._config.entity !== config.entity;
    this._config = config;
    this._hours = Math.max(6, Math.min(48, Number(config.hours) || 24));
    this._days = Math.max(3, Math.min(10, Number(config.days) || 7));
    if (changed) { this._fc = { hourly: null, daily: null }; this._unsub(); }
    this._sig = null;
    if (!this.shadowRoot) { this.attachShadow({ mode: 'open' }); this._wire(); }
    if (this._hass) { this._subscribe(); this._render(true); }
  }

  set hass(hass) {
    this._hass = hass;
    this._subscribe();
    this._render(false);
  }

  connectedCallback() {
    clearInterval(this._clock);
    this._clock = setInterval(() => this._render(false), 60000);
    if (this._hass) this._subscribe();
  }

  disconnectedCallback() { clearInterval(this._clock); this._clock = null; this._unsub(); }

  getCardSize() { return 8; }
  getGridOptions() { return { columns: 12, rows: 'auto', min_columns: 6 }; }
  static getStubConfig(hass) {
    const e = Object.keys(hass.states).find((k) => k.startsWith('weather.'));
    return { entity: e || 'weather.home' };
  }

  /* ---------- data ---------- */
  _st(id) { return id && this._hass ? this._hass.states[id] : undefined; }

  /* weather/subscribe_forecast pushes the forecast now and again on every refresh; one subscription per type */
  _subscribe() {
    const h = this._hass;
    if (!h || !this.isConnected || !h.connection || !this._config || this._subs) return;
    const st = this._st(this._config.entity);
    if (!st) return;
    const feat = st.attributes.supported_features || 0;   // 1 = daily, 2 = hourly, 4 = twice daily
    const types = [];
    if (feat & 2) types.push('hourly');
    if (feat & 1) types.push('daily'); else if (feat & 4) types.push('twice_daily');
    this._subs = types.map((type) => h.connection.subscribeMessage((ev) => {
      const key = type === 'hourly' ? 'hourly' : 'daily';
      this._fc[key] = Array.isArray(ev && ev.forecast) ? ev.forecast : [];
      this._render(true);
    }, { type: 'weather/subscribe_forecast', forecast_type: type, entity_id: this._config.entity }).catch((e) => {
      this._err = (e && e.message) || 'Forecast unavailable';
      this._render(true);
      return null;
    }));
  }

  _unsub() {
    const subs = this._subs;
    this._subs = null;
    if (subs) subs.forEach((p) => Promise.resolve(p).then((u) => { if (typeof u === 'function') u(); }).catch(() => {}));
  }

  /* temperatures for the colour scale are always °F */
  _toF(v) {
    const st = this._st(this._config.entity), u = st && st.attributes.temperature_unit;
    return v == null ? null : u === '°C' ? v * 9 / 5 + 32 : v;
  }

  _sunTimes() {
    const s = this._st(this._config.sun || 'sun.sun');
    if (!s) return null;
    const set = Date.parse(s.attributes.next_setting), rise = Date.parse(s.attributes.next_rising);
    return { up: s.state === 'above_horizon', set: isFinite(set) ? set : null, rise: isFinite(rise) ? rise : null };
  }

  /* is time t at night? Uses today's sunset and sunrise as times of day, which is close enough for icons */
  _isNight(t, sun) {
    if (!sun || sun.set == null || sun.rise == null) { const h = new Date(t).getHours(); return h < 7 || h >= 19; }
    const mins = (x) => { const d = new Date(x); return d.getHours() * 60 + d.getMinutes(); };
    const m = mins(t), sm = mins(sun.set), rm = mins(sun.rise);
    return sm > rm ? (m >= sm || m < rm) : (m >= sm && m < rm);
  }

  _icon(cond, night) {
    const c = LWW_COND[cond] || LWW_COND.cloudy;
    if (night && c.night) return { icon: c.night, color: c.nc || c.c };
    return { icon: c.icon, color: c.c };
  }

  /* ---------- render ---------- */
  _render(force) {
    if (!this._hass || !this._config || !this.shadowRoot) return;
    const st = this._st(this._config.entity), sun = this._st(this._config.sun || 'sun.sun');
    const sig = [st ? st.state + JSON.stringify(st.attributes) : '-', sun ? sun.state + sun.attributes.next_setting + sun.attributes.next_rising : '-',
      this._err, Math.floor(Date.now() / 60000)].join('§');
    if (!force && sig === this._sig) return;
    this._sig = sig;
    LwwMorph.patch(this.shadowRoot, this._css() + this._html(st));
  }

  _html(st) {
    if (!st) return `<div class="card"><div class="head"><span class="title">${lwwEsc((this._config.title || 'Weather').toUpperCase())}</span></div><div class="empty">${lwwEsc(this._config.entity)} isn’t available</div></div>`;
    const a = st.attributes, cond = st.state, sun = this._sunTimes(), now = Date.now();
    const night = sun ? !sun.up : this._isNight(now, null);
    const c = LWW_COND[cond] || LWW_COND.cloudy;
    const accent = night && c.nc ? c.nc : c.c;
    const tu = (a.temperature_unit || '°').replace('°F', '°').replace('°C', '°');
    const t = a.temperature != null ? Math.round(a.temperature) : null;

    const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
    const daily = (this._fc.daily || []).filter((d) => Date.parse(d.datetime) >= d0.getTime());
    const today = daily.find((d) => lwwDayKey(d.datetime) === lwwDayKey(now));
    const hourly = (this._fc.hourly || []).filter((h) => Date.parse(h.datetime) > now).slice(0, this._hours - 1);

    // header chip: the next sun event
    let chip = '';
    if (sun && (sun.set || sun.rise)) {
      const nextSet = sun.up && sun.set;
      chip = `<span class="sunchip"><ha-icon icon="${nextSet ? 'mdi:weather-sunset-down' : 'mdi:weather-sunset-up'}"></ha-icon>${nextSet ? 'Sunset' : 'Sunrise'} ${lwwClock(nextSet ? sun.set : sun.rise)}</span>`;
    }
    const hi = today && today.temperature != null ? Math.round(today.temperature) : null;
    const lo = today && today.templow != null ? Math.round(today.templow) : null;
    const range = hi != null || lo != null ? `<span class="hl">${hi != null ? `<span>High <b>${hi}°</b></span>` : ''}${lo != null ? `<span>Low <b>${lo}°</b></span>` : ''}</span>` : '';

    return `
<div class="card" style="--accent:${accent}">
  <div class="head">
    <span class="title">${lwwEsc((this._config.title || 'Weather').toUpperCase())}</span>
    ${chip}
  </div>
  <button class="hero" data-act="info" aria-label="${lwwEsc(c.label)}, ${t != null ? t + tu : ''} — open weather details">
    ${this._sky(c.sky, night, cond)}
    <span class="now">
      <span class="temp">${t != null ? t : '--'}<span class="deg">°</span></span>
      <span class="cond">${lwwEsc(c.label)}</span>
      ${range}
    </span>
  </button>
  <div class="outlook">${lwwEsc(this._outlook(cond, hourly, daily, sun))}</div>
  ${this._stats(a)}
  ${this._hourly(hourly, sun, now, st)}
  ${this._week(daily, now, a.temperature)}
  ${this._err && !hourly.length && !daily.length ? `<div class="empty">${lwwEsc(this._err)}</div>` : ''}
</div>`;
  }

  /* one plain sentence about what's coming */
  _outlook(cond, hourly, daily, sun) {
    if (!hourly.length) return daily.length ? '' : 'Loading forecast…';
    const wetNow = LWW_WET.includes(cond);
    const next12 = hourly.slice(0, 12);
    const isWet = (h) => LWW_WET.includes(h.condition) || (h.precipitation_probability != null ? h.precipitation_probability >= 50 : (h.precipitation || 0) >= 0.01);
    const kind = (h) => (/snow|hail/.test(h.condition) ? 'Snow' : 'Rain');
    if (wetNow) {
      const dry = next12.find((h) => !isWet(h));
      return dry ? `${kind({ condition: cond })} easing around ${lwwHour(dry.datetime)}` : `${kind({ condition: cond })} continuing for the next 12 hours`;
    }
    const wet = next12.find(isWet);
    if (wet) return `${kind(wet)} likely around ${lwwHour(wet.datetime)}`;
    const temps = next12.map((h) => h.temperature).filter((v) => v != null);
    const lowIn = temps.length ? Math.round(Math.min(...temps)) : null;
    const tom = daily[1];
    if (sun && sun.up) return lowIn != null ? `Dry for the next 12 hours, dropping to ${lowIn}° tonight` : 'Dry for the next 12 hours';
    return tom && tom.temperature != null ? `Dry overnight, ${Math.round(tom.temperature)}° tomorrow` : 'Dry for the next 12 hours';
  }

  /* the hero sky: a small scene that matches the conditions */
  _sky(kind, night, cond) {
    const cloud = 'M30,72 H70 A14,14 0 0 0 70,44 A20,20 0 0 0 33,40 A16,16 0 0 0 30,72 Z';
    const sunG = (cx, cy, r, rays) => `<g class="sun">${rays ? `<g class="rays" style="transform-origin:${cx}px ${cy}px">${[0, 45, 90, 135, 180, 225, 270, 315].map((d) => `<line x1="${cx}" y1="${cy - r - 7}" x2="${cx}" y2="${cy - r - 13}" transform="rotate(${d} ${cx} ${cy})"/>`).join('')}</g>` : ''}<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#lwwSun)"/></g>`;
    const moonG = (cx, cy, r, stars) => `<g class="moon">${stars ? `<circle class="star s1" cx="22" cy="26" r="1.4"/><circle class="star s2" cx="78" cy="20" r="1.1"/><circle class="star s3" cx="80" cy="64" r="1.3"/><circle class="star s4" cx="26" cy="72" r="1"/>` : ''}<path d="M${cx + r * 0.2},${cy - r} A${r},${r} 0 1 0 ${cx + r},${cy + r * 0.2} A${r * 0.78},${r * 0.78} 0 1 1 ${cx + r * 0.2},${cy - r} Z" fill="#e9e5ff"/></g>`;
    const cl = (dx, dy, s, cls) => `<path class="cl ${cls || ''}" d="${cloud}" transform="translate(${dx} ${dy}) scale(${s})" style="transform-box:fill-box"/>`;
    const drops = (n, snow) => Array.from({ length: n }, (_, i) => {
      const x = 34 + i * (34 / Math.max(1, n - 1)), d = (i % 3) * 0.35;
      return snow ? `<circle class="flake" cx="${x.toFixed(1)}" cy="66" r="2" style="animation-delay:${d}s"/>` : `<line class="drop" x1="${x.toFixed(1)}" y1="64" x2="${(x - 3).toFixed(1)}" y2="72" style="animation-delay:${d}s"/>`;
    }).join('');
    let body;
    switch (kind) {
      case 'sun': body = night ? moonG(50, 50, 20, true) : sunG(50, 50, 18, true); break;
      case 'moon': body = moonG(50, 50, 20, true); break;
      case 'partly': body = (night ? moonG(38, 38, 15, true) : sunG(38, 38, 13, true)) + cl(6, 6, 1, 'front'); break;
      case 'cloud': body = cl(-12, -12, 0.85, 'back') + cl(4, 2, 1, 'front'); break;
      case 'fog': body = cl(0, -10, 1, 'back') + '<g class="fogl"><line x1="24" y1="72" x2="76" y2="72"/><line x1="32" y1="80" x2="70" y2="80"/></g>'; break;
      case 'rain': case 'pour': body = cl(0, -12, 1, 'front') + `<g class="rain">${drops(kind === 'pour' ? 6 : 4, false)}</g>`; break;
      case 'snow': body = cl(0, -12, 1, 'front') + `<g class="snow">${drops(4, true)}</g>`; break;
      case 'sleet': body = cl(0, -12, 1, 'front') + `<g class="rain">${drops(3, false)}</g><g class="snow">${drops(2, true)}</g>`; break;
      case 'storm': body = cl(0, -12, 1, 'front dark') + '<path class="bolt" d="M52,58 L43,72 H50 L46,84 L59,67 H52 L56,58 Z"/>' + (cond === 'lightning-rainy' ? `<g class="rain">${drops(3, false)}</g>` : ''); break;
      case 'wind': body = '<g class="wind"><path d="M18,40 H60 A8,8 0 1 0 52,32"/><path d="M14,52 H74 A9,9 0 1 1 65,61"/><path d="M24,64 H50"/></g>'; break;
      default: body = cl(4, 2, 1, 'front');
    }
    return `<span class="sky sky-${kind}${night ? ' night' : ''}" aria-hidden="true"><svg viewBox="0 0 100 100">
      <defs><radialGradient id="lwwSun" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff3c4"/><stop offset=".55" stop-color="#f5b83d"/><stop offset="1" stop-color="#f59e0b"/></radialGradient></defs>
      ${body}</svg></span>`;
  }

  _stats(a) {
    const out = [];
    if (a.wind_speed != null) {
      const b = a.wind_bearing, dir = b != null ? LWW_DIRS[Math.round(((b % 360) + 360) % 360 / 45) % 8] : '';
      const gust = a.wind_gust_speed != null ? `Gusts ${Math.round(a.wind_gust_speed)}` : (dir ? `From the ${dir}` : '');
      out.push(`<div class="stat"><span class="sk"><ha-icon icon="mdi:navigation" style="transform:rotate(${b != null ? (b + 180) % 360 : 0}deg)"></ha-icon>Wind</span><span class="sv">${Math.round(a.wind_speed)}<small>${lwwEsc(a.wind_speed_unit || '')}</small></span><span class="ss">${lwwEsc(gust)}</span></div>`);
    }
    if (a.humidity != null) {
      const dp = a.dew_point != null ? `Dew point ${Math.round(a.dew_point)}°` : '';
      out.push(`<div class="stat"><span class="sk"><ha-icon icon="mdi:water-percent"></ha-icon>Humidity</span><span class="sv">${Math.round(a.humidity)}<small>%</small></span><span class="ss">${dp}</span></div>`);
    }
    if (a.uv_index != null) {
      const u = a.uv_index, lv = u < 3 ? ['Low', '#4ade80'] : u < 6 ? ['Moderate', '#facc15'] : u < 8 ? ['High', '#fb923c'] : u < 11 ? ['Very high', '#f87171'] : ['Extreme', '#c084fc'];
      out.push(`<div class="stat"><span class="sk"><ha-icon icon="mdi:sun-wireless-outline"></ha-icon>UV index</span><span class="sv">${Math.round(u)}</span><span class="ss" style="color:${lv[1]}">${lv[0]}</span></div>`);
    }
    if (a.pressure != null) {
      const p = a.pressure, dec = p < 100 ? 2 : 0;
      out.push(`<div class="stat"><span class="sk"><ha-icon icon="mdi:gauge"></ha-icon>Pressure</span><span class="sv">${p.toFixed(dec)}<small>${lwwEsc(a.pressure_unit || '')}</small></span><span class="ss">${a.cloud_coverage != null ? `Cloud cover ${Math.round(a.cloud_coverage)}%` : ''}</span></div>`);
    }
    return out.length ? `<div class="stats">${out.join('')}</div>` : '';
  }

  /* hourly strip: columns plus a temperature curve with the labels riding on it */
  _hourly(fc, sun, now, st) {
    // a "Now" column from the current conditions, then the forecast hours
    const hours = fc.length && st.attributes.temperature != null
      ? [{ datetime: new Date(now).toISOString(), temperature: st.attributes.temperature, condition: st.state }].concat(fc) : fc;
    if (!hours.length) return `<div class="sec"><div class="sh"><span class="sect">HOURLY</span></div>${this._fc.hourly ? '<div class="empty">No hourly forecast from this integration</div>' : '<div class="skel"></div>'}</div>`;
    // columns: forecast hours, with sunrise / sunset slotted in where they fall
    const cols = hours.map((h, i) => ({ kind: 'h', t: Date.parse(h.datetime), h, first: i === 0 }));
    if (sun) {
      [['set', sun.set], ['rise', sun.rise]].forEach(([k, t]) => {
        if (t == null || t < now || t > cols[cols.length - 1].t) return;
        const i = cols.findIndex((c) => c.t > t);
        if (i > 0) cols.splice(i, 0, { kind: k, t });
      });
    }
    // temperatures for each column; sun events take the value between their neighbours
    cols.forEach((c, i) => {
      if (c.kind === 'h') { c.v = c.h.temperature; return; }
      const p = cols[i - 1], n = cols[i + 1];
      c.v = p && n && p.h && n.h ? p.h.temperature + (n.h.temperature - p.h.temperature) * ((c.t - p.t) / (n.t - p.t)) : (p && p.v);
    });
    const vals = cols.map((c) => c.v).filter((v) => v != null);
    const mn = Math.min(...vals), mx = Math.max(...vals), span = Math.max(4, mx - mn);
    const H = 70, top = 24, bot = 10;
    const y = (v) => top + (1 - (v - mn) / span) * (H - top - bot);
    const pts = cols.map((c, i) => [i * LWW_CW + LWW_CW / 2, y(c.v != null ? c.v : mn)]);
    const W = cols.length * LWW_CW;
    const anyPrecip = hours.some((h) => (h.precipitation_probability || 0) >= 20 || (h.precipitation || 0) >= 0.01);
    const unitIn = (this._st(this._config.entity).attributes.precipitation_unit || '').trim();

    const stops = cols.map((c, i) => `<stop offset="${(pts[i][0] / W).toFixed(4)}" stop-color="${lwwCol(this._toF(c.v))}"/>`).join('');
    const line = lwwPath(pts);
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;

    let lastDay = lwwDayKey(now);
    const colHtml = cols.map((c, i) => {
      if (c.kind !== 'h') {
        return `<div class="hc ev"><span class="ht">${lwwClock(c.t).replace(/\s/g, ' ')}</span><ha-icon icon="${c.kind === 'set' ? 'mdi:weather-sunset-down' : 'mdi:weather-sunset-up'}" style="color:#fb923c"></ha-icon><span class="hp">${c.kind === 'set' ? 'Sunset' : 'Sunrise'}</span></div>`;
      }
      const dk = lwwDayKey(c.t), newDay = dk !== lastDay;
      lastDay = dk;
      const ic = this._icon(c.h.condition, this._isNight(c.t, sun));
      const pp = c.h.precipitation_probability, pa = c.h.precipitation;
      const ptxt = pp != null && pp >= 20 ? `${Math.round(pp)}%` : pa != null && pa >= 0.01 ? `${pa < 0.1 ? pa.toFixed(2) : pa.toFixed(1)}${unitIn === 'in' ? '″' : ''}` : '';
      const lab = c.first ? 'Now' : newDay ? new Date(c.t).toLocaleDateString(undefined, { weekday: 'short' }) : lwwHour(c.t);
      return `<div class="hc${c.first ? ' cur' : ''}${newDay ? ' nd' : ''}"><span class="ht">${lab}</span><ha-icon icon="${ic.icon}" style="color:${ic.color}"></ha-icon>${anyPrecip ? `<span class="hp">${ptxt}</span>` : ''}</div>`;
    }).join('');
    const labels = cols.map((c, i) => (c.kind === 'h' && c.v != null
      ? `<span class="tl${i === 0 ? ' cur' : ''}" style="left:${pts[i][0].toFixed(1)}px;top:${(pts[i][1] - 20).toFixed(1)}px">${Math.round(c.v)}°</span>` : '')).join('');
    const dots = cols.map((c, i) => (c.kind === 'h' ? `<circle cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="${i === 0 ? 4 : 2.2}" class="${i === 0 ? 'dcur' : 'd'}" fill="${lwwCol(this._toF(c.v))}"/>` : `<line x1="${pts[i][0].toFixed(1)}" y1="${(pts[i][1] + 6).toFixed(1)}" x2="${pts[i][0].toFixed(1)}" y2="${H}" class="evl"/>`)).join('');
    const hiH = Math.round(mx), loH = Math.round(mn);
    return `<div class="sec">
    <div class="sh"><span class="sect">HOURLY</span><span class="sx">${loH}° – ${hiH}° over the next ${hours.length} hours</span></div>
    <div class="hscroll" tabindex="0" aria-label="Hourly forecast"><div class="htrack" style="width:${W}px">
      <div class="hcols${anyPrecip ? ' wp' : ''}">${colHtml}</div>
      <div class="hcurve" style="height:${H}px">
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <defs><linearGradient id="lwwLine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="0">${stops}</linearGradient>
          <linearGradient id="lwwFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".09"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
          <path d="${area}" fill="url(#lwwFade)"/>
          <path d="${line}" fill="none" stroke="url(#lwwLine)" stroke-width="2.4" stroke-linecap="round"/>
          ${dots}
        </svg>
        ${labels}
      </div>
    </div></div>
  </div>`;
  }

  /* the week as range bars on one shared scale */
  _week(daily, now, cur) {
    if (!daily.length) return `<div class="sec"><div class="sh"><span class="sect">THIS WEEK</span></div>${this._fc.daily ? '<div class="empty">No daily forecast from this integration</div>' : '<div class="skel"></div>'}</div>`;
    const days = daily.slice(0, this._days);
    const lows = days.map((d) => (d.templow != null ? d.templow : d.temperature)), highs = days.map((d) => d.temperature);
    const wmin = Math.min(...lows.filter((v) => v != null)), wmax = Math.max(...highs.filter((v) => v != null));
    const span = Math.max(1, wmax - wmin);
    const pct = (v) => ((v - wmin) / span) * 100;
    const rows = days.map((d, i) => {
      const t = Date.parse(d.datetime), isToday = lwwDayKey(t) === lwwDayKey(now);
      const name = isToday ? 'Today' : new Date(t).toLocaleDateString(undefined, { weekday: 'short' });
      const ic = this._icon(d.condition, false);
      const lo = lows[i], hi = highs[i];
      const pp = d.precipitation_probability, pa = d.precipitation;
      const ptxt = pp != null && pp >= 20 ? `${Math.round(pp)}%` : pa != null && pa >= 0.01 ? `${pa < 0.1 ? pa.toFixed(2) : pa.toFixed(1)}″` : '';
      const a = pct(lo), b = pct(hi);
      const bar = `background:linear-gradient(90deg, ${lwwCol(this._toF(lo))}, ${lwwCol(this._toF(hi))})`;
      const dot = isToday && cur != null && cur >= wmin && cur <= wmax ? `<i class="cdot" style="left:${pct(cur).toFixed(1)}%"></i>` : '';
      return `<div class="day${isToday ? ' today' : ''}">
        <span class="dn">${name}</span>
        <span class="di"><ha-icon icon="${ic.icon}" style="color:${ic.color}"></ha-icon>${ptxt ? `<span class="dp">${ptxt}</span>` : ''}</span>
        <span class="dl">${lo != null ? Math.round(lo) + '°' : ''}</span>
        <span class="dt"><i class="dr" style="left:${a.toFixed(1)}%;width:${Math.max(2, b - a).toFixed(1)}%;${bar}"></i>${dot}</span>
        <span class="dh">${hi != null ? Math.round(hi) + '°' : ''}</span>
      </div>`;
    }).join('');
    return `<div class="sec"><div class="sh"><span class="sect">THIS WEEK</span><span class="sx">${Math.round(wmin)}° – ${Math.round(wmax)}°</span></div><div class="week">${rows}</div></div>`;
  }

  /* ---------- interaction ---------- */
  _wire() {
    this.shadowRoot.addEventListener('click', (ev) => {
      const el = ev.composedPath().find((x) => x.dataset && x.dataset.act);
      if (el && el.dataset.act === 'info') {
        this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: this._config.entity }, bubbles: true, composed: true }));
      }
    });
  }

  /* ---------- styles ---------- */
  _css() {
    return `<style>
:host { display:block; }
* { box-sizing:border-box; }
button { font:inherit; color:inherit; background:none; border:none; padding:0; cursor:pointer; -webkit-tap-highlight-color:transparent; text-align:inherit; }
button:focus-visible, .hscroll:focus-visible { outline:2px solid color-mix(in srgb, var(--accent) 70%, transparent); outline-offset:3px; border-radius:16px; }
ha-icon { --mdc-icon-size:18px; display:inline-flex; }
.card { position:relative; overflow:hidden; container-type:inline-size; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.07); border-radius:28px; padding:22px; color:#f3f4f6; font-family:var(--ha-font-family-body, Roboto, sans-serif); }
.card::before { content:''; position:absolute; top:-150px; left:-130px; width:380px; height:380px; border-radius:50%; background:radial-gradient(closest-side, color-mix(in srgb, var(--accent) 17%, transparent), transparent); pointer-events:none; transition:background .8s; }
.head { position:relative; display:flex; align-items:center; gap:12px; }
.title { font-size:13px; letter-spacing:.14em; font-weight:600; color:#8b919c; flex:1; }
.sunchip { display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:#cbd5e1; white-space:nowrap; }
.sunchip ha-icon { --mdc-icon-size:17px; color:#fb923c; }
/* hero */
.hero { position:relative; display:flex; align-items:center; gap:16px; margin-top:12px; width:100%; border-radius:18px; }
.sky { flex:none; width:108px; height:108px; }
.sky svg { width:100%; height:100%; overflow:visible; }
.now { display:flex; flex-direction:column; min-width:0; }
.temp { font-size:clamp(52px, 17cqw, 68px); font-weight:700; letter-spacing:-0.045em; line-height:.95; font-variant-numeric:tabular-nums; }
.deg { font-weight:300; color:color-mix(in srgb, var(--accent) 80%, #fff); margin-left:2px; }
.cond { font-size:17px; font-weight:600; margin-top:6px; }
.hl { display:flex; gap:12px; margin-top:4px; font-size:13px; color:#9aa0aa; }
.hl b { color:#e5e7eb; font-weight:700; }
.outlook { position:relative; margin-top:12px; font-size:14px; color:#cbd5e1; line-height:1.4; }
/* sky scene */
.rays line { stroke:#f5b83d; stroke-width:3; stroke-linecap:round; opacity:.75; }
.rays { animation:spin 60s linear infinite; }
.sun circle { filter:drop-shadow(0 0 10px rgba(245,184,61,.55)); }
.moon path { filter:drop-shadow(0 0 10px rgba(196,181,253,.45)); }
.star { fill:#e9e5ff; animation:twinkle 3.2s ease-in-out infinite; }
.s2 { animation-delay:.8s; } .s3 { animation-delay:1.6s; } .s4 { animation-delay:2.4s; }
.cl { fill:#cbd5e1; }
.cl.front { fill:#e2e8f0; filter:drop-shadow(0 6px 10px rgba(0,0,0,.35)); animation:drift 9s ease-in-out infinite alternate; }
.cl.back { fill:#64748b; opacity:.9; animation:drift 12s ease-in-out infinite alternate-reverse; }
.night .cl.front { fill:#94a3b8; }
.cl.dark { fill:#64748b; }
.drop { stroke:#38bdf8; stroke-width:2.4; stroke-linecap:round; animation:fall .9s linear infinite; }
.flake { fill:#f0f9ff; animation:fall 2.4s linear infinite; }
.bolt { fill:#facc15; filter:drop-shadow(0 0 8px rgba(250,204,21,.7)); animation:flash 3.6s ease-in-out infinite; }
.fogl line { stroke:#9ca3af; stroke-width:4; stroke-linecap:round; opacity:.7; animation:drift 6s ease-in-out infinite alternate; }
.wind path { fill:none; stroke:#a7f3d0; stroke-width:4; stroke-linecap:round; opacity:.85; animation:drift 4s ease-in-out infinite alternate; }
/* stats */
.stats { position:relative; display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:8px; margin-top:16px; }
.stat { display:flex; flex-direction:column; gap:2px; padding:10px 12px; border-radius:16px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.05); min-width:0; }
.sk { display:flex; align-items:center; gap:5px; font-size:12px; color:#8b919c; white-space:nowrap; }
.sk ha-icon { --mdc-icon-size:14px; color:#8b919c; transition:transform .6s; }
.sv { font-size:20px; font-weight:700; letter-spacing:-0.02em; font-variant-numeric:tabular-nums; white-space:nowrap; }
.sv small { font-size:12px; font-weight:600; color:#9aa0aa; margin-left:3px; letter-spacing:0; }
.ss { font-size:11.5px; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-height:14px; }
/* sections */
.sec { position:relative; margin-top:20px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.07); }
.sh { display:flex; align-items:baseline; justify-content:space-between; gap:10px; }
.sect { font-size:11px; letter-spacing:.14em; font-weight:700; color:#8b919c; }
.sx { font-size:12px; color:#6b7280; white-space:nowrap; font-variant-numeric:tabular-nums; }
/* hourly */
.hscroll { margin:10px -22px 0; padding:0 22px; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; -webkit-overflow-scrolling:touch; scroll-snap-type:x proximity;
  -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 22px, #000 calc(100% - 22px), transparent); mask-image:linear-gradient(90deg, transparent 0, #000 22px, #000 calc(100% - 22px), transparent); }
.hscroll::-webkit-scrollbar { display:none; }
.htrack { position:relative; }
.hcols { display:flex; }
.hc { flex:none; width:${LWW_CW}px; display:flex; flex-direction:column; align-items:center; gap:7px; scroll-snap-align:start; }
.hc.nd { border-left:1px solid rgba(255,255,255,0.1); }
.ht { font-size:12px; font-weight:600; color:#9aa0aa; white-space:nowrap; font-variant-numeric:tabular-nums; }
.hc.cur .ht { color:#f3f4f6; }
.hc.nd .ht { color:#e5e7eb; }
.hc ha-icon { --mdc-icon-size:22px; }
.hp { font-size:10.5px; font-weight:600; color:#38bdf8; min-height:13px; white-space:nowrap; }
.hc.ev .ht { color:#fdba74; }
.hc.ev .hp { color:#fdba74; }
.hcurve { position:relative; margin-top:4px; }
.hcurve svg { position:absolute; left:0; top:0; display:block; }
.d { stroke:#15171c; stroke-width:1.5; }
.dcur { stroke:#f3f4f6; stroke-width:2; }
.evl { stroke:#fb923c; stroke-width:1; stroke-dasharray:2 3; opacity:.6; }
.tl { position:absolute; transform:translateX(-50%); font-size:13px; font-weight:700; font-variant-numeric:tabular-nums; color:#e5e7eb; white-space:nowrap; }
.tl.cur { color:#fff; }
/* week */
.week { margin-top:6px; }
.day { display:grid; grid-template-columns:52px 54px 34px minmax(0,1fr) 34px; align-items:center; column-gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.045); font-variant-numeric:tabular-nums; }
.day:last-child { border-bottom:none; }
.dn { font-size:14.5px; font-weight:600; }
.day.today .dn { color:color-mix(in srgb, var(--accent) 70%, #fff); }
.di { display:flex; align-items:center; gap:4px; }
.di ha-icon { --mdc-icon-size:22px; }
.dp { font-size:11px; font-weight:600; color:#38bdf8; }
.dl { text-align:right; font-size:14px; font-weight:600; color:#8b919c; }
.dh { font-size:14px; font-weight:700; }
.dt { position:relative; height:6px; border-radius:3px; background:rgba(255,255,255,0.07); }
.dr { position:absolute; top:0; bottom:0; border-radius:3px; }
.cdot { position:absolute; top:50%; width:10px; height:10px; margin:-5px 0 0 -5px; border-radius:50%; background:#fff; box-shadow:0 0 0 3px #1b1d22; }
/* states */
.empty { margin-top:10px; font-size:13px; color:#6b7280; }
.skel { margin-top:12px; height:92px; border-radius:14px; background:linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.07), rgba(255,255,255,0.03)); background-size:200% 100%; animation:shimmer 1.4s linear infinite; }
@container (max-width: 400px) {
  .stats { grid-template-columns:repeat(2, minmax(0,1fr)); }
  .sky { width:92px; height:92px; }
  .day { grid-template-columns:46px 50px 30px minmax(0,1fr) 30px; column-gap:8px; }
  .sx { display:none; }
}
@keyframes spin { to { transform:rotate(360deg); } }
@keyframes twinkle { 0%,100% { opacity:.25; } 50% { opacity:1; } }
@keyframes drift { from { transform:translateX(-2px); } to { transform:translateX(3px); } }
@keyframes fall { 0% { transform:translateY(-4px); opacity:0; } 20% { opacity:1; } 100% { transform:translateY(14px); opacity:0; } }
@keyframes flash { 0%,86%,100% { opacity:.25; } 88%,92% { opacity:1; } 90% { opacity:.4; } }
@keyframes shimmer { to { background-position:-200% 0; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation:none !important; } }
</style>`;
  }
}

if (!customElements.get('linwood-weather-card')) customElements.define('linwood-weather-card', LinwoodWeatherCard);
window.customCards = window.customCards || [];
if (!window.customCards.find((c) => c.type === 'linwood-weather-card')) {
  window.customCards.push({ type: 'linwood-weather-card', name: 'Linwood Weather Card', description: 'Live sky, current conditions, hourly curve and weekly range bars', preview: false });
}
