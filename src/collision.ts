import { BLOCKERS, BOUNDS, DIVIDER_Z, DOOR, BACK_ROOM } from './config';

/** True if a circle of radius `margin` at (x, z) is inside the shop and clear of furniture. */
export function walkable(x: number, z: number, margin = 0.3): boolean {
  if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return false;
  if (Math.abs(z - DIVIDER_Z) < 0.25 && Math.abs(x - DOOR.x) > DOOR.w / 2 - 0.25) return false;
  if (z > DIVIDER_Z && x < BACK_ROOM.x - BACK_ROOM.w / 2 + 0.35) return false;
  return !BLOCKERS.some(([x0, x1, z0, z1]) => x > x0 - margin && x < x1 + margin && z > z0 - margin && z < z1 + margin);
}
