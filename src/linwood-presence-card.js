/* Linwood Presence Card v1.0.1 — live floor plan for Everything Presence Lite (LD2450) radar sensors.
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
 *   furniture:                    # type: sofa, bed, chair, recliner, desk, table, tv, ... (anything else = plain box)
 *     - { type: bed, x: 345, y: 447, w: 1600, d: 2100, rot: 90 }
 * sensors:
 *   - id: 278848                  # the device suffix in its entity ids (everything_presence_lite_<id>_...)
 *     x: -200                     # placement and rotation from the Presence app; the installation angle is read live
 *     y: -1850
 *     rotation: 0
 *     color: '#a78bfa'            # optional: this sensor's dots
 *     zones:                      # optional, by slot: zone N = 1..4, entry N = e1/e2, exclusion = x1/x2
 *       2: { name: Walkway }      #   names default to the polygon entity's name ("Bed Polygon" → Bed)
 *       3: { hide: true }
 *       e1: { hide: true }
 *     show_exclusions: false      # optional (default false)
 *
 * Entities it finds by the id: target_1..3_x / _y / _active, zone_1..4_target_count / _occupancy, *_polygon_zone_N,
 * *_polygon_entry_N, *_polygon_exclusion_N, installation_angle, max_distance, *_assumed_present (any area prefix).
 */
