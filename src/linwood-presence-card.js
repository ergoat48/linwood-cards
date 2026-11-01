/* Linwood Presence Card v1.2.0 — live floor plan for Everything Presence Lite (LD2450) radar sensors.
 * v1.2.0: tap the plan for a full-screen view (bigger plan, every zone on demand, per-sensor status: tracking /
 *   holding with time left / last Entry/Exit decision). A target the sensor froze when its hold started is drawn as
 *   the hold ring, not as a live person. New sensor options: hold_gate (only show a hold while that entity is on — e.g.
 *   a "visit active" helper, so a phantom hold on an empty room reads Empty) and height / target_height (ceiling-high,
 *   tilted sensors: radar range is slant range, so targets and zones are projected onto the floor).
 * v1.1.0: stairs (treads + up arrow) and column / chimney (solid block) furniture types.
 * v1.0.1: coverage wedge and sensor marker follow the placement rotation only (matches the Presence app); the
 *   installation angle still applies to target positions and zones.
 * Draws the room the way the Presence app (Zone Configurator) has it — walls, doors, furniture — then the sensor's
 * zones, read live from the polygon text entities (edits in the Zone Editor show up here), and a dot for each person
 * the radar is tracking. Zones light up while someone is in them. Several sensors can share one plan (e.g. the theater
 * and stairs sensors in the basement); when both see the same person, only the closer sensor's dot is drawn.
 * When the sensor's Entry/Exit hold is on (it lost a still person but assumes they are there), the dot turns into a
 * pulsing ring at the last position and the header says "Holding".
 *
 * type: custom:linwood-presence-card
 * title: Presence                 # optional
 * max_height: 460                 # optional, px — the plan scales down to fit
 * rotate: 0                       # optional: 0 / 90 / 180 / 270 — turn the plan (labels stay upright)
 * room:                           # in mm, the Presence app's room coordinates (x right, y down)
 *   walls: [[-1400,-2050], [1400,-2050], [1400,2050], [-1400,2050]]
 *   doors:                        # wall = index of the wall that starts at walls[wall]; at = 0..1 along it
 *     - { wall: 3, at: 0.9, width: 770, swing: in, hinge: right }        # style: single (default) / double / opening
 *   furniture:                    # type: sofa, bed, chair, recliner, desk, table, tv, stairs (steps: 7; arrow points up
 *                                 #   toward +d), column / chimney (solid), ... (anything else = plain box)
 *     - { type: bed, x: 345, y: 447, w: 1600, d: 2100, rot: 90 }
 * sensors:
 *   - id: 278848                  # the device suffix in its entity ids (everything_presence_lite_<id>_...)
 *     name: Bedroom               # optional, for the full-screen view (default: the area prefix of its entities)
 *     x: -200                     # placement and rotation from the Presence app; the installation angle is read live
 *     y: -1850
 *     rotation: 0
 *     height: 2200                # optional, mm above the floor — set for high, tilted sensors to project onto the floor
 *     target_height: 1000         # optional, mm — torso height the projection assumes (default 1000)
 *     hold_gate: input_boolean.x  # optional — the hold ring / "Holding" only while this entity is on
 *     color: '#a78bfa'            # optional: this sensor's dots
 *     zones:                      # optional, by slot: zone N = 1..4, entry N = e1/e2, exclusion = x1/x2
 *       2: { name: Walkway }      #   names default to the polygon entity's name ("Bed Polygon" → Bed)
 *       3: { hide: true }         #   hidden zones still show in the full-screen view's "All zones"
 *       e1: { hide: true }
 *     show_exclusions: false      # optional (default false)
 *
 * Entities it finds by the id: target_1..3_x / _y / _active, zone_1..4_target_count / _occupancy, *_polygon_zone_N,
 * *_polygon_entry_N, *_polygon_exclusion_N, installation_angle, max_distance, *_assumed_present (+ _remaining),
 * *_entry_exit_last_decision, *_entry_exit_last_target_x / _y (any area prefix).
 */
