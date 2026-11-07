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

function lathe(points, material) {
  const curve = points.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.Mesh(new THREE.LatheGeometry(curve, 48), material);
}

function band(radius, y, height, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.008, radius + 0.008, height, 48, 1, true), material);
  mesh.position.y = y;
  return mesh;
}

// Each builder returns a part centred on the rocket's axis with its base at y = 0.
const PARTS = {
  capsule(s) {
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [1.25 * s, 0], [1.25 * s, 0.12 * s], [0.5 * s, 1.75 * s], [0.34 * s, 1.95 * s], [0, 1.98 * s]], pbr(WHITE, 0.45, 0.05)));
    g.add(band(0.96 * s, 0.72 * s, 0.05 * s, pbr(DARK, 0.5, 0.3)));
    const window = new THREE.Mesh(new THREE.CircleGeometry(0.2 * s, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.2, 1.5) }));
    window.position.set(0, 1.05 * s, 0.81 * s);
    window.rotation.x = -0.42;
    g.add(window);
    return g;
  },
  tank(s) {
    const r = 1.25, h = 4 * s;
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [r, 0], [r, h], [0, h]], pbr(WHITE, 0.4, 0.05)));
    g.add(band(r, 0.12, 0.08, pbr(DARK, 0.5, 0.3)), band(r, h - 0.12, 0.08, pbr(DARK, 0.5, 0.3)));
    return g;
  },
  engine(s) {
    const g = new THREE.Group();
    g.add(lathe([[1.0 * s, 0], [0.9 * s, 0.3 * s], [0.52 * s, 0.95 * s], [0.3 * s, 1.25 * s], [0.34 * s, 1.5 * s], [0.34 * s, 1.75 * s]], pbr(COPPER, 0.32, 0.9, { side: THREE.DoubleSide })));
    g.add(lathe([[0.42 * s, 1.5 * s], [0.5 * s, 1.75 * s], [0.5 * s, 2.15 * s], [0, 2.3 * s]], pbr(SILVER, 0.36, 0.85)));
    return g;
  },
  nose(s) {
    return lathe([[1.25 * s, 0], [1.05 * s, 0.9 * s], [0.62 * s, 1.9 * s], [0.18 * s, 2.7 * s], [0, 2.9 * s]], pbr(WHITE, 0.4, 0.05));
  },
  fin(s) {
    const shape = new THREE.Shape([[0, 0], [1.1 * s, -0.4 * s], [1.1 * s, 0.25 * s], [0, 1.6 * s]].map(([x, y]) => new THREE.Vector2(x, y)));
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false }), pbr(0x6b7178, 0.45, 0.4));
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
      if (o.isMesh && o.material.color) {
        o.material = o.material.clone();
        o.material.color.lerp(new THREE.Color(0.2, 0.1, 0.055), 0.82);
        o.material.envMapIntensity = 0.08;
      }
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
