import * as THREE from 'three';
import { createPlanet, loadPlanetMaps } from './planets.js';
import { createSpaceSky } from './sky.js';
import { createCabin, createCockpit, interiorEnvironment, pbr } from './interiors.js';
import { PROPS } from './props.js';
import { createEngineFlame, createEntryPlasma, createExhaust, createLandingDust } from './vfx.js';

const factories = new Map();
const warned = new Set();

/** A cyan wireframe: stands in for anything without art yet, and looks deliberate rather than broken. */
export function hologram(name, [w, h, d] = [1, 1, 1]) {
  const group = new THREE.Group();
  group.name = `hologram:${name}`;
  const geometry = new THREE.BoxGeometry(w, h, d);
  const color = new THREE.Color(0.25, 1.5, 1.8);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color }));
  const fill = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, depthWrite: false }));
  group.add(edges, fill);
  edges.position.y = fill.position.y = h / 2;
  return group;
}

const WHITE = 0xe9e6de, DARK = 0x23272c, COPPER = 0xb8743f, SILVER = 0xa8aeb4;

function lathe(points, material, segments = 48) {
  const curve = points.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.Mesh(new THREE.LatheGeometry(curve, segments), material);
}

function band(radius, y, height, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.008, radius + 0.008, height, 48, 1, true), material);
  mesh.position.y = y;
  return mesh;
}

// Materials and canvas textures are made once and shared by every part, so a full rocket stays cheap.
const shared = new Map();
function cached(key, make) {
  if (!shared.has(key)) shared.set(key, make());
  return shared.get(key);
}

