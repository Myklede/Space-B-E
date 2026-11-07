// STUB: Role 1 replaces this. Keep every export listed in contract.js (PUBLIC_EXPORTS).
import * as THREE from 'three';
import { assets, graphics } from '/src/graphics/index.js';
import { economy, events, getShip, requestState, setShip } from '/src/core/index.js';
import { stubScreen } from '/src/core/stubScreen.js';
import { menu } from './menu.js';
import reliable from '/src/core/mocks/ship.reliable.json';
import coldMorning from '/src/core/mocks/ship.coldMorning.json';
import thinSkin from '/src/core/mocks/ship.thinSkin.json';

const PRESETS = [reliable, coldMorning, thinSkin];
let selected = 0;
let scene = null;

function hangarScene() {
  if (scene) return scene;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080c);
  const lander = assets.get('lander');
  lander.position.set(0, 0, 0);
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.6);
  sun.position.set(6, 8, 5);
  scene.add(lander, sun, new THREE.AmbientLight(0x8ea4c8, 0.4));
  return scene;
}

function money(value) {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function blocksOf(ship) {
  const blocks = [];
  if (!ship.parts.some((part) => part.type.startsWith('capsule'))) blocks.push('NO_CAPSULE');
  if (!ship.engines.length) blocks.push('NO_ENGINE');
  if (!(ship.stats.fuelMass > 0)) blocks.push('NO_FUEL');
  if (economy.isBankrupt()) blocks.push('OVER_BUDGET');
  return blocks;
}

function lookAtLander() {
  graphics.camera.position.set(12, 9, 26);
  graphics.camera.lookAt(0, 8, 0);
  graphics.setView(hangarScene(), graphics.camera);
}

export default {
  init() {
    events.on('builder:highlightPart', ({ partId }) => console.log(`[builder stub] highlight part ${partId}`));
  },

  enter(state) {
    if (state === 'MENU') return menu.enter();
    lookAtLander();
    if (state === 'HANGAR') {
      const choose = (index) => {
        selected = index;
        info.textContent = describe();
      };
      const describe = () => `Selected: ${PRESETS[selected].name}, cost ${money(PRESETS[selected].stats.cost)}. Money: ${money(economy.getMoney())}`;
      const info = document.createElement('div');
      info.textContent = describe();
      stubScreen({
        title: 'Hangar',
        owner: 'Role 1 (Builder)',
        notes: 'Pick a preset ship, then confirm to pay for it.',
        extra: info,
        actions: [
          ...PRESETS.map((ship, index) => ({ label: ship.name, key: `Digit${index + 1}`, onClick: () => choose(index) })),
          {
            label: 'Confirm',
            key: 'Enter',
            onClick: () => {
              const ship = PRESETS[selected];
              economy.spend(ship.stats.cost, 'ship');
              setShip(ship);
              events.emit('ship:built', { shipSpec: ship });
              requestState('GONOGO');
            },
          },
        ],
      });
    } else {
      const ship = getShip();
      const warnings = ship.warnings ?? [];
      const blocks = blocksOf(ship);
      const lines = [`Ship: ${ship.name}`, `Hard blocks: ${blocks.join(', ') || 'none'}`, `Warnings: ${warnings.join(', ') || 'none'}`];
      stubScreen({
        title: 'Go / No-Go',
        owner: 'Role 1 (Builder)',
        notes: lines,
        actions: [
          { label: 'Go', key: 'Enter', onClick: () => { if (!blocks.length) requestState('PRELAUNCH'); } },
          { label: 'Back', key: 'KeyB', onClick: () => requestState('HANGAR') },
        ],
      });
    }
  },
};
