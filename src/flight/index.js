// Role 2 flight module: owns LAUNCH, ORBIT, ENTRY, LANDING (contract.js STATE_OWNERS).
// Real Newtonian physics (FlightController) + Role 3's cockpit, planets, rocket parts and VFX.
//
//   LAUNCH  pad → ascent; reaching orbit moves to ORBIT on its own.
//   ORBIT   coast; T = transfer burn to Mars (Δv from balance.json deltaVKmS.transfer) → CRUISE (Role 4).
//   ENTRY   Mars entry (heat shield, chute); below 6 km moves to LANDING on its own.
//   LANDING powered descent and touchdown; E after landing → INTERIOR (Role 2 surface).
// Failures emit flight:failed; Role 4's story module charges the penalty and shows the ending.
import * as THREE from 'three';
import { assets, createMarsScene, createSpaceScene, getTerrainHeight, graphics } from '/src/graphics/index.js';
import { audio } from '/src/audio/index.js';
import { G0, PLANETS, economy, events, getShip, input, requestState, ui } from '/src/core/index.js';
import { stubScreen } from '/src/core/stubScreen.js';
import { astronaut } from '/src/surface/astronaut.js';
import { FlightController } from './FlightController.js';
import { createCockpitControls } from './cockpitControls.js';
import { assistReadout } from './flightAssist.js';
import { createDebrisField } from './debris.js';
import { pressureRatio } from './atmosphere.js';
import { STARTS } from './presets.js';
import { createFlightHUD } from './hud/createFlightHUD.js';

const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '∞');

export { FlightController };

const LOW_MARS_ALTITUDE = 6000; // m: below this the view switches to Role 3's detailed Mars terrain
const TELEMETRY_EVERY = 0.5; // s (contract: flight:telemetry about twice per second)
const toCockpit = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); // nose +Y → cockpit −Z

// Mission state that survives state changes (LAUNCH → ORBIT keeps the same controller; LANDING ⇄ INTERIOR too).
const mission = { fc: null, planetId: null, fuelForMars: null };
let s = null; // per-state session (scene, camera, HUD, controls)

const v3 = (p) => new THREE.Vector3(p.x, p.y, p.z);

function newController(planetId, start, fuel) {
  const fc = new FlightController({ bus: events, planets: PLANETS, g0: G0, planetId, shipSpec: getShip(), start, fuel });
  mission.fc = fc;
  mission.planetId = planetId;
  return fc;
}

function circularOrbitStart(planetId, altitude) {
  const p = PLANETS[planetId];
  return { altitude, speed: Math.sqrt((p.g * p.radius ** 2) / (p.radius + altitude)), flightPathDeg: 0 };
}

// Make sure a controller fits the state we are entering (debug jumps can enter any state directly).
function controllerFor(state) {
  const fc = mission.fc;
  if (state === 'LAUNCH') {
    astronaut.reset();
    mission.fuelForMars = null;
    return newController('earth', STARTS.earthPad);
  }
  if (state === 'ORBIT') {
    if (fc && mission.planetId === 'earth' && !fc.failed && fc.phase === 'orbit') return fc;
    return newController('earth', circularOrbitStart('earth', 200000));
  }
  const marsFuel = mission.fuelForMars ?? getShip().stats.fuelMass * 0.25;
  if (state === 'ENTRY') return newController('mars', STARTS.marsEntry, marsFuel);
  // LANDING: keep the Mars controller from ENTRY, or the landed one when coming back to the seat.
  if (fc && mission.planetId === 'mars' && !fc.failed) return fc;
  return newController('mars', STARTS.marsLanding, marsFuel);
}