function canvasTex(w, h, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext('2d'), w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

// Panel seams, weld lines, rivet rows and stencilled text on a white skin. `ringsAt` are heights in metres.
function paintSkin(c, w, h, { height, rings, bands = [], label = true }) {
  const ppm = h / height; // pixels per metre along the part
  c.fillStyle = '#e9e6de';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { // faint panel-to-panel tone differences and speckle
    c.fillStyle = `rgba(${90 + (i % 5) * 8},${90 + (i % 7) * 5},90,0.035)`;
    c.fillRect((i * 97) % w, (i * 53) % h, 18 + (i % 40), 14 + (i % 30));
  }
  const panels = 8; // vertical seams, evenly around
  for (let i = 0; i < panels; i++) {
    const x = (i / panels) * w;
    c.fillStyle = 'rgba(60,62,66,0.55)';
    c.fillRect(x - 1.5, 0, 3, h);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(x + 2, 0, 1.5, h);
  }
  for (const y of rings) { // horizontal weld lines with a bead of rivets
    const py = h - y * ppm;
    c.fillStyle = 'rgba(70,64,58,0.8)';
    c.fillRect(0, py - 2.5, w, 5);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(0, py + 3, w, 1.5);
    c.fillStyle = 'rgba(40,40,44,0.55)';
    for (let x = 6; x < w; x += 14) c.fillRect(x, py - 11, 3, 3);
  }
  for (const [y0, y1, color] of bands) {
    c.fillStyle = color;
    c.fillRect(0, h - y1 * ppm, w, (y1 - y0) * ppm);
  }
  if (label) {
    for (const cx of [0, w * 0.5, w]) {
      c.save();
      c.translate(cx, h * 0.5);
      c.rotate(-Math.PI / 2);
      c.fillStyle = '#1b2127';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `700 ${Math.round(Math.min(w * 0.065, h * 0.11))}px "IBM Plex Mono", monospace`;
      c.fillText('SPACEB&E', 0, 0);
      c.font = `500 ${Math.round(Math.min(w * 0.025, h * 0.045))}px "IBM Plex Mono", monospace`;
      c.fillText('LOX / FUEL  ·  DO NOT STEP', 0, Math.min(w * 0.07, h * 0.09));
      c.restore();
    }
  }
}

const tankMaterials = (height) => cached(`tank:${height.toFixed(2)}`, () => {
  const side = pbr(0xffffff, 0.42, 0.08, { map: canvasTex(1024, Math.round(1024 * height / 7.85), (c, w, h) => paintSkin(c, w, h, { height, rings: [0.9, height * 0.5, height - 0.9], bands: [[0.12, 0.3, '#23272c'], [height - 0.3, height - 0.12, '#23272c']] })) });
  return [side, pbr(0xd9d6ce, 0.5, 0.1), pbr(0xd9d6ce, 0.5, 0.1)];
});

const noseMaterial = () => cached('nose', () => pbr(0xffffff, 0.4, 0.05, {
  map: canvasTex(1024, 512, (c, w, h) => {
    paintSkin(c, w, h, { height: 2.9, rings: [0.72, 1.45, 2.2], label: false });
    c.fillStyle = '#b3261e'; // tip band
    c.fillRect(0, 0, w, h * 0.09);
  }),
}));

const capsuleSkin = () => cached('capsuleSkin', () => pbr(0xffffff, 0.45, 0.05, {
  map: canvasTex(1024, 512, (c, w, h) => paintSkin(c, w, h, { height: 2, rings: [0.45, 1.2], label: false })),
}));

const finMaterial = () => cached('fin', () => pbr(0xc9ced3, 0.4, 0.5));
const finEdge = () => cached('finEdge', () => new THREE.LineBasicMaterial({ color: 0xff6a3d }));
const glassMat = () => cached('glass', () => new THREE.MeshStandardMaterial({ color: 0x0b1f33, roughness: 0.1, metalness: 0.6, emissive: 0x0a2a44, emissiveIntensity: 0.9 }));
const darkMat = () => cached('dark', () => pbr(0x1b1e22, 0.6, 0.5));
const steelMat = () => cached('steel', () => pbr(0x8e959c, 0.35, 0.9));
const pipeMat = () => cached('pipe', () => pbr(0xc9cdd1, 0.3, 0.9));
const scorchMat = () => cached('scorch', () => pbr(0x15110e, 0.95, 0.2, { side: THREE.BackSide }));

function blockOn(width, height, depth, material, angle, radius, y) { // a small block on the skin, facing outward at `angle`
  const m = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  m.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
  m.rotation.y = angle;
  return m;
}

// Each builder returns a part centred on the rocket's axis with its base at y = 0.
const PARTS = {
  capsule(s) {
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [1.25 * s, 0], [1.25 * s, 0.12 * s], [0.5 * s, 1.75 * s], [0.34 * s, 1.95 * s], [0, 1.98 * s]], capsuleSkin()));
    g.add(band(0.96 * s, 0.72 * s, 0.05 * s, pbr(DARK, 0.5, 0.3)));
    // slope of the shell: radius = 1.25s - 0.4694 * (y - 0.12s) for y in [0.12s, 1.75s]
    const radiusAt = (y) => (1.25 * s) - ((1.25 - 0.5) / (1.63)) * (y - 0.12 * s) * 1;
    const tilt = Math.atan2(0.75, 1.63); // shell leans in
    const win = (angle, y, rr, size) => {
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(size * 1.28, size * 1.28, 0.03, 20), steelMat());
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(size, size, 0.045, 20), glassMat());
      const grp = new THREE.Group();
      grp.add(rim, glass);
      grp.position.set(Math.sin(angle) * rr, y, Math.cos(angle) * rr);
      grp.rotation.set(0, angle, 0);
      grp.rotateX(Math.PI / 2 - tilt);
      return grp;
    };
    for (const a of [-0.42, 0, 0.42]) g.add(win(a, 1.05 * s, radiusAt(1.05 * s) - 0.01, 0.15 * s));
    // hatch on the far side: a rounded square outline
    const hatchY = 0.95 * s, hatchR = radiusAt(hatchY) - 0.005;
    const hatch = new THREE.Group();
    const frame = pbr(0x5b6068, 0.4, 0.7);
    const hw = 0.3 * s, hh = 0.38 * s;
    for (const [w, h, x, y] of [[hw * 2, 0.03, 0, hh], [hw * 2, 0.03, 0, -hh], [0.03, hh * 2, hw, 0], [0.03, hh * 2, -hw, 0]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), frame);
      bar.position.set(x, y, 0);
      hatch.add(bar);
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.04, 0.04), darkMat());
    handle.position.set(hw * 0.4, 0, 0.02);
    hatch.add(handle);
    hatch.position.set(0, hatchY, -hatchR);
    hatch.rotation.set(0, Math.PI, 0);
    hatch.rotateX(-tilt + 0);
    g.add(hatch);
    // four RCS thruster blocks near the shoulder, each with two nozzles
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const blk = blockOn(0.26 * s, 0.2 * s, 0.14 * s, darkMat(), a, 1.2 * s + 0.04, 0.34 * s);
      for (const dx of [-0.07 * s, 0.07 * s]) {
        const nz = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * s, 0.045 * s, 0.07 * s, 8), steelMat());
        nz.rotation.x = Math.PI / 2;
        nz.position.set(dx, 0, 0.09 * s);
        blk.add(nz);
      }
      g.add(blk);
    }
    return g;
  },
  tank(s) {
    const r = 1.25, h = 4 * s;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48, 1), tankMaterials(h));
    body.position.y = h / 2;
    g.add(body);
    return g;
  },
  engine(s) {
    const g = new THREE.Group();
    const profile = [[1.0 * s, 0], [0.9 * s, 0.3 * s], [0.52 * s, 0.95 * s], [0.3 * s, 1.25 * s], [0.34 * s, 1.5 * s], [0.34 * s, 1.75 * s]];
    g.add(lathe(profile, cached('bell', () => pbr(COPPER, 0.32, 0.9, { side: THREE.FrontSide }))));
    const liner = lathe(profile.map(([r, y]) => [r * 0.985, y]), scorchMat()); // dark scorched inside, seen from below
    g.add(liner);
    g.add(band(0.97 * s, 0.1 * s, 0.07 * s, steelMat())); // lip
    // chamber, turbopump lump and plumbing above the bell
    g.add(lathe([[0.42 * s, 1.5 * s], [0.5 * s, 1.75 * s], [0.5 * s, 2.15 * s], [0, 2.3 * s]], steelMat()));
    const pump = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 16, 12), pbr(0x6e757c, 0.4, 0.85));
    pump.scale.set(1, 0.8, 1);
    pump.position.set(0.42 * s, 1.95 * s, 0);
    g.add(pump);
    const pumpCap = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.13 * s, 0.22 * s, 14), darkMat());
    pumpCap.position.set(0.42 * s, 2.2 * s, 0);
    g.add(pumpCap);
    for (const [x, z, a] of [[0.2, 0.24, 0.2], [-0.24, 0.1, -0.15], [-0.05, -0.28, 0.1]]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.035 * s, 0.9 * s, 8), pipeMat());
      pipe.position.set(x * s + 0.2 * s, 1.55 * s, z * s);
      pipe.rotation.z = a;
      g.add(pipe);
    }
    const feed = new THREE.Mesh(new THREE.TorusGeometry(0.42 * s, 0.035 * s, 8, 28, Math.PI * 1.3), pipeMat());
    feed.rotation.x = Math.PI / 2;
    feed.position.y = 1.62 * s;
    g.add(feed);
    return g;
  },
  nose(s) {
    return lathe([[1.25 * s, 0], [1.15 * s, 0.45 * s], [1.05 * s, 0.9 * s], [0.84 * s, 1.4 * s], [0.62 * s, 1.9 * s], [0.4 * s, 2.35 * s], [0.18 * s, 2.7 * s], [0, 2.9 * s]], noseMaterial());
  },
  fin(s) {
    const shape = new THREE.Shape([[0, 0], [1.1 * s, -0.4 * s], [1.1 * s, 0.25 * s], [0, 1.6 * s]].map(([x, y]) => new THREE.Vector2(x, y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false });
    const mesh = new THREE.Mesh(geometry, finMaterial());
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), finEdge())); // bright outline, so it reads against black space
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5 * s, 0.09), pbr(0xd9481f, 0.5, 0.2));
    stripe.position.set(0.9 * s, -0.02 * s, 0.035);
    stripe.rotation.z = 0.05;
    mesh.add(stripe);
    mesh.position.x = 1.2;
    return mesh;
  },
  legs(s) {
    const g = new THREE.Group();
    const material = pbr(SILVER, 0.35, 0.85);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const top = dir.clone().multiplyScalar(1.2).setY(1.9 * s), foot = dir.clone().multiplyScalar(2.4 * s).setY(-0.9 * s);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, top.distanceTo(foot), 10), material);
      strut.position.copy(top).lerp(foot, 0.5);
      strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.07, 18), material);
      pad.position.copy(foot);
      g.add(strut, pad);
    }
    return g;
  },
  heatshield(s) {
    return lathe([[0, 0], [0.8 * s, 0.06 * s], [1.3 * s, 0.26 * s], [1.3 * s, 0.34 * s], [0, 0.34 * s]], pbr(0x3a2a22, 0.92, 0));
  },
};

