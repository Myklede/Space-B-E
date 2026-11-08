// One first-person cockpit per crew capsule (Role 3). The capsule's crew cabin IS the cockpit: the crew lie on their backs in reclined couches,
// the instrument panel hangs above the knees, and the windows, hatch and docking port sit exactly where Role 1's exterior model has them.
// Models: public/assets/models/cockpit/<id>.glb, built by scripts/blender/capsuleCockpit.py. Eye = origin, looking up the capsule axis (-Z).
// Same userData API as flightDeck.js (setControls, setButton, press, setTrajectory, setAim, setConjunction, setAlarm, onFrame) plus
// reach(id) (gloved hand presses a button), openHatch(t) and the aftHatch / ladderTop / aft nodes for Role 2's egress.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { events, getShip } from '/src/core/index.js';
import { installControls, installHands, isSaturated } from './cockpitRuntime.js';
import { createFlightDeck } from './flightDeck.js';

const BASE = '/assets/models/cockpit/';
// builder part type -> cabin model. The generic cones have no exterior model: Mk1 = Mercury, Mk2 = Dragon, Mk3 = Apollo.
export const CAPSULE_MODELS = {
  capsule_vostok: 'vostok', capsule_mercury: 'mercury', capsule_gemini: 'gemini', capsule_apollo: 'apollo', capsule_soyuz: 'soyuz',
  capsule_shenzhou: 'shenzhou', capsule_orion: 'orion', capsule_dragon: 'dragon', capsule_starliner: 'starliner', capsule_gaganyaan: 'gaganyaan',
  capsule_newshepard: 'newshepard', capsule_mengzhou: 'mengzhou', capsule_s: 'mercury', capsule_m: 'dragon', capsule_l: 'apollo',
};
const STYLES = ['small', 'panoramic', 'cupola'];
const HATCHES = ['side', 'inward', 'top'];
const ALBEDO = 0.2; // the pad's sun and sky lights are strong: keep the cabin lining at the contrast of the Blender renders
const loader = new GLTFLoader();
const templates = new Map();   // id -> THREE.Group
const loads = new Map();       // id -> Promise
const failed = new Set();

/** The capsule model for a ShipSpec (its crew cabin part), or null for Dream Chaser, Starship and ships without a capsule. */
export function capsuleIdFor(ship = getShip()) {
  const cabinType = ship?.stats?.cabin?.type; // Role 1's cabin record names the capsule (e.g. 'capsule_apollo') when present
  if (cabinType && CAPSULE_MODELS[cabinType]) return CAPSULE_MODELS[cabinType];
  for (const p of ship?.parts || []) if (CAPSULE_MODELS[p.type]) return CAPSULE_MODELS[p.type];
  return null;
}

function prepare(scene, id) {
  scene.name = `cockpit:${id}`;
  const seen = new Set();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; // the cabin is always around the camera
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      if (/^glass/.test(m.name)) {
        // thick window glass: a faint dark tint and a soft reflection, never a bright disc (the sun's specular on a mirror-smooth pane read as a white disc in space)
        m.transparent = true; m.opacity = 0.1; m.depthWrite = false; m.side = THREE.DoubleSide;
        m.roughness = 0.45; m.metalness = 0; m.envMapIntensity = 0.1; m.color.multiplyScalar(0.25);
        if ('specularIntensity' in m) m.specularIntensity = 0.2;
        continue;
      }
      m.side = THREE.DoubleSide;
      if (m.name === 'plate') { m.roughness = 1; m.metalness = 0; m.color.multiplyScalar(0.7); continue; }
      if (m.isMeshStandardMaterial && m.emissive.getHex() === 0 && !m.transparent && m.metalness < 0.5 && !isSaturated(m.color)) m.color.multiplyScalar(ALBEDO);
      if (m.name === 'alarm') m.emissiveIntensity = Math.min(m.emissiveIntensity, 1.5);
    }
  });
  return scene;
}

export function loadCapsule(id) {
  if (templates.has(id)) return Promise.resolve(templates.get(id));
  if (!loads.has(id)) {
    loads.set(id, loader.loadAsync(`${BASE}${id}.glb`).then(({ scene }) => {
      templates.set(id, prepare(scene, id));
      return scene;
    }).catch((err) => {
      failed.add(id);
      console.error(`[capsule cockpit] ${id} failed to load; using the flight deck`, err);
      return null;
    }));
  }
  return loads.get(id);
}

/** Resolve when the cockpit this ship will use is ready (warm-up waits for it). */
export function preloadCockpit(ship = getShip()) {
  const id = capsuleIdFor(ship);
  return id ? loadCapsule(id) : Promise.resolve(null);
}
if (typeof window !== 'undefined') events.on('ship:built', ({ shipSpec } = {}) => { preloadCockpit(shipSpec?.parts ? shipSpec : getShip()); });

