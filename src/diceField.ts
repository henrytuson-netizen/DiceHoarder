import * as THREE from 'three';
import { getShape, DIE_SIZE, type DieKind } from './dice';
import type { DiceSet, MaterialKind } from './sets';

export interface DieRecord { setId: number; kind: DieKind; matrix: THREE.Matrix4 }

const Y_DOWN = new THREE.Vector3(0, -1, 0);
const Y_UP = new THREE.Vector3(0, 1, 0);

/** Matrix for a die resting flat on one of its faces at (x, y, z), turned by `yaw`. Optional parent transform. */
export function restingMatrix(kind: DieKind, radius: number, x: number, y: number, z: number, yaw: number, face: number, parent?: THREE.Matrix4): THREE.Matrix4 {
  const { faces } = getShape(kind);
  const f = faces[face % faces.length];
  const s = radius * DIE_SIZE[kind];
  const q = new THREE.Quaternion().setFromAxisAngle(Y_UP, yaw).multiply(new THREE.Quaternion().setFromUnitVectors(f.n, Y_DOWN));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + f.c.dot(f.n) * s + 0.001, z), q, new THREE.Vector3(s, s, s));
  return parent ? m.premultiply(parent) : m;
}

function materialFor(kind: MaterialKind): THREE.MeshPhysicalMaterial {
  const base = { color: 0xffffff, flatShading: true };
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
 * Numerals are not drawn on instanced dice yet (planned: only on dice near the player).
 */
export class DiceField {
  readonly group = new THREE.Group();

  constructor(records: DieRecord[], sets: DiceSet[]) {
    const buckets = new Map<string, DieRecord[]>();
    for (const r of records) {
      const key = `${sets[r.setId].material}|${r.kind}`;
      const list = buckets.get(key) ?? [];
      list.push(r); buckets.set(key, list);
    }
    const materials = new Map<MaterialKind, THREE.MeshPhysicalMaterial>();
    const colour = new THREE.Color();
    for (const [key, list] of buckets) {
      const [material, kindStr] = key.split('|') as [MaterialKind, string];
      const kind = Number(kindStr) as DieKind;
      let mat = materials.get(material);
      if (!mat) { mat = materialFor(material); materials.set(material, mat); }
      const mesh = new THREE.InstancedMesh(getShape(kind).geometry, mat, list.length);
      list.forEach((r, i) => { mesh.setMatrixAt(i, r.matrix); mesh.setColorAt(i, colour.set(sets[r.setId].base.hex)); });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.name = `dice:${key}`;
      this.group.add(mesh);
    }
  }
}
