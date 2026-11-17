import * as THREE from 'three';
import { canvasTexture } from './textures';
import type { Rng } from './rng';

/**
 * Cheap "god rays": each window gets a fan of soft additive light sheets along the sun direction,
 * drifting dust motes inside the beams, and a sunlit patch (with the window cross) on the floor.
 * No post-processing, so it stays light on laptops.
 */
interface WindowSpec { centre: THREE.Vector3; h: THREE.Vector3; v: THREE.Vector3; w: number; ht: number; sun: THREE.Vector3 }

const NORTH_SUN = new THREE.Vector3(0.22, -0.62, 1).normalize();
const EAST_SUN = new THREE.Vector3(-1, -0.6, 0.25).normalize();
const WINDOWS: WindowSpec[] = [
  ...[2.6, 7.0, 11.0, 15.0].map((x) => ({ centre: new THREE.Vector3(x, 1.9, 0.14), h: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0), w: 1.3, ht: 1.6, sun: NORTH_SUN })),
  ...[2.6, 10.5].map((z) => ({ centre: new THREE.Vector3(16.86, 1.9, z), h: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(0, 1, 0), w: 1.3, ht: 1.6, sun: EAST_SUN })),
];

const sheetVert = /* glsl */ `
  varying vec2 vUv; varying vec3 vWorld;
  void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const sheetFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uColor; uniform float uStrength;
  varying vec2 vUv; varying vec3 vWorld;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float noise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
  void main() {
    float across = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
    float along = pow(1.0 - vUv.y, 1.3) * smoothstep(0.0, 0.06, vUv.y);
    float dust = 0.65 + 0.35 * noise(vWorld * 2.2 + vec3(0.0, uTime * 0.05, uTime * 0.03));
    gl_FragColor = vec4(uColor * across * along * dust * uStrength, 1.0);
  }`;

const dustVert = /* glsl */ `
  uniform float uTime; attribute float aSeed; varying float vFade;
  void main() {
    vec3 p = position + vec3(sin(uTime * 0.21 + aSeed * 6.0), sin(uTime * 0.13 + aSeed * 11.0) * 0.6, cos(uTime * 0.17 + aSeed * 7.0)) * 0.08;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (2.0 + aSeed * 2.5) * (6.0 / -mv.z);
    vFade = 0.5 + 0.5 * sin(uTime * (0.6 + aSeed) + aSeed * 20.0);
    gl_Position = projectionMatrix * mv;
  }`;
const dustFrag = /* glsl */ `
  varying float vFade;
  void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vFade;
    gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * a * 0.55, 1.0); }`;

export class LightShafts {
  readonly group = new THREE.Group();
  private readonly uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#ffd9a0') }, uStrength: { value: 0.13 } };
  private readonly dustUniforms = { uTime: { value: 0 } };

  constructor(rng: Rng) {
    this.group.userData.noCollide = true;
    const sheetMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: sheetVert, fragmentShader: sheetFrag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const patchTex = canvasTexture((g, w, h) => {
      g.clearRect(0, 0, w, h);
      const grad = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.62);
      grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.7, 'rgba(255,255,255,.85)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(8, 8, w - 16, h - 16);
      g.fillStyle = 'rgba(0,0,0,1)'; g.fillRect(w / 2 - 5, 0, 10, h); g.fillRect(0, h / 2 - 5, w, 10);   // window cross
      g.globalCompositeOperation = 'destination-in';
      const edge = g.createLinearGradient(0, 0, w, 0); edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(0.12, 'rgba(0,0,0,1)'); edge.addColorStop(0.88, 'rgba(0,0,0,1)'); edge.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = edge; g.fillRect(0, 0, w, h);
    }, 256, 256);
    const patchMat = new THREE.MeshBasicMaterial({ map: patchTex, color: '#ffcf8a', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });

    const dustPos: number[] = [], dustSeed: number[] = [];
    for (const win of WINDOWS) {
      const L = (win.centre.y + win.ht / 2) / -win.sun.y + 0.5;   // reach the floor from the window top
      // sheets spanned by the sun direction and one window axis, spread across the other axis
      for (const [spread, span, spreadLen, spanLen] of [[win.h, win.v, win.w, win.ht], [win.v, win.h, win.ht, win.w]] as const) {
        for (let i = 0; i < 5; i++) {
          const o = (i / 4 - 0.5) * spreadLen * 0.85;
          const a = win.centre.clone().addScaledVector(spread, o).addScaledVector(span, -spanLen / 2);
          const b = win.centre.clone().addScaledVector(spread, o).addScaledVector(span, spanLen / 2);
          const g = new THREE.BufferGeometry();
          const pts = [a, b, b.clone().addScaledVector(win.sun, L), a.clone().addScaledVector(win.sun, L)];
          g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));
          g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
          g.setIndex([0, 1, 2, 0, 2, 3]);
          const m = new THREE.Mesh(g, sheetMat); m.renderOrder = 5; m.frustumCulled = false; this.group.add(m);
        }
      }
      // sunlit patch: window corners projected onto the floor along the sun
      const corner = (sh: number, sv: number) => {
        const p = win.centre.clone().addScaledVector(win.h, sh * win.w / 2).addScaledVector(win.v, sv * win.ht / 2);
        return p.addScaledVector(win.sun, (p.y - 0.008) / -win.sun.y);
      };
      const c = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.Float32BufferAttribute(c.flatMap((p) => [p.x, 0.008, p.z]), 3));
      pg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      pg.setIndex([0, 2, 1, 0, 3, 2]); pg.computeVertexNormals();
      const patch = new THREE.Mesh(pg, patchMat); patch.renderOrder = 4; this.group.add(patch);
      // dust inside the beam
      for (let i = 0; i < 70; i++) {
        const p = win.centre.clone().addScaledVector(win.h, (rng() - 0.5) * win.w).addScaledVector(win.v, (rng() - 0.5) * win.ht).addScaledVector(win.sun, rng() * L * 0.85);
        if (p.y < 0.1) continue;
        dustPos.push(p.x, p.y, p.z); dustSeed.push(rng());
      }
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dustPos, 3));
    dg.setAttribute('aSeed', new THREE.Float32BufferAttribute(dustSeed, 1));
    const dust = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: this.dustUniforms, vertexShader: dustVert, fragmentShader: dustFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    dust.frustumCulled = false; dust.renderOrder = 6; this.group.add(dust);
  }

  update(t: number): void { this.uniforms.uTime.value = t; this.dustUniforms.uTime.value = t; }
}
