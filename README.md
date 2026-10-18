# Linwood cards

Custom Lovelace cards for the Linwood Home Assistant dashboards. This repo is the source of truth for the card code;
Home Assistant loads it straight from here.

## How a change reaches the dashboards

```
edit src/ → push to main → CI: syntax + secret scan + gitleaks + smoke test → commit recorded in DEPLOYED → next dashboard load
```

1. Edit a file in `src/` and bump the version line in its header comment.
2. Optional locally: `npm run check` and `node tools/smoke.mjs` (after `npm ci`).
3. Push to `main` (or merge a PR). CI runs the checks; if they all pass, it records that commit in the `DEPLOYED` file
   on the `deployed` branch. If anything fails, nothing is recorded and nothing changes at home.
4. Dashboards pick it up on their next load — within about 2 minutes. On the phone, pull to refresh or reopen the app.

**Roll back:** GitHub → Actions → *check and deploy* → *Run workflow*, paste an older commit SHA (short is fine).
Leave it blank to redeploy current `main`.
**Deploy history:** the commit log of the `deployed` branch — one "Deploy abc1234 (was def5678)" commit per deploy.
**Try a branch on one device** before merging — in that browser's console:
`localStorage.setItem('linwood-cards-ref', 'my-branch')` (or a full SHA), then reload. `localStorage.removeItem('linwood-cards-ref')` to go back.
**What's loaded on this device:** `window.LinwoodCards` in the console (also logged on load).

### How it works

Home Assistant has a single Linwood resource: the loader (`loader/linwood-loader.js`, stored inline in HA). On each
dashboard load it reads `DEPLOYED` from the `deployed` branch (at most every 2 minutes per device), then imports
`src/index.js` from jsDelivr at that exact commit; `index.js` loads every card. Because files are fetched by commit
SHA, every device runs one consistent set, and jsDelivr / browsers can cache them permanently.

- No Home Assistant token or URL is stored in GitHub, and Home Assistant doesn't need to be reachable from the internet.
  The only write access CI uses is GitHub's own per-run token, used to add one commit to the `deployed` branch. That
  branch only ever moves forward, so CI never needs permission to rewrite history or touch workflows.
- If GitHub can't be reached, the loader reuses the last commit that device loaded (then the commit from when the loader
  was installed). If a commit fails to load, it falls back to the last good one.
- Cards need internet for a device's first load of a new commit; after that they're cached.
- Adding a card: put the file in `src/` and add one line to `src/index.js`. No change in Home Assistant.
- The loader itself rarely changes. If it does, update the inline resource in HA (`resources.json` has its id).

## What's here

| File | Version | Cards |
|---|---|---|
| `src/linwood-kit.js` | 1.3.0 | light, switch, garage cards + the shared `LinwoodKit` base the Theater and TV cards build on |
| `src/linwood-appletv-card.js` | 1.3.0 | Apple TV now-playing (also embedded as the "screen" in Theater and TV) |
| `src/linwood-theater-card.js` | 1.3.2 | basement theater: Denon receiver, projector, lamp automation, format badges |
| `src/linwood-tv-card.js` | 1.0.1 | bedroom: LG G4, Sonos soundbar, Apple TV |
| `src/linwood-climate-card.js` | 1.6.1 | dial thermostat + Rooms panel (temperature rail, per-room sparklines, presence, which room the thermostat targets) |
| `src/linwood-security-card.js` | 1.0.1 | motion radar, room tiles, swimlane timeline, activity feed |
| `src/linwood-calendar-card.js` | 1.1.0 | week strip + agenda |
| `src/linwood-plant-card.js` | 3.8.0 | plant care tracker + grow lights card |
| `src/linwood-jump-bar.js` | 1.0.1 | jump-to chips on the Plant Care view |
| `src/linwood-shell.js` | 1.4.0 | sidebar room navigation / styling |
| `src/index.js` | — | list of cards the loader brings in |
| `loader/linwood-loader.js` | 1.0.0 | the one resource installed in Home Assistant |
| `scripts/denon_signal.py` | — | feeds `sensor.theater_av_signal` (command_line sensor) for the Theater format badges |
| `tools/` | — | `check.sh` (syntax + secret scan), `smoke.mjs` (loads every card in a simulated browser) |
| `retired/` | — | Plant Art and Safe Area add-ons, now built into Plant Card 3.6.0 |

## Not in this repo (on purpose)

- **Dashboard configs.** They stay in Home Assistant's storage. They're edited in place (UI or targeted changes), and a
  copy here would go stale the first time something is tweaked in the UI.
- **Anything secret.** No tokens, passwords, `secrets.yaml`, home-network addresses or remote-access URLs — the receiver
  address for `denon_signal.py` is passed in by the sensor command (or `DENON_HOST`). `tools/check.sh` and CI fail if any
  of those show up. Entity IDs do appear in config examples; they describe devices but grant no access.
