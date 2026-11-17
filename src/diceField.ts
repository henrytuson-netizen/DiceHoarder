import * as THREE from 'three';
import { getShape, DIE_SIZE, type DieKind } from './dice';
import type { DiceSet, MaterialKind } from './sets';

export type DieWhere = 'floor' | 'hand' | 'slot';
export interface Die { id: number; setId: number; kind: DieKind; kindIndex: number; floor: THREE.Matrix4; where: DieWhere }

const Y_DOWN = new THREE.Vector3(0, -1, 0);
const Y_UP = new THREE.Vector3(0, 1, 0);
const HIDDEN = new THREE.Matrix4().compose(new THREE.Vector3(0, -50, 0), new THREE.Quaternion(), new THREE.Vector3(1e-4, 1e-4, 1e-4));

/** Matrix for a die resting flat on one of its faces at (x, y, z), turned by `yaw`. Optional parent transform. */
export function restingMatrix(kind: DieKind, radius: number, x: number, y: number, z: number, yaw: number, face: number, parent?: THREE.Matrix4): THREE.Matrix4 {
  const { faces } = getShape(kind);
  const f = faces[face % faces.length];
  const s = radius * DIE_SIZE[kind];
  const q = new THREE.Quaternion().setFromAxisAngle(Y_UP, yaw).multiply(new THREE.Quaternion().setFromUnitVectors(f.n, Y_DOWN));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + f.c.dot(f.n) * s + 0.001, z), q, new THREE.Vector3(s, s, s));
  return parent ? m.premultiply(parent) : m;
}

export function diceMaterial(kind: MaterialKind, colour = 0xffffff): THREE.MeshPhysicalMaterial {
  const base = { color: colour, flatShading: true };
  switch (kind) {
    case 'plastic': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.5 });
    case 'solidResin': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    case 'clearResin': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.06, transparent: true, opacity: 0.62, clearcoat: 1 });
    case 'metal': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.32, metalness: 0.9 });
    case 'gemstone': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.86, clearcoat: 1 });
    case 'special': return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.25, iridescence: 1, iridescenceIOR: 1.6 });
  }
}

/**
 * All dice drawn as one InstancedMesh per (material, die kind): 6 x 7 = 42 draw calls for 2,814 dice.
 * Each die keeps a fixed instance slot; moving a die just rewrites its matrix.
 */
export class DiceField {
  readonly group = new THREE.Group();
  readonly meshes: THREE.InstancedMesh[] = [];
  private readonly loc: { mesh: THREE.InstancedMesh; index: number }[] = [];
  private readonly owners = new Map<THREE.InstancedMesh, number[]>();
  private readonly dirty = new Set<THREE.InstancedMesh>();

  constructor(dice: Die[], sets: DiceSet[], initial: (d: Die) => THREE.Matrix4) {
    const buckets = new Map<string, Die[]>();
    for (const d of dice) {
      const key = `${sets[d.setId].material}|${d.kind}`;
      const list = buckets.get(key) ?? [];
      list.push(d); buckets.set(key, list);
    }
    const materials = new Map<MaterialKind, THREE.MeshPhysicalMaterial>();
    const colour = new THREE.Color();
    for (const [key, list] of buckets) {
      const [material, kindStr] = key.split('|') as [MaterialKind, string];
      const kind = Number(kindStr) as DieKind;
      let mat = materials.get(material);
      if (!mat) { mat = diceMaterial(material); materials.set(material, mat); }
      const mesh = new THREE.InstancedMesh(getShape(kind).geometry, mat, list.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const owners: number[] = [];
      list.forEach((d, i) => {
        mesh.setMatrixAt(i, initial(d));
        mesh.setColorAt(i, colour.set(sets[d.setId].base.hex));
        this.loc[d.id] = { mesh, index: i }; owners[i] = d.id;
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.name = `dice:${key}`;
      mesh.computeBoundingSphere();
      this.owners.set(mesh, owners);
      this.meshes.push(mesh); this.group.add(mesh);
    }
  }

  setMatrix(id: number, m: THREE.Matrix4): void {
    const { mesh, index } = this.loc[id];
    mesh.setMatrixAt(index, m); this.dirty.add(mesh);
  }
  getMatrix(id: number, out = new THREE.Matrix4()): THREE.Matrix4 {
    const { mesh, index } = this.loc[id];
    mesh.getMatrixAt(index, out); return out;
  }
  hide(id: number): void { this.setMatrix(id, HIDDEN); }
  dieAt(mesh: THREE.Object3D, instanceId: number | undefined): number | undefined {
    const owners = this.owners.get(mesh as THREE.InstancedMesh);
    return owners && instanceId !== undefined ? owners[instanceId] : undefined;
  }
  /** Push changed matrices to the GPU and refresh picking bounds. */
  flush(): void {
    for (const m of this.dirty) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
    this.dirty.clear();
  }
}
