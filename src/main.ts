import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';
import { makeRng } from './rng';
import { Furniture } from './furniture';
import { buildSetCatalogue } from './sets';
import { buildShop } from './shop';
import { DiceField } from './diceField';
import { Physics } from './physics';
import { Player } from './player';
import { Game } from './game';

const params = new URLSearchParams(location.search);
const AERIAL = params.get('view') === 'aerial';
const TEST = params.has('test');
const PRESORTED = Number(params.get('presorted') ?? 30);

async function main(): Promise<void> {
  const status = document.getElementById('loading');
  const app = document.getElementById('app') as HTMLElement;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: TEST });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = AERIAL ? 0.95 : 0.62;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1c120b');
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.03, 60);

  const [furniture, physics] = await Promise.all([
    Furniture.load(`${import.meta.env.BASE_URL}models/shop-furniture.glb`),
    Physics.create(),
  ]);
  const rng = makeRng(21);
  const sets = buildSetCatalogue();
  const shop = buildShop(scene, furniture, sets, rng, { cutaway: AERIAL, presorted: PRESORTED });
  const tris = physics.addStatic(scene);
  const field = new DiceField(shop.dice, sets, (d) => d.floor);
  scene.add(field.group);

  const player = new Player(camera, renderer.domElement);
  const game = new Game({ scene, camera, dom: renderer.domElement, field, physics, dice: shop.dice, sets, slots: shop.slots, slotOfSet: shop.slotOfSet, computer: shop.computer, presorted: shop.presorted });
  if (AERIAL) {
    camera.fov = 38; camera.position.set(8.5, 20, 22); camera.lookAt(8.5, 0, 6.6); camera.updateProjectionMatrix();
    for (const id of ['hud', 'crosshair', 'hint']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
  }
  status?.remove();
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

  // hooks for headless checks
  (window as unknown as Record<string, unknown>).__game = { camera, player, game, physics, dice: shop.dice, sets, slots: shop.slots, slotOfSet: shop.slotOfSet, staticTris: tris, render: () => renderer.render(scene, camera) };

  if (TEST) { game.update(0); renderer.render(scene, camera); (window as unknown as { __done: boolean }).__done = true; return; }
  let last = performance.now();
  renderer.setAnimationLoop((t) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (!AERIAL && !game.paused) player.step(dt);
    game.update(dt);
    renderer.render(scene, camera);
  });
  (window as unknown as { __done: boolean }).__done = true;
}

main().catch((err) => {
  console.error(err);
  const s = document.getElementById('loading');
  if (s) s.textContent = `Could not start: ${String(err)}`;
});
