# CLAUDE.md

Standing rules for Claude Code sessions in this repo. The full spec is [docs/prd.md](docs/prd.md); read it before starting a new build step.

## What this is

Buildpath: a personal, Windows-only League of Legends build helper: champ-select rune/item-set import plus a small, passive in-game overlay (Build, Skills, Runes, Tiers tabs). Recommendations come from a local crawler over Riot's official Web API. Personal use only: never distributed, never shared.

## Architecture

Two programs with one file between them:

- `crawler/` (Python 3.12): Riot Web API -> SQLite -> `aggregate.py` -> `data/stats-<patch>.json` (written atomically: temp file, then rename).
- `desktop/` (Electron + TypeScript + React, built with electron-vite): reads `data/stats-<patch>.json` and `data/overrides.json`, talks to the LCU and the Live Client Data API, caches Data Dragon under `data/ddragon/`.

The desktop app has no database code and never needs the Riot API key. The crawler can be rewritten without touching the UI.

## Allowed data sources (only these four)

1. League Client API (LCU): lockfile auth, websocket subscriptions. Endpoints are unofficial; verify against the live client before relying on them.
2. Live Client Data API: `https://127.0.0.1:2999/liveclientdata/`. Trust Riot's `riotgames.pem` for that host only. Never disable TLS checks globally.
3. Riot Web API: `league-v4`, `match-v5`. Rate limiter driven by `X-App-Rate-Limit`, `X-Method-Rate-Limit` and `Retry-After` headers, not hardcoded numbers.
4. Data Dragon: `ddragon.leagueoflegends.com`.

Never read game memory, inject into the game process, or modify game files.

## Prohibited (Riot policy). Never build these, even if the data makes it easy

- Enemy ability/summoner cooldown tracking, jungle timers, any timers.
- Notifications suggesting game decisions or announcing power spikes. The overlay is a passive panel: no pop-ups, sounds, flashing, toasts or animation during a game.
- Showing other players' names, ranks or stats in champ select.
- Ads of any kind.

## Deferred (not in v1; don't add without asking)

Matchup-specific builds, mid-game reactive item suggestions, macOS, non-ranked modes (ARAM, Arena, etc.), post-match analysis/profiles, distribution/installers/auto-update.

## Constraints

- Windows 11, League in Borderless or Windowed. Exclusive fullscreen can't be overlaid; say so once in the companion window, never in game.
- $0 cost. Crawler runs on this PC, idle only: it pauses while a game is in progress.
- Region: NA (`REGION=na1`, `ROUTING=americas`), ranked solo queue 420, Emerald+ by default.
- Overlay budget: under 3 fps impact, under 2% CPU while polling. Never takes keyboard or mouse focus outside edit mode.

## Secrets and data

- `RIOT_API_KEY` lives only in `.env` (gitignored). Never log it, print it, or commit it. `.env.example` is the committed template.
- `data/` and any SQLite file are gitignored. Crawled data stays on this machine (Riot data policy). The repo is public, so check `git status` before every commit.

## How to work

- Build in the order of PRD section 9. After step 4, stop and let the user play a few games before starting the crawler.
- If a step needs something outside the PRD (a notable new dependency, a new data source, a change to overlay behavior), stop and ask instead of widening scope.
- Explain each technical move in a line or two: what and why. No black boxes.
- Commit or push only when the user asks.
- The repo is public: keep personal details out of committed files. Personal working notes go in `CLAUDE.local.md` (gitignored).

## Commands

From the repo root or `desktop/` (the root `package.json` forwards to `desktop/`):

- `npm run dev`: start the app with hot reload.
- `npm run dev:mock`: same, with a simulated game feeding the overlay (no League needed).
- `npm run typecheck`: type-check main, preload and renderer.
- `npm run build`: production build into `desktop/out/`.

From the repo root: `py crawler/check_key.py` checks the Riot key.

## Gotchas

- Riot's Web API is behind Cloudflare: requests need a custom `User-Agent` (`config.USER_AGENT`), or they get a 403 "error code: 1010" that looks like a dead key.
- npm may skip Electron's binary download; fix with `node node_modules/electron/install.js` in `desktop/`.
