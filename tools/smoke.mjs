// Smoke test: load every card through src/index.js in a simulated browser and check each one registers its elements.
// Catches errors that only show up when a module runs (not just syntax), before CI lets a commit deploy.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register({ url: 'http://localhost:8123/' });

const expected = [
  'linwood-light-card', 'linwood-switch-card', 'linwood-garage-card', 'linwood-appletv-card', 'linwood-theater-card',
  'linwood-tv-card', 'linwood-climate-card', 'linwood-security-card', 'linwood-weather-card', 'linwood-calendar-card', 'linwood-plant-card', 'linwood-grow-lights-card',
];

// Test exactly what ships: the bundle from tools/build.mjs (run `npm run build` first).
const errors = [];
const origError = console.error;
console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
await import('../dist/linwood-cards.js');
// Theater and TV define themselves after the Kit; give pending promises a moment.
await Promise.race([
  Promise.all(expected.map((t) => customElements.whenDefined(t))),
  new Promise((r) => setTimeout(r, 3000)),
]);

let fail = 0;
const { files } = await import('../src/index.js');
const state = window.LinwoodCards;
if (!state) { console.log('FAIL bundle did not set window.LinwoodCards'); fail++; }
for (const f of files) {
  const ok = state?.files.includes(f);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${f}${ok ? '' : ` — ${errors.find((e) => e.includes(f)) || 'did not run'}`}`);
  if (!ok) fail++;
}
for (const t of expected) {
  if (!customElements.get(t)) { console.log(`FAIL <${t}> was not defined`); fail++; }
}
// Every card must be able to take a config without throwing.
const configs = {
  'linwood-climate-card': { entity: 'climate.x', rooms: [{ name: 'X', temperature: 'sensor.x', motion: 'binary_sensor.x' }], auto_away: { entity: 'input_boolean.x', active: 'input_boolean.y', distance: 'sensor.y' }, auto_mix: { entity: 'input_boolean.z', active: 'input_boolean.w', spread: 'sensor.z', paused: 'input_boolean.y' }, auto_air: { entity: 'input_boolean.v', co2: 'sensor.c' }, heat_alert: 'input_boolean.u' },
  'linwood-weather-card': { entity: 'weather.x' },
  'linwood-security-card': { sensors: [{ name: 'X', motion: 'binary_sensor.x', door: 'cover.x' }] },
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
