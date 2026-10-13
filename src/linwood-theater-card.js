/* Linwood Theater Card v1.3.2 — Apple TV screen, receiver (volume / input / sound mode / tuning), projector and lamp automation.
 * Requires Linwood Kit (linwood-kit.js) for the shared base class and styles; embeds linwood-appletv-card for the screen.
 * v1.3.2: re-renders patch the existing DOM instead of replacing it (innerHTML). Rebuilding recreated every ha-icon, which
 *   render a frame late at zero width — the panel briefly shrank and iOS (no scroll anchoring) clamped the page upward.
 * v1.3.1: no double-tap zoom on iOS (touch-action: manipulation on every control); tuning steppers update in place;
 *   "Dialog" relabelled "Center level" (the X4700H's Center Level Adjust — the automation sends relative CVC UP/DOWN steps).
 * v1.3.0: live format badges under the screen (4K / 1080p, Dolby Vision / HDR10 / HLG, Dolby Atmos / DTS:X, 5.1 / 7.1 …).
 *   formats: sensor.theater_av_signal   # command_line sensor fed by denon_signal.py
 *   format_source: APPLE TV             # receiver input the badges belong to (default APPLE TV)
 *   format_images: { dolby_vision: /local/fmt/dv.svg, ... }   # optional: swap a badge for your own artwork
 *     keys: 8k 4k 1080p 1080i 720p dolby_vision hdr10 hdr10+ hlg dolby_atmos dts:x auro-3d 7.1 5.1 2.0 …
 * Badges only show while the receiver is on that input and the Apple TV is playing or paused.
 */
