# Step 2: overlay spike test

The point of this step is to find out early whether an Electron overlay can sit over Borderless League without stealing focus or costing frames. Run this before anything else gets built on top of it.

## Setup

1. League video settings: **Window Mode = Borderless**. Exclusive fullscreen can't be overlaid.
2. Start the app (from the repo root or `desktop/`):

   ```
   npm run dev
   ```

3. Start a **Practice Tool** game. The overlay should appear on the right edge, above the minimap, within ~10 seconds of the game loading.

To work on the overlay without League, run with simulated data instead: `npm run dev:mock`.

## Hotkeys

| Keys | Action |
|---|---|
| Ctrl+Shift+O | Show / hide the overlay |
| Ctrl+Shift+L | Edit mode on/off (drag to move, scroll the blue banner for opacity) |
| Ctrl+Shift+1..4 | Build / Skills / Runes / Tiers tab |

Rebind them in `data/settings.json` (created after the first move or tab change), then restart the app.

## Checks

Write pass/fail and notes next to each.

| # | Check | How | Result |
|---|---|---|---|
| 1 | Appears in game | Overlay shows champion, level and gold within ~10 s of loading in | |
| 2 | Live data updates | Buy an item, level up, put a point in an ability: Build and Skills tabs update within ~2 s | |
| 3 | Runes tab | Shows your actual keystone and trees | |
| 4 | Click-through | Right-click to move and left-click the ground *through* the panel: the champion responds | |
| 5 | No focus steal | Play 5+ minutes using abilities, shop and chat. Never alt-tabbed out, no stuck keys, chat still opens with Enter | |
| 6 | Hotkeys | All of the above work in game; none of them triggers a League action | |
| 7 | Edit mode | Ctrl+Shift+L, drag the panel somewhere else, Ctrl+Shift+L again. It stays there and is click-through again | |
| 8 | Position persists | Quit the app, restart, start Practice Tool: panel is where you left it | |
| 9 | Opacity | In edit mode, scroll on the blue banner: opacity changes and persists | |
| 10 | Hides at game end | End the Practice Tool game: overlay hides within ~6 s | |
| 11 | FPS | Same spot, camera locked, 30 s each: League FPS (Ctrl+F) with overlay shown vs hidden (Ctrl+Shift+O). Target: under 3 fps difference | |
| 12 | CPU | Terminal running `npm run dev` prints a `[cpu]` line every 30 s while the overlay is visible. Target: under 2% (Task Manager's "Electron" group should agree) | |
| 13 | Display scaling | If you use 125% or 150% scaling on any monitor: panel lands fully on screen at the expected edge | |

## If something fails

Note what you saw and when. The likeliest failure points and the fallbacks:

- **Overlay hidden behind the game**: League switched to exclusive fullscreen, or the z-order level needs re-asserting after the game takes focus.
- **Focus stealing / alt-tab**: edit mode's focusable toggle not reverting, or Windows treating `showInactive` differently. The fallback is a native always-on-top flag via a small helper.
- **FPS drop**: try disabling the overlay's transparency compositing, or polling less often. The fallback is a different windowing approach (the reason this spike exists).