(async () => {
  if (!customElements.get('linwood-light-card')) await customElements.whenDefined('linwood-light-card');
  const { esc, ago, moreInfo, BASE_CSS, Base: LinwoodBase } = window.LinwoodKit;

  const ZONE_COLORS = ['#a78bfa', '#38bdf8', '#34d399', '#f59e0b', '#f472b6', '#fb7185', '#22d3ee', '#a3e635'];
  const DOT_COLORS = ['#f5f3ff', '#e0f2fe', '#ecfdf5'];
  const UNIT_MM = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };
  const TRAIL_MS = 2600;
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
  const f1 = (n) => Math.round(n * 10) / 10;

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
    disconnectedCallback() { clearInterval(this._tick); this._tick = null; }

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
          last: [find(`${p}_entry_exit_last_target_x`), find(`${p}_entry_exit_last_target_y`)],
          targets: [1, 2, 3].map((n) => ({ x: `sensor.${p}_target_${n}_x`, y: `sensor.${p}_target_${n}_y`, active: `binary_sensor.${p}_target_${n}_active` })),
          zones: [],
        };
        for (const n of [1, 2, 3, 4]) {
          e.zones.push({ slot: String(n), kind: 'zone', n, poly: find(`${p}_polygon_zone_${n}`), count: `sensor.${p}_zone_${n}_target_count`, occ: `binary_sensor.${p}_zone_${n}_occupancy` });
        }
        for (const n of [1, 2]) e.zones.push({ slot: `e${n}`, kind: 'entry', n, poly: find(`${p}_polygon_entry_${n}`) });
        for (const n of [1, 2]) e.zones.push({ slot: `x${n}`, kind: 'excl', n, poly: find(`${p}_polygon_exclusion_${n}`) });
        return e;
      });
    }

    _signature() {
      if (!this._ids) this._resolve();
      const st = this._hass.states;
      const v = (id) => (id && st[id] ? st[id].state : '');
      const parts = [];
      for (const e of this._ids) {
        parts.push(v(e.angle), v(e.range), v(e.hold));
        for (const t of e.targets) parts.push(v(t.x), v(t.y), v(t.active));
        parts.push(v(e.last[0]), v(e.last[1]));
        for (const z of e.zones) parts.push(v(z.poly), z.count ? v(z.count) : '', z.occ ? v(z.occ) : '', z.occ && st[z.occ] ? st[z.occ].last_changed : '');
      }
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

    /* Live targets in room coordinates, de-duplicated across sensors (closer sensor wins). */
    _targets() {
      const out = [];
      this._config.sensors.forEach((s, i) => {
        const e = this._ids[i], eff = this._eff(i);
        const holding = e.hold && this._st(e.hold)?.state === 'on';
        e.targets.forEach((t, n) => {
          const key = `${s.id}-${n + 1}`;
          const on = this._st(t.active)?.state === 'on';
          const x = this._mm(t.x), y = this._mm(t.y);
          const live = on && x != null && y != null && !(x === 0 && y === 0);
          if (!live) return;
          const pos = this._devToRoom(s, eff, [x, y]);
          out.push({ key, i, n, pos, range: Math.hypot(x, y), held: holding, color: s.color || DOT_COLORS[i % DOT_COLORS.length] });
        });
      });
      // Same person seen by two sensors: keep the reading from the sensor that is closer (LD2450 accuracy drops with range).
      const keep = [];
      for (const t of out.sort((a, b) => a.range - b.range)) {
        if (keep.some((k) => k.i !== t.i && Math.hypot(k.pos[0] - t.pos[0], k.pos[1] - t.pos[1]) < 700)) continue;
        keep.push(t);
      }
      return keep;
    }

    _zones() {
      const list = [];
      let ci = 0;
      this._config.sensors.forEach((s, i) => {
        const e = this._ids[i], eff = this._eff(i), ov = s.zones || {};
        for (const z of e.zones) {
          const o = ov[z.slot] || ov[Number(z.slot)] || {};
          if (o.hide) continue;
          if (z.kind === 'excl' && !(s.show_exclusions || o.show)) continue;
          const st = this._st(z.poly);
          const dev = parsePoly(st && st.state);
          if (!dev) continue;
          const named = (ent, tail) => {
            const f = (ent && ent.attributes.friendly_name) || '';
            return !f || /everything presence/i.test(f) ? '' : f.replace(tail, '').trim();
          };
          const fallback = z.kind === 'zone' ? `Zone ${z.n}` : z.kind === 'entry' ? `Entry ${z.n}` : `Exclusion ${z.n}`;
          const name = o.name || named(st, /\s*polygon\s*$/i) || (z.count && named(this._st(z.count), /\s*target count\s*$/i)) || fallback;
          const color = o.color || (z.kind === 'zone' ? ZONE_COLORS[ci++ % ZONE_COLORS.length] : z.kind === 'entry' ? '#fbbf24' : '#f87171');
          const room = dev.map((p) => this._devToRoom(s, eff, p));
          const count = z.count ? num(this._st(z.count)?.state) : null;
          const occ = z.occ ? this._st(z.occ) : null;
          list.push({ ...z, key: `${s.id}-${z.slot}`, name, color, room, count, occ });
        }
      });
      return list;
    }

    /* ---------- rendering ---------- */
    _html() {
      const cfg = this._config;
      const walls = this._walls();
      const zones = this._zones();
      const targets = this._targets();
      const now = Date.now();

      // Bounds of everything room-side, in view coordinates.
      const pts = walls.length ? walls.map((p) => this._v(p)) : zones.flatMap((z) => z.room.map((p) => this._v(p)));
      for (const g of this._doorGeos(walls)) if (g.sgn < 0) pts.push(this._v([g.e0[0] - g.nx * g.w, g.e0[1] - g.ny * g.w]), this._v([g.e1[0] - g.nx * g.w, g.e1[1] - g.ny * g.w]));
      if (!pts.length) return `<div class="card"><div class="hd"><div class="ttl">${esc(cfg.title || 'Presence')}</div></div><div class="empty">Add room walls or zones to draw the plan.</div></div>`;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const pad = 260;
      const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
      const W = Math.max(...xs) - Math.min(...xs) + pad * 2, H = Math.max(...ys) - Math.min(...ys) + pad * 2;
      const k = Math.max(W, H) / 420;            // ≈ mm per screen px at a typical card width
      const P = (p) => { const q = this._v(p); return `${f1(q[0])},${f1(q[1])}`; };
      const path = (poly) => `M${poly.map(P).join('L')}Z`;

      // Trails: remember recent positions per target.
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

      const roomPath = walls.length >= 3 ? path(walls) : '';
      const grid = [];
      if (roomPath) {
        for (let gx = Math.ceil(minX / 1000) * 1000; gx < minX + W; gx += 1000) grid.push(`M${gx},${f1(minY)}V${f1(minY + H)}`);
        for (let gy = Math.ceil(minY / 1000) * 1000; gy < minY + H; gy += 1000) grid.push(`M${f1(minX)},${gy}H${f1(minX + W)}`);
      }

      // Coverage wedges (±60°, sensor max distance).
      // The sensor's physical aim is the app's placement rotation alone (as the Presence app draws it); the
      // installation angle only corrects the radar's reported coordinates, so it is not part of the wedge.
      const wedges = this._config.sensors.map((s, i) => {
        const eff = Number(s.rotation) || 0;
        const r = this._mm(this._ids[i].range) || 6000;
        const steps = 24, arc = [];
        for (let j = 0; j <= steps; j++) {
          const a = ((-60 + (120 * j) / steps) * Math.PI) / 180;
          arc.push(this._devToRoom(s, eff, [Math.sin(a) * r, Math.cos(a) * r]));
        }
        const o = [Number(s.x) || 0, Number(s.y) || 0];
        const ov = this._v(o);
        const col = s.color || '#a78bfa';
        return `<radialGradient id="cov${i}" gradientUnits="userSpaceOnUse" cx="${f1(ov[0])}" cy="${f1(ov[1])}" r="${r}"><stop offset="0" stop-color="${col}" stop-opacity=".16"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>
          <path class="cov" d="${path([o, ...arc])}" fill="url(#cov${i})"/>`;
      });

      const devices = this._config.sensors.map((s, i) => {
        const o = this._v([Number(s.x) || 0, Number(s.y) || 0]);
        const fwd = this._devToRoom(s, Number(s.rotation) || 0, [0, 1]);
        const fv = this._v(fwd);
        const ang = (Math.atan2(fv[1] - o[1], fv[0] - o[0]) * 180) / Math.PI - 90;
        const sz = 9 * k, col = s.color || '#a78bfa';
        return `<g class="dev" transform="translate(${f1(o[0])} ${f1(o[1])}) rotate(${f1(ang)})">
          <rect x="${f1(-sz)}" y="${f1(-sz * 0.55)}" width="${f1(sz * 2)}" height="${f1(sz * 1.1)}" rx="${f1(sz * 0.35)}" fill="#0f1115" stroke="${col}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
          <circle cx="0" cy="${f1(sz * 0.55)}" r="${f1(sz * 0.32)}" fill="${col}"/></g>`;
      });

      const dotsV = targets.map((t) => this._v(t.pos));
      const zoneSvg = zones.map((z) => {
        const lit = z.kind === 'zone' && ((z.count != null && z.count > 0) || (z.count == null && z.occ && z.occ.state === 'on'));
        const cls = `zn ${z.kind}${lit ? ' lit' : ''}`;
        let label = '';
        if (z.kind !== 'excl') {
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
          label = `<text class="zl ${z.kind}${lit ? ' lit' : ''}" x="${f1(at[0])}" y="${f1(at[1])}" font-size="${f1(fs)}" style="--zc:${z.color}">${esc(z.name.toUpperCase())}</text>`;
        }
        return { shape: `<path class="${cls}" d="${path(z.room)}" style="--zc:${z.color}" vector-effect="non-scaling-stroke"/>`, label };
      });

      const doors = this._doors(walls);
      const furniture = this._furniture(k);

      const trailSvg = Object.entries(this._trails).map(([key, tr]) => {
        if (tr.length < 2) return '';
        const col = (targets.find((t) => t.key === key) || {}).color || '#e5e7eb';
        return tr.slice(1).map((s, j) => {
          const a = tr[j], age = (now - s.t) / TRAIL_MS;
          return `<line class="trl" x1="${P(a.p).split(',')[0]}" y1="${P(a.p).split(',')[1]}" x2="${P(s.p).split(',')[0]}" y2="${P(s.p).split(',')[1]}" stroke="${col}" stroke-opacity="${f1(Math.max(0, 0.55 * (1 - age)) * 100) / 100}" stroke-width="${f1(2.5 * (1 - age * 0.6))}" vector-effect="non-scaling-stroke"/>`;
        }).join('');
      }).join('');

      // One node per target slot so the dot glides (CSS transition) instead of being recreated.
      const dotSvg = this._config.sensors.flatMap((s, i) => [1, 2, 3].map((n) => {
        const key = `${s.id}-${n}`;
        const t = targets.find((x) => x.key === key);
        const r = 7.5 * k;
        if (!t) {
          const e = this._ids[i];
          const holding = n === 1 && e.hold && this._st(e.hold)?.state === 'on';
          let hp = holding && this._last[key] ? this._last[key].p : null;
          if (holding && !hp) {                                   // page opened mid-hold: use the sensor's own last position
            const lx = this._mm(e.last[0]), ly = this._mm(e.last[1]);
            if (lx != null && ly != null) hp = this._devToRoom(s, this._eff(i), [lx, ly]);
          }
          if (hp) {
            const q = this._v(hp);
            return `<g class="dot held" style="transform:translate(${f1(q[0])}px,${f1(q[1])}px)"><circle class="ring" r="${f1(r * 1.25)}" stroke="${s.color || '#e5e7eb'}" vector-effect="non-scaling-stroke"/></g>`;
          }
          return `<g class="dot off" style="transform:translate(${f1(this._last[key] ? this._v(this._last[key].p)[0] : 0)}px,${f1(this._last[key] ? this._v(this._last[key].p)[1] : 0)}px)"></g>`;
        }
        const q = this._v(t.pos);
        return `<g class="dot${t.held ? ' heldlive' : ''}" style="transform:translate(${f1(q[0])}px,${f1(q[1])}px);--dc:${t.color}">
          <circle class="halo" r="${f1(r * 2.6)}" fill="${t.color}"/>
          <circle class="core" r="${f1(r)}" fill="${t.color}" stroke="#0b0c10" stroke-width="2" vector-effect="non-scaling-stroke"/></g>`;
      })).join('');

      // Header status.
      const people = targets.length;
      const holding = this._ids.some((e) => e.hold && this._st(e.hold)?.state === 'on');
      const litZones = zones.filter((z) => z.kind === 'zone' && z.count > 0).map((z) => z.name);
      const meta = people
        ? `${people === 1 ? '1 person' : `${people} people`}${litZones.length ? ` · ${litZones.slice(0, 2).join(', ')}` : holding ? ' · holding' : ''}`
        : holding ? 'Holding · sitting still' : 'Empty';
      const offline = this._ids.some((e) => e.targets.every((t) => !this._st(t.x) || ['unavailable', 'unknown'].includes(this._st(t.x).state)));

      const chips = zones.filter((z) => z.kind === 'zone').map((z) => {
        const here = z.count != null && z.count > 0;
        const occOn = z.occ && z.occ.state === 'on';
        const state = here ? (z.count > 1 ? `${z.count} here` : 'Here') : occOn ? 'Clearing…' : z.occ && z.occ.last_changed ? `Clear · ${ago(z.occ.last_changed).replace(/^since /, '')}` : 'Clear';
        return `<button class="chip${here ? ' on' : occOn ? ' warm' : ''}" data-ent="${esc((z.occ && z.occ.entity_id) || '')}" style="--zc:${z.color}">
          <span class="cd"></span><span class="cn">${esc(z.name)}</span><span class="cs">${esc(state)}</span></button>`;
      }).join('');

      const mh = Number(cfg.max_height) || 460;
      return `<div class="card">
        <div class="hd"><ha-icon icon="mdi:radar" class="hi${people ? ' live' : ''}"></ha-icon><div class="ttl">${esc(cfg.title || 'Presence')}</div>
          <div class="meta${holding && !litZones.length ? ' hold' : people ? ' live' : ''}">${esc(meta)}</div></div>
        <div class="plan" style="--mh:${mh}px">
          <svg viewBox="${f1(minX)} ${f1(minY)} ${f1(W)} ${f1(H)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(cfg.title || 'Presence')}: ${esc(meta)}">
            <defs>
              ${roomPath ? `<clipPath id="room"><path d="${roomPath}"/></clipPath>` : ''}
              <pattern id="hatch" width="${f1(14 * k)}" height="${f1(14 * k)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="${f1(14 * k)}" stroke="#f87171" stroke-opacity=".25" stroke-width="${f1(2 * k)}"/></pattern>
            </defs>
            ${roomPath ? `<path class="floor" d="${roomPath}"/>` : ''}
            <g ${roomPath ? 'clip-path="url(#room)"' : ''}>
              <path class="grid" d="${grid.join('')}" vector-effect="non-scaling-stroke"/>
              ${wedges.join('')}
              ${furniture}
              ${zoneSvg.map((z) => z.shape).join('')}
            </g>
            ${roomPath ? `<path class="wall" d="${roomPath}" vector-effect="non-scaling-stroke"/>` : ''}
            ${doors}
            ${zoneSvg.map((z) => z.label).join('')}
            ${devices.join('')}
            <g class="trails">${trailSvg}</g>
            ${dotSvg}
          </svg>
        </div>
        ${chips ? `<div class="chips">${chips}</div>` : ''}
        ${offline ? '<div class="fine"><ha-icon icon="mdi:wifi-off"></ha-icon>A sensor is offline — its dots and zones will be missing.</div>' : ''}
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

    _furniture(k) {
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
        } else if (t.includes('tv')) {
          inner = `<line class="tv" x1="${f1(-w * 0.42)}" y1="${f1(-d / 2 + d * 0.18)}" x2="${f1(w * 0.42)}" y2="${f1(-d / 2 + d * 0.18)}" vector-effect="non-scaling-stroke"/>`;
        }
        return `<g class="fur" transform="translate(${f1(c[0])} ${f1(c[1])}) rotate(${f1(rot)})">${box('fo', -w / 2, -d / 2, w, d, rx)}${inner}</g>`;
      }).join('');
    }

    _wire() {
      this.shadowRoot.addEventListener('click', (ev) => {
        const b = ev.target.closest('.chip');
        if (b && b.dataset.ent) moreInfo(this, b.dataset.ent);
      });
    }

    _css() {
      return `
.hd { margin-bottom:12px; }
.hi { color:#6b7280; --mdc-icon-size:18px; transition:color .3s; }
.hi.live { color:#a78bfa; }
.meta.live { color:#e9d5ff; }
.meta.hold { color:#fbbf24; }
.plan { position:relative; border-radius:20px; background:rgba(0,0,0,0.22); border:1px solid rgba(255,255,255,0.05); padding:6px; }
.plan svg { display:block; width:100%; height:auto; max-height:var(--mh); margin:0 auto; overflow:visible; }
.floor { fill:rgba(255,255,255,0.025); }
.grid { stroke:rgba(255,255,255,0.045); stroke-width:1; fill:none; }
.wall { fill:none; stroke:#6b7280; stroke-width:3; stroke-linejoin:round; }
.gap { stroke:#15171c; stroke-width:5; stroke-linecap:butt; }
.door { fill:none; stroke:rgba(255,255,255,0.28); stroke-width:1; stroke-dasharray:3 3; }
.fur .fo { fill:rgba(255,255,255,0.045); stroke:rgba(255,255,255,0.13); stroke-width:1; }
.fur .fb { fill:rgba(255,255,255,0.05); stroke:rgba(255,255,255,0.1); stroke-width:1; }
.fur .fl { stroke:rgba(255,255,255,0.1); stroke-width:1; }
.fur .tv { stroke:#94a3b8; stroke-width:2.5; stroke-linecap:round; }
.cov { pointer-events:none; }
.zn { fill:color-mix(in srgb, var(--zc) 9%, transparent); stroke:color-mix(in srgb, var(--zc) 55%, transparent); stroke-width:1.5; stroke-linejoin:round; transition:fill .35s, stroke .35s, filter .35s; }
.zn.lit { fill:color-mix(in srgb, var(--zc) 26%, transparent); stroke:var(--zc); stroke-width:2; filter:drop-shadow(0 0 6px color-mix(in srgb, var(--zc) 70%, transparent)); }
.zn.entry { fill:color-mix(in srgb, var(--zc) 5%, transparent); stroke-dasharray:5 4; stroke-width:1.2; stroke:color-mix(in srgb, var(--zc) 60%, transparent); }
.zn.excl { fill:url(#hatch); stroke:rgba(248,113,113,0.3); stroke-width:1; stroke-dasharray:2 4; }
.zl { fill:color-mix(in srgb, var(--zc) 70%, #9aa0aa); font-weight:700; letter-spacing:.12em; text-anchor:middle; dominant-baseline:middle; paint-order:stroke; stroke:#121418; stroke-width:3px; stroke-linejoin:round; opacity:.85; transition:fill .35s, opacity .35s; font-family:var(--ha-font-family-body, Roboto, sans-serif); pointer-events:none; }
.zl.entry { fill:#a1876a; font-weight:600; opacity:.7; }
.zl.lit { fill:#fff; opacity:1; }
.dot { transition:transform .32s linear, opacity .4s; }
.dot.off { opacity:0; }
.dot .halo { opacity:.18; animation:breathe 2.4s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
.dot .core { filter:drop-shadow(0 0 4px var(--dc)); }
.dot.heldlive .core { opacity:.55; }
.dot.held .ring { fill:none; stroke-width:2; stroke-dasharray:4 3; opacity:.75; animation:hold 1.8s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
.trl { stroke-linecap:round; }
.chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.chip { display:inline-flex; align-items:center; gap:8px; padding:8px 12px 8px 10px; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); font-size:13px; transition:background .3s, border-color .3s; touch-action:manipulation; min-width:0; }
.chip .cd { width:8px; height:8px; border-radius:50%; background:color-mix(in srgb, var(--zc) 35%, #374151); flex:none; transition:all .3s; }
.chip .cn { font-weight:600; color:#cbd5e1; white-space:nowrap; }
.chip .cs { color:#7c838e; font-size:12px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.chip.on { background:color-mix(in srgb, var(--zc) 14%, rgba(255,255,255,0.03)); border-color:color-mix(in srgb, var(--zc) 45%, transparent); }
.chip.on .cd { background:var(--zc); box-shadow:0 0 10px var(--zc); }
.chip.on .cs { color:color-mix(in srgb, var(--zc) 60%, #fff); }
.chip.warm .cd { background:color-mix(in srgb, var(--zc) 60%, #374151); }
.fine { display:flex; align-items:center; gap:8px; margin-top:10px; font-size:12px; color:#6b7280; }
.fine ha-icon { --mdc-icon-size:15px; }
@keyframes breathe { 0%,100% { transform:scale(.85); opacity:.12; } 50% { transform:scale(1.1); opacity:.24; } }
@keyframes hold { 0%,100% { transform:scale(.9); opacity:.45; } 50% { transform:scale(1.15); opacity:.9; } }
@media (prefers-reduced-motion: reduce) { .dot { transition:none; } }`;
    }
  }

  if (!customElements.get('linwood-presence-card')) customElements.define('linwood-presence-card', LinwoodPresenceCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.find((c) => c.type === 'linwood-presence-card')) window.customCards.push({ type: 'linwood-presence-card', name: 'Linwood Presence Card', description: 'Live floor plan for Everything Presence radar sensors: room, zones and a dot for each person', preview: false });
})();
