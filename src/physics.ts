import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { getShape, DIE_SIZE, type DieKind } from './dice';
import { DIE_RADIUS } from './config';

const STEP = 1 / 60;

/** Rapier world: one static trimesh for the shop, one convex body per loose die (asleep until disturbed). */
export class Physics {
  private readonly world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  private readonly events = new RAPIER.EventQueue(true);
  private readonly bodies = new Map<number, RAPIER.RigidBody>();
  private readonly hulls = new Map<DieKind, Float32Array>();
  private acc = 0;
  private readonly pos = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly scl = new THREE.Vector3();

  static async create(): Promise<Physics> { await RAPIER.init(); return new Physics(); }

  /** Every non-instanced mesh in `root` (unless userData.noCollide) becomes part of one static trimesh. */
  addStatic(root: THREE.Object3D): number {
    root.updateMatrixWorld(true);
    const verts: number[] = [], idx: number[] = [];
    const v = new THREE.Vector3();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || isFlagged(m)) return;
      const g = m.geometry as THREE.BufferGeometry;
      const p = g.attributes.position as THREE.BufferAttribute | undefined;
      if (!p) return;
      const base = verts.length / 3;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); verts.push(v.x, v.y, v.z); }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i));
      else for (let i = 0; i < p.count; i++) idx.push(base + i);
    });
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(verts), new Uint32Array(idx)).setFriction(0.7), body);
    return idx.length / 3;
  }

  private hull(kind: DieKind): Float32Array {
    let h = this.hulls.get(kind);
    if (!h) {
      const p = getShape(kind).geometry.attributes.position as THREE.BufferAttribute;
      const s = DIE_RADIUS * DIE_SIZE[kind];
      h = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { h[i * 3] = p.getX(i) * s; h[i * 3 + 1] = p.getY(i) * s; h[i * 3 + 2] = p.getZ(i) * s; }
      this.hulls.set(kind, h);
    }
    return h;
  }

  /** Add a die body at `matrix`. Asleep unless velocities are given. */
  addDie(id: number, kind: DieKind, matrix: THREE.Matrix4, linvel?: THREE.Vector3, angvel?: THREE.Vector3): void {
    matrix.decompose(this.pos, this.quat, this.scl);
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(this.pos.x, this.pos.y, this.pos.z)
      .setRotation({ x: this.quat.x, y: this.quat.y, z: this.quat.z, w: this.quat.w })
      .setLinearDamping(0.15).setAngularDamping(0.35).setCanSleep(true)
      .setSleeping(!linvel).setCcdEnabled(!!linvel);
    if (linvel) desc.setLinvel(linvel.x, linvel.y, linvel.z);
    if (angvel) desc.setAngvel({ x: angvel.x, y: angvel.y, z: angvel.z });
    const body = this.world.createRigidBody(desc);
    body.userData = id;
    const col = RAPIER.ColliderDesc.convexHull(this.hull(kind)) ?? RAPIER.ColliderDesc.ball(DIE_RADIUS * 0.8);
    col.setFriction(0.6).setRestitution(0.25).setDensity(400)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(1.5);
    this.world.createCollider(col, body);
    this.bodies.set(id, body);
  }

  removeDie(id: number): void {
    const b = this.bodies.get(id);
    if (b) { this.world.removeRigidBody(b); this.bodies.delete(id); }
  }

  /**
   * Advance with a fixed step. Calls `moved(id, matrix)` for every awake die and
   * returns the strongest contact force this frame (for clack sounds).
   */
  step(dt: number, moved: (id: number, m: THREE.Matrix4) => void): number {
    this.acc = Math.min(this.acc + dt, STEP * 4);
    let strongest = 0;
    while (this.acc >= STEP) {
      this.world.step(this.events);
      this.events.drainContactForceEvents((e) => { strongest = Math.max(strongest, e.totalForceMagnitude()); });
      this.acc -= STEP;
    }
    const m = new THREE.Matrix4(), one = new THREE.Vector3();
    this.world.forEachActiveRigidBody((b) => {
      if (typeof b.userData !== 'number') return;
      const t = b.translation(), r = b.rotation();
      this.pos.set(t.x, t.y, t.z); this.quat.set(r.x, r.y, r.z, r.w);
      one.setScalar(1);
      m.compose(this.pos, this.quat, one);
      moved(b.userData, m);
    });
    return strongest;
  }

  /** Test helper: current position of a die body. */
  position(id: number): THREE.Vector3 | null {
    const b = this.bodies.get(id); if (!b) return null;
    const t = b.translation(); return new THREE.Vector3(t.x, t.y, t.z);
  }
  isSleeping(id: number): boolean { return this.bodies.get(id)?.isSleeping() ?? true; }
}

function isFlagged(o: THREE.Object3D | null): boolean {
  for (let p = o; p; p = p.parent) if (p.userData.noCollide) return true;
  return false;
}
