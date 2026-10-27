# PRD: Buildpath

> Approved 2026-10-26. Decisions at sign-off: region NA (na1/americas); crawler runs on the gaming PC, idle only (pauses while a game is in progress); renderer is React + electron-vite; repo is public on GitHub with no secrets or crawled data committed.
> Audience: Claude Code, building from an empty repo. Written so a reader with no prior conversation context can build it.
> Personal use only. Not a product, not distributed.

---

## 1. What this is

A lightweight Windows desktop build helper for League of Legends that does three things, and nothing else:

1. In champ select, it detects the player's champion and role and auto-imports the recommended rune page and item set into the League client.
2. In game, a small transparent overlay shows **what to build, which ability to level, which runes are running, and the champion tier list**. This in-game panel is the most important feature. Treat it as the center of the product, not an add-on.
3. The recommendations come from a local crawler that pulls ranked matches from Riot's official API and computes builds, skill orders, rune pages and tiers for the current patch.

## 2. Problem

Free companion apps already do this. The problems with them:

- They're heavy apps with ads, accounts, upsells and features that go unused (player scouting, post-match grading, other games).
- There's no way to change how recommendations are computed or to pin a personal build for a champion.
- There's little control over what runs on the machine alongside the game.

## 3. Approach

Building is a deliberate choice for control and a small footprint, not because nothing else exists. Existing pieces to reuse instead of writing from scratch:

| Need | Reuse | What it doesn't cover |
|---|---|---|
| League client connection | The lockfile approach directly (small; `league-connect` on npm is unmaintained since 2024) | Nothing significant |
| Rune import reference | RuneBook (open source, Electron) as a reference implementation | Item sets, overlay, stats |
| Static game data (champions, items, runes, icons) | Data Dragon, published by Riot each patch | Aggregated stats |
| Riot Web API client | Thin wrapper written in-repo; Python with our own rate limiter | Nothing |

## 4. Success criteria

All observable. Test with the Practice Tool first (the Live Client Data API runs there), then real games.

Champ select
- Within 2 seconds of locking in a champion, the recommended rune page is active in the client and a "Buildpath: <Champion> <Role>" item set appears in the in-game shop's recommended tab. No typing, no clicks.
- If there's a manual override for that champion, the override is what gets imported.

In game
- The overlay appears within 10 seconds of the game loading, on the screen edge the user chose.
- It never takes keyboard or mouse focus during play. Zero accidental alt-tabs across 10 test games.
- One hotkey toggles it. One hotkey enters edit mode (drag to reposition, then locks back to click-through).
- The build panel checks off items already owned and highlights the next item in the path.
- The skill panel shows the 1–18 level grid and highlights the current level's recommended ability.
- Once calibrated, the ability-bar skill hint sits over the correct ability within 2 seconds of a level-up with an unspent point, and disappears within 2 seconds of spending it. Static the whole time.
- No measurable FPS drop (under 3 fps difference with overlay on versus off). Overlay process under 2% CPU while polling.

Data
- Stats exist for the current patch for every champion-role pair with at least 200 games in the sample.
- Build, skill and rune recommendations display only when the underlying sample is at least 100 games. Below that, fall back to the override file, and if there's no override, show "low sample" and the best available data.
- The tier list for each role refreshes at least daily while the crawler runs.

Compliance
- The app uses only four data sources: the League Client API (LCU), the Live Client Data API, the Riot Web API, and Data Dragon. It never reads game memory and never injects into the game process.

## 5. Scope

### In scope (v1)

