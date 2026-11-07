import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getRenderer, sharedUniforms } from './shared.js';

let environment = null;

// A soft studio reflection, so metal and paint still read inside a dark ship.
export function interiorEnvironment() {
  if (!environment) {
    const pmrem = new THREE.PMREMGenerator(getRenderer());
    environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  return environment;
}

export const pbr = (color, roughness = 0.55, metalness = 0.1, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, envMap: interiorEnvironment(), envMapIntensity: 0.3, ...extra });

const glow = (color, power = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power) });

function box(w, h, d, material, x = 0, y = 0, z = 0, radius = 0.025) {
  const geometry = radius > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, Math.min(w, h, d) / 2)) : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

function screen(width, height, draw, power = 1.5) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round(512 * height / width);
  const c = canvas.getContext('2d');
  c.fillStyle = '#04100f';
  c.fillRect(0, 0, canvas.width, canvas.height);
  draw(c, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({ map: texture, color: new THREE.Color(power, power, power) });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

const CYAN = '#67e8f9', AMBER = '#fbbf24';

function drawTrajectory(c, w, h) {
  c.strokeStyle = 'rgba(103,232,249,.22)';
  c.lineWidth = 1;
  for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.strokeStyle = CYAN;
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(w * 0.5, h * 0.55, w * 0.36, h * 0.3, -0.25, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = AMBER;
  c.beginPath();
  c.arc(w * 0.5, h * 0.55, 12, 0, Math.PI * 2);
  c.fill();
}

function drawReadout(c, w, h) {
  c.font = '500 26px "IBM Plex Mono", monospace';
  const rows = [['FUEL', 0.72, CYAN], ['O2', 0.91, CYAN], ['PWR', 0.58, AMBER], ['TEMP', 0.34, CYAN]];
  rows.forEach(([label, value, color], i) => {
    const y = (h / rows.length) * i + 30;
    c.fillStyle = color;
    c.fillText(label, 24, y + 20);
    c.fillStyle = 'rgba(103,232,249,.16)';
    c.fillRect(130, y, w - 160, 22);
    c.fillStyle = color;
    c.fillRect(130, y, (w - 160) * value, 22);
  });
}

function drawBars(c, w, h) {
  c.fillStyle = CYAN;
  for (let i = 0; i < 24; i++) {
    const v = 0.25 + 0.65 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6));
    c.fillRect(16 + i * ((w - 32) / 24), h - 16 - v * (h - 40), (w - 32) / 24 - 5, v * (h - 40));
  }
}

/** Seated cockpit. The group's origin is the pilot's eye and forward is -Z. Add it under the camera's parent. */
export function createCockpit() {
  const group = new THREE.Group();
  group.name = 'cockpit';
  const shell = pbr(0x20252b, 0.62, 0.35);
  const panel = pbr(0x14181d, 0.48, 0.5);
  const trim = pbr(0x5b636d, 0.38, 0.85);

  group.add(box(2.1, 0.5, 0.75, panel, 0, -0.72, -1.05, 0.05)); // lower dash
  const console_ = box(2.1, 0.58, 0.06, panel, 0, -0.44, -0.76, 0.02); // tilted instrument face
  console_.rotation.x = -0.36;
  group.add(console_);
  group.add(box(2.1, 0.07, 0.56, shell, 0, -0.17, -1.07, 0.03)); // glare shield
  [-1.08, 1.08].forEach((x) => group.add(box(0.22, 1.9, 2.4, shell, x, -0.05, -0.55, 0.06)));
  group.add(box(2.4, 0.2, 2.2, shell, 0, 0.94, -0.65, 0.06)); // overhead
  group.add(box(2.4, 2.2, 0.15, shell, 0, -0.05, 0.75, 0.05)); // rear bulkhead

  // Window frame around a wide view.
  const frameZ = -1.34;
  group.add(box(2.1, 0.09, 0.09, trim, 0, 0.8, frameZ));
  group.add(box(2.1, 0.06, 0.07, trim, 0, -0.17, frameZ));
  [-1.0, -0.42, 0.42, 1.0].forEach((x) => group.add(box(0.05, 1.02, 0.07, trim, x, 0.31, frameZ)));
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.02),
    new THREE.MeshPhysicalMaterial({ color: 0xbfd9ff, transparent: true, opacity: 0.05, roughness: 0.06, metalness: 0, envMap: interiorEnvironment(), envMapIntensity: 0.4, depthWrite: false }),
  );
  glass.position.set(0, 0.31, frameZ - 0.02);
  group.add(glass);

  // Instruments, tilted back towards the pilot.
  const screens = [
    [screen(0.46, 0.32, drawReadout), -0.54],
    [screen(0.56, 0.36, drawTrajectory), 0],
    [screen(0.46, 0.32, drawBars), 0.54],
  ];
  for (const [mesh, x] of screens) {
    mesh.position.set(x, -0.43, -0.725);
    mesh.rotation.x = -0.36;
    group.add(mesh);
    const bezel = box(mesh.geometry.parameters.width + 0.04, mesh.geometry.parameters.height + 0.04, 0.02, trim, 0, 0, -0.016, 0.008);
    mesh.add(bezel);
  }

  // Rows of small lit buttons on both side walls and overhead.
  const lamps = [glow('#22d3ee', 2.4), glow('#fbbf24', 2.4), glow('#34d399', 2.2), glow('#f87171', 2.6)];
  const blinkers = [];
  const button = new THREE.BoxGeometry(0.018, 0.018, 0.018);
  [-1, 1].forEach((side) => {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 9; col++) {
        const seed = (row * 7 + col * 3 + (side > 0 ? 5 : 0)) % 11;
        if (seed === 2) continue;
        const material = seed < 7 ? lamps[0] : lamps[1 + (seed % 3)];
        const lamp = new THREE.Mesh(button, material.clone());
        lamp.position.set(side * 0.965, -0.2 - row * 0.09, -1.15 + col * 0.09);
        group.add(lamp);
        if (seed === 5 || seed === 9) blinkers.push(lamp);
      }
    }
  });
  for (let i = 0; i < 12; i++) {
    const lamp = new THREE.Mesh(button, lamps[(i * 5) % 3].clone());
    lamp.position.set(-0.55 + i * 0.1, 0.835, -0.95);
    group.add(lamp);
  }

  const cabinLight = new THREE.PointLight(0xffdcb8, 1.5, 4, 2);
  cabinLight.position.set(0, 0.7, -0.2);
  const screenLight = new THREE.PointLight(0x67e8f9, 0.32, 2.2, 2);
  screenLight.position.set(0, -0.3, -0.45);
  const alarmLight = new THREE.PointLight(0xff2a1f, 0, 5, 2);
  alarmLight.position.set(0, 0.75, -0.4);
  group.add(cabinLight, screenLight, alarmLight);

  let alarm = false;
  group.userData.setAlarm = (on) => { alarm = on; };
  group.userData.onFrame = () => {
    const t = sharedUniforms.uTime.value;
    blinkers.forEach((lamp, i) => { lamp.visible = Math.sin(t * (1.3 + i * 0.37) + i) > -0.3; });
    alarmLight.intensity = alarm ? 3 * (0.5 + 0.5 * Math.sign(Math.sin(t * 5))) : 0;
    cabinLight.intensity = alarm ? 0.35 : 1.5;
  };
  return group;
}

