// Role 2 surface module: owns INTERIOR (walkable cabin) and SURFACE (Mars EVA) (contract.js STATE_OWNERS).
// First-person walking with Mars gravity, suit O₂, cabin stations, airlock, Role 3's cabin and Mars terrain,
// and the suit HUD (helmet frame + life support panel).
//
//   INTERIOR  stations: pilotSeat (→ LANDING cockpit, or → RETURN when Mars Exploration is 100 %), suitLocker,
//             o2Station, commsConsole, sampleStorage, bunk, airlock (suit on → 3 s cycle → SURFACE).
//   SURFACE   walk Jezero; O₂ drains (30/15/5 % cautions, 0 % → flight:failed outOfBreath); the hatch → INTERIOR.
//
// registerInteractable({ id, position, prompt, onUse, hold?, radius?, state? }) is the README/contract API for
// Role 4's tasks. `state` ('SURFACE' or 'INTERIOR') limits where it can be used; positions are in that scene's
// metres (SURFACE: Role 3 terrain, landing site at the origin, y from getTerrainHeight). Returns an unregister function.
import * as THREE from 'three';
import { getTerrainHeight, graphics } from '/src/graphics/index.js';
import { audio } from '/src/audio/index.js';
import { PLANETS, events, getState, input, requestState, ui } from '/src/core/index.js';
import { stubScreen } from '/src/core/stubScreen.js';
import { getProgress } from '/src/missions/index.js';
import { WalkController } from './WalkController.js';
import { createInteractables } from './interactables.js';
import { createShipInterior, CABIN } from './shipInterior.js';
import { createSuitHUD } from './hud/createSuitHUD.js';
import { astronaut } from './astronaut.js';
import { getCabin, getMars, prepareScenes } from './scenes.js';

const TELEMETRY_EVERY = 0.5;
const LANDER_RADIUS = 3.2; // m, the lander's legs: you can't walk through them
const HATCH = { x: 0, z: 3.6 };
const MAX_MOUSE_STEP = 300; // px per frame: ignore the jump some browsers report right after pointer lock // where you climb back in (in front of the lander)

const registry = createInteractables();

export function registerInteractable(def) {
  const allowed = def.enabled;
  return registry.register({
    ...def,
    enabled: () => (!def.state || def.state === getState()) && (typeof allowed === 'function' ? allowed() : allowed !== false),
  });
}

// The hatch on the landed ship (always there on the surface).
registerInteractable({
  id: 'hatch', state: 'SURFACE', radius: 3, minFacing: 0.3, prompt: 'E: climb back into the airlock',
  position: { x: HATCH.x, y: getTerrainHeight(HATCH.x, HATCH.z) + 1.5, z: HATCH.z },
  onUse: () => requestState('INTERIOR'),
});

let s = null;
let previous = null; // the surface state we just left (to spawn inside the airlock when coming back in)