(async () => {
  if (!customElements.get('linwood-light-card')) await customElements.whenDefined('linwood-light-card');
  const { esc, clamp, BASE_CSS, Base: LinwoodBase } = window.LinwoodKit;
  /* =========================================================================================
   * Minimal DOM morph — patch live nodes to match new markup instead of replacing them.
   * Keeps ha-icon elements alive (no zero-width frame → no layout shift → no iOS scroll jump)
   * and keeps the button under the user's finger, so taps and focus survive a state update.
   * =======================================================================================*/
  const syncAttrs = (f, t) => {
    for (const a of Array.from(f.attributes)) if (!t.hasAttribute(a.name)) f.removeAttribute(a.name);
    for (const a of Array.from(t.attributes)) if (f.getAttribute(a.name) !== a.value) f.setAttribute(a.name, a.value);
  };
  const syncOne = (f, t, name) => {
    const v = t.getAttribute(name);
    if (f.getAttribute(name) === v) return;
    if (v == null) f.removeAttribute(name); else f.setAttribute(name, v);
  };
  const morphKids = (from, to) => {
    const fc = Array.from(from.childNodes), tc = Array.from(to.childNodes);
    tc.forEach((t, i) => {
      const f = fc[i];
      if (!f) { from.appendChild(document.importNode(t, true)); return; }
      if (f.nodeType !== t.nodeType || f.nodeName !== t.nodeName) { from.replaceChild(document.importNode(t, true), f); return; }
      if (f.nodeType !== 1) { if (f.nodeValue !== t.nodeValue) f.nodeValue = t.nodeValue; return; }
      if (f.nodeName === 'HA-ICON') { syncOne(f, t, 'icon'); syncOne(f, t, 'style'); syncOne(f, t, 'class'); return; }
      syncAttrs(f, t);
      morphKids(f, t);
      if (f.nodeName === 'BUTTON') f.disabled = t.hasAttribute('disabled');
      if (f.nodeName === 'SELECT') { const o = t.querySelector('option[selected]'); if (o && f.value !== o.value) f.value = o.value; }
    });
    for (let i = fc.length - 1; i >= tc.length; i--) from.removeChild(fc[i]);
  };
  const patchHtml = (el, html) => {
    if (el._lwHtml === html) return;
    el._lwHtml = html;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    morphKids(el, tpl.content);
  };
  /* =========================================================================================
   * THEATER CARD — Apple TV screen + receiver + projector + lamp automation in one console
   * =======================================================================================*/
  const SRC_ICONS = { 'apple tv': 'mdi:apple', bluetooth: 'mdi:bluetooth', 'heos music': 'mdi:music-circle-outline', nintendoswitch: 'mdi:nintendo-switch',
    ps3: 'mdi:sony-playstation', ps4: 'mdi:sony-playstation', ps5: 'mdi:sony-playstation', 'tv audio': 'mdi:television-classic', xbox: 'mdi:microsoft-xbox',
    'cbl/sat': 'mdi:satellite-variant', 'blu-ray': 'mdi:disc-player', dvd: 'mdi:disc-player', game: 'mdi:gamepad-variant', 'media player': 'mdi:play-network', phono: 'mdi:album', tuner: 'mdi:radio' };
  const SRC_NAMES = { 'apple tv': 'Apple TV', ps3: 'PS3', ps4: 'PS4', ps5: 'PS5', nintendoswitch: 'Switch', xbox: 'Xbox', 'heos music': 'HEOS', 'tv audio': 'TV Audio', bluetooth: 'Bluetooth' };
  const MODE_META = { MOVIE: ['Movie', 'mdi:movie-open'], MUSIC: ['Music', 'mdi:music-note'], GAME: ['Game', 'mdi:gamepad-variant'], AUTO: ['Auto', 'mdi:auto-fix'],
    STEREO: ['Stereo', 'mdi:speaker-multiple'], DIRECT: ['Direct', 'mdi:waveform'], 'PURE DIRECT': ['Pure Direct', 'mdi:sine-wave'], 'MCH STEREO': ['Multi-ch Stereo', 'mdi:surround-sound'],
    'DOLBY DIGITAL': ['Dolby', 'mdi:dolby'], 'DTS SURROUND': ['DTS', 'mdi:surround-sound'], AURO3D: ['Auro-3D', 'mdi:surround-sound'], STANDARD: ['Standard', 'mdi:tune'] };
  const RES_CAP = { '8K': 'Ultra HD', '4K': 'Ultra HD', '1080p': 'Full HD', '1080i': 'Full HD', '720p': 'HD' };
  const titleCase = (s) => String(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  const TUNING = [
    ['audio_delay', 'Audio delay', 'mdi:timer-sand', 'Lip-sync'],
    ['dialog_level', 'Center level', 'mdi:account-voice', 'Dialog · centre channel'],
    ['subwoofer_level', 'Subwoofer', 'mdi:speaker', 'Bass level'],
    ['dynamic_eq', 'Dynamic EQ', 'mdi:equalizer', 'Fuller sound at low volume'],
    ['cinema_eq', 'Cinema EQ', 'mdi:movie-open-cog', 'Softens harsh film treble'],
    ['dynamic_volume', 'Dynamic Volume', 'mdi:volume-vibrate', 'Night mode'],
    ['multeq', 'Room EQ', 'mdi:tune-vertical', 'Audyssey MultEQ'],
  ];

  class LinwoodTheaterCard extends LinwoodBase {
    setConfig(config) {
      if (!config || !config.receiver) throw new Error('Set "receiver" (media_player)');
      this._pset = {}; this._deb = {}; this._pv = null;
      this._skel = false; this._atv = null;
      super.setConfig(config);
    }
    getCardSize() { return 12; }
    getGridOptions() { return { columns: 'full', rows: 'auto' }; }
    set hass(hass) { this._hass = hass; if (this._atv) this._atv.hass = hass; if (!this._busy) this._render(false); }
    disconnectedCallback() { Object.values(this._deb || {}).forEach(clearTimeout); clearTimeout(this._stepHold); }
    _pval(id) { const p = this._pset[id]; return p && Date.now() - p.t < 8000 ? p.v : null; }
    _xpOpen() {
      if (this._xpState != null) return this._xpState;
      try { this._xpState = window.localStorage.getItem(`linwood-theater-xp:${this._config.receiver}`) === '1'; } catch (e) { this._xpState = false; }
      return this._xpState;
    }
    _xpSave(v) { this._xpState = v; try { window.localStorage.setItem(`linwood-theater-xp:${this._config.receiver}`, v ? '1' : '0'); } catch (e) { /* ignore */ } }
    _signature() {
      const c = this._config, set = c.settings || {};
      const ids = [c.receiver, c.projector, c.lamp_automation, c.apple_tv && c.apple_tv.entity, c.formats, ...Object.values(set).filter((v) => typeof v === 'string')];
      return ids.map((id) => {
        const s = this._st(id); if (!s) return '-';
        const a = s.attributes;
        if (id === c.receiver) return `${s.state}|${a.volume_level}|${a.is_volume_muted}|${a.source}|${a.sound_mode}|${a.sound_mode_raw}|${a.dynamic_eq}`;
        if (id === (c.apple_tv && c.apple_tv.entity)) return `${s.state}|${a.app_name}`;
        if (id === c.formats) return `${s.state}|${a.video_resolution}|${a.hdr}|${a.audio_format}|${a.channels}`;
        return s.state;
      }).join('§') + JSON.stringify(this._pset) + JSON.stringify(this._pv) + this._xpOpen();
    }
    _render(force) {
      if (!this._hass || !this._config) return;
      if (!this._skel) this._build();
      const sig = this._signature();
      if (!force && sig === this._sig) return;
      this._sig = sig;
      const r = this._st(this._config.receiver), p = this._st(this._config.projector);
      const rOn = !!r && r.state === 'on', pOn = !!p && p.state === 'on';
      const cls = `card${rOn ? ' r-on' : ''}${pOn ? ' p-on' : ''}${rOn && pOn ? ' show' : ''}`;
      if (this._card.className !== cls) this._card.className = cls;
      patchHtml(this._top, this._topHtml(r, rOn, pOn));
      patchHtml(this._devs, this._devsHtml(r, rOn, p, pOn));
      patchHtml(this._recv, this._recvHtml(r, rOn));
      patchHtml(this._colC, rOn ? this._tuneHtml(r) : this._tuneSummary(r));
      this._colC.classList.toggle('idle', !rOn);
      const fmt = this._fmtHtml(r, rOn);
      if (fmt !== this._fmtLast) { this._fmt.innerHTML = fmt; this._fmtLast = fmt; }
    }
    _build() {
      this.shadowRoot.innerHTML = `<style>${BASE_CSS}${this._css()}</style>
<div class="card"><div class="amb"></div><div class="top"></div>
  <div class="body"><div class="colA"><div class="scrw"><div class="scr"></div></div><div class="fmt" aria-live="polite"></div></div><div class="colB"><div class="devs"></div><div class="recv"></div></div><div class="colC"></div></div></div>`;
      const q = (s) => this.shadowRoot.querySelector(s);
      this._card = q('.card'); this._top = q('.top'); this._devs = q('.devs'); this._recv = q('.recv'); this._colC = q('.colC'); this._fmt = q('.fmt');
      this._fmtLast = '';
      this._skel = true;
      const atvCfg = this._config.apple_tv;
      const slot = q('.scr');
      if (atvCfg && atvCfg.entity && typeof document !== 'undefined' && document.createElement) {
        const mount = () => {
          if (this._atv) return;
          const el = document.createElement('linwood-appletv-card');
          el.setConfig({ ...atvCfg, embedded: true });
          el.hass = this._hass;
          this._atv = el; slot.appendChild(el);
        };
        if (customElements.get('linwood-appletv-card')) mount();
        else if (customElements.whenDefined) customElements.whenDefined('linwood-appletv-card').then(mount);
      } else q('.colA').style.display = 'none';
    }
    /* ---------- pieces ---------- */
    _topHtml(r, rOn, pOn) {
      const st = !r ? ['Receiver missing', 'off', 'mdi:alert'] : r.state === 'unavailable' ? ['Receiver offline', 'off', 'mdi:lan-disconnect']
        : rOn && pOn ? ['Showtime', 'show', 'mdi:filmstrip'] : rOn ? ['Sound on', 'warm', 'mdi:speaker'] : ['Standby', 'off', 'mdi:power-sleep'];
      return `<div class="hd"><span class="ttl">${esc(this._config.title || 'Theater')}</span>
  <span class="pill p-${st[1]}"><ha-icon icon="${st[2]}"></ha-icon>${st[0]}</span>
  <button class="pwr${rOn ? ' on' : ''}" data-act="power" aria-label="${rOn ? 'End the show (receiver off)' : 'Start the show (receiver on)'}" ${!r || r.state === 'unavailable' ? 'disabled' : ''}><ha-icon icon="mdi:power"></ha-icon></button></div>`;
    }
    /* Format badges: only for the configured input, only while the Apple TV is actually playing/paused. */
    _fmtList(r, rOn) {
      const c = this._config;
      if (!c.formats || !r || !rOn) return [];
      if (String(r.attributes.source || '').toUpperCase() !== String(c.format_source || 'APPLE TV').toUpperCase()) return [];
      const atv = c.apple_tv && this._st(c.apple_tv.entity);
      if (atv && !['playing', 'paused'].includes(atv.state)) return [];
      const s = this._st(c.formats);
      if (!s || ['unavailable', 'unknown', 'No signal'].includes(s.state)) return [];
      const a = s.attributes, out = [];
      // video
      if (a.video_resolution) {
        const res = a.video_resolution;
        out.push({ g: 'v', k: res.toLowerCase(), cls: 'res', top: RES_CAP[res] || 'Video', main: res, tip: `${res}${a.video_fps ? ` · ${a.video_fps} fps` : ''}` });
      }
      if (a.video_resolution && a.hdr && a.hdr !== 'SDR') {
        if (a.hdr === 'Dolby Vision') out.push({ g: 'v', k: 'dolby_vision', cls: 'dv', top: 'Dolby', main: 'Vision', tip: 'Dolby Vision' });
        else out.push({ g: 'v', k: a.hdr.toLowerCase(), cls: 'hdr', top: a.hdr === 'HLG' ? 'HDR' : 'High dynamic range', main: a.hdr, tip: a.hdr });
      }
      // audio — object-based formats win over a bare channel count
      const modeRaw = String(r.attributes.sound_mode_raw || '').toUpperCase();
      const fmt = a.audio_format && a.audio_format !== 'Analog' ? a.audio_format : null;
      const atmos = fmt === 'Dolby Atmos' || (!a.audio_immersive && modeRaw.includes('ATMOS'));
      if (atmos) out.push({ g: 'a', k: 'dolby_atmos', cls: 'atmos', top: 'Dolby', main: 'Atmos', tip: 'Dolby Atmos' });
      else if (fmt === 'DTS:X') out.push({ g: 'a', k: 'dts:x', cls: 'atmos', top: 'DTS', main: ':X', tip: 'DTS:X' });
      else if (fmt === 'Auro-3D') out.push({ g: 'a', k: 'auro-3d', cls: 'atmos', top: 'Auro', main: '3D', tip: 'Auro-3D' });
      else if (a.channels) {
        const ch = a.channels === 'Stereo' ? '2.0' : a.channels === 'Mono' ? '1.0' : a.channels;
        const codec = fmt && fmt !== 'PCM' ? fmt : null;
        const top = codec || (Number(a.channel_count) > 2 ? 'Multichannel' : a.channels === 'Mono' ? 'Mono' : 'Stereo');
        out.push({ g: 'a', k: ch, cls: 'ch', top, main: ch, tip: `${codec ? `${codec} · ` : fmt === 'PCM' ? 'PCM · ' : ''}${ch} channels` });
      } else if (fmt) out.push({ g: 'a', k: fmt.toLowerCase(), cls: 'ch', top: 'Audio', main: fmt, tip: fmt });
      return out;
    }
    _fmtHtml(r, rOn) {
      const list = this._fmtList(r, rOn);
      if (!list.length) return '';
      const imgs = this._config.format_images || {};
      let prev = null;
      const html = list.map((b, i) => {
        const sep = prev && prev !== b.g ? '<span class="fsep"></span>' : ''; prev = b.g;
        const d = `style="animation-delay:${i * 60}ms"`;
        return sep + (imgs[b.k]
          ? `<span class="fb fi" ${d} title="${esc(b.tip)}"><img src="${esc(imgs[b.k])}" alt="${esc(b.tip)}"></span>`
          : `<span class="fb ${b.cls}" ${d} title="${esc(b.tip)}" aria-label="${esc(b.tip)}"><i>${esc(b.top)}</i><b>${esc(b.main)}</b></span>`);
      }).join('');
      return `<div class="fbs">${html}</div>`;
    }
    _devsHtml(r, rOn, p, pOn) {
      const c = this._config, tiles = [];
      const tile = (kind, icon, name, on, sub, color, dis) => `<button class="dev${on ? ' on' : ''}" data-act="dev" data-kind="${kind}" style="--dc:${color}" ${dis ? 'disabled' : ''}><span class="di"><ha-icon icon="${icon}"></ha-icon></span><span class="dt"><span class="dn">${name}</span><span class="ds">${esc(sub)}</span></span></button>`;
      if (r) tiles.push(tile('receiver', 'mdi:audio-video', 'Receiver', rOn, r.state === 'unavailable' ? 'Offline' : rOn ? (this._srcName(r.attributes.source) || 'On') : 'Standby', '#a78bfa', r.state === 'unavailable'));
      if (p) tiles.push(tile('projector', 'mdi:projector', 'Projector', pOn, p.state === 'unavailable' ? 'Offline' : pOn ? 'Beaming' : 'Off', '#38bdf8', p.state === 'unavailable'));
      const atv = c.apple_tv && this._st(c.apple_tv.entity);
      if (atv) {
        const s = atv.state, on = !['off', 'standby', 'unavailable', 'unknown'].includes(s);
        tiles.push(tile('atv', 'mdi:apple', 'Apple TV', on, s === 'playing' ? 'Playing' : s === 'paused' ? 'Paused' : on ? 'Awake' : s === 'unavailable' ? 'Offline' : 'Asleep', '#e5e7eb', s === 'unavailable'));
      }
      const lamp = this._st(c.lamp_automation);
      if (lamp) tiles.push(tile('lamp', lamp.state === 'on' ? 'mdi:lamp' : 'mdi:lamp-outline', 'Lamp auto', lamp.state === 'on', lamp.state === 'on' ? 'Follows TV' : 'Manual', '#34d399', lamp.state === 'unavailable'));
      const on = (this._devsOn = tiles.filter((t) => t.startsWith('<button class="dev on"')).length);
      return `<div class="sh"><span class="k">Devices</span><span class="kv">${on} of ${tiles.length} on</span></div><div class="grid">${tiles.join('')}</div>`;
    }
    _srcName(s) { if (!s) return ''; const n = (this._config.source_names || {})[s]; return n || SRC_NAMES[String(s).toLowerCase()] || titleCase(s); }
    _modeMeta(m) { const k = String(m || '').toUpperCase(); const mm = MODE_META[k]; return mm || [titleCase(m || ''), 'mdi:surround-sound']; }
    _vol(r) { if (this._pv && Date.now() - this._pv.t < 6000) return this._pv.v; return Number(r.attributes.volume_level || 0); }
    _db(v) { const d = v * 100 - 80; return `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d).toFixed(1)}`; }
    _recvHtml(r, rOn) {
      if (!r) return `<div class="standby"><ha-icon icon="mdi:alert"></ha-icon><div><b>Receiver not found</b><span>${esc(this._config.receiver)}</span></div></div>`;
      if (!rOn) {
        return `<div class="standby"><span class="si"><ha-icon icon="mdi:power-sleep"></ha-icon></span><div class="st"><b>Receiver in standby</b><span>Power on to start the show — the projector follows automatically.</span></div>
          <button class="go" data-act="power" ${r.state === 'unavailable' ? 'disabled' : ''}><ha-icon icon="mdi:play"></ha-icon>Start</button></div>`;
      }
      const a = r.attributes, maxV = this._config.max_volume || 0.8;
      const v = this._vol(r), muted = !!a.is_volume_muted;
      const pct = clamp(v / maxV, 0, 1) * 100;
      const srcs = (a.source_list || []).map((s) => {
        const sel = s === a.source;
        return `<button class="src${sel ? ' sel' : ''}" data-act="src" data-val="${esc(s)}"><ha-icon icon="${SRC_ICONS[s.toLowerCase()] || 'mdi:import'}"></ha-icon>${esc(this._srcName(s))}</button>`;
      }).join('');
      const quick = (this._config.quick_modes || ['MOVIE', 'MUSIC', 'GAME', 'AUTO', 'STEREO', 'DIRECT']).filter((m) => (a.sound_mode_list || []).includes(m));
      const cur = a.sound_mode;
      const modes = [...quick, ...(cur && !quick.includes(cur) ? [cur] : [])].map((m) => {
        const [n, i] = this._modeMeta(m);
        return `<button class="mode${m === cur ? ' sel' : ''}" data-act="mode" data-val="${esc(m)}"><ha-icon icon="${i}"></ha-icon><span>${esc(n)}</span></button>`;
      }).join('');
      const all = (a.sound_mode_list || []).map((m) => `<option value="${esc(m)}" ${m === cur ? 'selected' : ''}>${esc(this._modeMeta(m)[0])}</option>`).join('');
      return `<div class="sec">
  <div class="sh"><span class="k">Volume</span><span class="vread${muted ? ' m' : ''}"><b>${this._db(v)}</b><i>dB</i></span><button class="mute${muted ? ' on' : ''}" data-act="mute" aria-label="${muted ? 'Unmute' : 'Mute'}"><ha-icon icon="${muted ? 'mdi:volume-off' : 'mdi:volume-high'}"></ha-icon>${muted ? 'Muted' : 'Mute'}</button></div>
  <div class="vrow">
    <button class="vb" data-act="vdown" aria-label="Volume down"><ha-icon icon="mdi:minus"></ha-icon></button>
    <div class="vs${muted ? ' muted' : ''}" data-act="vslide" role="slider" aria-valuenow="${this._db(v)}" aria-label="Volume (drag)">
      <div class="vfill" style="width:${pct}%"></div><div class="vgrip" style="left:${pct}%"></div>
      <div class="vlbl"><span class="vh"><ha-icon icon="mdi:gesture-swipe-horizontal"></ha-icon>drag</span></div>
    </div>
    <button class="vb" data-act="vup" aria-label="Volume up"><ha-icon icon="mdi:plus"></ha-icon></button>
  </div>
</div>
<div class="sec"><div class="sh"><span class="k">Input</span><span class="kv">${esc(this._srcName(a.source))}</span></div><div class="srcs">${srcs}</div></div>
<div class="sec"><div class="sh"><span class="k">Sound mode</span><label class="allm"><span>${esc(this._modeMeta(cur)[0] || 'More')}</span><ha-icon icon="mdi:chevron-down"></ha-icon><select data-act="modesel" aria-label="All sound modes">${all}</select></label></div>
  <div class="modes">${modes}</div></div>`;
    }
    /* Shared value text + meter geometry for input_number tuning rows (used by the full render and the in-place step update). */
    _numView(st, v) {
      const at = st.attributes, mn = Number(at.min), mx = Number(at.max);
      const unit = at.unit_of_measurement || '';
      const centred = mn < 0 && mx > 0;
      const txt = isNaN(v) ? '—' : unit === 'dB' ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} dB` : `${v} ${unit}`;
      let left, width, z = null;
      if (centred) { z = (-mn / (mx - mn)) * 100; const x = ((v - mn) / (mx - mn)) * 100; left = Math.min(z, x); width = Math.abs(x - z); }
      else { left = 0; width = clamp((v - mn) / (mx - mn), 0, 1) * 100; }
      return { mn, mx, txt, centred, left, width, z };
    }
    _tuneHtml(r) {
      const set = this._config.settings || {}, open = this._xpOpen();
      const rows = TUNING.filter(([k]) => set[k]).map(([k, name, icon, hint]) => {
        if (k === 'dynamic_eq') {
          const p = this._pval('dynamic_eq'); const on = p != null ? p : !!r.attributes.dynamic_eq;
          return `<div class="tr"><span class="ti"><ha-icon icon="${icon}"></ha-icon></span><span class="tn"><b>${name}</b><i>${hint}</i></span><button class="tg${on ? ' on' : ''}" data-act="deq" role="switch" aria-checked="${on}" aria-label="${name}"></button></div>`;
        }
        const id = set[k], st = this._st(id);
        if (!st) return `<div class="tr na"><span class="ti"><ha-icon icon="mdi:alert"></ha-icon></span><span class="tn"><b>${name}</b><i>Missing ${esc(id)}</i></span></div>`;
        const dom = id.split('.')[0];
        if (dom === 'input_boolean') {
          const p = this._pval(id); const on = p != null ? p : st.state === 'on';
          return `<div class="tr"><span class="ti"><ha-icon icon="${icon}"></ha-icon></span><span class="tn"><b>${name}</b><i>${hint}</i></span><button class="tg${on ? ' on' : ''}" data-act="bool" data-id="${id}" role="switch" aria-checked="${on}" aria-label="${name}"></button></div>`;
        }
        if (dom === 'input_select') {
          const p = this._pval(id), cur = p != null ? p : st.state;
          const opts = (st.attributes.options || []).map((o) => `<button class="seg${o === cur ? ' sel' : ''}" data-act="sel" data-id="${id}" data-val="${esc(o)}">${esc(o)}</button>`).join('');
          return `<div class="tr col"><div class="trh"><span class="ti"><ha-icon icon="${icon}"></ha-icon></span><span class="tn"><b>${name}</b><i>${hint}</i></span></div><div class="segs">${opts}</div></div>`;
        }
        const p = this._pval(id);
        const v = p != null ? p : Number(st.state);
        const nv = this._numView(st, v);
        const meter = nv.centred
          ? `<span class="mt c"><span class="mf" style="left:${nv.left}%; width:${nv.width}%"></span><span class="mz" style="left:${nv.z}%"></span></span>`
          : `<span class="mt"><span class="mf" style="left:0; width:${nv.width}%"></span></span>`;
        return `<div class="tr" data-row="${id}"><span class="ti"><ha-icon icon="${icon}"></ha-icon></span><span class="tn"><b>${name}</b><i>${hint}</i>${meter}</span>
          <span class="stp"><button data-act="step" data-id="${id}" data-dir="-1" aria-label="${name} down" ${v <= nv.mn ? 'disabled' : ''}><ha-icon icon="mdi:minus"></ha-icon></button><span class="sv${p != null ? ' pend' : ''}">${nv.txt}</span><button data-act="step" data-id="${id}" data-dir="1" aria-label="${name} up" ${v >= nv.mx ? 'disabled' : ''}><ha-icon icon="mdi:plus"></ha-icon></button></span></div>`;
      }).join('');
      if (!rows) return '';
      return `<button class="xpt${open ? ' open' : ''}" data-act="xp" aria-expanded="${open}"><ha-icon class="xi" icon="mdi:tune-variant"></ha-icon><span class="xl">Audio tuning</span><span class="xv">Delay · levels · EQ</span><ha-icon class="xc" icon="mdi:chevron-down"></ha-icon></button>
<div class="xp${open ? ' open' : ''}"><div class="xpi"><div class="tune">${rows}</div><div class="fine">Settings are sent to the receiver when changed here.</div></div></div>`;
    }
    _tuneSummary(r) {
      const set = this._config.settings || {};
      const chips = TUNING.filter(([k]) => set[k]).map(([k, name, icon]) => {
        let v;
        if (k === 'dynamic_eq') v = r && r.attributes.dynamic_eq != null ? (r.attributes.dynamic_eq ? 'On' : 'Off') : '—';
        else {
          const st = this._st(set[k]); if (!st) return '';
          const dom = set[k].split('.')[0], u = st.attributes.unit_of_measurement || '';
          v = dom === 'input_boolean' ? (st.state === 'on' ? 'On' : 'Off') : dom === 'input_number' ? (u === 'dB' ? `${Number(st.state) > 0 ? '+' : Number(st.state) < 0 ? '−' : ''}${Math.abs(Number(st.state))} dB` : `${Number(st.state)} ${u}`) : st.state;
        }
        return `<span class="sum"><ha-icon icon="${icon}"></ha-icon><span class="sn">${name}</span><b>${esc(v)}</b></span>`;
      }).join('');
      if (!chips) return '';
      return `<div class="sh"><span class="k">Audio settings</span></div><div class="sums">${chips}</div>
<div class="offnote"><ha-icon icon="mdi:power-sleep"></ha-icon>Adjustable when the receiver is on</div>`;
    }
    /* ---------- actions ---------- */
    _wire() {
      const root = this.shadowRoot;
      root.addEventListener('click', (ev) => {
        const el = ev.composedPath().find((x) => x.dataset && x.dataset.act);
        if (!el || el.disabled) return;
        const c = this._config, act = el.dataset.act, r = this._st(c.receiver);
        if (act === 'power' && r) this._call('media_player', r.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: c.receiver });
        else if (act === 'dev') this._dev(el.dataset.kind);
        else if (act === 'mute' && r) this._call('media_player', 'volume_mute', { entity_id: c.receiver, is_volume_muted: !r.attributes.is_volume_muted });
        else if (act === 'vup' || act === 'vdown') { this._pv = null; this._call('media_player', act === 'vup' ? 'volume_up' : 'volume_down', { entity_id: c.receiver }); }
        else if (act === 'src') this._call('media_player', 'select_source', { entity_id: c.receiver, source: el.dataset.val });
        else if (act === 'mode') this._call('media_player', 'select_sound_mode', { entity_id: c.receiver, sound_mode: el.dataset.val });
        else if (act === 'step') this._step(el.dataset.id, Number(el.dataset.dir));
        else if (act === 'bool') { const s = this._st(el.dataset.id); const cur = this._pval(el.dataset.id) ?? (s && s.state === 'on'); this._pset[el.dataset.id] = { v: !cur, t: Date.now() }; this._render(true); this._call('input_boolean', cur ? 'turn_off' : 'turn_on', { entity_id: el.dataset.id }); }
        else if (act === 'sel') { this._pset[el.dataset.id] = { v: el.dataset.val, t: Date.now() }; this._render(true); this._call('input_select', 'select_option', { entity_id: el.dataset.id, option: el.dataset.val }); }
        else if (act === 'deq' && r) { const cur = this._pval('dynamic_eq') ?? !!r.attributes.dynamic_eq; this._pset.dynamic_eq = { v: !cur, t: Date.now() }; this._render(true); this._call('denonavr', 'set_dynamic_eq', { entity_id: c.receiver, dynamic_eq: !cur }); }
        else if (act === 'xp') {
          const open = !this._xpOpen(); this._xpSave(open);
          el.classList.toggle('open', open); el.setAttribute('aria-expanded', open);
          const xp = el.nextElementSibling; if (xp) xp.classList.toggle('open', open);
          this._sig = this._signature();
        }
      });
      root.addEventListener('change', (ev) => {
        const el = ev.composedPath().find((x) => x.dataset && x.dataset.act === 'modesel');
        if (el) this._call('media_player', 'select_sound_mode', { entity_id: this._config.receiver, sound_mode: el.value });
      });
      root.addEventListener('pointerdown', (ev) => {
        const el = ev.composedPath().find((x) => x.dataset && x.dataset.act === 'vslide');
        if (!el) return;
        const r = this._st(this._config.receiver); if (!r) return;
        const maxV = this._config.max_volume || 0.8, rect = el.getBoundingClientRect();
        const startX = ev.clientX, startY = ev.clientY, startV = this._vol(r); let dragging = false, lastV = null;
        const move = (e) => {
          if (!dragging) {
            if (Math.abs(e.clientX - startX) < 6) { if (Math.abs(e.clientY - startY) > 10) cleanup(); return; }
            dragging = true; this._busy = true; el.classList.add('drag');
            try { el.setPointerCapture(ev.pointerId); } catch (x) { /* ignore */ }
          }
          // relative drag: never jumps the volume to where the finger landed
          lastV = Math.round(clamp(startV + ((e.clientX - startX) / rect.width) * maxV, 0, maxV) * 200) / 200;
          const pct = (lastV / maxV) * 100;
          const f = el.querySelector('.vfill'), g = el.querySelector('.vgrip'), b = this.shadowRoot.querySelector('.vread b');
          if (f) f.style.width = `${pct}%`; if (g) g.style.left = `${pct}%`; if (b) b.textContent = this._db(lastV);
        };
        const up = () => {
          cleanup();
          if (dragging && lastV != null) { this._pv = { v: lastV, t: Date.now() }; this._render(true); this._call('media_player', 'volume_set', { entity_id: this._config.receiver, volume_level: lastV }); }
          else { const h = el.querySelector('.vh'); if (h) { h.classList.add('nudge'); setTimeout(() => h.classList.remove('nudge'), 900); } }
        };
        const cleanup = () => {
          window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel);
          el.classList.remove('drag'); this._busy = false;
        };
        const cancel = () => { cleanup(); this._render(true); };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
      });
    }
    _dev(kind) {
      const c = this._config;
      if (kind === 'receiver') { const s = this._st(c.receiver); if (s) this._call('media_player', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: c.receiver }); }
      else if (kind === 'projector') { const s = this._st(c.projector); if (s) this._call('homeassistant', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: c.projector }); }
      else if (kind === 'atv') { const s = this._st(c.apple_tv.entity); if (s) this._call('media_player', ['off', 'standby'].includes(s.state) ? 'turn_on' : 'turn_off', { entity_id: c.apple_tv.entity }); }
      else if (kind === 'lamp') { const s = this._st(c.lamp_automation); if (s) this._call('automation', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: c.lamp_automation }); }
    }
    _step(id, dir) {
      const st = this._st(id); if (!st) return;
      const a = st.attributes, stepv = Number(a.step) || 1, cur = this._pval(id) ?? Number(st.state);
      const v = clamp(Math.round((cur + dir * stepv) / stepv) * stepv, Number(a.min), Number(a.max));
      if (v === cur) return;
      this._pset[id] = { v, t: Date.now() };
      // Update the row in place: never rebuild the panel under the user's finger.
      if (!this._paintStep(id, st, v)) this._render(true);
      // Hold off full re-renders while the user is still tapping; catch up once they stop.
      this._busy = true;
      clearTimeout(this._stepHold);
      this._stepHold = setTimeout(() => { this._busy = false; this._render(false); }, 1500);
      clearTimeout(this._deb[id]);
      this._deb[id] = setTimeout(() => this._call('input_number', 'set_value', { entity_id: id, value: v }), 650);
    }
    _paintStep(id, st, v) {
      const row = Array.from(this.shadowRoot.querySelectorAll('[data-row]')).find((x) => x.dataset.row === id);
      if (!row) return false;
      const nv = this._numView(st, v);
      const sv = row.querySelector('.sv'), mf = row.querySelector('.mf');
      if (sv) { sv.textContent = nv.txt; sv.classList.add('pend'); }
      if (mf) { mf.style.left = `${nv.left}%`; mf.style.width = `${nv.width}%`; }
      row.querySelectorAll('button[data-act="step"]').forEach((b) => { b.disabled = Number(b.dataset.dir) < 0 ? v <= nv.mn : v >= nv.mx; });
      this._colC._lwHtml = null; // DOM no longer matches the cached markup; let the next render re-sync it
      return true;
    }
    _css() {
      return `
:host { touch-action:manipulation; }
.card, button, select, label, .stp, .tg, .seg, .dev, .xpt { touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
button { -webkit-user-select:none; user-select:none; }
ha-icon { flex:none; }
.card { container-type:inline-size; padding:20px; }
.amb { position:absolute; inset:0; z-index:-1; pointer-events:none; opacity:0; transition:opacity .8s;
  background:radial-gradient(700px 360px at 18% -8%, rgba(167,139,250,.20), transparent 65%), radial-gradient(600px 300px at 100% 110%, rgba(56,189,248,.10), transparent 65%); }
.r-on .amb { opacity:.55; } .show .amb { opacity:1; }
.hd { gap:12px; }
.pill { display:inline-flex; align-items:center; gap:6px; padding:5px 12px 5px 9px; border-radius:999px; font-size:12.5px; font-weight:700; white-space:nowrap;
  background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); color:#9aa0aa; }
.pill ha-icon { --mdc-icon-size:15px; }
.p-show { color:#fff; background:linear-gradient(90deg, rgba(167,139,250,.35), rgba(56,189,248,.25)); border-color:rgba(167,139,250,.55); box-shadow:0 0 18px rgba(167,139,250,.35); }
.p-show ha-icon { animation:reel 3s linear infinite; }
.p-warm { color:#e9d5ff; border-color:rgba(167,139,250,.35); }
.pwr { width:46px; height:46px; flex:none; border-radius:50%; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1); color:#9aa0aa; transition:all .25s; }
.pwr ha-icon { --mdc-icon-size:24px; }
.pwr.on { background:#a78bfa; color:#140f24; border-color:transparent; box-shadow:0 0 24px rgba(167,139,250,.6); }
.body { display:grid; gap:18px; margin-top:16px; grid-template-columns:minmax(0,1fr); grid-template-areas:"a" "b" "c"; }
.colA { grid-area:a; display:flex; flex-direction:column; min-width:0; }
.colB { grid-area:b; container-type:inline-size; display:flex; flex-direction:column; gap:16px; min-width:0; }
.recv { display:flex; flex-direction:column; gap:16px; }
.colC { grid-area:c; min-width:0; }
/* medium: screen | controls on top, settings across the bottom */
@container (min-width: 660px) {
  .body { grid-template-columns:minmax(0,1fr) minmax(0,1fr); grid-template-areas:"a b" "c c"; align-items:stretch; }
  .colC .tune { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
  .scr { --lat-grow:1; --lat-dir:column; --lat-gap:16px; --lat-align:center; --lat-tile:132px; --lat-radius:30px; --lat-icon:60px; --lat-items:center; --lat-self:center; --lat-title:22px; --lat-meta-w:100%; --lat-meta-flex:0 0 auto; }
}
/* wide: three sections — Apple TV | devices & receiver | audio settings */
@container (min-width: 1020px) {
  .body { grid-template-columns:minmax(0,1fr) minmax(0,1.1fr) minmax(0,1fr); grid-template-areas:"a b c"; gap:22px; }
  .colB, .colC { padding-left:22px; border-left:1px solid rgba(255,255,255,0.06); }
  .colC .tune { display:flex; }
  .colC .xpt { pointer-events:none; } .colC .xpt .xc { display:none; } .colC .xp { grid-template-rows:1fr; }
  .scr { --lat-tile:168px; --lat-radius:38px; --lat-icon:72px; --lat-title:24px; }
}
.scrw { position:relative; flex:1; display:flex; flex-direction:column; border-radius:24px; transition:box-shadow .8s; }
.scr { flex:1; display:flex; flex-direction:column; }
.scr > * { flex:1; display:block; }
.p-on .scrw { box-shadow:0 0 0 1px rgba(56,189,248,.18), 0 18px 60px -18px rgba(56,189,248,.45); animation:flick 6s ease-in-out infinite; }
.scr:empty { display:none; }
/* format badges */
.fmt { margin-top:12px; }
.fmt:empty { display:none; }
.fbs { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px; }
.fb { display:inline-flex; flex-direction:column; align-items:center; justify-content:center; height:44px; min-width:58px; padding:0 12px; border-radius:10px; line-height:1;
  color:#f3f4f6; background:rgba(255,255,255,0.045); border:1px solid rgba(255,255,255,0.16); animation:fbin .45s cubic-bezier(.2,.9,.3,1.2) both; }
.fb i { font-style:normal; font-size:8.5px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:#9aa0aa; margin-bottom:4px; white-space:nowrap; }
.fb b { font-size:17px; font-weight:800; letter-spacing:.01em; white-space:nowrap; }
.fb.res { border:1.5px solid rgba(255,255,255,.55); }
.fb.res b { font-size:20px; font-weight:900; letter-spacing:-.02em; }
.fb.dv, .fb.atmos { background:#08080a; border-color:rgba(255,255,255,.22); }
.fb.dv i, .fb.atmos i { color:#e5e7eb; font-size:9px; letter-spacing:.34em; margin-bottom:5px; }
.fb.dv b, .fb.atmos b { font-size:14px; font-weight:300; letter-spacing:.24em; text-transform:uppercase; padding-left:.24em; }
.fb.dv { box-shadow:inset 0 -2px 0 rgba(167,139,250,.75), 0 0 16px rgba(167,139,250,.18); }
.fb.atmos { box-shadow:inset 0 -2px 0 rgba(56,189,248,.75), 0 0 16px rgba(56,189,248,.18); }
.fb.hdr b { background:linear-gradient(90deg, #fbbf24, #f472b6 55%, #a78bfa); -webkit-background-clip:text; background-clip:text; color:transparent; }
.fb.ch b { font-size:19px; font-variant-numeric:tabular-nums; }
.fb.fi { padding:0 8px; } .fb.fi img { height:26px; width:auto; display:block; }
.fsep { width:1px; height:28px; margin:0 2px; background:rgba(255,255,255,.14); }
.devs { display:flex; flex-direction:column; gap:10px; }
.grid { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:8px; }
.dev { position:relative; display:flex; flex-direction:column; align-items:flex-start; gap:4px; padding:11px 10px 10px; border-radius:18px; min-width:0; text-align:left;
  background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); transition:all .25s; }
.dev:hover { background:rgba(255,255,255,0.07); }
.di { width:32px; height:32px; border-radius:11px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.07); color:#9aa0aa; margin-bottom:4px; transition:all .25s; }
.dev.on { background:linear-gradient(160deg, color-mix(in srgb, var(--dc) 18%, transparent), rgba(255,255,255,0.03)); border-color:color-mix(in srgb, var(--dc) 40%, transparent); }
.dev.on .di { background:var(--dc); color:#0e1014; box-shadow:0 0 16px color-mix(in srgb, var(--dc) 55%, transparent); }
.dt { display:flex; flex-direction:column; gap:2px; min-width:0; max-width:100%; }
@container (max-width: 380px) {
  .grid { grid-template-columns:repeat(2, minmax(0,1fr)); }
  .dev { flex-direction:row; align-items:center; gap:10px; padding:10px; }
  .di { margin-bottom:0; flex:none; }
  .fbs { gap:6px; } .fb { height:40px; min-width:50px; padding:0 9px; } .fsep { display:none; }
}
.dn { font-size:13px; font-weight:700; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ds { font-size:11.5px; color:#8b919c; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dev.on .ds { color:color-mix(in srgb, var(--dc) 70%, white 20%); }
.sec { display:flex; flex-direction:column; gap:10px; }
.sh { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:30px; }
.k { font-size:10.5px; letter-spacing:.14em; font-weight:700; color:#8b919c; text-transform:uppercase; }
.kv { font-size:13px; font-weight:600; color:#cbd5e1; }
.mute { display:flex; align-items:center; gap:6px; padding:6px 12px 6px 9px; border-radius:12px; font-size:12.5px; font-weight:700; color:#cbd5e1; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.07); }
.mute ha-icon { --mdc-icon-size:16px; }
.mute.on { color:#fca5a5; background:rgba(239,68,68,.16); border-color:rgba(239,68,68,.45); }
.vrow { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:8px; align-items:center; }
.vb { width:44px; height:58px; border-radius:16px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.07); color:#e5e7eb; }
.vb:active { background:rgba(167,139,250,.25); }
.vs { position:relative; height:58px; border-radius:18px; overflow:hidden; cursor:ew-resize; touch-action:pan-y; user-select:none; -webkit-user-select:none;
  background:repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 10%), rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.07); }
.vfill { position:absolute; inset:0 auto 0 0; background:linear-gradient(90deg, rgba(167,139,250,.35), #a78bfa); box-shadow:0 0 26px rgba(167,139,250,.45); transition:width .3s ease; }
.vgrip { position:absolute; top:13px; bottom:13px; width:4px; margin-left:-11px; border-radius:2px; background:rgba(255,255,255,.9); transition:left .3s ease; }
.vs.drag .vfill, .vs.drag .vgrip { transition:none; }
.vs.muted .vfill { background:rgba(255,255,255,0.12); box-shadow:none; }
.vlbl { position:absolute; inset:0; display:flex; align-items:center; justify-content:flex-end; padding:0 14px; pointer-events:none; }
.vread { margin-left:auto; display:flex; align-items:baseline; gap:3px; }
.vread b { font-size:22px; font-weight:700; letter-spacing:-0.02em; font-variant-numeric:tabular-nums; color:#f3f4f6; }
.vread i { font-style:normal; font-size:12px; font-weight:600; color:#9aa0aa; }
.vread.m b { color:#6b7280; text-decoration:line-through; text-decoration-thickness:2px; }
.vh { display:flex; align-items:center; gap:4px; font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; font-weight:700; color:rgba(255,255,255,.3); transition:color .2s, transform .2s; }
.vh ha-icon { --mdc-icon-size:15px; }
.vh.nudge { color:#fff; animation:nudge .45s ease 2; }
.srcs, .modes { display:flex; flex-wrap:wrap; gap:7px; }
.src, .mode { display:flex; align-items:center; gap:7px; padding:8px 12px 8px 10px; border-radius:13px; font-size:13px; font-weight:600; color:#cbd5e1;
  background:rgba(255,255,255,0.045); border:1px solid rgba(255,255,255,0.06); transition:all .2s; }
.src ha-icon, .mode ha-icon { --mdc-icon-size:16px; width:16px; height:16px; color:#8b919c; }
.src:hover, .mode:hover { background:rgba(255,255,255,0.08); }
.src.sel, .mode.sel { color:#fff; background:rgba(167,139,250,.2); border-color:rgba(167,139,250,.55); box-shadow:0 0 14px rgba(167,139,250,.25); }
.src.sel ha-icon, .mode.sel ha-icon { color:#c4b5fd; }
.allm { position:relative; display:flex; align-items:center; gap:4px; padding:6px 8px 6px 12px; border-radius:12px; font-size:12.5px; font-weight:700; color:#cbd5e1; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.07); cursor:pointer; }
.allm ha-icon { --mdc-icon-size:18px; color:#8b919c; }
.allm select { position:absolute; inset:0; opacity:0; cursor:pointer; font-size:16px; }
.standby { display:flex; align-items:center; gap:14px; padding:16px; border-radius:20px; background:rgba(255,255,255,0.035); border:1px dashed rgba(255,255,255,0.1); }
.si { width:44px; height:44px; flex:none; border-radius:14px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.06); color:#8b919c; }
.st { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.st b { font-size:15px; } .st span { font-size:12.5px; color:#9aa0aa; line-height:1.35; }
.go { flex:none; display:flex; align-items:center; gap:6px; padding:10px 16px 10px 12px; border-radius:14px; font-weight:700; color:#140f24; background:#a78bfa; box-shadow:0 0 18px rgba(167,139,250,.45); }
.xpt { width:100%; display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:18px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); text-align:left; }
.xpt:hover { background:rgba(255,255,255,0.065); }
.xi { color:#c4b5fd; } .xl { font-size:14px; font-weight:700; } .xv { flex:1; text-align:right; font-size:12px; color:#8b919c; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.xc { --mdc-icon-size:20px; color:#8b919c; transition:transform .25s; } .xpt.open .xc { transform:rotate(180deg); }
.xp { display:grid; grid-template-rows:0fr; transition:grid-template-rows .3s ease; }
.xp.open { grid-template-rows:1fr; }
.xpi { overflow:hidden; min-height:0; }
.tune { display:flex; flex-direction:column; gap:8px; padding-top:10px; }
.tr { display:grid; grid-template-columns:34px minmax(0,1fr) auto; gap:12px; align-items:center; padding:10px 12px; border-radius:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); }
.tr.col { grid-template-columns:minmax(0,1fr); gap:10px; }
.trh { display:grid; grid-template-columns:34px minmax(0,1fr); gap:12px; align-items:center; }
.tr.na { opacity:.5; }
.ti { width:34px; height:34px; border-radius:11px; display:flex; align-items:center; justify-content:center; background:rgba(167,139,250,.12); color:#c4b5fd; }
.tn { min-width:0; display:flex; flex-direction:column; gap:2px; }
.tn b { font-size:14px; font-weight:600; } .tn i { font-style:normal; font-size:11.5px; color:#8b919c; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mt { position:relative; display:block; height:3px; margin-top:5px; border-radius:2px; background:rgba(255,255,255,0.08); max-width:150px; }
.mf { position:absolute; top:0; bottom:0; border-radius:2px; background:#a78bfa; box-shadow:0 0 8px rgba(167,139,250,.6); transition:all .25s; }
.mz { position:absolute; top:-2px; bottom:-2px; width:1px; background:rgba(255,255,255,.4); }
.stp { display:flex; align-items:center; gap:4px; padding:3px; border-radius:14px; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); }
.stp button { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#e5e7eb; background:rgba(255,255,255,0.06); }
.stp button:active { background:rgba(167,139,250,.3); }
.stp button:disabled { opacity:.35; }
.sv { min-width:62px; text-align:center; font-size:14px; font-weight:700; font-variant-numeric:tabular-nums; }
.sv.pend { color:#c4b5fd; }
.tg { position:relative; width:52px; height:30px; flex:none; border-radius:15px; background:rgba(255,255,255,0.12); transition:background .25s; }
.tg::after { content:''; position:absolute; top:3px; left:3px; width:24px; height:24px; border-radius:50%; background:#e5e7eb; box-shadow:0 1px 4px rgba(0,0,0,.45); transition:transform .25s cubic-bezier(.3,1.4,.5,1); }
.tg.on { background:#a78bfa; } .tg.on::after { transform:translateX(22px); background:#fff; }
.segs { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(0,1fr); gap:3px; padding:3px; border-radius:14px; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.06); }
.seg { padding:8px 4px; border-radius:11px; font-size:12.5px; font-weight:600; color:#9aa0aa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:all .2s; }
.seg.sel { background:#a78bfa; color:#140f24; box-shadow:0 0 14px rgba(167,139,250,.4); }
.fine { margin-top:10px; font-size:11.5px; color:#6b7280; }
.colC.idle { display:flex; flex-direction:column; gap:10px; }
.sums { display:grid; grid-template-columns:minmax(0,1fr); gap:6px; }
.sum { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:10px; padding:9px 12px; border-radius:14px; background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.045); }
.sum ha-icon { --mdc-icon-size:16px; color:#6b7280; }
.sn { font-size:13px; color:#9aa0aa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sum b { font-size:13px; font-weight:700; color:#cbd5e1; font-variant-numeric:tabular-nums; }
@container (min-width: 660px) and (max-width: 1019px) { .sums { grid-template-columns:repeat(2, minmax(0,1fr)); } }
.offnote { display:flex; align-items:center; gap:8px; font-size:12px; color:#6b7280; padding:2px 2px 0; }
.offnote ha-icon { --mdc-icon-size:15px; }
@keyframes reel { to { transform:rotate(360deg); } }
@keyframes flick { 0%,100% { box-shadow:0 0 0 1px rgba(56,189,248,.18), 0 18px 60px -18px rgba(56,189,248,.45); } 50% { box-shadow:0 0 0 1px rgba(167,139,250,.22), 0 18px 64px -16px rgba(167,139,250,.5); } }
@keyframes nudge { 0%,100% { transform:translateX(0); } 50% { transform:translateX(-5px); } }
@keyframes fbin { from { opacity:0; transform:translateY(5px) scale(.94); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce) { .fb { animation:none; } }`;
    }
  }

  if (!customElements.get('linwood-theater-card')) customElements.define('linwood-theater-card', LinwoodTheaterCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.find((c) => c.type === 'linwood-theater-card')) window.customCards.push({ type: 'linwood-theater-card', name: 'Linwood Theater Card', description: 'Apple TV, receiver, projector and lamp automation in one console', preview: false });
})();