/**
 * Walkable cabin, 4 m wide and 8 m long. The origin is the middle of the floor, +Y up, pilot seat at -Z, airlock at +Z.
 * Station positions are in group.userData.stations, ready for registerInteractable().
 */
export function createCabin() {
  const group = new THREE.Group();
  group.name = 'cabin';
  const W = 4, L = 8, H = 2.6;
  const wall = pbr(0x7f878c, 0.66, 0.05);
  const floor = pbr(0x2b3036, 0.72, 0.2);
  const rib = pbr(0x7a828b, 0.42, 0.75);
  const dark = pbr(0x171b20, 0.5, 0.45);

  const room = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), [wall, wall, wall, floor, wall, wall].map((m) => {
    const c = m.clone();
    c.side = THREE.BackSide;
    return c;
  }));
  room.position.y = H / 2;
  room.receiveShadow = true;
  group.add(room);

  for (let z = -L / 2 + 0.8; z < L / 2; z += 1.6) {
    [-1, 1].forEach((s) => group.add(box(0.1, H, 0.14, rib, s * (W / 2 - 0.05), H / 2, z)));
    group.add(box(W, 0.1, 0.14, rib, 0, H - 0.05, z));
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.018, 0.09), glow('#fff1dc', 2.4));
    strip.position.set(0, H - 0.015, z + 0.8);
    if (z + 0.8 < L / 2) group.add(strip);
    const light = new THREE.PointLight(0xffe2bd, 1.5, 6, 2);
    light.position.set(0, H - 0.25, z + 0.8);
    if (z + 0.8 < L / 2) group.add(light);
  }

  const stations = {};
  const station = (id, x, z, w, h, d, accent) => {
    const anchor = new THREE.Group();
    anchor.name = `station:${id}`;
    anchor.position.set(x, 0, z);
    anchor.add(box(w, h, d, dark, 0, h / 2, 0, 0.03));
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.03, 0.012), glow(accent, 2.5));
    const facing = x === 0 ? Math.sign(-z) : -Math.sign(x);
    if (x === 0) lamp.position.set(0, h - 0.12, (d / 2 + 0.008) * facing);
    else { lamp.rotation.y = Math.PI / 2; lamp.scale.x = d / w; lamp.position.set((w / 2 + 0.008) * facing, h - 0.12, 0); }
    anchor.add(lamp);
    group.add(anchor);
    stations[id] = anchor.position.clone().setY(1.2);
  };
  station('pilotSeat', 0, -3.3, 1.1, 1.15, 0.9, '#67e8f9');
  station('o2Station', -1.72, -1.1, 0.5, 1.7, 0.8, '#34d399');
  station('suitLocker', -1.7, 0.7, 0.55, 2.1, 1.0, '#fbbf24');
  station('commsConsole', 1.7, -1.3, 0.55, 1.25, 1.2, '#67e8f9');
  station('sampleStorage', 1.72, 0.9, 0.5, 1.05, 1.1, '#a78bfa');
  station('airlock', 0, 3.86, 1.3, 2.25, 0.25, '#f87171');
  station('bunk', -1.55, -2.75, 0.85, 0.62, 1.9, '#fff1dc');

  group.userData.stations = stations;
  return group;
}
