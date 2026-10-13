/* Linwood TV Card v1.0.1 — LG OLED (picture) + Sonos soundbar (sound) + Apple TV (source) in one console.
 * Sibling of Linwood Theater Card v1.3.2: same layout, styles and DOM morph; the Denon receiver controls are replaced with Sonos ones.
 * Requires Linwood Kit (shared base + styles); embeds linwood-appletv-card for the screen.
 *   tv: media_player.lg_g4_oled            soundbar: media_player.ethans_bedroom_sonos
 *   tv_source: Apple OTT                    # LG input the Apple TV is plugged into
 *   lights: light.bedroom_lights            max_volume: 0.5   # top of the volume slider (Sonos 0–1)
 *   formats: sensor.<sonos>_audio_input_format   # drives the audio badges (Dolby Atmos / 7.1 / 5.1 / 2.0 …)
 *   video_resolution: 4K                    # Apple TV 4K → TV signal; shown while the TV is on the Apple TV input (false hides it)
 *   hdr: <entity>                           # optional — any entity whose state is Dolby Vision / HDR10 / HDR10+ / HLG / SDR
 *   format_images: { dolby_atmos: /local/fmt/atmos.svg, ... }   # optional artwork per badge key
 *   sound:    { night_sound, speech_enhancement }                # quick toggles (switch.*)
 *   settings: { audio_delay, bass, treble, loudness, surround_level, music_surround_level, sub_gain }  # number.* / switch.*
 * Power: Start wakes the Apple TV (TV + Sonos follow over HDMI-CEC/eARC); End turns the TV and Apple TV off.
 */
