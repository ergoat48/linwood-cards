/* Linwood Calendar Card v1.1.0 — week strip + agenda for Home Assistant
 * v1.1.0: re-renders patch the DOM in place (LinwoodMorph) instead of replacing it — fixes the iOS jump-to-top on tap. */
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
class LinwoodCalendarCard extends HTMLElement {
  setConfig(config) {
    if (!config || !Array.isArray(config.entities) || !config.entities.length) throw new Error('Set "entities" to a list of calendar entities');
    this._config = config;
    this._cals = config.entities.map((e, i) => (typeof e === 'string' ? { entity: e } : e)).map((c, i) => ({
      entity: c.entity, name: c.name, color: c.color || ['#f5b83d', '#a78bfa', '#38bdf8', '#34d399', '#f472b6'][i % 5],
    }));
    this._sel = this._dayKey(new Date());
    this._events = null;
    this._err = null;
    this._lastFetch = 0;
    this._watch = '';
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.addEventListener('click', (ev) => {
        const el = ev.composedPath().find((x) => x.dataset && x.dataset.act);
        if (!el) return;
        if (el.dataset.act === 'day') { this._sel = el.dataset.val; this._paint(); }
        else if (el.dataset.act === 'more') this._more(el.dataset.val);
        else if (el.dataset.act === 'today') { this._sel = this._dayKey(new Date()); this._paint(); }
      });
    }
    this._paint();
  }

  set hass(hass) {
    this._hass = hass;
    const today = this._dayKey(new Date());
    if (this._today && this._today !== today && this._sel === this._today) this._sel = today;
    this._today = today;
    const watch = this._cals.map((c) => { const s = hass.states[c.entity]; return s ? s.state + s.last_changed + JSON.stringify(s.attributes.start_time || '') : '-'; }).join('|') + today;
    const todo = this._config.todo && hass.states[this._config.todo];
    const todoSig = todo ? todo.state : '';
    const stale = Date.now() - this._lastFetch > 10 * 60 * 1000;
    if (watch !== this._watch || stale) { this._watch = watch; this._fetch(); }
    if (todoSig !== this._todoSig) { this._todoSig = todoSig; this._paint(); }
  }

  getCardSize() { return 7; }
  getGridOptions() { return { columns: 12, rows: 'auto', min_columns: 6 }; }

  /* ---------- data ---------- */
  _dayKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  _parse(v) {
    if (!v) return null;
    if (v.dateTime) return { d: new Date(v.dateTime), allDay: false };
    if (v.date) { const [y, m, d] = v.date.split('-').map(Number); return { d: new Date(y, m - 1, d), allDay: true }; }
    if (typeof v === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(v) ? this._parse({ date: v }) : { d: new Date(v), allDay: false };
    return null;
  }

  async _fetch() {
    if (!this._hass || this._busy) return;
    this._busy = true;
    this._lastFetch = Date.now();
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + (this._config.lookahead_days || 30));
    const q = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
    try {
      const lists = await Promise.all(this._cals.map((c) => this._hass.callApi('GET', `calendars/${c.entity}?${q}`)
        .then((evs) => (evs || []).map((e) => ({ ...e, _cal: c })))
        .catch(() => [])));
      const out = [];
      lists.flat().forEach((e) => {
        const s = this._parse(e.start), en = this._parse(e.end);
        if (!s) return;
        out.push({ title: e.summary || '(No title)', location: e.location || '', start: s.d, end: en ? en.d : s.d, allDay: s.allDay, cal: e._cal });
      });
      out.sort((a, b) => (a.allDay === b.allDay ? a.start - b.start : a.allDay ? -1 : 1));
      this._events = out;
      this._err = null;
    } catch (err) {
      this._err = String(err && err.message ? err.message : err);
    }
    this._busy = false;
    this._paint();
  }

  _eventsOn(key) {
    if (!this._events) return [];
    const [y, m, d] = key.split('-').map(Number);
    const dayStart = new Date(y, m - 1, d), dayEnd = new Date(y, m - 1, d + 1);
    return this._events.filter((e) => (e.allDay ? e.start < dayEnd && e.end > dayStart : e.start < dayEnd && (e.end > dayStart || +e.end === +e.start && e.start >= dayStart)))
      .sort((a, b) => (a.allDay === b.allDay ? a.start - b.start : a.allDay ? -1 : 1));
  }

  /* ---------- render ---------- */
  _esc(s) { return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  _time(d) { return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
  _rel(d) {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - t0) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  _paint() {
    if (!this.shadowRoot || !this._config) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = [];
    for (let i = 0; i < (this._config.days || 7); i++) { const d = new Date(today); d.setDate(d.getDate() + i); days.push(d); }
    const todayKey = this._dayKey(today);

    const strip = days.map((d) => {
      const key = this._dayKey(d), evs = this._eventsOn(key);
      const cols = [...new Set(evs.map((e) => e.cal.color))].slice(0, 3);
      const sel = key === this._sel, isToday = key === todayKey;
      return `<button class="day${sel ? ' sel' : ''}${isToday ? ' today' : ''}" data-act="day" data-val="${key}">
        <span class="dw">${d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)}</span>
        <span class="dn">${d.getDate()}</span>
        <span class="dots">${cols.map((c) => `<i style="background:${c}"></i>`).join('') || '<i class="none"></i>'}</span>
      </button>`;
    }).join('');

    const [sy, sm, sd] = this._sel.split('-').map(Number);
    const selDate = new Date(sy, sm - 1, sd);
    const evs = this._eventsOn(this._sel);
    const max = this._config.max_events || 5;
    let body;
    if (this._events === null && !this._err) {
      body = `<div class="empty"><div class="sk"></div><div class="sk short"></div></div>`;
    } else if (this._err) {
      body = `<div class="empty"><ha-icon icon="mdi:calendar-alert"></ha-icon><div class="et">Couldn't load events</div><div class="es">${this._esc(this._err)}</div></div>`;
    } else if (!evs.length) {
      const next = this._events.find((e) => (e.allDay ? e.end : e.start) > (this._sel === todayKey ? new Date() : new Date(sy, sm - 1, sd + 1)));
      body = `<div class="empty"><ha-icon icon="mdi:calendar-blank-outline"></ha-icon>
        <div class="et">Nothing on ${this._sel === todayKey ? 'today' : selDate.toLocaleDateString(undefined, { weekday: 'long' })}</div>
        ${next ? `<button class="next" data-act="day" data-val="${this._dayKey(next.start < today ? today : next.start)}"><i style="background:${next.cal.color}"></i><span>Next: <b>${this._esc(next.title)}</b> · ${this._rel(next.start)}${next.allDay ? '' : ' ' + this._time(next.start)}</span><ha-icon icon="mdi:chevron-right"></ha-icon></button>` : '<div class="es">Your next 30 days are clear</div>'}
      </div>`;
    } else {
      const now = new Date();
      body = `<div class="list">${evs.slice(0, max).map((e) => {
        const live = !e.allDay && e.start <= now && e.end > now;
        const past = !e.allDay && e.end <= now;
        const when = e.allDay ? 'All day' : this._time(e.start);
        const range = e.allDay ? '' : `${this._time(e.start)} – ${this._time(e.end)}`;
        const meta = [range, e.location, e.cal.name || (this._hass && this._hass.states[e.cal.entity] ? this._hass.states[e.cal.entity].attributes.friendly_name : '')].filter(Boolean).map((x) => this._esc(x)).join(' · ');
        return `<button class="ev${live ? ' live' : ''}${past ? ' past' : ''}" data-act="more" data-val="${e.cal.entity}" style="--ec:${e.cal.color}">
          <span class="when">${when}${live ? '<em>Now</em>' : ''}</span>
          <span class="bar"></span>
          <span class="what"><span class="tt">${this._esc(e.title)}</span><span class="mt">${meta}</span></span>
        </button>`;
      }).join('')}${evs.length > max ? `<div class="moreev">+${evs.length - max} more</div>` : ''}</div>`;
    }

    const cnt = this._events ? new Set(days.flatMap((d) => this._eventsOn(this._dayKey(d)))).size : null;
    const right = this._sel === todayKey ? (cnt == null ? '' : cnt ? `${cnt} this week` : 'Clear week') : '<button class="tbtn" data-act="today">Today</button>';
    const todo = this._config.todo && this._hass && this._hass.states[this._config.todo];
    const tn = todo ? parseInt(todo.state, 10) || 0 : 0;

    LwMorph.patch(this.shadowRoot, `${this._css()}
<div class="card">
  <div class="head"><span class="title">${this._esc(this._config.title || 'CALENDAR')}</span><span class="right">${right}</span></div>
  <div class="selhead"><span class="big">${selDate.toLocaleDateString(undefined, { weekday: 'long' })}</span><span class="dt">${selDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</span></div>
  <div class="strip">${strip}</div>
  ${body}
  ${todo ? `<button class="todo" data-act="more" data-val="${this._config.todo}"><span class="ti"><ha-icon icon="mdi:cart-outline"></ha-icon></span><span class="tl">${this._esc(todo.attributes.friendly_name || 'To-do')}</span><span class="tc${tn ? ' has' : ''}">${tn ? tn + (tn > 1 ? ' items' : ' item') : 'Empty'}</span><ha-icon class="chev" icon="mdi:chevron-right"></ha-icon></button>` : ''}
</div>`);
  }

  _more(entityId) { this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true })); }

  _css() {
    return `<style>
:host { display:block; }
* { box-sizing:border-box; }
button { font:inherit; color:inherit; background:none; border:none; padding:0; cursor:pointer; text-align:left; -webkit-tap-highlight-color:transparent; }
ha-icon { --mdc-icon-size:18px; display:inline-flex; }
.card { position:relative; overflow:hidden; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.07); border-radius:28px; padding:22px; color:#f3f4f6; font-family:var(--ha-font-family-body, Roboto, sans-serif); }
.head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.title { font-size:13px; letter-spacing:.14em; font-weight:600; color:#8b919c; }
.right { font-size:14px; font-weight:600; color:#f5b83d; }
.tbtn { padding:5px 12px; border-radius:10px; background:rgba(245,184,61,0.14); color:#f5b83d; font-size:13px; font-weight:600; }
.selhead { display:flex; align-items:baseline; gap:10px; margin:14px 0 12px; }
.selhead .big { font-size:24px; font-weight:700; letter-spacing:-0.02em; }
.selhead .dt { font-size:14px; color:#9aa0aa; }
.strip { display:grid; grid-template-columns:repeat(7, minmax(0,1fr)); gap:6px; }
.day { display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 0 7px; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid transparent; transition:background .15s; }
.day:hover { background:rgba(255,255,255,0.08); }
.dw { font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:#8b919c; font-weight:600; }
.dn { font-size:17px; font-weight:700; font-variant-numeric:tabular-nums; }
.day.today { border-color:rgba(245,184,61,0.5); }
.day.today .dw { color:#f5b83d; }
.day.sel { background:linear-gradient(160deg,#fcd34d,#f59e0b); border-color:transparent; }
.day.sel .dw, .day.sel .dn { color:#1f1606; }
.dots { display:flex; gap:3px; height:5px; }
.dots i { width:5px; height:5px; border-radius:50%; display:block; }
.dots i.none { background:transparent; }
.day.sel .dots i { box-shadow:0 0 0 1.5px rgba(31,22,6,0.35); }
.list { display:flex; flex-direction:column; gap:8px; margin-top:14px; }
.ev { display:grid; grid-template-columns:62px 4px minmax(0,1fr); align-items:stretch; gap:12px; padding:11px 12px; border-radius:16px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.05); transition:background .15s; }
.ev:hover { background:rgba(255,255,255,0.07); }
.ev.live { background:linear-gradient(145deg, color-mix(in srgb, var(--ec) 16%, transparent), rgba(255,255,255,0.03)); border-color:color-mix(in srgb, var(--ec) 40%, transparent); }
.ev.past { opacity:.5; }
.when { display:flex; flex-direction:column; font-size:13px; font-weight:600; color:#cbd5e1; padding-top:1px; white-space:nowrap; }
.when em { font-style:normal; font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--ec); margin-top:3px; font-weight:700; }
.bar { border-radius:2px; background:var(--ec); }
.what { display:flex; flex-direction:column; min-width:0; }
.tt { font-size:15px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mt { font-size:12.5px; color:#9aa0aa; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.moreev { font-size:13px; color:#9aa0aa; padding:2px 4px; }
.empty { display:flex; flex-direction:column; align-items:center; text-align:center; gap:6px; padding:22px 8px 18px; margin-top:12px; border-radius:18px; border:1px dashed rgba(255,255,255,0.09); color:#9aa0aa; }
.empty > ha-icon { --mdc-icon-size:26px; color:#6b7280; margin-bottom:2px; }
.et { font-size:15px; font-weight:600; color:#e5e7eb; }
.es { font-size:12.5px; }
.next { display:flex; align-items:center; gap:8px; margin-top:6px; padding:8px 10px 8px 12px; border-radius:12px; background:rgba(255,255,255,0.05); font-size:13px; color:#cbd5e1; max-width:100%; }
.next i { flex:none; width:7px; height:7px; border-radius:50%; }
.next span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.next b { color:#f3f4f6; font-weight:600; }
.next ha-icon { --mdc-icon-size:16px; flex:none; }
.sk { width:100%; height:44px; border-radius:14px; background:linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04)); background-size:200% 100%; animation:sh 1.4s linear infinite; }
.sk.short { width:70%; height:44px; }
.empty:has(.sk) { border:none; padding:0; align-items:stretch; }
.todo { display:flex; align-items:center; gap:12px; width:100%; margin-top:14px; padding:11px 12px; border-radius:16px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.05); }
.todo:hover { background:rgba(255,255,255,0.07); }
.ti { width:34px; height:34px; border-radius:11px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.07); color:#cbd5e1; }
.tl { flex:1; font-size:15px; font-weight:600; }
.tc { font-size:13px; color:#9aa0aa; }
.tc.has { color:#f5b83d; font-weight:600; }
.chev { --mdc-icon-size:18px; color:#6b7280; }
@keyframes sh { to { background-position:-200% 0; } }
@media (prefers-reduced-motion: reduce) { .sk { animation:none; } }
</style>`;
  }
}

if (!customElements.get('linwood-calendar-card')) customElements.define('linwood-calendar-card', LinwoodCalendarCard);
window.customCards = window.customCards || [];
if (!window.customCards.find((c) => c.type === 'linwood-calendar-card')) {
  window.customCards.push({ type: 'linwood-calendar-card', name: 'Linwood Calendar Card', description: 'Week strip and agenda for one or more calendars', preview: false });
}