/** The window / hatch variant the ship asks for (stats.cabin from Role 1 when present, else the defaults). */
export function variantFor(id, ship = getShip()) {
  const cabin = ship?.stats?.cabin || {};
  let windows = STYLES.includes(cabin.windows) ? cabin.windows : (id === 'newshepard' ? 'panoramic' : 'small');
  let hatch = { outward: 'side', side: 'side', inward: 'inward', top: 'top' }[cabin.hatch] || 'side';
  if (windows === 'cupola' && hatch === 'top') hatch = 'side'; // the dome replaces the docking port the top hatch opens into
  return { windows, hatch };
}

function applyVariant(model, { windows, hatch }) {
  for (const s of STYLES) { const n = model.getObjectByName(`win_${s}`); if (n) n.visible = s === windows; }
  for (const h of HATCHES) { const n = model.getObjectByName(`hatch_${h}`); if (n) n.visible = h === hatch; }
  const dock = model.getObjectByName('docking'); if (dock) dock.visible = windows !== 'cupola';
  const cap = model.getObjectByName('dock_cap'); if (cap) cap.visible = windows !== 'cupola' && hatch !== 'top';
  // the nodes Role 2's egress looks for
  const door = model.getObjectByName(`door_${hatch}`);
  const ladder = model.getObjectByName(`ladderTop_${hatch}`);
  const plug = model.getObjectByName(`plug_${hatch}`);
  if (door) door.name = 'aftHatch';
  if (ladder) ladder.name = 'ladderTop';
  if (plug) plug.visible = false;
  if (ladder) {
    const aft = new THREE.Object3D();
    aft.name = 'aft';
    model.add(aft);
    model.updateWorldMatrix(true, true);
    aft.position.copy(model.worldToLocal(ladder.getWorldPosition(new THREE.Vector3())));
  }
  return { door, plug, inward: hatch === 'inward', top: hatch === 'top' };
}

function installCapsule(group, id) {
  const template = templates.get(id);
  if (!template) return false;
  const model = template.clone(true);
  model.name = `cockpit:${id}`;
  group.clear();
  group.add(model);
  const variant = variantFor(id);
  const { door, plug, inward } = applyVariant(model, variant);
  group.userData.capsule = id;
  group.userData.variant = variant;
  let tri = 0;
  model.traverse((o) => { if (o.isMesh && o.visible) tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  group.userData.triangles = Math.round(tri);

  const cabinLight = new THREE.PointLight(0xfff0e2, 2.6, 5, 1.6);
  cabinLight.position.set(0, 0.1, -0.3);
  const screenLight = new THREE.PointLight(0x67e8f9, 0.22, 2, 2);
  screenLight.position.set(0, -0.15, -0.4);
  const alarmGlow = new THREE.PointLight(0xff2a1f, 0, 5, 2);
  alarmGlow.position.set(0, 0.3, -0.4);
  group.add(cabinLight, screenLight, alarmGlow);
  const ctrl = installControls(group, model, { panelNormal: new THREE.Vector3(0, 0, 1), lights: { cabinLight, alarmGlow, cabinBase: 2.6 } });
  installHands(group, model, ctrl);

  // hatch: pivot at the hinge, local y = hinge axis. openHatch(t) 0 closed .. 1 open (plug hatch swings in, the others out).
  const doorBase = door?.quaternion.clone();
  const _q = new THREE.Quaternion(), _e = new THREE.Euler();
  group.userData.openHatch = (t = 1) => {
    const u = Math.min(1, Math.max(0, t));
    if (!door) return false;
    const a = (inward ? 1 : -1) * 1.75 * u * u * (3 - 2 * u);
    door.quaternion.copy(doorBase).multiply(_q.setFromEuler(_e.set(0, a, 0)));
    if (plug) plug.visible = u > 0.02;
    return true;
  };
  return true;
}

/** Flight-deck cockpit first (it is the fallback while the GLB loads and when it fails); hot-swap the capsule cabin in when ready. */
export function createCapsuleCockpit(id, createFallback) {
  const ready = templates.has(id);
  const group = ready ? new THREE.Group() : createFlightDeck(createFallback);
  group.name = 'cockpit';
  let installed = false;
  const install = () => { if (!installed && templates.has(id)) installed = installCapsule(group, id); };
  if (ready) { install(); return group; }
  const swap = group.userData.onFrame;
  loadCapsule(id).then(install);
  group.userData.onFrame = (...args) => { if (!installed) { install(); if (!installed) swap?.(...args); } else group.userData.onFrame?.(...args); };
  return group;
}

/** assets.get('cockpit'): the capsule's own cabin, or the Shuttle-style deck for Dream Chaser, Starship and anything else. */
export function createShipCockpit(createFallback) {
  const id = capsuleIdFor();
  if (!id || failed.has(id)) return createFlightDeck(createFallback);
  return createCapsuleCockpit(id, createFallback);
}
