// 3D art for the launch pad under the vehicle in the design studio. Owned by whoever builds the pad section.
// padArt(state, { radius, height, layout }) → { object: THREE.Object3D, top: metres } where `top` is the height the
// vehicle stands on. state = padState() from sections.js: { site, slot, equipment: [{ eq, option }] }; layout = the
// vehicle's layout entries (heights above the vehicle's base), used to fit the arms and clamps to the real hull.
//
// Everything is procedural and modelled on real pads: LC-39A/B at Kennedy (flame trench, mobile launcher platform,
// fixed and rotating service structures, water tower and rainbirds, catenary lightning towers, slidewire escape
// baskets, cryogenic spheres), SpaceX's strongback, Saturn V hold-down arms. The pieces are merged into one mesh per
// material, so the studio draws the whole pad in about a dozen draw calls every frame.
//
// Layout (in the pad's own frame, before it is turned): the service tower stands on +x. The pad is then turned so the
// tower sits behind and to the right of the vehicle as the studio first frames it, at 67.5°: between the 45° legs and
// the 90° fins, clear of the side boosters that shapes put at 0° and 180°. The tower and strongback also step back
// from any side part that reaches out towards them (from `layout`).
import * as THREE from 'three';
import { BASE_RADIUS, SIZE_SCALE } from '../../assembly.js';
import * as noseArt from '../nose/art.js'; // read-only: the real surface radius of a capsule (surfaceRadius)

const DEG = Math.PI / 180;
const FACING_DEG = 67.5; // where the tower ends up (radial-part angle convention: 0° = +x, 90° = -z)
const FACING = FACING_DEG * DEG;
// Shapes put fins at 0/90/180/270° (or 45°…), landing legs at 45/135/225/315° and side boosters at 0/180°: the gear at
// the ship's base goes in between, at 22.5° + k·45° (world angles, turned into the pad's frame here).
const wa = (worldDeg) => worldDeg - FACING_DEG;

const mat = (color, roughness = 0.7, metalness = 0.1) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const M = {
  concrete: mat(0xa7a8a4, 0.95, 0.02),
  concreteOld: mat(0x7d7c76, 0.95, 0.02),
  scorch: mat(0x2c2925, 1, 0),
  trench: mat(0x18191b, 1, 0),
  brick: mat(0x8c5b45, 0.95, 0),
  steel: mat(0x9ea5ab, 0.45, 0.7),
  steelDark: mat(0x4a5158, 0.55, 0.6),
  deck: mat(0x7f878d, 0.6, 0.45),
  red: mat(0xb3472f, 0.6, 0.3),
  grey: mat(0x8d949a, 0.55, 0.45),
  white: mat(0xe6e8ea, 0.5, 0.08),
  glass: mat(0x24313c, 0.25, 0.3),
  yellow: mat(0xe0b03a, 0.5, 0.2),
  wire: mat(0x2a2d31, 0.6, 0.5),
  rubber: mat(0x1b1c1e, 0.9, 0),
};

// ---------- ground: a soft disc of the site's own land ----------
const GROUNDS = {
  cape: { base: '#b9ad87', spots: ['#78814f', '#cdc29c', '#8e9160'] }, // sand and palmetto scrub
  vandenberg: { base: '#a8925b', spots: ['#5f6a43', '#c3ad73', '#7a7a4c'] }, // dry golden grass, chaparral
  starbase: { base: '#d2c59f', spots: ['#b3a481', '#e3d9b9', '#9c9375'] }, // beach sand, tidal flats
  kourou: { base: '#4d7237', spots: ['#8b5337', '#3a5d2a', '#6a8a45'] }, // rain forest, red laterite
  baikonur: { base: '#a99c77', spots: ['#8b8a69', '#c0b48f', '#9a8c66'] }, // dusty steppe
  plesetsk: { base: '#3f5435', spots: ['#2b3c26', '#56684a', '#6f7a66'] }, // taiga
  wenchang: { base: '#58873f', spots: ['#c8bc93', '#44703a', '#7a9e55'] }, // tropical green and sand
  tanegashima: { base: '#5a8a44', spots: ['#3e6a33', '#7ca35a', '#b9b08a'] }, // green hills by the sea
  mahia: { base: '#76984f', spots: ['#5d7e3e', '#93ad66', '#a9a27a'] }, // sheep pasture
};
const groundTextures = new Map();
function groundTexture(id, snow = false) {
  const site = GROUNDS[id] ? id : 'cape';
  const key = snow ? `${site}:snow` : site;
  if (groundTextures.has(key)) return groundTextures.get(key);
  if (typeof document === 'undefined') return null;
  const g = GROUNDS[site];
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = g.base;
  ctx.fillRect(0, 0, 256, 256);
  let seed = [...site].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 420; i++) {
    ctx.globalAlpha = 0.2 + rnd() * 0.5;
    ctx.fillStyle = g.spots[i % g.spots.length];
    ctx.beginPath();
    ctx.ellipse(rnd() * 256, rnd() * 256, 1.5 + rnd() * 11, 1.5 + rnd() * 7, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  if (snow) {
    // below freezing: a thin cover of snow, the darker ground showing through in patches
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#e9eef2';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) {
      ctx.globalAlpha = 0.3 + rnd() * 0.5;
      ctx.fillStyle = i % 3 ? '#f4f7f9' : '#cfd8de';
      ctx.beginPath();
      ctx.ellipse(rnd() * 256, rnd() * 256, 2 + rnd() * 12, 2 + rnd() * 8, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // fade to nothing at the rim so the land melts into the dark studio
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'destination-in';
  const grad = ctx.createRadialGradient(128, 128, 40, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.65, 'rgba(0,0,0,0.9)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  groundTextures.set(key, tex);
  return tex;
}

// ---------- a kit of pieces merged into one mesh per material ----------
class Kit {
  constructor() { this.byMat = new Map(); this.stack = [new THREE.Matrix4()]; }
  push(m) { this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m)); }
  pop() { this.stack.pop(); }
  add(geo, material, m = null) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const top = this.stack[this.stack.length - 1];
    g.applyMatrix4(m ? top.clone().multiply(m) : top);
    if (!this.byMat.has(material)) this.byMat.set(material, []);
    this.byMat.get(material).push(g);
  }
  build(group) {
    for (const [material, list] of this.byMat) {
      let n = 0;
      for (const g of list) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let at = 0;
      for (const g of list) {
        pos.set(g.attributes.position.array, at * 3);
        nor.set(g.attributes.normal.array, at * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, at * 2);
        at += g.attributes.position.count;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = !material.userData.flat;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
}

// unit pieces, scaled into place (only ever cloned, never drawn themselves)
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
const CONE = new THREE.CylinderGeometry(0.15, 1, 1, 10);
const SPH = new THREE.SphereGeometry(1, 20, 14);
const Y = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

function trs(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
}
const turn = (deg) => new THREE.Matrix4().makeRotationY(deg * DEG);
/** A box of w × h × d centred at (x, y, z). */
const box = (kit, m, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) => kit.add(BOX, m, trs(x, y, z, w, h, d, rx, ry, rz));
/** A vertical cylinder of radius r from y0 up h. */
const post = (kit, m, r, h, x, y0, z, geo = CYL) => kit.add(geo, m, trs(x, y0 + h / 2, z, r, h, r));
const sphere = (kit, m, r, x, y, z, sy = 1) => kit.add(SPH, m, trs(x, y, z, r, r * sy, r));
/** A straight member from a to b ([x, y, z]); thickness t (a box) or radius t (geo = CYL8). */
function beam(kit, m, a, b, t, geo = BOX) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const len = d.length();
  if (len < 1e-4) return;
  _q.setFromUnitVectors(Y, d.divideScalar(len));
  kit.add(geo, m, new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), _q, _s.set(t, len, t)));
}
const pipe = (kit, m, a, b, r) => beam(kit, m, a, b, r, CYL8);
/** A hanging cable from a to b that sags `sag` metres in the middle; returns its curve. */
function cable(kit, m, a, b, sag, r = 0.035) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  mid.y -= sag * 2; // a quadratic curve's middle point sits half way to its control point
  const curve = new THREE.QuadraticBezierCurve3(A, mid, B);
  const g = new THREE.TubeGeometry(curve, 24, r, 5, false);
  kit.add(g, m);
  g.dispose();
  return curve;
}
/** A flat disc on the ground (or any level). */
function disc(kit, m, r, x, y, z, segs = 40) {
  const g = new THREE.CircleGeometry(r, segs);
  kit.add(g, m, trs(x, y, z, 1, 1, 1, -Math.PI / 2));
  g.dispose();
}
/** A polygon of [x, z] points extruded up from y0 by h. */
function prism(kit, m, pts, y0, h) {
  if (pts.length < 3) return;
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  kit.add(g, m, trs(0, y0, 0, 1, 1, 1, -Math.PI / 2));
  g.dispose();
}
/** Keeps the part of a polygon where nx·x + nz·z >= c (one Sutherland–Hodgman pass). */
function clip(pts, nx, nz, c) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const da = nx * a[0] + nz * a[1] - c, db = nx * b[0] + nz * b[1] - c;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
const octagon = (r) => Array.from({ length: 8 }, (_, k) => { const a = (22.5 + 45 * k) * DEG; return [Math.cos(a) * r, Math.sin(a) * r]; });
/** A point at angle a (degrees, 0 = +x, 90 = -z) and distance d. */
const polar = (a, d) => [Math.cos(a * DEG) * d, -Math.sin(a * DEG) * d];

