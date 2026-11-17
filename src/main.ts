import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';
import { makeRng } from './rng';
import { Furniture } from './furniture';
import { buildSetCatalogue } from './sets';
import { buildShop } from './shop';
import { DiceField } from './diceField';
import { Player } from './player';
import { renderHud } from './hud';
import { TOTAL_SETS } from './config';

const params = new URLSearchParams(location.search);
const AERIAL = params.get('view') === 'aerial';
const TEST = params.has('test');
const PRESORTED = Number(params.get('presorted') ?? 30);

async function main(): Promise<void> {
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
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 60);
  const rng = makeRng(21);
  const furniture = await Furniture.load(`${import.meta.env.BASE_URL}models/shop-furniture.glb`);
  const sets = buildSetCatalogue();
  const shop = buildShop(scene, furniture, sets, rng, { cutaway: AERIAL, presorted: PRESORTED });
  scene.add(new DiceField(shop.dice, sets).group);

  const player = new Player(camera, renderer.domElement);
  if (AERIAL) { camera.fov = 38; camera.position.set(8.5, 20, 22); camera.lookAt(8.5, 0, 6.6); camera.updateProjectionMatrix(); }
  for (const id of ['hud', 'crosshair', 'hint']) { const e = document.getElementById(id); if (e && AERIAL) e.style.display = 'none'; }
  renderHud({ collected: 0, value: 0, sorted: shop.sortedSets, total: TOTAL_SETS });

  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

  // test hooks for headless checks
  (window as unknown as { __game: unknown }).__game = {
    camera, player, slots: shop.slots.length, dice: shop.dice.length, sets: sets.length,
    render: () => renderer.render(scene, camera),
  };

  if (TEST) { renderer.render(scene, camera); (window as unknown as { __done: boolean }).__done = true; return; }
  let last = performance.now();
  renderer.setAnimationLoop((t) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (!AERIAL) player.step(dt);
    renderer.render(scene, camera);
  });
  (window as unknown as { __done: boolean }).__done = true;
}

main().catch((err) => {
  console.error(err);
  const app = document.getElementById('app');
  if (app) app.innerHTML = `<p style="color:#fff;padding:24px">Could not start: ${String(err)}</p>`;
});