(async () => {
  if (!customElements.get('linwood-light-card')) await customElements.whenDefined('linwood-light-card');
  const { esc, ago, moreInfo, BASE_CSS, Base: LinwoodBase } = window.LinwoodKit;
  const LwMorph = window.LinwoodMorph;

  const ZONE_COLORS = ['#a78bfa', '#38bdf8', '#34d399', '#f59e0b', '#f472b6', '#fb7185', '#22d3ee', '#a3e635'];
  const DOT_COLORS = ['#f5f3ff', '#e0f2fe', '#ecfdf5'];
  const UNIT_MM = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };
  const TRAIL_MS = 2600;
  const FROZEN_MS = 1500;          // a target whose x/y last moved before (hold start + this) is the sensor's frozen copy
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
  const f1 = (n) => Math.round(n * 10) / 10;
  const ts = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : 0; };
  const dur = (s) => {
    s = Math.max(0, Math.round(s));
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
  };

  /* Ray cast; polygon as [[x,y],...]. */
  const inside = (p, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const centroid = (poly) => {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const k = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
      a += k; cx += (poly[j][0] + poly[i][0]) * k; cy += (poly[j][1] + poly[i][1]) * k;
    }
    if (Math.abs(a) < 1e-6) return poly[0];
    return [cx / (3 * a), cy / (3 * a)];
  };
  const parsePoly = (s) => {
    if (!s || typeof s !== 'string' || ['unknown', 'unavailable'].includes(s)) return null;
    const pts = s.split(';').map((p) => p.split(':').map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite));
    return pts.length >= 3 ? pts : null;
  };
  /* Split long edges so a projected (curved) zone edge still draws right. */
  const densify = (poly, step) => {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let j = 0; j < n; j++) out.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
    }
    return out;
  };
  const titleCase = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  class LinwoodPresenceCard extends LinwoodBase {
    setConfig(config) {
      if (!config || !Array.isArray(config.sensors) || !config.sensors.length) throw new Error('Set "sensors" (at least one, with an id)');
      for (const s of config.sensors) if (!s || s.id == null) throw new Error('Every sensor needs an "id" (the device suffix, e.g. 95f28c)');
      this._ids = null;          // entity ids, resolved on the first hass
      this._trails = {};
      this._last = {};           // last live position per target (for the hold ring)
      super.setConfig(config);
    }
    getCardSize() { return 7; }
    getGridOptions() { return { columns: 12, rows: 'auto', min_columns: 6 }; }

    connectedCallback() {
      this._tick = setInterval(() => { if (Object.keys(this._trails).length) this._render(true); }, 450);
    }
    disconnectedCallback() {
      clearInterval(this._tick); this._tick = null;
      if (this._dlg && this._dlg.open) this._dlg.close();
    }

    /* ---------- entity discovery ---------- */
    _resolve() {
      const keys = Object.keys(this._hass.states);
      const find = (suffix) => keys.find((k) => k.endsWith(suffix)) || null;
      this._ids = this._config.sensors.map((s) => {
        const p = `everything_presence_lite_${String(s.id).toLowerCase()}`;
        const e = {
          angle: find(`.${p}_installation_angle`) || find(`${p}_installation_angle`),
          range: find(`${p}_max_distance`),
          hold: find(`${p}_assumed_present`),
          remaining: find(`${p}_assumed_present_remaining`),
          decision: find(`${p}_entry_exit_last_decision`),
          last: [find(`${p}_entry_exit_last_target_x`), find(`${p}_entry_exit_last_target_y`)],
          targets: [1, 2, 3].map((n) => ({ x: `sensor.${p}_target_${n}_x`, y: `sensor.${p}_target_${n}_y`, active: `binary_sensor.${p}_target_${n}_active` })),
          zones: [],
        };
        for (const n of [1, 2, 3, 4]) {
          e.zones.push({ slot: String(n), kind: 'zone', n, poly: find(`${p}_polygon_zone_${n}`), count: `sensor.${p}_zone_${n}_target_count`, occ: `binary_sensor.${p}_zone_${n}_occupancy` });
        }
        for (const n of [1, 2]) e.zones.push({ slot: `e${n}`, kind: 'entry', n, poly: find(`${p}_polygon_entry_${n}`) });
        for (const n of [1, 2]) e.zones.push({ slot: `x${n}`, kind: 'excl', n, poly: find(`${p}_polygon_exclusion_${n}`) });
        // "office_everything_presence_lite_277e60_assumed_present" → Office
        const m = e.hold && e.hold.split('.')[1].match(new RegExp(`^(.+)_${p}_`));
        e.area = m ? titleCase(m[1]) : '';
        return e;
      });
    }

    _signature() {
      if (!this._ids) this._resolve();
      const st = this._hass.states;
      const v = (id) => (id && st[id] ? st[id].state : '');
      const parts = [];
      this._ids.forEach((e, i) => {
        const gate = this._config.sensors[i].hold_gate;
        parts.push(v(e.angle), v(e.range), v(e.hold), v(gate));
        for (const t of e.targets) parts.push(v(t.x), v(t.y), v(t.active));
        parts.push(v(e.last[0]), v(e.last[1]));
        for (const z of e.zones) parts.push(v(z.poly), z.count ? v(z.count) : '', z.occ ? v(z.occ) : '', z.occ && st[z.occ] ? st[z.occ].last_changed : '');
      });
      return parts.join('|');
    }

    /* ---------- geometry ---------- */
    _rot() { const r = ((Number(this._config.rotate) || 0) % 360 + 360) % 360; return [0, 90, 180, 270].includes(r) ? r : 0; }
    /* room → view (multiples of 90 so labels stay upright) */
    _v(p) {
      const [x, y] = p;
      switch (this._rot()) { case 90: return [-y, x]; case 180: return [-x, -y]; case 270: return [y, -x]; default: return [x, y]; }
    }
    _devToRoom(s, eff, p) {
      const a = (eff * Math.PI) / 180, c = Math.cos(a), si = Math.sin(a);
      return [p[0] * c - p[1] * si + (Number(s.x) || 0), p[0] * si + p[1] * c + (Number(s.y) || 0)];
    }
    _eff(i) {
      const s = this._config.sensors[i], e = this._ids[i];
      return (Number(s.rotation) || 0) + (num(this._st(e.angle)?.state) || 0);
    }
    /* Height above the targets (mm) for a ceiling-high sensor, else 0. */
    _dh(i) {
      const s = this._config.sensors[i];
      const h = Number(s.height) || 0;
      if (!h) return 0;
      const th = s.target_height == null ? 1000 : Number(s.target_height) || 0;
      return Math.max(0, h - th);
    }
    /* Sensor-plane point → floor-plane point: the radar reports slant range, so shorten the range, keep the bearing. */
    _proj(i, p) {
      const dh = this._dh(i);
      if (!dh) return p;
      const r = Math.hypot(p[0], p[1]);
      if (r < 1) return p;
      const f = Math.sqrt(Math.max(r * r - dh * dh, 0)) / r;
      return [p[0] * f, p[1] * f];
    }
    _toRoom(i, p) { return this._devToRoom(this._config.sensors[i], this._eff(i), this._proj(i, p)); }
    _mm(id) {
      const st = this._st(id);
      if (!st) return null;
      const n = num(st.state);
      if (n == null) return null;
      return n * (UNIT_MM[st.attributes.unit_of_measurement] || 1);
    }
    _walls() {
      const w = (this._config.room && this._config.room.walls) || [];
      return w.map((p) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] : [Number(p.x), Number(p.y)])).filter((p) => p.every(Number.isFinite));
    }

    /* Per-sensor hold state. A hold the gate entity says to ignore is reported but not drawn. */
    _hold(i) {
      const s = this._config.sensors[i], e = this._ids[i];
      const hst = this._st(e.hold);
      const on = !!hst && hst.state === 'on';
      const gate = s.hold_gate ? this._st(s.hold_gate) : null;
      const gated = !!s.hold_gate && !(gate && gate.state === 'on');
      return { on, holding: on && !gated, ignored: on && gated, since: on ? ts(hst.last_changed) : 0, gate };
    }

    /* Live targets in room coordinates, de-duplicated across sensors (closer sensor wins), plus where each holding
     * sensor's ring goes and how many live targets each sensor has. */
    _scan() {
      const out = [], held = [], perSensor = [];
      this._config.sensors.forEach((s, i) => {
        const e = this._ids[i], h = this._hold(i);
        let frozen = null, n0 = 0;
        e.targets.forEach((t, n) => {
          const key = `${s.id}-${n + 1}`;
          if (this._st(t.active)?.state !== 'on') return;
          const xs = this._st(t.x), ys = this._st(t.y);
          const x = this._mm(t.x), y = this._mm(t.y);
          if (x == null || y == null || (x === 0 && y === 0)) return;
          const pos = this._toRoom(i, [x, y]);
          // While a hold is on, the sensor keeps the lost target "active" with its last x/y — that is the hold, not a person.
          if (h.on && ts(xs.last_changed) <= h.since + FROZEN_MS && ts(ys.last_changed) <= h.since + FROZEN_MS) { if (!frozen) frozen = pos; return; }
          n0++;
          out.push({ key, i, n, pos, range: Math.hypot(x, y), color: s.color || DOT_COLORS[i % DOT_COLORS.length] });
        });
        perSensor.push(n0);
        if (h.holding) {
          let hp = frozen;
          if (!hp) {                                            // most recent live position we saw from this sensor
            const lasts = [1, 2, 3].map((n) => this._last[`${s.id}-${n}`]).filter(Boolean).sort((a, b) => b.t - a.t);
            if (lasts.length && lasts[0].t >= h.since - 5000) hp = lasts[0].p;
          }
          if (!hp) {                                            // page opened mid-hold: use the sensor's own last position
            const lx = this._mm(e.last[0]), ly = this._mm(e.last[1]);
            if (lx != null && ly != null) hp = this._toRoom(i, [lx, ly]);
          }
          if (hp) held.push({ key: `${s.id}-h`, i, pos: hp, color: s.color || '#e5e7eb' });
        }
      });
      const keep = [];
      for (const t of out.sort((a, b) => a.range - b.range)) {
        if (keep.some((k) => k.i !== t.i && Math.hypot(k.pos[0] - t.pos[0], k.pos[1] - t.pos[1]) < 700)) continue;
        keep.push(t);
      }
      return { targets: keep, held, perSensor };
    }

    _zones(all) {
      const list = [];
      this._config.sensors.forEach((s, i) => {
        const e = this._ids[i], ov = s.zones || {};
        for (const z of e.zones) {
          const o = ov[z.slot] || ov[Number(z.slot)] || {};
          const hidden = !!o.hide || (z.kind === 'excl' && !(s.show_exclusions || o.show));
          if (hidden && !all) continue;
          const st = this._st(z.poly);
          let dev = parsePoly(st && st.state);
          if (!dev) continue;
          const named = (ent, tail) => {
            const f = (ent && ent.attributes.friendly_name) || '';
            return !f || /everything presence/i.test(f) ? '' : f.replace(tail, '').trim();
          };
          const fallback = z.kind === 'zone' ? `Zone ${z.n}` : z.kind === 'entry' ? `Entry ${z.n}` : `Exclusion ${z.n}`;
          const name = o.name || named(st, /\s*polygon\s*$/i) || (z.count && named(this._st(z.count), /\s*target count\s*$/i)) || fallback;
          if (this._dh(i)) dev = densify(dev, 250);
          const room = dev.map((p) => this._toRoom(i, p));
          const count = z.count ? num(this._st(z.count)?.state) : null;
          const occ = z.occ ? this._st(z.occ) : null;
          list.push({ ...z, key: `${s.id}-${z.slot}`, name, color: o.color, room, count, occ, hidden });
        }
      });
      // Colours: the shown zones first, in order, so a zone keeps its colour when "All zones" adds the hidden ones.
      let ci = 0;
      for (const z of [...list.filter((z) => !z.hidden), ...list.filter((z) => z.hidden)]) {
        if (!z.color) z.color = z.kind === 'zone' ? ZONE_COLORS[ci++ % ZONE_COLORS.length] : z.kind === 'entry' ? '#fbbf24' : '#f87171';
      }
      return list;
    }

    _frame(walls, zones) {
      const pts = walls.length ? walls.map((p) => this._v(p)) : zones.flatMap((z) => z.room.map((p) => this._v(p)));
      for (const g of this._doorGeos(walls)) if (g.sgn < 0) pts.push(this._v([g.e0[0] - g.nx * g.w, g.e0[1] - g.ny * g.w]), this._v([g.e1[0] - g.nx * g.w, g.e1[1] - g.ny * g.w]));
      if (!pts.length) return null;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const pad = 260;
      return { minX: Math.min(...xs) - pad, minY: Math.min(...ys) - pad, W: Math.max(...xs) - Math.min(...xs) + pad * 2, H: Math.max(...ys) - Math.min(...ys) + pad * 2 };
    }

    /* Remember recent positions per target (trails, and where a hold ring goes). Once per render. */
    _track(targets) {
      const now = Date.now();
      const liveKeys = new Set(targets.map((t) => t.key));
      for (const t of targets) {
        const tr = (this._trails[t.key] = this._trails[t.key] || []);
        const last = tr[tr.length - 1];
        if (!last || Math.hypot(last.p[0] - t.pos[0], last.p[1] - t.pos[1]) > 25) tr.push({ p: t.pos, t: now });
        this._last[t.key] = { p: t.pos, t: now };
      }
      for (const key of Object.keys(this._trails)) {
        this._trails[key] = this._trails[key].filter((s) => now - s.t < TRAIL_MS);
        if (!this._trails[key].length || (!liveKeys.has(key) && this._trails[key].length < 2)) delete this._trails[key];
      }
    }

    /* ---------- rendering ---------- */
    _render(force) {
      if (!this._hass || !this._config) return;
      if (!this._root) return;
      const sig = this._signature();
      if (!force && sig === this._sig) return;
      this._sig = sig;
      const scan = this._scan();
      this._track(scan.targets);
      LwMorph.patch(this._root, `<style>${BASE_CSS}${this._css()}</style>${this._html(scan)}`);
      if (this._dlg.open) this._paintModal(scan);
    }

    _status(scan, zones) {
      const people = scan.targets.length;
      const holding = scan.held.length > 0;
      const litZones = zones.filter((z) => z.kind === 'zone' && !z.hidden && z.count > 0).map((z) => z.name);
      const meta = people
        ? `${people === 1 ? '1 person' : `${people} people`}${litZones.length ? ` · ${litZones.slice(0, 2).join(', ')}` : holding ? ' · holding' : ''}`
        : holding ? 'Holding · sitting still' : 'Empty';
      return { people, holding, litZones, meta, cls: holding && !litZones.length ? 'hold' : people ? 'live' : '' };
    }

    _chips(zones) {
      return zones.filter((z) => z.kind === 'zone').map((z) => {
        const here = z.count != null && z.count > 0;
        const occOn = z.occ && z.occ.state === 'on';
        const state = here ? (z.count > 1 ? `${z.count} here` : 'Here') : occOn ? 'Clearing…' : z.occ && z.occ.last_changed ? `Clear · ${ago(z.occ.last_changed).replace(/^since /, '')}` : 'Clear';
        return `<button class="chip${here ? ' on' : occOn ? ' warm' : ''}${z.hidden ? ' hid' : ''}" data-ent="${esc((z.occ && z.occ.entity_id) || '')}" style="--zc:${z.color}">
          <span class="cd"></span><span class="cn">${esc(z.name)}</span><span class="cs">${esc(state)}</span></button>`;
      }).join('');
    }

    _html(scan) {
      const cfg = this._config;
      const walls = this._walls();
      const zones = this._zones(false);
      const box = this._frame(walls, zones);
      if (!box) return `<div class="card"><div class="hd"><div class="ttl">${esc(cfg.title || 'Presence')}</div></div><div class="empty">Add room walls or zones to draw the plan.</div></div>`;
      const st = this._status(scan, zones);
      const offline = this._ids.some((e) => e.targets.every((t) => !this._st(t.x) || ['unavailable', 'unknown'].includes(this._st(t.x).state)));
      const chips = this._chips(zones);
      const mh = Number(cfg.max_height) || 460;
      return `<div class="card">
        <div class="hd"><ha-icon icon="mdi:radar" class="hi${st.people ? ' live' : ''}"></ha-icon><div class="ttl">${esc(cfg.title || 'Presence')}</div>
          <div class="meta ${st.cls}">${esc(st.meta)}</div></div>
        <div class="plan" style="--mh:${mh}px" data-act="open" role="button" tabindex="0" aria-haspopup="dialog" aria-label="Open the full-screen view">
          ${this._svg({ walls, zones, box, scan, k: Math.max(box.W, box.H) / 420, pre: 'c', meta: st.meta })}
          <span class="exp"><ha-icon icon="mdi:arrow-expand"></ha-icon></span>
        </div>
        ${chips ? `<div class="chips">${chips}</div>` : ''}
        ${offline ? '<div class="fine"><ha-icon icon="mdi:wifi-off"></ha-icon>A sensor is offline — its dots and zones will be missing.</div>' : ''}
      </div>`;
    }

    /* The plan. k ≈ mm per screen px (sizes dots, labels, sensor markers); pre keeps ids unique per SVG. */
    _svg({ walls, zones, box, scan, k, pre, meta }) {
      const cfg = this._config;
      const { minX, minY, W, H } = box;
      const { targets, held } = scan;
      const now = Date.now();
      const P = (p) => { const q = this._v(p); return `${f1(q[0])},${f1(q[1])}`; };
      const path = (poly) => `M${poly.map(P).join('L')}Z`;

      const roomPath = walls.length >= 3 ? path(walls) : '';
      const grid = [];
      if (roomPath) {
        for (let gx = Math.ceil(minX / 1000) * 1000; gx < minX + W; gx += 1000) grid.push(`M${gx},${f1(minY)}V${f1(minY + H)}`);
        for (let gy = Math.ceil(minY / 1000) * 1000; gy < minY + H; gy += 1000) grid.push(`M${f1(minX)},${gy}H${f1(minX + W)}`);
      }

      // Coverage wedges (±60°, sensor max distance). The sensor's physical aim is the app's placement rotation alone
      // (as the Presence app draws it); the installation angle only corrects the radar's reported coordinates.
      const wedges = cfg.sensors.map((s, i) => {
        const eff = Number(s.rotation) || 0;
        const r = this._mm(this._ids[i].range) || 6000;
        const steps = 24, arc = [];
        for (let j = 0; j <= steps; j++) {
          const a = ((-60 + (120 * j) / steps) * Math.PI) / 180;
          arc.push(this._devToRoom(s, eff, this._proj(i, [Math.sin(a) * r, Math.cos(a) * r])));
        }
        const o = [Number(s.x) || 0, Number(s.y) || 0];
        const ov = this._v(o);
        const col = s.color || '#a78bfa';
        return `<radialGradient id="${pre}cov${i}" gradientUnits="userSpaceOnUse" cx="${f1(ov[0])}" cy="${f1(ov[1])}" r="${r}"><stop offset="0" stop-color="${col}" stop-opacity=".16"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>
          <path class="cov" d="${path([o, ...arc])}" fill="url(#${pre}cov${i})"/>`;
      });

      const devices = cfg.sensors.map((s, i) => {
        const o = this._v([Number(s.x) || 0, Number(s.y) || 0]);
        const fv = this._v(this._devToRoom(s, Number(s.rotation) || 0, [0, 1]));
        const ang = (Math.atan2(fv[1] - o[1], fv[0] - o[0]) * 180) / Math.PI - 90;
        const sz = 9 * k, col = s.color || '#a78bfa';
        return `<g class="dev" transform="translate(${f1(o[0])} ${f1(o[1])}) rotate(${f1(ang)})">
          <rect x="${f1(-sz)}" y="${f1(-sz * 0.55)}" width="${f1(sz * 2)}" height="${f1(sz * 1.1)}" rx="${f1(sz * 0.35)}" fill="#0f1115" stroke="${col}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
          <circle cx="0" cy="${f1(sz * 0.55)}" r="${f1(sz * 0.32)}" fill="${col}"/></g>`;
      });

      const dotsV = [...targets, ...held].map((t) => this._v(t.pos));
      const zoneSvg = zones.map((z) => {
        const lit = z.kind === 'zone' && ((z.count != null && z.count > 0) || (z.count == null && z.occ && z.occ.state === 'on'));
        const cls = `zn ${z.kind}${lit ? ' lit' : ''}${z.hidden ? ' hid' : ''}`;
        let label = '';
        if (z.kind !== 'excl' || z.hidden) {
          const vp = z.room.map((p) => this._v(p));
          const vx = vp.map((p) => p[0]), vy = vp.map((p) => p[1]);
          const zw = Math.max(...vx) - Math.min(...vx);
          const base = (z.kind === 'zone' ? 10.5 : 9) * k;
          const fs = Math.max(6.5 * k, Math.min(base, (0.9 * zw) / (z.name.length * 0.78)));
          const cv = this._v(centroid(z.room));
          const midX = (Math.min(...vx) + Math.max(...vx)) / 2;
          // Top of the zone, then bottom, then the middle — whichever is inside the shape and clear of a dot.
          const cands = [[midX, Math.min(...vy) + fs * 1.15], [midX, Math.max(...vy) - fs * 1.15], cv, [cv[0], cv[1] - fs * 1.6]].filter((q) => inside(q, vp));
          const clear = (q) => dotsV.every((d) => Math.hypot(d[0] - q[0], (d[1] - q[1]) * 1.6) > 24 * k);
          const at = cands.find(clear) || cands[0] || cv;
          label = `<text class="zl ${z.kind}${lit ? ' lit' : ''}${z.hidden ? ' hid' : ''}" x="${f1(at[0])}" y="${f1(at[1])}" font-size="${f1(fs)}" style="--zc:${z.color}">${esc(z.name.toUpperCase())}</text>`;
        }
        const fill = z.kind === 'excl' ? `;fill:url(#${pre}hatch)` : '';
        return { shape: `<path class="${cls}" d="${path(z.room)}" style="--zc:${z.color}${fill}" vector-effect="non-scaling-stroke"/>`, label };
      });

      const trailSvg = Object.entries(this._trails).map(([key, tr]) => {
        if (tr.length < 2) return '';
        const col = (targets.find((t) => t.key === key) || {}).color || '#e5e7eb';
        return tr.slice(1).map((s, j) => {
          const a = this._v(tr[j].p), b = this._v(s.p), age = (now - s.t) / TRAIL_MS;
          return `<line class="trl" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${col}" stroke-opacity="${f1(Math.max(0, 0.55 * (1 - age)) * 100) / 100}" stroke-width="${f1(2.5 * (1 - age * 0.6))}" vector-effect="non-scaling-stroke"/>`;
        }).join('');
      }).join('');

      // One node per target slot (and one hold ring per sensor) so a dot glides (CSS transition) instead of being recreated.
      const r = 7.5 * k;
      const dotSvg = cfg.sensors.flatMap((s, i) => {
        const slots = [1, 2, 3].map((n) => {
          const key = `${s.id}-${n}`;
          const t = targets.find((x) => x.key === key);
          if (!t) {
            const lp = this._last[key] ? this._v(this._last[key].p) : [0, 0];
            return `<g class="dot off" data-k="${key}" style="transform:translate(${f1(lp[0])}px,${f1(lp[1])}px)"></g>`;
          }
          const q = this._v(t.pos);
          return `<g class="dot" data-k="${key}" style="transform:translate(${f1(q[0])}px,${f1(q[1])}px);--dc:${t.color}">
            <circle class="halo" r="${f1(r * 2.6)}" fill="${t.color}"/>
            <circle class="core" r="${f1(r)}" fill="${t.color}" stroke="#0b0c10" stroke-width="2" vector-effect="non-scaling-stroke"/></g>`;
        });
        const h = held.find((x) => x.i === i);
        const hq = h ? this._v(h.pos) : null;
        slots.push(h
          ? `<g class="dot held" data-k="${s.id}-h" style="transform:translate(${f1(hq[0])}px,${f1(hq[1])}px)"><circle class="ring" r="${f1(r * 1.25)}" stroke="${h.color}" vector-effect="non-scaling-stroke"/><circle class="pin" r="${f1(r * 0.3)}" fill="${h.color}"/></g>`
          : `<g class="dot off" data-k="${s.id}-h"></g>`);
        return slots;
      }).join('');

      return `<svg class="pl" viewBox="${f1(minX)} ${f1(minY)} ${f1(W)} ${f1(H)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(cfg.title || 'Presence')}: ${esc(meta)}">
            <defs>
              ${roomPath ? `<clipPath id="${pre}room"><path d="${roomPath}"/></clipPath>` : ''}
              <pattern id="${pre}xhatch" width="${f1(10 * k)}" height="${f1(10 * k)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${f1(10 * k)}" stroke="#9ca3af" stroke-opacity=".22" stroke-width="${f1(1.4 * k)}"/></pattern>
              <pattern id="${pre}hatch" width="${f1(14 * k)}" height="${f1(14 * k)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${f1(14 * k)}" stroke="#f87171" stroke-opacity=".25" stroke-width="${f1(2 * k)}"/></pattern>
            </defs>
            ${roomPath ? `<path class="floor" d="${roomPath}"/>` : ''}
            <g ${roomPath ? `clip-path="url(#${pre}room)"` : ''}>
              <path class="grid" d="${grid.join('')}" vector-effect="non-scaling-stroke"/>
              ${wedges.join('')}
              ${this._furniture(k, pre)}
              ${zoneSvg.map((z) => z.shape).join('')}
            </g>
            ${roomPath ? `<path class="wall" d="${roomPath}" vector-effect="non-scaling-stroke"/>` : ''}
            ${this._doors(walls)}
            ${zoneSvg.map((z) => z.label).join('')}
            ${devices.join('')}
            <g class="trails">${trailSvg}</g>
            ${dotSvg}
          </svg>`;
    }

    /* ---------- full-screen view ---------- */
    _open() {
      if (!this._dlg || !this._hass) return;
      this._msc = null;
      this._paintModal();
      if (!this._dlg.open) { try { this._dlg.showModal(); } catch (e) { this._dlg.setAttribute('open', ''); } }
      clearInterval(this._mtick);
      this._mtick = setInterval(() => this._paintModal(), 1000);    // hold countdown and "… ago"
      requestAnimationFrame(() => this._measure());
    }
    /* Size marks for the plan's real on-screen scale, so dots and labels stay the same size in px as on the card. */
    _measure() {
      if (!this._dlg || !this._dlg.open || !this._mbox) return;
      const svg = this._dlg.querySelector('svg.pl');
      const rc = svg && svg.getBoundingClientRect();
      if (!rc || !rc.width || !rc.height) return;
      const sc = Math.min(rc.width / this._mbox.W, rc.height / this._mbox.H);
      if (!this._msc || Math.abs(sc - this._msc) / this._msc > 0.08) { this._msc = sc; this._paintModal(); }
    }
    _paintModal(scan) {
      if (!this._dlg || !this._hass || !this._ids) return;
      LwMorph.patch(this._dlg, this._modal(scan || this._scan()));
    }
    _modal(scan) {
      const cfg = this._config;
      const all = !!this._all;
      const walls = this._walls();
      const zones = this._zones(all);
      const box = this._frame(walls, zones);
      if (!box) return '';
      this._mbox = box;
      const st = this._status(scan, zones);
      const k = this._msc ? 1.15 / this._msc : Math.max(box.W, box.H) / 640;
      const now = Date.now();

      const rows = cfg.sensors.map((s, i) => {
        const e = this._ids[i], h = this._hold(i), n = scan.perSensor[i];
        const name = s.name || e.area || `Sensor ${s.id}`;
        const col = s.color || DOT_COLORS[i % DOT_COLORS.length];
        let state, cls = '';
        if (h.holding) {
          const rem = this._st(e.remaining);
          const left = rem && num(rem.state) != null ? num(rem.state) - (now - ts(rem.last_updated)) / 1000 : null;
          state = `Holding${left != null && left > 0 ? ` · ${dur(left)} left` : ''}`; cls = 'hold';
        } else if (n) { state = n === 1 ? 'Tracking 1 person' : `Tracking ${n} people`; cls = 'live'; }
        else state = 'Clear';
        const sub = [];
        if (h.ignored) sub.push(`Hold ignored — ${esc((h.gate && h.gate.attributes.friendly_name) || s.hold_gate)} is off`);
        const dec = this._st(e.decision);
        if (dec && !['unknown', 'unavailable', ''].includes(dec.state)) sub.push(`Last: ${esc(dec.state)} · ${esc(ago(dec.last_changed))}`);
        if (n && h.holding) sub.unshift(`${n} live`);
        const range = this._mm(e.range);
        if (range) sub.push(`Range ${f1(range / 1000)} m`);
        return `<div class="srow ${cls}"><span class="sd" style="--dc:${col}"></span><span class="sn"><b>${esc(name)}</b><i>${sub.join(' · ')}</i></span><span class="ss">${esc(state)}</span></div>`;
      }).join('');

      const chips = this._chips(zones);
      return `<div class="pw">
  <header class="ph">
    <span class="pi${st.people ? ' live' : st.holding ? ' hold' : ''}"><ha-icon icon="mdi:radar"></ha-icon></span>
    <span class="pt"><b>${esc(cfg.title || 'Presence')}</b><i class="${st.cls}">${esc(st.meta)}</i></span>
    <button class="ptog${all ? ' on' : ''}" data-act="all" aria-pressed="${all}"><ha-icon icon="mdi:vector-polygon"></ha-icon><span>All zones</span></button>
    <button class="pclose" data-act="close" aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button>
  </header>
  <div class="plan big">${this._svg({ walls, zones, box, scan, k, pre: 'm', meta: st.meta })}</div>
  ${chips ? `<div class="chips">${chips}</div>` : ''}
  <div class="srows">${rows}</div>
  <div class="lg"><span><i class="l-live"></i>Person</span><span><i class="l-hold"></i>Holding (still, assumed here)</span><span><i class="l-entry"></i>Entry / exit</span>${all ? '<span><i class="l-excl"></i>Ignored area</span>' : ''}</div>
</div>`;
    }

    _doorGeos(walls) {
      const doors = (this._config.room && this._config.room.doors) || [];
      if (walls.length < 3) return [];
      return doors.map((d) => {
        const i = Number(d.wall) || 0;
        const a = walls[i % walls.length], b = walls[(i + 1) % walls.length];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (!L) return null;
        const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
        const at = Math.min(1, Math.max(0, d.at == null ? 0.5 : Number(d.at)));
        const w = Number(d.width) || 800;
        const c = [a[0] + (b[0] - a[0]) * at, a[1] + (b[1] - a[1]) * at];
        let nx = -uy, ny = ux;                                         // the normal that points into the room
        if (!inside([c[0] + nx * 50, c[1] + ny * 50], walls)) { nx = -nx; ny = -ny; }
        const sgn = d.swing === 'out' ? -1 : 1;
        return { d, w, c, nx, ny, sgn, e0: [c[0] - ux * w / 2, c[1] - uy * w / 2], e1: [c[0] + ux * w / 2, c[1] + uy * w / 2] };
      }).filter(Boolean);
    }
    _doors(walls) {
      const P = (p) => { const q = this._v(p); return `${f1(q[0])} ${f1(q[1])}`; };
      return this._doorGeos(walls).map(({ d, w, c, nx, ny, sgn, e0, e1 }) => {
        const leaf = (hinge, free, len) => {
          const open = [hinge[0] + nx * sgn * len, hinge[1] + ny * sgn * len];
          return `<path class="door" d="M${P(hinge)}L${P(open)}M${P(free)}A${f1(len)} ${f1(len)} 0 0 ${this._sweep(hinge, free, open)} ${P(open)}" vector-effect="non-scaling-stroke"/>`;
        };
        let swing = '';
        if (d.style === 'double') swing = leaf(e0, c, w / 2) + leaf(e1, c, w / 2);
        else if (d.style !== 'opening') swing = d.hinge === 'right' ? leaf(e1, e0, w) : leaf(e0, e1, w);
        return `<path class="gap" d="M${P(e0)}L${P(e1)}" vector-effect="non-scaling-stroke"/>${swing}`;
      }).join('');
    }
    /* SVG arc sweep flag for a quarter swing from `free` to `open` around `hinge`, in view coordinates. */
    _sweep(h, f, o) {
      const H = this._v(h), F = this._v(f), O = this._v(o);
      const cross = (F[0] - H[0]) * (O[1] - H[1]) - (F[1] - H[1]) * (O[0] - H[0]);
      return cross > 0 ? 1 : 0;
    }

    _furniture(k, pre) {
      const list = (this._config.room && this._config.room.furniture) || [];
      return list.map((f) => {
        const w = Number(f.w || f.width) || 600, d = Number(f.d || f.depth) || 600;
        const c = this._v([Number(f.x) || 0, Number(f.y) || 0]);
        const rot = (Number(f.rot ?? f.rotation) || 0) + this._rot();
        const t = String(f.type || '').toLowerCase();
        const rx = Math.min(w, d) * 0.12;
        const box = (cls, x, y, ww, hh, r) => `<rect class="${cls}" x="${f1(x)}" y="${f1(y)}" width="${f1(ww)}" height="${f1(hh)}" rx="${f1(r)}" vector-effect="non-scaling-stroke"/>`;
        let inner = '';
        if (t.includes('sofa') || t.includes('couch') || t.includes('sectional') || t.includes('recliner') || t.includes('armchair')) {
          const back = d * 0.24, arm = Math.min(w * 0.12, d * 0.22);
          inner = box('fb', -w / 2, -d / 2, w, back, rx * 0.6) + (t.includes('recliner') || t.includes('armchair') ? '' : box('fb', -w / 2, -d / 2, arm, d, rx * 0.6) + box('fb', w / 2 - arm, -d / 2, arm, d, rx * 0.6));
          if (!t.includes('recliner') && !t.includes('armchair')) {
            const seats = w > 2200 ? 3 : 2, sw = (w - arm * 2) / seats;
            for (let s = 1; s < seats; s++) inner += `<line class="fl" x1="${f1(-w / 2 + arm + sw * s)}" y1="${f1(-d / 2 + back)}" x2="${f1(-w / 2 + arm + sw * s)}" y2="${f1(d / 2 - d * 0.06)}" vector-effect="non-scaling-stroke"/>`;
          }
        } else if (t.includes('bed')) {
          const pw = w * 0.4, ph = d * 0.13;
          inner = box('fb', -w / 2 + w * 0.06, -d / 2 + d * 0.05, pw, ph, ph * 0.4) + box('fb', w / 2 - w * 0.06 - pw, -d / 2 + d * 0.05, pw, ph, ph * 0.4)
            + `<line class="fl" x1="${f1(-w / 2)}" y1="${f1(-d / 2 + d * 0.3)}" x2="${f1(w / 2)}" y2="${f1(-d / 2 + d * 0.3)}" vector-effect="non-scaling-stroke"/>`;
        } else if (t.includes('chair')) {
          inner = box('fb', -w / 2, -d / 2, w, Math.min(d * 0.22, 160), rx);
        } else if (t.includes('stair')) {
          const steps = Math.max(2, Number(f.steps) || Math.round(d / 230));
          for (let j = 1; j < steps; j++) inner += `<line class="fl st" x1="${f1(-w / 2)}" y1="${f1(-d / 2 + (d * j) / steps)}" x2="${f1(w / 2)}" y2="${f1(-d / 2 + (d * j) / steps)}" vector-effect="non-scaling-stroke"/>`;
          const a = Math.min(w, d) * 0.16;                     // chevron points up the stairs (toward +d)
          inner += `<path class="up" d="M${f1(-a)} ${f1(d * 0.32 - a * 0.6)}L0 ${f1(d * 0.32)}L${f1(a)} ${f1(d * 0.32 - a * 0.6)}M0 ${f1(-d * 0.3)}V${f1(d * 0.32)}" vector-effect="non-scaling-stroke"/>`;
        } else if (t.includes('column') || t.includes('chimney') || t.includes('pillar')) {
          return `<g class="fur solid" transform="translate(${f1(c[0])} ${f1(c[1])}) rotate(${f1(rot)})">${box('so', -w / 2, -d / 2, w, d, Math.min(w, d) * 0.04)}<rect x="${f1(-w / 2)}" y="${f1(-d / 2)}" width="${f1(w)}" height="${f1(d)}" fill="url(#${pre}xhatch)"/></g>`;
        } else if (t.includes('tv')) {
          inner = `<line class="tv" x1="${f1(-w * 0.42)}" y1="${f1(-d / 2 + d * 0.18)}" x2="${f1(w * 0.42)}" y2="${f1(-d / 2 + d * 0.18)}" vector-effect="non-scaling-stroke"/>`;
        }
        return `<g class="fur" transform="translate(${f1(c[0])} ${f1(c[1])}) rotate(${f1(rot)})">${box('fo', -w / 2, -d / 2, w, d, rx)}${inner}</g>`;
      }).join('');
    }

    _wire() {
      /* The card renders into _root; the full-screen view is a <dialog> beside it (top layer, above the dashboard), so the
       * card's re-renders don't touch it. */
      this._root = document.createElement('div');
      this._dlg = document.createElement('dialog');
      this._dlg.className = 'pm';
      this.shadowRoot.append(this._root, this._dlg);
      this._dlg.addEventListener('close', () => { clearInterval(this._mtick); this._mtick = null; this._msc = null; });
      this._dlg.addEventListener('click', (ev) => { if (ev.target === this._dlg) this._dlg.close(); });
      if (window.ResizeObserver) { this._ro = new ResizeObserver(() => this._measure()); this._ro.observe(this._dlg); }
      this.shadowRoot.addEventListener('click', (ev) => {
        const b = ev.target.closest('.chip');
        if (b) {
          if (!b.dataset.ent) return;
          if (this._dlg.open) this._dlg.close();          // HA's more-info dialog sits below a modal <dialog>
          moreInfo(this, b.dataset.ent);
          return;
        }
        const a = ev.target.closest('[data-act]');
        if (!a) return;
        const act = a.dataset.act;
        if (act === 'open') this._open();
        else if (act === 'close') this._dlg.close();
        else if (act === 'all') { this._all = !this._all; this._paintModal(); }
      });
      this.shadowRoot.addEventListener('keydown', (ev) => {
        if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.dataset && ev.target.dataset.act === 'open') { ev.preventDefault(); this._open(); }
      });
    }

    _css() {
      return `
.hd { margin-bottom:12px; }
.hi { color:#6b7280; --mdc-icon-size:18px; transition:color .3s; }
.hi.live { color:#a78bfa; }
.meta.live, .pt i.live { color:#e9d5ff; }
.meta.hold, .pt i.hold { color:#fbbf24; }
.plan { position:relative; border-radius:20px; background:rgba(0,0,0,0.22); border:1px solid rgba(255,255,255,0.05); padding:6px; }
.plan[data-act] { cursor:zoom-in; -webkit-tap-highlight-color:transparent; outline:none; }
.plan[data-act]:focus-visible { border-color:rgba(167,139,250,.6); }
.plan svg { display:block; width:100%; height:auto; max-height:var(--mh); margin:0 auto; overflow:visible; }
.exp { position:absolute; top:10px; right:10px; width:28px; height:28px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:rgba(15,17,21,.55); color:#7c838e; opacity:.75; transition:opacity .2s, color .2s; pointer-events:none; }
.exp ha-icon { --mdc-icon-size:16px; }
.plan[data-act]:hover .exp { opacity:1; color:#cbd5e1; }
.floor { fill:rgba(255,255,255,0.025); }
.grid { stroke:rgba(255,255,255,0.045); stroke-width:1; fill:none; }
.wall { fill:none; stroke:#6b7280; stroke-width:3; stroke-linejoin:round; }
.gap { stroke:#15171c; stroke-width:5; stroke-linecap:butt; }
.door { fill:none; stroke:rgba(255,255,255,0.28); stroke-width:1; stroke-dasharray:3 3; }
.fur .fo { fill:rgba(255,255,255,0.045); stroke:rgba(255,255,255,0.13); stroke-width:1; }
.fur .fb { fill:rgba(255,255,255,0.05); stroke:rgba(255,255,255,0.1); stroke-width:1; }
.fur .fl { stroke:rgba(255,255,255,0.1); stroke-width:1; }
.fur .tv { stroke:#94a3b8; stroke-width:2.5; stroke-linecap:round; }
.fur .st { stroke:rgba(255,255,255,0.16); }
.fur .up { fill:none; stroke:rgba(255,255,255,0.32); stroke-width:1.3; stroke-linecap:round; stroke-linejoin:round; }
.fur.solid .so { fill:#2a2d33; stroke:#6b7280; stroke-width:1.5; }
.cov { pointer-events:none; }
.zn { fill:color-mix(in srgb, var(--zc) 9%, transparent); stroke:color-mix(in srgb, var(--zc) 55%, transparent); stroke-width:1.5; stroke-linejoin:round; transition:fill .35s, stroke .35s, filter .35s; }
.zn.lit { fill:color-mix(in srgb, var(--zc) 26%, transparent); stroke:var(--zc); stroke-width:2; filter:drop-shadow(0 0 6px color-mix(in srgb, var(--zc) 70%, transparent)); }
.zn.entry { fill:color-mix(in srgb, var(--zc) 5%, transparent); stroke-dasharray:5 4; stroke-width:1.2; stroke:color-mix(in srgb, var(--zc) 60%, transparent); }
.zn.excl { stroke:rgba(248,113,113,0.3); stroke-width:1; stroke-dasharray:2 4; }
.zn.hid:not(.lit):not(.excl) { fill:color-mix(in srgb, var(--zc) 5%, transparent); stroke-dasharray:2 3; }
.zl { fill:color-mix(in srgb, var(--zc) 70%, #9aa0aa); font-weight:700; letter-spacing:.12em; text-anchor:middle; dominant-baseline:middle; paint-order:stroke; stroke:#121418; stroke-width:3px; stroke-linejoin:round; opacity:.85; transition:fill .35s, opacity .35s; font-family:var(--ha-font-family-body, Roboto, sans-serif); pointer-events:none; }
.zl.entry { fill:#a1876a; font-weight:600; opacity:.7; }
.zl.excl { fill:#f87171; font-weight:600; opacity:.6; }
.zl.hid:not(.lit) { opacity:.6; }
.zl.lit { fill:#fff; opacity:1; }
.dot { transition:transform .32s linear, opacity .4s; }
.dot.off { opacity:0; }
.dot .halo { opacity:.18; animation:breathe 2.4s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
.dot .core { filter:drop-shadow(0 0 4px var(--dc)); }
.dot.held .ring { fill:none; stroke-width:2; stroke-dasharray:4 3; opacity:.75; animation:hold 1.8s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
.dot.held .pin { opacity:.45; }
.trl { stroke-linecap:round; }
.chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.chip { display:inline-flex; align-items:center; gap:8px; padding:8px 12px 8px 10px; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); font-size:13px; color:inherit; font-family:inherit; cursor:pointer; transition:background .3s, border-color .3s; touch-action:manipulation; min-width:0; }
.chip .cd { width:8px; height:8px; border-radius:50%; background:color-mix(in srgb, var(--zc) 35%, #374151); flex:none; transition:all .3s; }
.chip .cn { font-weight:600; color:#cbd5e1; white-space:nowrap; }
.chip .cs { color:#7c838e; font-size:12px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.chip.on { background:color-mix(in srgb, var(--zc) 14%, rgba(255,255,255,0.03)); border-color:color-mix(in srgb, var(--zc) 45%, transparent); }
.chip.on .cd { background:var(--zc); box-shadow:0 0 10px var(--zc); }
.chip.on .cs { color:color-mix(in srgb, var(--zc) 60%, #fff); }
.chip.warm .cd { background:color-mix(in srgb, var(--zc) 60%, #374151); }
.chip.hid:not(.on) { border-style:dashed; }
.fine { display:flex; align-items:center; gap:8px; margin-top:10px; font-size:12px; color:#6b7280; }
.fine ha-icon { --mdc-icon-size:15px; }
/* ---- full-screen view (a <dialog> in the top layer). The HA iOS app draws edge to edge, so it is laid out inside
 * the safe area: 12px below the status bar, 12px above the home indicator. */
dialog.pm { --pm-t:calc(env(safe-area-inset-top, 0px) + 12px); --pm-b:calc(env(safe-area-inset-bottom, 0px) + 12px); inset:var(--pm-t) 0 var(--pm-b); padding:0; margin:auto; border:none; background:transparent; color:#f3f4f6; width:min(1180px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))); max-width:none; max-height:calc(100dvh - var(--pm-t) - var(--pm-b)); overflow:visible; font-family:var(--ha-font-family-body, Roboto, sans-serif); }
dialog.pm::backdrop { background:rgba(4,6,10,.7); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); }
dialog.pm[open] { animation:pmin .22s cubic-bezier(.2,.8,.2,1); }
.pw { display:flex; flex-direction:column; gap:12px; max-height:calc(100dvh - var(--pm-t) - var(--pm-b)); overflow-y:auto; overscroll-behavior:contain; padding:16px; border-radius:26px; background:#14171d; border:1px solid rgba(255,255,255,0.08); box-shadow:0 30px 80px -20px rgba(0,0,0,.8); box-sizing:border-box; }
.ph { display:grid; grid-template-columns:auto minmax(0,1fr) auto auto; align-items:center; gap:10px; }
.pi { width:44px; height:44px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.06); color:#9aa0aa; }
.pi ha-icon { --mdc-icon-size:24px; }
.pi.live { background:rgba(167,139,250,0.18); color:#c4b5fd; box-shadow:0 0 22px -4px rgba(167,139,250,.6); }
.pi.hold { background:rgba(251,191,36,0.14); color:#fbbf24; }
.pt { display:flex; flex-direction:column; gap:3px; min-width:0; }
.pt b { font-size:19px; font-weight:700; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.pt i { font-style:normal; font-size:13px; color:#9aa0aa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ptog, .pclose { height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; gap:6px; background:rgba(255,255,255,0.06); color:#cbd5e1; border:1px solid transparent; font:inherit; font-size:13px; font-weight:600; cursor:pointer; }
.ptog { padding:0 12px; }
.ptog ha-icon, .pclose ha-icon { --mdc-icon-size:18px; }
.ptog.on { background:rgba(167,139,250,0.16); border-color:rgba(167,139,250,0.4); color:#e9d5ff; }
.pclose { width:40px; }
.ptog:hover, .pclose:hover { background:rgba(255,255,255,0.11); }
.plan.big { padding:8px; }
.plan.big svg { max-height:calc(100dvh - var(--pm-t) - var(--pm-b) - 250px); min-height:220px; }
.srows { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:8px; }
.srow { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:10px; padding:10px 12px; border-radius:14px; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.06); }
.srow .sd { width:10px; height:10px; border-radius:50%; background:color-mix(in srgb, var(--dc) 30%, #374151); }
.srow.live .sd { background:var(--dc); box-shadow:0 0 10px var(--dc); }
.srow.hold .sd { background:transparent; border:2px dashed #fbbf24; width:8px; height:8px; }
.srow .sn { display:flex; flex-direction:column; gap:2px; min-width:0; }
.srow .sn b { font-size:14px; font-weight:600; color:#e5e7eb; }
.srow .sn i { font-style:normal; font-size:12px; color:#7c838e; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.srow .ss { font-size:13px; font-weight:600; color:#9aa0aa; white-space:nowrap; font-variant-numeric:tabular-nums; }
.srow.live .ss { color:#e9d5ff; }
.srow.hold .ss { color:#fbbf24; }
.lg { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:12px; color:#7c838e; padding:0 4px; }
.lg span { display:inline-flex; align-items:center; gap:6px; }
.lg i { display:inline-block; width:12px; height:12px; border-radius:50%; }
.lg .l-live { background:#f5f3ff; box-shadow:0 0 6px #f5f3ff; width:9px; height:9px; }
.lg .l-hold { border:2px dashed #e5e7eb; box-sizing:border-box; }
.lg .l-entry { border-radius:3px; border:1.5px dashed #fbbf24; box-sizing:border-box; }
.lg .l-excl { border-radius:3px; background:repeating-linear-gradient(45deg, rgba(248,113,113,.45) 0 2px, transparent 2px 5px); }
@media (max-width:520px) { .ptog span { display:none; } .ptog { width:40px; padding:0; } .pw { padding:12px; gap:10px; } .plan.big svg { max-height:calc(100dvh - var(--pm-t) - var(--pm-b) - 210px); } }
@keyframes pmin { from { opacity:0; transform:translateY(10px) scale(.985); } to { opacity:1; transform:none; } }
@keyframes breathe { 0%,100% { transform:scale(.85); opacity:.12; } 50% { transform:scale(1.1); opacity:.24; } }
@keyframes hold { 0%,100% { transform:scale(.9); opacity:.45; } 50% { transform:scale(1.15); opacity:.9; } }
@media (prefers-reduced-motion: reduce) { .dot { transition:none; } dialog.pm[open] { animation:none; } }`;
    }
  }

  if (!customElements.get('linwood-presence-card')) customElements.define('linwood-presence-card', LinwoodPresenceCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.find((c) => c.type === 'linwood-presence-card')) window.customCards.push({ type: 'linwood-presence-card', name: 'Linwood Presence Card', description: 'Live floor plan for Everything Presence radar sensors: room, zones and a dot for each person; tap for a full-screen view', preview: false });
})();
