import * as THREE from 'three';
import { PLAYER, START } from './config';
import { walkable } from './collision';

/** First-person walking: WASD + mouse look (pointer lock), Shift to run, arrows to look, R to reset. */
export class Player {
  private yaw = 0;
  private pitch = 0;
  private readonly keys: Record<string, boolean> = {};
  private readonly start: { x: number; z: number; yaw: number; pitch: number };

  constructor(readonly camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    camera.rotation.order = 'YXZ';
    const dx = START.lookX - START.x, dz = START.lookZ - START.z, dy = START.lookY - PLAYER.eye;
    this.start = { x: START.x, z: START.z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
    this.reset();
    addEventListener('keydown', (e) => { this.keys[e.code] = true; if (e.code === 'KeyR') this.reset(); });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    dom.addEventListener('click', () => { void dom.requestPointerLock?.(); });
    addEventListener('mousemove', (e) => {
      if (!document.pointerLockElement) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0022, -1.4, 1.4);
    });
    this.apply();
  }

  reset(): void {
    this.camera.position.set(this.start.x, PLAYER.eye, this.start.z);
    this.yaw = this.start.yaw; this.pitch = this.start.pitch; this.apply();
  }

  /** Test hook: hold a key in code. */
  setKey(code: string, down: boolean): void { this.keys[code] = down; }
  setYaw(v: number): void { this.yaw = v; this.apply(); }

  step(dt: number): void {
    const k = this.keys;
    if (k.ArrowLeft) this.yaw += 1.8 * dt;
    if (k.ArrowRight) this.yaw -= 1.8 * dt;
    if (k.ArrowUp) this.pitch = Math.min(1.4, this.pitch + 1.2 * dt);
    if (k.ArrowDown) this.pitch = Math.max(-1.4, this.pitch - 1.2 * dt);
    let f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), r = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    if (f || r) {
      const len = Math.hypot(f, r); f /= len; r /= len;
      const sp = (k.ShiftLeft || k.ShiftRight ? PLAYER.run : PLAYER.walk) * dt;
      const dx = (-Math.sin(this.yaw) * f + Math.cos(this.yaw) * r) * sp;
      const dz = (-Math.cos(this.yaw) * f - Math.sin(this.yaw) * r) * sp;
      const p = this.camera.position;
      if (walkable(p.x + dx, p.z, PLAYER.radius)) p.x += dx;
      if (walkable(p.x, p.z + dz, PLAYER.radius)) p.z += dz;
    }
    this.apply();
  }

  private apply(): void {
    this.camera.position.y = PLAYER.eye;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
