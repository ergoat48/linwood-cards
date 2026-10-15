/* Linwood cards — everything the loader brings in. Add a new card here (one line) and it ships with the next deploy.
 * Each file loads on its own, so an error in one card can't stop the others. Theater and TV wait for the Kit and the
 * Apple TV card themselves, so the order here doesn't matter. */
const FILES = [
  'linwood-kit.js',
  'linwood-appletv-card.js',
  'linwood-theater-card.js',
  'linwood-tv-card.js',
  'linwood-climate-card.js',
  'linwood-security-card.js',
  'linwood-calendar-card.js',
  'linwood-plant-card.js',
  'linwood-jump-bar.js',
  'linwood-shell.js',
];

export const files = FILES;
export default Promise.allSettled(FILES.map((f) => import(new URL(f, import.meta.url).href))).then((results) =>
  results.map((r, i) => ({ file: FILES[i], ok: r.status === 'fulfilled', error: r.status === 'rejected' ? String(r.reason) : null })),
);