(async () => {
  if (!customElements.get('linwood-light-card')) await customElements.whenDefined('linwood-light-card');
  const { esc, clamp, moreInfo, BASE_CSS, Base: LinwoodBase } = window.LinwoodKit;
  /* ---------- minimal DOM morph (same as the theater card) ---------- */
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
  /* ---------- Sonos audio input format ---------- */
  const OFF = ['off', 'standby', 'unavailable', 'unknown'];
  const CH = { 1: '1.0', 2: '2.0', 5: '5.1', 7: '7.1' };
  const RES_CAP = { '8K': 'Ultra HD', '4K': 'Ultra HD', '1080p': 'Full HD', '720p': 'HD' };
  // "Dolby Atmos (MAT 2.0)", "Multichannel PCM 5.1", "PCM 2.0 no audio", "Dolby 5.1", "Unknown audio input format: 84934678" …
  const parseFormat = (raw) => {
    let s = String(raw == null ? '' : raw).trim();
    if (!s || ['unavailable', 'unknown', 'no input', 'no audio'].includes(s.toLowerCase())) return null;
    const unk = s.match(/^Unknown audio input format:\s*(\d+)/i);
    if (unk) {
      // Sonos packs channels in the top byte, codec family next, signal state in the low byte (0x16 = no audio)
      const n = Number(unk[1]), ch = CH[(n >>> 24) & 0xff], fam = (n >>> 16) & 0xff;
      if (!ch || (fam !== 0x00 && fam !== 0x10)) return null;
      return { atmos: false, codec: 'PCM', ch, silent: (n & 0xff) === 0x16, raw: `${ch === '2.0' ? '' : 'Multichannel '}PCM ${ch}` };
    }
    const silent = /no audio$/i.test(s);
    s = s.replace(/\s*no audio$/i, '');
    const chm = s.match(/(\d\.\d)/);
    const codec = /truehd/i.test(s) ? 'TrueHD' : /digital plus|dd\+/i.test(s) ? 'DD+' : /dts/i.test(s) ? 'DTS'
      : /^dolby/i.test(s) ? 'Dolby' : /pcm|stereo/i.test(s) ? 'PCM' : null;
    return { atmos: /atmos/i.test(s), codec, ch: chm ? chm[1] : /stereo/i.test(s) ? '2.0' : null, silent, raw: s };
  };
  const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`;
  const SOUND = [
    ['night_sound', 'Night sound', 'mdi:weather-night', 'Evens out loud effects'],
    ['speech_enhancement', 'Speech', 'mdi:account-voice', 'Clearer dialog'],
  ];
  const TUNING = [
    ['audio_delay', 'Lip-sync delay', 'mdi:timer-sand', 'Audio delay · 0 = off', (v) => (v ? `${v} / 5` : 'Off')],
    ['bass', 'Bass', 'mdi:speaker', 'Low-end EQ', signed],
    ['treble', 'Treble', 'mdi:music-clef-treble', 'High-end EQ', signed],
    ['loudness', 'Loudness', 'mdi:equalizer', 'Fuller sound at low volume'],
    ['sub_gain', 'Subwoofer', 'mdi:speaker-wireless', 'Sub level', signed],
    ['surround_level', 'Surrounds · TV', 'mdi:surround-sound', 'Rear speaker level for TV', signed],
    ['music_surround_level', 'Surrounds · music', 'mdi:music-note', 'Rear speaker level for music', signed],
  ];
  const BOOL = ['switch', 'input_boolean'];

  class LinwoodTvCard extends LinwoodBase {
    setConfig(config) {
      if (!config || !config.soundbar) throw new Error('Set "soundbar" (Sonos media_player)');
      this._pset = {}; this._deb = {}; this._pv = null;
      this._skel = false; this._atv = null;
      super.setConfig(config);
    }
    getCardSize() { return 12; }
    getGridOptions() { return { columns: 'full', rows: 'auto' }; }
    set hass(hass) { this._hass = hass; if (this._atv) this._atv.hass = hass; if (!this._busy) this._render(false); }
    disconnectedCallback() { Object.values(this._deb || {}).forEach(clearTimeout); clearTimeout(this._stepHold); }
    _pval(id) { const p = this._pset[id]; return p && Date.now() - p.t < 8000 ? p.v : null; }
    _xpKey() { return `linwood-tv-xp:${this._config.soundbar}`; }
    _xpOpen() {
      if (this._xpState != null) return this._xpState;
      try { this._xpState = window.localStorage.getItem(this._xpKey()) === '1'; } catch (e) { this._xpState = false; }
      return this._xpState;
    }
    _xpSave(v) { this._xpState = v; try { window.localStorage.setItem(this._xpKey(), v ? '1' : '0'); } catch (e) { /* ignore */ } }
    _on(s) { return !!s && !OFF.includes(s.state); }
    _want() { return this._config.tv_source || 'Apple OTT'; }
    _sbName() { return this._config.soundbar_name || 'Soundbar'; }
    _signature() {
      const c = this._config, atvId = c.apple_tv && c.apple_tv.entity;
      const ids = [c.tv, c.soundbar, c.lights, c.formats, c.hdr, atvId, ...Object.values(c.settings || {}), ...Object.values(c.sound || {})].filter((v) => typeof v === 'string');
      return ids.map((id) => {
        const s = this._st(id); if (!s) return '-';
        const a = s.attributes;
        if (id === c.soundbar) return `${s.state}|${a.volume_level}|${a.is_volume_muted}|${a.source}|${a.media_title}`;
        if (id === c.tv) return `${s.state}|${a.source}|${a.sound_output}`;
        if (id === atvId) return `${s.state}|${a.app_name}`;
        return s.state;
      }).join('§') + JSON.stringify(this._pset) + JSON.stringify(this._pv) + this._xpOpen();
    }
    _render(force) {
      if (!this._hass || !this._config) return;
      if (!this._skel) this._build();
      const sig = this._signature();
      if (!force && sig === this._sig) return;
      this._sig = sig;
      const c = this._config, tv = this._st(c.tv), sb = this._st(c.soundbar), atv = c.apple_tv && this._st(c.apple_tv.entity);
      const tvOn = this._on(tv), sbLive = !!sb && sb.state !== 'unavailable';
      const f = c.formats ? parseFormat((this._st(c.formats) || {}).state) : null;
      const atvPlay = !!atv && ['playing', 'paused'].includes(atv.state);
      const show = tvOn && (atvPlay || (!!f && !f.silent));
      const cls = `card${tvOn ? ' r-on p-on' : ''}${show ? ' show' : ''}`;
      if (this._card.className !== cls) this._card.className = cls;
      patchHtml(this._top, this._topHtml(tv, sb, tvOn, show));
      patchHtml(this._devs, this._devsHtml(tv, tvOn, sb, f));
      patchHtml(this._recv, this._recvHtml(tv, tvOn, sb));
      patchHtml(this._colC, sbLive ? this._tuneHtml() : this._tuneSummary());
      this._colC.classList.toggle('idle', !sbLive);
      const fmt = this._fmtHtml(tv, tvOn, f);
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
    _topHtml(tv, sb, tvOn, show) {
      const music = !tvOn && !!sb && sb.state === 'playing';
      const st = !tv ? ['TV missing', 'off', 'mdi:alert'] : show ? ['Showtime', 'show', 'mdi:filmstrip'] : tvOn ? ['TV on', 'warm', 'mdi:television'] : music ? ['Music', 'warm', 'mdi:music-note'] : ['Standby', 'off', 'mdi:power-sleep'];
      return `<div class="hd"><span class="ttl">${esc(this._config.title || 'TV')}</span>
  <span class="pill p-${st[1]}"><ha-icon icon="${st[2]}"></ha-icon>${st[0]}</span>
  <button class="pwr${tvOn ? ' on' : ''}" data-act="power" aria-label="${tvOn ? 'Turn the TV and Apple TV off' : 'Wake the Apple TV (TV and soundbar follow)'}" ${!tv ? 'disabled' : ''}><ha-icon icon="mdi:power"></ha-icon></button></div>`;
    }
    /* Badges: audio from the Sonos input-format sensor; video only while the TV is on the Apple TV input. */
    _fmtList(tv, tvOn, f) {
      const c = this._config, out = [];
      const sb = this._st(c.soundbar);
      if (!f || (sb && sb.attributes.source && sb.attributes.source !== 'TV')) return out;
      const onAtv = tvOn && (!tv.attributes.source || tv.attributes.source === this._want());
      if (onAtv && c.video_resolution !== false) {
        const res = c.video_resolution || '4K';
        out.push({ g: 'v', k: String(res).toLowerCase(), cls: 'res', top: RES_CAP[res] || 'Video', main: res, tip: `${res} · Apple TV output` });
      }
      const h = c.hdr && this._st(c.hdr), hs = h ? String(h.state) : '';
      if (onAtv && hs && !['unknown', 'unavailable', 'sdr', 'off', 'none', ''].includes(hs.toLowerCase())) {
        if (/dolby\s*vision|^dv$/i.test(hs)) out.push({ g: 'v', k: 'dolby_vision', cls: 'dv', top: 'Dolby', main: 'Vision', tip: 'Dolby Vision' });
        else out.push({ g: 'v', k: hs.toLowerCase(), cls: 'hdr', top: /hlg/i.test(hs) ? 'HDR' : 'High dynamic range', main: hs, tip: hs });
      }
      if (f.atmos) out.push({ g: 'a', k: 'dolby_atmos', cls: 'atmos', top: 'Dolby', main: 'Atmos', tip: f.raw });
      else if (f.ch) {
        const top = f.codec && f.codec !== 'PCM' ? f.codec : f.ch === '2.0' ? 'Stereo' : f.ch === '1.0' ? 'Mono' : 'Multichannel';
        out.push({ g: 'a', k: f.ch, cls: 'ch', top, main: f.ch, tip: f.raw });
      } else if (f.codec) out.push({ g: 'a', k: f.codec.toLowerCase(), cls: 'ch', top: 'Audio', main: f.codec, tip: f.raw });
      return out;
    }
    _fmtHtml(tv, tvOn, f) {
      const list = this._fmtList(tv, tvOn, f);
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
      return `<div class="fbs${f && f.silent ? ' quiet' : ''}">${html}</div>${f && f.silent ? '<div class="fq">Signal idle — paused or between titles</div>' : ''}`;
    }
    _devsHtml(tv, tvOn, sb, f) {
      const c = this._config, tiles = [];
      const tile = (kind, icon, name, on, sub, color, dis) => `<button class="dev${on ? ' on' : ''}" data-act="dev" data-kind="${kind}" style="--dc:${color}" ${dis ? 'disabled' : ''}><span class="di"><ha-icon icon="${icon}"></ha-icon></span><span class="dt"><span class="dn">${name}</span><span class="ds">${esc(sub)}</span></span></button>`;
      if (tv) {
        const src = tv.attributes.source;
        tiles.push(tile('tv', 'mdi:television', c.tv_name || 'TV', tvOn, tvOn ? (src === this._want() ? 'Apple TV input' : src || 'On') : 'Off', '#38bdf8', false));
      }
      if (sb) {
        const a = sb.attributes, live = sb.state === 'playing';
        const sub = sb.state === 'unavailable' ? 'Offline'
          : a.source === 'TV' ? (f && !f.silent ? (f.atmos ? 'Dolby Atmos' : f.ch ? `TV · ${f.ch}` : 'TV audio') : 'TV audio')
            : live ? (a.media_title || 'Playing') : sb.state === 'paused' ? 'Paused' : 'Ready';
        tiles.push(tile('soundbar', 'mdi:soundbar', esc(this._sbName()), live, sub, '#a78bfa', sb.state === 'unavailable'));
      }
      const atv = c.apple_tv && this._st(c.apple_tv.entity);
      if (atv) {
        const s = atv.state, on = !OFF.includes(s);
        tiles.push(tile('atv', 'mdi:apple', 'Apple TV', on, s === 'playing' ? (atv.attributes.app_name || 'Playing') : s === 'paused' ? 'Paused' : on ? 'Awake' : s === 'unavailable' ? 'Offline' : 'Asleep', '#e5e7eb', s === 'unavailable'));
      }
      const L = this._st(c.lights);
      if (L) {
        const on = L.state === 'on', n = (L.attributes.entity_id || []).filter((e) => (this._st(e) || {}).state === 'on').length;
        tiles.push(tile('lights', on ? 'mdi:lightbulb-group' : 'mdi:lightbulb-group-outline', 'Lights', on, L.state === 'unavailable' ? 'Offline' : on ? (n ? `${n} on` : 'On') : 'Off', '#f5b83d', L.state === 'unavailable'));
      }
      const on = tiles.filter((t) => t.startsWith('<button class="dev on"')).length;
      return `<div class="sh"><span class="k">Devices</span><span class="kv">${on} of ${tiles.length} on</span></div><div class="grid">${tiles.join('')}</div>`;
    }
    _vol(sb) { if (this._pv && Date.now() - this._pv.t < 6000) return this._pv.v; return Number(sb.attributes.volume_level || 0); }
    _vtxt(v) { return String(Math.round(v * 100)); }
    _soundHtml() {
      const snd = this._config.sound || {};
      const items = SOUND.filter(([k]) => snd[k]).map(([k, name, icon, hint]) => {
        const id = snd[k], st = this._st(id);
        if (!st) return null;
        const p = this._pval(id), on = p != null ? p : st.state === 'on';
        return { on, name, html: `<button class="mode${on ? ' sel' : ''}" data-act="bool" data-id="${id}" title="${esc(hint)}" aria-pressed="${on}" ${st.state === 'unavailable' ? 'disabled' : ''}><ha-icon icon="${icon}"></ha-icon><span>${name}</span><i class="mh">${esc(hint)}</i></button>` };
      }).filter(Boolean);
      if (!items.length) return '';
      const act = items.filter((i) => i.on).map((i) => i.name);
      return `<div class="sec"><div class="sh"><span class="k">Sound</span><span class="kv">${esc(act.length ? act.join(' · ') : 'Standard')}</span></div><div class="modes">${items.map((i) => i.html).join('')}</div></div>`;
    }
    _recvHtml(tv, tvOn, sb) {
      if (!sb) return `<div class="standby"><ha-icon icon="mdi:alert"></ha-icon><div><b>Soundbar not found</b><span>${esc(this._config.soundbar)}</span></div></div>`;
      const playing = ['playing', 'paused'].includes(sb.state);
      if (!tvOn && !playing) {
        const atv = this._config.apple_tv && this._st(this._config.apple_tv.entity);
        return `<div class="standby"><span class="si"><ha-icon icon="mdi:power-sleep"></ha-icon></span><div class="st"><b>TV is off</b><span>Start wakes the Apple TV — the TV and ${esc(this._sbName())} follow over HDMI.</span></div>
          <button class="go" data-act="power" ${!atv || atv.state === 'unavailable' ? 'disabled' : ''}><ha-icon icon="mdi:play"></ha-icon>Start</button></div>${this._soundHtml()}`;
      }
      const a = sb.attributes, maxV = this._config.max_volume || 0.6;
      const v = this._vol(sb), muted = !!a.is_volume_muted;
      const pct = clamp(v / maxV, 0, 1) * 100;
      let path = '';
      if (tvOn) {
        const src = tv.attributes.source, out = tv.attributes.sound_output;
        const onAtv = src === this._want(), sbTv = a.source === 'TV', arcOk = !out || /arc/i.test(out);
        const chips = [
          `<button class="src${onAtv ? ' sel' : ' warn'}" data-act="tvsrc"><ha-icon icon="mdi:apple"></ha-icon>${onAtv ? 'Apple TV' : 'Switch to Apple TV'}</button>`,
          arcOk
            ? `<button class="src${sbTv ? ' sel' : ' warn'}" data-act="sbtv"><ha-icon icon="mdi:soundbar"></ha-icon>${sbTv ? `TV → ${esc(this._sbName())}` : `Play TV on ${esc(this._sbName())}`}</button>`
            : `<button class="src warn" data-act="arc"><ha-icon icon="mdi:alert"></ha-icon>TV speakers on — use ${esc(this._sbName())}</button>`,
        ].join('');
        const kv = onAtv && sbTv && arcOk ? 'eARC · all set' : !onAtv ? `TV on ${esc(src || '?')}` : 'Audio not routed';
        path = `<div class="sec"><div class="sh"><span class="k">Signal path</span><span class="kv${onAtv && sbTv && arcOk ? '' : ' wv'}">${kv}</span></div><div class="srcs">${chips}</div></div>`;
      }
      return `<div class="sec">
  <div class="sh"><span class="k">Volume · ${esc(this._sbName())}</span><span class="vread${muted ? ' m' : ''}"><b>${this._vtxt(v)}</b><i>/ 100</i></span><button class="mute${muted ? ' on' : ''}" data-act="mute" aria-label="${muted ? 'Unmute' : 'Mute'}"><ha-icon icon="${muted ? 'mdi:volume-off' : 'mdi:volume-high'}"></ha-icon>${muted ? 'Muted' : 'Mute'}</button></div>
  <div class="vrow">
    <button class="vb" data-act="vdown" aria-label="Volume down"><ha-icon icon="mdi:minus"></ha-icon></button>
    <div class="vs${muted ? ' muted' : ''}" data-act="vslide" role="slider" aria-valuenow="${this._vtxt(v)}" aria-label="Volume (drag)">
      <div class="vfill" style="width:${pct}%"></div><div class="vgrip" style="left:${pct}%"></div>
      <div class="vlbl"><span class="vh"><ha-icon icon="mdi:gesture-swipe-horizontal"></ha-icon>drag</span></div>
    </div>
    <button class="vb" data-act="vup" aria-label="Volume up"><ha-icon icon="mdi:plus"></ha-icon></button>
  </div>
</div>${path}${this._soundHtml()}`;
    }
    _numView(st, v, fmt) {
      const at = st.attributes, mn = Number(at.min), mx = Number(at.max);
      const unit = at.unit_of_measurement || '';
      const centred = mn < 0 && mx > 0;
      const txt = isNaN(v) ? '—' : fmt ? fmt(v) : `${v}${unit ? ` ${unit}` : ''}`;
      let left, width, z = null;
      if (centred) { z = (-mn / (mx - mn)) * 100; const x = ((v - mn) / (mx - mn)) * 100; left = Math.min(z, x); width = Math.abs(x - z); }
      else { left = 0; width = clamp((v - mn) / (mx - mn), 0, 1) * 100; }
      return { mn, mx, txt, centred, left, width, z };
    }
    _tuneHtml() {
      const set = this._config.settings || {}, open = this._xpOpen();
      const rows = TUNING.filter(([k]) => set[k]).map(([k, name, icon, hint, fmt]) => {
        const id = set[k], st = this._st(id);
        if (!st) return `<div class="tr na"><span class="ti"><ha-icon icon="mdi:alert"></ha-icon></span><span class="tn"><b>${name}</b><i>Missing ${esc(id)}</i></span></div>`;
        const dom = id.split('.')[0];
        if (BOOL.includes(dom)) {
          const p = this._pval(id); const on = p != null ? p : st.state === 'on';
          return `<div class="tr"><span class="ti"><ha-icon icon="${icon}"></ha-icon></span><span class="tn"><b>${name}</b><i>${hint}</i></span><button class="tg${on ? ' on' : ''}" data-act="bool" data-id="${id}" role="switch" aria-checked="${on}" aria-label="${name}" ${st.state === 'unavailable' ? 'disabled' : ''}></button></div>`;
        }
        const p = this._pval(id);
        const v = p != null ? p : Number(st.state);
        const nv = this._numView(st, v, fmt);
        const meter = nv.centred
          ? `<span class="mt c"><span class="mf" style="left:${nv.left}%; width:${nv.width}%"></span><span class="mz" style="left:${nv.z}%"></span></span>`
          : `<span class="mt"><span class="mf" style="left:0; width:${nv.width}%"></span></span>`;
        return `<div class="tr" data-row="${id}"><span class="ti"><ha-icon icon="${icon}"></ha-icon></span><span class="tn"><b>${name}</b><i>${hint}</i>${meter}</span>
          <span class="stp"><button data-act="step" data-id="${id}" data-dir="-1" aria-label="${name} down" ${v <= nv.mn ? 'disabled' : ''}><ha-icon icon="mdi:minus"></ha-icon></button><span class="sv${p != null ? ' pend' : ''}">${nv.txt}</span><button data-act="step" data-id="${id}" data-dir="1" aria-label="${name} up" ${v >= nv.mx ? 'disabled' : ''}><ha-icon icon="mdi:plus"></ha-icon></button></span></div>`;
      }).join('');
      if (!rows) return '';
      return `<button class="xpt${open ? ' open' : ''}" data-act="xp" aria-expanded="${open}"><ha-icon class="xi" icon="mdi:tune-variant"></ha-icon><span class="xl">Sound tuning</span><span class="xv">Lip-sync · EQ · loudness</span><ha-icon class="xc" icon="mdi:chevron-down"></ha-icon></button>
<div class="xp${open ? ' open' : ''}"><div class="xpi"><div class="tune">${rows}</div><div class="fine">Changes go straight to the ${esc(this._sbName())} — same settings as the Sonos app.</div></div></div>`;
    }
    _tuneSummary() {
      const set = this._config.settings || {};
      const chips = TUNING.filter(([k]) => set[k]).map(([k, name, icon, , fmt]) => {
        const st = this._st(set[k]); if (!st) return '';
        const dom = set[k].split('.')[0], n = Number(st.state);
        const v = st.state === 'unavailable' ? '—' : BOOL.includes(dom) ? (st.state === 'on' ? 'On' : 'Off') : isNaN(n) ? st.state : fmt ? fmt(n) : String(n);
        return `<span class="sum"><ha-icon icon="${icon}"></ha-icon><span class="sn">${name}</span><b>${esc(v)}</b></span>`;
      }).join('');
      if (!chips) return '';
      return `<div class="sh"><span class="k">Sound settings</span></div><div class="sums">${chips}</div>
<div class="offnote"><ha-icon icon="mdi:lan-disconnect"></ha-icon>${esc(this._sbName())} offline — adjustable when it reconnects</div>`;
    }
    /* ---------- actions ---------- */
    _power(on) {
      const c = this._config, atv = c.apple_tv && c.apple_tv.entity;
      if (on) {
        // The LG has no network power-on here; waking the Apple TV turns the TV on and switches input over HDMI-CEC.
        if (atv) this._call('media_player', 'turn_on', { entity_id: atv });
      } else {
        if (c.tv) this._call('media_player', 'turn_off', { entity_id: c.tv });
        if (atv) this._call('media_player', 'turn_off', { entity_id: atv });
      }
    }
    _wire() {
      const root = this.shadowRoot;
      root.addEventListener('click', (ev) => {
        const el = ev.composedPath().find((x) => x.dataset && x.dataset.act);
        if (!el || el.disabled) return;
        const c = this._config, act = el.dataset.act, sb = this._st(c.soundbar);
        if (act === 'power') this._power(!this._on(this._st(c.tv)));
        else if (act === 'dev') this._dev(el.dataset.kind);
        else if (act === 'mute' && sb) this._call('media_player', 'volume_mute', { entity_id: c.soundbar, is_volume_muted: !sb.attributes.is_volume_muted });
        else if (act === 'vup' || act === 'vdown') { this._pv = null; this._call('media_player', act === 'vup' ? 'volume_up' : 'volume_down', { entity_id: c.soundbar }); }
        else if (act === 'tvsrc') this._call('media_player', 'select_source', { entity_id: c.tv, source: this._want() });
        else if (act === 'sbtv') this._call('media_player', 'select_source', { entity_id: c.soundbar, source: 'TV' });
        else if (act === 'arc') this._call('webostv', 'select_sound_output', { entity_id: c.tv, sound_output: 'external_arc' });
        else if (act === 'step') this._step(el.dataset.id, Number(el.dataset.dir));
        else if (act === 'bool') {
          const id = el.dataset.id, s = this._st(id), cur = this._pval(id) ?? (s && s.state === 'on');
          this._pset[id] = { v: !cur, t: Date.now() }; this._render(true);
          this._call(id.split('.')[0], cur ? 'turn_off' : 'turn_on', { entity_id: id });
        }
        else if (act === 'xp') {
          const open = !this._xpOpen(); this._xpSave(open);
          el.classList.toggle('open', open); el.setAttribute('aria-expanded', open);
          const xp = el.nextElementSibling; if (xp) xp.classList.toggle('open', open);
          this._sig = this._signature();
        }
      });
      root.addEventListener('pointerdown', (ev) => {
        const el = ev.composedPath().find((x) => x.dataset && x.dataset.act === 'vslide');
        if (!el) return;
        const sb = this._st(this._config.soundbar); if (!sb) return;
        const maxV = this._config.max_volume || 0.6, rect = el.getBoundingClientRect();
        const startX = ev.clientX, startY = ev.clientY, startV = this._vol(sb); let dragging = false, lastV = null;
        const move = (e) => {
          if (!dragging) {
            if (Math.abs(e.clientX - startX) < 6) { if (Math.abs(e.clientY - startY) > 10) cleanup(); return; }
            dragging = true; this._busy = true; el.classList.add('drag');
            try { el.setPointerCapture(ev.pointerId); } catch (x) { /* ignore */ }
          }
          // relative drag: never jumps the volume to where the finger landed
          lastV = Math.round(clamp(startV + ((e.clientX - startX) / rect.width) * maxV, 0, maxV) * 100) / 100;
          const pct = (lastV / maxV) * 100;
          const f = el.querySelector('.vfill'), g = el.querySelector('.vgrip'), b = this.shadowRoot.querySelector('.vread b');
          if (f) f.style.width = `${pct}%`; if (g) g.style.left = `${pct}%`; if (b) b.textContent = this._vtxt(lastV);
        };
        const up = () => {
          cleanup();
          if (dragging && lastV != null) { this._pv = { v: lastV, t: Date.now() }; this._render(true); this._call('media_player', 'volume_set', { entity_id: this._config.soundbar, volume_level: lastV }); }
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
      if (kind === 'tv') { const s = this._st(c.tv); if (this._on(s)) this._call('media_player', 'turn_off', { entity_id: c.tv }); else this._power(true); }
      else if (kind === 'soundbar') moreInfo(this, c.soundbar);
      else if (kind === 'atv') { const s = this._st(c.apple_tv.entity); if (s) this._call('media_player', ['off', 'standby'].includes(s.state) ? 'turn_on' : 'turn_off', { entity_id: c.apple_tv.entity }); }
      else if (kind === 'lights') { const s = this._st(c.lights); if (s) this._call('homeassistant', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: c.lights }); }
    }
    _step(id, dir) {
      const st = this._st(id); if (!st) return;
      const a = st.attributes, stepv = Number(a.step) || 1, cur = this._pval(id) ?? Number(st.state);
      const v = clamp(Math.round((cur + dir * stepv) / stepv) * stepv, Number(a.min), Number(a.max));
      if (v === cur) return;
      this._pset[id] = { v, t: Date.now() };
      if (!this._paintStep(id, st, v)) this._render(true);
      this._busy = true;
      clearTimeout(this._stepHold);
      this._stepHold = setTimeout(() => { this._busy = false; this._render(false); }, 1500);
      clearTimeout(this._deb[id]);
      this._deb[id] = setTimeout(() => this._call(id.split('.')[0], 'set_value', { entity_id: id, value: v }), 650);
    }
    _paintStep(id, st, v) {
      const row = Array.from(this.shadowRoot.querySelectorAll('[data-row]')).find((x) => x.dataset.row === id);
      if (!row) return false;
      const def = TUNING.find(([k]) => (this._config.settings || {})[k] === id);
      const nv = this._numView(st, v, def && def[4]);
      const sv = row.querySelector('.sv'), mf = row.querySelector('.mf');
      if (sv) { sv.textContent = nv.txt; sv.classList.add('pend'); }
      if (mf) { mf.style.left = `${nv.left}%`; mf.style.width = `${nv.width}%`; }
      row.querySelectorAll('button[data-act="step"]').forEach((b) => { b.disabled = Number(b.dataset.dir) < 0 ? v <= nv.mn : v >= nv.mx; });
      this._colC._lwHtml = null;
      return true;
    }
    _css() {
      return `
:host { touch-action:manipulation; }
.card, button, .stp, .tg, .dev, .xpt { touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
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
@container (min-width: 660px) {
  .body { grid-template-columns:minmax(0,1fr) minmax(0,1fr); grid-template-areas:"a b" "c c"; align-items:stretch; }
  .colC .tune { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
  .scr { --lat-grow:1; --lat-dir:column; --lat-gap:16px; --lat-align:center; --lat-tile:132px; --lat-radius:30px; --lat-icon:60px; --lat-items:center; --lat-self:center; --lat-title:22px; --lat-meta-w:100%; --lat-meta-flex:0 0 auto; }
}
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
.fmt { margin-top:12px; }
.fmt:empty { display:none; }
.fbs { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px; transition:opacity .4s; }
.fbs.quiet { opacity:.5; }
.fq { margin-top:6px; text-align:center; font-size:11px; color:#6b7280; }
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
.kv { font-size:13px; font-weight:600; color:#cbd5e1; } .kv.wv { color:#fbbf24; }
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
.vread { margin-left:auto; display:flex; align-items:baseline; gap:4px; }
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
.src.warn { color:#fde68a; background:rgba(245,158,11,.12); border-color:rgba(245,158,11,.45); }
.src.warn ha-icon { color:#fbbf24; }
.src.sel { cursor:default; }
.mode { flex:1 1 140px; flex-direction:row; flex-wrap:wrap; row-gap:2px; padding:10px 12px; justify-content:flex-start; text-align:left; }
.mode span { font-weight:700; }
.mode .mh { flex-basis:100%; font-style:normal; font-size:11.5px; font-weight:500; color:#8b919c; padding-left:23px; }
.mode.sel .mh { color:#c4b5fd; }
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

  if (!customElements.get('linwood-tv-card')) customElements.define('linwood-tv-card', LinwoodTvCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.find((c) => c.type === 'linwood-tv-card')) window.customCards.push({ type: 'linwood-tv-card', name: 'Linwood TV Card', description: 'TV, Sonos soundbar, Apple TV and lights in one console', preview: false });
  window.LinwoodTvFormat = parseFormat;
})();
