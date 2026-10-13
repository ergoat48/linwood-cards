/* Linwood Plant Card v3.6.0 — illustrated plant-care tracker for the Plant Care page.
 * v3.6.0: watering log for soil plants. A plant with `watering:` gets a Watering row — Watered, Still moist, log
 *         another date (10 s undo), how long since the last watering and a strip of the days between recent
 *         waterings. Once `learn` gaps are logged (default 3, so 4 waterings) the plant's typical dry-down time is the
 *         median of its last `window` gaps (6); its check-soil day is typical × `factor` (0.85), and it is "Probably
 *         dry" a day past typical. Until then it shows "Learning n/4" and the care guide's `check` cadence. Dates are
 *         kept in an input_text log written by script.plant_log_watering (HA history only reaches back ~10 days);
 *         "Still moist" stamps an input_datetime and snoozes the plant for `recheck` days. Same rules as the "Plant
 *         watering reminders" automation. Learned plants that are due count in the header, the Needs-you chips and
 *         the sidebar badge. The humidifier popup now stays inside the iPhone safe area (status bar / home indicator),
 *         so the separate Safe Area add-on stands down.
 * v3.5.4: redrawn Monstera (heart-shaped leaves with splits and holes, held out on arching petioles, one new uncut leaf)
 *         and Lemon Lime (two woody canes rising out of the pot, crowned with arching striped leaves).
 * v3.5.3: history range switch gains a 3 h view (hourly ticks).
 * v3.5.2: humidifier popup shows when the humidity and temperature readings last reported ("Reported 3 min ago"),
 *         amber after `stale_minutes` (default 120) or when the sensor is offline.
 * v3.5.0: tapping a plant's humidifier row opens a popup: live humidity + temperature, a big On/Off button, an Auto
 *         switch (the humidifier automation) and 24 h / 3 day / 7 day history charts — target band, shaded spans where
 *         the humidifier ran, hover/drag readout, total run time, share of time humid enough. humidifier keys added:
 *         temperature, automation, temp_low / temp_high, history_humidity, since + since_label (dims readings taken
 *         before the sensor was moved to the plant).
 * v3.4.0: several grow lights. Each lit plant names its light (`light:`) and gets a live light row (on / off / offline,
 *         wattage, estimated brightness vs. its target, height above the plant); its beam and pill follow that light only.
 *         Plants that just moved under a light show "Settling in" for `settle_days` (from a `moved` input_datetime) and
 *         aren't due for food until then. Optional humidifier row per plant. Adds custom:linwood-grow-lights-card.
 * v3.3.0: standardized Care guide in the drawer — three tappable labels (soil dry before watering · light level ·
 *         tap-water sensitivity 1–5, each with its explanation) and the same six steps for every plant
 *         (Water · Light · Climate · Feeding · Grooming · Watch for). Optional `hold` text for a paused feeding.
 * v3.2.0: re-renders patch the DOM in place (LinwoodMorph) instead of replacing it — fixes the iOS jump-to-top on tap.
 * One tile per plant: a drawing of the actual plant (from Ethan's photos) under its grow light or window light,
 * feeding countdown ring, last/next feed, dose, location switch, fresh-water tracking for water-kept plants,
 * quick logging (Feed now / Yesterday / pick a date, 10 s undo) and per-plant care guide.
 * Schedules are season- and location-aware and match the "Plant care reminders" automation.
 *
 * type: custom:linwood-plant-card
 * title: Plant care
 * growing_months: [3, 4, 5, 6, 7, 8, 9]
 * lit_locations: [Mantel]
 * settle_days: 14                                 # no feeding for this long after a plant moves under a light
 * water_learning:                                 # optional; these are the defaults
 *   script: script.plant_log_watering             # adds / removes one date in a plant's watering log
 *   learn: 3                                      # gaps needed before the plant's own rhythm is used
 *   window: 6                                     # most recent gaps the median is taken over
 *   factor: 0.85                                  # check-soil day = typical × factor
 *   recheck: 2                                    # days "Still moist" snoozes a plant
 * grow_lights:                                    # (or the old single `grow_light: switch.x`)
 *   - id: left
 *     entity: switch.living_room_mantle_left_grow_light
 *     name: Left bar
 *     power: sensor.living_room_mantle_left_grow_light_power   # optional: wattage → estimated brightness
 *     target: input_select.mantel_left_bar_brightness         # optional: 25% / 50% / 75% / 100%
 *     full_watts: 35                                          # draw at 100 %
 *     height: 36                                              # light face, inches above the shelf
 *     note: Own light beside the mantel                       # shown when there is no height
 * plants:
 *   - entity: input_datetime.plant_fed_monstera        # last feeding (a date before 2001 = never)
 *     location: input_select.plant_location_monstera  # optional
 *     light: left                                     # which grow light it sits under when its location is lit
 *     top: 25                                         # optional: plant top above the shelf (inches, riser included)
 *     riser: 4                                        # optional
 *     moved: input_datetime.plant_moved_monstera      # optional: date it last moved (starts the settle period)
 *     humidifier: { entity: switch.humidifier, power: sensor.humidifier_power, humidity: sensor.x, low: 55, high: 60 }
 *     watering:                                       # optional, soil plants: learn the watering rhythm
 *       log: input_text.plant_water_log_monstera      #   comma-separated YYYY-MM-DD dates, oldest first
 *       checked: input_datetime.plant_soil_checked_monstera   # "Still moist" date (date-only)
 *       check: 7                                      #   care-guide check cadence (days) used while learning
 *     name: Monstera
 *     species: Monstera deliciosa
 *     art: monstera            # monstera | starlight | rubber | lemonlime | calathea | peacelily (else icon)
 *     color: '#22c55e'
 *     dose: ¼ tsp per 1.5 L
 *     every: { growing: 21, lit: 35, rest: 60 }        # days; 0 = no feeding
 *     hold: Feed after potting                          # optional: shown instead of "Paused" when every = 0
 *     water: { entity: input_datetime.plant_water_changed_x, every: 7 }   # optional: water changes for water-kept plants
 *     guide:
 *       dry:   { pct: 33, label: Top ⅓, sub: ≈ 2–3 in, tip: '…', rest: { pct: 50, label: Top ½, sub: '…', tip: '…' } }
 *              # or { mode: water, label: In water, sub: '…', tip: '…' } for plants kept in water
 *       light: { level: 3, label: Bright indirect, note: '…' }     # 1 low · 2 medium · 3 bright indirect · 4 bright + some sun
 *       tap:   { score: 5, note: '…' }                            # 1 tap is fine … 5 distilled / RO / rain only
 *       steps: { water: '…', light: '…', climate: '…', feed: '…', groom: '…', watch: '…' }
 *     care: [ 'Short tip' ]     # legacy list, used only when there is no guide
 * Also exposes window.LinwoodPlantSummary(hass) → { due, overdue, total } for the Linwood sidebar.
 *
 * type: custom:linwood-grow-lights-card               # every grow light in one panel: schedule bar, toggles, watts, brightness
 * title: Grow lights
 * schedule: automation.living_room_grow_light_schedule   # optional: Auto / Paused chip (tap twice to change)
 * on_hour: 8
 * off_hour: 20
 * lights: [ { entity, name, power, target, full_watts, height, note, plants: 'Starlight Ficus · Rubber Plant' } ]
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
(() => {
/* ---------- plant illustrations — drawn from Ethan's photos (viewBox 0 0 240 200, ground y=188) ---------- */
const lpcRand = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const f1 = (n) => Math.round(n * 10) / 10;
/* point + unit normal on a quadratic Bézier (for leaves drawn along a curved spine) */
const lpcQ = (p0, p1, p2, t) => {
  const u = 1 - t;
  const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
  let dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
  const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  return { x, y, nx: -dy, ny: dx };
};

/* white ribbed ceramic planter (rubber plant & lemon lime) */
const lpcRibbed = (id, cx, top, w, h) => {
  const b = w * 0.84, ribs = [];
  for (let i = 1; i < 12; i++) { const t = i / 12; ribs.push(`<path d="M${f1(cx - w / 2 + w * t)} ${top + 6} L${f1(cx - b / 2 + b * t)} ${top + h - 2}"/>`); }
  return `<defs><linearGradient id="${id}-rb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9bcc2"/><stop offset=".35" stop-color="#f8f8f6"/><stop offset=".7" stop-color="#e7e7e3"/><stop offset="1" stop-color="#a6a9ae"/></linearGradient></defs>
<path d="M${f1(cx - w / 2)} ${top} L${f1(cx + w / 2)} ${top} L${f1(cx + b / 2)} ${top + h - 3} Q${f1(cx + b / 2)} ${top + h} ${f1(cx + b / 2 - 3)} ${top + h} L${f1(cx - b / 2 + 3)} ${top + h} Q${f1(cx - b / 2)} ${top + h} ${f1(cx - b / 2)} ${top + h - 3} Z" fill="url(#${id}-rb)"/>
<g stroke="#9ca3af" stroke-width=".8" stroke-opacity=".55">${ribs.join('')}</g>
<ellipse cx="${cx}" cy="${top + 0.5}" rx="${f1(w / 2)}" ry="3" fill="#f4f4f2"/><ellipse cx="${cx}" cy="${top + 1}" rx="${f1(w / 2 - 3)}" ry="2.2" fill="#2b1d14"/>`;
};

