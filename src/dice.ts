import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { canvasTexture } from './textures';
import type { Rng } from './rng';

export type DieKind = 4 | 6 | 8 | 10 | 100 | 12 | 20;
/** The 7 dice that make one set. */
export const SET_KINDS: DieKind[] = [4, 6, 8, 10, 100, 12, 20];

export interface DiceMaterial { c: string; r: number; m?: number; o?: number }
export const DICE_MATERIALS: Record<string, DiceMaterial> = {
  pink: { c: '#e89bbd', r: 0.3, m: 0.9 }, gold: { c: '#e0b43a', r: 0.32, m: 0.95 }, silver: { c: '#cfd4dc', r: 0.28, m: 0.95 },
  copper: { c: '#c9774c', r: 0.34, m: 0.92 }, bronze: { c: '#a9884a', r: 0.36, m: 0.9 }, gun: { c: '#707683', r: 0.3, m: 0.95 },
  cPink: { c: '#ff7ab4', r: 0.12, o: 0.7 }, cBlue: { c: '#6ad0ff', r: 0.12, o: 0.7 }, cGreen: { c: '#8aff9a', r: 0.12, o: 0.7 },
  cAmber: { c: '#ffc45a', r: 0.12, o: 0.7 }, cViolet: { c: '#a68aff', r: 0.12, o: 0.7 }, cRed: { c: '#ff5a5a', r: 0.12, o: 0.7 },
  plTeal: { c: '#2fb7a4', r: 0.5 }, plOrange: { c: '#f08a3c', r: 0.5 }, plBlue: { c: '#3d6fe0', r: 0.5 },
  plLime: { c: '#8ad43c', r: 0.5 }, plWhite: { c: '#eae6dc', r: 0.5 }, plBlack: { c: '#2a2a2e', r: 0.5 },
  gRuby: { c: '#c8204a', r: 0.1, m: 0.1 }, gSap: { c: '#2a4fc0', r: 0.1, m: 0.1 }, gEm: { c: '#1fa860', r: 0.1, m: 0.1 }, gAm: { c: '#d89a20', r: 0.1, m: 0.1 },
};

const SIZE: Record<DieKind, number> = { 4: 1.05, 6: 0.82, 8: 0.95, 10: 0.95, 100: 0.95, 12: 1, 20: 1.05 };
const LABELS: Record<DieKind, string[]> = {
  4: ['1', '2', '3', '4'], 6: ['1', '2', '3', '4', '5', '6'], 8: ['1', '2', '3', '4', '5', '6', '7', '8'],
  10: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], 100: ['00', '10', '20', '30', '40', '50', '60', '70', '80', '90'],
  12: Array.from({ length: 12 }, (_, i) => String(i + 1)), 20: Array.from({ length: 20 }, (_, i) => String(i + 1)),
};

interface Face { n: THREE.Vector3; c: THREE.Vector3; s: number }
interface Shape { geometry: THREE.BufferGeometry; faces: Face[] }
const shapes = new Map<DieKind, Shape>();

function baseGeometry(kind: DieKind): THREE.BufferGeometry {
  switch (kind) {
    case 4: return new THREE.TetrahedronGeometry(1);
    case 6: return new THREE.BoxGeometry(1.15, 1.15, 1.15).toNonIndexed();
    case 8: return new THREE.OctahedronGeometry(1);
    case 12: return new THREE.DodecahedronGeometry(1);
    case 20: return new THREE.IcosahedronGeometry(1);
    default: { // d10 / d%: pentagonal trapezohedron
      const pts = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)];
      for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5; pts.push(new THREE.Vector3(Math.cos(a), k % 2 ? 0.1056 : -0.1056, Math.sin(a))); }
      return new ConvexGeometry(pts);
    }
  }
}

