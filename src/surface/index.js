// STUB: Role 2 replaces this. Keep every export listed in contract.js (PUBLIC_EXPORTS).
import * as THREE from 'three';
import { assets, createMarsScene, getTerrainHeight, graphics } from '/src/graphics/index.js';
import { contract, events, input, requestState } from '/src/core/index.js';
import { stubScreen } from '/src/core/stubScreen.js';

const interactables = new Map();
let cabin = null;
let cabinModel = null;
let mars = null;
let oxygen = 100;
let sinceOxygen = 0;

/** Register something the player can use with E: { id, position, prompt, onUse }. Cleared on every state change. */
export function registerInteractable({ id, position, prompt, onUse }) {
  interactables.set(id, { id, position: new THREE.Vector3().copy(position), prompt, onUse });
}

function useNearest() {
  const eye = graphics.camera.position;
  let best = null;
  for (const item of interactables.values()) {
    if (!best || item.position.distanceTo(eye) < best.position.distanceTo(eye)) best = item;
  }
  best?.onUse();
}

export default {
  enter(state) {
    interactables.clear();
    input.onPress('KeyE', useNearest);

    if (state === 'INTERIOR') {
      if (!cabin) {
        cabin = new THREE.Scene();
        cabinModel = assets.get('cabin');
        cabin.add(cabinModel);
      }
      graphics.camera.position.set(0.2, 1.65, 3.2);
      graphics.camera.lookAt(-0.2, 1.3, -3);
      graphics.setView(cabin, graphics.camera);
      for (const stationId of contract.STATIONS) {
        const spot = cabinModel.userData.stations?.[stationId];
        registerInteractable({
          id: stationId,
          position: spot ?? new THREE.Vector3(0, 1, 0),
          prompt: `Use ${stationId}`,
          onUse: () => events.emit('interior:interact', { stationId }),
        });
      }
      stubScreen({
        title: 'Ship interior',
        owner: 'Role 2 (Surface)',
        notes: 'Press E to use the nearest station (a stub).',
        actions: [
          { label: 'Go outside', key: 'KeyO', onClick: () => requestState('SURFACE') },
          { label: 'Start return', key: 'KeyR', onClick: () => requestState('RETURN') },
        ],
      });
    } else {
      if (!mars) mars = createMarsScene().scene;
      oxygen = 100;
      sinceOxygen = 0;
      graphics.camera.position.set(8, getTerrainHeight(8, 6) + 1.7, 6);
      graphics.camera.lookAt(0, getTerrainHeight(0, 0) + 2, 0);
      graphics.setView(mars, graphics.camera);
      stubScreen({
        title: 'Mars surface',
        owner: 'Role 2 (Surface)',
        notes: 'Oxygen drains slowly while you are outside.',
        actions: [{ label: 'Back in', key: 'KeyO', onClick: () => requestState('INTERIOR') }],
      });
    }
  },

  update(dt, state) {
    if (state !== 'SURFACE') return;
    oxygen = Math.max(0, oxygen - dt * 0.5);
    sinceOxygen += dt;
    if (sinceOxygen >= 0.5) {
      sinceOxygen = 0;
      events.emit('eva:oxygen', { percent: oxygen });
    }
  },
};