const LPC_ART = {
  /* Monstera deliciosa (no photo yet) — heart-shaped leaves with deep side splits running out along the veins and a
     row of holes beside the midrib, each held out on a long arching petiole and tipped at the leaf joint; one new,
     uncut leaf in the middle; terracotta pot */
  monstera: () => {
    /* leaf drawn pointing up: joins its petiole at the sinus (0,0), tip at (0,-100) */
    const outline = 'M0 -2 C10 5 28 11 40 2 C54 -9 55 -38 47 -60 C39 -82 18 -97 0 -101 C-18 -97 -39 -82 -47 -60 C-55 -38 -54 -9 -40 2 C-28 11 -10 5 0 -2Z';
    /* splits: a wedge from near the midrib out past the margin, curving toward the tip like the veins */
    const slit = (y, s, reach, w) => {
      const x0 = s * 12, x1 = s * 64, y1 = y - reach, cx = s * 36, cy = y - reach * 0.25;
      return `<path d="M${x0} ${y} Q${cx} ${f1(cy - w * 0.3)} ${x1} ${f1(y1 - w)} L${x1} ${f1(y1 + w)} Q${cx} ${f1(cy + w * 0.5)} ${x0} ${y}Z"/>`;
    };
    const slits = [[-8, 14, 4.2], [-25, 20, 4.6], [-42, 22, 4.6], [-58, 22, 4.2], [-73, 20, 3.6]];
    const holes = [[-14, 2.2, 4.6], [-31, 2.4, 5], [-48, 2.2, 4.6], [-64, 1.8, 3.6]];
    const cuts = slits.map(([y, r, w]) => slit(y, -1, r, w) + slit(y, 1, r, w)).join('')
      + holes.map(([y, rx, ry]) => `<ellipse cx="-9" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(-38 -9 ${y})"/><ellipse cx="9" cy="${y - 2}" rx="${rx}" ry="${ry}" transform="rotate(38 9 ${y - 2})"/>`).join('');
    const veins = slits.map(([y, r]) => {
      const yy = y - 8;
      return `<path d="M0 ${yy + 4} Q-22 ${f1(yy - r * 0.2)} -40 ${f1(yy - r * 0.7)} M0 ${yy + 4} Q22 ${f1(yy - r * 0.2)} 40 ${f1(yy - r * 0.7)}"/>`;
    }).join('');
    const defs = `<defs>
<linearGradient id="lpm-g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#14532d"/><stop offset=".55" stop-color="#1c7a3c"/><stop offset="1" stop-color="#2f9e50"/></linearGradient>
<linearGradient id="lpm-y" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2f8a3c"/><stop offset="1" stop-color="#7fd07a"/></linearGradient>
<linearGradient id="lpm-st" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f6b2c"/><stop offset=".5" stop-color="#5a9a46"/><stop offset="1" stop-color="#2f6b2c"/></linearGradient>
<linearGradient id="lpm-pot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7c2d12"/><stop offset=".38" stop-color="#c2410c"/><stop offset=".62" stop-color="#b4400f"/><stop offset="1" stop-color="#6b260f"/></linearGradient>
<clipPath id="lpm-clip"><path d="${outline}"/></clipPath>
<mask id="lpm-cut" maskUnits="userSpaceOnUse" x="-70" y="-110" width="140" height="125"><rect x="-70" y="-110" width="140" height="125" fill="#fff"/><g fill="#000">${cuts}</g></mask>
<g id="lpm-leaf"><path d="${outline}" mask="url(#lpm-cut)" fill="url(#lpm-g)"/>
<g clip-path="url(#lpm-clip)"><g mask="url(#lpm-cut)" fill="none" stroke="#7fcf8a" stroke-opacity=".28" stroke-width="1.1" stroke-linecap="round">${veins}</g>
<path d="M0 -1 Q1 -50 0 -96" fill="none" stroke="#a7e3a4" stroke-opacity=".7" stroke-width="2"/>
<path d="M-30 -30 Q-36 -58 -18 -82" mask="url(#lpm-cut)" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="5" stroke-linecap="round"/></g></g>
<g id="lpm-young"><path d="${outline}" fill="url(#lpm-y)"/>
<path d="M0 -1 L0 -94" stroke="#d9f7c9" stroke-opacity=".7" stroke-width="2"/><path d="M-20 -26 Q-26 -50 -12 -76" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="5" stroke-linecap="round"/></g>
</defs>`;
    /* petiole from the soil to the leaf joint, then the leaf */
    const leaf = ([ax, ay], [cx, cy], rot, s, sx, id, bx) => `<path d="M${120 + bx} 147 Q${cx} ${cy} ${ax} ${ay}" fill="none" stroke="url(#lpm-st)" stroke-width="${f1(2.2 + s * 1.6)}" stroke-linecap="round"/>
<ellipse cx="${ax}" cy="${ay}" rx="${f1(1.6 + s * 1.4)}" ry="${f1(2.4 + s * 1.6)}" fill="#5f9c48" transform="rotate(${rot} ${ax} ${ay})"/>
<use href="#${id}" transform="translate(${ax} ${ay}) rotate(${rot}) scale(${f1(s * sx)} ${s})"/>`;
    const plant = [
      leaf([152, 54], [134, 92], 38, 0.5, 0.82, 'lpm-leaf', 3),        // back right, high, turned away a little
      leaf([92, 62], [110, 98], -46, 0.5, 0.8, 'lpm-leaf', -3),         // back left, high
      leaf([64, 104], [84, 96], -112, 0.56, 1, 'lpm-leaf', -5),          // big left, tipped out and down
      leaf([178, 98], [158, 92], 108, 0.58, 1, 'lpm-leaf', 5),           // big right
      leaf([124, 64], [116, 104], 10, 0.33, 0.92, 'lpm-young', 1),       // new leaf, not split yet
      leaf([92, 132], [100, 128], -148, 0.42, 0.8, 'lpm-leaf', -4),      // low front left, hanging over the rim
      leaf([150, 128], [140, 124], 150, 0.44, 0.75, 'lpm-leaf', 4),      // low front right
    ].join('\n');
    const pot = `<path d="M92 156 L148 156 L142 186 Q141 188 138 188 L102 188 Q99 188 98 186 Z" fill="url(#lpm-pot)"/>
<rect x="88" y="147" width="64" height="10" rx="3" fill="#b45309"/><rect x="88" y="155" width="64" height="2" fill="#7c2d12" opacity=".5"/>
<ellipse cx="120" cy="148" rx="30" ry="2.6" fill="#3b2314"/>`;
    return `${defs}${pot}<g class="sway">${plant}</g>`;
  },

  /* Ficus benjamina 'Starlight' — tall single-stem column, glossy leaves with irregular cream margins,
     bamboo stake, grey speckled planter on a natural-wood base */
  starlight: () => {
    const r = lpcRand(21), back = [], front = [];
    for (let i = 0; i < 72; i++) {
      const y = 20 + Math.pow(r(), 0.75) * 128;
      const spread = 12 + ((y - 20) / 128) * 50;
      const side = r() < 0.5 ? -1 : 1;
      const x = 120 + side * (4 + r() * spread);
      const droop = side * (92 + r() * 58) + (y > 118 ? side * 14 : 0);
      const s = f1(1.15 + r() * 0.45);
      const el = `<use href="#lps-leaf${r() < 0.5 ? 'b' : ''}" transform="translate(${f1(x)} ${f1(y)}) rotate(${Math.round(droop)}) scale(${s})"/>`;
      (r() < 0.4 ? back : front).push(el);
    }
    const speck = Array.from({ length: 26 }, () => `<circle cx="${f1(94 + r() * 52)}" cy="${f1(150 + r() * 28)}" r="${f1(0.5 + r() * 0.6)}"/>`).join('');
    return `<defs><g id="lps-leaf"><path d="M0 0 C5.6 -3.6 6.8 -12 0 -21 C-6.8 -12 -5.6 -3.6 0 0Z" fill="#e6e8a8"/><path d="M0 -.8 C4.6 -4.6 4.4 -9 3 -11.6 C4.4 -14 1.6 -17 0 -19.4 C-3 -16.4 -2.2 -14 -4.2 -11.8 C-5 -8.4 -3.8 -3.6 0 -.8Z" fill="#355f28"/><path d="M0 -1 L0 -19" stroke="#b9cf86" stroke-width=".6"/></g>
<g id="lps-leafb"><path d="M0 0 C5.6 -3.6 6.8 -12 0 -21 C-6.8 -12 -5.6 -3.6 0 0Z" fill="#dfe39a"/><path d="M0 -.8 C3.6 -3.4 5 -7.6 3.4 -10.4 C5.2 -13.8 2 -16.4 0 -19.6 C-2.4 -17 -4.6 -14.4 -3.4 -11.2 C-5.6 -8.4 -3.4 -3.8 0 -.8Z" fill="#2f5524"/><path d="M0 -1 L0 -19" stroke="#b9cf86" stroke-width=".6"/></g>
<linearGradient id="lps-pot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7b7a77"/><stop offset=".4" stop-color="#b3b1ad"/><stop offset=".75" stop-color="#9d9b97"/><stop offset="1" stop-color="#6e6d6a"/></linearGradient>
<linearGradient id="lps-wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9824d"/><stop offset=".5" stop-color="#e2b07a"/><stop offset="1" stop-color="#b07a46"/></linearGradient></defs>
<path d="M104 182 L86 52" stroke="#3b2f25" stroke-width="2" stroke-linecap="round"/>
<g class="sway"><g opacity=".72">${back.join('')}</g>
<path d="M120 150 C118 120 124 90 119 60 C116 44 121 30 120 18" fill="none" stroke="#7b6248" stroke-width="2.6" stroke-linecap="round"/>
<g fill="none" stroke="#7b6248" stroke-width="1.1" stroke-linecap="round"><path d="M120 128 Q104 122 92 126"/><path d="M121 112 Q138 104 150 110"/><path d="M119 92 Q104 84 96 86"/><path d="M120 76 Q134 66 144 70"/><path d="M119 54 Q110 44 104 46"/><path d="M120 40 Q130 30 136 30"/></g>
${front.join('')}</g>
<path d="M92 148 L148 148 L147 180 L93 180 Z" fill="url(#lps-pot)"/><g fill="#e7e5e4" opacity=".5">${speck}</g>
<ellipse cx="120" cy="148" rx="28" ry="3.2" fill="#a8a6a2"/><ellipse cx="120" cy="148.6" rx="25" ry="2.3" fill="#2b1d14"/>
<path d="M94 180 L146 180 L144 188 L96 188 Z" fill="url(#lps-wood)"/>`;
  },

  /* Ficus elastica 'Ruby' — dark grey-green leaves mottled with sage, cream-to-blush margins,
     pink midribs, petioles and new-leaf sheath; white ribbed pot */
  rubber: () => {
    const r = lpcRand(9); let n = 0;
    const leaf = (x, y, rot, L, W) => {
      const id = `lpr-c${n++}`;
      const d = `M0 0 C${f1(-W)} ${f1(-L * 0.16)} ${f1(-W * 1.02)} ${f1(-L * 0.8)} 0 ${-L} C${f1(W * 1.02)} ${f1(-L * 0.8)} ${f1(W)} ${f1(-L * 0.16)} 0 0Z`;
      const mot = Array.from({ length: 7 }, () => { const cx = (r() - 0.5) * W * 1.1, cy = -L * (0.12 + r() * 0.75), w = 4 + r() * 7; return `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(w)}" ry="${f1(1.6 + r() * 2.2)}" transform="rotate(${Math.round((r() - 0.5) * 60)} ${f1(cx)} ${f1(cy)})"/>`; }).join('');
      const edge = Array.from({ length: 5 }, () => { const t = 0.15 + r() * 0.7, sd = r() < 0.5 ? -1 : 1; return `<ellipse cx="${f1(sd * W * 0.92 * Math.sin(Math.PI * t))}" cy="${f1(-L * t)}" rx="${f1(3 + r() * 4)}" ry="${f1(6 + r() * 8)}"/>`; }).join('');
      return `<g transform="translate(${x} ${y}) rotate(${rot})"><clipPath id="${id}"><path d="${d}"/></clipPath>
<path d="${d}" fill="url(#lpr-g)"/><g clip-path="url(#${id})"><g fill="#8fa48c" opacity=".55">${mot}</g><g fill="#e8c9b4" opacity=".9">${edge}</g><path d="${d}" fill="none" stroke="#e7a596" stroke-width="2.2"/></g>
<path d="M0 -1 L0 ${-L + 3}" stroke="#e98b86" stroke-width="1.3"/>
<path d="M${f1(-W * 0.4)} ${f1(-L * 0.3)} Q${f1(-W * 0.55)} ${f1(-L * 0.55)} ${f1(-W * 0.25)} ${f1(-L * 0.8)}" fill="none" stroke="#fff" stroke-width="1.6" stroke-opacity=".13" stroke-linecap="round"/></g>`;
    };
    return `<defs><linearGradient id="lpr-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f6552"/><stop offset=".55" stop-color="#33473a"/><stop offset="1" stop-color="#26332b"/></linearGradient></defs>
<g class="sway"><path d="M120 152 C119 124 122 92 121 34" fill="none" stroke="#a46f62" stroke-width="3.6" stroke-linecap="round"/>
<g stroke="#e58f88" stroke-width="1.8" fill="none" stroke-linecap="round"><path d="M120 140 Q110 138 102 134"/><path d="M121 124 Q132 121 140 116"/><path d="M121 104 Q112 100 106 94"/><path d="M121 84 Q130 80 136 74"/><path d="M121 64 Q115 60 112 54"/></g>
${leaf(102, 134, -66, 42, 19)}${leaf(140, 116, 58, 50, 22)}${leaf(106, 94, -40, 52, 22)}${leaf(136, 74, 30, 50, 21)}${leaf(112, 54, -14, 46, 19)}
<path d="M121 40 C117 30 118 16 122 6 C126 16 126 30 121 40Z" fill="#e8807c"/><path d="M122 8 L121 38" stroke="#fecdd3" stroke-width=".8" opacity=".7"/></g>
${lpcRibbed('lpr', 120, 152, 52, 36)}`;
  },

  /* Dracaena fragrans 'Lemon Lime' — two woody canes (leaf-scar rings) rising out of the pot, each crowned with a
     spiral of long arching straps: dark-green centre with grey-green pinstripes, a fine white stripe and a broad lime
     edge. The older, lower leaves splay out and droop at the tips; the newest stand upright. Small white ribbed pot */
  lemonlime: () => {
    const r = lpcRand(14);
    const strap = (bx, by, ang, L, W, droop) => {
      const a = (ang * Math.PI) / 180, dx = Math.sin(a), dy = -Math.cos(a);
      const p0 = [bx, by], p1 = [bx + dx * L * 0.55, by + dy * L * 0.55], p2 = [bx + dx * L, by + dy * L + droop];
      const N = 18, pts = [];
      for (let i = 0; i <= N; i++) { const t = i / N; pts.push({ t, ...lpcQ(p0, p1, p2, t) }); }
      const w = (t) => W * (0.5 + 0.5 * Math.min(1, t / 0.22)) * (1 - Math.pow(t, 2.4));
      const band = (k) => {
        const s1 = pts.map((p) => `${f1(p.x + p.nx * w(p.t) * k)} ${f1(p.y + p.ny * w(p.t) * k)}`);
        const s2 = pts.slice().reverse().map((p) => `${f1(p.x - p.nx * w(p.t) * k)} ${f1(p.y - p.ny * w(p.t) * k)}`);
        return `M${s1.join(' L')} L${s2.join(' L')}Z`;
      };
      const line = (k) => `M${pts.slice(1, N - 1).map((p) => `${f1(p.x + p.nx * w(p.t) * k)} ${f1(p.y + p.ny * w(p.t) * k)}`).join(' L')}`;
      return `<path d="${band(1)}" fill="#c6e43f"/><path d="${band(0.62)}" fill="#f3f4ea"/><path d="${band(0.5)}" fill="#29473a"/>
<path d="${line(0.22)} ${line(-0.22)}" fill="none" stroke="#98ae9c" stroke-width=".7"/>`;
    };
    const cane = (x0, top, lean, n, Lmin, Lmax) => {
      const y0 = 152, x1 = x0 + lean;
      const scars = Array.from({ length: Math.floor((y0 - top - 20) / 5) }, (_, i) => {
        const y = y0 - 4 - i * 5, x = x0 + (lean * (y0 - y)) / (y0 - top);
        return `<path d="M${f1(x - 2.6)} ${y} q2.6 1.4 5.2 0"/>`;
      }).join('');
      const stem = `<path d="M${x0 - 3} ${y0} L${f1(x1 - 2)} ${top + 4} Q${x1} ${top} ${f1(x1 + 2)} ${top + 4} L${x0 + 3} ${y0}Z" fill="url(#lpl-cane)"/>
<g fill="none" stroke="#5c4a36" stroke-width=".8" stroke-opacity=".7">${scars}</g>`;
      const leaves = [];
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);                                         // 0 = oldest (lowest), 1 = newest (top)
        const y = top + 22 * (1 - k) + 2, x = x1 + (lean * (top + 22 - y)) / 60;
        const side = i % 2 ? 1 : -1, spread = 14 + (1 - k) * 72;      // old leaves splay out, new ones stand up
        const ang = side * spread * (0.75 + r() * 0.35) + (r() - 0.5) * 10;
        const L = Lmin + (Lmax - Lmin) * (1 - Math.abs(k - 0.35)) + r() * 8, W = 5.8 + r() * 1.4;
        const droop = 3 + Math.pow(1 - k, 1.2) * (16 + r() * 16) * Math.min(1, Math.abs(ang) / 60);
        leaves.push({ z: r() < 0.5 ? 0 : 1, g: strap(x, y, ang, L, W, droop) });
      }
      return { stem, back: leaves.filter((l) => !l.z).map((l) => l.g).join(''), front: leaves.filter((l) => l.z).map((l) => l.g).join('') };
    };
    const a = cane(114, 90, -6, 13, 44, 62), b = cane(127, 112, 8, 9, 36, 50);
    return `<defs><linearGradient id="lpl-cane" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6b5841"/><stop offset=".45" stop-color="#b59f7c"/><stop offset="1" stop-color="#6b5841"/></linearGradient></defs>
<g class="sway">${a.back}${b.back}${a.stem}${b.stem}${b.front}${a.front}</g>${lpcRibbed('lpl', 120, 150, 46, 38)}`;
  },

  /* Calathea (Goeppertia) — broad leaves banded dark green and lime in feathered stripes,
     one burgundy-backed new leaf; black nursery pot on a white saucer */
  calathea: () => {
    let n = 0;
    const leaf = (bx, by, x, y, rot, s, under) => {
      const id = `lpc-c${n++}`;
      const d = 'M0 0 C-22 -6 -24 -36 0 -52 C24 -36 22 -6 0 0Z';
      const bands = Array.from({ length: 7 }, (_, i) => {
        const yy = -5 - i * 6.6;
        return `<path d="M0 ${f1(yy)} Q-12 ${f1(yy - 2)} -24 ${f1(yy - 11)}" stroke-width="${i % 2 ? 1.1 : 2}"/><path d="M0 ${f1(yy - 1)} Q12 ${f1(yy - 3)} 24 ${f1(yy - 12)}" stroke-width="${i % 2 ? 1.1 : 2}"/>`;
      }).join('');
      const body = under
        ? `<path d="${d}" fill="#7a3324"/><clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})" fill="none" stroke="#c98a5e" stroke-linecap="round" opacity=".75">${bands}</g>`
        : `<path d="${d}" fill="#2f5a2c"/><clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})" fill="none" stroke="#c2d87e" stroke-linecap="round">${bands}</g><path d="${d}" fill="none" stroke="#24461f" stroke-width="2"/>`;
      return `<path d="M${bx} ${by} Q${f1((bx + x) / 2)} ${f1((by + y) / 2 + 6)} ${x} ${y}" fill="none" stroke="#6b4a32" stroke-width="1.5"/><g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${body}<path d="M0 -1 L0 -50" stroke="#dbe9a8" stroke-width="1.1"/></g>`;
    };
    return `<ellipse cx="120" cy="186" rx="44" ry="5" fill="#e5e7eb"/><ellipse cx="120" cy="185" rx="38" ry="3.4" fill="#f3f4f6"/>
<g class="sway">${leaf(116, 150, 80, 130, -72, 0.78)}${leaf(124, 150, 162, 128, 70, 0.8)}${leaf(118, 150, 90, 98, -40, 0.9)}${leaf(122, 150, 152, 96, 42, 0.92)}${leaf(120, 150, 130, 68, 14, 0.88, true)}${leaf(119, 150, 106, 72, -16, 0.98)}${leaf(121, 150, 142, 80, 26, 0.84)}${leaf(120, 150, 118, 114, -4, 0.72)}</g>
<path d="M96 148 L144 148 L141 182 L99 182 Z" fill="#1c1d20"/><rect x="94" y="146" width="52" height="5" rx="2" fill="#26272b"/>
<rect x="110" y="158" width="20" height="6" rx="1" fill="#f8fafc" opacity=".85"/><path d="M112 160 h16 M112 162 h10" stroke="#9ca3af" stroke-width=".6"/>`;
  },

  /* Spathiphyllum cutting in a glass propagation bulb (round flask, long neck) under a clear cloche */
  peacelily: () => {
    const leaf = (x, y, rot, s) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0 C13 -12 15 -40 0 -60 C-15 -40 -13 -12 0 0Z" fill="url(#lpp-g)"/><path d="M0 -2 L0 -58" stroke="#bbf7d0" stroke-width=".9" opacity=".55"/><path d="M-3.5 -16 Q-6 -32 -2.5 -46" fill="none" stroke="#fff" stroke-width="1.3" stroke-opacity=".2"/></g>`;
    return `<defs><linearGradient id="lpp-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset=".55" stop-color="#16a34a"/><stop offset="1" stop-color="#15803d"/></linearGradient>
<linearGradient id="lpp-glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e0f2fe" stop-opacity=".26"/><stop offset=".22" stop-color="#e0f2fe" stop-opacity=".05"/><stop offset=".8" stop-color="#e0f2fe" stop-opacity=".03"/><stop offset="1" stop-color="#e0f2fe" stop-opacity=".2"/></linearGradient>
<radialGradient id="lpp-water" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#d9f99d" stop-opacity=".35"/><stop offset="1" stop-color="#65a30d" stop-opacity=".22"/></radialGradient></defs>
<path d="M84 188 L84 92 Q84 70 106 68 L134 68 Q156 70 156 92 L156 188" fill="url(#lpp-glass)" stroke="rgba(224,242,254,.4)" stroke-width="1.3"/>
<path d="M91 104 L91 176" stroke="#fff" stroke-opacity=".16" stroke-width="2.4" stroke-linecap="round"/>
<g class="sway"><g fill="none" stroke="#16a34a" stroke-width="2.6" stroke-linecap="round"><path d="M118 120 Q116 84 100 66"/><path d="M121 120 L122 60"/><path d="M123 120 Q128 86 146 70"/></g>
${leaf(100, 66, -48, 0.72)}${leaf(146, 70, 52, 0.66)}${leaf(122, 60, -2, 0.9)}</g>
<path d="M113 62 L113 134 A27 27 0 1 0 127 134 L127 62" fill="none" stroke="rgba(224,242,254,.55)" stroke-width="1.3"/>
<path d="M114 98 L114 134.5 A26 26 0 1 0 126 134.5 L126 98 Z" fill="url(#lpp-water)"/><path d="M114 98 L126 98" stroke="#d9f99d" stroke-opacity=".6"/>
<ellipse cx="120" cy="62" rx="9.5" ry="2.2" fill="none" stroke="rgba(224,242,254,.6)" stroke-width="1.2"/>
<g fill="none" stroke="#f5f5f4" stroke-width="1" stroke-linecap="round" opacity=".9"><path d="M119 132 q-4 10 -2 18"/><path d="M121 132 q5 8 3 16"/><path d="M120 134 q-1 14 4 26"/><path d="M118 134 q-8 6 -10 12"/></g>
<path d="M104 152 Q108 140 116 138" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"/>`;
  },
};

/* where the plant lives: grow-light bar & beam, or soft window light through blinds */
const lpcLight = (lit, id, on = true) => (lit && !on
  ? `<rect x="76" y="4" width="88" height="11" rx="5.5" fill="#252931" stroke="#3a3f48"/><rect x="82" y="11" width="76" height="4" rx="2" fill="#3a3f48"/>`
  : lit
  ? `<defs><linearGradient id="${id}-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4" stop-opacity=".55"/><stop offset=".6" stop-color="#fde68a" stop-opacity=".16"/><stop offset="1" stop-color="#fde68a" stop-opacity="0"/></linearGradient><filter id="${id}-gl" x="-20%" y="-300%" width="140%" height="700%"><feGaussianBlur stdDeviation="3"/></filter></defs>
<polygon class="beam" points="84,14 156,14 214,188 26,188" fill="url(#${id}-beam)"/>
<rect x="76" y="4" width="88" height="11" rx="5.5" fill="#252931" stroke="#3a3f48"/><rect x="82" y="10" width="76" height="7" rx="3.5" fill="#fde68a" filter="url(#${id}-gl)"/><rect x="82" y="11" width="76" height="4" rx="2" fill="#fff7d6"/>`
  : `<defs><linearGradient id="${id}-win" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0f2fe" stop-opacity=".14"/><stop offset="1" stop-color="#e0f2fe" stop-opacity="0"/></linearGradient></defs>
<g fill="url(#${id}-win)">${[0, 1, 2, 3, 4, 5].map((i) => `<polygon points="${i * 13},0 ${i * 13 + 8},0 ${i * 13 + 128},188 ${i * 13 + 112},188"/>`).join('')}</g>`);

/* ---------- care guide scales (light bands after Clemson HGIC 1450; 1 ft-c ≈ 10.76 lux) ---------- */
const LPC_LIGHT = [null,
  { name: 'Low', fc: '75–200 ft-c', lux: '≈ 800–2,150 lux', where: 'Several feet back from an east window, or near a north window.' },
  { name: 'Medium', fc: '200–500 ft-c', lux: '≈ 2,150–5,400 lux', where: 'Within a few feet of an east window, or well back from a west or south one.' },
  { name: 'Bright indirect', fc: '500–1,000 ft-c', lux: '≈ 5,400–10,800 lux', where: 'Close to an east or west window, or behind a sheer on a south one — lots of sky, no harsh midday sun.' },
  { name: 'Bright + some sun', fc: '1,000+ ft-c', lux: '≈ 10,800+ lux', where: 'Right at the brightest window; a few hours of soft morning or late-day sun is welcome.' },
];
const LPC_TAP = [null,
  { name: 'Tap is fine', color: '#4ade80', tip: 'Room-temperature tap water is fine.' },
  { name: 'Mostly fine', color: '#86efac', tip: 'Tap water is fine; flush the pot with plenty of plain water every 3–4 months so fertilizer salts don’t build up.' },
  { name: 'Sensitive', color: '#fbbf24', tip: 'Filtered, distilled or rain water preferred.' },
  { name: 'Very sensitive', color: '#fb923c', tip: 'Use distilled, reverse-osmosis or rain water.' },
  { name: 'Extreme', color: '#f87171', tip: 'Distilled, RO or rain water only.' },
];
const LPC_TAP_FOOT = 'Letting tap water sit removes free chlorine, not fluoride — and pitcher (carbon) filters don’t remove fluoride either.';
const LPC_STEPS = [
  ['water', 'Water', 'mdi:watering-can-outline'],
  ['light', 'Light', 'mdi:white-balance-sunny'],
  ['climate', 'Humidity & temperature', 'mdi:thermometer-water'],
  ['feed', 'Feeding · Miracle-Gro 24-8-16', 'mdi:bottle-tonic-plus-outline'],
  ['groom', 'Grooming', 'mdi:content-cut'],
  ['watch', 'Watch for', 'mdi:magnify-scan'],
];

/* ---------- care model (same rules as the "Plant care reminders" automation) ---------- */
const LPC_STATUS = { overdue: '#f87171', due: '#f5b83d', soon: '#fbbf24', ok: '#4ade80', unlogged: '#9aa0aa', paused: '#94a3b8', settle: '#c4b5fd', missing: '#f87171', checked: '#7dd3fc' };
const LPC_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LPC_NEVER = Date.UTC(2001, 0, 1);
const LPC_STORE = 'linwood-plants-config';

const lpcIv = (v, fb) => { const n = v != null ? Number(v) : NaN; return isFinite(n) ? n : fb; };
const lpcLast = (st) => {
  if (!st) return null;
  const a = st.attributes || {};
  const t = a.timestamp != null ? a.timestamp * 1000 : Date.parse(String(st.state).replace(' ', 'T'));
  return isFinite(t) && t >= LPC_NEVER ? new Date(t) : null;
};
const lpcSince = (d) => { const a = new Date(d); a.setHours(0, 0, 0, 0); const b = new Date(); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 86400000); };
const lpcGrowMonths = (cfg) => (Array.isArray(cfg.growing_months) && cfg.growing_months.length ? cfg.growing_months : [3, 4, 5, 6, 7, 8, 9]).map(Number).filter((n) => n >= 1 && n <= 12).sort((a, b) => a - b);
const lpcSeason = (grow) => (grow.includes(new Date().getMonth() + 1) ? 'growing' : 'rest');
const lpcLitNames = (cfg) => (cfg.lit_locations || ['Mantel']).map((s) => String(s).toLowerCase());

/* ---------- grow lights ---------- */
const lpcLights = (cfg) => (Array.isArray(cfg.grow_lights) ? cfg.grow_lights.filter((l) => l && l.entity) : []);
const lpcLightFor = (cfg, p) => {
  const ls = lpcLights(cfg);
  if (ls.length) return ls.find((l) => l.id === p.light) || (ls.length === 1 ? ls[0] : null);
  return cfg.grow_light ? { id: 'grow', entity: cfg.grow_light, name: 'Grow light' } : null;
};
/* Brightness is remote-only, so it is read back from the plug's wattage: nearest of 25 / 50 / 75 / 100 % of the bar's full
 * draw (0 = plug on but the bar is dark). Same bands as the "Mantel Grow Light Brightness Check" automation. */
