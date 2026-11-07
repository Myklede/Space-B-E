// STUB: Role 4 replaces this. Keep every export listed in contract.js (PUBLIC_EXPORTS).
import * as THREE from 'three';
import { assets, createSpaceScene, graphics } from '/src/graphics/index.js';
import { PLANETS, contract, events, requestState } from '/src/core/index.js';
import { stubScreen } from '/src/core/stubScreen.js';

let counts = {};
let peaks = {};
let log = [];
let scene = null;
// Our own camera: graphics.camera is whatever the last state left. graphics.setView sets its aspect.
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1e10);

function reset() {
  counts = {};
  peaks = {};
  log = [];
}

function record(name, payload) {
  counts[name] = (counts[name] ?? 0) + 1;
  log.push({ name, payload });
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (typeof value === 'number') peaks[key] = Math.max(peaks[key] ?? -Infinity, value);
  }
}

/** The black box so far: { counts, peaks, log }. */
export function getReport() {
  return { counts: { ...counts }, peaks: { ...peaks }, log: [...log] };
}

export default {
  init() {
    // events.js has no wildcards, so subscribe to every flight:*, eva:* and interior:* name from the contract.
    for (const name of Object.keys(contract.EVENTS)) {
      if (/^(flight|eva|interior):/.test(name)) events.on(name, (payload) => record(name, payload));
    }
    events.on('ship:built', reset);
  },

  enter() {
    if (!scene) {
      scene = createSpaceScene();
      const earth = assets.get('planet:earth');
      earth.scale.setScalar(PLANETS.earth.radius);
      earth.position.set(0, -0.6, -0.8).normalize().multiplyScalar(PLANETS.earth.radius + 400e3);
      scene.add(earth);
    }
    graphics.setSunDirection(new THREE.Vector3(0.86, 0.36, -0.36));
    camera.position.set(0, 0, 0);
    camera.lookAt(0, -0.3, -1);
    graphics.setView(scene, camera);

    const lines = [
      ...Object.entries(counts).map(([name, n]) => `${name}: ${n}`),
      ...Object.entries(peaks).map(([key, value]) => `peak ${key}: ${Math.round(value * 100) / 100}`),
    ];
    stubScreen({
      title: 'Flight Report',
      owner: 'Role 4 (Report)',
      notes: lines.length ? lines : 'Nothing recorded yet.',
      actions: [{ label: 'Back to hangar', key: 'Enter', onClick: () => requestState('HANGAR') }],
    });
  },
};
