# Project notes (read first)

**Goal:** a cozy first-person dice-sorting game, original work inspired by a cozy sorting game. Copy mechanics and feel, never its name, art, text or sounds. No cat.

## Locked decisions
- Scale: 1 px of the floor-plan drawing = 1 cm. Main room 17 x 8.2 m, back room 11 x 5 m, door at x=9.8 in the dividing wall.
- 5 shelf units, each a 2.0 x 1.15 m block with a 3-slot rack on each of 4 sides = 12 slots, 60 total. Slot trays sit at ~0.95 m, block top at 1.35 m.
- Layout: shelves 3, 4, 5 across the back; 1 and 2 below; counter (6 m) with return on the right; carpet, basement hatch ("coming soon"), desk with computer, plant in the back room.
- Wood: dark ebony based on `#3F2000`, matte oiled finish, baked to one atlas.

## Rules (from the Steam text; details marked ? are unconfirmed)
- A set = 7 dice (d4 d6 d8 d10 d% d12 d20) matching in material + colour.
- Pick up loose dice (E), place in matching slot; hand capacity upgraded by floppy disks; no timers.
- HUD: Held Die, Material, Color, Set Dice icons, Set Current Value (Gold ?).
- Story mode (daily required value ?) and Chill mode. Basement unlocks when all slots are done.

## Workflow
- The single-file HTML pages are prototypes. The real game moves to a proper project (bundler, three.js dependency).
- Cloudflare serves the repo; do not change root `index.html` without asking.
- Supabase only if saves/accounts are needed.