// Where the next part stacks on top, in metres at size 1. Fins and legs attach to the side, so they add nothing.
const PART_HEIGHT = { capsule: 1.98, tank: 4, engine: 2.2, nose: 2.9, fin: 0, legs: 0, heatshield: 0.34 };

const PART_MATCHERS = [
  [/capsule|command/, 'capsule'], [/heat|shield|tile/, 'heatshield'], [/engine|nozzle|pump|chamber/, 'engine'],
  [/nose|cone/, 'nose'], [/fin/, 'fin'], [/leg/, 'legs'], [/tank|fuel/, 'tank'],
];

function createRocketPart(id) {
  const key = id.toLowerCase();
  const match = PART_MATCHERS.find(([pattern]) => pattern.test(key));
  if (!match) return hologram(`rocketPart:${id}`, [1.2, 0.8, 1.2]);
  const size = /(^|[_-])s($|[_-])|small/.test(key) ? 0.75 : /(^|[_-])l($|[_-])|large/.test(key) ? 1.35 : 1;
  const part = PARTS[match[1]](size);
  part.name = `rocketPart:${id}`;
  part.userData.height = PART_HEIGHT[match[1]] * size;
  part.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return part;
}

function stack(ids) {
  const group = new THREE.Group();
  let y = 0;
  for (const id of ids) {
    const part = createRocketPart(id);
    part.position.y = y;
    group.add(part);
    y += part.userData.height ?? 0;
  }
  return group;
}

