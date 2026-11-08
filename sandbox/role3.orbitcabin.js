// Role 3 test page: the Apollo cockpit with the cabin attached behind the aft hatch (orbit -> cabin route). Open /sandbox/role3.orbitcabin.html.
// window.T exposes the pieces for scripts.
import * as THREE from 'three';
import { loadCapsule, createCapsuleCockpit } from '/src/graphics/capsuleCockpit.js';
import { createCabin } from '/src/graphics/cabin.js';
import { state as gfxState } from '/src/graphics/shared.js';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
gfxState.renderer = renderer;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);
const sun = new THREE.DirectionalLight(0xfff4e0, q.get('sun') ?? 3); sun.position.set(3, 2, -5);
scene.add(sun, new THREE.HemisphereLight(0x8899bb, 0x222233, 0.15));
// a bright "Earth" backdrop so windows show something
const earth = new THREE.Mesh(new THREE.SphereGeometry(6000, 48, 24), new THREE.MeshBasicMaterial({ color: 0x2c64b4 }));
earth.position.set(-4000, -9000, 1000); scene.add(earth);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.02, 40000);
scene.add(camera);

await loadCapsule('apollo');
const ship = { parts: [{ type: 'capsule_apollo' }], stats: { cabin: { windows: 'small', hatch: 'outward', type: 'capsule_apollo' } } };
const { setShip } = await import('/src/core/index.js');
setShip(ship);
const cockpit = createCapsuleCockpit('apollo', null);
scene.add(cockpit);
const T = { THREE, renderer, scene, camera, cockpit, cabin: null, earth, sun };
window.T = T;
T.attach = () => { T.cabin = createCabin(); cockpit.userData.attachCabin?.(T.cabin); return T.cabin; };
// pos in cockpit space, look target in cockpit space
T.cam = (pos, target, fov = 70, up = [0, 1, 0]) => {
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.position.set(...pos); camera.up.set(...up); camera.lookAt(...target);
  renderer.render(scene, camera);
};
// cabin-local camera: pos/target in cabin coordinates (cabin y up), up defaults to cabin +Y
T.camC = (pos, target, fov = 70, up = [0, 1, 0]) => {
  const c = T.cabin; c.updateMatrixWorld(true);
  const P = new THREE.Vector3(...pos).applyMatrix4(c.matrixWorld), Tg = new THREE.Vector3(...target).applyMatrix4(c.matrixWorld);
  const U = new THREE.Vector3(...up).transformDirection(c.matrixWorld);
  T.cam(P.toArray(), Tg.toArray(), fov, U.toArray());
};
T.render = () => renderer.render(scene, camera);

// ---- interactive walkthrough (local test page, not shipped) ----
// click = capture mouse, mouse = look, WASD = float, Space/C = up/down, Shift = faster
// H harness, O hatch, P play the float path seat -> hatch -> passage -> cabin, R back to the seat, G zero-g items, K cabin on/off
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;left:12px;top:12px;color:#cfe;font:13px/1.5 monospace;background:#0009;padding:8px 10px;border-radius:6px;pointer-events:none;white-space:pre';
document.body.appendChild(hud);
const look = { yaw: 0, pitch: 0 };
const vel = new THREE.Vector3();
const keys = new Set();
const anim = { harness: { v: 0, to: 0 }, hatch: { v: 0, to: 0 } };
let zeroG = false, path = null;
T.attach();
const wp = () => (cockpit.userData.floatPath ?? []).map((o) => o.getWorldPosition(new THREE.Vector3()));
function toSeat() {
  const p = wp(); path = null; vel.set(0, 0, 0);
  camera.position.copy(p[0] ?? new THREE.Vector3()); camera.up.set(0, 1, 0);
  look.yaw = 0; look.pitch = 0;
}
toSeat();
function playPath() {
  const p = wp(); if (p.length < 2) return;
  anim.harness.to = 1; anim.hatch.to = 1;
  path = { curve: new THREE.CatmullRomCurve3([camera.position.clone(), ...p.slice(1)], false, 'centripetal'), t: -1.2, dur: 10 }; // t in seconds: 1.2 s to unbuckle first
}
renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  look.yaw -= e.movementX * 0.0025; look.pitch = Math.max(-1.55, Math.min(1.55, look.pitch - e.movementY * 0.0025));
});
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyH') anim.harness.to = anim.harness.to ? 0 : 1;
  if (e.code === 'KeyO') anim.hatch.to = anim.hatch.to ? 0 : 1;
  if (e.code === 'KeyP') playPath();
  if (e.code === 'KeyR') toSeat();
  if (e.code === 'KeyG') { zeroG = !zeroG; T.cabin?.userData.zeroG?.(zeroG); }
  if (e.code === 'KeyK') { if (T.cabin) { cockpit.userData.detachCabin?.(); T.cabin = null; } else T.attach(); }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const step = (a, dt, rate) => { a.v += Math.sign(a.to - a.v) * Math.min(Math.abs(a.to - a.v), dt * rate); return a.v; };