/** A square lattice tower: four columns, a ring of beams every bay, alternating diagonals on each face. */
function lattice(kit, m, { x = 0, z = 0, w, d = w, y0, y1, bay = 2.4, t = 0.16, ry = 0 }) {
  kit.push(trs(x, 0, z, 1, 1, 1, 0, ry * DEG, 0));
  const hx = w / 2, hz = d / 2, h = y1 - y0;
  const n = Math.max(1, Math.round(h / bay)), step = h / n, tt = t * 0.7;
  for (const [cx, cz] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) box(kit, m, t, h, t, cx, y0 + h / 2, cz);
  for (let i = 0; i <= n; i++) {
    const y = y0 + i * step;
    box(kit, m, w, tt, tt, 0, y, -hz); box(kit, m, w, tt, tt, 0, y, hz);
    box(kit, m, tt, tt, d, -hx, y, 0); box(kit, m, tt, tt, d, hx, y, 0);
  }
  for (let i = 0; i < n; i++) {
    const a = y0 + i * step, b = a + step, f = i % 2 ? 1 : -1;
    beam(kit, m, [-hx * f, a, -hz], [hx * f, b, -hz], tt * 0.8);
    beam(kit, m, [hx * f, a, hz], [-hx * f, b, hz], tt * 0.8);
    beam(kit, m, [-hx, a, -hz * f], [-hx, b, hz * f], tt * 0.8);
    beam(kit, m, [hx, a, hz * f], [hx, b, -hz * f], tt * 0.8);
  }
  kit.pop();
}

/** A swing arm: a truss from the tower face (x0) to the ship (x1) at height y, with an umbilical plate at the ship. */
function swingArm(kit, m, x0, x1, y) {
  const L = x0 - x1, cx = (x0 + x1) / 2;
  for (const z of [-0.3, 0.3]) {
    box(kit, m, L, 0.09, 0.09, cx, y + 0.25, z);
    box(kit, m, L, 0.09, 0.09, cx, y - 0.25, z);
    const n = Math.max(1, Math.round(L / 0.6));
    for (let i = 0; i < n; i++) {
      const a = x1 + (L * i) / n, b = x1 + (L * (i + 1)) / n;
      beam(kit, m, [a, y - 0.25, z], [b, y + 0.25, z], 0.06);
    }
  }
  for (let i = 0; i <= Math.round(L / 0.6); i++) box(kit, m, 0.06, 0.06, 0.6, x1 + (L * i) / Math.max(1, Math.round(L / 0.6)), y + 0.25, 0);
  pipe(kit, M.rubber, [x0, y - 0.05, 0.12], [x1 + 0.1, y - 0.05, 0.12], 0.07); // the propellant line
  box(kit, M.steelDark, 0.14, 0.62, 0.7, x1 + 0.07, y, 0); // umbilical plate on the ship
}

/** Pushes a frame that swings an arm built along -x from the tower face x0 back against the tower (an empty stand). */
function swungBack(kit, x0, towerW) {
  kit.push(new THREE.Matrix4().makeTranslation(x0 - 0.4, 0, -towerW / 2 - 0.05).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(-x0, 0, 0)));
}

