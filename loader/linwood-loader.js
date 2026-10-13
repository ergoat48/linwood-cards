/* Linwood Loader v1.0.0 — the only Linwood resource in Home Assistant (Settings › Dashboards › Resources, inline).
 * Loads the Linwood cards from github.com/ergoat48/linwood-cards at the commit the `deployed` branch points to.
 * CI moves `deployed` only after a push to main passes its checks, so a broken commit never reaches the dashboard.
 * The commit is fetched by its SHA from jsDelivr, so every device gets one consistent set of files.
 *
 * Resolving the commit: asks GitHub at most every 2 minutes per device; if GitHub can't be reached it reuses the last
 * commit this device loaded, and failing that the commit below (from when the loader was installed).
 * Try a branch on one device first:  localStorage.setItem('linwood-cards-ref', 'my-branch')   (or a full commit SHA)
 * Back to normal:                    localStorage.removeItem('linwood-cards-ref')
 * Which commit is loaded:            window.LinwoodCards   (also logged to the browser console)
 */
(async () => {
  if (window.LinwoodCards) return;
  const REPO = 'ergoat48/linwood-cards', BRANCH = 'deployed';
  const FALLBACK = '7bbb2c6ebad5b8e0a0ed4bbcd91f960288429f76';
  const TTL = 120000, SHA = /^[0-9a-f]{40}$/;
  const state = (window.LinwoodCards = { repo: REPO, sha: null, via: null, ref: null, files: null, error: null });
  const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const read = (k) => { try { return JSON.parse(get(k) || 'null'); } catch (e) { return null; } };

  const ref = (get('linwood-cards-ref') || '').trim() || BRANCH;
  const resolve = async () => {
    if (SHA.test(ref)) return [ref, 'pinned on this device'];
    const c = read('linwood-cards-resolved');
    if (c && c.ref === ref && SHA.test(c.sha) && Date.now() - c.t < TTL) return [c.sha, 'cached'];
    try {
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 3000);
      const r = await fetch(`https://api.github.com/repos/${REPO}/commits/${encodeURIComponent(ref)}`, {
        headers: { Accept: 'application/vnd.github.sha' }, cache: 'no-store', signal: ctl.signal,
      });
      clearTimeout(tm);
      const sha = r.ok ? (await r.text()).trim() : '';
      if (SHA.test(sha)) { put('linwood-cards-resolved', JSON.stringify({ ref, sha, t: Date.now() })); return [sha, 'github']; }
    } catch (e) { /* offline, rate-limited or slow — fall through */ }
    if (c && c.ref === ref && SHA.test(c.sha)) return [c.sha, 'cached (GitHub unreachable)'];
    const good = get('linwood-cards-good');
    return SHA.test(good || '') ? [good, 'last good (GitHub unreachable)'] : [FALLBACK, 'install fallback'];
  };
  const load = async (sha) => (await import(`https://cdn.jsdelivr.net/gh/${REPO}@${sha}/src/index.js`)).default;

  let [sha, via] = await resolve();
  let files;
  try { files = await load(sha); } catch (e) {
    const good = get('linwood-cards-good');
    state.error = String(e);
    if (!SHA.test(good || '') || good === sha) { console.error('[Linwood] could not load cards', e); return; }
    [sha, via] = [good, `last good (${sha.slice(0, 7)} failed to load)`];
    try { files = await load(sha); } catch (e2) { console.error('[Linwood] could not load cards', e, e2); return; }
  }
  if (files.every((f) => f.ok)) put('linwood-cards-good', sha);
  Object.assign(state, { sha, via, ref, files });
  const bad = files.filter((f) => !f.ok);
  console.info(`%c Linwood cards %c ${sha.slice(0, 7)} · ${via}${bad.length ? ` · ${bad.length} failed` : ''} `,
    'background:#a78bfa;color:#140f24;font-weight:700;border-radius:3px 0 0 3px', 'background:#1f2937;color:#e5e7eb;border-radius:0 3px 3px 0');
  bad.forEach((f) => console.error(`[Linwood] ${f.file}: ${f.error}`));
})();
