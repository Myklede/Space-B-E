// Pictures of parts for the cards and the detail panel: each part's own 3D art rendered once to a small image
// (cached), or a baked PNG from public/assets/icons when one exists (data/icons.json lists them), so the cards never
// wait for a model to download. Also renders any Object3D (the internals pieces) the same way.
import * as THREE from 'three';
import { assets } from '/src/graphics/index.js';
import { partArt } from './bay/partArt.js';
import { hasNasaArt, wantsNasaArt } from './bay/nasa.js';
import { SIZE_SCALE, BASE_RADIUS } from './assembly.js';
import baked from './data/icons.json';

const safe = (key) => key.replace(/[^a-z0-9_.-]/gi, '-'); // the same file names the bake tool writes
const BAKED = new Set((baked.icons ?? []).map(safe));
const BAKED_BASE = '/assets/icons/';

export function createIconRenderer({ renderer, size = 512 }) {
  const cache = new Map();
  const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
  const key = new THREE.DirectionalLight(0xfff4e6, 2.0);
  key.position.set(3, 5, 4);
  const fill = new THREE.DirectionalLight(0x8ea4c8, 0.9);
  fill.position.set(-4, 2, -3);
  const rim = new THREE.DirectionalLight(0x67e8f9, 1.4);
  rim.position.set(0, 3, -5);
  scene.add(key, fill, rim, new THREE.AmbientLight(0x405060, 0.5), new THREE.HemisphereLight(0xdfe9ff, 0x202428, 0.45));
  const pixels = new Uint8Array(size * size * 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  function withState(fn) {
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    const prevViewport = renderer.getViewport(new THREE.Vector4());
    const prevScissor = renderer.getScissor(new THREE.Vector4());
    const prevScissorTest = renderer.getScissorTest();
    try {
      return fn();
    } finally {
      renderer.setRenderTarget(prevTarget);
      renderer.setViewport(prevViewport);
      renderer.setScissor(prevScissor);
      renderer.setScissorTest(prevScissorTest);
      renderer.setClearColor(prevClear, prevAlpha);
    }
  }

  function renderObject(object, { view = new THREE.Vector3(0.9, 0.55, 1.1), yaw = -0.4, pad = 1.15 } = {}) {
    const holder = new THREE.Group();
    holder.add(object);
    holder.rotation.y = yaw;
    scene.add(holder);
    scene.environment = assets.environment?.() ?? null;
    scene.environmentIntensity = 0.3; // untextured white hardware must not blow out
    const box = new THREE.Box3().setFromObject(holder);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dist = sphere.radius / Math.sin((camera.fov * Math.PI) / 360) * pad;
    camera.position.copy(sphere.center).add(view.clone().normalize().multiplyScalar(dist));
    camera.lookAt(sphere.center);
    camera.updateProjectionMatrix();
    withState(() => {
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.setViewport(0, 0, size, size);
      renderer.setScissor(0, 0, size, size);
      renderer.setScissorTest(true);
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(rt, 0, 0, size, size, pixels);
    });
    scene.remove(holder);
    holder.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.()); });
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) { // flip vertically: GL rows start at the bottom
      const src = (size - 1 - y) * size * 4;
      image.data.set(pixels.subarray(src, src + size * 4), y * size * 4);
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  }

  const entryFor = (def) => ({ type: def.id, attach: def.attach, height: def.height, def, radius: BASE_RADIUS * (SIZE_SCALE[def.size] ?? 1) });

  return {
    /** URL of the part's picture: a baked PNG when there is one, else rendered on first use and cached. */
    iconFor(def) {
      if (BAKED.has(safe(def.id))) return `${BAKED_BASE}${safe(def.id)}.png`;
      // a part whose real model is still downloading is rendered once it arrives (reset() is called then)
      const k = `${def.id}:${wantsNasaArt(def.id) && !hasNasaArt(def.id) ? 'tmp' : 'real'}`;
      if (!cache.has(k)) {
        try { cache.set(k, renderObject(partArt(entryFor(def)))); } catch { cache.set(k, ''); }
      }
      return cache.get(k);
    },
    /** URL of a picture of any object (internals pieces): `key` caches it, `build()` makes the Object3D. */
    objectIcon(key, build, opts) {
      if (BAKED.has(safe(key))) return `${BAKED_BASE}${safe(key)}.png`;
      if (!cache.has(key)) {
        try { cache.set(key, renderObject(build(), opts)); } catch { cache.set(key, ''); }
      }
      return cache.get(key);
    },
    /** Render straight from a part def (used by the bake tool). */
    renderPart: (def) => renderObject(partArt(entryFor(def))),
    renderObject,
    /** Forget rendered pictures (after the real models arrive). */
    reset() { cache.clear(); },
    dispose() { rt.dispose(); cache.clear(); },
  };
}
