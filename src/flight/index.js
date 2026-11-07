// STUB: Role 2 replaces this. Keep every export listed in contract.js (PUBLIC_EXPORTS).
import * as THREE from 'three';
import { assets, createSpaceScene, graphics } from '/src/graphics/index.js';
import { PLANETS, events, getShip, getState, requestState } from '/src/core/index.js';
import { stubScreen } from '/src/core/stubScreen.js';

const NEXT = { LAUNCH: 'ORBIT', ORBIT: 'CRUISE', ENTRY: 'LANDING', LANDING: 'INTERIOR' };
const FLIGHT_STATES = new Set(['LAUNCH', 'ORBIT', 'ENTRY', 'LANDING']);

/** Stub of the flight physics controller. Role 2 replaces it with the real one. */
export class FlightController {
  running = false;
  t = 0;
  ship = null;

  start(shipSpec) {
    this.ship = shipSpec;
    this.t = 0;
    this.running = true;
  }

  update(dt) {
    if (this.running) this.t += dt;
  }

  stop() {
    this.running = false;
  }
}

const controller = new FlightController();
const scenes = {};
let sinceTelemetry = 0;

function viewOf(planetName) {
  if (scenes[planetName]) return scenes[planetName];
  const planet = PLANETS[planetName];
  const scene = createSpaceScene();
  const body = assets.get(`planet:${planetName}`);
  const elevation = THREE.MathUtils.degToRad(-40);
  body.scale.setScalar(planet.radius);
  body.position.set(0, Math.sin(elevation), -Math.cos(elevation)).multiplyScalar(planet.radius + 170e3);
  scene.add(body, assets.get('cockpit'));
  scenes[planetName] = scene;
  return scene;
}

export default {
  enter(state) {
    const scene = viewOf(state === 'LAUNCH' || state === 'ORBIT' ? 'earth' : 'mars');
    graphics.setSunDirection(new THREE.Vector3(0.86, 0.36, -0.36));
    graphics.camera.position.set(0, 0, 0);
    graphics.camera.lookAt(0, -0.2, -1);
    graphics.setView(scene, graphics.camera);

    if (!controller.running) controller.start(getShip());
    events.emit('flight:phase', { phase: state.toLowerCase() });
    sinceTelemetry = 0;

    stubScreen({
      title: `Flight: ${state}`,
      owner: 'Role 2 (Flight)',
      notes: 'Fake flight. Next moves along the loop, Fail ends the mission.',
      actions: [
        { label: 'Next', key: 'Enter', onClick: () => requestState(NEXT[state]) },
        {
          label: 'Fail',
          key: 'KeyF',
          onClick: () => events.emit('flight:failed', { endingId: 'burnup', cause: 'Stub flight failed on purpose.' }),
        },
      ],
    });
  },

  update(dt, state) {
    controller.update(dt);
    sinceTelemetry += dt;
    if (sinceTelemetry >= 0.5) {
      sinceTelemetry = 0;
      events.emit('flight:telemetry', {
        t: controller.t,
        phase: state.toLowerCase(),
        altitude: 1000 * controller.t,
        speed: 80 * controller.t,
        gForce: 1 + Math.abs(Math.sin(controller.t)) * 3,
        fuelKg: Math.max(0, 33000 - 200 * controller.t),
      });
    }
  },

  exit(state) {
    if (state === 'LANDING' && getState() === 'INTERIOR') events.emit('flight:landed', { touchdownSpeed: 2.1 });
    if (!FLIGHT_STATES.has(getState())) controller.stop();
  },
};
