import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture } from './textures';
import { POTS, WALL_H, DOOR, DIVIDER_Z } from './config';
import type { Rng } from './rng';

/**
 * Overgrowth: ivy along beams, window frames and walls, trailing vines, hanging planters,
 * potted plants. Leaves are one InstancedMesh (4 leaf shapes in a painted atlas); stems are one
 * merged mesh. A shared wind shader sways the trailing parts.
 */
const BEAM_Y = WALL_H - 0.34;          // underside of the ceiling beams
const MAIN_BEAMS = [1.5, 4.3, 7.1, 9.9, 12.7, 15.5];
const BACK_BEAMS = [7.0, 9.8, 12.6, 15.4];
const LAMPS: [number, number][] = [[4.05, 1.5], [11.45, 1.5], [4.05, 3.9], [11.45, 3.9], [3.6, 6.4], [8.7, 6.4], [14.4, 10.8], [8.4, 10.8], [13.9, 5.0]];

interface Leaf { m: THREE.Matrix4; tile: number; sway: number; phase: number; tint: THREE.Color }

function leafAtlas(): THREE.CanvasTexture {
  return canvasTexture((g) => {
    g.clearRect(0, 0, 512, 512);
    const tile = (tx: number, ty: number, draw: () => void) => { g.save(); g.translate(tx * 256, ty * 256); draw(); g.restore(); };
    const veins = (cx: number, top: number, bottom: number, spread: number, col: string) => {
      g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, bottom); g.lineTo(cx, top); g.stroke();
      g.lineWidth = 1.6;
      for (let i = 1; i < 6; i++) {
        const y = bottom - (bottom - top) * (i / 6);
        g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx - spread * 0.5, y - 14, cx - spread, y - 34); g.stroke();
        g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx + spread * 0.5, y - 14, cx + spread, y - 34); g.stroke();
      }
    };
    const fill = (top: string, bottom: string) => { const gr = g.createLinearGradient(0, 0, 60, 256); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fill(); };
    // 0: heart-shaped pothos leaf with pale streaks
    tile(0, 0, () => {
      g.beginPath(); g.moveTo(128, 18); g.bezierCurveTo(60, 60, 8, 150, 50, 212); g.bezierCurveTo(80, 240, 115, 228, 128, 206);
      g.bezierCurveTo(141, 228, 176, 240, 206, 212); g.bezierCurveTo(248, 150, 196, 60, 128, 18); g.closePath();
      fill('#5aa64a', '#2f7a33'); g.save(); g.clip();
      g.strokeStyle = 'rgba(230,240,150,.35)'; g.lineWidth = 7;
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(128, 200); g.quadraticCurveTo(60 + i * 35, 120, 90 + i * 20, 30); g.stroke(); }
      g.restore(); veins(128, 34, 205, 60, 'rgba(210,235,170,.55)');
    });
    // 1: five-lobed ivy leaf
    tile(1, 0, () => {
      g.beginPath();
      for (let k = 0; k <= 200; k++) {
        const t = (k / 200) * Math.PI * 2, r = 92 * (0.72 + 0.28 * Math.pow(Math.abs(Math.cos(2.5 * t)), 0.7));
        const x = 128 + Math.sin(t) * r, y = 138 - Math.cos(t) * r * 0.95;
        if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath(); fill('#3d7f3a', '#1f5227');
      g.strokeStyle = 'rgba(200,225,160,.6)'; g.lineWidth = 2.5;
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.62; g.beginPath(); g.moveTo(128, 200); g.lineTo(128 + Math.cos(a) * 90, 200 + Math.sin(a) * 120); g.stroke(); }
    });
    // 2: small round leaf
    tile(0, 1, () => {
      g.beginPath(); g.ellipse(128, 128, 80, 104, 0, 0, Math.PI * 2); fill('#86c45a', '#4f9a3c');
      veins(128, 34, 226, 44, 'rgba(235,250,190,.5)');
    });
    // 3: long pointed leaf
    tile(1, 1, () => {
      g.beginPath(); g.moveTo(128, 12); g.quadraticCurveTo(222, 120, 128, 246); g.quadraticCurveTo(34, 120, 128, 12); g.closePath();
      fill('#4c9a48', '#24632e'); veins(128, 26, 240, 40, 'rgba(210,235,170,.5)');
    });
  }, 512, 512);
}

const windDecl = /* glsl */ `
uniform float uTime;
attribute float aSway;
attribute float aPhase;
vec3 windOffset(float sway, float phase) {
  return vec3(sin(uTime * 1.6 + phase), 0.0, cos(uTime * 1.25 + phase * 1.7) * 0.6) * sway * 0.06;
}`;

