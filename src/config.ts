/** Layout, scaled from the floor-plan drawing (1 px = 1 cm). +z is south. Units are metres. */
export type Rect = [x0: number, x1: number, z0: number, z1: number];

export const WALL_H = 3.2;
export const MAIN_ROOM = { w: 17, d: 8.2 };
export const BACK_ROOM = { x: 11.5, z: 10.7, w: 11, d: 5 };
export const DIVIDER_Z = 8.2;
export const DOOR = { x: 9.8, w: 1.2, z: DIVIDER_Z };

/** Rounded display tables (15 slots each), placed in side-by-side pairs. 22 tables x 15 = 330 slots. */
export const TABLE = { length: 1.25, depth: 0.85, slots: 15 };
export const TABLE_PAIRS: { x: number; z: number }[] = [
  { x: 2.2, z: 1.5 }, { x: 5.9, z: 1.5 }, { x: 9.6, z: 1.5 }, { x: 13.3, z: 1.5 },   // row A
  { x: 2.2, z: 3.9 }, { x: 5.9, z: 3.9 }, { x: 9.6, z: 3.9 }, { x: 13.3, z: 3.9 },   // row B
  { x: 1.9, z: 6.4 }, { x: 5.3, z: 6.4 }, { x: 8.7, z: 6.4 },                        // row C (clear of the counter return)
];
/** Centre of every single table, in slot order. */
export const TABLES: { x: number; z: number }[] = TABLE_PAIRS.flatMap((p) => [{ x: p.x - TABLE.length / 2, z: p.z }, { x: p.x + TABLE.length / 2, z: p.z }]);

/** Wall racks in the back room: model name, position of the back-centre, rotation (front faces local +z). */
export interface WallRackSpec { model: 'WallRack11' | 'WallRack7'; x: number; z: number; ry: number }
export const WALL_RACKS: WallRackSpec[] = [
  { model: 'WallRack11', x: 6.07, z: 10.6, ry: Math.PI / 2 },  // back-room west wall, faces east
  { model: 'WallRack7', x: 8.3, z: 13.13, ry: Math.PI },        // back-room south wall, faces north
];

/** Dice are drawn at this radius (bigger than real dice, small enough that 7 fit a 0.4 x 0.2 m slot). */
export const DIE_RADIUS = 0.03;
export const TOTAL_SETS = 402;

export const COUNTER = { x: 13.9, z: 5.75 };
export const DESK = { x: 14.8, z: 12.5 };
export const CARPET = { x: 14.4, z: 10.1, w: 4.0, d: 2.6 };
export const BASEMENT = { x: 9.4, z: 10.9, size: 2.2 };

/** Areas the player cannot enter (shelves, counter, return, desk). */
export const BLOCKERS: Rect[] = [
  ...TABLE_PAIRS.map((p): Rect => [p.x - TABLE.length - 0.02, p.x + TABLE.length + 0.02, p.z - TABLE.depth / 2 - 0.02, p.z + TABLE.depth / 2 + 0.02]),
  [6.0, 6.9, 8.35, 12.85],   // west wall rack
  [6.85, 9.75, 12.3, 13.2],  // south wall rack
  [10.9, 16.9, 5.29, 6.21],
  [10.9, 11.9, 6.2, 7.6],
  [13.2, 16.4, 11.9, 13.1],
];
export const BOUNDS = { minX: 0.35, maxX: 16.65, minZ: 0.35, maxZ: 12.85 };
export const PLAYER = { eye: 1.68, radius: 0.3, walk: 2.6, run: 4.6 };
export const START = { x: 0.6, z: 2.7, lookX: 9, lookY: 0.9, lookZ: 2.9 };