let last = performance.now();
function loop() {
  const t = performance.now(); const dt = Math.min(0.05, (t - last) / 1000); last = t;
  cockpit.userData.harness?.(step(anim.harness, dt, 0.8));
  cockpit.userData.openHatch?.(step(anim.hatch, dt, 0.6));
  if (path) {
    path.t += dt;
    const u = Math.max(0, Math.min(1, path.t / path.dur));
    const s = u * u * (3 - 2 * u);
    camera.position.copy(path.curve.getPointAt(s));
    const ahead = path.curve.getPointAt(Math.min(1, s + 0.04));
    if (path.t > 0 && ahead.distanceToSquared(camera.position) > 1e-6) {
      const d = ahead.sub(camera.position).normalize();
      const yaw = Math.atan2(-d.x, -d.z), pitch = Math.asin(Math.max(-1, Math.min(1, d.y)));
      look.yaw += (yaw - look.yaw) * Math.min(1, dt * 3); look.pitch += (pitch - look.pitch) * Math.min(1, dt * 3);
    }
    if (path.t >= path.dur) path = null;
  } else {
    const f = new THREE.Vector3(-Math.sin(look.yaw) * Math.cos(look.pitch), Math.sin(look.pitch), -Math.cos(look.yaw) * Math.cos(look.pitch));
    const r = new THREE.Vector3(Math.cos(look.yaw), 0, -Math.sin(look.yaw));
    const want = new THREE.Vector3();
    if (keys.has('KeyW')) want.add(f); if (keys.has('KeyS')) want.sub(f);
    if (keys.has('KeyD')) want.add(r); if (keys.has('KeyA')) want.sub(r);
    if (keys.has('Space')) want.y += 1; if (keys.has('KeyC')) want.y -= 1;
    if (want.lengthSq()) want.normalize().multiplyScalar(keys.has('ShiftLeft') ? 2.2 : 0.8);
    vel.lerp(want, Math.min(1, dt * 2.5)); // zero-g: ease in and drift out
    camera.position.addScaledVector(vel, dt);
  }
  camera.rotation.set(look.pitch, look.yaw, 0, 'YXZ');
  cockpit.userData.onFrame?.(dt, t / 1000);
  T.cabin?.userData.onFrame?.(dt);
  hud.textContent = `Click: bắt chuột · chuột: nhìn · WASD: trôi · Space/C: lên/xuống · Shift: nhanh\nP: tự trôi ghế → cửa → lối đi → cabin   R: về ghế\nH: dây an toàn (${anim.harness.to ? 'mở' : 'cài'})   O: cửa (${anim.hatch.to ? 'mở' : 'đóng'})   G: đồ lơ lửng (${zeroG ? 'bật' : 'tắt'})   K: cabin (${T.cabin ? 'gắn' : 'tháo'})`;
  if (!T.paused) renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
window.__ready = true;