export function getShape(kind: DieKind): Shape {
  const cached = shapes.get(kind);
  if (cached) return cached;
  let g = baseGeometry(kind);
  if (g.index) g = g.toNonIndexed();
  g.computeVertexNormals();
  const p = g.attributes.position as THREE.BufferAttribute;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  const acc = new Map<string, { n: THREE.Vector3; c: THREE.Vector3; ar: number }>();
  for (let i = 0; i < p.count; i += 3) {
    A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); C.fromBufferAttribute(p, i + 2);
    const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A));
    const ar = n.length() / 2; n.normalize();
    const key = [n.x, n.y, n.z].map((v) => Math.round(v * 40)).join(',');
    const c = A.clone().add(B).add(C).multiplyScalar(1 / 3);
    const f = acc.get(key) ?? { n: n.clone(), c: new THREE.Vector3(), ar: 0 };
    f.c.addScaledVector(c, ar); f.ar += ar; acc.set(key, f);
  }
  const faces = [...acc.values()].map((f) => ({ n: f.n, c: f.c.multiplyScalar(1 / f.ar), s: Math.sqrt(f.ar) }));
  const shape = { geometry: g, faces };
  shapes.set(kind, shape);
  return shape;
}

const materialCache = new Map<string, THREE.MeshPhysicalMaterial>();
function bodyMaterial(m: DiceMaterial): THREE.MeshPhysicalMaterial {
  const k = JSON.stringify(m);
  let mat = materialCache.get(k);
  if (!mat) {
    mat = new THREE.MeshPhysicalMaterial({ color: m.c, roughness: m.r, metalness: m.m ?? 0, transparent: !!m.o, opacity: m.o ?? 1, flatShading: true, clearcoat: m.m ? 0 : 0.5, clearcoatRoughness: 0.3 });
    materialCache.set(k, mat);
  }
  return mat;
}

const numeralGeometry = new THREE.PlaneGeometry(1, 1);
const numeralMaterials = new Map<string, THREE.MeshStandardMaterial>();
function numeralMaterial(label: string, ink: string): THREE.MeshStandardMaterial {
  const k = `${label}|${ink}`;
  let m = numeralMaterials.get(k);
  if (!m) {
    const t = canvasTexture((g, w, h) => {
      g.clearRect(0, 0, w, h); g.font = 'bold 70px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = ink; g.fillText(label, w / 2, h / 2 + 3);
      if (/^[69]$/.test(label)) g.fillRect(w / 2 - 16, h / 2 + 34, 32, 6);
    }, 96, 96);
    m = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    numeralMaterials.set(k, m);
  }
  return m;
}

const Z = new THREE.Vector3(0, 0, 1);

/**
 * Create a die. `numerals`: 1 = all faces, 0.5 = upward faces only, 0 = none.
 */
export function createDie(kind: DieKind, mat: DiceMaterial, radius: number, parent: THREE.Object3D, x: number, y: number, z: number, numerals: number, rng: Rng): THREE.Mesh {
  const { geometry, faces } = getShape(kind);
  const d = new THREE.Mesh(geometry, bodyMaterial(mat));
  d.scale.setScalar(radius * SIZE[kind]);
  d.position.set(x, y, z);
  d.rotation.set(rng() * 6.28, rng() * 6.28, rng() * 6.28);
  d.castShadow = true; d.receiveShadow = true;
  parent.add(d);
  if (numerals > 0) {
    const light = new THREE.Color(mat.c).getHSL({ h: 0, s: 0, l: 0 }).l > 0.55;
    const ink = light ? '#4a2a2a' : '#fff4e0';
    const labels = LABELS[kind];
    d.updateMatrix(); d.updateMatrixWorld(true);
    const q = d.getWorldQuaternion(new THREE.Quaternion());
    faces.forEach((fc, i) => {
      if (numerals < 1 && numerals !== 0.5 && rng() > numerals) return;
      if (numerals === 0.5 && fc.n.clone().applyQuaternion(q).y < -0.1) return;
      const n = new THREE.Mesh(numeralGeometry, numeralMaterial(labels[i % labels.length], ink));
      n.scale.setScalar(fc.s * (kind === 6 ? 0.62 : kind === 4 ? 0.5 : 0.55));
      n.position.copy(fc.c).addScaledVector(fc.n, 0.012);
      n.quaternion.setFromUnitVectors(Z, fc.n);
      d.add(n);
    });
  }
  return d;
}

export { SIZE as DIE_SIZE };
