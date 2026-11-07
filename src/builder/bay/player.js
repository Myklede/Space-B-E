// First-person engineer: walking with WASD, mouse look through core input, a body you can see when you look down,
// and hands holding a tablet. Collides with the hall wall, the platform railing and the stations.
import * as THREE from 'three';
import { HALL } from './room.js';
import { box, canvasTexture, cylinder, drawScreen, std } from './util.js';

const EYE = 1.65;
const WALK = 2.6, RUN = 4.6; // m/s
const ACCEL = 14;
const RADIUS = 0.35;

export function createPlayer(scene, camera, { stations = [], start = { x: 11.5, z: 2.5 }, yaw = Math.PI / 2 } = {}) {
  const pos = new THREE.Vector3(start.x, 0, start.z);
  const vel = new THREE.Vector3();
  const look = { yaw, pitch: -0.08 };
  let bob = 0, bobAmp = 0, walked = 0;

  // ----- body -----
  const suit = std(0x1f2f52, { roughness: 0.9, metalness: 0 });
  const accent = std(0xe8732a, { roughness: 0.8 });
  const skin = std(0xd9a883, { roughness: 0.7 });
  const boot = std(0x16191c, { roughness: 0.6 });
  const body = new THREE.Group();
  body.add(box(0.42, 0.62, 0.24, suit, { y: 1.12 }), box(0.44, 0.06, 0.26, accent, { y: 0.84 }), box(0.38, 0.16, 0.22, suit, { y: 0.76 }));
  const legs = [];
  for (const dx of [-0.11, 0.11]) {
    const leg = new THREE.Group();
    leg.position.set(dx, 0.72, 0);
    leg.add(cylinder(0.085, 0.075, 0.36, suit, { y: -0.18 }), cylinder(0.07, 0.065, 0.34, suit, { y: -0.53 }), box(0.12, 0.08, 0.26, boot, { y: -0.72, z: 0.05 }));
    body.add(leg);
    legs.push(leg);
  }
  body.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  scene.add(body);

  // ----- hands and tablet, attached to the camera -----
  const hands = new THREE.Group();
  const arm = (side) => {
    const g = new THREE.Group();
    g.add(cylinder(0.045, 0.05, 0.32, suit, { y: -0.16 }), box(0.085, 0.045, 0.11, skin, { y: -0.34 }));
    g.position.set(side * 0.19, -0.2, -0.36);
    g.rotation.x = -1.15;
    g.rotation.z = side * 0.25;
    return g;
  };
  hands.add(arm(-1), arm(1));
  const tablet = new THREE.Group();
  const { texture, redraw } = canvasTexture(512, 360);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.185), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = 0.007;
  tablet.add(box(0.3, 0.012, 0.21, std(0x15191c, { roughness: 0.5, metalness: 0.6 })), screen);
  tablet.position.set(0, -0.3, -0.42);
  tablet.rotation.x = 0.95;
  hands.add(tablet);
  hands.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  camera.add(hands);
  scene.add(camera);

  const setTablet = ({ title = 'Engineer tablet', lines = [], status = null } = {}) => redraw((ctx, w, h) => drawScreen(ctx, w, h, { title, lines, status, scale: 0.8 }));
  setTablet({ lines: ['Walk with WASD, look with the mouse.', 'E uses the machine in front of you.'] });

  // ----- collisions -----
  const colliders = stations.map((s) => ({ x: s.position.x, z: s.position.z, r: s.isDesk ? 1.1 : 1.25 }));
  function collide() {
    const r = Math.hypot(pos.x, pos.z);
    const wallR = HALL.radius - 0.7;
    if (r > wallR) { pos.x *= wallR / r; pos.z *= wallR / r; }
    const pitR = HALL.pitRadius + 0.55;
    if (r < pitR) { const k = pitR / Math.max(r, 1e-3); pos.x *= k; pos.z *= k; }
    for (const c of colliders) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + RADIUS;
      if (d < min && d > 1e-4) { pos.x = c.x + (dx / d) * min; pos.z = c.z + (dz / d) * min; }
    }
  }

  function update(dt, { forward = 0, right = 0, run = false, lookDelta = { x: 0, y: 0 }, sensitivity = 1, invertY = false, frozen = false } = {}) {
    if (!frozen) {
      look.yaw -= lookDelta.x * 0.0022 * sensitivity;
      look.pitch -= lookDelta.y * 0.0022 * sensitivity * (invertY ? -1 : 1);
      look.pitch = Math.max(-1.45, Math.min(1.3, look.pitch));
    }
    const speed = run ? RUN : WALK;
    const dir = new THREE.Vector3(Math.sin(look.yaw) * -forward + Math.cos(look.yaw) * right, 0, Math.cos(look.yaw) * -forward - Math.sin(look.yaw) * right);
    if (dir.lengthSq() > 1) dir.normalize();
    const target = frozen ? new THREE.Vector3() : dir.multiplyScalar(speed);
    vel.lerp(target, 1 - Math.exp(-dt * ACCEL));
    pos.addScaledVector(vel, dt);
    collide();
    const moving = vel.length();
    walked += moving * dt;
    bobAmp += ((moving > 0.3 ? 1 : 0) - bobAmp) * Math.min(1, dt * 8);
    bob = Math.sin(walked * 2.3 * Math.PI) * 0.028 * bobAmp;

    camera.position.set(pos.x, EYE + bob, pos.z);
    camera.rotation.set(look.pitch, look.yaw, Math.sin(walked * 2.3 * Math.PI * 0.5) * 0.006 * bobAmp, 'YXZ');
    body.position.set(pos.x + Math.sin(look.yaw) * 0.12, 0, pos.z + Math.cos(look.yaw) * 0.12);
    body.rotation.y = look.yaw;
    const swing = Math.sin(walked * 2.3 * Math.PI) * 0.55 * bobAmp;
    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
    hands.position.y = bob * 0.5;
  }

  return {
    get position() { return pos; },
    get yaw() { return look.yaw; },
    get pitch() { return look.pitch; },
    forward: () => new THREE.Vector3(-Math.sin(look.yaw), 0, -Math.cos(look.yaw)),
    update, setTablet, body, hands,
    lookAt(x, z, pitch = null) { look.yaw = Math.atan2(-(x - pos.x), -(z - pos.z)); if (pitch !== null) look.pitch = pitch; },
    setPitch(p) { look.pitch = Math.max(-1.45, Math.min(1.3, p)); },
    teleport(x, z, yaw = look.yaw) { pos.set(x, 0, z); vel.set(0, 0, 0); look.yaw = yaw; },
    dispose() { scene.remove(body); camera.remove(hands); },
  };
}