const lpcLevel = (w, full) => { const r = w / (Number(full) || 35); return r < 0.06 ? 0 : r < 0.375 ? 25 : r < 0.625 ? 50 : r < 0.87 ? 75 : 100; };
const lpcLightState = (hass, l) => {
  if (!l) return null;
  const s = hass && hass.states[l.entity];
  const state = s ? s.state : 'missing';
  const pw = l.power && hass ? hass.states[l.power] : null;
  const w = pw ? parseFloat(pw.state) : NaN;
  const watts = isFinite(w) ? w : null;
  const on = state === 'on';
  const settled = !!s && Date.now() - Date.parse(s.last_changed) > 90000;      // give the plug's power reading time to catch up
  const level = on && watts != null && l.target ? lpcLevel(watts, l.full_watts) : null;
  const ts = l.target && hass ? hass.states[l.target] : null;
  const target = ts ? parseInt(ts.state, 10) || null : null;
  return { l, state, on, un: state === 'unavailable' || state === 'missing', watts, level, target, warn: settled && level != null && target != null && level !== target };
};
const lpcLightSig = (hass, ls) => ls.map((l) => { const s = lpcLightState(hass, l); return `${s.state}${s.watts == null ? '-' : Math.round(s.watts)}${s.warn ? '!' : ''}${s.target || ''}`; }).join(',');
const lpcNeeds = (s) => s === 'overdue' || s === 'due';

/* ---------- watering log: learn each pot's dry-down time from the gaps between logged waterings ----------
 * Same rules as the "Plant watering reminders" automation: median of the last `window` gaps once `learn` gaps exist;
 * check-soil day = floor(typical × factor + 0.5); "probably dry" after floor(typical + 0.5) + 1 days. */
const LPC_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const lpcKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const lpcDayOf = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const lpcGap = (a, b) => Math.round((lpcDayOf(b) - lpcDayOf(a)) / 86400000);
const lpcMedian = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return !n ? null : n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const lpcLogDates = (st) => String((st && st.state) || '').split(',').map((x) => x.trim()).filter((x) => LPC_DAY_RE.test(x)).sort();
const lpcWaterCfg = (cfg) => {
  const w = (cfg && cfg.water_learning) || {};
  return { script: w.script || 'script.plant_log_watering', learn: Math.max(1, lpcIv(w.learn, 3)), window: Math.max(1, lpcIv(w.window, 6)), factor: lpcIv(w.factor, 0.85), recheck: lpcIv(w.recheck, 2) };
};
const lpcWatering = (hass, cfg, p) => {
  const w = p.watering; if (!w || !w.log) return null;
  const S = lpcWaterCfg(cfg), ls = hass && hass.states[w.log];
  if (!ls) return { w, S, status: 'missing', dates: [], gaps: [], recent: [], learning: true, need: false };
  const dates = lpcLogDates(ls);
  const gaps = dates.slice(1).map((d, i) => lpcGap(dates[i], d));
  const recent = gaps.slice(-S.window);
  const learned = recent.length >= S.learn ? lpcMedian(recent) : null;
  const guide = lpcIv(w.check, null);
  const typical = learned != null ? learned : guide;
  const checkDay = learned != null ? Math.max(1, Math.floor(learned * S.factor + 0.5)) : guide != null ? Math.max(1, guide) : null;
  const today = lpcKey(new Date());
  const last = dates.length ? dates[dates.length - 1] : null;
  const since = last ? lpcGap(last, today) : null;
  const ck = w.checked && hass ? lpcLast(hass.states[w.checked]) : null;
  const ckKey = ck ? lpcKey(ck) : null;
  const snoozed = !!ckKey && !!last && ckKey > last && lpcGap(ckKey, today) < S.recheck;
  let status, left = null;
  if (!last) status = 'unlogged';
  else if (snoozed) status = 'checked';
  else if (checkDay == null || since < checkDay) { status = 'ok'; left = checkDay == null ? null : checkDay - since; }
  else status = learned != null && since > Math.floor(learned + 0.5) + 1 ? 'overdue' : 'due';
  let recheckOn = null;
  if (snoozed) { recheckOn = lpcDayOf(ckKey); recheckOn.setDate(recheckOn.getDate() + S.recheck); }
  const pct = typical && since != null ? Math.min(1, Math.max(0, since / typical)) : 0;
  return { w, S, dates, gaps, recent, learned, guide, typical, checkDay, last, since, status, left, pct, ckKey, recheckOn, today, learning: learned == null, need: learned != null && lpcNeeds(status) };
};

const lpcModel = (hass, cfg, p, season) => {
  const st = hass && hass.states[p.entity];
  const locSt = p.location && hass ? hass.states[p.location] : null;
  const litNames = lpcLitNames(cfg);
  const lit = locSt ? litNames.some((l) => String(locSt.state).toLowerCase().includes(l)) : !!p.lit;
  const e = p.every || {};
  const grow = lpcIv(e.growing, 30), rest = lpcIv(e.rest, 0), litIv = lpcIv(e.lit != null ? e.lit : e.mantel, grow);
  const iv = season === 'growing' ? grow : (lit ? litIv : rest);
  const gl = lit ? lpcLightFor(cfg, p) : null;
  const glSt = gl && hass ? lpcLightState(hass, gl) : null;
  let settle = null;
  if (lit && p.moved && hass) {
    const mv = lpcLast(hass.states[p.moved]), days = lpcIv(cfg.settle_days, 14);
    if (mv && days > 0) { const sn = lpcSince(mv); if (sn < days) settle = { until: new Date(mv.getFullYear(), mv.getMonth(), mv.getDate() + days), left: days - sn, days }; }
  }
  const last = lpcLast(st), since = last ? lpcSince(last) : null;
  let status, left = null, pct = 0;
  if (!st) status = 'missing';
  else if (!iv) status = 'paused';
  else if (settle) { status = 'settle'; left = settle.left; pct = Math.min(1, Math.max(0, 1 - settle.left / settle.days)); }
  else if (!last) status = 'unlogged';
  else {
    left = iv - since; pct = Math.min(1, Math.max(0, since / iv));
    status = left < 0 ? 'overdue' : left === 0 ? 'due' : left <= Math.max(2, Math.round(iv * 0.15)) ? 'soon' : 'ok';
  }
  let water = null;
  if (p.water && p.water.entity) {
    const ws = hass && hass.states[p.water.entity], wiv = lpcIv(p.water.every, 7), wl = lpcLast(ws), wsn = wl ? lpcSince(wl) : null;
    let wst, wleft = null, wpct = 0;
    if (!ws) wst = 'missing'; else if (!wl) wst = 'unlogged';
    else { wleft = wiv - wsn; wpct = Math.min(1, Math.max(0, wsn / wiv)); wst = wleft < 0 ? 'overdue' : wleft === 0 ? 'due' : wleft <= 1 ? 'soon' : 'ok'; }
    water = { entity: p.water.entity, iv: wiv, last: wl, since: wsn, status: wst, left: wleft, pct: wpct };
  }
  const wat = lpcWatering(hass, cfg, p);
  const loc = locSt ? locSt.state : (lit ? 'Grow light' : '');
  return { p, st, locSt, lit, loc, group: gl ? gl.name : loc, gl, glSt, settle, grow, rest, litIv, iv, last, since, status, left, pct, water, wat };
};

/* humidifier next to a plant: running / idle / not running (plug on, no draw — empty tank) / offline */
const lpcHum = (hass, h) => {
  const s = hass && hass.states[h.entity], pw = h.power && hass ? hass.states[h.power] : null, hs = h.humidity && hass ? hass.states[h.humidity] : null;
  const w = pw ? parseFloat(pw.state) : NaN, hum = hs ? parseFloat(hs.state) : NaN;
  const state = s ? s.state : 'missing';
  const settled = !!s && Date.now() - Date.parse(s.last_changed) > 120000;
  const status = state === 'on' ? (isFinite(w) && w < 2 && settled ? 'dry' : 'run') : state === 'off' ? 'idle' : 'un';
  return { status, hum: isFinite(hum) ? Math.round(hum) : null };
};

/* Shared with the Linwood sidebar: { due, overdue, total } using the last card config seen. */
window.LinwoodPlantSummary = (hass) => {
  let cfg = window.__lpcConfig;
  if (!cfg) { try { cfg = JSON.parse(localStorage.getItem(LPC_STORE) || 'null'); } catch (e) { cfg = null; } }
  if (!cfg || !hass || !Array.isArray(cfg.plants)) return null;
  const season = lpcSeason(lpcGrowMonths(cfg));
  let due = 0, overdue = false;
  cfg.plants.forEach((p) => {
    const m = lpcModel(hass, cfg, p, season);
    if (lpcNeeds(m.status)) due++;
    if (m.water && lpcNeeds(m.water.status)) due++;
    if (m.wat && m.wat.need) due++;
    if (m.status === 'overdue' || (m.water && m.water.status === 'overdue') || (m.wat && m.wat.need && m.wat.status === 'overdue')) overdue = true;
  });
  return { due, overdue, total: cfg.plants.length };
};