export default {
  init() {
    setTimeout(prepareScenes, 0); // build Mars + cabin in the background so entering them never freezes
  },

  enter(state) {
    const inside = state === 'INTERIOR';
    const camera = new THREE.PerspectiveCamera(70, 1, 0.03, 2e5);
    const hudLayer = document.createElement('div');
    hudLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    ui.mount(hudLayer, { layer: 'hud' });
    s = { state, inside, camera, cabin: null, sinceTelemetry: 0, hud: createSuitHUD({ parent: hudLayer }), offs: [] };

    if (inside) {
      const { scene, art } = getCabin();
      graphics.setView(scene, camera);
      // coming in from Mars: start just inside the airlock, facing the cabin
      const fromOutside = previous === 'SURFACE';
      s.walker = new WalkController({
        gravity: PLANETS.mars.g, bounds: CABIN.bounds, mode: 'cabin',
        start: fromOutside ? { x: 0, z: 3.0 } : CABIN.spawn, yaw: fromOutside ? 0 : CABIN.spawnYaw,
      });
      s.cabin = createShipInterior({
        bus: events, interactables: registry, oxygen: astronaut.oxygen,
        stations: art.userData.stations, props: art.userData.props,
        onSeat: () => requestState(getProgress().percent >= 100 ? 'RETURN' : 'LANDING'),
        onExit: () => requestState('SURFACE'),
        onNotice: (type, d) => {
          if (type === 'suit') astronaut.suited = d.suited;
          if (type === 'airlock') art.userData.setAlarm?.(d.stage === 'cycling');
          if (type === 'o2Empty') audio.play('ui.error');
        },
      });
      s.cabin.suited = astronaut.suited;
      audio.play('ambience.ship', { loop: true });
    } else {
      const mars = getMars();
      mars.lander.visible = true;
      graphics.setView(mars.scene, camera);
      astronaut.suited = true;
      s.walker = new WalkController({
        gravity: PLANETS.mars.g, getGroundHeight: getTerrainHeight, colliders: [{ x: 0, z: 0, r: LANDER_RADIUS }],
        mode: 'suit', start: { x: HATCH.x, z: HATCH.z + 2 }, yaw: Math.PI, // step out facing away from the ship
      });
      audio.play('ambience.mars', { loop: true });
      audio.play('suit.breath', { loop: true });
    }

    input.onPress('KeyE', () => registry.press());
    s.lockOnClick = () => input.lockPointer();
    window.addEventListener('click', s.lockOnClick);

    // Dev shortcuts panel (also what check:boot looks for). Remove before the demo build.
    stubScreen({
      title: inside ? 'Ship cabin' : 'Mars surface',
      owner: 'Role 2 (Surface)',
      notes: inside ? 'Walk with WASD, E to use stations. Suit up, then cycle the airlock.' : 'Watch your O₂. The hatch is in front of the lander.',
      actions: inside
        ? [{ label: 'Go outside', key: 'KeyO', onClick: () => requestState('SURFACE') }, { label: 'Start return', key: 'KeyR', onClick: () => requestState('RETURN') }]
        : [{ label: 'Back in', key: 'KeyO', onClick: () => requestState('INTERIOR') }],
    });
  },

  update(dt, state) {
    if (!s) return;
    const { walker, camera, inside } = s;
    const mouse = input.mouseDelta();
    if (Math.abs(mouse.x) < MAX_MOUSE_STEP && Math.abs(mouse.y) < MAX_MOUSE_STEP) walker.look(mouse.x, mouse.y);
    const k = input.isDown;
    walker.update(dt, {
      forward: (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0),
      right: (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0),
      run: k('ShiftLeft') || k('ShiftRight'),
      jump: k('Space'),
    });
    s.cabin?.update(dt);
    const oxygen = astronaut.oxygen;
    oxygen.update(dt, { inside, running: walker.running, suited: inside ? astronaut.suited : true });
    astronaut.body.update(dt, { env: inside ? 'cabin_mars' : 'mars', heartRate: walker.heartRate });
    const ui_ = registry.update(dt, walker.eye, walker.lookDir, k('KeyE'));

    // head bob: one bob per step; Mars steps are slower and floatier (step rate ∝ √g), suits bounce less
    const speed = walker.telemetry.speed;
    if (walker.onGround && speed > 0.2) s.stepPhase = (s.stepPhase ?? 0) + dt * speed * 2.2 * Math.sqrt(walker.gravity / PLANETS.earth.g);
    const bob = walker.onGround ? Math.sin((s.stepPhase ?? 0) * Math.PI) ** 2 * Math.min(1, speed / 2) * (inside ? 0.035 : 0.05) : 0;
    const eye = walker.eye;
    camera.position.set(eye.x, eye.y - bob, eye.z);
    camera.quaternion.setFromEuler(new THREE.Euler(walker.pitch, walker.yaw, 0, 'YXZ'));

    const level = inside ? 'ok' : oxygen.level;
    if (level !== s.lastLevel) {
      // alarm each time O₂ crosses into a worse caution level (30 / 15 / 5 %)
      if (['caution', 'warning', 'critical'].indexOf(level) > ['caution', 'warning', 'critical'].indexOf(s.lastLevel ?? 'ok')) audio.play('alarm.o2');
      s.lastLevel = level;
    }
    graphics.setEffects({ vignette: level === 'critical' ? 0.8 : level === 'warning' ? 0.4 : 0 });
    s.hud.update(dt, {
      telemetry: walker.telemetry, oxygen, suited: inside ? astronaut.suited : true, inside,
      focused: ui_.focused, yaw: walker.yaw, shipPosition: { x: HATCH.x, z: HATCH.z },
      bodyStats: astronaut.body.snapshot(), airlockProgress: s.cabin?.airlockProgress ?? 0,
    });

    s.sinceTelemetry += dt;
    if (s.sinceTelemetry >= TELEMETRY_EVERY) {
      s.sinceTelemetry = 0;
      events.emit('flight:telemetry', {
        t: performance.now() / 1000, phase: inside ? 'interior' : 'eva', o2Percent: oxygen.percent,
        heartRate: Math.round(walker.heartRate), radiationMsv: astronaut.body.doseMSv,
      });
    }
  },

  exit() {
    if (!s) return;
    previous = s.state;
    s.cabin?.dispose();
    s.hud.dispose();
    window.removeEventListener('click', s.lockOnClick);
    graphics.setEffects({ vignette: 0 });
    audio.stop('ambience.ship');
    audio.stop('ambience.mars');
    audio.stop('suit.breath');
    s = null;
  },
};
