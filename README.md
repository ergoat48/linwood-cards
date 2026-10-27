# Linwood cards

Custom Lovelace cards for the Linwood Home Assistant dashboards. This repo is the source of truth for the card code.
CI bundles every card into one file and ships it as a GitHub Release; HACS installs that release on the Home Assistant
server, which serves it locally — dashboards don't touch the internet to load the cards.

## How a change reaches the dashboards

```
edit src/ → push to main → CI: syntax + secret scan + gitleaks + build + smoke test → GitHub Release v2.N.0
          → webhook → Home Assistant tells HACS to install v2.N.0 → next dashboard load
```

1. Edit a file in `src/` and bump the version line in its header comment.
2. Optional locally: `npm ci`, then `npm test` (check → build → smoke test of the bundle).
3. Push to `main` (or merge a PR). If every check passes, CI tags a build commit (your commit + `dist/linwood-cards.js`)
   as `v2.<run>.0`, publishes it as a release and calls Home Assistant's deploy webhook. If anything fails, no release is made and nothing changes at home.
4. Home Assistant installs it within a few seconds. Refresh the dashboard (on the phone, pull to refresh) to see it.

**Roll back:** GitHub → Actions → *check and deploy* → *Run workflow*, paste an older commit SHA (short is fine). That
commit is rebuilt and shipped as a new, higher version. (Or in HACS: Linwood Cards → ⋮ → Redownload → pick a version.)
**Deploy history:** the repo's Releases page — one release per deploy, titled with the commit message.
**What's loaded on this device:** `window.LinwoodCards` in the browser console (also logged on load).

### How it works

- HACS has `ergoat48/linwood-cards` as a custom *Dashboard* repository (`hacs.json`). It downloads
  `dist/linwood-cards.js` at the release tag to `/config/www/community/linwood-cards/` and registers it as the only Linwood resource, with a
  `?hacstag=` that changes on every install so browsers fetch the new version instead of a cached one.
- The HA automation **Linwood cards: deploy from GitHub** has a webhook trigger. CI posts `{"version": "v2.N.0"}`; the
  automation checks the format and runs `update.install` on HACS's Linwood Cards update entity with that version.
- The webhook URL lives only in the `HA_DEPLOY_WEBHOOK` Actions secret. Knowing it lets someone ask HA to install a
  version of *this* repo's releases — nothing else. No HA token is stored in GitHub.
- The built file is never on `main` (`dist/` is git-ignored). Each release tag points at its own one-off commit that adds
  it. (Not a release *asset*: github.com's asset redirect sends a header too large for Home Assistant's HTTP client.)
- `tools/build.mjs` minifies each card on its own and wraps it in its own scope, so an error in one card is logged and
  the others still load (the same isolation the old per-file loader had).
- Adding a card: put the file in `src/` and add one line to `src/index.js`. No change in Home Assistant.
- If the webhook can't reach HA (internet down), the release still exists; HACS shows it as an update to install.
- To replace the webhook URL: in HA run the WebSocket command `cloud/cloudhook/create` for the automation's webhook id
  (or Settings › Home Assistant Cloud › Webhooks), then paste the URL into GitHub › Settings › Secrets and variables ›
  Actions › `HA_DEPLOY_WEBHOOK`.

## What's here

| File | Version | Cards |
|---|---|---|
| `src/linwood-kit.js` | 1.3.0 | light, switch, garage cards + the shared `LinwoodKit` base the Theater and TV cards build on |
| `src/linwood-appletv-card.js` | 1.3.0 | Apple TV now-playing (also embedded as the "screen" in Theater and TV) |
| `src/linwood-theater-card.js` | 1.3.2 | basement theater: Denon receiver, projector, lamp automation, format badges |
| `src/linwood-tv-card.js` | 1.0.1 | bedroom: LG G4, Sonos soundbar, Apple TV |
| `src/linwood-climate-card.js` | 1.16.0 | dial thermostat with safe per-mode setpoint limits, Auto Home/Away / Air Mixing / Fresh Air switches, furnace alert chip + Rooms panel (temperature rail, per-room sparklines, presence, which room the thermostat targets) |
| `src/linwood-security-card.js` | 1.0.1 | motion radar, room tiles, swimlane timeline, activity feed |
| `src/linwood-weather-card.js` | 1.0.0 | live sky scene, current conditions, hourly temperature curve (sunset / sunrise / midnight marked) and weekly range bars |
| `src/linwood-calendar-card.js` | 1.1.0 | week strip + agenda |
| `src/linwood-plant-card.js` | 3.8.0 | plant care tracker + grow lights card |
| `src/linwood-jump-bar.js` | 1.0.1 | jump-to chips on the Plant Care view |
| `src/linwood-shell.js` | 1.4.1 | sidebar room navigation / styling |
| `src/index.js` | — | list of cards that go into the bundle, in order |
| `hacs.json` | — | HACS manifest (Dashboard repo, file `linwood-cards.js`) |
| `scripts/denon_signal.py` | — | feeds `sensor.theater_av_signal` (command_line sensor) for the Theater format badges |
| `tools/` | — | `check.sh` (syntax + secret scan), `build.mjs` (bundle → `dist/`), `smoke.mjs` (loads the bundle in a simulated browser) |
| `retired/` | — | Plant Art and Safe Area add-ons, now built into Plant Card 3.6.0 |

## Not in this repo (on purpose)

- **Dashboard configs.** They stay in Home Assistant's storage. They're edited in place (UI or targeted changes), and a
  copy here would go stale the first time something is tweaked in the UI.
- **Anything secret.** No tokens, passwords, `secrets.yaml`, home-network addresses or remote-access URLs — the receiver
  address for `denon_signal.py` is passed in by the sensor command (or `DENON_HOST`). `tools/check.sh` and CI fail if any
  of those show up. Entity IDs do appear in config examples; they describe devices but grant no access.
