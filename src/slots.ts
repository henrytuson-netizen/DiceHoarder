import * as THREE from 'three';
import type { Slot } from './furniture';
import { makeRng } from './rng';
import { SET_KINDS } from './dice';
import { restingMatrix } from './diceField';
import { DIE_RADIUS } from './config';

interface Spot { x: number; z: number; yaw: number; face: number }
const layouts = new Map<number, Spot[]>();

/** Fixed resting spots for the 7 dice of a set inside a slot (same every time). */
export function slotLayout(slot: Slot): Spot[] {
  const cached = layouts.get(slot.index);
  if (cached) return cached;
  const rng = makeRng(9001 + slot.index * 31);
  const mx = slot.width / 2 - 0.04, mz = slot.depth / 2 - 0.035;
  const spots: Spot[] = [];
  let tries = 0;
  while (spots.length < 7 && tries++ < 3000) {
    const x = (rng() * 2 - 1) * mx, z = (rng() * 2 - 1) * mz;
    if (spots.every((s) => Math.hypot(s.x - x, s.z - z) > 0.062)) spots.push({ x, z, yaw: rng() * 6.283, face: Math.floor(rng() * 20) });
  }
  while (spots.length < 7) spots.push({ x: (rng() * 2 - 1) * mx, z: (rng() * 2 - 1) * mz, yaw: rng() * 6.283, face: 0 });
  layouts.set(slot.index, spots);
  return spots;
}

export function slotDieMatrix(slot: Slot, kindIndex: number): THREE.Matrix4 {
  const p = slotLayout(slot)[kindIndex];
  return restingMatrix(SET_KINDS[kindIndex], DIE_RADIUS, p.x, 0, p.z, p.yaw, p.face, slot.matrix);
}
