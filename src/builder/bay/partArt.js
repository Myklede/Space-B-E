// 3D art for one catalogue part: Role 3's rocketPart meshes for the stack, fins and legs; a sealed module box for
// everything else (an "o2_bottle" must not become a 4 m fuel tank because of a word in its id).
import * as THREE from 'three';
import { assets } from '/src/graphics/index.js';

const ART_WORDS = /capsule|command|heat|shield|tile|engine|nozzle|pump|chamber|nose|cone|fin|leg|tank|fuel/;
const CYAN = new THREE.Color(0.25, 1.5, 1.8);

const FAMILY_TINT = {
  control: 0x4b5563, thermal: 0x6b4a3a, recovery: 0xb45309, life: 0x1e5a6e, power: 0x1f4d8a, comms: 0x475569, protection: 0x3f3f46, science: 0x3b5a3a, seals: 0x5b2333,
};

export function moduleBox(entry) {
  const w = Math.min(1.1, Math.max(0.5, entry.height * 0.6));
  const group = new THREE.Group();
  const tint = FAMILY_TINT[entry.def?.family] ?? 0x2a3038;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, entry.height, w), new THREE.MeshStandardMaterial({ color: tint, roughness: 0.5, metalness: 0.55 }));
  body.position.y = entry.height / 2;
  body.castShadow = body.receiveShadow = true;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, entry.height * 0.12, w * 1.02), new THREE.MeshBasicMaterial({ color: CYAN }));
  strip.position.y = entry.height * 0.7;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: 0x9aa6b2 }));
  edges.position.y = entry.height / 2;
  // bolts on the corners
  const bolt = new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.35, metalness: 0.9 });
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8), bolt);
    b.position.set(sx * w * 0.4, entry.height * 0.15, sz * w * 0.51);
    b.rotation.x = Math.PI / 2;
    group.add(b);
  }
  group.add(body, strip, edges);
  group.userData.width = w;
  return group;
}

/** Returns an Object3D for a layout entry { type, attach, height, def }. */
export function partArt(entry) {
  const type = entry.type.toLowerCase();
  if (entry.attach === 'axial' && ART_WORDS.test(type)) return assets.get(`rocketPart:${entry.type}`);
  if (entry.attach === 'radial' && /fin|leg/.test(type)) return assets.get(`rocketPart:${entry.type}`);
  return moduleBox(entry);
}
