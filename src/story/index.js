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

function earthView() {
  if (!scene) {
    scene = createSpaceScene();
    const earth = assets.get('planet:earth');
    const elevation = THREE.MathUtils.degToRad(-40);
    earth.scale.setScalar(PLANETS.earth.radius);
    earth.position.set(0, Math.sin(elevation), -Math.cos(elevation)).multiplyScalar(PLANETS.earth.radius + 170e3);
    scene.add(earth, assets.get('cockpit'));
  }
  graphics.setSunDirection(new THREE.Vector3(0.86, 0.36, -0.36));
  graphics.camera.position.set(0, 0, 0);
  graphics.camera.lookAt(0, -0.2, -1);
  graphics.setView(scene, graphics.camera);
}

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
    earthView();
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
      const bankrupt = economy.isBankrupt();
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
              if (economy.isBankrupt()) {
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