export class Greenery {
  readonly group = new THREE.Group();
  private readonly uTime = { value: 0 };
  private readonly leaves: Leaf[] = [];
  private readonly stems: THREE.BufferGeometry[] = [];

  private constructor(private readonly rng: Rng) { this.group.userData.noCollide = true; }

  static async create(rng: Rng, plantsUrl: string): Promise<Greenery> {
    const g = new Greenery(rng);
    g.grow();
    g.build();
    try { await g.addPots(plantsUrl); } catch (e) { console.warn('plants model failed to load', e); }
    return g;
  }

  update(t: number): void { this.uTime.value = t; }

  // ------------------------------------------------------------ growth
  private grow(): void {
    const r = this.rng;
    const nearLamp = (x: number, z: number) => LAMPS.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 0.55);
    // ivy wrapping the beams + trails hanging from them
    const beams: [number, number, number][] = [...MAIN_BEAMS.map((x): [number, number, number] => [x, 0.15, 8.05]), ...BACK_BEAMS.map((x): [number, number, number] => [x, DIVIDER_Z + 0.15, 13.05])];
    for (const [x, z0, z1] of beams) {
      const len = z1 - z0, start = z0 + r() * len * 0.35, end = z1 - r() * len * 0.3;
      const pts: THREE.Vector3[] = [];
      for (let z = start, side = 1; z < end; z += 0.32 + r() * 0.2, side = -side) pts.push(new THREE.Vector3(x + side * (0.1 + r() * 0.04), BEAM_Y + 0.02 + r() * 0.12, z));
      if (pts.length > 2) this.vine(pts, new THREE.Vector3(0, -1, 0), 0.07, 0, [0, 1, 1, 3]);
      for (let z = start + 0.4; z < end; z += 0.55 + r() * 0.9) {
        if (nearLamp(x, z)) continue;
        const wallNear = z < 1.0 || x < 1.0 || x > 16 || (z > 7.2 && z < 8.2) || z > 12.4;
        const drop = wallNear ? 0.6 + r() * 0.8 : 0.25 + r() * 0.55;
        this.trail(new THREE.Vector3(x + (r() - 0.5) * 0.2, BEAM_Y, z), drop);
      }
    }
    // around the window frames
    const frame = (c: THREE.Vector3, along: THREE.Vector3, out: THREE.Vector3) => {
      const p = (a: number, y: number) => c.clone().addScaledVector(along, a).setY(y).addScaledVector(out, 0.05 + r() * 0.03);
      const side = r() < 0.5 ? -1 : 1;
      const pts = [p(side * 0.74, 0.95), p(side * 0.76, 1.6), p(side * 0.73, 2.3), p(side * 0.6, 2.8), p(0, 2.84), p(-side * 0.6, 2.8), p(-side * 0.74, 2.4)];
      if (r() < 0.6) pts.push(p(-side * 0.76, 1.9));
      this.vine(pts, out, 0.075, 0, [1, 1, 0, 3]);
      for (let i = 0; i < 3; i++) this.trail(p((r() - 0.5) * 1.2, 2.82), 0.25 + r() * 0.45, out);
    };
    [2.6, 7.0, 11.0, 15.0].forEach((x) => frame(new THREE.Vector3(x, 1.9, 0.07), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)));
    [2.6, 10.5].forEach((z) => frame(new THREE.Vector3(16.93, 1.9, z), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)));
    frame(new THREE.Vector3(0.07, 1.9, 4.0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
    // ivy climbing the walls
    const creep = (base: THREE.Vector3, along: THREE.Vector3, out: THREE.Vector3, height: number) => {
      for (let b = 0; b < 3; b++) {
        const pts: THREE.Vector3[] = []; let a = (r() - 0.5) * 0.3, y = 0.95 + b * 0.15;
        while (y < height) { pts.push(base.clone().addScaledVector(along, a).setY(y).addScaledVector(out, 0.04)); a += (r() - 0.5) * 0.35 + (b - 1) * 0.08; y += 0.18 + r() * 0.12; }
        if (pts.length > 2) this.vine(pts, out, 0.065, 0, [1, 1, 3, 0]);
      }
    };
    [4.8, 9.0, 13.0].forEach((x) => creep(new THREE.Vector3(x, 0, 0.07), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), 2.95));
    [1.6, 6.6].forEach((z) => creep(new THREE.Vector3(0.07, 0, z), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), 2.9));
    creep(new THREE.Vector3(16.93, 0, 7.4), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), 2.9);
    creep(new THREE.Vector3(2.6, 0, DIVIDER_Z - 0.07), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), 2.9);
    creep(new THREE.Vector3(12.0, 0, 13.13), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), 2.9);
    creep(new THREE.Vector3(16.93, 0, 12.0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), 2.9);
    // over the back-room door
    for (const dz of [-0.09, 0.09]) {
      const out = new THREE.Vector3(0, 0, Math.sign(dz));
      const pts = [-0.85, -0.6, -0.3, 0, 0.3, 0.6, 0.85].map((a, i) => new THREE.Vector3(DOOR.x + a, 2.24 + Math.sin((i / 6) * Math.PI) * 0.12, DIVIDER_Z + dz));
      this.vine(pts, out, 0.075, 0, [0, 0, 1, 3]);
      for (let i = 0; i < 4; i++) this.trail(new THREE.Vector3(DOOR.x + (r() - 0.5) * 1.5, 2.25, DIVIDER_Z + dz), 0.2 + r() * 0.35, out);
    }
    // hanging planters
    const terracotta = new THREE.MeshStandardMaterial({ color: '#b86b3a', roughness: 0.8 });
    const chain = new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.6, metalness: 0.4 });
    for (const [x, z] of [[2.6, 0.75], [7.0, 0.75], [11.0, 0.75], [15.0, 0.75], [16.2, 6.9], [12.0, 9.2], [15.6, 11.2]] as [number, number][]) {
      const py = 2.3;
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.16, 18), terracotta); pot.position.set(x, py, z); this.group.add(pot);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 18), terracotta); rim.rotation.x = Math.PI / 2; rim.position.set(x, py + 0.08, z); this.group.add(rim);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2, top = new THREE.Vector3(x, WALL_H - 0.05, z), bot = new THREE.Vector3(x + Math.cos(a) * 0.14, py + 0.08, z + Math.sin(a) * 0.14);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, top.distanceTo(bot), 4), chain);
        c.position.copy(top).add(bot).multiplyScalar(0.5); c.lookAt(bot); c.rotateX(Math.PI / 2); this.group.add(c);
      }
      for (let k = 0; k < 14; k++) {   // crown
        const a = r() * Math.PI * 2, rr = r() * 0.12;
        this.addLeaf(new THREE.Vector3(x + Math.cos(a) * rr, py + 0.08, z + Math.sin(a) * rr), new THREE.Vector3(Math.cos(a), 1.2, Math.sin(a)).normalize(), null, 0.09 + r() * 0.05, 0, 0.1, r() * 6);
      }
      for (let k = 0; k < 7; k++) { const a = r() * Math.PI * 2; this.trail(new THREE.Vector3(x + Math.cos(a) * 0.14, py + 0.07, z + Math.sin(a) * 0.14), 0.35 + r() * 0.6); }
    }
  }

  /** A stem along control points with leaves spaced along it. */
  private vine(ctrl: THREE.Vector3[], out: THREE.Vector3, leafSize: number, sway: number, tiles: number[]): void {
    const r = this.rng;
    const curve = new THREE.CatmullRomCurve3(ctrl);
    const len = curve.getLength(), phase = r() * 6.28;
    this.addStem(curve, 0.007, () => sway, phase);
    const n = Math.floor(len / 0.03);
    for (let i = 0; i < n; i++) {
      const t = (i + r() * 0.6) / n, p = curve.getPointAt(Math.min(1, t)), tan = curve.getTangentAt(Math.min(1, t));
      const side = (i % 2 ? 1 : -1);
      const dir = out.clone().multiplyScalar(0.55).addScaledVector(new THREE.Vector3().crossVectors(tan, out).normalize(), side * 0.8)
        .add(new THREE.Vector3((r() - 0.5) * 0.6, (r() - 0.5) * 0.6 - 0.15, (r() - 0.5) * 0.6)).normalize();
      this.addLeaf(p, dir, out, leafSize * (0.95 + r() * 0.7), tiles[Math.floor(r() * tiles.length)], sway, phase);
    }
  }

  /** A hanging strand: drops `length` metres, sways more towards the tip. */
  private trail(top: THREE.Vector3, length: number, out?: THREE.Vector3): void {
    const r = this.rng;
    const pts: THREE.Vector3[] = [], seg = 6, curl = new THREE.Vector3((r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.12);
    if (out) curl.addScaledVector(out, 0.05);
    for (let i = 0; i <= seg; i++) { const f = i / seg; pts.push(top.clone().add(new THREE.Vector3(curl.x * Math.sin(f * 3), -length * f, curl.z * Math.sin(f * 3)))); }
    const curve = new THREE.CatmullRomCurve3(pts), phase = r() * 6.28;
    this.addStem(curve, 0.005, (f) => f, phase);
    const n = Math.max(4, Math.floor(length / 0.035));
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n, p = curve.getPointAt(f), a = r() * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), -0.35 - r() * 0.4, Math.sin(a)).normalize();
      this.addLeaf(p, dir, null, (0.055 + r() * 0.04) * (1.1 - f * 0.35), r() < 0.7 ? 0 : 2, f, phase);
    }
  }

  private addStem(curve: THREE.Curve<THREE.Vector3>, radius: number, swayAt: (f: number) => number, phase: number): void {
    const segs = Math.max(6, Math.ceil(curve.getLength() / 0.06)), radial = 4;
    const g = new THREE.TubeGeometry(curve, segs, radius, radial, false);
    const count = g.attributes.position.count, sway = new Float32Array(count), ph = new Float32Array(count).fill(phase);
    for (let i = 0; i < count; i++) sway[i] = swayAt(Math.floor(i / (radial + 1)) / segs);
    g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1)); g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    this.stems.push(g);
  }

  private addLeaf(p: THREE.Vector3, dir: THREE.Vector3, face: THREE.Vector3 | null, size: number, tile: number, sway: number, phase: number): void {
    const r = this.rng;
    const y = dir.clone().normalize();
    const pref = face ? face.clone() : new THREE.Vector3(r() - 0.5, 0.6, r() - 0.5).normalize();
    let z = pref.sub(y.clone().multiplyScalar(pref.dot(y)));
    if (z.lengthSq() < 1e-4) z = new THREE.Vector3(1, 0, 0).cross(y);
    z.normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    const m = new THREE.Matrix4().makeBasis(x, y, z).scale(new THREE.Vector3(size, size, size)).setPosition(p);
    const tint = new THREE.Color().setHSL(0.27 + (r() - 0.5) * 0.06, 0.5 + r() * 0.3, 0.42 + r() * 0.22);
    this.leaves.push({ m, tile, sway, phase, tint: tint.multiplyScalar(2.1) });
  }

  // ------------------------------------------------------------ meshes
  private wind(mat: THREE.Material, leaf: boolean): void {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${windDecl}\n${leaf ? 'attribute float aTile;' : ''}`);
      if (leaf) sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vMapUv * 0.5 + vec2(mod(aTile, 2.0), 1.0 - floor(aTile / 2.0)) * 0.5;\n#endif`);
      sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        mvPosition = modelMatrix * mvPosition;
        mvPosition.xyz += windOffset(aSway, aPhase) ${leaf ? '+ vec3(sin(uTime * 3.1 + aPhase * 5.0 + position.y * 4.0), 0.0, 0.0) * 0.004 * position.y' : ''};
        mvPosition = viewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    };
  }

  private build(): void {
    const stemMat = new THREE.MeshStandardMaterial({ color: '#4d5a2a', roughness: 0.8 });
    this.wind(stemMat, false);
    const stems = new THREE.Mesh(mergeGeometries(this.stems), stemMat);
    stems.frustumCulled = false; this.group.add(stems);

    const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const n = this.leaves.length;
    const sway = new Float32Array(n), phase = new Float32Array(n), tile = new Float32Array(n);
    this.leaves.forEach((l, i) => { sway[i] = l.sway; phase[i] = l.phase; tile[i] = l.tile; });
    geo.setAttribute('aSway', new THREE.InstancedBufferAttribute(sway, 1));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 1));
    const leafMat = new THREE.MeshStandardMaterial({ map: leafAtlas(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55 });
    this.wind(leafMat, true);
    const mesh = new THREE.InstancedMesh(geo, leafMat, n);
    this.leaves.forEach((l, i) => { mesh.setMatrixAt(i, l.m); mesh.setColorAt(i, l.tint); });
    mesh.frustumCulled = false; mesh.receiveShadow = true;
    this.group.add(mesh);
    console.info(`greenery: ${n} leaves, ${this.stems.length} stems`);
  }

  private async addPots(url: string): Promise<void> {
    const gltf = await new GLTFLoader().loadAsync(url);
    const piece = (name: string) => { const src = gltf.scene.getObjectByName(name); if (!src) throw new Error(name); const c = src.clone(true); c.position.set(0, 0, 0); return c; };
    for (const p of POTS) { const c = piece(p.model); c.position.set(p.x, 0, p.z); c.rotation.y = p.ry; this.group.add(c); }
    for (const [x, y, z] of [[12.3, 1.12, 5.75], [15.3, 1.12, 5.95], [13.7, 0.96, 12.55]] as [number, number, number][]) {
      const c = piece('potted_plant_04'); c.position.set(x, y, z); c.scale.setScalar(1.3); this.group.add(c);
    }
    this.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = false; });
  }
}
