// STUB: Role 1 replaces this. MENU state screen, used by src/builder/index.js.
import * as THREE from 'three';
import { assets, createSpaceScene, graphics } from '/src/graphics/index.js';
import { PLANETS, contract, requestState, save } from '/src/core/index.js';
import { stubScreen } from '/src/core/stubScreen.js';

let scene = null;
let earth = null;

function buildScene() {
  scene = createSpaceScene();
  earth = assets.get('planet:earth');
  earth.scale.setScalar(PLANETS.earth.radius);
  earth.position.set(0, -0.6, -0.8).normalize().multiplyScalar(PLANETS.earth.radius + 400e3);
  scene.add(earth);
  graphics.setSunDirection(new THREE.Vector3(0.86, 0.36, -0.36));
}

export const menu = {
  enter() {
    if (!scene) buildScene();
    graphics.camera.position.set(0, 0, 0);
    graphics.camera.lookAt(0, -0.3, -1);
    graphics.setView(scene, graphics.camera);

    const settings = save.load();
    const extra = document.createElement('div');
    extra.style.cssText = 'display:grid;gap:8px';

    if (!settings.warningSeen) {
      const warning = document.createElement('div');
      warning.className = 'hud-caution';
      warning.textContent = 'Content warning: this game shows spaceflight accidents and the deaths of astronauts, including real events.';
      extra.append(warning);
      save.update({ warningSeen: true });
    }

    const row = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !!settings.skipSensitive;
    box.addEventListener('change', () => save.update({ skipSensitive: box.checked }));
    row.append(box, ' Skip sensitive scenes');
    extra.append(row);

    stubScreen({
      title: contract.GAME_TITLE,
      owner: 'Role 1 (Builder, main menu)',
      notes: 'Main menu placeholder.',
      extra,
      actions: [{ label: 'Start', key: 'Enter', onClick: () => requestState('HANGAR') }],
    });
  },
};
