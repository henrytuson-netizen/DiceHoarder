# Dice Hoarder - Godot 4.7 version

Open this folder in **Godot 4.7.2** (Forward+ renderer, Jolt physics).

Current milestone: walkable shop with real window openings, sun + sky, volumetric light,
bounced light (SDFGI), the 22 display tables + wall racks (402 slot markers) and all
2,814 dice as physics bodies with printed numerals.

Controls: click to capture the mouse, WASD walk, Shift run, Esc release mouse.

Next: pick up / sort / throw, shop computer, saves, sounds, baked wood, plants.

Headless screenshot (used for testing):
```bash
godot --path . --audio-driver Dummy --resolution 1600x900 -- --shot=$PWD/shots/eye.png --frames=30
```
