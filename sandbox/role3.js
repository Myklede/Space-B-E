// Role 3 visual sandbox: /sandbox/role3.html?view=mars&q=high
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import '/src/ui/theme.css';
import { assets, cinematic, createLaunchSite, createMarsScene, createSpaceScene, getTerrainHeight, graphics } from '/src/graphics/index.js';
import { audio } from '/src/audio/index.js';

const params = new URLSearchParams(location.search);
graphics.init({ container: document.getElementById('stage'), quality: params.get('q') || 'high' });

// Radii from the shared contract (spec §14). Role 1's src/core/planets.js replaces these once it lands.
const EARTH_R = 637e3, MARS_R = 339.5e3;
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 1e10);
const controls = new OrbitControls(camera, graphics.renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

function look(from, to) {
  camera.position.set(...from);
  controls.target.set(...to);
  controls.update();
}

// Looking around from one spot, as a pilot would.
function pivot() {
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.rotateSpeed = -0.35;
}

function orbit() {
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.rotateSpeed = 1;
}

// Elevation is where the planet's centre sits from the camera: -90 is straight down, and -40 brings the limb into a forward view.
function planetBelow(name, radius, altitude, sun, elevation = -90) {
  const scene = createSpaceScene();
  const planet = assets.get(`planet:${name}`);
  const e = THREE.MathUtils.degToRad(elevation);
  planet.scale.setScalar(radius);
  planet.position.set(0, Math.sin(e), -Math.cos(e)).multiplyScalar(radius + altitude);
  scene.add(planet);
  graphics.setSunDirection(new THREE.Vector3(...sun));
  return { scene, planet };
}

// Real maps load once, here, so no view ever shows the placeholder planet.
await assets.preload(['planet:earth', 'planet:mars']);

// Turns the globe so longitude `lon` (east positive) faces the +z side, where the cameras here look.
const faceLon = (planet, lon) => { planet.userData.surface.rotation.y = THREE.MathUtils.degToRad(-90 - lon); };

// VFX objects of the current view, driven by the lil-gui sliders.
const vfx = [];
// The launch site and mission props of the current view, driven by the altitude slider and the prop state dropdown.
let site = null;
const propItems = [];
const scene3d = { altitude: 0, propState: 'idle' };

const sunFrom = (elevation, azimuth) => {
  const e = THREE.MathUtils.degToRad(elevation), a = THREE.MathUtils.degToRad(azimuth);
  return new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a));
};

// The launch complex with a lander on the table and a low morning sun in the east.
function launchSite(altitude) {
  site = createLaunchSite();
  graphics.setSunDirection(sunFrom(22, 38));
  const lander = assets.get('lander');
  lander.position.copy(site.rocketBase);
  site.root.add(lander);
  site.setAltitude(altitude);
  return site.scene;
}

