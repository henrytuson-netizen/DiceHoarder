# Dice Hoarder (working title: Hoard Hall)

A cozy first-person dice-sorting game: gather loose dice, sort them into 7-piece sets by material and colour, and stock the shop's shelves. No timers.

This is an **original prototype inspired by a cozy sorting game**; it uses none of that game's art, name or assets.

## Where things are
| Path | What |
|---|---|
| `index.html` | The original roll-and-score prototype (live at the site root, unchanged) |
| `shop/index.html` | **Walkable 3D shop** (three.js, one file, model embedded). WASD move, mouse look, Shift run, R reset |
| `assets/shop-furniture.glb` | Shelf, counter and desk models with one baked ebony wood atlas |
| `blender/` | Scripts that build and bake the models (see `blender/README.md`) |
| `docs/` | Concept renders |
| `prototype/` | Copy of the original prototype |

## Status
- Layout and proportions: locked (see `CLAUDE.md`)
- Walkable shop with baked models: done
- **Next:** pick up / place dice loop, held-die HUD, slot matching, gold value, floppy-disk skills
- Not done: sound, carved rack art, dice as separate models

## Run it
Open `shop/index.html` in Chrome, Edge or Firefox (needs internet for three.js from a CDN).