// ---------- the ship, read from its layout ----------
const sizeR = (letter) => BASE_RADIUS * (SIZE_SCALE[letter] ?? 1);
const angDiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
/** Surface radius of an axial part at a fraction f of its height. */
function surfaceOf(e, f) {
  const d = e.def ?? {};
  if (d.flags?.capsule) {
    const r = noseArt.surfaceRadius?.(d, Math.min(1, Math.max(0, f)), e.radius);
    return Number.isFinite(r) ? r : e.radius * (1 - 0.5 * f);
  }
  if (d.adapter) return sizeR(d.adapter.bottom) + (sizeR(d.adapter.top) - sizeR(d.adapter.bottom)) * f;
  if (d.engine) return e.radius * 0.55;
  if (!(d.nodes ?? []).includes('top')) return e.radius * Math.sqrt(Math.max(0.02, 1 - f * f)); // a nose cone or fairing
  return e.radius;
}
/** How far out a side part reaches (from the axis), how wide it is and over which heights (ship coordinates). */
function sideSpan(e) {
  const d = e.def ?? {}, h = d.height ?? e.height ?? 1, type = e.type ?? '';
  const w = (d.aero?.sideArea ?? 0.3) / Math.max(0.1, h);
  const inner = e.radius * 0.95;
  if (/leg/.test(type)) return { angle: e.angle, inner, reach: e.radius + (/falcon/.test(type) ? Math.min(3, Math.max(1.3, e.y * 0.85)) : 1.5), half: 0.3, ylo: 0, yhi: e.y + 0.3 };
  if (d.booster) { const bw = Math.max(0.6, w); return { angle: e.angle, inner, reach: e.radius + bw + 0.1, half: bw / 2, ylo: e.y - h * 0.3, yhi: e.y + h }; }
  if (/fin_grid/.test(type)) return { angle: e.angle, inner, reach: e.radius + 0.6, half: 0.5, ylo: e.y - 0.2, yhi: e.y + h };
  if (/fin/.test(type)) return { angle: e.angle, inner, reach: e.radius - 1.2 + Math.max(w, 0.68 * h) + 0.05, half: 0.1, ylo: e.y - 0.3 * h, yhi: e.y + h };
  const pw = /solar_wing/.test(type) ? Math.max(w, 0.42 * h) : Math.min(1.5, Math.max(0.3, w));
  return { angle: e.angle, inner, reach: e.radius + pw + 0.1, half: /solar/.test(type) ? 0.15 : 0.35, ylo: e.y - 0.1, yhi: e.y + h };
}
/** The hull, its side parts and the questions the pad asks of them. Heights are metres above the vehicle's base. */
function shipModel(layout) {
  const axial = (layout ?? []).filter((e) => e.attach === 'axial' && e.def).sort((a, b) => a.y - b.y);
  const sides = (layout ?? []).filter((e) => e.attach === 'radial' && e.def).map(sideSpan);
  const partAt = (h) => axial.find((e) => h >= e.y && h < e.y + e.height) ?? null;
  const hullAt = (h) => { const e = partAt(h); return e ? surfaceOf(e, (h - e.y) / e.height) : 0; };
  const hullMax = (h0, h1) => { let r = 0; for (let h = h0; h <= h1 + 1e-6; h += 0.1) r = Math.max(r, hullAt(h)); return r; };
  /** The farthest (along `angle`, world degrees) any side part reaches within `half` metres either side of that line. */
  const clearance = (angle, half) => {
    let best = 0;
    for (const sp of sides) {
      const dA = angDiff(sp.angle, angle) * DEG;
      if (Math.abs(dA) >= Math.PI / 2) continue;
      const lim = (half + sp.half + 0.3) / Math.max(1e-3, Math.abs(Math.sin(dA)));
      const rho = Math.min(sp.reach, lim);
      if (rho >= sp.inner) best = Math.max(best, rho * Math.cos(dA));
    }
    return best;
  };
  /** Is a piece coming in from `angle` between heights h0 and h1 (half-width `half`) in a side part's way? */
  const blocked = (angle, h0, h1, half = 0.35) => sides.some((sp) => {
    const dA = angDiff(sp.angle, angle) * DEG;
    if (Math.abs(dA) >= Math.PI / 2 || h1 < sp.ylo || h0 > sp.yhi) return false;
    return sp.inner * Math.abs(Math.sin(dA)) < half + sp.half + 0.1;
  });
  /** A height near h for an arm from `angle`: on a part's flank (not a joint, an engine or a nose tip) and clear of side parts. */
  const armHeight = (angle, h, avoid = []) => {
    for (const dh of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.6, -2.6]) {
      const hh = h + dh, e = partAt(hh);
      if (!e || e.def.engine) continue;
      const lo = hh - e.y, hi = e.y + e.height - hh;
      if (Math.min(lo, hi) < Math.min(0.3, e.height * 0.25)) continue;
      if (!(e.def.nodes ?? []).includes('top') && !e.def.flags?.capsule && lo / e.height > 0.5) continue;
      if (avoid.some((a) => Math.abs(a - hh) < 1.4)) continue;
      if (blocked(angle, hh - 0.45, hh + 0.45)) continue;
      return hh;
    }
    return null;
  };
  const capsule = axial.find((e) => e.def.flags?.capsule) ?? null;
  const lowest = axial.find((e) => !e.def.engine) ?? null;
  return { axial, sides, partAt, hullAt, hullMax, clearance, blocked, armHeight, capsule, lowest, empty: !axial.length };
}

