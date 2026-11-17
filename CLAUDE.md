# Project notes (read first)

**Goal:** a cozy first-person dice-sorting game, original work inspired by a cozy sorting game. Copy mechanics and feel, never its name, art, text or sounds. No cat.

## Locked decisions
- Scale: 1 px of the floor-plan drawing = 1 cm. Main room 17 x 8.2 m, back room 11 x 5 m, door at x=9.8 in the dividing wall.
- **402 unique sets, 2,814 dice, one slot per set (402 slots).** A unique set = material + base colour + ink colour. A set is the standard 7 (d4 d6 d8 d10 d% d12 d20); a few *secret* sets may break the rules and get their own display, outside the 402.
- Slots: 22 rounded display tables x 15 = 330, plus wall racks x 72 = 402.
  - Table: 1.25 x 0.85 m, arched top (0.80 m at the ends, 0.93 m in the middle), 5 x 3 slot grid, legs with arched skirts. Placed in 11 side-by-side pairs: rows at z 1.5 / 3.9 / 6.4 (see `TABLE_PAIRS` in `src/config.ts`).
  - Wall racks: 4 tiers x 18 columns (0.4 m each) on the back room's west wall (11 columns) and south wall (7 columns). Tiers at 0.72-1.44 m.
  - **Everything reachable standing** (no ladders). Slot positions are exported as `slot_###` empties in the model, with width/depth in `extras`.
- Layout: shelves 3, 4, 5 across the back; 1 and 2 below; counter (6 m) with return on the right; carpet, basement hatch ("coming soon"), desk with computer, plant in the back room.
- Wood: **warm honey** based on `#B06A2C` (user choice, replaces the earlier ebony), matte oiled finish. Furniture is built from separate boards of random width; every board gets its own tone, ring scale, grain bend and occasional knots so nothing repeats. Baked to one atlas.
- Dice are drawn smaller than real life but small enough that 7 fit a 0.4 x 0.2 m slot (radius ~0.03 m). 2,814 dice need instanced rendering and numerals only near the player.

## Rules (from the Steam text; details marked ? are unconfirmed)
- A set = 7 dice (d4 d6 d8 d10 d% d12 d20) matching in material + base colour + ink colour.
- Pick up loose dice (E), place in matching slot; hand capacity upgraded by floppy disks; no timers.
- HUD: Held Die, Material, Color, Set Dice icons, Set Current Value (Gold ?).
- Story mode (daily required value ?) and Chill mode. Basement unlocks when all slots are done.

## Target look (for later)
Warm, saturated cozy shop: teal-grey plaster walls, wooden posts and beams, tall bright windows with green curtains, ivy and hanging plants, lamps and candles, low rounded display tables with arched slot grids in clusters, heaps and drifts of dice. Decided: warm honey wood and rounded arched tables. Match this look as closely as possible with our own models and art (never their assets).

## Next update (to-do)
- Remove the potted plants (the Poly Haven houseplants and the succulents on the counter/desk): the user says they don't match the style. Keep the ivy, trailing vines and hanging planters. Also drop their `POTS` blockers in `src/config.ts` and `public/models/plants.glb`.

## Platform
- **The web version (Vite + three.js) is the main game.** A Godot 4.7 port exists in `godot/` (walkable shop, baked furniture, physics dice, standalone Linux export on the `builds` branch) but is **paused**: it was too laggy on the user's Chromebook (Intel i5-1235U, ChromeOS Linux). Revisit when there is a stronger test machine.

## Workflow
- The single-file HTML pages are prototypes. The real game moves to a proper project (bundler, three.js dependency).
- The game is live at the site root. Cloudflare deploys `dist/` via `wrangler.jsonc`. Until Cloudflare's build command is set to `npm run build`, run `npm run build` and commit `dist/` with every change that should go live.
- Work on a branch, then **always go live**: once a change is built and tested, merge it to `main` and push (the user's standing instruction).
- Supabase only if saves/accounts are needed.
