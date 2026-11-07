// Pictures of parts for the catalogue cards: each part's own 3D art rendered once to a small image (cached).
import * as THREE from 'three';
import { partArt } from './bay/partArt.js';
import { SIZE_SCALE, BASE_RADIUS } from './assembly.js';

export function createIconRenderer({ renderer, size = 192 }) {
  const cache = new Map();
  const rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
  const key = new THREE.DirectionalLight(0xfff4e6, 3.2);
  key.position.set(3, 5, 4);
  const fill = new THREE.DirectionalLight(0x8ea4c8, 1.2);
  fill.position.set(-4, 2, -3);
  const rim = new THREE.DirectionalLight(0x67e8f9, 1.6);
  rim.position.set(0, 3, -5);
  scene.add(key, fill, rim, new THREE.AmbientLight(0x405060, 1.2));
  const pixels = new Uint8Array(size * size * 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  function render(def) {
    const entry = { type: def.id, attach: def.attach, height: def.height, def, radius: BASE_RADIUS * (SIZE_SCALE[def.size] ?? 1) };
    const art = partArt(entry);
    const holder = new THREE.Group();
    holder.add(art);
    scene.add(holder);
    const box = new THREE.Box3().setFromObject(holder);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dist = sphere.radius / Math.sin((camera.fov * Math.PI) / 360) * 1.15;
    camera.position.copy(sphere.center).add(new THREE.Vector3(0.9, 0.55, 1.1).normalize().multiplyScalar(dist));
    camera.lookAt(sphere.center);
    camera.updateProjectionMatrix();
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, pixels);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);
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

  return {
    /** Data URL of the part's picture (rendered on first use). */
    iconFor(def) {
      if (!cache.has(def.id)) {
        try { cache.set(def.id, render(def)); } catch { cache.set(def.id, ''); }
      }
      return cache.get(def.id);
    },
    dispose() { rt.dispose(); cache.clear(); },
  };
}
