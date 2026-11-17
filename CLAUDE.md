# Project notes (read first)

**Goal:** a cozy first-person dice-sorting game, original work inspired by a cozy sorting game. Copy mechanics and feel, never its name, art, text or sounds. No cat.

## Locked decisions
- Scale: 1 px of the floor-plan drawing = 1 cm. Main room 17 x 8.2 m, back room 11 x 5 m, door at x=9.8 in the dividing wall.
- **402 unique sets, 2,814 dice, one slot per set (402 slots).** A unique set = material + base colour + ink colour. A set is the standard 7 (d4 d6 d8 d10 d% d12 d20); a few *secret* sets may break the rules and get their own display, outside the 402.
- Slots: 5 island shelves x 66 = 330, plus wall racks x 72 = 402.
  - Island (same footprint as before, ~2.8 x 2.1 m): each long side 5 stepped tiers x 5 columns (0.4 x 0.2 m slots), each short end 2 tiers x 4 columns. Tiers at 0.60 / 0.84 / 1.08 / 1.32 / 1.56 m.
  - Wall racks: 4 tiers x 18 columns (0.4 m each) on the back room's west wall (11 columns) and south wall (7 columns). Tiers at 0.72-1.44 m.
  - **Everything reachable standing** (no ladders). Slot positions are exported as `slot_###` empties in the model, with width/depth in `extras`.
- Layout: shelves 3, 4, 5 across the back; 1 and 2 below; counter (6 m) with return on the right; carpet, basement hatch ("coming soon"), desk with computer, plant in the back room.
- Wood: dark ebony based on `#3F2000`, matte oiled finish. Furniture is built from separate boards of random width; every board gets its own tone, ring scale, grain bend and occasional knots so nothing repeats. Baked to one atlas.
- Dice are drawn smaller than real life but small enough that 7 fit a 0.4 x 0.2 m slot (radius ~0.03 m). 2,814 dice need instanced rendering and numerals only near the player.

## Rules (from the Steam text; details marked ? are unconfirmed)
- A set = 7 dice (d4 d6 d8 d10 d% d12 d20) matching in material + base colour + ink colour.
- Pick up loose dice (E), place in matching slot; hand capacity upgraded by floppy disks; no timers.
- HUD: Held Die, Material, Color, Set Dice icons, Set Current Value (Gold ?).
- Story mode (daily required value ?) and Chill mode. Basement unlocks when all slots are done.

## Workflow
- The single-file HTML pages are prototypes. The real game moves to a proper project (bundler, three.js dependency).
- Cloudflare serves the repo; do not change root `index.html` without asking.
- Supabase only if saves/accounts are needed.
