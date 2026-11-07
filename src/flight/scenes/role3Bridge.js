// Import only Role 3's documented public entrypoints. Core supplies bus/planets/ShipSpec.
import * as THREE from 'three';
import { graphics, assets, createSpaceScene, createMarsScene, getTerrainHeight } from '../../graphics/index.js';
import { audio } from '../../audio/index.js';
import { createLaunchScene } from './createLaunchScene.js';
import { createWalkScene } from '../../surface/scenes/createWalkScene.js';

// Role 3 gives a new Object3D per get(). Dispose instance resources while preserving
// shared downloaded maps/PMREM textures. The renderer/composer belong to Role 3.
function visualLifetime() {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const instances = new Set();
  const lights = new Set();
  const track = root => {
    // Snapshot immediately, before gameplay attaches its own separately owned objects.
    root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.isInstancedMesh) instances.add(object);
      if (object.shadow) lights.add(object);
      for (const material of [].concat(object.material ?? [])) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isCanvasTexture) textures.add(value);
      }
    });
    return root;
  };
  return {
    track,
    get: name => track(assets.get(name)),
    dispose() {
      for (const object of instances) object.dispose();
      for (const light of lights) light.shadow.map?.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      geometries.clear(); materials.clear(); textures.clear(); instances.clear(); lights.clear();
    },
  };
}

function rocketModel(lifetime) {
  const rocket = new THREE.Group();
  let height = 0;
  // Mock ship presentation until the builder's final ShipSpec part mapping arrives.
  for (const id of ['engine_m', 'tank_m', 'tank_m', 'capsule_m']) {
    const part = lifetime.get(`rocketPart:${id}`);
    part.position.y = height;
    height += part.userData.height ?? 0;
    rocket.add(part);
  }
  return rocket;
}

// Call once during loading before creating a flight view (keeps maps off the hot path).
export const preloadFlightArt = () => assets.preload(['planet:earth', 'planet:mars']);

export function createIntegratedFlightScene(options) {
  const { parent = document.body } = options;
  graphics.init({ container: parent, quality: options.quality ?? 'high' });
  const lifetime = visualLifetime();
  const scene = lifetime.track(createSpaceScene());
  const flame = lifetime.get('vfx:engineFlame');
  const exhaust = lifetime.get('vfx:exhaust');
  const plasma = lifetime.get('vfx:entryPlasma');
  const dust = lifetime.get('vfx:landingDust');
  let view;
  let engineOn = false;
  let disposed = false;
  const renderFrame = dt => {
    const fc = view.controller;
    const t = fc.telemetry;
    const air = Math.min(1, t.airDensity / fc.planet.seaLevelDensity);
    const throttle = t.thrust > 0 ? Math.max(t.throttle, 0.01) : 0;
    flame.userData.set({ throttle, airDensity: air, fuel: options.shipSpec.engines?.[0]?.fuel ?? 'methalox' });
    exhaust.userData.set({ throttle, airDensity: air });
    plasma.userData.set({ intensity: Math.min(1, t.heatFlux / Math.max(1, t.heatLimit)) });
    dust.userData.set({ intensity: throttle * Math.max(0, 1 - t.altitude / 80) });
    dust.position.set(-fc.up.x * t.altitude, -fc.up.y * t.altitude, -fc.up.z * t.altitude);
    dust.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(fc.up.x, fc.up.y, fc.up.z));
    view.cockpit.userData.setAlarm?.(t.dynamicPressure > t.maxQ * 0.8 || t.gLoad > 4 || !!t.collisionWarning);
    audio.setAir(air);
    const firing = t.thrust > 0 && !t.failed;
    if (firing !== engineOn) {
      engineOn = firing;
      if (firing) audio.play('engine.rumble', { loop: true, volume: 0.35 });
      else audio.stop('engine.rumble');
    }
    graphics.setEffects({ vignette: Math.min(1, Math.max(0, (t.gLoad - 3.5) / 4)), blackout: 0, shake: 0 });
    graphics.render(dt);
  };
  view = createLaunchScene({
    ...options,
    renderer: graphics.renderer,
    scene,
    renderFrame,
    getModel: name => name === 'rocket' ? rocketModel(lifetime) : lifetime.get(name),
  });
  // Rocket model is +Y up; cockpit art is already eye-centred, facing camera -Z.
  view.ship.add(flame, exhaust);
  view.cockpit.add(plasma);
  scene.add(dust);
  graphics.setSunDirection(new THREE.Vector3(-1, 0.5, 0.3).normalize());
  graphics.setView(scene, view.camera);
  audio.play('ambience.ship', { loop: true });
  const dispose = view.dispose;
  view.dispose = () => {
    if (disposed) return;
    disposed = true;
    lifetime.dispose();
    dispose();
    audio.stop('engine.rumble');
    audio.stop('ambience.ship');
    graphics.setEffects({ vignette: 0, blackout: 0, shake: 0 });
  };
  return view;
}

export function createIntegratedWalkScene(options) {
  const { parent = document.body, kind = 'cabin' } = options;
  graphics.init({ container: parent, quality: options.quality ?? 'high' });
  const lifetime = visualLifetime();
  const scene = lifetime.track(kind === 'eva' ? createMarsScene().scene : new THREE.Scene());
  let view;
  let alarmTimer = 0;
  let breathing = false;
  let disposed = false;
  const renderFrame = dt => {
    const low = kind === 'eva' && ['warning', 'critical'].includes(view.oxygen.level);
    const suited = kind === 'eva' || view.cabin.suited;
    if (suited !== breathing) {
      breathing = suited;
      if (suited) audio.play('suit.breath', { loop: true, volume: low ? 0.8 : 0.4 });
      else audio.stop('suit.breath');
    }
    alarmTimer -= dt;
    if (low && alarmTimer <= 0 && !view.oxygen.depleted) {
      audio.play('alarm.o2', { volume: 0.5 });
      alarmTimer = 3;
    }
    view.cabinModel?.userData.setAlarm?.(view.cabin.airlockProgress > 0);
    graphics.setEffects({ vignette: low ? 0.5 : 0, blackout: 0, shake: 0 });
    graphics.render(dt);
  };
  view = createWalkScene({
    ...options,
    renderer: graphics.renderer,
    scene,
    renderFrame,
    getModel: name => lifetime.get(name),
    getTerrainHeight,
  });
  graphics.setView(scene, view.camera);
  const ambience = kind === 'eva' ? 'ambience.mars' : 'ambience.ship';
  audio.setAir(kind === 'eva' ? 0.01 : 1);
  audio.play(ambience, { loop: true });
  const dispose = view.dispose;
  view.dispose = () => {
    if (disposed) return;
    disposed = true;
    lifetime.dispose();
    dispose();
    audio.stop(ambience);
    audio.stop('suit.breath');
    graphics.setEffects({ vignette: 0, blackout: 0, shake: 0 });
  };
  return view;
}
