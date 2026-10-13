// Smoke test: load every card through src/index.js in a simulated browser and check each one registers its elements.
// Catches errors that only show up when a module runs (not just syntax), before CI lets a commit deploy.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost:8123/' });

const expected = [
  'linwood-light-card', 'linwood-switch-card', 'linwood-garage-card', 'linwood-appletv-card', 'linwood-theater-card',
  'linwood-tv-card', 'linwood-climate-card', 'linwood-calendar-card', 'linwood-plant-card', 'linwood-grow-lights-card',
];

const results = await (await import('../src/index.js')).default;
// Theater and TV define themselves after the Kit; give pending promises a moment.
await Promise.race([
  Promise.all(expected.map((t) => customElements.whenDefined(t))),
  new Promise((r) => setTimeout(r, 3000)),
]);

let fail = 0;
for (const r of results) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.file}${r.error ? ` — ${r.error}` : ''}`);
  if (!r.ok) fail++;
}
for (const t of expected) {
  if (!customElements.get(t)) { console.log(`FAIL <${t}> was not defined`); fail++; }
}
// Every card must be able to take a config without throwing.
const configs = {
  'linwood-climate-card': { entity: 'climate.x' },
  'linwood-plant-card': { plants: [{ entity: 'input_datetime.x', name: 'X' }] },
  'linwood-theater-card': { receiver: 'media_player.x' },
  'linwood-tv-card': { soundbar: 'media_player.x' },
  'linwood-appletv-card': { entity: 'media_player.x' },
  'linwood-light-card': { entity: 'light.x' },
};
for (const [tag, cfg] of Object.entries(configs)) {
  try { const el = document.createElement(tag); el.setConfig(cfg); document.body.appendChild(el); }
  catch (e) { console.log(`FAIL <${tag}>.setConfig — ${e.message}`); fail++; }
}
console.log(fail ? `${fail} problem(s)` : 'all cards load');
await GlobalRegistrator.unregister();
process.exit(fail ? 1 : 0);