// ---------- the pad ----------
export function padArt(state, { radius = 1.25, height = 20, layout = null } = {}) {
  const R = Math.max(0.9, radius || 1.25);
  const H = height > 0.5 ? height : 16; // an empty pad is sized for a typical ship
  const ship = shipModel(layout);
  const empty = ship.empty || !(height > 0.5);
  const pick = (key, fallback) => state?.equipment?.find((c) => c.eq.key === key)?.option?.id ?? fallback;
  const o = {
    mount: pick('mount', 'slab'), tower: pick('tower', 'none'), clamps: pick('clamps', 'none'), deluge: pick('deluge', 'none'),
    lightning: pick('lightning', 'none'), access: pick('access', 'none'), propellant: pick('propellant', 'manual'), weather: pick('weather', 'none'),
  };
  const kit = new Kit();

  // sizes shared by the pieces
  const hole = R * 1.9; // the opening under the ship
  const trenchW = R * 1.7;
  // tower width and its centre's distance from the ship's axis: back far enough to clear any side part reaching its way
  const towerW = 2.6, towerD = Math.max(R + 3.8, ship.clearance(FACING_DEG, towerW / 2) + towerW / 2 + 0.5);
  const mlpW = 2 * (towerD + towerW / 2 + 0.9), mlpD = Math.max(hole + 6, mlpW * 0.78);
  const RH = Math.max(8.5, R * 5.5, o.mount === 'mlp' ? Math.hypot(mlpW / 2, mlpD / 2) + 0.8 : 0); // hardstand radius

  // the site's land
  const tex = groundTexture(state?.site?.id, (state?.slot?.tempC ?? 10) < 0);
  const groundMat = new THREE.MeshStandardMaterial({ color: tex ? 0xffffff : 0x8a8466, map: tex, transparent: !!tex, roughness: 1, metalness: 0 });
  groundMat.userData.flat = true;
  disc(kit, groundMat, Math.max(26, RH + 14), 0, 0.015, 0, 64);

  // ----- launch mount and flame trench -----
  let hs, top; // hardstand height, height the ship stands on
  const oct = octagon(RH);
  if (o.mount === 'deflector') {
    hs = 1.2;
    const mountH = 3.0, S = hole + 1.4;
    top = hs + mountH;
    prism(kit, M.concrete, clip(oct, 1, 0, hole / 2), 0, hs);
    prism(kit, M.concrete, clip(clip(oct, -1, 0, -hole / 2), 0, 1, trenchW / 2), 0, hs);
    prism(kit, M.concrete, clip(clip(oct, -1, 0, -hole / 2), 0, -1, trenchW / 2), 0, hs);
    // the open channel the deflector throws the fire into, scorched beyond the pad
    box(kit, M.trench, RH + hole / 2, 0.12, trenchW, (hole / 2 - RH) / 2, 0.06, 0);
    box(kit, M.scorch, 7, 0.03, trenchW * 2.2, -RH - 3.2, 0.03, 0);
    // a sloped steel deflector under the ship
    const run = hole + 1.6, drop = hs - 0.15;
    box(kit, M.steelDark, Math.hypot(run, drop), 0.3, trenchW - 0.1, hole / 2 - run / 2, (hs + 0.15) / 2, 0, 0, 0, Math.atan2(drop, run));
    // the steel launch ring on four concrete legs
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) box(kit, M.concreteOld, 0.8, mountH - 0.5, 0.8, sx * (S / 2 - 0.4), hs + (mountH - 0.5) / 2, sz * (S / 2 - 0.4));
    box(kit, M.steel, S, 0.5, (S - hole) / 2, 0, top - 0.25, (S + hole) / 4);
    box(kit, M.steel, S, 0.5, (S - hole) / 2, 0, top - 0.25, -(S + hole) / 4);
    box(kit, M.steel, (S - hole) / 2, 0.5, hole, (S + hole) / 4, top - 0.25, 0);
    box(kit, M.steel, (S - hole) / 2, 0.5, hole, -(S + hole) / 4, top - 0.25, 0);
  } else if (o.mount === 'trench' || o.mount === 'mlp') {
    hs = 2.8;
    prism(kit, M.concrete, clip(oct, 1, 0, trenchW / 2), 0, hs);
    prism(kit, M.concrete, clip(oct, -1, 0, trenchW / 2), 0, hs);
    // trench floor running out past the pad both ways, heat-proof brick on its walls
    box(kit, M.trench, trenchW, 0.1, 2 * RH + 10, 0, 0.05, 0);
    for (const s of [-1, 1]) box(kit, M.brick, 0.06, hs - 0.3, 2 * RH * 0.88, s * (trenchW / 2 - 0.03), (hs - 0.3) / 2 + 0.1, 0);
    for (const s of [-1, 1]) box(kit, M.scorch, trenchW * 2.4, 0.03, 6, 0, 0.03, s * (RH + 5.5));
    // the two-way deflector: a steel roof under the ship that splits the fire along the trench
    const ridge = hs - 0.8, run = 2.8;
    for (const s of [-1, 1]) {
      const len = Math.hypot(run, ridge - 0.12);
      box(kit, M.steelDark, trenchW - 0.12, 0.3, len, 0, (ridge + 0.12) / 2, s * run / 2, 0, s * Math.atan2(ridge - 0.12, run));
    }
    if (o.mount === 'trench') {
      // a steel launch table spanning the trench
      const S = hole + 1.6, t = 0.7;
      top = hs + t;
      box(kit, M.steel, S, t, (S - hole) / 2, 0, hs + t / 2, (S + hole) / 4);
      box(kit, M.steel, S, t, (S - hole) / 2, 0, hs + t / 2, -(S + hole) / 4);
      box(kit, M.steel, (S - hole) / 2, t, hole, (S + hole) / 4, hs + t / 2, 0);
      box(kit, M.steel, (S - hole) / 2, t, hole, -(S + hole) / 4, hs + t / 2, 0);
    } else {
      // the mobile launcher platform: a two-storey steel deck on six pedestals, set down over the trench
      const ped = 1.3, deckH = 2.2, y0 = hs + ped;
      top = y0 + deckH;
      for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) box(kit, M.concreteOld, 1.3, ped, 1.3, sx * (mlpW / 2 - 1.3), hs + ped / 2, sz * (mlpD / 2 - 1.3));
      const side = (mlpW - hole) / 2, end = (mlpD - hole) / 2;
      box(kit, M.deck, side, deckH, mlpD, (mlpW + hole) / 4, y0 + deckH / 2, 0);
      box(kit, M.deck, side, deckH, mlpD, -(mlpW + hole) / 4, y0 + deckH / 2, 0);
      box(kit, M.deck, hole, deckH, end, 0, y0 + deckH / 2, (mlpD + hole) / 4);
      box(kit, M.deck, hole, deckH, end, 0, y0 + deckH / 2, -(mlpD + hole) / 4);
      // a darker band of side panels marks the two storeys
      box(kit, M.steelDark, mlpW + 0.04, 0.12, mlpD + 0.04, 0, y0 + deckH * 0.5, 0);
      // safety railings round the deck edge, and a few deck hatches
      for (const [len, cx, cz, alongX] of [[mlpW, 0, mlpD / 2 - 0.15, true], [mlpW, 0, -mlpD / 2 + 0.15, true], [mlpD, mlpW / 2 - 0.15, 0, false], [mlpD, -mlpW / 2 + 0.15, 0, false]]) {
        box(kit, M.yellow, alongX ? len - 0.3 : 0.06, 0.06, alongX ? 0.06 : len - 0.3, cx, top + 1.0, cz);
        const n = Math.round(len / 1.6);
        for (let i = 0; i <= n; i++) { const t = -len / 2 + 0.15 + ((len - 0.3) * i) / n; box(kit, M.yellow, 0.06, 1.0, 0.06, alongX ? t : cx, top + 0.5, alongX ? cz : t); }
      }
      for (const [hx, hz] of [[-mlpW * 0.32, mlpD * 0.28], [-mlpW * 0.32, -mlpD * 0.28], [mlpW * 0.18, mlpD * 0.33], [-mlpW * 0.12, -mlpD * 0.36]]) box(kit, M.steelDark, 1.2, 0.04, 0.9, hx, top + 0.02, hz);
      // two tail service masts beside the ship's base (a strongback carries its own umbilicals)
      for (const a of o.tower === 'strongback' ? [] : [wa(67.5), wa(247.5)]) {
        const [tx, tz] = polar(a, R + 1.4);
        box(kit, M.steelDark, 0.8, 2.2, 1.0, tx, top + 1.1, tz, a * DEG);
        box(kit, M.grey, 1.0, 0.35, 1.2, tx, top + 2.35, tz, a * DEG);
      }
      // the crawlerway ramp it came up, two gravel lanes
      const rampL = 12;
      box(kit, M.concreteOld, Math.hypot(rampL, hs), 0.4, 10, -RH - rampL / 2 + 0.6, hs / 2 - 0.15, 0, 0, 0, Math.atan2(hs, rampL));
      for (const s of [-1, 1]) box(kit, M.concreteOld, 14, 0.05, 3.2, -RH - rampL - 6, 0.04, s * 2.8);
    }
  } else {
    // a flat concrete slab, scorched where the engines fire straight down
    hs = 0.45;
    top = hs;
    prism(kit, M.concrete, oct, 0, hs);
    disc(kit, M.scorch, R * 2.6, 0, hs + 0.012, 0);
  }
  const base = o.mount === 'mlp' ? top : hs; // where towers stand
  const y = (f) => top + H * f; // a height on the ship, as a fraction of its length
  const towerTop = top + H * 1.1 + 1.5; // a little taller than the ship
  const hull = (h) => (empty ? 1.25 : ship.hullAt(h)); // hull radius at h metres above the ship's base

  // a small umbilical mast at the base: how propellant and power get in when nothing else reaches the ship
  if (o.tower !== 'strongback' && o.mount !== 'mlp') {
    kit.push(turn(wa(67.5)));
    box(kit, M.steelDark, 0.6, top + 1.4 - hs, 0.6, R + 1.1, hs + (top + 1.4 - hs) / 2, 0);
    box(kit, M.steelDark, 0.9, 0.3, 0.35, R + 0.55, top + 0.9, 0);
    pipe(kit, M.rubber, [R + 1.1, top + 0.6, 0.25], [R + 0.15, top + 0.7, 0.25], 0.07);
    kit.pop();
  }

  // ----- where the crew boards: the capsule's mid-height (or near the top of an uncrewed ship) -----
  const access = o.access !== 'none';
  let crewH = ship.capsule ? ship.capsule.y + ship.capsule.height / 2 : Math.max(H * 0.55, H - 2.0);
  if (access && !empty) {
    const ca = FACING_DEG + (o.tower === 'strongback' ? 55 : 0);
    if (ship.capsule) {
      const c = ship.capsule;
      for (const dh of [0, 0.25, -0.25, 0.45, -0.45]) {
        const hh = c.y + c.height / 2 + dh;
        if (!ship.blocked(ca, hh - 0.45, hh + 0.45)) { crewH = hh; break; }
      }
    } else crewH = ship.armHeight(ca, crewH) ?? crewH;
  }
  const accessY = top + crewH;
  const fit = { towerD: +towerD.toFixed(2), crewH: access ? +crewH.toFixed(2) : null, arms: [] }; // what the art fitted to, for checks
  let crew = null; // { angle, d, w, own } the tower that carries the crew access arm

  // ----- service tower -----
  if (o.tower === 'fixed' || o.tower === 'rss') {
    lattice(kit, M.red, { x: towerD, w: towerW, y0: base, y1: towerTop, bay: 2.4, t: 0.18 });
    box(kit, M.red, towerW * 2.4, 0.35, 0.4, towerD - towerW * 0.5, towerTop + 0.2, 0); // hammerhead crane
    box(kit, M.red, 0.6, 1.2, 0.6, towerD, towerTop + 0.6, 0);
    // swing arms at three levels, each moved onto the flank of a part and reaching that part's own hull
    const x0 = towerD - towerW / 2;
    const used = access ? [crewH] : [];
    for (const f of [0.3, 0.58, 0.84]) {
      const hh = empty ? H * f : ship.armHeight(FACING_DEG, H * f, used);
      if (hh == null || (empty && access && Math.abs(hh - crewH) < 1.4)) continue;
      used.push(hh);
      fit.arms.push([+hh.toFixed(2), +((empty ? 1.25 : ship.hullMax(hh - 0.31, hh + 0.31))).toFixed(2)]);
      box(kit, M.grey, towerW + 0.6, 0.12, towerW + 0.6, towerD, top + hh - 0.32, 0); // service floor
      if (empty) swungBack(kit, x0, towerW);
      swingArm(kit, M.red, x0, (empty ? 1.25 : ship.hullMax(hh - 0.31, hh + 0.31)) + 0.02, top + hh);
      if (empty) kit.pop();
    }
    if (access) crew = { angle: 0, d: towerD, w: towerW };
    if (o.tower === 'rss') {
      // the rotating service structure, swung back 120° on its hinge column beside the tower
      const Dr = 2.6, P = [towerD - towerW / 2 - 0.1, -(R + 0.2 + Dr / 2)];
      const Lr = P[0] + R + 1.2, yb = y(0.28), yt = y(0.93);
      kit.push(trs(P[0], 0, P[1], 1, 1, 1, 0, -120 * DEG, 0));
      box(kit, M.white, Lr, yt - yb, Dr, -Lr / 2, (yb + yt) / 2, 0);
      for (let k = 1; k < 4; k++) box(kit, M.grey, Lr + 0.06, 0.14, Dr + 0.06, -Lr / 2, yb + ((yt - yb) * k) / 4, 0);
      box(kit, M.glass, 0.06, (yt - yb) * 0.7, Dr * 0.6, -Lr - 0.01, (yb + yt) / 2, 0); // the payload changeout room doors
      post(kit, M.steel, 0.35, yt - base, 0, base, 0); // hinge column
      for (const z of [-Dr / 2 + 0.3, Dr / 2 - 0.3]) box(kit, M.grey, 0.4, yb - base, 0.4, -Lr + 0.4, base + (yb - base) / 2, z);
      box(kit, M.steelDark, 1.2, 0.6, Dr, -Lr + 0.4, base + 0.3, 0); // wheel truck on the rail
      kit.pop();
      const rail = new THREE.TorusGeometry(Lr - 0.4, 0.07, 4, 36, 120 * DEG);
      kit.add(rail, M.steel, trs(P[0], base + 0.05, P[1], 1, 1, 1, -Math.PI / 2, 60 * DEG, 0));
      rail.dispose();
    }
  } else if (o.tower === 'strongback') {
    // close to the ship, but clear of the fins, legs and boosters near it
    const depth = 1.0, W = Math.max(2.0, R * 1.5);
    const x0 = Math.max(R + 1.0, ship.clearance(FACING_DEG, W / 2) + 0.35), sbTop = y(1.02), px = x0 + depth;
    fit.strongback = +x0.toFixed(2);
    kit.push(new THREE.Matrix4().makeTranslation(px, base, 0).multiply(new THREE.Matrix4().makeRotationZ(-4 * DEG)).multiply(new THREE.Matrix4().makeTranslation(-px, -base, 0)));
    lattice(kit, M.white, { x: x0 + depth / 2, w: depth, d: W, y0: base + 0.4, y1: sbTop, bay: 2.0, t: 0.24 });
    const used = [];
    for (const f of [0.22, 0.52, 0.82]) {
      // clamp arms, opened: they stop a hand's width off the hull at their own height
      const hh = empty ? H * f : ship.armHeight(FACING_DEG, H * f, used);
      if (hh == null) continue;
      used.push(hh);
      const xt = (empty ? 1.25 : ship.hullMax(hh - 0.35, hh + 0.35)) + 0.25, len = Math.max(0.3, x0 - xt);
      box(kit, M.white, len, 0.3, 0.3, x0 - len / 2, top + hh, 0);
      box(kit, M.steelDark, 0.12, 0.7, 1.1, x0 - len - 0.06, top + hh, 0); // clamp jaws, open
    }
    pipe(kit, M.rubber, [x0 + 0.05, base + 0.6, W / 2 - 0.2], [x0 + 0.05, y(0.85), W / 2 - 0.2], 0.08);
    kit.pop();
    // the transporter-erector it stands on, and its lifting pistons
    box(kit, M.grey, 3.6, 0.6, W + 0.6, px + 1.6, base + 0.3, 0);
    for (const s of [-1, 1]) pipe(kit, M.steel, [px + 2.9, base + 0.6, s * (W / 2 - 0.2)], [px + Math.sin(4 * DEG) * H * 0.3, y(0.3), s * (W / 2 - 0.2)], 0.14);
    if (access) crew = { angle: 55, d: Math.max(towerD, ship.clearance(FACING_DEG + 55, 1.0) + 1.5), w: 2.0, own: true };
  } else if (access) {
    crew = { angle: 0, d: Math.max(R + 3.8, ship.clearance(FACING_DEG, 1.0) + 1.5), w: 2.0, own: true };
  }

  // ----- crew access arm and escape -----
  if (crew) {
    kit.push(turn(crew.angle));
    if (crew.own) {
      // a slim stair tower just for the crew
      lattice(kit, M.grey, { x: crew.d, w: crew.w, y0: base, y1: accessY + 2.6, bay: 2.2, t: 0.15 });
      box(kit, M.grey, crew.w + 0.5, 0.15, crew.w + 0.5, crew.d, accessY + 2.6, 0);
    }
    const x0 = crew.d - crew.w / 2, room = 1.5;
    box(kit, M.grey, crew.w + 0.6, 0.14, crew.w + 0.6, crew.d, accessY - 1.05, 0); // crew level
    // the white room stands off the widest hull beside it; a short boxed seal reaches in to the capsule wall at the hatch
    const rHatch = hull(crewH), xr = (empty ? 1.25 : ship.hullMax(crewH - 0.95, crewH + 1.05)) + 0.03;
    fit.crew = [+rHatch.toFixed(2), +xr.toFixed(2), +crew.d.toFixed(2)];
    if (empty) swungBack(kit, x0, crew.w);
    box(kit, M.white, x0 - (xr + room), 1.9, 1.3, (x0 + xr + room) / 2, accessY, 0); // the walkway
    for (const s of [-1, 1]) box(kit, M.glass, x0 - (xr + room) - 0.2, 0.35, 0.04, (x0 + xr + room) / 2, accessY + 0.35, s * 0.66);
    box(kit, M.white, room, 2.0, 1.8, xr + room / 2, accessY + 0.05, 0); // the white room at the hatch
    box(kit, M.grey, room + 0.1, 0.12, 1.9, xr + room / 2, accessY + 1.1, 0);
    if (!empty && xr - rHatch > 0.04) box(kit, M.grey, xr - rHatch + 0.04, 1.1, 1.1, (xr + rHatch) / 2, accessY + 0.05, 0); // the hatch seal
    if (empty) kit.pop();
    if (o.access === 'slidewire') {
      // steel wires from the crew level down to a bunker, escape baskets parked at the top
      const xs = crew.d + crew.w / 2, xe = crew.d + 17;
      for (const z of [-0.8, -0.27, 0.27, 0.8]) {
        const curve = cable(kit, M.wire, [xs, accessY - 0.3, z], [xe, 0.9, z * 1.6], 0.6, 0.025);
        const p = curve.getPoint(0.05);
        box(kit, M.wire, 0.03, 0.5, 0.03, p.x, p.y - 0.25, p.z);
        box(kit, M.yellow, 0.75, 0.55, 0.55, p.x, p.y - 0.75, p.z);
        box(kit, M.yellow, 0.85, 0.06, 0.65, p.x, p.y - 0.42, p.z);
      }
      for (const s of [-1, 1]) post(kit, M.steel, 0.1, 2.4, xe - 0.5, 0, s * 2.2); // catch-net posts
      box(kit, M.concreteOld, 3.2, 1.7, 3.6, xe + 2.4, 0.85, 0); // the bunker
      box(kit, M.concreteOld, 4.4, 0.8, 4.8, xe + 2.4, 0.4, 0);
      box(kit, M.trench, 0.05, 1.1, 1.0, xe + 0.79, 0.75, 0);
    }
    kit.pop();
  }

  // ----- hold-down clamps: they grip the bottom of the lowest part above the engines -----
  if (o.clamps === 'hold' || o.clamps === 'release') {
    const big = o.clamps === 'release';
    const gy = Math.min(4.5, Math.max(0.5, ship.lowest ? ship.lowest.y : 0.6)); // grip height above the ship's base
    const rg = ship.lowest ? surfaceOf(ship.lowest, 0.02) : R;
    const rc = rg + (big ? 0.75 : 0.5); // the column's distance from the axis
    fit.grip = [+gy.toFixed(2), +rg.toFixed(2)];
    for (const a0 of [22.5, 112.5, 202.5, 292.5]) {
      // the usual angle, or a little either side if a side part comes down there
      const a = [a0, a0 + 11.25, a0 - 11.25].find((t) => empty || !ship.blocked(t, 0, gy + 0.3, 0.4));
      if (a == null) continue;
      kit.push(turn(wa(a)));
      if (big) {
        // a Saturn-style hold-down arm: a heavy column, its blast hood, the arm over the rim, a controlled-release pin
        box(kit, M.steelDark, 1.0, 0.5, 0.9, rc, top + 0.25, 0);
        box(kit, M.steelDark, 0.55, gy, 0.6, rc, top + gy / 2, 0);
        box(kit, M.steel, 0.6, 0.45, 0.75, rc + 0.05, top + gy + 0.3, 0, 0, 0, 0.35);
        beam(kit, M.steel, [rc, top + gy + 0.05, 0], [rg - 0.12, top + gy + 0.05, 0], 0.24);
        box(kit, M.steel, 0.12, 0.42, 0.4, rg - 0.12, top + gy - 0.08, 0);
        post(kit, M.yellow, 0.07, 0.7, rc, top + Math.max(0.5, gy - 0.6), 0.48, CYL8);
      } else {
        // a clamp column with a jaw that hooks under the rim, and its hydraulic cylinder
        box(kit, M.steel, 0.6, 0.35, 0.5, rc, top + 0.18, 0);
        box(kit, M.steel, 0.32, gy, 0.36, rc, top + gy / 2, 0);
        box(kit, M.steel, rc - rg + 0.3, 0.16, 0.34, (rc + rg - 0.12) / 2, top + gy - 0.1, 0);
        box(kit, M.steelDark, 0.1, 0.3, 0.34, rg + 0.07, top + gy + 0.05, 0);
        pipe(kit, M.steelDark, [rc + 0.35, top + 0.05, 0], [rc + 0.12, top + gy * 0.8, 0], 0.06);
      }
      kit.pop();
    }
  }

  // ----- sound suppression water -----
  if (o.deluge === 'water' || o.deluge === 'tower') {
    const ringR = o.mount === 'slab' ? R * 1.6 : hole * 0.62 + 0.25;
    const ring = new THREE.TorusGeometry(ringR, 0.1, 6, 40);
    kit.add(ring, M.steel, trs(0, top + 0.12, 0, 1, 1, 1, Math.PI / 2));
    ring.dispose();
    for (let k = 0; k < 12; k++) {
      const [nx, nz] = polar(k * 30 + 15, ringR - 0.12);
      post(kit, M.steelDark, 0.05, 0.16, nx, top + 0.12, nz, CYL8);
    }
    // the feed: out to the edge of the mount, down to the pad, then away along the concrete
    const fa = wa(300);
    const edge = o.mount === 'deflector' ? (hole + 1.4) / 2 + 0.25 : o.mount === 'trench' ? (hole + 1.6) / 2 + 0.25 : ringR + 1.1;
    const at = (r, h) => { const [px, pz] = polar(fa, r); return [px, h, pz]; };
    pipe(kit, M.steel, at(ringR, top + 0.12), at(edge, top + 0.12), 0.1);
    if (o.mount !== 'mlp') {
      if (top - hs > 0.2) pipe(kit, M.steel, at(edge, top + 0.17), at(edge, hs + 0.07), 0.1);
      pipe(kit, M.steel, at(edge, hs + 0.12), at(RH * 0.85, hs + 0.12), 0.1);
    }
    if (o.deluge === 'tower') {
      // rainbird nozzles around the ship, and the tall water tower that feeds them
      const rbY = o.mount === 'slab' || o.mount === 'mlp' ? top : hs;
      const rbR = o.mount === 'mlp' ? hole * 0.5 + 1.6 : o.mount === 'slab' ? R * 2.4 : (hole + 1.6) / 2 + 1.0;
      for (let k = 0; k < 6; k++) {
        const a = wa(k * 60 + 30);
        const [bx, bz] = polar(a, rbR), [nx, nz] = polar(a, rbR - 0.6);
        post(kit, M.steel, 0.12, 1.4, bx, rbY, bz, CYL8);
        pipe(kit, M.steel, [bx, rbY + 1.35, bz], [nx, rbY + 1.6, nz], 0.1);
        post(kit, M.steelDark, 0.16, 0.25, nx, rbY + 1.5, nz, CYL8);
      }
      const [wx, wz] = polar(80, 14);
      const wh = Math.max(12, H * 0.75 + 4);
      for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) beam(kit, M.grey, [wx + dx * 1.9, 0, wz + dz * 1.9], [wx + dx * 1.2, wh, wz + dz * 1.2], 0.22);
      for (let h = 3; h < wh; h += 3.5) box(kit, M.grey, 2.9 - (h / wh) * 1.2, 0.14, 2.9 - (h / wh) * 1.2, wx, h, wz);
      post(kit, M.steel, 0.35, wh, wx, 0, wz); // riser
      post(kit, M.white, 2.2, 3.4, wx, wh, wz);
      sphere(kit, M.white, 2.2, wx, wh + 3.4, wz, 0.45);
      pipe(kit, M.steel, [wx, 0.25, wz], [wx * 0.45, 0.25, wz * 0.45], 0.25);
    }
  }

  // ----- lightning protection -----
  if (o.lightning === 'mast') {
    let mx, mz, mt;
    if (o.tower === 'fixed' || o.tower === 'rss') { mx = towerD; mz = 0; mt = towerTop + 1.2; }
    else {
      [mx, mz] = polar(-30, 8.5);
      mt = towerTop;
      lattice(kit, M.grey, { x: mx, z: mz, w: 1.1, y0: 0, y1: mt, bay: 2.6, t: 0.14 });
    }
    const mh = Math.max(5, H * 0.28);
    kit.add(CONE, M.white, trs(mx, mt + mh / 2, mz, 0.22, mh, 0.22));
    // the cable from the mast tip to an anchor on each side
    const dir = o.tower === 'fixed' || o.tower === 'rss' ? [0, 1] : [-Math.sin(30 * DEG), Math.cos(30 * DEG)];
    for (const s of [-1, 1]) {
      const ax = mx + s * dir[0] * 13, az = mz + s * dir[1] * 13;
      cable(kit, M.wire, [mx, mt + mh - 0.3, mz], [ax, 0.5, az], 1.2, 0.03);
      box(kit, M.concreteOld, 0.9, 0.6, 0.9, ax, 0.3, az);
    }
  } else if (o.lightning === 'catenary') {
    const Rc = Math.max(12.5, R * 7.5), hc = top + H * 1.45 + 3, mh = Math.max(5, H * 0.3);
    const tops = [];
    for (const a of [20, 140, 260]) {
      const [cx, cz] = polar(a, Rc);
      lattice(kit, M.grey, { x: cx, z: cz, w: 1.0, y0: 0, y1: hc, bay: 3, t: 0.12, ry: a });
      kit.add(CONE, M.white, trs(cx, hc + mh / 2, cz, 0.25, mh, 0.25));
      tops.push([cx, hc + mh * 0.8, cz]);
      const [ox, oz] = polar(a, Rc + 9);
      cable(kit, M.wire, [cx, hc + mh * 0.8, cz], [ox, 0.5, oz], 1.0, 0.035);
      box(kit, M.concreteOld, 0.9, 0.6, 0.9, ox, 0.3, oz);
    }
    for (let k = 0; k < 3; k++) cable(kit, M.wire, tops[k], tops[(k + 1) % 3], 3.0, 0.035);
  }

  // ----- propellant loading -----
  const feed = (x, z, r = 0.2) => {
    // a pipe along the ground from storage to the pad's edge, then up to the umbilical
    const len = Math.hypot(x, z), ex = (x / len) * RH * 0.9, ez = (z / len) * RH * 0.9;
    pipe(kit, M.steel, [x, 0.3, z], [ex, 0.3, ez], r);
  };
  if (o.propellant === 'manual') {
    // a road tanker backed up to the pad, its hose run up onto the concrete
    const rc = RH + 3.8;
    const [tx, tz] = polar(150, rc);
    kit.push(trs(tx, 0, tz, 1, 1, 1, 0, 150 * DEG, 0));
    box(kit, M.steelDark, 6.0, 0.35, 1.9, 0, 0.75, 0);
    kit.add(CYL, M.steel, trs(-0.7, 1.75, 0, 0.95, 4.4, 0.95, 0, 0, Math.PI / 2));
    box(kit, M.white, 1.5, 2.0, 2.0, 2.2, 1.55, 0);
    box(kit, M.glass, 0.05, 0.6, 1.7, 2.96, 2.05, 0);
    for (const wx of [-2.2, -1.3, 2.3]) for (const s of [-1, 1]) kit.add(CYL, M.rubber, trs(wx, 0.5, s * 0.95, 0.5, 0.35, 0.5, Math.PI / 2));
    kit.pop();
    const [hx0, hz0] = polar(150, rc - 3.0), [ex, ez] = polar(150, RH - 0.5);
    cable(kit, M.rubber, [hx0, 1.0, hz0], [ex, hs + 0.15, ez], 0.3, 0.08);
  } else {
    // insulated storage spheres, the oxidiser (bigger) and the fuel
    for (const [a, r] of [[105, 2.4], [124, 2.0]]) {
      const [sx, sz] = polar(a, 15.5);
      const legH = 1.5;
      for (let k = 0; k < 8; k++) { const [lx, lz] = polar(k * 45, r * 0.7); post(kit, M.grey, 0.12, legH + r * 0.6, sx + lx, 0, sz + lz, CYL8); }
      sphere(kit, M.white, r, sx, legH + r, sz);
      box(kit, M.grey, 1.0, 0.1, 1.0, sx, legH + 2 * r + 0.05, sz);
      feed(sx, sz);
    }
    if (o.propellant === 'loadgo') {
      // the propellant chilling plant: storage bullets and a heat exchanger with its fans
      const [cx, cz] = polar(210, 16);
      kit.push(trs(cx, 0, cz, 1, 1, 1, 0, 120 * DEG, 0));
      for (const s of [-1, 1]) {
        kit.add(CYL, M.white, trs(0, 1.3, s * 1.2, 0.85, 4.2, 0.85, 0, 0, Math.PI / 2));
        for (const e of [-1, 1]) sphere(kit, M.white, 0.85, e * 2.1, 1.3, s * 1.2, 1);
        for (const e of [-1.4, 1.4]) box(kit, M.grey, 0.3, 0.7, 0.9, e, 0.35, s * 1.2);
      }
      box(kit, M.grey, 2.6, 1.8, 1.8, 0, 0.9, -3.4);
      for (const fx of [-0.8, 0, 0.8]) post(kit, M.steelDark, 0.38, 0.25, fx, 1.8, -3.4);
      kit.pop();
      feed(cx, cz, 0.16);
    }
  }

  // ----- weather watch -----
  if (o.weather === 'balloons' || o.weather === 'radar') {
    const [hx, hz] = polar(-50, 11);
    box(kit, M.white, 2.2, 1.8, 1.8, hx, 0.9, hz);
    box(kit, M.grey, 2.5, 0.15, 2.1, hx, 1.88, hz);
    // a weather balloon on its way up, and wind towers with cup anemometers
    sphere(kit, M.white, 0.7, hx - 1.5, 15, hz + 1.0, 1.1);
    box(kit, M.wire, 0.015, 1.6, 0.015, hx - 1.5, 13.4, hz + 1.0);
    for (const [a, d, h] of [[-50, 12.6, 10], [30, 9.5, 8], [280, 9.5, 8]]) {
      const [px, pz] = a === -50 ? [hx + 1.6, hz] : polar(a, d);
      post(kit, M.steel, 0.08, h, px, 0, pz, CYL8);
      for (const k of [0.55, 1]) { box(kit, M.steel, 1.0, 0.05, 0.05, px, h * k, pz); sphere(kit, M.steelDark, 0.09, px + 0.5, h * k + 0.08, pz); sphere(kit, M.steelDark, 0.09, px - 0.5, h * k + 0.08, pz); }
    }
  }
  if (o.weather === 'radar') {
    // a weather radar under its dome, and field mills that measure the charge in the air
    const [rx, rz] = polar(-35, 15);
    lattice(kit, M.grey, { x: rx, z: rz, w: 1.8, y0: 0, y1: 6, bay: 2, t: 0.15 });
    box(kit, M.grey, 2.4, 0.2, 2.4, rx, 6.1, rz);
    sphere(kit, M.white, 1.8, rx, 7.6, rz, 1);
    for (const a of [-100, -10, 75, 162, 220]) {
      const [fx, fz] = polar(a, 10.5);
      post(kit, M.steel, 0.06, 0.9, fx, 0, fz, CYL8);
      post(kit, M.steelDark, 0.28, 0.14, fx, 0.9, fz);
    }
  }

  const g = new THREE.Group();
  g.name = 'launch-pad';
  const inner = new THREE.Group();
  inner.rotation.y = FACING;
  kit.build(inner);
  g.add(inner);
  g.userData.padOptions = { site: state?.site?.id ?? null, ...o };
  g.userData.fit = fit;
  return { object: g, top };
}