function createLander({ wrecked = false } = {}) {
  const group = new THREE.Group();
  const body = stack(['engine_m', 'tank_m', 'capsule_m']);
  body.position.y = 0.5;
  const legs = createRocketPart('legs_m');
  legs.position.y = 0.9;
  group.add(body, legs);
  if (wrecked) {
    // Three years of dust, and a landing that ended a few degrees off vertical.
    group.rotation.set(0.09, 0.8, -0.14);
    group.traverse((o) => {
      if (!o.isMesh) return;
      const dust = (m) => {
        if (!m.color) return m;
        const c = m.clone();
        c.color.lerp(new THREE.Color(0.2, 0.1, 0.055), 0.82);
        c.envMapIntensity = 0.08;
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(dust) : dust(o.material);
    });
  }
  return group;
}

function register(name, factory) {
  factories.set(name, factory);
}

register('cockpit', createCockpit);
register('cabin', createCabin);
register('vfx:engineFlame', createEngineFlame);
register('vfx:exhaust', createExhaust);
register('vfx:entryPlasma', createEntryPlasma);
register('vfx:landingDust', createLandingDust);
register('planet:earth', () => createPlanet('earth'));
register('planet:mars', () => createPlanet('mars'));
register('sky:space', createSpaceSky);
register('lander', () => createLander());
for (const [name, factory] of Object.entries(PROPS)) register(name, factory); // mission props: src/graphics/props.js

/**
 * Visuals behind names. Gameplay asks for a name and always gets an Object3D back, so art can be swapped later
 * with nobody else's code changing. Each call returns a new object.
 */
export const assets = {
  get(name) {
    if (name.startsWith('rocketPart:')) return createRocketPart(name.slice('rocketPart:'.length));
    const factory = factories.get(name);
    if (factory) return factory();
    if (!warned.has(name)) {
      warned.add(name);
      console.warn(`[assets] "${name}" has no art yet, showing a hologram`);
    }
    return hologram(name);
  },
  /** Resolves when the real maps of the given `planet:*` names are ready, so get() never shows a placeholder. Other names are ignored. */
  preload: (names) => Promise.all(names.filter((n) => n.startsWith('planet:')).map((n) => loadPlanetMaps(n.slice(7)))).then(() => {}),
  has: (name) => factories.has(name) || name.startsWith('rocketPart:'),
  names: () => [...factories.keys(), 'rocketPart:<id>'],
  register,
  environment: interiorEnvironment,
};
