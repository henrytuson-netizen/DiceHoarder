import * as THREE from 'three';
import { TABLES, TABLE_PAIRS, WALL_RACKS, WALL_H, DOOR, DIVIDER_Z, COUNTER, DESK, CARPET, BASEMENT, DIE_RADIUS } from './config';
import { Furniture, collectSlots, type Slot } from './furniture';
import { floorTexture, woodTexture, carpetTexture, basementTexture } from './textures';
import { SET_KINDS } from './dice';
import { restingMatrix, type Die } from './diceField';
import type { DiceSet, MaterialKind } from './sets';
import { walkable } from './collision';
import type { Rng } from './rng';

export interface ShopOptions { cutaway: boolean; presorted: number }
export interface Shop { slots: Slot[]; slotOfSet: number[]; dice: Die[]; presorted: Set<number>; computer: THREE.Object3D }

const ISLAND_MATERIAL: MaterialKind[] = ['plastic', 'solidResin', 'clearResin', 'metal', 'gemstone'];

export function buildShop(scene: THREE.Scene, furniture: Furniture, sets: DiceSet[], rng: Rng, opts: ShopOptions): Shop {
  const mat = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
  const woodTex = woodTexture(rng);
  const trim = mat({ map: woodTex, color: '#c98a4e', roughness: 0.6 });
  const trimDark = mat({ map: woodTex, color: '#9a6434', roughness: 0.65 });

  function box(w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, parent: THREE.Object3D = scene): THREE.Mesh {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b;
  }
  const floorMat = (w: number, d: number) => mat({ map: floorTexture(rng, w, d), roughness: 0.5 });
  // Plaster walls: Blue Plaster Wall (Poly Haven, CC0) - colour, bump and roughness/AO.
  const plasterLoader = new THREE.TextureLoader();
  const plaster = (file: string, srgb: boolean) => {
    const t = plasterLoader.load(`${import.meta.env.BASE_URL}textures/${file}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const plasterColour = plaster('plaster_colour.jpg', true);
  const plasterNormal = plaster('plaster_normal.jpg', false);
  const plasterARM = plaster('plaster_arm.jpg', false);
  // Tiles about every 2 m, so walls don't look stretched.
  const wallMat = (w: number, h: number) => {
    const m = mat({ map: plasterColour.clone(), normalMap: plasterNormal.clone(), roughnessMap: plasterARM.clone(), roughness: 1, aoMap: plasterARM.clone(), normalScale: new THREE.Vector2(0.6, 0.6) });
    for (const t of [m.map, m.normalMap, m.roughnessMap, m.aoMap] as THREE.Texture[]) if (t) t.repeat.set(w / 2, h / 2);
    return m;
  };

  // ---- floors
  box(17, 0.1, 8.2, floorMat(17, 8.2), 8.5, -0.05, 4.1);
  box(11, 0.1, 5, floorMat(11, 5), 11.5, -0.05, 10.7);

  // ---- walls (low in cutaway view)
  const wall = (w: number, d: number, x: number, z: number, h = WALL_H) => {
    box(w, h, d, wallMat(Math.max(w, d), h), x, h / 2, z);
    const wh = Math.min(1.0, h);
    box(w > d ? w : 0.14, wh, w > d ? 0.14 : d, trimDark, x, wh / 2, z);
  };
  const WL = opts.cutaway ? 1.2 : WALL_H;
  wall(17, 0.12, 8.5, 0); wall(0.12, 8.2, 0, 4.1); wall(0.12, 13.2, 17, 6.6); wall(0.12, 5, 6, 10.7);
  wall(6, 0.12, 3, DIVIDER_Z, WL);
  wall(DOOR.x - DOOR.w / 2 - 6, 0.12, (6 + DOOR.x - DOOR.w / 2) / 2, DIVIDER_Z, WL);
  wall(17 - (DOOR.x + DOOR.w / 2), 0.12, (17 + DOOR.x + DOOR.w / 2) / 2, DIVIDER_Z, WL);
  if (!opts.cutaway) { wall(11, 0.12, 11.5, 13.2); box(DOOR.w, WALL_H - 2.1, 0.12, wallMat(2, 1), DOOR.x, 2.1 + (WALL_H - 2.1) / 2, DIVIDER_Z); }

  // ---- door frame + open door
  [-1, 1].forEach((sx) => box(0.1, 2.1, 0.2, trim, DOOR.x + (sx * DOOR.w) / 2, 1.05, DIVIDER_Z));
  if (!opts.cutaway) box(DOOR.w + 0.2, 0.1, 0.2, trim, DOOR.x, 2.15, DIVIDER_Z);
  {
    const leaf = new THREE.Group(); leaf.position.set(DOOR.x - DOOR.w / 2 + 0.05, 0, DIVIDER_Z); leaf.rotation.y = -1.0; scene.add(leaf);
    box(DOOR.w - 0.1, 2.05, 0.06, trim, (DOOR.w - 0.1) / 2, 1.025, 0, leaf);
    [0.45, 1.55].forEach((y) => box(0.72, 0.7, 0.02, trimDark, (DOOR.w - 0.1) / 2, y, 0.04, leaf));
    box(0.07, 0.07, 0.1, mat({ color: '#caa24a', metalness: 0.9, roughness: 0.3 }), DOOR.w - 0.2, 1.0, 0.05, leaf);
  }

  // ---- windows
  const glowMat = new THREE.MeshBasicMaterial({ color: '#fff1cc', fog: false, toneMapped: false });
  const win = (x: number, z: number, ry: number) => {
    const g = new THREE.Group();
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.6), glowMat); glow.position.z = 0.01; glow.userData.noCollide = true; g.add(glow);
    ([[1.4, 0.08, 0, 0.8], [1.4, 0.08, 0, -0.8], [0.08, 1.68, 0.7, 0], [0.08, 1.68, -0.7, 0], [0.05, 1.6, 0, 0], [1.3, 0.05, 0, 0]] as const)
      .forEach(([w, h, px, py]) => box(w, h, 0.1, trim, px, py, 0.05, g));
    g.position.set(x, 1.9, z); g.rotation.y = ry; scene.add(g);
  };
  [2.6, 7.0, 11.0, 15.0].forEach((x) => win(x, 0.08, 0));
  win(16.92, 2.6, -Math.PI / 2); win(16.92, 10.5, -Math.PI / 2); win(0.08, 4, Math.PI / 2);

  // ---- ceiling + beams
  if (!opts.cutaway) {
    const ceil = mat({ color: '#6e4426', roughness: 0.85 });
    box(17, 0.1, 8.2, ceil, 8.5, WALL_H, 4.1); box(11, 0.1, 5, ceil, 11.5, WALL_H, 10.7);
    for (let x = 1.5; x < 17; x += 2.8) box(0.22, 0.28, 8.2, trim, x, WALL_H - 0.2, 4.1);
    for (let x = 7; x < 17; x += 2.8) box(0.22, 0.28, 5, trim, x, WALL_H - 0.2, 10.7);
  }

  // ---- islands, wall racks, slots
  const slots: Slot[] = [];
  TABLES.forEach((t) => {
    const tb = furniture.clone('Table'); tb.position.set(t.x, 0, t.z); scene.add(tb);
    slots.push(...collectSlots(tb, slots.length));
  });
  const islandSlotCount = slots.length;
  WALL_RACKS.forEach((w) => {
    const r = furniture.clone(w.model); r.position.set(w.x, 0, w.z); r.rotation.y = w.ry; scene.add(r);
    slots.push(...collectSlots(r, slots.length));
  });

  // ---- counter, desk and back room
  { const c = furniture.clone('Counter'); c.position.set(COUNTER.x, 0, COUNTER.z); scene.add(c); }
  box(0.5, 0.3, 0.4, mat({ color: '#2c2c30', roughness: 0.4 }), 16.0, 1.26, 5.7);
  { const d = furniture.clone('Desk'); d.position.set(DESK.x, 0, DESK.z); scene.add(d); }
  {
    const mon = new THREE.Group(); mon.name = 'computer'; mon.position.set(DESK.x + 0.9, 0.96, DESK.z); scene.add(mon);
    box(0.6, 0.4, 0.04, mat({ color: '#1c1c20' }), 0, 0.38, 0, mon);
    box(0.54, 0.34, 0.01, new THREE.MeshBasicMaterial({ color: '#7fd0e8' }), 0, 0.38, 0.025, mon);
    box(0.08, 0.2, 0.08, mat({ color: '#1c1c20' }), 0, 0.1, 0, mon);
    box(0.35, 0.02, 0.14, mat({ color: '#2a2a30' }), 0, 0.01, 0.35, mon);
  }
  box(CARPET.w, 0.03, CARPET.d, mat({ map: carpetTexture(), roughness: 0.95 }), CARPET.x, 0.015, CARPET.z);
  box(BASEMENT.size, 0.06, BASEMENT.size, mat({ map: basementTexture(), roughness: 0.7 }), BASEMENT.x, 0.03, BASEMENT.z);
  box(BASEMENT.size + 0.14, 0.04, BASEMENT.size + 0.14, trimDark, BASEMENT.x, 0.02, BASEMENT.z);
  // ---- lights
  scene.add(new THREE.HemisphereLight('#ffc98a', '#4a2a14', opts.cutaway ? 0.95 : 0.8));
  const pendant = (x: number, z: number, intensity: number) => {
    const l = new THREE.PointLight('#ffb560', intensity, 9, 1.6); l.position.set(x, 2.55, z); scene.add(l);
    if (opts.cutaway) return;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 24, 1, true), mat({ color: '#f0b45a', side: THREE.DoubleSide, emissive: '#c07a20', emissiveIntensity: 0.8 }));
    shade.position.set(x, 2.7, z); shade.userData.noCollide = true; scene.add(shade);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5), mat({ color: '#111' })); cord.position.set(x, 3.0, z); cord.userData.noCollide = true; scene.add(cord);
  };
  [[4.05, 1.5], [11.45, 1.5], [4.05, 3.9], [11.45, 3.9], [3.6, 6.4], [8.7, 6.4]].forEach(([x, z]) => pendant(x, z, opts.cutaway ? 18 : 14));
  void TABLE_PAIRS;
  pendant(14.4, 10.8, 16); pendant(8.4, 10.8, 14); pendant(COUNTER.x, 5.0, 10);
  const sun = new THREE.DirectionalLight('#ffe0b0', opts.cutaway ? 2.2 : 0.8);
  sun.position.set(opts.cutaway ? 3 : -4, opts.cutaway ? 14 : 6, opts.cutaway ? 14 : 8); sun.target.position.set(8.5, 0, 6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 14, bottom: -14, near: 1, far: 50 });
  scene.add(sun, sun.target);
  { const spill = new THREE.PointLight('#ffd7a0', opts.cutaway ? 0 : 12, 7, 1.6); spill.position.set(DOOR.x, 1.6, 9.6); scene.add(spill); }
  scene.fog = new THREE.FogExp2('#2a170a', opts.cutaway ? 0.004 : 0.018);

  // ---- assign every set a slot: island k holds material k; wall racks hold Special + one overflow per material
  const slotOfSet = new Array<number>(sets.length).fill(-1);
  const wallFree = Array.from({ length: slots.length - islandSlotCount }, (_, i) => islandSlotCount + i);
  ISLAND_MATERIAL.forEach((material, k) => {
    const group = sets.filter((s) => s.material === material);
    group.forEach((s, i) => { slotOfSet[s.id] = i < 66 ? k * 66 + i : (wallFree.shift() ?? -1); });
  });
  sets.filter((s) => s.material === 'special').forEach((s) => { slotOfSet[s.id] = wallFree.shift() ?? -1; });
  if (slotOfSet.some((v) => v < 0)) throw new Error('Not every set has a slot');

  // ---- dice: every die gets a resting spot on the floor (single layer, no overlaps, some dense patches)
  const presorted = new Set<number>();
  while (presorted.size < Math.min(opts.presorted, sets.length)) presorted.add(Math.floor(rng() * sets.length));
  const piles: [number, number, number][] = [];
  while (piles.length < 14) { const x = 0.8 + rng() * 15.4, z = 0.8 + rng() * 11.6; if (walkable(x, z, 0.8)) piles.push([x, z, 0.6 + rng() * 0.6]); }
  const CELL = 0.08, MIN = 0.072, grid = new Map<string, [number, number][]>();
  const key = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  const clear = (x: number, z: number) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [a, b] of grid.get(`${cx + i},${cz + j}`) ?? []) if (Math.hypot(a - x, b - z) < MIN) return false;
    return true;
  };
  const dice: Die[] = [];
  for (const s of sets) {
    SET_KINDS.forEach((kind, kindIndex) => {
      let x = 0, z = 0;
      for (let t = 0; t < 80; t++) {
        if (rng() < 0.6) {
          const [px, pz, pr] = piles[Math.floor(rng() * piles.length)];
          const a = rng() * 6.283, d = Math.sqrt(rng()) * pr;
          x = px + Math.cos(a) * d; z = pz + Math.sin(a) * d;
        } else { x = 0.5 + rng() * 16; z = 0.5 + rng() * 12.3; }
        if (walkable(x, z, 0.05) && clear(x, z)) break;
      }
      const k = key(x, z); const cellList = grid.get(k) ?? []; cellList.push([x, z]); grid.set(k, cellList);
      dice.push({ id: dice.length, setId: s.id, kind, kindIndex, where: 'floor', floor: restingMatrix(kind, DIE_RADIUS, x, 0, z, rng() * 6.28, Math.floor(rng() * 20)) });
    });
  }
  const computer = scene.getObjectByName('computer');
  if (!computer) throw new Error('computer missing');
  return { slots, slotOfSet, dice, presorted, computer };
}
