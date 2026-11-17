/** Layout, scaled from the floor-plan drawing (1 px = 1 cm). +z is south. Units are metres. */
export type Rect = [x0: number, x1: number, z0: number, z1: number];

export const WALL_H = 3.2;
export const MAIN_ROOM = { w: 17, d: 8.2 };
export const BACK_ROOM = { x: 11.5, z: 10.7, w: 11, d: 5 };
export const DIVIDER_Z = 8.2;
export const DOOR = { x: 9.8, w: 1.2, z: DIVIDER_Z };

export interface ShelfSpec { x: number; z: number; letter: string }
/** 5 shelves x 4 sides x 3 slots = 60 slots. */
export const SHELVES: ShelfSpec[] = [
  { x: 3.0, z: 2.0, letter: 'P' },   // Shelf 3
  { x: 8.6, z: 2.0, letter: 'S' },   // Shelf 4
  { x: 14.2, z: 2.0, letter: 'C' },  // Shelf 5
  { x: 3.0, z: 5.9, letter: 'M' },   // Shelf 2
  { x: 7.2, z: 5.9, letter: 'G' },   // Shelf 1
];
export const SHELF = { coreW: 2.0, coreD: 1.15, top: 1.35, trayH: 0.95, trayDepth: 0.42, tilt: 0.17 };

export const COUNTER = { x: 13.9, z: 5.75 };
export const DESK = { x: 14.8, z: 12.5 };
export const CARPET = { x: 14.4, z: 10.1, w: 4.0, d: 2.6 };
export const BASEMENT = { x: 9.4, z: 10.9, size: 2.2 };

/** Areas the player cannot enter (shelves, counter, return, desk). */
export const BLOCKERS: Rect[] = [
  ...SHELVES.map((s): Rect => [s.x - 1.42, s.x + 1.42, s.z - 1.0, s.z + 1.0]),
  [10.9, 16.9, 5.29, 6.21],
  [10.9, 11.9, 6.2, 7.6],
  [13.2, 16.4, 11.9, 13.1],
];
export const BOUNDS = { minX: 0.35, maxX: 16.65, minZ: 0.35, maxZ: 12.85 };
export const PLAYER = { eye: 1.68, radius: 0.3, walk: 2.6, run: 4.6 };
export const START = { x: 1.5, z: 3.95, lookX: 9.5, lookY: 0.95, lookZ: 3.5 };