Champ select (League Client API)
- Detect gameflow phase, champion, assigned role, and the lane opponent when the enemy pick is visible.
- Show a small companion window next to the client: recommended runes, summoner spells, starting items, core build, skill max order, and the tier list for the role.
- Auto-import the rune page (create or replace a page named "Buildpath"; never delete the user's other pages).
- Auto-write an item set so the build shows in the native in-game shop.
- Optional, off by default: auto-set summoner spells.

In-game overlay (Live Client Data API), four tabs, Build open by default
- Build: starting items, core items in order, boots, and two or three situational options. Owned items checked off from `activeplayer` and `playerlist` item data. Next item highlighted with its cost.
- Skills: 18-level grid, max order (for example Q > E > W), current level and next point highlighted using `activeplayerabilities` ranks.
- Runes: the page currently running (from `activeplayerrunes`) with icons, next to the recommended page so mismatches are visible.
- Tiers: tier list for the role this patch, the current champion highlighted.

Ability-bar skill hint (Live Client Data API), a second, separate overlay window
- A small marker drawn over League's own ability bar, above the recommended ability, shown only while there's an unspent skill point. Gone as soon as the point is spent.
- Static only: no animation, flashing, sound or fade. It's a passive display of the recommended skill order, not a notification.
- Click-through and non-focusable, same rules as the main panel.
- Position is calibrated by hand: in edit mode the marker strip becomes draggable and resizable so it can be lined up over Q/W/E/R once; the result persists. Re-calibrate after changing resolution or HUD scale. No reading of League's settings files (not one of the four allowed data sources).
- Toggle on/off independently of the main panel; on by default once calibrated.

Crawler and stats (Riot Web API)
- Ranked solo queue (queue 420), one region, Emerald and above by default.
- Pull match and timeline data, store in SQLite, aggregate per champion, role and patch.
- Emit one JSON file per patch that the desktop app reads.

Overrides
- `overrides.json`: pin runes, build and skill order per champion. Overrides always win over computed stats.

### Out of scope (v1)

These are cut on purpose. Several are prohibited by Riot and must never be added.

Prohibited by Riot policy (never build these):
- Tracking enemy ability or summoner spell cooldowns, jungle timers, or any timers.
- Notifications that suggest game decisions ("gank top now") or announce power spikes ("Ahri hit 6"). The overlay is a passive panel. No pop-ups, sounds, flashing or toasts during a game.
- Showing other players' names, ranks or stats in champ select.
- Reading game memory, injecting into the game, or modifying game files.
- Ads of any kind.

Deferred, not prohibited:
- Matchup-specific builds (champion versus lane opponent). Needs far more sample than one personal key can crawl. v1.5 at the earliest.
- Mid-game reactive item suggestions ("enemy built X, buy Y"). Edges toward "suggesting game decisions." Situational items in v1 are computed once at game start from the visible enemy team, then static.
- macOS. v1 is Windows only. Mac needs a different lockfile path and fullscreen overlay handling.
- ARAM, Arena, Swiftplay and other modes.
- Post-match analysis, match history, player profiles.
- Any distribution, installer signing, auto-update, or sharing.

## 6. Constraints

- Platform: Windows 11, League in Borderless or Windowed mode. The overlay can't draw over exclusive fullscreen; the app should detect this and say so once in the companion window, not in game.
- Cost ceiling: $0. Riot's API, Data Dragon, the local APIs and every library here are free. The crawler runs on the user's own machine, not a paid server.
- Riot API key: start with the development key (expires every 24 hours). Register a personal product on the Riot Developer Portal for a personal key that doesn't expire. Rate limits are per region; build the limiter from the response headers, not hardcoded numbers.
- Secrets: the API key lives in `.env`, which is in `.gitignore` from the first commit. Never log it.
- Riot data policy: no sharing or reselling the crawled data. It stays on this machine.

## 7. Architecture

Two programs with one file between them. This keeps the desktop app free of database code and lets the crawler be rewritten without touching the UI.

```
crawler/  (Python 3.12)                 desktop/  (Electron + TypeScript)
─────────────────────                   ─────────────────────────────────
Riot Web API ──► SQLite (raw matches)   LCU (champ select, imports)
             └─► aggregate.py ──► data/stats-<patch>.json ──► reads ──► companion window
                                        data/overrides.json ──────────► overlay window
                                        Live Client Data API ─────────► overlay window
                                        Data Dragon (cached) ─────────► icons, names, costs
```

Why Python for the crawler: the aggregation logic is the part most likely to be tinkered with, and Python suits it. Why Electron for the app: transparent, click-through, always-on-top windows are well supported, and established open-source reference projects (RuneBook) use it. Two languages is a real cost; the JSON file seam is what keeps it manageable.

### Repo layout

```
buildpath/
  CLAUDE.md                 # standing context for Claude Code sessions (write this first)
  README.md
  .env.example              # RIOT_API_KEY=, REGION=na1, ROUTING=americas
  data/                     # gitignored except overrides.example.json
  crawler/
    riot_client.py          # HTTP + rate limiter driven by X-App-Rate-Limit / X-Method-Rate-Limit / Retry-After
    seed.py                 # pull ranked players for target tiers
    crawl.py                # match IDs -> match + timeline -> SQLite
    aggregate.py            # SQLite -> stats-<patch>.json
    tiers.py                # tier scoring, isolated so it's easy to tune
    tests/
  desktop/
    src/main/
      lcu.ts                # lockfile discovery, auth, websocket subscriptions
      champselect.ts        # session -> champion/role/opponent; triggers imports
      imports.ts            # rune page + item set + optional summoner spells
      liveclient.ts         # polls https://127.0.0.1:2999/liveclientdata/allgamedata
      overlay.ts            # window creation, click-through, hotkeys, positioning
      ddragon.ts            # version check, download, local cache
      stats.ts              # loads stats JSON + overrides, resolves a recommendation
    src/renderer/
      companion/            # champ select window
      overlay/              # in-game panel: Build, Skills, Runes, Tiers tabs
```

### Data sources and endpoints

Verified from Riot and library documentation:
- Live Client Data API: `https://127.0.0.1:2999/liveclientdata/` with `allgamedata`, `activeplayer`, `activeplayerabilities`, `activeplayerrunes`, `playerlist`, `playeritems`, `eventdata`, `gamestats`. Self-signed certificate; trust Riot's published `riotgames.pem` for this host only. Do not disable TLS checks globally.
- Data Dragon: `https://ddragon.leagueoflegends.com/api/versions.json`, then per-version champion, item and rune JSON plus icons.

Unofficial but stable and widely used. Verify each against the live client (with an LCU explorer) before building on it:
- LCU auth: read `lockfile` in the League install folder for port and password; basic auth as `riot:<password>`.
- `/lol-gameflow/v1/gameflow-phase`, `/lol-champ-select/v1/session` (subscribe over the websocket rather than polling).
- Rune pages: `/lol-perks/v1/pages`, `/lol-perks/v1/currentpage`.
- Item sets: `/lol-item-sets/v1/item-sets/{summonerId}/sets`.
- Summoner spells: `PATCH /lol-champ-select/v1/session/my-selection`.

Riot Web API (check exact paths and routing in the portal docs):
- `league-v4` entries by queue, tier and division, plus challenger, grandmaster and master leagues, to seed players.
- `match-v5` match IDs by PUUID (filter queue 420 and start time at patch release), match detail, and match timeline. Regional routing `americas` for NA.

### Aggregation rules

Filter: queue 420, game version matching the current patch, game length over 15 minutes (drops remakes and early surrenders).

Role: use `teamPosition` from match detail.

Runes: most common full page (keystone, primary tree, secondary tree, three shards) per champion-role. Report pick rate and win rate.

Skill order: from timeline `SKILL_LEVEL_UP` events (normal level-ups only) for that participant, first 18. Derive the max order (which ability reaches rank 5 first, then second). Report the most common exact 18-level sequence and the most common max order.

Starting items: purchases before 1:30.

Core build: from `ITEM_PURCHASED`, minus `ITEM_UNDO` and `ITEM_SOLD`. Keep only completed items, meaning legendary items and tier-2 boots, identified from Data Dragon (no further build path, gold total over a threshold, or tags). Core = the first three completed items in order. Rank candidate builds two ways and let the UI toggle: most common, and highest win rate with a minimum of 100 games.

Situational items: items that appear as 4th–6th completed items, split by whether the enemy team is AP-heavy, AD-heavy or tank-heavy (classify enemy champions with Data Dragon tags). The overlay picks the bucket once at game start.

Tiers, per role:
- Shrink win rate toward 50% so small samples don't top the list: `adj_wr = (wins + 50) / (games + 100)`.
- Score = `adj_wr` plus a small pick-rate term and a small ban-rate term. Keep weights in `tiers.py` as named constants.
- Tiers by percentile within role: S top 10%, A next 20%, B next 30%, C next 25%, D the rest.
- Exclude champion-role pairs under 200 games.

### Crawl strategy

1. Seed: pull every player in Master and above plus a sample of Diamond and Emerald divisions for the region. Store PUUIDs.
2. For each PUUID, fetch ranked match IDs since the patch started. Deduplicate against SQLite.
3. Fetch match detail and timeline for each new match. Two requests per match.
4. Run `aggregate.py` on a schedule (hourly while crawling) to rewrite `stats-<patch>.json` atomically (write to temp, then rename).
5. On a new patch, start a fresh dataset. For the first day or two of a patch, fall back to the previous patch's stats with a visible "last patch" label.

Throughput sanity check, to verify once the key is live: at roughly 100 requests per 2 minutes, that's about 3,000 requests an hour, or roughly 1,000–1,500 matches an hour after seeding overhead. A week of overnight runs should cover popular champion-role pairs comfortably; niche picks will stay thin, which is what the override file is for.

## 8. Overlay behavior

The panel that gets looked at mid-game. Get this right before polishing anything else.

- Window: frameless, transparent, always on top at the screen-saver level, skipped in the taskbar, `focusable: false`, mouse events ignored (click-through) except in edit mode.
- Show only while `gameflow-phase` is `InProgress` and the Live Client Data API responds. Hide on game end.
- Poll `allgamedata` every 2 seconds. That's fast enough for items and levels.
- Hotkeys must not collide with League defaults. Proposed: `Ctrl+Shift+O` toggle, `Ctrl+Shift+L` edit mode, `Ctrl+Shift+1..4` switch tabs. Make them configurable.
- Default size about 280 × 360 px, 85% opacity, docked on the right edge above the minimap. Position and opacity persist.
- Handle Windows display scaling (125%, 150%) so the panel lands where expected.
- Highlights are static styling only. No animation, sound or flashing.
- The ability-bar skill hint is its own window with the same flags (click-through, non-focusable, screen-saver level). Edit mode covers both windows at once. Its calibrated position and size persist separately from the panel's.

## 9. Plan

Ordered so the riskiest work happens first. Hours are optimistic.

| Step | Work | Hours |
|---|---|---|
| 0 | Riot Developer Portal: sign in, grab the dev key, submit the personal product registration. Approval may take days, so do it first. | 0.5 |
| 1 | Repo scaffold, `CLAUDE.md`, `.env` handling, Data Dragon download and cache. | 2 |
| 2 | **Riskiest: overlay spike.** Transparent click-through window over League in Borderless, with hotkeys and edit mode, showing live data from `allgamedata` in the Practice Tool. Confirm no focus stealing and no FPS hit before building anything else. | 5 |
| 3 | LCU connection, champ-select detection, companion window. | 3 |
| 4 | Rune page and item set import, driven by `overrides.json` only. At this point the app is already useful without any crawler. | 3 |
| 5 | Crawler: rate limiter, seeding, match and timeline fetch into SQLite. | 6 |
| 6 | Aggregation: runes, skill order, starting items, core build, situational buckets, tiers. Unit tests on a small fixture set of real matches. | 6 |
| 7 | Wire stats into the companion and overlay. Build, Skills, Runes, Tiers tabs. Low-sample fallback. | 4 |
| 7b | Ability-bar skill hint: second overlay window, edit-mode calibration over Q/W/E/R, shown only with an unspent point. Static. Before relying on it, re-check Riot's current third-party policy on in-game skill indicators. | 3 |
| 8 | Verification: 3 Practice Tool sessions, then 10 real games against the success criteria in section 4, including the skill hint. Log failures. | 2 |
| | Total | about 34 |

Riskiest step: step 2. If the overlay steals focus, flickers, or can't sit over Borderless League cleanly, the whole in-game experience fails, and the fix may mean a different windowing approach. Find that out in the first week, not the third.

Second-riskiest: step 6, specifically item build order. Purchase events are noisy (components, undos, sells, Tear and Doran's items). Expect to iterate on the "completed item" rule.

## 10. Open questions

Resolved at sign-off: region (NA) and crawler host (the gaming PC, idle only).

Still open:
1. Rank floor for the sample. Default Emerald and above. Higher is better data but fewer games.
2. Which champions and roles to seed `overrides.json` with on day one.
3. macOS support: v2 item only if needed.
4. Should the companion window also open outside champ select as a standalone tier list browser? Cheap to add after step 7.

## 11. Notes for Claude Code

- Write `CLAUDE.md` first, summarizing sections 5 (scope and the prohibited list), 6 and 7 as standing rules.
- Build in the order of section 9. After step 4, stop and let the user play a few games before starting the crawler.
- If a step needs something outside this PRD (a new dependency of note, a new data source, a change to the overlay's behavior), stop and say so instead of widening scope.
- Never add anything on the prohibited list in section 5, even if it looks easy from the available data.
- Never commit the API key, `data/`, or the SQLite database.
- When you do something technical, say in a line or two what you did and why.

## 12. Verified versus assumed

Verified on 2026-10-21 from Riot's support site, Riot's developer portal, and library documentation:
- The Riot Web API is free at every key tier. Development keys expire every 24 hours; personal keys are for individual developers and small private groups.
- Live Client Data API location and endpoint names.
- Riot began blocking game memory access for unknown third-party apps on 2026-10-06. Official APIs are the only permitted data route.
- Riot's 2025 rules removed cooldown tracking, power-spike notifications, decision-suggesting notifications and minor rune data displays from third-party apps.

Assumed, to verify during the build:
- Exact LCU endpoint paths in section 7 (unofficial, can change between patches).
- Personal key rate limits and approval time.
- Crawl throughput numbers in section 7.
- That a static, recommendation-only marker over the ability bar is allowed (similar features exist in established apps). Verify against Riot's policy before step 7b ships.
- That Riot's 2025 rule on minor rune data doesn't cover showing your own selected rune page. The overlay shows only the player's own runes, which the game itself already shows on the scoreboard.
