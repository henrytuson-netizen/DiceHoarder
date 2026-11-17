import * as THREE from 'three';
import { DiceField, diceMaterial, type Die } from './diceField';
import type { Physics } from './physics';
import { MATERIAL_LABEL, type DiceSet } from './sets';
import type { Slot } from './furniture';
import { slotDieMatrix } from './slots';
import { getShape, DIE_SIZE } from './dice';
import { renderHud, prompt, toast, type IconState } from './hud';
import { clack, chime } from './audio';
import { DIE_RADIUS } from './config';
import { ShopComputer } from './computer';

const HAND_MAX = 7;
const REACH = 2.8;
const SAVE_KEY = 'dicehoarder.save.v1';
const FULL = 127;

export interface GameDeps {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; dom: HTMLElement;
  field: DiceField; physics: Physics; dice: Die[]; sets: DiceSet[];
  slots: Slot[]; slotOfSet: number[]; computer: THREE.Object3D; presorted: Set<number>;
}

/** Core loop: pick up dice (one set, up to 7), sort them into their slot, throw the rest. */
export class Game {
  readonly hand: number[] = [];
  sel = 0;
  readonly mask: Uint8Array;
  hoverDie?: number;
  hoverSlot?: number;
  hoverComputer = false;
  readonly pc: ShopComputer;
  private readonly ray = new THREE.Raycaster();
  private readonly outline: THREE.Mesh;
  private readonly slotGlow: THREE.Mesh;
  private readonly slotTargets: THREE.InstancedMesh;
  private readonly held: THREE.Mesh;
  private readonly heldMats = new Map<number, THREE.Material>();
  private readonly tmp = new THREE.Matrix4();

