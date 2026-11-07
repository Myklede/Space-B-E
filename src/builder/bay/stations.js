// The engineering stations around the hall: each is one job of a real launch team, as a machine the player uses.
import * as THREE from 'three';
import { HALL } from './room.js';
import { DEG, box, canvasTexture, cylinder, drawScreen, glow, polar, shadowed, std } from './util.js';

export const STATIONS = [
  { id: 'integration', name: 'Vehicle integration', role: 'Lead integration engineer', deg: 0, prompt: 'Open the integration console', blurb: 'Stack the vehicle on the stand: attach, move and remove parts, symmetry, blueprints.' },
  { id: 'propulsion', name: 'Propulsion workshop', role: 'Propulsion engineer', deg: 52, prompt: 'Open the propulsion workshop', blurb: 'Chambers, nozzles, turbopumps and the tanks that feed them.' },
  { id: 'structures', name: 'Structures & aero bay', role: 'Structures engineer', deg: 104, prompt: 'Open the structures bay', blurb: 'Nose cones, fins, landing gear, heat shields, parachutes.' },
  { id: 'crew', name: 'Crew systems lab', role: 'Life-support engineer', deg: 156, prompt: 'Open the crew systems lab', blurb: 'Capsules, oxygen, shelter, power, comms and the science the mission is for.' },
  { id: 'warehouse', name: 'Parts warehouse', role: 'Logistics', deg: 226, prompt: 'Open the parts inventory', blurb: 'Every part the agency can buy, with pictures and what it is for.' },
  { id: 'teststand', name: 'Test & launch readiness', role: 'Test conductor', deg: 304, prompt: 'Open the test console', blurb: 'Static fire on the stand, a hold-down liftoff test, then the readiness poll.' },
  { id: 'handbook', name: "Engineer's handbook", role: 'You', deg: 150, prompt: 'Read the handbook', blurb: 'How to build a ship that comes back, and your own notes.', radius: HALL.radius - 2.3, isDesk: true },
  { id: 'launchwindow', name: 'Range & weather', role: 'Range safety officer', deg: 332, prompt: 'Open the range terminal', blurb: 'Pick the launch window: the soonest is cold and free, later ones cost pad fees.', small: true },
];

const SCREEN_W = 640, SCREEN_H = 360;
const CONSOLE_RADIUS = 9.4;

function consoleMesh(station) {
  const g = new THREE.Group();
  const dark = std(0x23282d, { roughness: 0.5, metalness: 0.7 });
  const light = std(0x8d949b, { roughness: 0.45, metalness: 0.8 });
  const w = station.small ? 1.1 : 1.9, d = 0.85;
  const base = box(w, 0.9, d, dark, { y: 0.45 });
  const desk = box(w, 0.12, 0.7, light, { y: 0.95, z: 0.05 });
  desk.rotation.x = -0.22;
  const keyboard = box(w * 0.55, 0.03, 0.22, std(0x101316, { roughness: 0.8 }), { y: 1.02, z: 0.14 });
  keyboard.rotation.x = -0.22;
  const housing = box(w, 0.82, 0.22, dark, { y: 1.45, z: -0.3 });
  housing.rotation.x = 0.14;
  const { texture, redraw } = canvasTexture(SCREEN_W, SCREEN_H);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.14, 0.68), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  screen.position.set(0, 1.45, -0.18);
  screen.rotation.x = 0.14;
  const strip = box(w, 0.03, 0.03, glow(0x67e8f9, 2), { y: 1.9, z: -0.22 });
  const led = cylinder(0.02, 0.02, 0.01, glow(0x4ade80, 2.5), { x: w / 2 - 0.1, y: 1.03, z: 0.3 });
  led.rotation.x = Math.PI / 2 - 0.22;
  g.add(base, desk, keyboard, housing, screen, strip, led);
  shadowed(g);
  screen.castShadow = false;
  const lamp = new THREE.PointLight(0x67e8f9, 6, 4, 2);
  lamp.position.set(0, 1.6, 0.4);
  g.add(lamp);
  return { group: g, redraw, texture };
}

function deskScreen() {
  const g = new THREE.Group();
  const cover = std(0x7a2f1f, { roughness: 0.75, metalness: 0 });
  const book = box(0.32, 0.05, 0.24, cover, { y: 0.775 });
  book.castShadow = true;
  const pages = box(0.3, 0.04, 0.22, std(0xe8e2d2, { roughness: 0.95 }), { y: 0.775 });
  const { texture, redraw } = canvasTexture(256, 192);
  redraw((ctx, w, h) => {
    ctx.fillStyle = '#7a2f1f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d9b26f';
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#f1dfb0';
    ctx.font = '700 26px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText("ENGINEER'S", w / 2, 80);
    ctx.fillText('HANDBOOK', w / 2, 112);
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }));
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.801, 0);
  const metal = std(0x2a2f34, { metalness: 0.8, roughness: 0.4 });
  const lampArm = box(0.04, 0.5, 0.04, metal, { x: 0.5, y: 1.0, z: -0.2 });
  const shade = cylinder(0.05, 0.12, 0.14, metal, { x: 0.42, y: 1.22, z: -0.16 });
  shade.rotation.z = 0.6;
  const bulb = new THREE.PointLight(0xffe2b0, 5, 3, 2);
  bulb.position.set(0.38, 1.1, -0.1);
  g.add(book, pages, label, lampArm, shade, bulb);
  return { group: g, redraw, texture };
}

/** Creates the stations in `scene`. Returns [{ ...def, position, usePoint, group, setScreen }]. */
export function createStations(scene) {
  const out = [];
  for (const def of STATIONS) {
    const radius = def.radius ?? CONSOLE_RADIUS;
    const position = polar(def.deg, radius, 0);
    const built = def.isDesk ? deskScreen() : consoleMesh(def);
    built.group.position.copy(position);
    // consoles face outward: the player stands on the outer side and looks over the console at the vehicle
    built.group.rotation.y = def.isDesk ? -def.deg * DEG + Math.PI / 2 : -def.deg * DEG - Math.PI / 2;
    scene.add(built.group);
    const station = { ...def, position, group: built.group, usePoint: polar(def.deg, radius + (def.isDesk ? -1.0 : 1.1), 0) };
    station.setScreen = ({ lines = [], status = null } = {}) => built.redraw((ctx, w, h) => drawScreen(ctx, w, h, { title: def.name, lines: [{ text: def.role, color: 'rgba(134,166,173,0.95)' }, '', ...lines], status, scale: 1 }));
    station.setScreen({ lines: [def.blurb] });
    out.push(station);
  }
  return out;
}
