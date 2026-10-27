# Buildpath

A lightweight build helper for League of Legends on Windows: imports runes and item sets in champ select, and shows a small passive overlay in game (build path, skill order, runes, tier list). Recommendations come from a local crawler over Riot's official API.

Personal project, not distributed. See [docs/prd.md](docs/prd.md) for the spec.

## Setup

1. Copy `.env.example` to `.env` and paste a Riot API key from the [Riot Developer Portal](https://developer.riotgames.com/). Only the crawler uses it.
2. Desktop app (Node 24+):

   ```
   cd desktop
   npm install
   cd ..
   npm run dev
   ```

   If `npm run dev` fails with "Electron uninstall", npm skipped Electron's download script. Run `node node_modules/electron/install.js` once from `desktop/`.

   `npm run dev:mock` runs the overlay against a simulated game, no League needed.

3. Crawler (Python 3.12, from step 5 onward): see `crawler/`.

League must run in Borderless or Windowed mode for the overlay to draw over it.

## Layout

- `desktop/`: Electron + React + TypeScript app (electron-vite).
- `crawler/`: Python crawler and aggregation.
- `data/`: local cache and generated stats. Gitignored; never committed.
- `docs/`: spec and test checklists.

Buildpath isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
