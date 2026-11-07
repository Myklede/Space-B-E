// 3D art for the launch pad under the vehicle in the design studio. Owned by whoever builds the pad section.
// padArt(state, { radius, height }) → { object: THREE.Object3D, top: metres } where `top` is the height the vehicle
// stands on. state = padState() from sections.js: { site, slot, equipment: [{ eq, option }] }.
import * as THREE from 'three';

const CONCRETE = new THREE.MeshStandardMaterial({ color: 0x8b8f92, roughness: 0.92, metalness: 0.02 });
const STEEL = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.45, metalness: 0.8 });
const RED = new THREE.MeshStandardMaterial({ color: 0xa33a2a, roughness: 0.6, metalness: 0.4 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.7, metalness: 0.4 });

const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };

export function padArt(state, { radius = 1.25, height = 20 } = {}) {
  const g = new THREE.Group();
  const top = 1.6;
  // the launch mount: a concrete deck with a hole for the flame
  const deckR = Math.max(6, radius * 4.5);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(deckR, deckR + 0.6, top, 48), CONCRETE);
  deck.position.y = top / 2;
  g.add(deck);
  // the flame hole: a dark disc a hand's width above the deck, so it reads as an opening
  const hole = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.2, 40), DARK);
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = top + 0.01;
  g.add(hole);
  const opt = (key) => state?.equipment?.find((c) => c.eq.key === key)?.option?.id;
  // hold-down clamps around the base
  if (opt('clamps') && opt('clamps') !== 'none') {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const c = box(0.5, 0.9, 0.35, STEEL, Math.cos(a) * (radius + 0.35), top + 0.45, Math.sin(a) * (radius + 0.35));
      c.rotation.y = -a;
      g.add(c);
    }
  }
  // sound suppression: water pipes and nozzles around the hole
  if (opt('deluge') && opt('deluge') !== 'none') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.6, 0.1, 8, 48), STEEL);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = top + 0.12;
    g.add(ring);
  }
  // an umbilical tower beside the vehicle
  const towerH = Math.max(12, height * 0.9);
  const tx = radius + 4.5;
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) g.add(box(0.18, towerH, 0.18, RED, tx + dx, top + towerH / 2, dz));
  for (let y = 2; y < towerH; y += 2.4) {
    g.add(box(1.98, 0.12, 0.12, RED, tx, top + y, -0.9), box(1.98, 0.12, 0.12, RED, tx, top + y, 0.9), box(0.12, 0.12, 1.98, RED, tx - 0.9, top + y, 0), box(0.12, 0.12, 1.98, RED, tx + 0.9, top + y, 0));
  }
  const arm = box(tx - radius - 0.9, 0.3, 0.6, STEEL, (tx + radius) / 2 - 0.45, top + towerH * 0.7, 0);
  g.add(arm);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { object: g, top };
}