const VIEWS = {
  orbit: {
    label: 'Earth orbit',
    build() {
      const { scene, planet } = planetBelow('earth', EARTH_R, 170e3, [0.86, 0.36, -0.36], -36);
      faceLon(planet, 10);
      pivot();
      look([0, 0, 0], [0.04, -0.1, -1]);
      return scene;
    },
  },
  earth: {
    label: 'Earth globe',
    build() {
      const scene = createSpaceScene();
      const planet = assets.get('planet:earth');
      planet.scale.setScalar(EARTH_R);
      faceLon(planet, 20);
      planet.position.set(0, 0, -EARTH_R * 3.1);
      scene.add(planet);
      graphics.setSunDirection(new THREE.Vector3(0.82, 0.3, 0.55));
      pivot();
      look([0, 0, 0], [0, 0, -1]);
      return scene;
    },
  },
  launch: {
    label: 'Sky at 9 km',
    build() {
      const { scene, planet } = planetBelow('earth', EARTH_R, 9e3, [0.5, 0.55, -0.67], -90);
      planet.userData.surface.rotation.x = 1; // away from the ice cap at the pole
      pivot();
      look([0, 0, 0], [0, 0.1, -1]);
      return scene;
    },
  },
  marsorbit: {
    label: 'Mars orbit',
    build() {
      const { scene, planet } = planetBelow('mars', MARS_R, 90e3, [0.8, 0.42, -0.42], -36);
      faceLon(planet, -62);
      planet.userData.surface.rotation.x = -1.12; // the view looks toward the horizon, so tilt Valles Marineris (14 S) up to about 50 N of the camera
      pivot();
      look([0, 0, 0], [0.04, -0.1, -1]);
      return scene;
    },
  },
  mars: {
    label: 'Mars day',
    build() {
      const { scene } = createMarsScene({ sunElevation: 26 });
      placeLander(scene);
      walkTo(scene, [14, 22], [-20, 2.5, -80]);
      return scene;
    },
  },
  dusk: {
    label: 'Mars dusk',
    build() {
      const { scene } = createMarsScene({ sunElevation: 5.5, sunAzimuth: 300 });
      placeLander(scene);
      walkTo(scene, [14, 22], [90, 6, -110]);
      return scene;
    },
  },
  delta: {
    label: 'Jezero delta',
    build() {
      const { scene } = createMarsScene({ sunElevation: 15, sunAzimuth: 170 });
      const wreck = assets.get('halcyonLander');
      wreck.position.set(430, getTerrainHeight(430, -320), -320);
      scene.add(wreck);
      walkTo(scene, [395, -290], [720, 22, -570]);
      return scene;
    },
  },
  pad: {
    label: 'Launch pad',
    build() {
      const scene = launchSite(0);
      orbit();
      look([-150, 24, 35], [0, 16, -6]);
      return scene;
    },
  },
  ascent: {
    label: 'Ascent 25 km',
    build() {
      const scene = launchSite(25000);
      pivot();
      look([0, 0, 0], [0.6, -1.3, -0.7]);
      return scene;
    },
  },
  props: {
    label: 'Mission props',
    build() {
      const { scene } = createMarsScene({ sunElevation: 28, sunAzimuth: 112 });
      const names = ['scanPoint', 'sampleRock', 'discoveryRock', 'solarPanel', 'iceDeposit', 'dataLog', 'halcyonLander'];
      names.forEach((name, i) => {
        const prop = assets.get(name);
        const x = i === 6 ? 15 : (i - 3) * 4;
        prop.position.set(x, getTerrainHeight(x, 0), 0);
        prop.userData.setState(scene3d.propState);
        scene.add(prop);
        propItems.push(prop);
      });
      walkTo(scene, [2, 21], [2, getTerrainHeight(2, 0) + 1.2, 0]);
      return scene;
    },
  },
  wreck: {
    label: 'Halcyon wreck',
    build() {
      const { scene } = createMarsScene({ sunElevation: 20, sunAzimuth: 100 });
      const wreck = assets.get('halcyonLander');
      wreck.position.set(0, getTerrainHeight(0, 0), 0);
      scene.add(wreck);
      propItems.push(wreck);
      walkTo(scene, [4, 25], [0, getTerrainHeight(0, 0) + 3.4, 0]);
      return scene;
    },
  },
  cockpit: {
    label: 'Cockpit',
    build() {
      const { scene, planet } = planetBelow('earth', EARTH_R, 170e3, [0.86, 0.36, -0.36], -40);
      faceLon(planet, -95); // the US east coast sits right of centre, in daylight
      scene.add(assets.get('cockpit'));
      pivot();
      look([0, 0, 0], [0, -0.3, -1]);
      return scene;
    },
  },
  cabin: {
    label: 'Cabin',
    build() {
      const scene = new THREE.Scene();
      scene.add(assets.get('cabin'));
      pivot();
      look([0.2, 1.65, 3.2], [-0.2, 1.3, -3]);
      return scene;
    },
  },
  flame: {
    label: 'Engine flame',
    build() {
      const scene = createSpaceScene();
      graphics.setSunDirection(new THREE.Vector3(0.7, 0.45, 0.55));
      scene.add(new THREE.AmbientLight(0x8ea4c8, 0.25));
      // Left at sea level, right in vacuum, so the two plumes can be compared side by side.
      [[-6, 1], [6, 0]].forEach(([x, airDensity]) => {
        const lander = assets.get('lander');
        lander.position.set(x, 13, 0);
        const sun = new THREE.DirectionalLight(0xfff4e6, 2.6);
        sun.position.set(x + 7, 22, 9);
        sun.target = lander;
        const flame = assets.get('vfx:engineFlame');
        const exhaust = assets.get('vfx:exhaust');
        [flame, exhaust].forEach((v) => { v.position.y = 0.5; v.userData.set({ airDensity }); lander.add(v); vfx.push(v); });
        scene.add(lander, sun);
      });
      orbit();
      look([0, 7, 44], [0, 6, 0]);
      return scene;
    },
  },
  entry: {
    label: 'Entry plasma',
    build() {
      const { scene } = planetBelow('mars', MARS_R, 120e3, [0.86, 0.36, -0.36], -40);
      const cockpit = assets.get('cockpit');
      const plasma = assets.get('vfx:entryPlasma');
      plasma.userData.set({ intensity: 0.9 });
      cockpit.add(plasma);
      vfx.push(plasma);
      scene.add(cockpit);
      pivot();
      look([0, 0, 0], [0, -0.3, -1]);
      return scene;
    },
  },
  landing: {
    label: 'Landing dust',
    build() {
      const { scene } = createMarsScene({ sunElevation: 26 });
      const ground = getTerrainHeight(0, 0);
      placeLander(scene);
      const flame = assets.get('vfx:engineFlame');
      flame.position.set(0, ground + 1, 0);
      flame.userData.set({ airDensity: 0.02, throttle: 0.6 });
      const dust = assets.get('vfx:landingDust');
      dust.position.set(0, ground, 0);
      dust.userData.set({ intensity: 1 });
      scene.add(flame, dust);
      vfx.push(flame, dust);
      orbit();
      look([15, ground + 4, 0], [0, ground + 3, 0]);
      return scene;
    },
  },
  cabin2: {
    label: 'Cabin, to airlock',
    build() {
      const scene = new THREE.Scene();
      scene.add(assets.get('cabin'));
      pivot();
      look([0.2, 1.65, -2.4], [0, 1.3, 3]);
      return scene;
    },
  },
  parts: {
    label: 'Rocket parts',
    build() {
      const scene = createSpaceScene();
      graphics.setSunDirection(new THREE.Vector3(0.7, 0.45, 0.55));
      const sun = new THREE.DirectionalLight(0xfff4e6, 3.2);
      sun.position.set(7, 4.5, 5.5);
      scene.add(sun, new THREE.AmbientLight(0x8ea4c8, 0.32));
      const ids = ['capsule_m', 'tank_s', 'tank_m', 'tank_l', 'engine_m', 'nose_m', 'fin_m', 'legs_m', 'heatshield_m', 'radar_dish'];
      ids.forEach((id, i) => {
        const part = assets.get(`rocketPart:${id}`);
        part.position.set((i % 5 - 2) * 4.2, i < 5 ? 1.6 : -5, 0);
        scene.add(part);
      });
      orbit();
      look([0, 2.5, 17], [0, -0.8, 0]);
      return scene;
    },
  },
};