// ---------- views ----------
function buildSpaceView(planetId) {
  const scene = createSpaceScene();
  graphics.setSunDirection(new THREE.Vector3(0.7, 0.45, 0.55));
  const sunLight = new THREE.DirectionalLight(0xfff4e6, 3);
  sunLight.position.set(0.7, 0.45, 0.55);
  scene.add(sunLight, new THREE.AmbientLight(0x8ea4c8, 0.25));
  const planet = assets.get(`planet:${planetId}`);
  planet.scale.setScalar(PLANETS[planetId].radius);
  scene.add(planet);

  const rig = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(65, 1, 0.05, 1e10);
  const cockpit = assets.get('cockpit');
  const plasma = assets.get('vfx:entryPlasma');
  cockpit.add(plasma);
  rig.add(cockpit, camera);
  scene.add(rig);

  // rocket for the chase camera (Role 3 parts stacked on the axis; local +Y = nose, same as the physics)
  const rocket = new THREE.Group();
  let y = 0;
  for (const id of ['engine_m', 'tank_l', 'tank_l', 'capsule_m']) {
    const part = assets.get(`rocketPart:${id}`);
    part.position.y = y;
    y += part.userData.height ?? 3;
    rocket.add(part);
  }
  const flame = assets.get('vfx:engineFlame');
  const exhaust = assets.get('vfx:exhaust');
  rocket.add(flame, exhaust);
  rocket.position.y = -(y - 1);
  const rocketRoot = new THREE.Group();
  rocketRoot.add(rocket);
  scene.add(rocketRoot);
  return { scene, camera, planet, rig, cockpit, plasma, flame, exhaust, rocketRoot };
}

function buildSurfaceView(fc) {
  const { scene } = createMarsScene({ sunElevation: 26 });
  const camera = new THREE.PerspectiveCamera(65, 1, 0.05, 2e5);
  const rig = new THREE.Group();
  rig.add(assets.get('cockpit'), camera);
  const dust = assets.get('vfx:landingDust');
  scene.add(rig, dust);
  // tangent frame at the point under the ship when this view starts: east = +X, north = −Z, up = +Y
  const up = v3(fc.up);
  const east = v3(fc.vel).projectOnPlane(up).normalize();
  if (east.lengthSq() < 0.5) east.set(1, 0, 0).projectOnPlane(up).normalize();
  const north = new THREE.Vector3().crossVectors(east, up);
  const toLocal = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, up, north.clone().negate()).invert());
  return { scene, camera, rig, dust, origin: up.clone().multiplyScalar(fc.planet.radius), east, north, toLocal };
}

// ---------- transfer burn (ORBIT → CRUISE) ----------
function transferBurn() {
  const fc = mission.fc;
  if (!fc || fc.failed) return;
  const dv = (economy.balance.deltaVKmS?.transfer ?? 2.1) * 1000;
  const ve = fc.ship.ispVac * fc.g0;
  const mAfter = fc.mass / Math.exp(dv / ve); // rocket equation: m1 = m0 / e^(Δv / ve)
  const fuelAfter = mAfter - fc.ship.dryMass;
  if (fuelAfter < 0) {
    events.emit('flight:failed', {
      endingId: 'adrift',
      cause: `The transfer burn needed ${fmt(dv)} m/s but the ship only had ${fmt(fc.deltaVLeft())} m/s left, so it drifts between the planets.`,
      causeId: 'transfer_short',
    });
    return;
  }
  mission.fuelForMars = fuelAfter;
  requestState('CRUISE');
}

