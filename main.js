import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true, // lets gl.readPixels-based diagnostics work in the preview harness
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b3442);
scene.fog = new THREE.Fog(0x2b3442, 12, 30);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0.8, 1.7, 5.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.15, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.55;
controls.minDistance = 2;
controls.maxDistance = 12;
controls.update();

// --- lighting: soft key + cool fill + warm rim, Gang Beasts stage-y look ---
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x51443e, 0.55));

const key = new THREE.DirectionalLight(0xfff6ec, 2.0);
key.position.set(3.5, 6, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 5;
key.shadow.camera.bottom = -1;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key);

const rim = new THREE.DirectionalLight(0x8fb7ff, 1.1);
rim.position.set(-4, 3.5, -4.5);
scene.add(rim);

// --- ground: big soft disc ---
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(14, 64).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x39455a, roughness: 0.95, metalness: 0 })
);
ground.receiveShadow = true;
scene.add(ground);

const ring = new THREE.Mesh(
  new THREE.RingGeometry(2.1, 2.18, 64).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x4d5c76 })
);
ring.position.y = 0.001;
scene.add(ring);

// --- character loading: ?v=a|b|c picks a variant module, anything else = character.js ---
const params = new URLSearchParams(location.search);
const variant = params.get('v') || 'final';
const modulePath = /^[abc]$/.test(variant) ? `./variants/${variant}.js` : './character.js';
document.getElementById('variant-name').textContent = variant;

const { buildCharacter } = await import(modulePath);
const character = buildCharacter(THREE);
scene.add(character.group);

// --- poke on click ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return; // it was a drag
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.intersectObject(character.group, true).length && character.poke) {
    const dir = raycaster.ray.direction.clone();
    dir.y = 0;
    character.poke(dir.normalize());
  }
});

window.addEventListener('keydown', (e) => {
  const map = { 1: 'a', 2: 'b', 3: 'c', 0: 'final' };
  if (map[e.key]) location.search = `?v=${map[e.key]}`;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- loop, plus a deterministic stepper for environments where rAF is throttled ---
let elapsed = 0;
function frame(dt) {
  elapsed += dt;
  character.update(elapsed, dt);
  controls.update();
  renderer.render(scene, camera);
}

window.__step = (n = 1, dt = 1 / 60) => {
  for (let i = 0; i < n; i++) frame(dt);
  return elapsed;
};
window.__char = character;
window.__camera = camera;
window.__renderer = renderer;

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => frame(Math.min(clock.getDelta(), 0.05)));
frame(1 / 60); // guarantee one rendered frame even if the loop never fires
