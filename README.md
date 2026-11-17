# Dice Hoarder (working title: Hoard Hall)

A cozy first-person dice-sorting game: gather loose dice, sort them into 7-piece sets by material and colour, and stock the shop's shelves. No timers.

This is an **original prototype inspired by a cozy sorting game**; it uses none of that game's art, name or assets.

## Where things are
| Path | What |
|---|---|
| `index.html`, `src/` | **The game** (Vite + TypeScript + three.js + Rapier physics) |
| `public/models/shop-furniture.glb` | Islands, wall racks, counter and desk, with 402 slot markers |
| `dist/` | Built site that Cloudflare serves (rebuild with `npm run build`) |
| `blender/` | Scripts that build and bake the models (see `blender/README.md`) |
| `docs/` | Concept renders |
| `prototype/` | Copy of the original prototype |

## Status
- Layout and proportions: locked (see `CLAUDE.md`)
- Walkable shop with baked models: done
- **Next:** pick up / place dice loop, held-die HUD, slot matching, gold value, floppy-disk skills
- Not done: sound, carved rack art, dice as separate models

## Run it
```bash
npm install
npm run dev
```
Controls: click to look, WASD walk, Shift run, E / click pick up · sort · use computer, F / right-click throw, Q / wheel switch die, R reset.

`npm run build` writes `dist/`. Commit `dist/` until Cloudflare's build command is set to `npm run build`.