// ---------- module ----------
export default {
  enter(state) {
    const fc = controllerFor(state);
    const view = buildSpaceView(fc.planetId);
    s = {
      state, fc, view, surface: null, mode: null,
      look: { yaw: 0, pitch: 0 }, chase: false, warp: 1, assist: true,
      sinceTelemetry: 0, engineSound: false, done: false,
    };
    const hudLayer = document.createElement('div');
    hudLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    ui.mount(hudLayer, { layer: 'hud' });
    s.hud = createFlightHUD({ parent: hudLayer });
    s.controls = createCockpitControls({
      input,
      onToggleAssist: () => { s.assist = !s.assist; },
      isLanded: () => fc.landed,
      onStandUp: () => requestState('INTERIOR'),
    });
    input.onPress('KeyC', () => { s.chase = !s.chase; });
    input.onPress('Period', () => { s.warp = Math.min(100, s.warp * 10); });
    input.onPress('Comma', () => { s.warp = Math.max(1, s.warp / 10); });
    input.onPress('KeyB', () => fc.setObstacles(createDebrisField({ fc, seed: Math.floor(Math.random() * 1e6) })));
    if (state === 'ORBIT') input.onPress('KeyT', transferBurn);
    s.lockOnClick = () => input.lockPointer();
    window.addEventListener('click', s.lockOnClick);

    fc.onNotice = (type) => {
      if (type === 'debris_hit' || type === 'parachute' || type === 'fairing_sep') audio.play('impact.small');
      if (['maxq_warning', 'g_high', 'heat_warning', 'engine_hot'].includes(type)) audio.play('alarm.master');
    };
    events.emit('flight:phase', { phase: fc.phase });

    // Dev shortcuts panel (also what check:boot looks for). Remove before the demo build.
    const next = { LAUNCH: ['Skip to orbit', 'ORBIT'], ORBIT: ['Transfer burn', null], ENTRY: ['Skip to landing', 'LANDING'], LANDING: ['Skip to cabin', 'INTERIOR'] }[state];
    stubScreen({
      title: `Flight · ${state}`,
      owner: 'Role 2 (Flight)',
      notes: state === 'ORBIT' ? 'In orbit. Press T for the transfer burn to Mars.' : 'Real physics. Dev shortcut below.',
      actions: [{ label: next[0], key: 'Enter', onClick: () => (next[1] ? requestState(next[1]) : transferBurn()) }],
    });
  },

  update(dt, state) {
    if (!s) return;
    const { fc, view } = s;
    const mouse = input.mouseDelta();
    s.look.yaw = s.look.yaw - mouse.x * 0.002;
    s.look.pitch = Math.max(-1.2, Math.min(1.2, s.look.pitch - mouse.y * 0.002));

    s.controls.poll();
    fc.update(dt, s.controls.input, { timeWarp: s.warp });
    s.controls.endFrame();
    const t = fc.telemetry;
    const a = assistReadout(fc);
    const air = pressureRatio(fc.planet, t.altitude);
    astronaut.body.update(dt, { env: fc.planetId === 'earth' ? (t.altitude > 100000 ? 'earth_orbit' : 'earth') : 'mars_orbit', gLoad: t.gLoad });

    // automatic state moves
    if (!s.done && !fc.failed) {
      if (state === 'LAUNCH' && t.phase === 'orbit') { s.done = true; requestState('ORBIT'); return; }
      if (state === 'ENTRY' && t.altitude < LOW_MARS_ALTITUDE) { s.done = true; requestState('LANDING'); return; }
    }

    // camera + views
    const shipQ = new THREE.Quaternion(fc.orient.x, fc.orient.y, fc.orient.z, fc.orient.w);
    const lookQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(s.look.pitch, s.look.yaw, 0, 'YXZ'));
    const lowMars = fc.planetId === 'mars' && t.altitude < LOW_MARS_ALTITUDE;
    if (lowMars) {
      s.surface ??= buildSurfaceView(fc);
      const sv = s.surface;
      const d = v3(fc.pos).sub(sv.origin);
      const x = d.dot(sv.east), z = -d.dot(sv.north);
      const ground = getTerrainHeight(x, z);
      sv.rig.position.set(x, t.altitude + ground + 1.6, z);
      sv.rig.quaternion.copy(sv.toLocal).multiply(shipQ).multiply(toCockpit);
      sv.camera.quaternion.copy(lookQ);
      sv.dust.position.set(x, ground, z);
      sv.dust.userData.set({ intensity: t.thrust > 0 ? Math.max(0, 1 - t.altitude / 40) : 0 });
      if (s.mode !== 'surface') { s.mode = 'surface'; graphics.setView(sv.scene, sv.camera); }
    } else {
      view.planet.position.set(-fc.pos.x, -fc.pos.y, -fc.pos.z);
      view.rocketRoot.quaternion.copy(shipQ);
      view.rocketRoot.visible = s.chase;
      view.cockpit.visible = !s.chase;
      if (s.chase) {
        view.rig.quaternion.identity();
        const up = v3(fc.up);
        view.camera.position.copy(v3(fc.forward).multiplyScalar(-45)).addScaledVector(up, 12);
        view.camera.up.copy(up);
        view.camera.lookAt(0, 0, 0);
      } else {
        view.rig.quaternion.copy(shipQ).multiply(toCockpit);
        view.camera.position.set(0, 0, 0);
        view.camera.up.set(0, 1, 0);
        view.camera.quaternion.copy(lookQ);
      }
      if (s.mode !== 'space') { s.mode = 'space'; graphics.setView(view.scene, view.camera); }
    }

    // VFX, screen effects, sound
    const heatFrac = t.heatLimit ? t.heatFlux / t.heatLimit : 0;
    const throttle = t.thrust > 0 ? fc.throttle : 0;
    view.plasma.userData.set({ intensity: Math.min(1, heatFrac * 1.4) });
    view.flame.userData.set({ throttle, airDensity: air });
    view.exhaust.userData.set({ throttle, airDensity: air });
    graphics.setEffects({
      vignette: Math.max(0, Math.min(1, (t.gLoad - 3.5) / 3)),
      shake: Math.min(1, (throttle > 0 ? 0.15 + 0.35 * throttle * (0.3 + air) : 0) + (t.dynamicPressure / t.maxQ) * 0.5 + heatFrac * 0.4),
    });
    audio.setAir(air);
    const burning = t.thrust > 0;
    if (burning !== s.engineSound) {
      s.engineSound = burning;
      if (burning) audio.play('engine.rumble', { loop: true });
      else audio.stop('engine.rumble');
    }

    // black box (contract flight:telemetry, about twice per second)
    s.sinceTelemetry += dt;
    if (s.sinceTelemetry >= TELEMETRY_EVERY) {
      s.sinceTelemetry = 0;
      events.emit('flight:telemetry', {
        t: fc.t, phase: t.phase, altitude: t.altitude, speed: t.speed, gForce: t.gLoad, q: t.dynamicPressure,
        fuelKg: t.fuel, engineTemp: t.engineTemp, radiationMsv: astronaut.body.doseMSv,
      });
    }

    // HUD (Codex's flight HUD) + prograde/retrograde markers projected from the active camera
    if (fc.landed) a.warnings.push({ level: 'amber', text: 'LANDED: press E to stand up' });
    if (state === 'ORBIT' && t.phase === 'orbit') a.warnings.push({ level: 'amber', text: `IN ORBIT: press T for the transfer burn (${fmt((economy.balance.deltaVKmS?.transfer ?? 2.1) * 1000)} m/s)` });
    s.hud.update(t, a, s.assist);
    const cam = s.mode === 'surface' ? s.surface.camera : view.camera;
    const project = (dir) => {
      if (!dir || !s.assist) return null;
      const world = new THREE.Vector3();
      cam.getWorldPosition(world);
      const p = world.add(v3(dir).multiplyScalar(1000)).project(cam);
      return p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1 ? { x: (p.x + 1) * 50, y: (1 - p.y) * 50 } : null;
    };
    const toLocal = (d) => (d && s.mode === 'surface' ? v3(d).applyQuaternion(s.surface.toLocal) : d);
    s.hud.marker('pro', project(toLocal(a.prograde)));
    s.hud.marker('retro', project(toLocal(a.retrograde)));
  },

  exit() {
    if (!s) return;
    s.controls.dispose();
    window.removeEventListener('click', s.lockOnClick);
    graphics.setEffects({ vignette: 0, shake: 0 });
    audio.stop('engine.rumble');
    if (mission.fc) mission.fc.onNotice = null;
    s = null;
  },
};
