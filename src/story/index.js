// STUB: Role 4 replaces this. Keep every export listed in contract.js (PUBLIC_EXPORTS).
import * as THREE from 'three';
import { assets, createSpaceScene, graphics } from '/src/graphics/index.js';
import { PLANETS, contract, economy, events, getShip, getState, requestState, save } from '/src/core/index.js';
import { stubScreen } from '/src/core/stubScreen.js';

const LESSONS = {
  coldMorning: 'challenger', theFoam: 'columbia', pureOxygen: 'apollo1', successfulFailure: 'apollo13',
  silentReturn: 'soyuz11', unitError: 'marsClimateOrbiter', falseTouchdown: 'marsPolarLander', spin: 'gemini8', beagle: 'beagle2',
};

let ending = { endingId: 'homecoming', cause: '', cost: 0, historyLessonId: null };
let scene = null;
let cockpit = null;
// Our own camera: graphics.camera is whatever the last state left (parented, tilted, another field of view).
// graphics.setView sets its aspect.
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1e10);

function earthView(state) {
  if (!scene) {
    scene = createSpaceScene();
    const earth = assets.get('planet:earth');
    const elevation = THREE.MathUtils.degToRad(-40);
    earth.scale.setScalar(PLANETS.earth.radius);
    earth.position.set(0, Math.sin(elevation), -Math.cos(elevation)).multiplyScalar(PLANETS.earth.radius + 170e3);
    cockpit = assets.get('cockpit');
    scene.add(earth, cockpit);
  }
  // The ending is a quiet view of Earth, not a cockpit the player may have just lost.
  cockpit.visible = state !== 'ENDING';
  graphics.setSunDirection(new THREE.Vector3(0.86, 0.36, -0.36));
  camera.position.set(0, 0, 0);
  camera.lookAt(0, -0.2, -1);
  graphics.setView(scene, camera);
}

/** Bankrupt is declared by the builder below balance.insolvencyFloor, or happens when money goes below $0. */
const isBankruptEnding = () => ending.endingId === contract.ENDINGS.bankrupt || economy.isBankrupt();

export default {
  init() {
    events.on('ending:show', (payload) => {
      ending = payload;
    });
    // Any module may emit flight:failed. Story charges the penalty and shows the ending.
    events.on('flight:failed', ({ endingId, cause }) => {
      if (getState() === 'ENDING') return;
      const cost = economy.chargeFailure(getShip().stats.cost);
      events.emit('ending:show', { endingId, cause, cost, historyLessonId: LESSONS[endingId] ?? null });
      requestState('ENDING');
    });
  },

  enter(state) {
    earthView(state);
    if (state === 'PRELAUNCH') {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Message home';
      input.style.cssText = 'width:100%;box-sizing:border-box;font:inherit;padding:6px';
      input.addEventListener('input', () => save.update({ messageHome: input.value }));
      stubScreen({
        title: 'Pre-launch',
        owner: 'Role 4 (Story)',
        notes: 'Write a message home.',
        extra: input,
        actions: [{ label: 'Launch', key: 'Enter', onClick: () => requestState('LAUNCH') }],
      });
    } else if (state === 'RETURN') {
      stubScreen({
        title: 'Return to Earth',
        owner: 'Role 4 (Story)',
        notes: 'Automatic return cinematic goes here.',
        actions: [
          {
            label: 'Arrive home',
            key: 'Enter',
            onClick: () => {
              economy.reward(economy.balance.homecomingBonus, 'homecoming');
              events.emit('ending:show', { endingId: contract.ENDINGS.homecoming, cause: 'Mission complete', cost: 0, historyLessonId: null });
              requestState('ENDING');
            },
          },
        ],
      });
    } else {
      const bankrupt = isBankruptEnding();
      stubScreen({
        title: `Ending: ${ending.endingId}`,
        owner: 'Role 4 (Story)',
        notes: [
          `What went wrong: ${ending.cause || 'nothing, you made it home'}`,
          `Cost charged: $${Math.round(ending.cost).toLocaleString('en-US')}`,
          `Lesson from history: ${ending.historyLessonId ?? 'none'}`,
          bankrupt ? 'Bankrupt: the agency is sold. Money resets.' : `Money: $${Math.round(economy.getMoney()).toLocaleString('en-US')}`,
        ],
        actions: [
          {
            label: 'Continue',
            key: 'Enter',
            onClick: () => {
              // Spec §3: Bankrupt means a full reset to the starting money, even when declared above $0.
              if (bankrupt) {
                economy.reset();
                requestState('HANGAR');
              } else {
                requestState('REPORT');
              }
            },
          },
        ],
      });
    }
  },
};