function placeLander(scene) {
  const lander = assets.get('lander');
  lander.position.set(0, getTerrainHeight(0, 0), 0);
  scene.add(lander);
}

// Walking view: eye height comes from getTerrainHeight, the same call Role 2 will use.
let walking = null;
function walkTo(scene, [x, z], lookAt) {
  pivot();
  camera.position.set(x, getTerrainHeight(x, z) + 1.7, z);
  controls.target.set(...lookAt);
  controls.update();
  walking = scene;
}

const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
const forward = new THREE.Vector3(), side = new THREE.Vector3(), step = new THREE.Vector3();

function walk(dt) {
  if (!walking) return;
  camera.getWorldDirection(forward).setY(0).normalize();
  side.crossVectors(forward, camera.up);
  step.set(0, 0, 0);
  if (keys.has('KeyW')) step.add(forward);
  if (keys.has('KeyS')) step.sub(forward);
  if (keys.has('KeyD')) step.add(side);
  if (keys.has('KeyA')) step.sub(side);
  const speed = keys.has('ShiftLeft') ? 22 : 4;
  step.multiplyScalar(speed * dt);
  const before = camera.position.clone();
  camera.position.add(step);
  camera.position.y = getTerrainHeight(camera.position.x, camera.position.z) + 1.7;
  controls.target.add(camera.position.clone().sub(before));
}

const nav = document.getElementById('views');
const hudSample = document.getElementById('hudSample');
const buttons = {};

