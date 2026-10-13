# Linwood cards

Custom Lovelace cards for the Linwood Home Assistant dashboards. This repo is the source of truth for the card code;
Home Assistant loads it as dashboard resources.

## What's here

| File | Version | Cards |
|---|---|---|
| `src/linwood-kit.js` | 1.3.0 | light, switch, garage cards + the shared `LinwoodKit` base the Theater and TV cards build on |
| `src/linwood-appletv-card.js` | 1.3.0 | Apple TV now-playing (also embedded as the "screen" in Theater and TV) |
| `src/linwood-theater-card.js` | 1.3.2 | basement theater: Denon receiver, projector, lamp automation, format badges |
| `src/linwood-tv-card.js` | 1.0.1 | bedroom: LG G4, Sonos soundbar, Apple TV |
| `src/linwood-climate-card.js` | 1.2.0 | dial thermostat |
| `src/linwood-calendar-card.js` | 1.1.0 | week strip + agenda |
| `src/linwood-plant-card.js` | 3.6.0 | plant care tracker + grow lights card |
| `src/linwood-jump-bar.js` | 1.0.0 | jump-to chips on the Plant Care view |
| `src/linwood-shell.js` | 1.3.3 | sidebar room navigation / styling |
| `scripts/denon_signal.py` | — | feeds `sensor.theater_av_signal` (command_line sensor) for the Theater format badges |
| `retired/` | — | Plant Art and Safe Area add-ons — both now built into Plant Card 3.6.0 and stand down on their own |

`resources.json` maps each file to its Home Assistant resource id.

## Making a change

1. Edit the file in `src/` and bump the version line in its header comment.
2. `bash tools/check.sh` — syntax check plus the secret scan (must print `OK`).
3. Commit and push. CI repeats the check and runs gitleaks over the full history.
4. Deploy (below).

## Deploying to Home Assistant

The repo is public, so jsDelivr can serve any commit. Point each resource at a **commit SHA** (not a branch), which
is immutable, so phones never mix an old and a new file:

```
https://cdn.jsdelivr.net/gh/ergoat48/linwood-cards@<commit-sha>/src/linwood-plant-card.js
```

A deploy is just updating that resource's URL to the new SHA (resource ids are in `resources.json`), then a refresh
in the app. Before switching, the resources are inline code inside Home Assistant; inline resources cap at about
128 KB, which is why the deployed Plant Card is a minified build. From the CDN it can load unminified.

Trade-off: cards then load from jsDelivr, so the dashboard needs internet access to fetch them on first load (browsers
and the iOS app cache them afterwards). If that matters, the same files can be copied to `/config/www/` and loaded from
`/local/` instead.

## Not in this repo (on purpose)

- **Dashboard configs.** They stay in Home Assistant's storage. They're edited in place (UI or targeted changes), and a
  copy here would go stale the first time something is tweaked in the UI.
- **Anything secret.** No tokens, passwords, `secrets.yaml`, home-network addresses or remote-access URLs — the receiver
  address for `denon_signal.py` is passed in by the sensor command (or `DENON_HOST`). `tools/check.sh` and CI fail if any
  of those show up. Entity IDs do appear in config examples; they describe devices but grant no access.