  constructor(private readonly d: GameDeps) {
    this.mask = new Uint8Array(d.sets.length);
    this.pc = new ShopComputer(d.sets, d.slotOfSet, () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } location.reload(); });

    // invisible boxes over every slot, for aiming
    const tgtMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    this.slotTargets = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), tgtMat, d.slots.length);
    d.slots.forEach((s, i) => this.slotTargets.setMatrixAt(i, s.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.05, 0)).multiply(new THREE.Matrix4().makeScale(s.width, 0.12, s.depth))));
    this.slotTargets.computeBoundingSphere();
    d.scene.add(this.slotTargets);

    this.outline = new THREE.Mesh(getShape(4).geometry, new THREE.MeshBasicMaterial({ color: '#2e9bff', side: THREE.BackSide }));
    this.outline.matrixAutoUpdate = false; this.outline.visible = false; d.scene.add(this.outline);

    this.slotGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#8ee033', transparent: true, opacity: 0.55, depthWrite: false }));
    this.slotGlow.matrixAutoUpdate = false; this.slotGlow.visible = false; d.scene.add(this.slotGlow);

    this.held = new THREE.Mesh(getShape(4).geometry); this.held.visible = false;
    this.held.position.set(0.22, -0.19, -0.48); d.camera.add(this.held); d.scene.add(d.camera);

    // restore progress (or the demo pre-sorted sets on a first visit)
    const saved = Game.load(d.sets.length);
    if (saved) saved.forEach((m, setId) => { for (let k = 0; k < 7; k++) if (m & (1 << k)) this.toSlot(setId * 7 + k); });
    else for (const setId of d.presorted) for (let k = 0; k < 7; k++) this.toSlot(setId * 7 + k);
    for (const die of d.dice) if (die.where === 'floor') d.physics.addDie(die.id, die.kind, die.floor);
    d.field.flush();

    addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') this.interact();
      else if (e.code === 'Escape' && this.pc.isOpen) this.pc.close();
      else if (this.pc.isOpen) return;
      else if (e.code === 'KeyF') this.throwHeld();
      else if (e.code === 'KeyQ') this.cycle(1);
    });
    addEventListener('mousedown', (e) => {
      if (!document.pointerLockElement || this.pc.isOpen) return;
      if (e.button === 0) this.interact(); else if (e.button === 2) this.throwHeld();
    });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => { if (!this.pc.isOpen) this.cycle(e.deltaY > 0 ? 1 : -1); });
    this.refreshHud();
  }

  get paused(): boolean { return this.pc.isOpen; }
  get sortedSets(): number { let n = 0; for (const m of this.mask) if (m === FULL) n++; return n; }

  // ---------------- actions ----------------
  interact(): void {
    const d = this.d;
    if (this.pc.isOpen) { this.pc.close(); return; }
    if (this.hoverComputer) { this.pc.open(this.mask); return; }
    if (this.hoverSlot !== undefined && this.hand.length) {
      const setId = d.dice[this.hand[0]].setId;
      if (d.slotOfSet[setId] !== this.hoverSlot) { toast(`That slot is for ${this.setName(this.hoverSlot)}`); return; }
      const n = this.hand.length;
      for (const id of this.hand) this.toSlot(id);
      this.hand.length = 0; this.sel = 0;
      d.field.flush(); clack(0.7, 0.9);
      if (this.mask[setId] === FULL) { chime(); toast(`Set complete: ${d.sets[setId].name} (${this.sortedSets} / ${d.sets.length})`); }
      else toast(`Sorted ${n} ${n === 1 ? 'die' : 'dice'} · ${this.count(this.mask[setId])} / 7 in this slot`);
      this.save(); this.refreshHud(); return;
    }
    if (this.hoverDie !== undefined) {
      const die = d.dice[this.hoverDie];
      if (die.where !== 'floor') return;
      const why = this.cannotPick(die);
      if (why) { toast(why); return; }
      d.physics.removeDie(die.id); d.field.hide(die.id); d.field.flush();
      die.where = 'hand'; this.hand.push(die.id); this.sel = this.hand.length - 1;
      clack(0.5, 1.25); this.hoverDie = undefined; this.refreshHud();
    }
  }

  throwHeld(): void {
    if (!this.hand.length) return;
    const d = this.d, id = this.hand.splice(this.sel, 1)[0];
    this.sel = Math.max(0, Math.min(this.sel, this.hand.length - 1));
    const die = d.dice[id];
    const cam = d.camera, fwd = new THREE.Vector3(), right = new THREE.Vector3();
    cam.getWorldDirection(fwd); right.crossVectors(fwd, cam.up).normalize();
    const start = cam.position.clone().addScaledVector(fwd, 0.45).addScaledVector(right, 0.12).add(new THREE.Vector3(0, -0.12, 0));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    const s = DIE_RADIUS * DIE_SIZE[die.kind];
    const m = new THREE.Matrix4().compose(start, q, new THREE.Vector3(s, s, s));
    const vel = fwd.clone().multiplyScalar(5.5).add(new THREE.Vector3(0, 1.4, 0));
    const spin = new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
    die.where = 'floor';
    d.physics.addDie(id, die.kind, m, vel, spin);
    d.field.setMatrix(id, m); d.field.flush();
    clack(0.3, 1.5); this.refreshHud();
  }

  cycle(dir: number): void {
    if (this.hand.length < 2) return;
    this.sel = (this.sel + dir + this.hand.length) % this.hand.length; this.refreshHud();
  }

  // ---------------- per frame ----------------
  update(dt: number): void {
    const d = this.d;
    const force = d.physics.step(dt, (id, m) => {
      const s = DIE_RADIUS * DIE_SIZE[d.dice[id].kind];
      d.field.setMatrix(id, this.tmp.copy(m).scale(new THREE.Vector3(s, s, s)));
    });
    if (force > 2) clack(Math.min(0.8, force / 40), 1);
    d.field.flush();
    if (this.pc.isOpen) { prompt(''); this.outline.visible = this.slotGlow.visible = false; return; }
    this.aim();
    if (this.held.visible) { this.held.rotation.y += dt * 0.8; this.held.rotation.x += dt * 0.3; }
  }

  private aim(): void {
    const d = this.d;
    this.ray.setFromCamera(new THREE.Vector2(0, 0), d.camera); this.ray.far = REACH;
    const hits = this.ray.intersectObjects([...d.field.meshes, this.slotTargets, d.computer], true);
    this.hoverDie = this.hoverSlot = undefined; this.hoverComputer = false;
    for (const h of hits) {
      if (h.object === this.slotTargets) { this.hoverSlot = h.instanceId; break; }
      const id = d.field.dieAt(h.object, h.instanceId);
      if (id !== undefined) {
        const die = d.dice[id];
        if (die.where === 'floor') this.hoverDie = id; else if (die.where === 'slot') this.hoverSlot = d.slotOfSet[die.setId];
        break;
      }
      if (isUnder(h.object, d.computer)) { this.hoverComputer = true; break; }
      if (h.object instanceof THREE.Mesh && h.object.visible) break;
    }
    // outline the die under the crosshair
    if (this.hoverDie !== undefined) {
      const die = d.dice[this.hoverDie];
      this.outline.geometry = getShape(die.kind).geometry;
      this.outline.matrix.copy(d.field.getMatrix(die.id)).scale(new THREE.Vector3(1.16, 1.16, 1.16));
      this.outline.visible = true;
    } else this.outline.visible = false;
    // glow the slot under the crosshair while holding dice
    if (this.hoverSlot !== undefined && this.hand.length) {
      const s = d.slots[this.hoverSlot];
      const ok = d.slotOfSet[d.dice[this.hand[0]].setId] === this.hoverSlot;
      (this.slotGlow.material as THREE.MeshBasicMaterial).color.set(ok ? '#8ee033' : '#e0483a');
      this.slotGlow.matrix.copy(s.matrix).multiply(new THREE.Matrix4().makeTranslation(0, 0.008, 0))
        .multiply(new THREE.Matrix4().makeScale(s.width * 0.95, 1, s.depth * 0.9)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
      this.slotGlow.visible = true;
    } else this.slotGlow.visible = false;
    // prompt text
    if (this.hoverComputer) prompt('[E] Use the shop computer');
    else if (this.hoverSlot !== undefined && this.hand.length) {
      const ok = d.slotOfSet[d.dice[this.hand[0]].setId] === this.hoverSlot;
      prompt(ok ? `[E] Sort ${this.hand.length} ${this.hand.length === 1 ? 'die' : 'dice'} here` : `Wrong slot · for ${this.setName(this.hoverSlot)}`, ok ? 'ok' : 'bad');
    } else if (this.hoverSlot !== undefined) {
      const setId = this.setOfSlot(this.hoverSlot);
      prompt(`${d.sets[setId].name} · ${this.count(this.mask[setId])} / 7`);
    } else if (this.hoverDie !== undefined) {
      const die = d.dice[this.hoverDie], why = this.cannotPick(die);
      const label = `${die.kind === 100 ? 'd%' : 'd' + die.kind} · ${d.sets[die.setId].name}`;
      prompt(why ? `${label} · ${why}` : `[E] Pick up ${label}`, why ? 'bad' : 'info');
    } else prompt('');
  }

  // ---------------- helpers ----------------
  private toSlot(id: number): void {
    const d = this.d, die = d.dice[id];
    d.physics.removeDie(id);
    die.where = 'slot';
    d.field.setMatrix(id, slotDieMatrix(d.slots[d.slotOfSet[die.setId]], die.kindIndex));
    this.mask[die.setId] |= 1 << die.kindIndex;
  }
  private cannotPick(die: Die): string | null {
    if (this.hand.length >= HAND_MAX) return 'hand full (7)';
    if (this.hand.length && this.d.dice[this.hand[0]].setId !== die.setId) return 'hand holds another set';
    return null;
  }
  private count(m: number): number { let c = 0; for (let i = 0; i < 7; i++) if (m & (1 << i)) c++; return c; }
  private setOfSlot(slot: number): number { return this.d.slotOfSet.indexOf(slot); }
  private setName(slot: number): string { return this.d.sets[this.setOfSlot(slot)].name; }

  private refreshHud(): void {
    const d = this.d;
    const id = this.hand[this.sel];
    if (id === undefined) {
      this.held.visible = false;
      renderHud({ icons: [], inSlot: 0, hand: 0, handMax: HAND_MAX, sorted: this.sortedSets, total: d.sets.length });
      return;
    }
    const die = d.dice[id], set = d.sets[die.setId];
    const icons: IconState[] = Array.from({ length: 7 }, (_, k) => {
      const w = d.dice[set.id * 7 + k].where; return w === 'slot' ? 'slot' : w === 'hand' ? 'hand' : 'none';
    });
    renderHud({
      held: { kind: die.kind, material: MATERIAL_LABEL[set.material], colour: `${set.base.name} · ${set.ink.name} ink`, hex: set.base.hex },
      icons, inSlot: this.count(this.mask[set.id]), hand: this.hand.length, handMax: HAND_MAX, sorted: this.sortedSets, total: d.sets.length,
    });
    let mat = this.heldMats.get(set.id);
    if (!mat) { mat = diceMaterial(set.material, new THREE.Color(set.base.hex).getHex()); this.heldMats.set(set.id, mat); }
    this.held.geometry = getShape(die.kind).geometry; this.held.material = mat;
    this.held.scale.setScalar(DIE_RADIUS * DIE_SIZE[die.kind] * 1.6); this.held.visible = true;
  }

  private save(): void {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, mask: Array.from(this.mask) })); } catch { /* storage unavailable */ }
  }
  static load(n: number): Uint8Array | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
      const data = JSON.parse(raw) as { v: number; mask: number[] };
      if (data.v !== 1 || data.mask.length !== n) return null;
      return Uint8Array.from(data.mask);
    } catch { return null; }
  }
}

function isUnder(o: THREE.Object3D | null, root: THREE.Object3D): boolean {
  for (let p = o; p; p = p.parent) if (p === root) return true;
  return false;
}
