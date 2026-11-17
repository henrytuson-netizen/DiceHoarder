import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** The baked furniture model (islands, wall racks, counter, desk) with slot markers. */
export class Furniture {
  private constructor(private readonly root: THREE.Object3D) {}

  static async load(url: string): Promise<Furniture> {
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true; m.receiveShadow = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.map) mat.map.anisotropy = 8;
      }
    });
    return new Furniture(gltf.scene);
  }

  /** A fresh copy of a named piece, positioned at the origin. */
  clone(name: string): THREE.Object3D {
    const src = this.root.getObjectByName(name);
    if (!src) throw new Error(`Model piece "${name}" not found`);
    const c = src.clone(true);
    c.position.set(0, 0, 0);
    c.rotation.set(0, 0, 0);
    return c;
  }
}

export interface Slot {
  index: number;
  /** World transform of the slot floor centre; local x = width, local z = depth, y = up. */
  matrix: THREE.Matrix4;
  width: number;
  depth: number;
}

/** Collect slot markers (empties named slot_###) under a placed piece, in name order. */
export function collectSlots(piece: THREE.Object3D, startIndex: number): Slot[] {
  piece.updateMatrixWorld(true);
  const found: THREE.Object3D[] = [];
  piece.traverse((o) => { if (o.name.startsWith('slot_')) found.push(o); });
  found.sort((a, b) => a.name.localeCompare(b.name));
  return found.map((o, i) => ({
    index: startIndex + i,
    matrix: o.matrixWorld.clone(),
    width: Number(o.userData.ex ?? 0.4),
    depth: Number(o.userData.ey ?? 0.2),
  }));
}
