// STUB: Role 4 replaces this. Keep every export listed in contract.js (PUBLIC_EXPORTS).
import * as THREE from 'three';
import { assets, createSpaceScene, graphics } from '/src/graphics/index.js';
import { PLANETS, requestState } from '/src/core/index.js';
import { stubScreen } from '/src/core/stubScreen.js';

let scene = null;
// Our own camera: graphics.camera is whatever the last state left. graphics.setView sets its aspect.
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1e10);
let days = 0;
let counter = null;

export default {
  enter() {
    if (!scene) {
      scene = createSpaceScene();
      const mars = assets.get('planet:mars');
      mars.scale.setScalar(PLANETS.mars.radius);
      mars.position.set(-0.6, -0.3, -1).normalize().multiplyScalar(PLANETS.mars.radius * 6);
      scene.add(mars);
    }
    graphics.setSunDirection(new THREE.Vector3(0.7, 0.3, 0.4));
    camera.position.set(0, 0, 0);
    camera.lookAt(-0.5, -0.2, -1);
    graphics.setView(scene, camera);

    days = 0;
    counter = document.createElement('div');
    counter.className = 'hud-value';
    stubScreen({
      title: 'Cruise to Mars',
      owner: 'Role 4 (Cruise)',
      notes: 'Time passes on its own. Next skips to Mars entry.',
      extra: counter,
      actions: [{ label: 'Next', key: 'Enter', onClick: () => requestState('ENTRY') }],
    });
  },

  update(dt) {
    days += dt * 10;
    if (counter) counter.textContent = `Day ${Math.floor(days)}`;
  },
};