/* ---------- humidifier popup: history parsing + chart maths ---------- */
const LPC_HX_RANGES = [[3, '3 h'], [24, '24 h'], [72, '3 days'], [168, '7 days']];
/* HA history rows, compressed (s / lc / lu, epoch seconds) or full (state / last_changed) */
const lpcHxRows = (rows, numeric) => {
  const out = [];
  (rows || []).forEach((e) => {
    const ts = e.lc != null ? e.lc : e.lu;
    const t = ts != null ? ts * 1000 : Date.parse(e.last_changed || e.last_updated);
    const s = e.s != null ? e.s : e.state;
    if (!isFinite(t)) return;
    if (numeric) { const v = parseFloat(s); out.push({ t, v: isFinite(v) ? v : null }); } else out.push({ t, s });
  });
  return out.sort((a, b) => a.t - b.t);
};
/* average into n time buckets so a week of one-minute readings stays light; gaps (unavailable) are kept */
const lpcHxThin = (pts, t0, t1, n) => {
  if (pts.length <= n) return pts;
  const w = (t1 - t0) / n, out = [];
  let k = null, sum = 0, cnt = 0;
  const flush = () => { if (cnt) out.push({ t: Math.max(t0, t0 + (k + 0.5) * w), v: sum / cnt }); sum = 0; cnt = 0; };
  pts.forEach((p) => {
    if (p.v == null) { flush(); k = null; out.push(p); return; }
    const kk = Math.max(0, Math.min(n - 1, Math.floor((p.t - t0) / w)));
    if (kk !== k) { flush(); k = kk; }
    sum += p.v; cnt++;
  });
  flush();
  return out;
};
/* time-weighted low / high / average and share of time at or above a level (each reading holds until the next) */
const lpcHxStats = (pts, t0, t1, from, atLeast) => {
  let lo = Infinity, hi = -Infinity, area = 0, dur = 0, above = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]; if (p.v == null) continue;
    const a = Math.max(p.t, t0, from || 0), b = Math.min(i + 1 < pts.length ? pts[i + 1].t : t1, t1);
    if (b <= a && i + 1 < pts.length) continue;
    lo = Math.min(lo, p.v); hi = Math.max(hi, p.v);
    const d = Math.max(0, b - a); area += p.v * d; dur += d; if (atLeast != null && p.v >= atLeast) above += d;
  }
  return isFinite(lo) ? { lo, hi, avg: dur ? area / dur : lo, above: dur ? above / dur : null } : null;
};
const lpcHxSpans = (rows, t0, t1) => {
  const spans = []; let on = null;
  rows.forEach((r) => {
    if (r.s === 'on' && on == null) on = Math.max(r.t, t0);
    else if (r.s !== 'on' && on != null) { spans.push([on, Math.min(r.t, t1)]); on = null; }
  });
  if (on != null) spans.push([on, t1]);
  return spans.filter(([a, b]) => b > a);
};
const lpcHxStep = (span) => [0.5, 1, 2, 5, 10, 20].find((s) => span / s <= 4) || 20;
const lpcHxAt = (pts, t) => {          // reading in force at time t
  let lo = 0, hi = pts.length - 1, r = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (pts[m].t <= t) { r = pts[m]; lo = m + 1; } else hi = m - 1; }
  return r;
};
const lpcAgo = (ms) => {
  const m = Math.floor(ms / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h${m % 60 && m < 600 ? ` ${m % 60} min` : ''} ago` : `${Math.floor(m / 1440)} d ago`;
};
const lpcDur = (ms) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} m` : ''}` : `${(m / 1440).toFixed(1)} days`;
};

const lpcEsc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const lpcWatts = (w) => (w < 10 ? w.toFixed(1) : String(Math.round(w)));

class LinwoodPlantCard extends HTMLElement {
  setConfig(config) {
    if (!config || !Array.isArray(config.plants) || !config.plants.length) throw new Error('Set "plants" to a list of plants');
    config.plants.forEach((p) => { if (!p || !p.entity) throw new Error('Each plant needs an input_datetime "entity"'); });
    this._config = config;
    this._grow = lpcGrowMonths(config);
    this._litNames = lpcLitNames(config);
    window.__lpcConfig = config;
    try {
      localStorage.setItem(LPC_STORE, JSON.stringify({
        plants: config.plants.map((p) => ({ entity: p.entity, location: p.location, every: p.every, water: p.water, watering: p.watering, lit: p.lit, light: p.light, moved: p.moved })),
        growing_months: config.growing_months, lit_locations: config.lit_locations, grow_light: config.grow_light, grow_lights: config.grow_lights, settle_days: config.settle_days, water_learning: config.water_learning,
      }));
    } catch (e) { /* private mode */ }
    this._undo = null; this._busy = {}; this._care = this._care || {}; this._chip = this._chip || {}; this._just = {};
    this._filter = this._filter || 'all';
    this._art = {};
    this._sig = '';
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      /* the card renders into _root; the humidifier popup is a <dialog> beside it so it isn't caught by the card's
       * container query (which would trap a fixed-position overlay) and the card's re-renders don't touch it */
      this._root = document.createElement('div');
      this._dlg = document.createElement('dialog');
      this._dlg.className = 'hx';
      this.shadowRoot.append(this._root, this._dlg);
      this._dlg.addEventListener('close', () => { this._hx = null; this._hxSig = ''; clearInterval(this._hxTick); });
      this._dlg.addEventListener('click', (ev) => { if (ev.target === this._dlg) this._dlg.close(); });
      this._dlg.addEventListener('pointermove', (ev) => this._hxPoint(ev));
      this._dlg.addEventListener('pointerdown', (ev) => this._hxPoint(ev, true));
      this.shadowRoot.addEventListener('click', (ev) => this._click(ev));
      this.shadowRoot.addEventListener('change', (ev) => {
        const el = ev.target;
        if (!el || !el.dataset || !LPC_DAY_RE.test(el.value || '')) return;
        if (el.dataset.act === 'pick') this._setDate(el.dataset.val, el.value);
        else if (el.dataset.act === 'wpick') { const day = el.value; el.value = ''; this._wLog(el.dataset.val, day, 'add'); }
      });
    }
    this._paint();
  }

  set hass(hass) {
    this._hass = hass;
    const cfg = this._config, lights = lpcLights(cfg);
    const ids = [cfg.grow_light, ...lights.map((l) => l.target), ...cfg.plants.flatMap((p) => [p.entity, p.location, p.water && p.water.entity, p.moved, p.watering && p.watering.log, p.watering && p.watering.checked])].filter(Boolean);
    const hum = cfg.plants.filter((p) => p.humidifier && p.humidifier.entity).map((p) => { const h = lpcHum(hass, p.humidifier); return `${h.status}${h.hum}`; }).join(',');
    const sig = ids.map((e) => { const s = hass.states[e]; return s ? s.state : '-'; }).join('|') + lpcLightSig(hass, lights) + hum + new Date().toDateString();
    if (sig !== this._sig) { this._sig = sig; this._paint(); }
    if (this._hx) {
      this._hxLive(hass);
      const e = this._hxEnts(this._hx.h);
      const hs = [e.sw, e.power, e.hum, e.temp, e.auto].map((id) => { const s = id && hass.states[id]; return s ? s.state + s.last_changed : '-'; }).join('|');
      if (hs !== this._hxSig) { this._hxSig = hs; this._hxPaint(); }
    }
  }

  getCardSize() { return 12; }
  getGridOptions() { return { columns: 'full', rows: 'auto' }; }

  /* ---------- actions ---------- */
  _click(ev) {
    const el = ev.composedPath().find((x) => x.dataset && x.dataset.act);
    if (!el || el.disabled) return;
    const { act, val } = el.dataset;
    if (act === 'feed') this._log(val, 'feeding');
    else if (act === 'water') this._log(val, 'water change');
    else if (act === 'watered') this._wLog(val, lpcKey(new Date()), 'add');
    else if (act === 'moist') this._moist(val);
    else if (act === 'wclear') this._wLog(val, el.dataset.day, 'remove');
    else if (act === 'undo') this._doUndo();
    else if (act === 'yesterday') { const d = new Date(); d.setDate(d.getDate() - 1); this._setDate(val, this._key(d)); }
    else if (act === 'clear') this._call('input_datetime', 'set_datetime', { entity_id: val, datetime: '2000-01-01 00:00:00' });
    else if (act === 'loc') { if (el.dataset.cur !== val) this._call('input_select', 'select_option', { entity_id: el.dataset.ent, option: val }); }
    else if (act === 'care') { this._care[val] = !this._care[val]; this._paint(); }
    else if (act === 'chip') { const ent = el.dataset.ent; this._chip[ent] = this._chip[ent] === val ? null : val; this._paint(); }
    else if (act === 'filter') { this._filter = val; this._paint(); }
    else if (act === 'more') this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: val }, bubbles: true, composed: true }));
    else if (act === 'hum') this._hxOpen(val);
    else if (act === 'hxclose') { if (this._dlg && this._dlg.open) this._dlg.close(); }
    else if (act === 'hxrange') { const r = Number(val); if (this._hx && r !== this._hx.range) { this._hx.range = this._hxRange = r; this._hx.hov = null; this._hxFetch(); } }
    else if (act === 'hxsw') this._hxDo('sw');
    else if (act === 'hxauto') this._hxDo('auto');
    else if (act === 'jump') {
      if (this._filter !== 'all') { this._filter = 'all'; this._paint(); }
      const t = this.shadowRoot.getElementById(val);
      if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.classList.remove('ping'); void t.offsetWidth; t.classList.add('ping'); }
    }
  }

  async _call(domain, service, data) {
    if (!this._hass) return false;
    try { await this._hass.callService(domain, service, data); return true; } catch (e) { this._flash(`Couldn't update: ${e && e.message ? e.message : e}`); return false; }
  }
  _key(d) { return lpcKey(d); }
  _setDate(entity, key) { return this._call('input_datetime', 'set_datetime', { entity_id: entity, datetime: `${key} 12:00:00` }); }
  _plant(entity) { return this._config.plants.find((p) => p.entity === entity); }

  async _log(entity, what) {
    if (!this._hass || this._busy[entity]) return;
    const st = this._hass.states[entity];
    const prev = st && st.attributes && st.attributes.timestamp != null ? st.attributes.timestamp : null;
    const plant = this._config.plants.find((p) => p.entity === entity || (p.water && p.water.entity === entity));
    this._busy[entity] = true; this._paint();
    const ok = await this._call('input_datetime', 'set_datetime', { entity_id: entity, timestamp: Math.floor(Date.now() / 1000) });
    if (ok) {
      this.dispatchEvent(new CustomEvent('haptic', { detail: 'success', bubbles: true, composed: true }));
      clearTimeout(this._undoT);
      this._undo = { entity, prev, what, name: (plant && plant.name) || entity };
      this._undoT = setTimeout(() => { this._undo = null; this._paint(); }, 10000);
      if (plant) { this._just[plant.entity] = Date.now(); setTimeout(() => this._paint(), 1700); }
    }
    this._busy[entity] = false; this._paint();
  }
  /* add or remove one watering date through the log script (it keeps the log sorted, unique and ≤ 20 dates);
   * an added date that wasn't already logged gets the 10 s undo */
  async _wLog(plantEntity, day, op) {
    const p = this._plant(plantEntity), key = `w:${plantEntity}`;
    if (!p || !p.watering || !p.watering.log || !this._hass || !LPC_DAY_RE.test(day || '') || this._busy[key]) return;
    const [dom, svc] = lpcWaterCfg(this._config).script.split('.');
    const had = lpcLogDates(this._hass.states[p.watering.log]).includes(day);
    this._busy[key] = true; this._paint();
    const ok = await this._call(dom, svc, { log: p.watering.log, day, op });
    if (ok && op === 'add') {
      this.dispatchEvent(new CustomEvent('haptic', { detail: 'success', bubbles: true, composed: true }));
      if (!had) {
        clearTimeout(this._undoT);
        this._undo = { kind: 'watering', plant: plantEntity, day, what: day === lpcKey(new Date()) ? 'watering' : `watering on ${this._date(lpcDayOf(day))}`, name: p.name };
        this._undoT = setTimeout(() => { this._undo = null; this._paint(); }, 10000);
      }
      this._just[p.entity] = Date.now(); setTimeout(() => this._paint(), 1700);
    }
    this._busy[key] = false; this._paint();
  }
  _moist(plantEntity) {
    const p = this._plant(plantEntity);
    if (!p || !p.watering || !p.watering.checked) return;
    this.dispatchEvent(new CustomEvent('haptic', { detail: 'light', bubbles: true, composed: true }));
    this._call('input_datetime', 'set_datetime', { entity_id: p.watering.checked, date: lpcKey(new Date()) });
  }
  async _doUndo() {
    const u = this._undo; if (!u) return;
    this._undo = null; clearTimeout(this._undoT); this._paint();
    if (u.kind === 'watering') {
      const p = this._plant(u.plant);
      if (p && p.watering) { const [dom, svc] = lpcWaterCfg(this._config).script.split('.'); await this._call(dom, svc, { log: p.watering.log, day: u.day, op: 'remove' }); }
      return;
    }
    await this._call('input_datetime', 'set_datetime', u.prev != null ? { entity_id: u.entity, timestamp: u.prev } : { entity_id: u.entity, datetime: '2000-01-01 00:00:00' });
  }
  _flash(msg) { this._err = msg; clearTimeout(this._errT); this._errT = setTimeout(() => { this._err = null; this._paint(); }, 6000); this._paint(); }

  /* ---------- text helpers ---------- */
  _esc(s) { return lpcEsc(s); }
  _span(d) { return d >= 14 && d % 7 === 0 ? `${d / 7} wk` : `${d} d`; }
  _date(d) { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  _ago(since, last) { return since <= 0 ? 'today' : since === 1 ? 'yesterday' : since < 14 ? `${since} days ago` : this._date(last); }
  _typ(n) { return n == null ? '—' : Number.isInteger(n) ? String(n) : `${Math.floor(n)}½`; }
  _range(season) {
    const g = this._grow; if (!g.length) return '';
    const first = g[0], last = g[g.length - 1];
    return season === 'growing' ? `${LPC_MON[first - 1]}–${LPC_MON[last - 1]}` : `${LPC_MON[last % 12]}–${LPC_MON[(first + 10) % 12]}`;
  }
  _nextGrowMonth() { return LPC_MON[this._grow[0] - 1] || 'spring'; }
  _status(m, season) {
    switch (m.status) {
      case 'overdue': return `${-m.left} day${m.left === -1 ? '' : 's'} overdue`;
      case 'due': return 'Feed today';
      case 'soon': case 'ok': return m.left === 1 ? 'Feed tomorrow' : `Feed in ${this._span(m.left)}`;
      case 'settle': return `Settling in · ${m.settle.left} d`;
      case 'unlogged': return 'Never logged';
      case 'paused': return m.p.hold ? m.p.hold : season === 'rest' && !m.lit ? `Resting till ${this._nextGrowMonth()}` : 'Paused';
      default: return 'Helper missing';
    }
  }
  _wStatus(w) {
    switch (w.status) {
      case 'overdue': return `${-w.left} d overdue`;
      case 'due': return 'Change today';
      case 'soon': case 'ok': return w.left === 1 ? 'Tomorrow' : `In ${this._span(w.left)}`;
      case 'unlogged': return 'Never logged';
      default: return 'Helper missing';
    }
  }

  /* ---------- pieces ---------- */
  _svg(m, i) {
    const on = !m.glSt || m.glSt.on;
    const k = `${m.p.art}|${m.lit}|${on}`;
    if (!this._art[k]) {
      const draw = LPC_ART[m.p.art];
      this._art[k] = draw ? `${lpcLight(m.lit, `lpl${i}`, on)}${draw()}` : '';
    }
    return this._art[k]
      ? `<svg viewBox="0 0 240 200" preserveAspectRatio="xMidYMax meet" aria-hidden="true" style="--d:${(i * 0.9) % 5}s">${this._art[k]}</svg>`
      : `<ha-icon class="fallback" icon="${this._esc(m.p.icon || 'mdi:sprout')}"></ha-icon>`;
  }

  _ring(m) {
    const R = 24, C = 2 * Math.PI * R;
    const pct = m.status === 'overdue' || m.status === 'due' ? 1 : m.pct;
    let big, small;
    if (m.status === 'settle') { big = String(m.settle.left); small = 'settle'; }
    else if (m.status === 'paused' && m.p.hold) { big = '<ha-icon icon="mdi:pause"></ha-icon>'; small = 'hold'; }
    else if (m.status === 'paused') { big = '<ha-icon icon="mdi:weather-night"></ha-icon>'; small = 'rest'; }
    else if (m.status === 'unlogged' || m.status === 'missing') { big = '?'; small = 'log it'; }
    else if (m.left < 0) { big = `+${-m.left}`; small = 'late'; }
    else if (m.left === 0) { big = '0'; small = 'today'; }
    else { big = m.left >= 100 ? '99+' : String(m.left); small = m.left === 1 ? 'day' : 'days'; }
    const tip = m.status === 'settle' ? `Settling in after the move — first feed ${this._date(m.settle.until)}` : m.iv ? `Every ${this._span(m.iv)}` : (m.p.hold || 'No feeding this season');
    return `<div class="ring" title="${this._esc(tip)}"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="${R}" class="rt"/><circle cx="30" cy="30" r="${R}" class="rf" stroke-dasharray="${f1(C * pct)} ${f1(C)}" transform="rotate(-90 30 30)"/></svg><div class="rc"><b>${big}</b><i>${small}</i></div></div>`;
  }

  _locSeg(m) {
    if (!m.locSt) return '';
    const opts = (m.locSt.attributes && m.locSt.attributes.options) || [];
    return `<div class="seg" role="group" aria-label="Location">${opts.map((o) => {
      const lit = this._litNames.some((l) => String(o).toLowerCase().includes(l));
      const on = o === m.locSt.state;
      return `<button class="${on ? 'on' : ''}${lit ? ' lit' : ''}" data-act="loc" data-ent="${this._esc(m.p.location)}" data-cur="${this._esc(m.locSt.state)}" data-val="${this._esc(o)}" aria-pressed="${on}"><ha-icon icon="${lit ? 'mdi:lightbulb-on-outline' : 'mdi:window-closed-variant'}"></ha-icon>${this._esc(o)}</button>`;
    }).join('')}</div>`;
  }

  /* the grow light this plant sits under: live state, height above the plant, brightness vs. target */
  _lightRow(m) {
    const g = m.glSt; if (!g) return '';
    const l = g.l, p = m.p;
    const word = g.un ? 'Offline' : g.on ? 'On' : 'Off';
    const top = lpcIv(p.top, null), gap = l.height && top != null ? f1(l.height - top) : null;
    const bits = [];
    if (gap != null) bits.push(`${gap}″ above the plant`);
    if (p.riser) bits.push(`${p.riser}″ riser`);
    if (gap == null && l.note) bits.push(l.note);
    if (g.target) bits.push(`set ${g.target}%`);
    let sub = bits.join(' · ');
    if (g.warn) sub = g.level === 0 ? 'Plug is on but the light is dark — press power on its remote' : `Reads ≈${g.level}% — set it to ${g.target}% on the remote`;
    else if (g.un) sub = 'The plug isn’t responding';
    const meter = g.on && g.watts != null ? `<span class="glw"><b>${lpcWatts(g.watts)} W</b>${g.level ? `<i>≈${g.level}%</i>` : ''}</span>` : '';
    const icon = g.un ? 'mdi:lightbulb-alert-outline' : g.on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline';
    return `<button class="glr${g.on ? ' on' : ''}${g.un ? ' un' : ''}${g.warn ? ' warn' : ''}" data-act="more" data-val="${this._esc(l.entity)}"><span class="gli"><ha-icon icon="${icon}"></ha-icon></span><span class="glt"><b>${this._esc(l.name)}${l.height ? ` · ${l.height}″` : ''} · <em>${word}</em></b><i>${this._esc(sub)}</i></span>${meter}</button>`;
  }

  _humRow(m) {
    const h = m.p.humidifier; if (!h || !h.entity || !this._hass) return '';
    const s = lpcHum(this._hass, h), lo = lpcIv(h.low, 55), hi = lpcIv(h.high, 60);
    const word = { run: 'Running', idle: 'Idle', dry: 'Not running', un: 'Offline' }[s.status];
    const air = s.hum != null ? `Air ${s.hum}% · ` : '';
    const sub = s.status === 'dry' ? 'Plug is on but it isn’t drawing power — refill the tank'
      : s.status === 'un' ? 'The plug isn’t responding'
      : `${air}${s.status === 'idle' ? `humid enough · runs below ${lo}%` : `runs until ${hi}%`}`;
    return `<button class="hum h-${s.status}" data-act="hum" data-val="${this._esc(m.p.entity)}" aria-haspopup="dialog"><span class="hui"><ha-icon icon="${s.status === 'run' ? 'mdi:air-humidifier' : 'mdi:air-humidifier-off'}"></ha-icon></span><span class="hut"><b>Humidifier · <em>${word}</em></b><i>${this._esc(sub)}</i></span><span class="hux"><ha-icon icon="mdi:chart-line"></ha-icon></span></button>`;
  }

  _water(w) {
    const busy = this._busy[w.entity];
    const meta = w.last ? `changed ${this._ago(w.since, w.last)}` : `every ${this._span(w.iv)}`;
    return `<div class="water s-${w.status}" style="--sc:${LPC_STATUS[w.status]}">
  <span class="wi"><ha-icon icon="mdi:water-sync"></ha-icon></span>
  <span class="wt"><b>Fresh water · <em>${this._esc(this._wStatus(w))}</em></b><i>${this._esc(meta)} · every ${this._span(w.iv)}</i><span class="wbar"><span style="width:${Math.round(w.pct * 100)}%"></span></span></span>
  <button class="btn wbtn${lpcNeeds(w.status) || w.status === 'unlogged' ? ' go' : ''}" data-act="water" data-val="${this._esc(w.entity)}" ${busy || w.status === 'missing' ? 'disabled' : ''}>${busy ? '<ha-icon class="spin" icon="mdi:loading"></ha-icon>' : '<ha-icon icon="mdi:check"></ha-icon>Changed'}</button>
</div>`;
  }

  /* soil plants: when it was last watered, when to check the soil next (learned from this pot's own gaps once
   * there are enough, the care guide's cadence until then), Watered / Still moist / another date, recent gaps */
  _wat(m) {
    const w = m.wat, p = m.p, ent = this._esc(p.entity), S = w.S;
    const busy = this._busy[`w:${p.entity}`], need = S.learn + 1, n = w.dates.length;
    const typ = this._typ(w.learned), ago = w.last ? this._ago(w.since, lpcDayOf(w.last)) : '';
    let head, meta;
    if (w.status === 'missing') { head = 'Helper missing'; meta = `${w.w.log} isn’t in Home Assistant`; }
    else if (w.status === 'unlogged') { head = 'Log the first watering'; meta = 'Water when the soil is dry, then tap Watered — it learns how long this pot takes to dry out.'; }
    else if (w.status === 'checked') { head = `Still moist · recheck ${this._date(w.recheckOn)}`; meta = `Soil checked ${this._ago(lpcGap(w.ckKey, w.today), lpcDayOf(w.ckKey))} · watered ${ago}`; }
    else if (w.status === 'ok') {
      head = w.left == null ? `Watered ${ago}` : w.left === 1 ? 'Check the soil tomorrow' : `Check the soil in ${w.left} d`;
      meta = w.learning
        ? `Watered ${ago} · learning ${Math.min(n, need)} of ${need} waterings${w.guide ? ` · guide: check about every ${w.guide} d` : ''}`
        : `Watered ${ago} · usually dry in about ${typ} d`;
    } else {
      head = w.status === 'overdue' ? 'Probably dry' : 'Check the soil today';
      meta = w.learning
        ? `Day ${w.since} · the care guide says check about every ${w.guide} d`
        : `Day ${w.since} · usually dry by day ${typ}`;
    }
    const tick = w.typical && w.checkDay && w.checkDay < w.typical ? `<i style="left:${f1((w.checkDay / w.typical) * 100)}%"></i>` : '';
    const badge = w.status === 'missing' || w.status === 'unlogged' ? ''
      : w.learning ? `<span class="wtyp lrn"><b>${Math.min(n, need)}/${need}</b><i>learning</i></span>`
      : `<span class="wtyp"><b>~${typ} d</b><i>typical</i></span>`;
    const shown = w.gaps.slice(-8), inWin = Math.min(w.recent.length, shown.length);
    const gaps = shown.length ? `<div class="wgaps"><span class="wgl">Days between waterings</span>${shown.map((g, i) => `<span class="wg${i >= shown.length - inWin ? ' in' : ''}">${g}</span>`).join('')}</div>` : '';
    const today = w.last && w.last === w.today, due = lpcNeeds(w.status);
    const missing = w.status === 'missing';
    return `<div class="wat s-${w.status}${w.learning ? ' lrn' : ''}" style="--sc:${LPC_STATUS[w.status] || '#9aa0aa'}">
  <div class="wh">
    <span class="wi"><ha-icon icon="${due ? 'mdi:watering-can' : 'mdi:watering-can-outline'}"></ha-icon></span>
    <span class="wt"><b>Watering · <em>${this._esc(head)}</em></b><i>${this._esc(meta)}</i>${w.last ? `<span class="wbar"><span style="width:${Math.round(w.pct * 100)}%"></span>${tick}</span>` : ''}</span>
    ${badge}
  </div>
  ${gaps}
  <div class="wacts">
    <button class="btn wbtn wgo${due || w.status === 'unlogged' ? ' go' : ''}" data-act="watered" data-val="${ent}" ${busy || missing || today ? 'disabled' : ''}>${busy ? '<ha-icon class="spin" icon="mdi:loading"></ha-icon>' : `<ha-icon icon="mdi:water-plus-outline"></ha-icon>${today ? 'Watered today' : 'Watered'}`}</button>
    ${due && w.w.checked ? `<button class="btn wbtn sec" data-act="moist" data-val="${ent}" title="The soil isn't dry yet — check again in ${S.recheck} days"><ha-icon icon="mdi:hand-water"></ha-icon>Still moist</button>` : ''}
    <label class="btn wbtn sec pick" title="Log a watering on another date"><ha-icon icon="mdi:calendar-plus"></ha-icon><input type="date" data-act="wpick" data-val="${ent}" max="${w.today || lpcKey(new Date())}" value="" aria-label="Log a watering of ${this._esc(p.name)} on another date" ${missing ? 'disabled' : ''}></label>
  </div>
</div>`;
  }

  /* ---------- care guide: three labels + standard steps ---------- */
  _guide(m, season) {
    const p = m.p, g = p.guide, ent = this._esc(p.entity);
    if (!g) {
      const tips = Array.isArray(p.care) ? p.care : [];
      return tips.length ? `<ul>${tips.map((t) => `<li>${this._esc(t)}</li>`).join('')}</ul>` : '';
    }
    const winter = season === 'rest' && !m.lit;
    const d0 = g.dry || {}, dry = winter && d0.rest ? { ...d0, ...d0.rest } : d0;
    const water = d0.mode === 'water';
    const lv = Math.min(4, Math.max(1, lpcIv(g.light && g.light.level, 2))), L = LPC_LIGHT[lv];
    const ts = Math.min(5, Math.max(1, lpcIv(g.tap && g.tap.score, 1))), T = LPC_TAP[ts];
    const open = this._chip[p.entity] || null;
    const pct = Math.min(100, Math.max(0, lpcIv(dry.pct, 25)));
    const soilMeter = water ? '<span class="mt wet"><ha-icon icon="mdi:water"></ha-icon></span>' : `<span class="mt"><span style="height:${pct}%"></span></span>`;
    const lightMeter = `<span class="lb">${[1, 2, 3, 4].map((n) => `<span class="${n <= lv ? 'f' : ''}" style="height:${3 + n * 3}px"></span>`).join('')}</span>`;
    const tapMeter = `<span class="td">${[1, 2, 3, 4, 5].map((n) => `<span class="${n <= ts ? 'f' : ''}"></span>`).join('')}</span>`;
    const chip = (key, color, cap, meter, val, sub) => `<button class="gc${open === key ? ' on' : ''}" style="--gk:${color}" data-act="chip" data-ent="${ent}" data-val="${key}" aria-expanded="${open === key}"><span class="gh"><i>${cap}</i>${meter}</span><b>${this._esc(val)}</b>${sub ? `<small>${this._esc(sub)}</small>` : ''}</button>`;
    const chips = `<div class="chips">
      ${chip('dry', water ? '#38bdf8' : '#c08a52', water ? 'Kept in' : 'Water at', soilMeter, water ? (dry.label || 'Water') : `${dry.label || 'Top'} dry`, water ? (dry.sub || '') : `${dry.sub || ''}${winter && d0.rest ? `${dry.sub ? ' · ' : ''}winter` : ''}`)}
      ${chip('light', '#fde68a', 'Light', lightMeter, (g.light && g.light.label) || L.name, L.fc)}
      ${chip('tap', T.color, 'Tap water', tapMeter, `${ts} / 5`, T.name)}
    </div>`;
    let ex;
    if (open === 'dry') {
      ex = water
        ? `<ha-icon icon="mdi:water"></ha-icon><span><b>Kept in water.</b> ${this._esc(dry.tip || '')}</span>`
        : `<ha-icon icon="mdi:water-percent"></ha-icon><span><b>Water when the ${this._esc(String(dry.label || 'top').toLowerCase())} of the pot is dry${dry.sub ? ` (${this._esc(dry.sub)})` : ''}.</b> ${this._esc(dry.tip || '')}${winter && d0.rest ? ` <i>Winter value — the spring–summer target is ${this._esc(String(d0.label || '').toLowerCase())}${d0.sub ? ` (${this._esc(d0.sub)})` : ''}.</i>` : ''}</span>`;
    } else if (open === 'light') {
      ex = `<ha-icon icon="mdi:white-balance-sunny"></ha-icon><span><b>${lv}/4 · ${this._esc(L.name)} — ${L.fc} (${L.lux}).</b> ${this._esc(L.where)} ${this._esc((g.light && g.light.note) || '')}</span>`;
    } else if (open === 'tap') {
      ex = `<ha-icon icon="mdi:faucet"></ha-icon><span><b>${ts}/5 · ${this._esc(T.name)}.</b> ${this._esc((g.tap && g.tap.note) || '')} ${this._esc(T.tip)}${ts >= 3 ? ` ${this._esc(LPC_TAP_FOOT)}` : ''}</span>`;
    }
    const gx = ex ? `<div class="gx" style="--gk:${open === 'dry' ? (water ? '#38bdf8' : '#c08a52') : open === 'light' ? '#fde68a' : T.color}">${ex}</div>` : '<div class="gx hint"><ha-icon icon="mdi:gesture-tap"></ha-icon><span>Tap a label for what it means.</span></div>';
    const st = g.steps || {};
    const steps = LPC_STEPS.filter(([k]) => st[k]).map(([k, t, icon]) => `<li><span class="si"><ha-icon icon="${icon}"></ha-icon></span><div><b>${t}</b><p>${this._esc(st[k])}</p></div></li>`).join('');
    return `<div class="guide">${chips}${gx}${steps ? `<ol class="steps">${steps}</ol>` : ''}</div>`;
  }

  _tile(m, i, season) {
    const p = m.p, sc = LPC_STATUS[m.status], ent = this._esc(p.entity);
    const busy = this._busy[p.entity], care = !!this._care[p.entity];
    const urgent = lpcNeeds(m.status) || m.status === 'unlogged';
    const just = this._just[p.entity] && Date.now() - this._just[p.entity] < 1600;
    const on = !m.glSt || m.glSt.on;
    const next = m.status === 'settle' ? this._date(m.settle.until)
      : m.status === 'paused' ? (p.hold ? p.hold : season === 'rest' && !m.lit ? `${this._nextGrowMonth()} (season starts)` : '—')
      : m.last && m.iv ? this._date(new Date(m.last.getTime() + m.iv * 86400000)) : 'As soon as you feed';
    const base = p.hold && !m.grow && !m.litIv && !m.rest
      ? `Feeding on hold — ${p.hold.charAt(0).toLowerCase()}${p.hold.slice(1)}`
      : [`Growing ${m.grow ? this._span(m.grow) : '— none'}`, m.litIv ? `grow light ${this._span(m.litIv)}` : 'grow light — none', m.rest ? `window ${this._span(m.rest)}` : 'window — rests'].join(' · ');
    const sched = m.settle ? `Moved under the ${m.gl ? m.gl.name.toLowerCase() : 'grow light'} — no food for ${m.settle.days} days while it adjusts (first feed ${this._date(m.settle.until)}). Then: ${base}` : base;
    const w = m.wat;
    const wSched = !w || w.status === 'missing' ? ''
      : w.learning ? ` · watering: learning — needs ${w.S.learn} gaps between logged waterings (${w.gaps.length} so far)`
      : ` · watering: usually every ~${this._typ(w.learned)} d (middle of the last ${w.recent.length} gaps), check the soil from day ${w.checkDay}`;
    const where = m.lit
      ? `<ha-icon icon="${on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline'}"></ha-icon>${this._esc(m.gl ? m.gl.name : 'Grow light')}${m.glSt && m.glSt.un ? ' · offline' : on ? '' : ' · off'}`
      : `<ha-icon icon="mdi:window-closed-variant"></ha-icon>${this._esc(m.loc || 'Window')}`;
    return `<article class="tile s-${m.status}${just ? ' just' : ''}" id="lpc-${i}" style="--pc:${this._esc(p.color || '#4ade80')};--sc:${sc}">
  <div class="art${m.lit ? ' lit' : ''}${m.lit && on ? ' on' : ''}">
    ${this._svg(m, i)}
    <span class="pill st"><span class="dot"></span>${this._esc(this._status(m, season))}</span>
    <span class="pill where">${where}</span>
  </div>
  <div class="body">
    <div class="head">
      <div class="nm"><h3>${this._esc(p.name)}</h3><span class="sp">${this._esc(p.species || p.sub || '')}</span></div>
      ${this._ring(m)}
    </div>
    <dl class="facts">
      <div><dt>Last fed</dt><dd>${m.last ? `${this._date(m.last)} <i>· ${this._ago(m.since, m.last)}</i>` : '<i>Not logged</i>'}</dd></div>
      <div><dt>${m.status === 'settle' ? 'First feed' : 'Next feed'}</dt><dd>${this._esc(next)}</dd></div>
      <div><dt>Every</dt><dd>${m.iv ? this._span(m.iv) : `<i>${p.hold ? 'On hold' : 'Not this season'}</i>`}</dd></div>
      <div><dt>Dose</dt><dd>${this._esc(p.dose || '—')}</dd></div>
    </dl>
    ${w ? this._wat(m) : ''}
    ${this._lightRow(m)}
    ${this._humRow(m)}
    ${m.water ? this._water(m.water) : ''}
    <div class="acts">
      <button class="btn feed${urgent ? ' go' : ''}" data-act="feed" data-val="${ent}" ${busy || m.status === 'missing' ? 'disabled' : ''}>${busy ? '<ha-icon class="spin" icon="mdi:loading"></ha-icon>' : `<ha-icon icon="mdi:bottle-tonic-plus-outline"></ha-icon>${urgent ? 'Feed now' : 'Fed today'}`}</button>
      <button class="btn sec" data-act="yesterday" data-val="${ent}" title="Log a feeding yesterday">Yesterday</button>
      <label class="btn sec pick" title="Log a feeding on another date"><ha-icon icon="mdi:calendar-edit"></ha-icon><input type="date" data-act="pick" data-val="${ent}" max="${this._key(new Date())}" value="${m.last ? this._key(m.last) : ''}" aria-label="Pick the date ${this._esc(p.name)} was fed"></label>
    </div>
    <div class="foot">
      ${this._locSeg(m)}
      <button class="more${care ? ' open' : ''}" data-act="care" data-val="${ent}" aria-expanded="${care}"><ha-icon icon="mdi:book-open-page-variant-outline"></ha-icon>Care guide<ha-icon class="chev" icon="mdi:chevron-down"></ha-icon></button>
    </div>
    <div class="care${care ? ' open' : ''}"><div class="ci">
      ${this._guide(m, season)}
      <div class="sched"><ha-icon icon="mdi:calendar-sync-outline"></ha-icon><span>${this._esc(sched)}${m.water ? ` · fresh water every ${this._span(m.water.iv)}` : ''}${this._esc(wSched)}</span></div>
      ${m.last ? `<button class="clear" data-act="clear" data-val="${ent}">Clear last feeding</button>` : ''}
      ${w && w.last ? `<button class="clear" data-act="wclear" data-val="${ent}" data-day="${w.last}">Remove last watering (${this._date(lpcDayOf(w.last))})</button>` : ''}
    </div></div>
  </div>
</article>`;
  }

  _paint() {
    if (!this.shadowRoot || !this._config) return;
    const cfg = this._config;
    if (!this._hass) { LwMorph.patch(this._root, `${this._css()}<div class="card"><div class="sk"></div></div>`); return; }
    const season = this._season = lpcSeason(this._grow);
    const models = cfg.plants.map((p, i) => ({ ...lpcModel(this._hass, cfg, p, season), i }));
    const lights = lpcLights(cfg).map((l) => lpcLightState(this._hass, l));
    const onN = lights.filter((s) => s.on).length;
    const need = models.filter((m) => lpcNeeds(m.status) || m.status === 'unlogged' || (m.water && lpcNeeds(m.water.status)) || (m.wat && m.wat.need));
    const dueN = models.filter((m) => lpcNeeds(m.status)).length + models.filter((m) => m.water && lpcNeeds(m.water.status)).length + models.filter((m) => m.wat && m.wat.need).length;
    const week = models.filter((m) => (m.status === 'soon' || m.status === 'ok') && m.left <= 7).length;
    const resting = models.filter((m) => m.status === 'paused' || m.status === 'settle').length;
    const litN = models.filter((m) => m.lit).length;
    const upcoming = models.filter((m) => (m.status === 'soon' || m.status === 'ok') && m.left > 0).sort((a, b) => a.left - b.left)[0];
    const headline = dueN ? `${dueN} thing${dueN > 1 ? 's' : ''} to do today` : need.length ? `${need.length} plant${need.length > 1 ? 's' : ''} to log` : 'Everyone’s looked after';
    const subline = upcoming ? `Next up: ${upcoming.p.name} in ${this._span(upcoming.left)}` : '';
    const lightsLine = lights.length ? ` · ${onN ? `${onN} of ${lights.length} lights on` : 'lights off'}` : '';
    const sn = season === 'growing'
      ? { label: 'Growing season', icon: 'mdi:white-balance-sunny', color: '#4ade80', hint: 'Everything on its full feeding schedule' }
      : { label: 'Resting season', icon: 'mdi:weather-night', color: '#94a3b8', hint: 'Window plants slow down · grow-light plants keep feeding' };
    const locs = [];
    models.forEach((m) => { const l = m.group || 'Other'; const f = locs.find((x) => x.l === l); if (f) f.n++; else locs.push({ l, n: 1, lit: m.lit }); });
    if (this._filter !== 'all' && !locs.some((x) => x.l === this._filter)) this._filter = 'all';
    const shown = models.filter((m) => this._filter === 'all' || (m.group || 'Other') === this._filter);
    /* one chip per thing to do: feeding, fresh water, watering */
    const tasks = [];
    models.forEach((m) => {
      if (lpcNeeds(m.status) || m.status === 'unlogged') tasks.push({ m, txt: this._status(m, season), c: LPC_STATUS[m.status] });
      if (m.water && lpcNeeds(m.water.status)) tasks.push({ m, txt: `Water · ${this._wStatus(m.water)}`, c: LPC_STATUS[m.water.status] });
      if (m.wat && m.wat.need) tasks.push({ m, txt: m.wat.status === 'overdue' ? 'Probably dry' : 'Check soil', c: LPC_STATUS[m.wat.status] });
    });
    const chips = tasks.map(({ m, txt, c }) => `<button class="chip" data-act="jump" data-val="lpc-${m.i}" style="--sc:${c};--pc:${this._esc(m.p.color || '#4ade80')}"><span class="cd"></span><b>${this._esc(m.p.name)}</b><span>${this._esc(txt)}</span></button>`).join('');
    const u = this._undo;
    LwMorph.patch(this._root, `${this._css()}
<div class="card">
  <header class="hero">
    <div class="hl">
      <span class="ttl">${this._esc(cfg.title || 'Plant care')}</span>
      <span class="big${dueN ? ' warn' : ''}">${headline}</span>
      <span class="sub">${models.length} plants · ${litN} under grow lights${lightsLine}${subline ? ` · ${this._esc(subline)}` : ''}</span>
    </div>
    <div class="season" style="--sn:${sn.color}"><ha-icon icon="${sn.icon}"></ha-icon><span><b>${sn.label}</b><i>${this._range(season)} · ${sn.hint}</i></span></div>
  </header>
  <div class="stats">
    <div class="stat${dueN ? ' hot' : ''}"><b>${dueN}</b><span>Due today</span></div>
    <div class="stat"><b>${week}</b><span>This week</span></div>
    <div class="stat"><b>${resting}</b><span>Resting / settling</span></div>
    <div class="stat"><b>${models.filter((m) => m.status === 'unlogged').length}</b><span>Never logged</span></div>
  </div>
  ${chips ? `<div class="attn"><span class="al">Needs you</span>${chips}</div>` : ''}
  <nav class="filters" aria-label="Filter by light or location">
    <button class="${this._filter === 'all' ? 'on' : ''}" data-act="filter" data-val="all">All <i>${models.length}</i></button>
    ${locs.map((x) => `<button class="${this._filter === x.l ? 'on' : ''}" data-act="filter" data-val="${this._esc(x.l)}"><ha-icon icon="${x.lit ? 'mdi:lightbulb-on-outline' : 'mdi:window-closed-variant'}"></ha-icon>${this._esc(x.l)} <i>${x.n}</i></button>`).join('')}
  </nav>
  <div class="grid">${shown.map((m) => this._tile(m, m.i, season)).join('')}</div>
  ${u ? `<div class="undo"><span><ha-icon icon="mdi:check-circle"></ha-icon>Logged ${this._esc(u.what)} · <b>${this._esc(u.name)}</b></span><button data-act="undo">Undo</button></div>` : ''}
  ${this._err ? `<div class="err">${this._esc(this._err)}</div>` : ''}
</div>`);
  }

  /* ---------- humidifier popup: humidity + temperature history, on/off, Auto ---------- */
  _hxEnts(h) { return { sw: h.entity, power: h.power, hum: h.history_humidity || h.humidity, temp: h.temperature, auto: h.automation }; }
  _hxOpen(plantEntity) {
    const p = this._config.plants.find((x) => x.entity === plantEntity);
    if (!p || !p.humidifier || !p.humidifier.entity || !this._dlg || !this._hass) return;
    this._hx = { p, h: p.humidifier, range: this._hxRange || 24, data: null, err: null, hov: null, busy: null };
    this._hxSig = '';
    this._hxPaint();
    if (!this._dlg.open) { try { this._dlg.showModal(); } catch (e) { this._dlg.setAttribute('open', ''); } }
    clearInterval(this._hxTick);
    this._hxTick = setInterval(() => this._hxPaint(), 30000);      // keeps "Reported … ago" current
    this._hxFetch();
  }
  async _hxFetch() {
    const x = this._hx; if (!x || !this._hass) return;
    const e = this._hxEnts(x.h), ids = [e.hum, e.temp, e.sw].filter(Boolean);
    const t1 = Date.now(), t0 = t1 - x.range * 3600000, tok = (this._hxTok = (this._hxTok || 0) + 1);
    x.data = null; x.err = null; this._hxPaint();
    try {
      const r = await this._hass.callWS({
        type: 'history/history_during_period', start_time: new Date(t0).toISOString(), end_time: new Date(t1).toISOString(),
        entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false,
      });
      if (tok !== this._hxTok || this._hx !== x) return;
      x.data = { hum: lpcHxRows(r[e.hum], true), temp: e.temp ? lpcHxRows(r[e.temp], true) : [], sw: lpcHxRows(r[e.sw], false) };
    } catch (err) {
      if (tok !== this._hxTok || this._hx !== x) return;
      x.err = (err && err.message) || 'Couldn’t load the history';
    }
    this._hxPaint();
  }
  /* new readings while the popup is open are appended, so the lines keep moving without re-fetching */
  _hxLive(hass) {
    const x = this._hx; if (!x || !x.data) return;
    const e = this._hxEnts(x.h);
    [['hum', e.hum, true], ['temp', e.temp, true], ['sw', e.sw, false]].forEach(([k, id, num]) => {
      const s = id && hass.states[id]; if (!s) return;
      const t = Date.parse(s.last_changed), arr = x.data[k], last = arr[arr.length - 1];
      if (!isFinite(t) || (last && last.t >= t)) return;
      if (num) { const v = parseFloat(s.state); arr.push({ t, v: isFinite(v) ? v : null }); } else arr.push({ t, s: s.state });
    });
  }
  async _hxDo(kind) {
    const x = this._hx; if (!x || x.busy || !this._hass) return;
    const e = this._hxEnts(x.h), id = kind === 'sw' ? e.sw : e.auto, s = id && this._hass.states[id];
    if (!s) return;
    x.busy = kind; this._hxPaint();
    await this._call(id.split('.')[0], s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: id });
    if (this._hx === x) { x.busy = null; this._hxPaint(); }
  }
  _hxPoint(ev, down) {
    const x = this._hx; if (!x || !x.data || !x.view) return;
    const plot = ev.composedPath().find((n) => n.classList && n.classList.contains('hxp'));
    if (!plot) { if (x.hov != null && (ev.pointerType === 'mouse' || down)) { x.hov = null; this._hxQueue(); } return; }
    const r = plot.getBoundingClientRect(), f = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    x.hov = x.view.t0 + f * (x.view.t1 - x.view.t0); this._hxQueue();
  }
  _hxQueue() { if (this._hxRaf) return; this._hxRaf = requestAnimationFrame(() => { this._hxRaf = 0; this._hxPaint(); }); }
  _hxPaint() { if (this._dlg && this._hx && this._hass) LwMorph.patch(this._dlg, this._hxHtml()); }
  _hxWhen(t) {
    const d = new Date(t), today = new Date().toDateString() === d.toDateString();
    const tm = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return today ? tm : `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${tm}`;
  }
  _hxNum(v, dg) { return v == null || !isFinite(v) ? '—' : v.toFixed(dg); }

  /* one history chart: line + soft fill, target band, humidifier-on spans, "sensor moved" marker, hover readout */
  _hxChart(o) {
    const x = this._hx, { t0, t1 } = x.view;
    const head = (right) => `<div class="hxch"><span class="hxct"><ha-icon icon="${o.icon}"></ha-icon>${o.title}</span>${right}</div>`;
    if (x.err) return `<section class="hxc">${head('')}<div class="hxmsg">${this._esc(x.err)}</div></section>`;
    if (!x.data) return `<section class="hxc">${head('')}<div class="hxsk"></div></section>`;
    /* readings inside the window; the one in force at the start is pinned to the left edge, the latest held to now */
    const raw = o.pts, vis = [];
    let prev = null;
    raw.forEach((p) => { if (p.t < t0) prev = p; else vis.push(p); });
    if (prev) vis.unshift({ t: t0, v: prev.v });
    const lastV = vis.length ? vis[vis.length - 1] : null;
    if (lastV && lastV.v != null && lastV.t < t1) vis.push({ t: t1, v: lastV.v });
    const vals = vis.filter((p) => p.v != null).map((p) => p.v);
    if (!vals.length) return `<section class="hxc">${head('')}<div class="hxmsg">No readings in this period</div></section>`;
    const since = o.since && o.since > t0 && o.since < t1 ? o.since : null;
    const st = lpcHxStats(vis, t0, t1, since, o.atLeast);
    let y0 = Math.min(...vals), y1 = Math.max(...vals);
    if (o.band && o.fitBand) { y0 = Math.min(y0, o.band[0]); y1 = Math.max(y1, o.band[1]); }
    y0 -= o.pad; y1 += o.pad;
    if (y1 - y0 < o.minSpan) { const c = (y0 + y1) / 2; y0 = c - o.minSpan / 2; y1 = c + o.minSpan / 2; }
    const step = lpcHxStep(y1 - y0); y0 = Math.floor(y0 / step) * step; y1 = Math.ceil(y1 / step) * step;
    const W = 600, H = 150, X = (t) => ((t - t0) / (t1 - t0)) * W, Y = (v) => H - ((v - y0) / (y1 - y0)) * H;
    const pts = lpcHxThin(vis, t0, t1, 360);
    let line = '', area = '', seg = [];
    const close = () => {
      if (!seg.length) return;
      line += `M${seg.map(([a, b]) => `${f1(a)},${f1(b)}`).join('L')}`;
      area += `M${f1(seg[0][0])},${H}L${seg.map(([a, b]) => `${f1(a)},${f1(b)}`).join('L')}L${f1(seg[seg.length - 1][0])},${H}Z`;
      seg = [];
    };
    pts.forEach((p) => { if (p.v == null) close(); else seg.push([X(p.t), Y(p.v)]); });
    close();
    const grid = [];
    for (let v = y0 + step; v < y1 - step / 10; v += step) grid.push(v);
    const pct = (v) => f1((Y(v) / H) * 100);
    /* time ticks: every 6 h for a day, midnights for longer ranges */
    const ticks = [], tk = new Date(t0);
    if (x.range <= 24) { tk.setMinutes(0, 0, 0); const hs = x.range <= 6 ? 1 : 6; tk.setHours(Math.ceil(tk.getHours() / hs) * hs); } else { tk.setHours(24, 0, 0, 0); }
    for (let g = 0; g < 12 && tk.getTime() < t1; g++) {
      const t = tk.getTime();
      if (t > t0) ticks.push({ t, l: x.range <= 24 ? tk.toLocaleTimeString(undefined, x.range <= 6 ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' }) : tk.toLocaleDateString(undefined, { weekday: 'short' }) });
      if (x.range <= 24) tk.setHours(tk.getHours() + (x.range <= 6 ? 1 : 6)); else tk.setDate(tk.getDate() + 1);
    }
    const band = o.band ? [Math.max(o.band[0], y0), Math.min(o.band[1], y1)] : null;
    const spans = (o.spans || []).map(([a, b]) => `<rect class="on" x="${f1(X(a))}" y="0" width="${f1(Math.max(1.5, X(b) - X(a)))}" height="${H}"/><rect class="onb" x="${f1(X(a))}" y="${H - 5}" width="${f1(Math.max(1.5, X(b) - X(a)))}" height="5"/>`).join('');
    /* hover */
    let right, cur = '';
    if (x.hov != null) {
      const at = lpcHxAt(vis, x.hov);
      const v = at ? at.v : null, onAt = (o.spans || []).some(([a, b]) => x.hov >= a && x.hov <= b);
      right = `<span class="hxrd"><b>${this._hxNum(v, o.dg)}${o.unit}</b><i>${this._esc(this._hxWhen(x.hov))}${o.spans ? ` · <em class="${onAt ? 'on' : ''}">humidifier ${onAt ? 'on' : 'off'}</em>` : ''}</i></span>`;
      cur = `<span class="hxcur" style="left:${f1(((x.hov - t0) / (t1 - t0)) * 100)}%"></span>${v != null ? `<span class="hxdot" style="left:${f1(((x.hov - t0) / (t1 - t0)) * 100)}%;top:${pct(v)}%"></span>` : ''}`;
    } else {
      const now = o.now != null && isFinite(o.now) ? o.now : vals[vals.length - 1];
      right = `<span class="hxrd"><b>${this._hxNum(now, o.dg)}${o.unit}</b>${st ? `<i>low ${this._hxNum(st.lo, o.dg)} · high ${this._hxNum(st.hi, o.dg)} · avg ${this._hxNum(st.avg, o.dg)}</i>` : ''}</span>`;
    }
    const sx = since ? f1(X(since)) : null;
    return `<section class="hxc" style="--lc:${o.color}">
  ${head(right)}
  <div class="hxp">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="hxg-${o.key}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.color}" stop-opacity=".28"/><stop offset="1" stop-color="${o.color}" stop-opacity="0"/></linearGradient></defs>
      ${spans}
      ${band && band[1] > band[0] ? `<rect class="band" x="0" y="${f1(Y(band[1]))}" width="${W}" height="${f1(Y(band[0]) - Y(band[1]))}"/>` : ''}
      ${grid.map((v) => `<line class="gl" x1="0" x2="${W}" y1="${f1(Y(v))}" y2="${f1(Y(v))}"/>`).join('')}
      ${ticks.map((k) => `<line class="gv" x1="${f1(X(k.t))}" x2="${f1(X(k.t))}" y1="0" y2="${H}"/>`).join('')}
      <path class="ar" d="${area}" fill="url(#hxg-${o.key})"/>
      <path class="ln" d="${line}"/>
      ${sx != null ? `<rect class="old" x="0" y="0" width="${sx}" height="${H}"/><line class="mv" x1="${sx}" x2="${sx}" y1="0" y2="${H}"/>` : ''}
    </svg>
    ${grid.map((v) => `<span class="hxy" style="top:${pct(v)}%">${v % 1 ? v.toFixed(1) : v}</span>`).join('')}
    ${band && o.bandLabel && band[1] > band[0] ? `<span class="hxbl" style="top:${pct(band[1])}%">${o.bandLabel}</span>` : ''}
    ${sx != null && X(since) > 70 ? `<span class="hxmv" style="right:${f1(100 - (X(since) / W) * 100)}%">${this._esc(o.sinceLabel || 'Earlier readings')}</span>` : ''}
    ${cur}
  </div>
  <div class="hxx-ax">${ticks.map((k) => { const l = ((k.t - t0) / (t1 - t0)) * 100; return l > 4 && l < 96 ? `<span style="left:${f1(l)}%">${this._esc(k.l)}</span>` : ''; }).join('')}</div>
  ${o.foot ? `<div class="hxft">${o.foot}</div>` : ''}
</section>`;
  }

  _hxHtml() {
    const x = this._hx, h = x.h, hass = this._hass, e = this._hxEnts(h);
    const lo = lpcIv(h.low, 55), hi = lpcIv(h.high, 60), tlo = lpcIv(h.temp_low, 65), thi = lpcIv(h.temp_high, 75);
    const s = lpcHum(hass, h);
    const sw = hass.states[e.sw], pw = e.power ? hass.states[e.power] : null, au = e.auto ? hass.states[e.auto] : null;
    const hS = hass.states[e.hum], tS = e.temp ? hass.states[e.temp] : null;
    const hv = hS ? parseFloat(hS.state) : NaN, tv = tS ? parseFloat(tS.state) : NaN;
    const tu = (tS && tS.attributes && tS.attributes.unit_of_measurement) || '°';
    const on = !!sw && sw.state === 'on', un = s.status === 'un', auto = au ? au.state === 'on' : null;
    const w = pw ? parseFloat(pw.state) : NaN;
    const t1 = Date.now(), t0 = t1 - x.range * 3600000;
    /* when a sensor last checked in: last_reported (also bumped by unchanged readings) or last_updated */
    const repOf = (st, show) => {
      if (!show) return '';
      const at = st ? Math.max(Date.parse(st.last_reported) || 0, Date.parse(st.last_updated) || 0) : 0;
      const off = !st || st.state === 'unavailable' || st.state === 'unknown';
      const stale = !!at && t1 - at > lpcIv(h.stale_minutes, 120) * 60000;
      return `<div class="hxrep${off || stale ? ' stale' : ''}" title="${at ? this._esc(new Date(at).toLocaleString()) : ''}"><span class="d"></span>${off ? 'Sensor offline' : at ? `Reported ${lpcAgo(t1 - at)}${stale ? ' · check battery' : ''}` : 'No report yet'}</div>`;
    };
    const hRep = repOf(hS, true), rep = repOf(tS, !!e.temp);
    x.view = { t0, t1 };
    const since = h.since ? Date.parse(h.since) : null;
    const word = { run: 'Running', idle: 'Off', dry: 'On — but not running', un: 'Offline' }[s.status];
    const when = sw && isFinite(Date.parse(sw.last_changed)) ? ` since ${this._hxWhen(Date.parse(sw.last_changed))}` : '';
    const hm = !isFinite(hv) ? ['#9aa0aa', 'No reading'] : hv < lo ? ['#f5b83d', 'Too dry'] : hv <= hi ? ['#4ade80', 'Just right'] : ['#7dd3fc', 'Humid'];
    const tm = !isFinite(tv) ? ['#9aa0aa', 'No reading'] : tv < tlo ? ['#7dd3fc', 'Cool'] : tv <= thi ? ['#4ade80', 'Comfortable'] : ['#f5b83d', 'Warm'];
    const note = un ? 'The humidifier’s plug isn’t responding.'
      : s.status === 'dry' ? 'It’s switched on but isn’t drawing any power — the tank is probably empty.'
      : auto === true ? `Auto turns it on below ${lo}% and off at ${hi}%. If you switch it yourself, that holds until the air next crosses ${lo}% or ${hi}%.`
      : auto === false ? 'Auto is paused — the humidifier stays the way you leave it until you turn Auto back on.' : '';
    const d = x.data;
    const spans = d ? lpcHxSpans(d.sw, t0, t1) : [];
    const ran = spans.reduce((a, [p, q]) => a + (q - p), 0);
    const hst = d ? lpcHxStats(d.hum, t0, t1, since && since > t0 ? since : null, lo) : null;
    const humFoot = d ? `<span class="hxpill on"><i></i>Ran ${ran ? lpcDur(ran) : 'not at all'}${spans.length > 1 ? ` · ${spans.length} times` : ''}</span>${hst && hst.above != null ? `<span class="hxpill"><i class="ok"></i>At or above ${lo}% for ${Math.round(hst.above * 100)}% of the time</span>` : ''}` : '';
    const busy = x.busy;
    return `<div class="hxw">
  <header class="hxh">
    <span class="hxi${s.status === 'run' ? ' on' : ''}${s.status === 'dry' || un ? ' warn' : ''}"><ha-icon icon="${s.status === 'run' ? 'mdi:air-humidifier' : 'mdi:air-humidifier-off'}"></ha-icon></span>
    <span class="hxt"><b>${this._esc(x.p.name)} humidifier</b><i>${word}${s.status !== 'un' ? when : ''}${on && isFinite(w) ? ` · ${lpcWatts(w)} W` : ''}</i></span>
    <button class="hxclose" data-act="hxclose" aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button>
  </header>
  <div class="hxnow">
    <div class="hxk" style="--k:${hm[0]}"><span><ha-icon icon="mdi:water-percent"></ha-icon>Humidity</span><b>${isFinite(hv) ? Math.round(hv) : '—'}<small>%</small></b><i><em>${hm[1]}</em> · target ${lo}–${hi}%</i>${hRep}</div>
    <div class="hxk" style="--k:${tm[0]}"><span><ha-icon icon="mdi:thermometer"></ha-icon>Temperature</span><b>${isFinite(tv) ? tv.toFixed(1) : '—'}<small>${this._esc(tu)}</small></b><i><em>${tm[1]}</em> · ${tlo}–${thi}${this._esc(tu)}</i>${rep}</div>
  </div>
  <div class="hxctl">
    <button class="hxsw${on ? ' on' : ''}" data-act="hxsw" ${un || busy ? 'disabled' : ''} aria-pressed="${on}">
      <span class="hxpw">${busy === 'sw' ? '<ha-icon class="spin" icon="mdi:loading"></ha-icon>' : '<ha-icon icon="mdi:power"></ha-icon>'}</span>
      <span class="hxsl"><b>${un ? 'Offline' : on ? 'On' : 'Off'}</b><i>${un ? 'Plug not responding' : `Tap to turn ${on ? 'off' : 'on'}`}</i></span>
    </button>
    ${au ? `<button class="hxau${auto ? ' on' : ''}" data-act="hxauto" role="switch" aria-checked="${!!auto}" ${busy ? 'disabled' : ''}>
      <span class="hxsl"><b>Auto</b><i>${auto ? `Keeps ${lo}–${hi}%` : 'Paused'}</i></span>
      <span class="tg">${busy === 'auto' ? '<ha-icon class="spin" icon="mdi:loading"></ha-icon>' : '<span></span>'}</span>
    </button>` : ''}
  </div>
  ${note ? `<p class="hxnote${s.status === 'dry' || un ? ' warn' : auto === false ? ' paused' : ''}"><ha-icon icon="${s.status === 'dry' ? 'mdi:water-alert-outline' : un ? 'mdi:power-plug-off-outline' : auto === false ? 'mdi:pause-circle-outline' : 'mdi:information-outline'}"></ha-icon><span>${note}</span></p>` : ''}
  <div class="hxbar"><span class="hxlbl">History</span>
    <nav class="hxr" aria-label="History range">${LPC_HX_RANGES.map(([r, l]) => `<button class="${r === x.range ? 'on' : ''}" data-act="hxrange" data-val="${r}" aria-pressed="${r === x.range}">${l}</button>`).join('')}</nav>
  </div>
  ${this._hxChart({ key: 'h', title: 'Humidity', icon: 'mdi:water-percent', color: '#38bdf8', unit: '%', dg: 0, pts: d ? d.hum : [], now: hv, band: [lo, hi], fitBand: true, bandLabel: `${lo}–${hi}% target`, pad: 3, minSpan: 10, spans, atLeast: lo, since, sinceLabel: h.since_label, foot: humFoot })}
  ${e.temp ? this._hxChart({ key: 't', title: 'Temperature', icon: 'mdi:thermometer', color: '#fb923c', unit: tu, dg: 1, pts: d ? d.temp : [], now: tv, band: [tlo, thi], fitBand: false, bandLabel: 'comfort range', pad: 1, minSpan: 4, since, sinceLabel: h.since_label })
    : ''}
  ${this._err ? `<div class="hxmsg err">${this._esc(this._err)}</div>` : ''}
</div>`;
  }

  _css() {
    return `<style>
:host { display:block; }
* { box-sizing:border-box; }
button, .btn { font:inherit; color:inherit; background:none; border:none; padding:0; cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
button:disabled { cursor:default; opacity:.5; }
ha-icon { --mdc-icon-size:18px; display:inline-flex; flex:none; }
.card { container-type:inline-size; position:relative; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.07); border-radius:28px; padding:22px; color:#f3f4f6; font-family:var(--ha-font-family-body, Roboto, sans-serif); }
.hero { display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:14px 20px; }
.hl { display:flex; flex-direction:column; gap:4px; min-width:0; }
.ttl { font-size:13px; letter-spacing:.14em; font-weight:600; color:#8b919c; text-transform:uppercase; }
.big { font-size:clamp(22px, 3.2cqi, 30px); font-weight:700; letter-spacing:-.02em; line-height:1.15; }
.big.warn { color:#f5b83d; }
.sub { font-size:14px; color:#9aa0aa; }
.season { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:16px; background:color-mix(in srgb, var(--sn) 11%, transparent); border:1px solid color-mix(in srgb, var(--sn) 28%, transparent); max-width:380px; }
.season ha-icon { color:var(--sn); --mdc-icon-size:22px; }
.season span { display:flex; flex-direction:column; gap:2px; }
.season b { font-size:14px; color:var(--sn); }
.season i { font-style:normal; font-size:12px; color:#9aa0aa; line-height:1.35; }
.stats { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:10px; margin-top:18px; }
.stat { padding:12px 14px; border-radius:16px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:2px; }
.stat b { font-size:24px; font-weight:700; font-variant-numeric:tabular-nums; }
.stat span { font-size:12px; color:#9aa0aa; }
.stat.hot { background:linear-gradient(145deg, rgba(245,184,61,0.16), rgba(245,184,61,0.04)); border-color:rgba(245,184,61,0.38); }
.stat.hot b { color:#f5b83d; }
.attn { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:14px; }
.al { font-size:11px; letter-spacing:.14em; font-weight:700; color:#8b919c; text-transform:uppercase; margin-right:2px; }
.chip { display:inline-flex; align-items:center; gap:7px; padding:7px 12px 7px 10px; border-radius:12px; background:color-mix(in srgb, var(--sc) 12%, transparent); border:1px solid color-mix(in srgb, var(--sc) 36%, transparent); font-size:13px; }
.chip .cd { width:8px; height:8px; border-radius:50%; background:var(--sc); box-shadow:0 0 8px var(--sc); }
.chip span { color:var(--sc); font-weight:600; }
.filters { display:flex; flex-wrap:wrap; gap:6px; margin:18px 0 14px; }
.filters button { display:inline-flex; align-items:center; gap:6px; padding:8px 13px; border-radius:12px; background:rgba(255,255,255,0.045); border:1px solid rgba(255,255,255,0.06); font-size:13px; font-weight:600; color:#cbd5e1; }
.filters button i { font-style:normal; color:#8b919c; font-weight:500; }
.filters button ha-icon { --mdc-icon-size:15px; color:#8b919c; }
.filters button.on { background:rgba(245,184,61,0.15); border-color:rgba(245,184,61,0.45); color:#fde68a; }
.filters button.on i, .filters button.on ha-icon { color:#f5b83d; }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap:16px; }
/* ---- plant tile ---- */
.tile { position:relative; display:flex; flex-direction:column; border-radius:24px; overflow:hidden; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); scroll-margin:90px; transition:border-color .3s, box-shadow .3s; }
.tile.s-overdue { border-color:rgba(248,113,113,0.35); }
.tile.s-due, .tile.s-unlogged { border-color:rgba(245,184,61,0.32); }
.tile.ping { animation:ping 1.4s ease; }
.art { position:relative; height:250px; background:radial-gradient(120% 80% at 50% 105%, color-mix(in srgb, var(--pc) 16%, transparent), transparent 60%), linear-gradient(180deg, #171c27, #0f131a); }
.art.lit.on { background:radial-gradient(90% 75% at 50% 0%, rgba(253,230,138,.20), transparent 62%), radial-gradient(120% 80% at 50% 105%, color-mix(in srgb, var(--pc) 16%, transparent), transparent 60%), linear-gradient(180deg, #1c1d22, #0f131a); }
.art::after { content:''; position:absolute; left:0; right:0; bottom:0; height:1px; background:rgba(255,255,255,0.06); }
.art svg { position:absolute; inset:14px 0 0; width:100%; height:calc(100% - 14px); }
.art .fallback { position:absolute; inset:0; margin:auto; --mdc-icon-size:72px; color:var(--pc); width:72px; height:72px; }
.sway { transform-box:fill-box; transform-origin:50% 100%; animation:sway 8s ease-in-out infinite; animation-delay:calc(var(--d) * -1); }
.beam { animation:beam 4.5s ease-in-out infinite; }
.tile.just .art::before { content:''; position:absolute; inset:0; z-index:1; background:radial-gradient(60% 50% at 50% 70%, rgba(74,222,128,.42), transparent 70%); animation:fed 1.5s ease-out forwards; pointer-events:none; }
.pill { position:absolute; top:12px; z-index:2; display:inline-flex; align-items:center; gap:6px; padding:6px 11px; border-radius:999px; font-size:12.5px; font-weight:700; background:rgba(10,12,16,.62); -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,.08); }
.pill.st { left:12px; color:var(--sc); }
.pill .dot { width:8px; height:8px; border-radius:50%; background:var(--sc); box-shadow:0 0 8px var(--sc); }
.tile.s-ok .pill .dot, .tile.s-paused .pill .dot, .tile.s-settle .pill .dot { box-shadow:none; }
.pill.where { right:12px; color:#cbd5e1; font-weight:600; }
.pill.where ha-icon { --mdc-icon-size:15px; color:#9aa0aa; }
.art.lit.on .pill.where { color:#fde68a; border-color:rgba(253,230,138,.35); box-shadow:0 0 18px -6px rgba(253,230,138,.7); } .art.lit.on .pill.where ha-icon { color:#f5b83d; }
.body { display:flex; flex-direction:column; gap:14px; padding:16px 16px 14px; }
.head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.nm { min-width:0; display:flex; flex-direction:column; gap:3px; }
h3 { margin:0; font-size:20px; font-weight:700; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sp { font-size:13px; color:#9aa0aa; font-style:italic; }
.ring { position:relative; flex:none; width:62px; height:62px; }
.ring svg { width:100%; height:100%; }
.rt { fill:none; stroke:rgba(255,255,255,0.08); stroke-width:5; }
.rf { fill:none; stroke:var(--sc); stroke-width:5; stroke-linecap:round; transition:stroke-dasharray .4s; }
.rc { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1; }
.rc b { font-size:17px; font-weight:800; font-variant-numeric:tabular-nums; color:#f3f4f6; }
.rc b ha-icon { --mdc-icon-size:20px; color:#94a3b8; }
.rc i { font-style:normal; font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:#8b919c; margin-top:3px; }
.facts { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:8px; margin:0; }
.facts > div { padding:9px 11px; border-radius:13px; background:rgba(255,255,255,0.035); min-width:0; }
.facts dt { font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; font-weight:700; color:#8b919c; }
.facts dd { margin:3px 0 0; font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.facts dd i { font-style:normal; font-weight:500; color:#9aa0aa; }
/* ---- grow light + humidifier rows ---- */
.glr, .hum { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:10px; width:100%; padding:10px 12px; border-radius:15px; text-align:left; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.06); transition:background .25s, border-color .25s; }
.gli, .hui { width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.06); color:#6b7280; transition:all .25s; }
.glt, .hut { min-width:0; display:flex; flex-direction:column; gap:3px; }
.glt b, .hut b { font-size:13.5px; font-weight:600; color:#e5e7eb; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.glt em, .hut em { font-style:normal; color:#9aa0aa; }
.glt i, .hut i { font-style:normal; font-size:12px; line-height:1.35; color:#9aa0aa; }
.glw { display:flex; flex-direction:column; align-items:flex-end; gap:2px; font-variant-numeric:tabular-nums; white-space:nowrap; }
.glw b { font-size:13px; font-weight:700; color:#fde68a; }
.glw i { font-style:normal; font-size:11px; color:#9aa0aa; }
.glr.on { background:linear-gradient(145deg, rgba(253,230,138,0.10), rgba(253,230,138,0.025)); border-color:rgba(253,230,138,0.28); }
.glr.on .gli { background:rgba(253,230,138,0.18); color:#fde68a; box-shadow:0 0 16px -3px rgba(253,230,138,.6); }
.glr.on em { color:#fde68a; }
.glr.un em, .glr.un .gli { color:#f59e0b; }
.glr.warn { border-color:rgba(245,184,61,0.5); } .glr.warn i { color:#f5b83d; }
.hum { background:rgba(56,189,248,0.04); border-color:rgba(56,189,248,0.12); }
.hum.h-run { background:rgba(56,189,248,0.08); border-color:rgba(56,189,248,0.26); }
.hum.h-run .hui { background:rgba(56,189,248,0.18); color:#7dd3fc; } .hum.h-run em { color:#7dd3fc; }
.hum.h-dry, .hum.h-un { border-color:rgba(245,184,61,0.45); } .hum.h-dry em, .hum.h-dry i, .hum.h-dry .hui, .hum.h-un em { color:#f5b83d; }
.water { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:10px; padding:10px 10px 10px 12px; border-radius:15px; background:rgba(56,189,248,0.07); border:1px solid rgba(56,189,248,0.18); }
.water.s-overdue, .water.s-due { background:rgba(56,189,248,0.14); border-color:rgba(56,189,248,0.45); }
.wi { width:32px; height:32px; border-radius:10px; display:flex; align-items:center; justify-content:center; background:rgba(56,189,248,0.16); color:#38bdf8; }
.wt { min-width:0; display:flex; flex-direction:column; gap:3px; }
.wt b { font-size:13.5px; font-weight:600; color:#e0f2fe; } .wt em { font-style:normal; color:var(--sc); }
.water.s-ok .wt em, .water.s-soon .wt em { color:#7dd3fc; }
.wt i { font-style:normal; font-size:12px; color:#9aa0aa; }
.wbar { position:relative; display:block; height:3px; border-radius:2px; background:rgba(255,255,255,0.08); overflow:hidden; }
.wbar span { display:block; height:100%; background:#38bdf8; }
/* ---- watering log (soil plants) ---- */
.wat { display:flex; flex-direction:column; gap:10px; padding:11px 12px 12px; border-radius:15px; background:rgba(56,189,248,0.05); border:1px solid rgba(56,189,248,0.15); transition:background .25s, border-color .25s; }
.wat.s-due { background:rgba(56,189,248,0.11); border-color:rgba(56,189,248,0.42); }
.wat.s-overdue { background:rgba(248,113,113,0.08); border-color:rgba(248,113,113,0.45); }
.wat.lrn.s-due { background:rgba(245,184,61,0.07); border-color:rgba(245,184,61,0.32); }
.wat.s-ok .wt em, .wat.s-checked .wt em { color:#7dd3fc; }
.wat.s-unlogged .wt em { color:#e5e7eb; }
.wat.s-overdue .wi { background:rgba(248,113,113,0.16); color:#f87171; }
.wh { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:10px; }
.wat .wt b { line-height:1.3; }
.wat .wt i { line-height:1.35; }
.wat .wbar { margin-top:2px; }
.wat .wbar i { position:absolute; top:0; bottom:0; width:2px; margin-left:-1px; background:#f5b83d; }
.wtyp { display:flex; flex-direction:column; align-items:flex-end; gap:2px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.wtyp b { font-size:14px; font-weight:700; color:#7dd3fc; }
.wtyp i { font-style:normal; font-size:10px; letter-spacing:.1em; text-transform:uppercase; font-weight:700; color:#8b919c; }
.wtyp.lrn b { color:#cbd5e1; }
.wgaps { display:flex; flex-wrap:wrap; align-items:center; gap:5px; }
.wgl { font-size:10px; letter-spacing:.1em; text-transform:uppercase; font-weight:700; color:#8b919c; margin-right:3px; }
.wg { min-width:24px; padding:2px 6px; border-radius:7px; text-align:center; font-size:12px; font-weight:700; font-variant-numeric:tabular-nums; background:rgba(255,255,255,0.05); color:#6b7280; }
.wg.in { background:rgba(56,189,248,0.14); color:#bae6fd; }
.wacts { display:flex; gap:8px; }
.wacts .wgo { flex:1; min-width:0; }
.wacts .pick { width:40px; flex:none; }
.acts { display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:8px; }
.btn { position:relative; height:46px; border-radius:14px; display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:0 14px; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.08); color:#e5e7eb; font-size:14px; font-weight:700; transition:background .15s, transform .1s; }
.btn:hover:not(:disabled) { background:rgba(255,255,255,0.11); }
.btn:active:not(:disabled) { transform:scale(.97); }
.btn.go { background:linear-gradient(145deg,#4ade80,#16a34a); border-color:transparent; color:#04210e; box-shadow:0 6px 20px -8px rgba(74,222,128,.7); }
.btn.sec { font-weight:600; color:#cbd5e1; padding:0 13px; }
.btn.wbtn { height:38px; font-size:13px; padding:0 12px; }
.btn.wbtn.go { background:linear-gradient(145deg,#38bdf8,#0284c7); color:#03182a; box-shadow:0 6px 20px -8px rgba(56,189,248,.7); }
.pick { width:46px; padding:0; }
.btn.wbtn.pick { padding:0; }
.pick input { position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; color-scheme:dark; }
.pick input::-webkit-calendar-picker-indicator { position:absolute; inset:0; width:100%; height:100%; cursor:pointer; }
.foot { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
.seg { display:inline-flex; gap:3px; padding:3px; border-radius:13px; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); }
.seg button { display:inline-flex; align-items:center; gap:5px; padding:6px 10px; border-radius:10px; font-size:12.5px; font-weight:600; color:#9aa0aa; }
.seg button ha-icon { --mdc-icon-size:14px; }
.seg button.on { background:rgba(255,255,255,0.10); color:#f3f4f6; }
.seg button.on.lit { background:rgba(245,184,61,0.18); color:#fde68a; }
.more { display:inline-flex; align-items:center; gap:6px; padding:7px 10px; border-radius:11px; font-size:13px; font-weight:600; color:#9aa0aa; }
.more:hover { background:rgba(255,255,255,0.05); color:#e5e7eb; }
.more ha-icon { --mdc-icon-size:16px; }
.more .chev { transition:transform .25s; } .more.open .chev { transform:rotate(180deg); }
.care { display:grid; grid-template-rows:0fr; transition:grid-template-rows .3s ease; margin-top:-8px; }
.care.open { grid-template-rows:1fr; }
.ci { overflow:hidden; min-height:0; }
.care ul { margin:8px 0 0; padding:0; list-style:none; display:flex; flex-direction:column; gap:7px; }
.care ul li { position:relative; padding-left:16px; font-size:13px; line-height:1.45; color:#cbd5e1; }
.care ul li::before { content:''; position:absolute; left:3px; top:7px; width:6px; height:6px; border-radius:50%; background:var(--pc); opacity:.8; }
/* ---- care guide ---- */
.guide { display:flex; flex-direction:column; gap:10px; margin-top:10px; }
.chips { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; }
.gc { display:flex; flex-direction:column; align-items:flex-start; gap:3px; min-width:0; padding:10px 10px 9px 11px; border-radius:14px; text-align:left; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); box-shadow:0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 6px -3px rgba(0,0,0,.5); transition:background .15s, border-color .15s, transform .1s; }
.gc:hover { background:rgba(255,255,255,0.08); }
.gc:active { transform:scale(.97); }
.gc.on { background:color-mix(in srgb, var(--gk) 14%, transparent); border-color:color-mix(in srgb, var(--gk) 50%, transparent); }
.gh { display:flex; flex-direction:column; align-items:flex-start; gap:7px; width:100%; margin-bottom:1px; }
.gh > .mt, .gh > .lb, .gh > .td { order:-1; }
.gh i { max-width:100%; font-style:normal; font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; font-weight:700; color:#8b919c; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.gc.on .gh i { color:var(--gk); }
.gc b { font-size:14px; font-weight:700; line-height:1.2; color:#f3f4f6; }
.gc small { font-size:11.5px; line-height:1.3; color:#9aa0aa; }
.mt { position:relative; flex:none; width:13px; height:20px; border-radius:2px 2px 5px 5px; overflow:hidden; background:linear-gradient(180deg, #4a3423, #2b1d14); box-shadow:inset 0 0 0 1px rgba(255,255,255,.14); }
.mt > span { position:absolute; left:0; right:0; top:0; background:linear-gradient(180deg, #e2b07a, #c08a52); }
.mt.wet { display:flex; align-items:center; justify-content:center; background:linear-gradient(180deg, #7dd3fc, #0284c7); }
.mt.wet ha-icon { --mdc-icon-size:11px; color:#e0f2fe; }
.lb { display:inline-flex; align-items:flex-end; gap:2px; height:15px; flex:none; }
.lb > span { width:4px; border-radius:1px; background:rgba(255,255,255,.14); }
.lb > span.f { background:#fde68a; box-shadow:0 0 5px rgba(253,230,138,.5); }
.td { display:inline-flex; gap:3px; flex:none; }
.td > span { width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,.14); }
.td > span.f { background:var(--gk); }
.gx { display:flex; align-items:flex-start; gap:10px; padding:11px 12px; border-radius:13px; background:color-mix(in srgb, var(--gk, #9aa0aa) 7%, rgba(255,255,255,0.03)); border:1px solid color-mix(in srgb, var(--gk, #9aa0aa) 22%, transparent); font-size:12.5px; line-height:1.5; color:#cbd5e1; }
.gx ha-icon { --mdc-icon-size:17px; color:var(--gk); margin-top:1px; }
.gx b { color:#f3f4f6; font-weight:600; }
.gx i { color:#9aa0aa; }
.gx.hint { padding:8px 12px; background:none; border:1px dashed rgba(255,255,255,0.10); color:#8b919c; }
.gx.hint ha-icon { color:#8b919c; }
.steps { list-style:none; margin:2px 0 0; padding:0; display:flex; flex-direction:column; }
.steps li { display:grid; grid-template-columns:28px minmax(0,1fr); gap:10px; padding:10px 0; border-top:1px solid rgba(255,255,255,0.05); }
.steps li:first-child { border-top:none; }
.si { width:28px; height:28px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:color-mix(in srgb, var(--pc) 15%, transparent); color:var(--pc); }
.si ha-icon { --mdc-icon-size:16px; }
.steps b { display:block; font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; font-weight:700; color:#8b919c; margin:1px 0 3px; }
.steps p { margin:0; font-size:13px; line-height:1.5; color:#d1d5db; }
.sched { display:flex; gap:8px; margin-top:10px; padding:9px 11px; border-radius:12px; background:rgba(255,255,255,0.035); font-size:12px; line-height:1.45; color:#9aa0aa; }
.sched ha-icon { --mdc-icon-size:15px; margin-top:1px; }
.clear { display:block; margin-top:8px; font-size:12.5px; font-weight:600; color:#f87171; padding:4px 2px; }
.undo { position:sticky; bottom:12px; z-index:5; display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:14px; padding:11px 14px; border-radius:16px; background:rgba(16,40,26,.92); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); border:1px solid rgba(74,222,128,0.35); font-size:14px; color:#d1fae5; box-shadow:0 10px 30px -10px rgba(0,0,0,.6); }
.undo span { display:flex; align-items:center; gap:8px; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.undo ha-icon { color:#4ade80; }
.undo button { color:#4ade80; font-weight:700; padding:4px 6px; }
.err { margin-top:10px; padding:9px 12px; border-radius:12px; background:rgba(248,113,113,0.12); color:#fecaca; font-size:13px; }
.sk { height:420px; border-radius:20px; background:linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04)); background-size:200% 100%; animation:sh 1.4s linear infinite; }
.spin { animation:rot 1s linear infinite; }
@container (max-width: 560px) {
  .card { padding:16px; }
  .stats { grid-template-columns:repeat(2, minmax(0,1fr)); }
  .season { max-width:none; width:100%; }
  .art { height:220px; }
}
/* ---- humidifier row → popup ---- */
.hum .hux { width:30px; height:30px; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#7dd3fc; background:rgba(56,189,248,0.10); }
.hum .hux ha-icon { --mdc-icon-size:17px; }
.hum:hover { background:rgba(56,189,248,0.10); }
/* ---- humidifier popup (a <dialog> beside the card, so it sits above the whole dashboard). The HA iOS app draws edge
 * to edge, so the popup is laid out inside the safe area: 12px below the status bar, 12px above the home indicator. */
dialog.hx { --hx-t:calc(env(safe-area-inset-top, 0px) + 12px); --hx-b:calc(env(safe-area-inset-bottom, 0px) + 12px); inset:var(--hx-t) 0 var(--hx-b); padding:0; margin:auto; border:none; background:transparent; color:#f3f4f6; width:min(720px, calc(100vw - 24px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))); max-width:none; max-height:calc(100dvh - var(--hx-t) - var(--hx-b)); overflow:visible; font-family:var(--ha-font-family-body, Roboto, sans-serif); }
dialog.hx::backdrop { background:rgba(4,6,10,.62); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px); }
dialog.hx[open] { animation:hxin .22s cubic-bezier(.2,.8,.2,1); }
.hxw { display:flex; flex-direction:column; gap:14px; max-height:calc(100dvh - var(--hx-t) - var(--hx-b)); overflow-y:auto; overscroll-behavior:contain; padding:18px; border-radius:26px; background:#14171d; border:1px solid rgba(255,255,255,0.08); box-shadow:0 30px 80px -20px rgba(0,0,0,.8); }
.hxh { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:12px; }
.hxi { width:44px; height:44px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.06); color:#9aa0aa; }
.hxi ha-icon { --mdc-icon-size:24px; }
.hxi.on { background:rgba(56,189,248,0.18); color:#7dd3fc; box-shadow:0 0 22px -4px rgba(56,189,248,.6); }
.hxi.warn { background:rgba(245,184,61,0.16); color:#f5b83d; }
.hxt { display:flex; flex-direction:column; gap:3px; min-width:0; }
.hxt b { font-size:19px; font-weight:700; letter-spacing:-.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hxt i { font-style:normal; font-size:13px; color:#9aa0aa; }
.hxclose { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.06); color:#cbd5e1; }
.hxclose:hover { background:rgba(255,255,255,0.11); }
.hxnow { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; }
.hxk { display:flex; flex-direction:column; gap:4px; padding:12px 14px; border-radius:16px; background:color-mix(in srgb, var(--k) 8%, rgba(255,255,255,0.03)); border:1px solid color-mix(in srgb, var(--k) 24%, transparent); min-width:0; }
.hxk > span { display:flex; align-items:center; gap:6px; font-size:11px; letter-spacing:.12em; text-transform:uppercase; font-weight:700; color:#8b919c; }
.hxk > span ha-icon { --mdc-icon-size:15px; color:var(--k); }
.hxk b { font-size:30px; font-weight:700; letter-spacing:-.02em; line-height:1.05; font-variant-numeric:tabular-nums; }
.hxk b small { font-size:16px; font-weight:600; color:#9aa0aa; margin-left:2px; }
.hxk i { font-style:normal; font-size:12.5px; color:#9aa0aa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hxk i em { font-style:normal; font-weight:700; color:var(--k); }
.hxrep { display:flex; align-items:center; gap:6px; margin-top:3px; font-size:11.5px; color:#8b919c; }
.hxrep .d { width:6px; height:6px; border-radius:50%; background:#4ade80; flex:none; }
.hxrep.stale { color:#f5b83d; } .hxrep.stale .d { background:#f5b83d; }
.hxctl { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(0,1fr); gap:10px; }
.hxsw, .hxau { display:flex; align-items:center; gap:12px; min-height:64px; padding:10px 14px; border-radius:18px; text-align:left; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); transition:background .2s, border-color .2s, transform .1s; }
.hxsw:active:not(:disabled), .hxau:active:not(:disabled) { transform:scale(.98); }
.hxpw { width:42px; height:42px; flex:none; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.08); color:#cbd5e1; transition:all .2s; }
.hxpw ha-icon { --mdc-icon-size:22px; }
.hxsl { display:flex; flex-direction:column; gap:2px; min-width:0; flex:1; }
.hxsl b { font-size:16px; font-weight:700; }
.hxsl i { font-style:normal; font-size:12px; color:#9aa0aa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hxsw.on { background:linear-gradient(145deg, rgba(56,189,248,0.20), rgba(56,189,248,0.06)); border-color:rgba(56,189,248,0.45); }
.hxsw.on .hxpw { background:linear-gradient(145deg,#38bdf8,#0284c7); color:#03182a; box-shadow:0 6px 20px -6px rgba(56,189,248,.8); }
.hxsw.on b { color:#e0f2fe; }
.tg { position:relative; flex:none; width:46px; height:28px; border-radius:999px; background:rgba(255,255,255,0.12); display:flex; align-items:center; justify-content:center; transition:background .2s; }
.tg > span { position:absolute; left:3px; top:3px; width:22px; height:22px; border-radius:50%; background:#cbd5e1; transition:transform .2s, background .2s; }
.tg ha-icon { --mdc-icon-size:18px; color:#e5e7eb; }
.hxau.on .tg { background:#4ade80; } .hxau.on .tg > span { transform:translateX(18px); background:#04210e; }
.hxau.on b { color:#bbf7d0; }
.hxau:not(.on) { border-color:rgba(245,184,61,0.35); } .hxau:not(.on) i { color:#f5b83d; }
.hxnote { display:flex; gap:9px; margin:-2px 0 0; padding:10px 12px; border-radius:13px; background:rgba(255,255,255,0.035); font-size:12.5px; line-height:1.5; color:#aab1bc; }
.hxnote ha-icon { --mdc-icon-size:16px; color:#8b919c; margin-top:1px; }
.hxnote.warn { background:rgba(245,184,61,0.10); color:#fde68a; } .hxnote.warn ha-icon { color:#f5b83d; }
.hxnote.paused { background:rgba(245,184,61,0.06); } .hxnote.paused ha-icon { color:#f5b83d; }
.hxbar { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:2px; }
.hxlbl { font-size:11px; letter-spacing:.14em; font-weight:700; color:#8b919c; text-transform:uppercase; }
.hxr { display:inline-flex; gap:3px; padding:3px; border-radius:13px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.06); }
.hxr button { padding:6px 12px; border-radius:10px; font-size:12.5px; font-weight:600; color:#9aa0aa; }
.hxr button.on { background:rgba(255,255,255,0.11); color:#f3f4f6; }
.hxc { display:flex; flex-direction:column; gap:8px; padding:12px 12px 10px; border-radius:18px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); }
.hxch { display:flex; align-items:flex-end; justify-content:space-between; gap:10px; min-height:36px; }
.hxct { display:flex; align-items:center; gap:7px; font-size:14px; font-weight:700; color:#e5e7eb; }
.hxct ha-icon { --mdc-icon-size:17px; color:var(--lc, #9aa0aa); }
.hxrd { display:flex; flex-direction:column; align-items:flex-end; gap:1px; text-align:right; font-variant-numeric:tabular-nums; min-width:0; }
.hxrd b { font-size:20px; font-weight:700; color:var(--lc); line-height:1.1; }
.hxrd i { font-style:normal; font-size:11.5px; color:#9aa0aa; white-space:nowrap; }
.hxrd em { font-style:normal; font-weight:600; } .hxrd em.on { color:#7dd3fc; }
.hxp { position:relative; height:150px; touch-action:pan-y; cursor:crosshair; -webkit-user-select:none; user-select:none; }
.hxp svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
.hxp .ln { fill:none; stroke:var(--lc); stroke-width:2.2; stroke-linejoin:round; stroke-linecap:round; vector-effect:non-scaling-stroke; }
.hxp .gl, .hxp .gv { stroke:rgba(255,255,255,0.06); stroke-width:1; vector-effect:non-scaling-stroke; }
.hxp .gv { stroke-dasharray:2 4; }
.hxp .band { fill:rgba(74,222,128,0.09); }
.hxp .on { fill:rgba(56,189,248,0.10); }
.hxp .onb { fill:rgba(56,189,248,0.75); }
.hxp .old { fill:rgba(20,23,29,0.62); }
.hxp .mv { stroke:rgba(255,255,255,0.35); stroke-width:1; stroke-dasharray:3 3; vector-effect:non-scaling-stroke; }
.hxy, .hxbl, .hxmv { position:absolute; pointer-events:none; font-size:10.5px; font-variant-numeric:tabular-nums; line-height:1; }
.hxy { left:2px; transform:translateY(-120%); color:#6b7280; }
.hxbl { right:4px; transform:translateY(3px); color:#4ade80; font-weight:600; opacity:.85; }
.hxmv { top:4px; margin-right:6px; color:#8b919c; font-weight:600; white-space:nowrap; }
.hxcur { position:absolute; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.45); pointer-events:none; }
.hxdot { position:absolute; width:11px; height:11px; margin:-5.5px 0 0 -5.5px; border-radius:50%; background:var(--lc); border:2px solid #14171d; box-shadow:0 0 0 1px var(--lc); pointer-events:none; }
.hxx-ax { position:relative; height:14px; }
.hxx-ax span { position:absolute; top:0; transform:translateX(-50%); font-size:10.5px; color:#6b7280; white-space:nowrap; }
.hxft { display:flex; flex-wrap:wrap; gap:6px; }
.hxpill { display:inline-flex; align-items:center; gap:6px; padding:5px 10px; border-radius:999px; background:rgba(255,255,255,0.045); font-size:12px; color:#aab1bc; }
.hxpill i { width:8px; height:8px; border-radius:2px; background:rgba(56,189,248,0.75); }
.hxpill i.ok { border-radius:50%; background:#4ade80; }
.hxsk { height:164px; border-radius:12px; background:linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.07), rgba(255,255,255,0.03)); background-size:200% 100%; animation:sh 1.4s linear infinite; }
.hxmsg { padding:28px 10px; text-align:center; font-size:13px; color:#9aa0aa; }
.hxmsg.err { padding:9px 12px; border-radius:12px; background:rgba(248,113,113,0.12); color:#fecaca; text-align:left; }
@media (max-width: 520px) {
  .hxw { padding:14px; gap:12px; border-radius:22px; }
  .hxk b { font-size:26px; }
  .hxk i { white-space:normal; line-height:1.35; }
  .hxctl { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
  .hxsw, .hxau { padding:10px 11px; gap:9px; }
  .hxpw { width:38px; height:38px; }
  .hxp { height:130px; }
}
@keyframes hxin { from { opacity:0; transform:translateY(12px) scale(.98); } }
@media (prefers-reduced-motion: reduce) { dialog.hx[open], .hxsk { animation:none; } }
@keyframes sway { 0%,100% { transform:rotate(-.9deg); } 50% { transform:rotate(.9deg); } }
@keyframes beam { 0%,100% { opacity:.8; } 50% { opacity:1; } }
@keyframes fed { 0% { opacity:0; transform:scale(.8); } 30% { opacity:1; } 100% { opacity:0; transform:scale(1.15); } }
@keyframes ping { 0%,100% { box-shadow:0 0 0 0 transparent; } 30% { box-shadow:0 0 0 3px var(--sc), 0 0 30px -4px var(--sc); } }
@keyframes sh { to { background-position:-200% 0; } }
@keyframes rot { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .sway, .beam, .sk, .spin, .tile.ping, .tile.just .art::before { animation:none; } }
</style>`;
  }
}

/* =========================================================================================
 * GROW LIGHTS CARD — every grow light in one panel: shared schedule bar, one row per light (tap to switch it,
 * chart icon for history), wattage and estimated brightness vs. target, Auto/Paused schedule chip, total draw.
 * =======================================================================================*/
class LinwoodGrowLightsCard extends HTMLElement {
  setConfig(config) {
    if (!config || !Array.isArray(config.lights) || !config.lights.length) throw new Error('Set "lights" to a list of grow lights');
    config.lights.forEach((l) => { if (!l || !l.entity) throw new Error('Each light needs an "entity"'); });
    this._config = config; this._arm = 0; this._sig = '';
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.addEventListener('click', (ev) => this._click(ev));
    }
    this._paint();
  }
  connectedCallback() { clearInterval(this._tm); this._tm = setInterval(() => this._paint(), 30000); this._paint(); }
  disconnectedCallback() { clearInterval(this._tm); }
  set hass(hass) {
    this._hass = hass;
    const c = this._config;
    const sig = (c.schedule && hass.states[c.schedule] ? hass.states[c.schedule].state : '-') + lpcLightSig(hass, c.lights);
    if (sig !== this._sig) { this._sig = sig; this._paint(); }
  }
  getCardSize() { return 6; }
  getGridOptions() { return { columns: 12, rows: 'auto' }; }

  _click(ev) {
    const el = ev.composedPath().find((x) => x.dataset && x.dataset.act);
    if (!el || el.disabled || !this._hass) return;
    const { act, val } = el.dataset;
    if (act === 'toggle') {
      const s = this._hass.states[val];
      if (!s || s.state === 'unavailable') return;
      this.dispatchEvent(new CustomEvent('haptic', { detail: 'medium', bubbles: true, composed: true }));
      this._hass.callService(val.split('.')[0], s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: val });
    } else if (act === 'more') {
      this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: val }, bubbles: true, composed: true }));
    } else if (act === 'sched') {
      // two taps within 4 s: pausing the schedule leaves the lights as they are until it is resumed
      if (Date.now() - this._arm < 4000) {
        this._arm = 0;
        const s = this._hass.states[val];
        this._hass.callService('automation', s && s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: val });
      } else { this._arm = Date.now(); clearTimeout(this._armT); this._armT = setTimeout(() => this._paint(), 4100); }
      this._paint();
    }
  }

  _paint() {
    if (!this.shadowRoot || !this._config) return;
    const c = this._config, h = this._hass, esc = lpcEsc;
    if (!h) { LwMorph.patch(this.shadowRoot, `${this._css()}<div class="card"><div class="sk"></div></div>`); return; }
    const ON = lpcIv(c.on_hour, 8), OFF = lpcIv(c.off_hour, 20);
    const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
    const inWin = mins >= ON * 60 && mins < OFF * 60;
    const L = c.lights.map((l) => lpcLightState(h, l));
    const onN = L.filter((s) => s.on).length, unN = L.filter((s) => s.un).length, offN = L.length - onN;
    const sch = c.schedule ? h.states[c.schedule] : null, auto = !sch || sch.state === 'on';
    const hl = (x) => new Date(2000, 0, 1, x).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const fmt = (m) => (Math.floor(m / 60) ? `${Math.floor(m / 60)}h ` : '') + `${m % 60}m`;
    const head = !offN ? 'Lights on' : !onN ? (unN === L.length ? 'Plugs offline' : 'Lights off') : `${onN} of ${L.length} on`;
    let sub;
    if (inWin) sub = !offN ? `${fmt(OFF * 60 - mins)} of light left · off at ${hl(OFF)}` : `${offN} off during scheduled hours${unN ? ' (offline)' : ' (manual)'} · off at ${hl(OFF)}`;
    else { let u = ON * 60 - mins; if (u <= 0) u += 1440; sub = !onN ? `Resting · on at ${hl(ON)}, in ${fmt(u)}` : `${onN} on outside the schedule (manual) · on again at ${hl(ON)}`; }
    if (!auto) sub = `Schedule paused · ${sub}`;
    const bl = (ON / 24) * 100, bw = ((OFF - ON) / 24) * 100, np = (mins / 1440) * 100;
    const lab = (x, t, tx, cls = '') => `<span class="${cls}" style="left:${f1(x)}%;transform:translateX(-${tx}%)">${t}</span>`;
    const rows = L.map((s) => {
      const l = s.l;
      const word = s.un ? 'Offline' : s.on ? 'On' : 'Off';
      const bits = [l.plants, l.height ? `${l.height}″ above the mantel` : l.note].filter(Boolean).join(' · ');
      const warn = s.warn ? (s.level === 0 ? 'Plug is on but the light is dark — press power on the remote' : `Reads ≈${s.level}% — set it to ${s.target}% on the remote`) : '';
      const right = s.on && s.watts != null
        ? `<span class="w"><b>${lpcWatts(s.watts)} W</b>${s.target ? `<i>${s.level ? `≈${s.level}%` : '—'} · set ${s.target}%</i>` : ''}</span>`
        : s.target ? `<span class="w"><i>set ${s.target}%</i></span>` : '';
      const icon = s.un ? 'mdi:lightbulb-alert-outline' : s.on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline';
      return `<div class="lt${s.on ? ' on' : ''}${s.un ? ' un' : ''}${s.warn ? ' warn' : ''}"><button class="row" data-act="toggle" data-val="${esc(l.entity)}" aria-pressed="${s.on}" ${s.un ? 'disabled' : ''}><span class="bulb"><ha-icon icon="${icon}"></ha-icon></span><span class="tx"><b>${esc(l.name)} <em>${word}</em></b>${bits ? `<i>${esc(bits)}</i>` : ''}${warn ? `<i class="wn">${esc(warn)}</i>` : ''}</span>${right}</button><button class="info" data-act="more" data-val="${esc(l.entity)}" aria-label="${esc(l.name)} details"><ha-icon icon="mdi:chart-line"></ha-icon></button></div>`;
    }).join('');
    const total = L.reduce((a, s) => a + (s.on && s.watts != null ? s.watts : 0), 0);
    const armed = Date.now() - this._arm < 4000;
    const schLabel = armed ? (auto ? 'Tap again to pause' : 'Tap again to resume') : auto ? `Auto · ${hl(ON)}–${hl(OFF)}` : 'Paused';
    LwMorph.patch(this.shadowRoot, `${this._css()}
<div class="card${onN ? ' lit' : ''}">
  <div class="top"><span class="ttl">${esc(c.title || 'Grow lights')}</span><span class="pl${onN ? ' on' : ''}${unN && !onN ? ' un' : ''}"><span class="d"></span>${onN ? `${onN} OF ${L.length} ON` : unN === L.length ? 'OFFLINE' : 'OFF'}</span></div>
  <div class="hd"><b>${head}</b><i>${esc(sub)}</i></div>
  <div class="bar"><div class="tr"><div class="win" style="left:${f1(bl)}%;width:${f1(bw)}%"></div><div class="now" style="left:calc(${f1(np)}% - 1.5px)"></div></div>
    <div class="lbl">${lab(0, '12 AM', 0, 'edge')}${lab(bl, hl(ON), 50)}${lab(bl + bw, hl(OFF), 50)}${lab(100, '12 AM', 100, 'edge')}</div></div>
  <div class="list">${rows}</div>
  <div class="foot">
    ${c.schedule ? `<button class="ch${auto ? '' : ' paused'}${armed ? ' armed' : ''}" data-act="sched" data-val="${esc(c.schedule)}"><ha-icon icon="${auto ? 'mdi:calendar-clock' : 'mdi:calendar-remove'}"></ha-icon><span><i>Schedule</i><b>${esc(schLabel)}</b></span></button>` : ''}
    <div class="ch"><ha-icon icon="mdi:flash-outline"></ha-icon><span><i>Drawing now</i><b>${onN ? `${Math.round(total)} W` : '0 W'}</b></span></div>
  </div>
</div>`);
  }

  _css() {
    return `<style>
:host { display:block; }
* { box-sizing:border-box; }
button { font:inherit; color:inherit; background:none; border:none; padding:0; cursor:pointer; -webkit-tap-highlight-color:transparent; touch-action:manipulation; text-align:left; }
button:disabled { cursor:default; }
ha-icon { --mdc-icon-size:18px; display:inline-flex; flex:none; }
.card { container-type:inline-size; display:flex; flex-direction:column; gap:16px; padding:22px; border-radius:28px; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.07); color:#f3f4f6; font-family:var(--ha-font-family-body, Roboto, sans-serif); transition:background .3s, border-color .3s; }
.card.lit { background:linear-gradient(180deg, rgba(253,230,138,0.07), rgba(255,255,255,0.03)); border-color:rgba(253,230,138,0.30); }
.top { display:flex; justify-content:space-between; align-items:center; gap:12px; }
.ttl { font-size:13px; letter-spacing:.14em; font-weight:600; color:#8b919c; text-transform:uppercase; }
.pl { display:inline-flex; align-items:center; gap:8px; padding:6px 12px; border-radius:999px; font-size:12.5px; font-weight:700; letter-spacing:.06em; background:rgba(255,255,255,.06); color:#9aa0aa; white-space:nowrap; }
.pl .d { width:8px; height:8px; border-radius:50%; background:#6b7280; }
.pl.on { background:rgba(253,230,138,.14); color:#fde68a; } .pl.on .d { background:#fde68a; box-shadow:0 0 10px #fde68a; }
.pl.un .d { background:#f59e0b; }
.hd { display:flex; flex-direction:column; gap:4px; }
.hd b { font-size:22px; font-weight:700; }
.card.lit .hd b { color:#fde68a; }
.hd i { font-style:normal; font-size:14px; color:#9aa0aa; }
.tr { position:relative; height:10px; border-radius:5px; background:rgba(255,255,255,.07); }
.win { position:absolute; top:0; bottom:0; border-radius:5px; background:rgba(253,230,138,.3); }
.card.lit .win { background:linear-gradient(90deg,#fde68a,#f5b83d); }
.now { position:absolute; top:-4px; width:3px; height:18px; border-radius:2px; background:#f3f4f6; box-shadow:0 0 8px rgba(255,255,255,.7); }
.lbl { position:relative; height:14px; margin-top:8px; font-size:11.5px; color:#6b7280; }
.lbl span { position:absolute; white-space:nowrap; }
.list { display:flex; flex-direction:column; gap:8px; }
.lt { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:stretch; border-radius:18px; background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.06); transition:background .25s, border-color .25s; overflow:hidden; }
.lt.on { background:linear-gradient(145deg, rgba(253,230,138,0.11), rgba(253,230,138,0.025)); border-color:rgba(253,230,138,0.28); }
.lt.warn { border-color:rgba(245,184,61,0.55); }
.row { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:12px; padding:12px 6px 12px 12px; min-height:64px; }
.row:active:not(:disabled) .bulb { transform:scale(.92); }
.bulb { width:40px; height:40px; border-radius:13px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.06); color:#6b7280; transition:all .25s; }
.bulb ha-icon { --mdc-icon-size:21px; }
.lt.on .bulb { background:rgba(253,230,138,0.2); color:#fde68a; box-shadow:0 0 20px -3px rgba(253,230,138,.65); }
.lt.un .bulb { color:#f59e0b; }
.tx { min-width:0; display:flex; flex-direction:column; gap:3px; }
.tx b { font-size:15px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tx em { font-style:normal; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#8b919c; margin-left:6px; }
.lt.on .tx em { color:#fde68a; } .lt.un .tx em { color:#f59e0b; }
.tx i { font-style:normal; font-size:12.5px; line-height:1.35; color:#9aa0aa; }
.tx i.wn { color:#f5b83d; font-weight:600; }
.w { display:flex; flex-direction:column; align-items:flex-end; gap:2px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.w b { font-size:14px; font-weight:700; color:#fde68a; }
.w i { font-style:normal; font-size:11.5px; color:#9aa0aa; }
.info { width:44px; display:flex; align-items:center; justify-content:center; color:#6b7280; border-left:1px solid rgba(255,255,255,0.05); }
.info:hover { color:#e5e7eb; background:rgba(255,255,255,0.04); }
.info ha-icon { --mdc-icon-size:17px; }
.foot { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; }
.ch { display:flex; align-items:center; gap:10px; padding:11px 13px; border-radius:16px; background:rgba(255,255,255,0.045); border:1px solid rgba(255,255,255,0.06); min-width:0; }
.ch ha-icon { color:#6b7280; }
.ch span { display:flex; flex-direction:column; gap:2px; min-width:0; }
.ch i { font-style:normal; font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; font-weight:700; color:#8b919c; }
.ch b { font-size:14px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ch.paused ha-icon, .ch.paused b { color:#f59e0b; }
.ch.armed { border-color:rgba(245,184,61,0.55); background:rgba(245,184,61,0.10); } .ch.armed b { color:#fde68a; }
.sk { height:320px; border-radius:20px; background:linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04)); background-size:200% 100%; animation:sh 1.4s linear infinite; }
@container (max-width: 420px) { .lbl .edge { display:none; } .tx em { margin-left:4px; } }
@keyframes sh { to { background-position:-200% 0; } }
@media (prefers-reduced-motion: reduce) { * { transition:none !important; animation:none !important; } }
</style>`;
  }
}

LinwoodPlantCard.lpcArt = 2;      // drawings v2 built in (the separate Linwood Plant Art add-on stands down)
LinwoodPlantCard.lpcSafe = 1;     // popup safe-area spacing built in (the separate Safe Area add-on stands down)
if (!customElements.get('linwood-plant-card')) customElements.define('linwood-plant-card', LinwoodPlantCard);
if (!customElements.get('linwood-grow-lights-card')) customElements.define('linwood-grow-lights-card', LinwoodGrowLightsCard);
window.customCards = window.customCards || [];
if (!window.customCards.find((c) => c.type === 'linwood-plant-card')) window.customCards.push({ type: 'linwood-plant-card', name: 'Linwood Plant Card', description: 'Illustrated plant-care tracker: feeding schedules, a learning watering log, water changes, locations, grow lights and a care guide', preview: false });
if (!window.customCards.find((c) => c.type === 'linwood-grow-lights-card')) window.customCards.push({ type: 'linwood-grow-lights-card', name: 'Linwood Grow Lights Card', description: 'Every grow light in one panel: schedule, toggles, wattage and brightness', preview: false });
})();