function show(name) {
  walking = null;
  site = null;
  vfx.length = 0;
  propItems.length = 0;
  const scene = VIEWS[name].build();
  graphics.setView(scene, camera);
  Object.entries(buttons).forEach(([key, b]) => b.setAttribute('aria-pressed', key === name));
  hudSample.hidden = !['mars', 'dusk', 'delta', 'landing'].includes(name);
  history.replaceState(null, '', `?view=${name}&q=${graphics.quality}`);
}

for (const [name, view] of Object.entries(VIEWS)) {
  const button = document.createElement('button');
  button.className = 'hud-button';
  button.textContent = view.label;
  button.onclick = () => { audio.play('ui.click'); show(name); };
  nav.append(button);
  buttons[name] = button;
}

// Debug panel for the APIs other roles will drive.
const debug = { vignette: 0, blackout: 0, shake: 0, sound: 'ui.snap' };
const gui = new GUI({ title: 'Role 3 debug' });
gui.add(graphics, 'quality').name('quality (reload with ?q=low)').disable();
gui.add(debug, 'vignette', 0, 1).onChange((v) => graphics.setEffects({ vignette: v }));
gui.add(debug, 'blackout', 0, 1).onChange((v) => graphics.setEffects({ blackout: v }));
gui.add(debug, 'shake', 0, 1).onChange((v) => graphics.setEffects({ shake: v }));
gui.add(debug, 'sound', audio.ids());
gui.add({ play: () => audio.play(debug.sound) }, 'play').name('play sound');
gui.add({ stop: () => audio.stopAll() }, 'stop').name('stop loops');
gui.add({
  run() {
    const p = camera.position, t = controls.target;
    controls.enabled = false;
    cinematic.play({
      camera,
      duration: 6,
      cameraPath: [
        { position: [p.x, p.y, p.z], lookAt: [t.x, t.y, t.z] },
        { position: [p.x + 6, p.y + 4, p.z - 5], lookAt: [t.x, t.y, t.z] },
        { position: [p.x + 2, p.y + 10, p.z - 14], lookAt: [t.x, t.y, t.z] },
      ],
      fades: [{ at: 4.5, to: 1, duration: 1.4 }],
    }).then(() => {
      graphics.fade({ to: 0, duration: 0.7 });
      camera.position.copy(p);
      controls.enabled = true;
    });
  },
}, 'run').name('test cinematic');
const sceneFolder = gui.addFolder('launch site and props');
sceneFolder.add(scene3d, 'altitude', 0, 45000).name('setAltitude (m)').onChange((v) => site?.setAltitude(v));
sceneFolder.add(scene3d, 'propState', ['idle', 'active', 'done']).name('prop state').onChange((v) => propItems.forEach((p) => p.userData.setState(v)));
const fx = { throttle: 1, airDensity: 1, intensity: 1, fuel: 'methalox' };
const vfxFolder = gui.addFolder('vfx');
const drive = (key) => (v) => vfx.forEach((o) => o.userData.set({ [key]: v }));
vfxFolder.add(fx, 'throttle', 0, 1).onChange(drive('throttle'));
vfxFolder.add(fx, 'airDensity', 0, 1).onChange(drive('airDensity'));
vfxFolder.add(fx, 'intensity', 0, 1).onChange(drive('intensity'));
vfxFolder.add(fx, 'fuel', ['kerolox', 'methalox', 'hydrolox']).onChange(drive('fuel'));
gui.close();

graphics.renderer.info.autoReset = false; // keeps the scene's triangle count, not just the last fullscreen pass
show(VIEWS[params.get('view')] ? params.get('view') : 'orbit');

window.__role3 = { graphics, assets, cinematic, getTerrainHeight, audio, camera, controls, vfx, get site() { return site; }, propItems, stopWalk: () => { walking = null; } };  // for automated checks

// Frame stats for the sandbox readout and the automated checks.
const fpsEl = document.getElementById('fps');
const times = [];
let last = performance.now();
let frames = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  walk(dt);
  graphics.renderer.info.reset();
  if (!cinematic.active) controls.update();
  graphics.render(dt);
  times.push(dt);
  if (times.length > 60) times.shift();
  if (++frames % 20 === 0) {
    const fps = times.length / times.reduce((a, b) => a + b, 0);
    fpsEl.textContent = `${fps.toFixed(0)} fps · ${graphics.renderer.info.render.triangles.toLocaleString()} tris`;
    window.__fps = fps;
  }
  window.__frames = frames;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
