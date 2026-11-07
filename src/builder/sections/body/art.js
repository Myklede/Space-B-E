// 3D art for the body section's own parts. Owned by whoever builds the body section.
// The shared code (bay/partArt.js, bay/internalsArt.js) asks here first and falls back to the procedural hardware in
// bay/partMeshes.js and the real NASA models (each part's `model` field) when these return null.
// Units: metres; a part stands on y = 0, centred on the stack axis (axial) or with its root at x = 0 pointing +x (radial).
//
// A tank with separate domes that sits next to another tank of the same propellant, or next to an intertank or centerbody
// (entry.above / entry.below), is one propellant of a pair: it is drawn as a single tank with one label and no band.
// Tanks read their look from the part's `look` field ({ skin, build, tanks: [[label, fraction], ...] top to bottom}) and
// from the player's choices: the material (stainless, carbon, titanium...) and the insulation option (foam, gold MLI)
// change the skin; a common bulkhead replaces the band between the two tanks with a single weld line. Stage structure
// shows its construction (stringers, isogrid, orthogrid, corrugated, carbon). Every axial part fills y = 0..height at
// exactly its radius, so stacked parts meet without gaps. Long side parts (feed line, raceway, wiring tunnel) are centred
// on their attach point, the way the stats count them; short ones stand on it.
import * as THREE from 'three';
import { std, canvasTexture } from '../../bay/util.js';
import bodyParts from './parts.json';

const BASE_R = 1.25;
const SCALE = { s: 0.75, m: 1, l: 1.35 };
const TAU = Math.PI * 2;
const BODY = Object.fromEntries((bodyParts.parts ?? []).map((p) => [p.id, p]));
// structure that sits between two tanks with separate domes; a part's look.fuelAbove says the fuel tank is the upper one
const BETWEEN = new Set(['intertank_l', 'intertank_m', 'centerbody_m']);

// ---------- textures (drawn once, cloned per repeat) ----------
const TEX = new Map();
function baseTex(key, w, h, draw, data = false) {
  if (TEX.has(key)) return TEX.get(key);
  const { texture, redraw } = canvasTexture(w, h);
  redraw(draw);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  if (data) texture.colorSpace = THREE.NoColorSpace;
  TEX.set(key, texture);
  return texture;
}
function rep(texture, rx, ry) {
  const k = `${texture.uuid}:${rx.toFixed(2)}:${ry.toFixed(2)}`;
  if (TEX.has(k)) return TEX.get(k);
  const t = texture.clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  TEX.set(k, t);
  return t;
}
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

const panelBump = (rivets) => baseTex(`panel:${rivets}`, 512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#5c5c5c';
  ctx.lineWidth = 3;
  for (let i = 1; i < 4; i++) { const y = (h / 4) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  for (let i = 0; i < 4; i++) { const x = (w / 4) * i + 8; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  if (rivets) {
    ctx.fillStyle = '#9c9c9c';
    for (let i = 1; i < 4; i++) for (let j = 0; j < 32; j++) { ctx.beginPath(); ctx.arc((w / 32) * j + 8, (h / 4) * i + 9, 2.2, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 32; j++) { ctx.beginPath(); ctx.arc((w / 4) * i + 17, (h / 32) * j + 8, 2.2, 0, TAU); ctx.fill(); }
  }
}, true);

const steelTex = () => baseTex('steel', 512, 512, (ctx, w, h) => {
  seed = 11;
  ctx.fillStyle = '#b4b8bb';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const y = rnd() * h, a = 0.05 + rnd() * 0.12;
    ctx.fillStyle = rnd() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(40,44,48,${a})`;
    ctx.fillRect(0, y, w, 1 + (rnd() > 0.85 ? 1 : 0));
  }
  for (let i = 0; i < 14; i++) { // faint heat tint and handling marks
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? '170,150,120' : '120,130,145'},0.05)`;
    ctx.beginPath(); ctx.ellipse(rnd() * w, rnd() * h, 40 + rnd() * 80, 10 + rnd() * 30, 0, 0, TAU); ctx.fill();
  }
});

const carbonTex = () => baseTex('carbon', 256, 256, (ctx, w, h) => {
  const n = 16, s = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const along = ((i + j) >> 1) % 2 === 0; // 2x2 twill: the weave steps one tow every row
    const g = along ? ctx.createLinearGradient(i * s, 0, (i + 1) * s, 0) : ctx.createLinearGradient(0, j * s, 0, (j + 1) * s);
    g.addColorStop(0, '#121417');
    g.addColorStop(0.5, along ? '#34383d' : '#2a2e33');
    g.addColorStop(1, '#121417');
    ctx.fillStyle = g;
    ctx.fillRect(i * s, j * s, s, s);
  }
});

const foamTex = () => baseTex('foam', 512, 512, (ctx, w, h) => {
  seed = 23;
  ctx.fillStyle = '#d9772f';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const v = rnd();
    ctx.fillStyle = v > 0.5 ? `rgba(240,150,80,${0.12 + rnd() * 0.15})` : `rgba(150,70,25,${0.1 + rnd() * 0.15})`;
    ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 5, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(120,55,20,0.25)'; // trim lines where the sprayed foam was cut back
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { const y = (h / 3) * i + 40; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * 0.3, y + 12, w * 0.6, y - 12, w, y); ctx.stroke(); }
});

const goldTex = () => baseTex('gold', 256, 256, (ctx, w, h) => {
  seed = 31;
  ctx.fillStyle = '#c9a24a';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * w, y = rnd() * h, s = 8 + rnd() * 22;
    ctx.fillStyle = rnd() > 0.5 ? `rgba(255,236,160,${0.15 + rnd() * 0.25})` : `rgba(110,75,20,${0.12 + rnd() * 0.2})`;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y + rnd() * s * 0.6); ctx.lineTo(x + rnd() * s * 0.5, y + s); ctx.closePath(); ctx.fill();
  }
});

const ISO_A = 64, ISO_H = ISO_A * Math.sqrt(3) / 2;
const isoTex = (base, line) => baseTex(`iso:${base}:${line}`, 512, Math.round(ISO_H * 8), (ctx, w, h) => {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = line;
  ctx.lineWidth = 7;
  const node = (r, c) => [c * ISO_A + (r % 2 ? ISO_A / 2 : 0), r * ISO_H];
  for (let r = 0; r <= 8; r++) for (let c = -1; c <= 9; c++) {
    const [x, y] = node(r, c);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ISO_A, y); ctx.stroke();
    if (r < 8) {
      const [x1, y1] = node(r + 1, c), [x2, y2] = node(r + 1, r % 2 ? c + 1 : c - 1);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }
  ctx.fillStyle = line; // the bosses at every node, where equipment bolts on
  for (let r = 0; r <= 8; r++) for (let c = -1; c <= 9; c++) { const [x, y] = node(r, c); ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); }
});
const orthoTex = (base, line) => baseTex(`ortho:${base}:${line}`, 512, 512, (ctx, w, h) => {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = line;
  ctx.lineWidth = 7;
  for (let i = 0; i <= 8; i++) { const v = i * 64; ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(w, v); ctx.stroke(); }
});
const hexTex = () => baseTex('hex', 256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#d8b25a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#7a5a20';
  ctx.lineWidth = 3;
  const r = 16;
  for (let row = 0; row < 12; row++) for (let col = 0; col < 10; col++) {
    const cx = col * r * 1.75 + (row % 2 ? r * 0.875 : 0), cy = row * r * 1.5;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k + Math.PI / 6; ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
    ctx.closePath();
    ctx.stroke();
  }
});
const stencilTex = (text, color) => baseTex(`stencil:${text}:${color}`, 256, 96, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.font = '700 64px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
});
const markTex = (color) => baseTex(`mark:${color}`, 512, 160, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(16, 30, 60, 42);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#dc2626'; ctx.fillRect(76, 30 + i * 7, 96, 7); }
  ctx.fillStyle = color;
  ctx.font = '700 76px "IBM Plex Mono", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('SB&E', 196, 56);
  ctx.font = '500 28px "IBM Plex Mono", monospace';
  ctx.fillText('MARS EXPEDITION', 20, 124);
});

// ---------- small helpers ----------
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const group = (...objs) => { const g = new THREE.Group(); if (objs.length) g.add(...objs); return g; };
const cyl = (rt, rb, h, mat, seg = 24) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const polarAt = (o, theta, r, y) => { o.position.set(Math.sin(theta) * r, y, Math.cos(theta) * r); o.rotation.y = theta; return o; };
function ring(radius, y, mat, t = 0.035) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius + t * 0.5, t, 8, 72), mat);
  m.rotation.x = Math.PI / 2;
  m.position.y = y;
  return m;
}
function shell(r, h, mat, y0 = 0, seg = 72) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg, 1, true), mat);
  m.position.y = y0 + h / 2;
  return m;
}
/** A curved label hugging the wall: centred at angle theta (radians from +z towards +x), height y. */
function decal(r, theta, y, width, height, map) {
  const len = width / r;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, height, 16, 1, true, theta - len / 2, len), new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.6, metalness: 0.05, depthWrite: false }));
  m.position.y = y;
  m.renderOrder = 2;
  return m;
}
function tube(a, b, radius, mat, seg = 12) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, from.distanceTo(to), seg), mat);
  m.position.copy(from).lerp(to, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return m;
}
const capped = (r, h, mat) => { // a closed top and bottom so an open end never shows the inside
  const g = new THREE.Group();
  for (const y of [0.015, h - 0.015]) { const d = mesh(new THREE.CircleGeometry(r * 0.995, 48), mat, 0, y, 0); d.rotation.x = y < h / 2 ? Math.PI / 2 : -Math.PI / 2; g.add(d); }
  return g;
};

const M = {
  frame: () => std(0x2b3036, { roughness: 0.55, metalness: 0.6 }),
  steel: () => std(0xaab1b8, { roughness: 0.35, metalness: 0.9 }),
  alu: () => std(0xd2d6da, { roughness: 0.38, metalness: 0.8 }),
  dark: () => std(0x1f2429, { roughness: 0.6, metalness: 0.5 }),
  amber: () => std(0xf59e0b, { roughness: 0.5, metalness: 0.4 }),
  cap: () => std(0x30353b, { roughness: 0.8, metalness: 0.2 }),
};

// ---------- skins ----------
const PAINT = { kerolox: 0xe4e2dc, methalox: 0xf1f0ec, hydrolox: 0xf1f0ec };
/** Which skin a tank wears: the player's insulation and material choices win over the part's own look. */
function skinOf(def, entry) {
  const ins = entry.options?.insulation;
  if (ins === 'foam') return 'foam';
  if (ins === 'mli') return 'gold';
  const mat = def.materialFamily === 'structure' ? entry.material : null;
  if (ins !== 'bare' && def.look?.skin === 'foam') return 'foam';
  if (mat === 'stainless') return 'steel';
  if (mat === 'carbon') return 'carbon';
  if (mat === 'titanium') return 'titanium';
  if (mat === 'al2219') return 'cream';
  return def.look?.skin === 'foam' ? 'paint' : (def.look?.skin ?? 'paint');
}
function skinMaterial(skin, r, h, fuel = 'methalox') {
  const around = Math.max(2, Math.round((TAU * r) / 2.2));
  const tall = Math.max(1, Math.round(h / 2.2));
  if (skin === 'steel' || skin === 'titanium') return new THREE.MeshStandardMaterial({ color: skin === 'titanium' ? 0x9aa0a6 : 0xffffff, map: rep(steelTex(), around, tall), roughness: skin === 'titanium' ? 0.42 : 0.32, metalness: 0.74 });
  if (skin === 'carbon') return new THREE.MeshStandardMaterial({ color: 0x8c8c8c, map: rep(carbonTex(), around * 6, tall * 6), roughness: 0.55, metalness: 0.05 });
  if (skin === 'foam') return new THREE.MeshStandardMaterial({ color: 0xffffff, map: rep(foamTex(), around, tall), roughness: 0.95, metalness: 0, bumpMap: rep(panelBump(false), around, tall), bumpScale: 0.002 });
  if (skin === 'gold') return new THREE.MeshStandardMaterial({ color: 0xffffff, map: rep(goldTex(), around * 3, tall * 3), roughness: 0.32, metalness: 0.9, bumpMap: rep(goldTex(), around * 3, tall * 3), bumpScale: 0.01 });
  const color = skin === 'cream' ? 0xe8e1cc : PAINT[fuel] ?? 0xf1f0ec;
  return new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.12, bumpMap: rep(panelBump(true), 6, Math.max(1, Math.round(h / 1.2))), bumpScale: 0.006 });
}
const inkOf = (skin) => (skin === 'carbon' ? '#f1f0ec' : '#14171a');
const trimOf = (skin) => (skin === 'foam' ? 0xb85f25 : skin === 'carbon' ? 0x0d0f11 : skin === 'gold' ? 0x9c7a2c : skin === 'steel' || skin === 'titanium' ? 0x7d8287 : 0xcfcdc6);

// ---------- tanks ----------
/** Where a tank sits: 'pair' (it holds both propellants), or 'upper' / 'lower' of a pair split across two parts. */
function tankRole(def, entry) {
  if ((def.look?.build ?? 'separate') !== 'separate') return { role: 'pair' };
  const partner = (type) => { const d = BODY[type]; return !!d?.fuel && d.fuel.type === def.fuel?.type && (d.look?.build ?? 'separate') === 'separate'; };
  const up = entry.above ?? null, down = entry.below ?? null;
  const linkUp = BETWEEN.has(up) || partner(up);
  const linkDown = BETWEEN.has(down) || partner(down);
  if (linkUp === linkDown) return { role: 'pair' };
  const via = linkDown ? down : up;
  return { role: linkDown ? 'upper' : 'lower', fuelOnTop: BETWEEN.has(via) && !!BODY[via]?.look?.fuelAbove };
}

function tankArt(def, r, entry) {
  const h = def.height;
  const fuel = def.fuel?.type ?? 'methalox';
  const skin = skinOf(def, entry);
  const look = def.look ?? {};
  let build = look.build ?? 'separate';
  if (build === 'separate' && entry.options?.bulkhead === 'common') build = 'common';
  let tanks = look.tanks ?? [['LOX', 0.6], ['FUEL', 0.4]];
  const pos = tankRole(def, entry);
  if (pos.role !== 'pair') {
    const ox = tanks.find((t) => t[0] === 'LOX')?.[0] ?? tanks[0][0];
    const fu = tanks.find((t) => t[0] !== 'LOX')?.[0] ?? tanks.at(-1)[0];
    const onTop = pos.fuelOnTop ? fu : ox;
    tanks = [[pos.role === 'upper' ? onTop : onTop === ox ? fu : ox, 1]];
  }
  const g = new THREE.Group();
  g.add(shell(r, h, skinMaterial(skin, r, h, fuel)), capped(r, h, M.cap()));
  const frame = M.frame();
  const trim = std(trimOf(skin), { roughness: 0.5, metalness: skin === 'steel' ? 0.8 : 0.3 });
  // end joints: a framed tank has skirts and ring frames, a balloon only a thin weld
  const endT = build === 'balloon' ? 0.016 : 0.035;
  g.add(ring(r, endT, frame, endT), ring(r, h - endT, frame, endT));
  // barrel welds or frames along the length
  if (skin === 'steel' || skin === 'titanium') {
    const step = build === 'balloon' ? 0.9 : 0.72; // Starship rings are 1.83 m tall on a 9 m tank: scaled, about 0.7 m here
    const seam = std(0x7d8287, { roughness: 0.4, metalness: 0.85 });
    let k = 0;
    for (let y = step; y < h - 0.2; y += step, k++) {
      g.add(ring(r, y, seam, 0.006));
      const v = box(0.012, step - 0.02, 0.008, seam); // the vertical seam of each ring, staggered
      polarAt(v, 0.4 + k * 2.1, r + 0.003, y + step / 2);
      if (y + step < h - 0.1) g.add(v);
    }
  } else if (skin !== 'carbon') {
    for (let y = 1.1; y < h - 0.6; y += 1.25) g.add(ring(r, y, trim, 0.02));
  } else {
    g.add(ring(r, h * 0.5, trim, 0.01));
  }
  // between the two propellants: a short intertank band (separate domes) or one weld line (common bulkhead)
  const split = h * (1 - tanks[0][1]);
  if (tanks.length < 2) {
    // one propellant: nothing between, the domes are at the ends
  } else if (build === 'separate') {
    const bh = Math.min(0.45, Math.max(0.25, h * 0.06));
    const bandMat = skin === 'foam' ? new THREE.MeshStandardMaterial({ color: 0xc46a2c, roughness: 0.95, metalness: 0 }) : std(skin === 'carbon' ? 0x1a1d20 : skin === 'steel' ? 0x9ea4a9 : 0xb9bcbf, { roughness: 0.5, metalness: 0.45 });
    g.add(shell(r + 0.004, bh, bandMat, split - bh / 2, 72), ring(r, split - bh / 2, frame, 0.025), ring(r, split + bh / 2, frame, 0.025));
    const n = Math.round((TAU * r) / 0.22);
    const str = std(skin === 'foam' ? 0xa95a24 : 0x8f969c, { roughness: 0.45, metalness: 0.6 });
    for (let i = 0; i < n; i++) g.add(polarAt(box(0.03, bh - 0.04, 0.025, str), (i / n) * TAU, r + 0.014, split));
  } else {
    g.add(ring(r, split, std(skin === 'carbon' ? 0x3a3f45 : 0x6b7177, { roughness: 0.45, metalness: 0.6 }), 0.011));
  }
  // labels on each propellant, the agency mark on the bigger one
  const ink = inkOf(skin);
  let top = h;
  tanks.forEach(([label, frac], i) => {
    const span = frac * h;
    const cy = top - span / 2;
    if (span > 0.8) g.add(decal(r + 0.006, -0.55, cy, Math.min(1.0, r * 0.75), Math.min(0.34, span * 0.3), stencilTex(label, ink)));
    // a fill-and-drain valve low on each tank, a vent valve near the top of the upper one
    const valve = group(box(0.22, 0.16, 0.06, M.dark()), at(cyl(0.035, 0.035, 0.08, M.amber(), 10), 0, 0, 0.05));
    valve.children[1].rotation.x = Math.PI / 2;
    polarAt(valve, 1.75, r + 0.03, top - span + Math.min(0.45, span * 0.2));
    g.add(valve);
    if (i === 0) {
      const vent = group(cyl(0.05, 0.05, 0.14, M.steel(), 12), at(box(0.12, 0.05, 0.05, M.dark()), 0, 0.07, 0));
      vent.children[0].rotation.x = Math.PI / 2;
      polarAt(vent, 2.6, r + 0.05, h - 0.3);
      g.add(vent);
    }
    top -= span;
  });
  const big = tanks.reduce((a, b) => (b[1] > a[1] ? b : a));
  const bigTop = h - tanks.slice(0, tanks.indexOf(big)).reduce((s, t) => s + t[1] * h, 0);
  if (big[1] * h > 2.2) g.add(decal(r + 0.006, 0.55, bigTop - big[1] * h * 0.42, Math.min(1.6, r * 1.1), Math.min(0.5, r * 0.36), markTex(ink)));
  return g;
}

// ---------- stage structure ----------
const STRUCT_BASE = { centerbody_m: 0xe9e7e1, interstage_m: 0x2b3238, intertank_l: 0xdad7cf, intertank_m: 0xdad7cf };
/** The shell material of stage structure: painted metal, carbon, or bare steel/titanium, after the part's material. */
function structureSkin(kind, base, around, tall, bump = null) {
  if (kind === 'carbon') return new THREE.MeshStandardMaterial({ color: 0x8c8c8c, map: rep(carbonTex(), around * 8, tall * 8), roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
  if (kind === 'steel' || kind === 'titanium') return new THREE.MeshStandardMaterial({ color: kind === 'titanium' ? 0x9aa0a6 : 0xffffff, map: rep(steelTex(), around, Math.max(1, Math.round(tall))), roughness: 0.32, metalness: 0.74, side: THREE.DoubleSide });
  return new THREE.MeshStandardMaterial({ color: base, roughness: 0.5, metalness: 0.45, side: THREE.DoubleSide, ...(bump ? { bumpMap: bump, bumpScale: 0.005 } : {}) });
}
const KIND_BASE = { carbon: 0x24272b, steel: 0xb4b8bb, titanium: 0x9aa0a6 };
const structureKind = (def, material) => (def.id === 'interstage_l_composite' ? 'carbon' : def.materialFamily === 'structure' ? ({ carbon: 'carbon', stainless: 'steel', titanium: 'titanium' }[material] ?? 'paint') : 'paint');
/** The shell of a stage-structure section, built the chosen way. arc = [thetaStart, thetaLength] draws only part of it. */
function constructionShell(r, h, cons, joints, base, y0 = 0, arc = null, kind = 'paint') {
  const g = new THREE.Group();
  const [t0, tl] = arc ?? [0, TAU];
  const inArc = (th) => { const d = (((th - t0) % TAU) + TAU) % TAU; return d <= tl; };
  const skin = (rr, mat, seg = 72) => mesh(new THREE.CylinderGeometry(rr, rr, h, Math.max(8, Math.round((seg * tl) / TAU)), 1, true, t0, tl), mat, 0, y0 + h / 2, 0);
  if (kind !== 'paint') base = KIND_BASE[kind] ?? base;
  const baseHex = `#${new THREE.Color(base).getHexString()}`;
  const lineHex = `#${new THREE.Color(base).multiplyScalar(0.7).getHexString()}`;
  const around = Math.max(4, Math.round((TAU * r) / 1.1));
  const tall = Math.max(1, h / 1.1);
  if (cons === 'composite') {
    // honeycomb sandwich: smooth bonded panels, no stringers
    g.add(skin(r, structureSkin(kind, base, around, tall)));
    const seam = std(new THREE.Color(base).multiplyScalar(kind === 'carbon' ? 1.6 : 0.82).getHex(), { roughness: 0.5, metalness: 0.3 });
    for (let i = 0; i < 8; i++) { const th = (i / 8) * TAU + 0.2; if (inArc(th)) g.add(polarAt(box(0.02, h - 0.1, 0.006, seam), th, r + 0.004, y0 + h / 2)); }
  } else if (cons === 'isogrid' || cons === 'orthogrid') {
    const map = cons === 'isogrid' ? isoTex(baseHex, lineHex) : orthoTex(baseHex, lineHex);
    g.add(skin(r, new THREE.MeshStandardMaterial({ color: 0xffffff, map: rep(map, around, tall), bumpMap: rep(map, around, tall), bumpScale: 0.012, roughness: 0.45, metalness: 0.45, side: THREE.DoubleSide })));
  } else if (cons === 'corrugated') {
    const geo = new THREE.CylinderGeometry(r, r, h, Math.max(16, Math.round((160 * tl) / TAU)), 1, true, t0, tl);
    const n = Math.round((TAU * r) / 0.12);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const th = Math.atan2(p.getX(i), p.getZ(i));
      const rr = r + 0.022 * (0.5 + 0.5 * Math.sin(th * n));
      p.setX(i, Math.sin(th) * rr);
      p.setZ(i, Math.cos(th) * rr);
    }
    geo.computeVertexNormals();
    g.add(mesh(geo, kind === 'paint' ? std(base, { roughness: 0.42, metalness: 0.55, side: THREE.DoubleSide }) : structureSkin(kind, base, around, tall), 0, y0 + h / 2, 0));
  } else {
    g.add(skin(r, structureSkin(kind, base, around, tall, rep(panelBump(joints === 'riveted'), around / 2, Math.max(1, tall)))));
    const n = Math.round((TAU * r) / 0.3);
    const str = std(0x9aa0a6, { roughness: 0.45, metalness: 0.8 });
    for (let i = 0; i < n; i++) { const th = (i / n) * TAU; if (inArc(th)) g.add(polarAt(box(0.04, h - 0.14, 0.045, str), th, r + 0.022, y0 + h / 2)); }
  }
  if (joints === 'fsw' && cons !== 'composite') { // friction-stir welds: bright, smooth seams instead of rivet rows
    const weld = std(0xe3e6e9, { roughness: 0.2, metalness: 0.95 });
    for (let i = 0; i < 4; i++) { const th = (i / 4) * TAU + 0.3; if (inArc(th)) g.add(polarAt(box(0.03, h - 0.1, 0.006, weld), th, r + (cons === 'corrugated' ? 0.024 : 0.004), y0 + h / 2)); }
  }
  return g;
}

function structureArt(def, r, entry) {
  const h = def.height;
  const composite = def.id === 'interstage_l_composite';
  const cons = composite ? 'composite' : (entry.options?.construction ?? 'skin_stringer');
  const joints = entry.options?.joints ?? 'riveted';
  const g = new THREE.Group();
  g.add(constructionShell(r, h, cons, joints, STRUCT_BASE[def.id] ?? 0xd9d7d1, 0, null, structureKind(def, entry.material)));
  const frame = M.frame();
  g.add(ring(r, 0.04, frame, 0.04), ring(r, h - 0.04, frame, 0.04));
  // an access door and an umbilical plate, as on every real intertank and interstage
  const door = mesh(new THREE.CylinderGeometry(r + 0.012, r + 0.012, Math.min(0.6, h * 0.45), 8, 1, true, 0.15, 0.4 / r), std(0x15191d, { roughness: 0.6, metalness: 0.3 }), 0, h * 0.5, 0);
  g.add(door);
  const plate = group(box(0.4, Math.min(0.32, h * 0.3), 0.06, M.dark()));
  for (let i = 0; i < 3; i++) plate.add(at(cyl(0.035, 0.035, 0.07, M.amber(), 10), -0.12 + i * 0.12, 0, 0.05));
  plate.children.slice(1).forEach((c) => { c.rotation.x = Math.PI / 2; });
  g.add(polarAt(plate, Math.PI + 0.4, r + 0.04, h * 0.5));
  if (def.id === 'intertank_l' || def.id === 'intertank_m') {
    g.add(ring(r, h * 0.5, frame, 0.055)); // the big ring frame the booster beam bolts to
    for (const th of [Math.PI / 2, -Math.PI / 2]) g.add(polarAt(box(0.36, 0.5, 0.12, std(0x8f969c, { roughness: 0.4, metalness: 0.8 })), th, r + 0.06, h * 0.5)); // booster attach fittings
  }
  if (def.id === 'interstage_m') g.add(ring(r, h * 0.5, std(0xf59e0b, { roughness: 0.6 }), 0.012));
  if (def.id === 'centerbody_m') g.add(ring(r, h * 0.5, frame, 0.03));
  if (composite) {
    // four grid fins folded flat against the top of the interstage, and two cold-gas thruster pods between them
    const titanium = std(0x6b6f74, { roughness: 0.45, metalness: 0.85 });
    for (let k = 0; k < 4; k++) {
      const th = Math.PI / 4 + (k * Math.PI) / 2;
      const fin = new THREE.Group();
      const fw = Math.min(0.75, r * 0.45), fh = Math.min(0.62, h * 0.42);
      for (let i = 0; i <= 5; i++) {
        fin.add(at(box(0.025, fh, 0.05, titanium), -fw / 2 + (i * fw) / 5, 0, 0));
        fin.add(at(box(fw, 0.025, 0.05, titanium), 0, -fh / 2 + (i * fh) / 5, 0));
      }
      fin.add(at(box(fw * 0.5, 0.08, 0.1, M.dark()), 0, fh / 2 + 0.06, -0.03)); // the hinge and actuator
      g.add(polarAt(fin, th, r + 0.06, h - fh / 2 - 0.16));
    }
    for (const th of [0, Math.PI]) {
      const pod = group(box(0.3, 0.26, 0.12, std(0xdcdad4, { roughness: 0.5, metalness: 0.3 })));
      for (const dx of [-0.08, 0.08]) { const n = at(cyl(0.02, 0.04, 0.08, M.dark(), 10), dx, 0, 0.09); n.rotation.x = Math.PI / 2; pod.add(n); }
      g.add(polarAt(pod, th, r + 0.06, h * 0.42));
    }
  }
  return g;
}

/** A conical adapter between two diameters, built like stage structure. */
function adapterArt(def, entry) {
  const h = def.height;
  const rt = BASE_R * (SCALE[def.adapter?.top] ?? 1), rb = BASE_R * (SCALE[def.adapter?.bottom] ?? 1);
  const cons = entry.options?.construction ?? 'skin_stringer';
  const kind = structureKind(def, entry.material);
  const g = new THREE.Group();
  const pts = [new THREE.Vector2(rb, 0), new THREE.Vector2(rt, h)];
  const around = Math.max(4, Math.round((TAU * Math.max(rt, rb)) / 1.1));
  let mat;
  if (kind !== 'paint') mat = structureSkin(kind, 0xe9e7e1, around, 1);
  else if (cons === 'composite') mat = new THREE.MeshStandardMaterial({ color: 0xe4e2dc, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
  else if (cons === 'isogrid' || cons === 'orthogrid') { const t = cons === 'isogrid' ? isoTex('#e4e2dc', '#a3a19b') : orthoTex('#e4e2dc', '#a3a19b'); mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: rep(t, around, 1), bumpMap: rep(t, around, 1), bumpScale: 0.012, roughness: 0.45, metalness: 0.35, side: THREE.DoubleSide }); }
  else mat = new THREE.MeshStandardMaterial({ color: 0xe9e7e1, roughness: 0.45, metalness: 0.25, bumpMap: rep(panelBump(entry.options?.joints !== 'fsw'), around / 2, 1), bumpScale: 0.004, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 72), mat));
  if (cons === 'skin_stringer' || cons === 'corrugated') {
    // stringers along the cone, from the wide ring to the narrow one
    const n = cons === 'corrugated' ? 64 : Math.round((TAU * Math.max(rt, rb)) / 0.32);
    const str = std(cons === 'corrugated' ? 0xc9ccd0 : 0x9aa0a6, { roughness: 0.45, metalness: 0.8 });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const off = cons === 'corrugated' ? 0.012 : 0.02;
      g.add(tube([Math.sin(a) * (rb + off), 0.06, Math.cos(a) * (rb + off)], [Math.sin(a) * (rt + off), h - 0.06, Math.cos(a) * (rt + off)], cons === 'corrugated' ? 0.012 : 0.018, str, 6));
    }
  }
  const frame = M.frame();
  g.add(ring(rb, 0.035, frame, 0.035), ring(rt, h - 0.035, frame, 0.035), ring((rb + rt) / 2, h / 2, frame, 0.018));
  return g;
}

/** The Saturn-style Instrument Unit: a short wide ring, equipment and cold plates around its inside wall. */
function iuArt(def, r) {
  const h = def.height;
  const g = new THREE.Group();
  g.add(shell(r, h, new THREE.MeshStandardMaterial({ color: 0xe7e5df, roughness: 0.45, metalness: 0.25, bumpMap: rep(panelBump(true), 12, 1), bumpScale: 0.004, side: THREE.DoubleSide })));
  const frame = M.frame();
  g.add(ring(r, 0.03, frame, 0.03), ring(r, h - 0.03, frame, 0.03));
  const colors = [0x1f2937, 0x374151, 0xb45309, 0x0e7490, 0x4b5563, 0x1f2937, 0x6b7280, 0x374151];
  for (let i = 0; i < 16; i++) {
    const th = (i / 16) * TAU;
    const unit = group(at(box(0.5, h * 0.62, 0.05, std(0x9aa0a6, { roughness: 0.4, metalness: 0.8 })), 0, 0, 0.02), at(box(0.36, h * 0.5, 0.2, std(colors[i % colors.length], { roughness: 0.5, metalness: 0.5 })), 0, 0, -0.1));
    g.add(polarAt(unit, th, r - 0.06, h / 2));
  }
  const door = mesh(new THREE.CylinderGeometry(r + 0.01, r + 0.01, h * 0.6, 8, 1, true, -0.12, 0.5 / r), std(0x15191d, { roughness: 0.6 }), 0, h / 2, 0);
  const umb = group(box(0.3, h * 0.36, 0.08, M.dark()), at(cyl(0.05, 0.05, 0.08, M.amber(), 12), 0, 0, 0.06));
  umb.children[1].rotation.x = Math.PI / 2;
  g.add(door, polarAt(umb, Math.PI * 0.75, r + 0.04, h / 2));
  return g;
}

// ---------- side parts ----------
/** External feed line, centred on its attach point: a big insulated pipe on brackets, bellows, two thin lines beside it. */
function feedlineArt(def) {
  const h = def.height, w = 0.5, inner = -0.45 * w;
  const g = new THREE.Group();
  const ins = std(0xdcd6cb, { roughness: 0.8, metalness: 0.05 });
  const metal = std(0xb7bdc3, { roughness: 0.3, metalness: 0.9 });
  const px = inner + 0.24, pr = 0.1;
  g.add(mesh(new THREE.CylinderGeometry(pr, pr, h - 0.5, 20), ins, px, -0.05, 0));
  for (const y of [-h * 0.22, h * 0.18]) for (let i = 0; i < 5; i++) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(pr + 0.012, 0.014, 6, 24), metal), px, y + i * 0.05, 0)).children.at(-1).rotation.x = Math.PI / 2; // bellows
  // top: the elbow that turns into the tank wall; bottom: a flange where it meets the engine section
  const elbow = new THREE.Mesh(new THREE.TorusGeometry(0.2, pr, 12, 16, Math.PI / 2), ins);
  elbow.position.set(px - 0.2, h / 2 - 0.3, 0);
  g.add(elbow, mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 20), metal, px, -h / 2 + 0.2, 0), mesh(new THREE.CylinderGeometry(pr * 1.4, pr * 1.4, 0.05, 20), metal, inner + 0.03, h / 2 - 0.1, 0));
  g.children.at(-1).rotation.z = Math.PI / 2;
  for (let y = -h / 2 + 0.6; y < h / 2 - 0.5; y += 1.0) { // brackets back to the tank wall
    g.add(mesh(new THREE.BoxGeometry(0.24, 0.06, 0.08), std(0x6b7280, { roughness: 0.5, metalness: 0.7 }), inner + 0.12, y, 0));
    g.add(at(new THREE.Mesh(new THREE.TorusGeometry(pr + 0.015, 0.02, 6, 20), std(0x6b7280, { roughness: 0.5, metalness: 0.7 })), px, y, 0)).children.at(-1).rotation.x = Math.PI / 2;
  }
  for (const z of [-0.17, 0.17]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, h - 0.8, 10), metal, inner + 0.07, 0, z)); // repressurisation lines
  g.userData.width = w;
  return g;
}

/** Cable raceway, centred: a long low box with sloped ends (like the foam ramps on the Shuttle tank). */
function racewayArt(def) {
  const h = def.height, w = 0.3, inner = -0.45 * w, t = 0.13, depth = 0.3, ramp = Math.min(0.5, h * 0.1);
  const profile = new THREE.Shape([[inner, -h / 2], [inner + t, -h / 2 + ramp], [inner + t, h / 2 - ramp], [inner, h / 2]].map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(profile, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
  geo.translate(0, 0, -depth / 2);
  const g = group(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd9d7d1, roughness: 0.5, metalness: 0.2, bumpMap: rep(panelBump(true), 1, Math.max(1, Math.round(h / 1.5))), bumpScale: 0.004 })));
  const strap = std(0x8f969c, { roughness: 0.45, metalness: 0.75 });
  for (let y = -h / 2 + ramp + 0.3; y < h / 2 - ramp; y += 0.55) g.add(mesh(new THREE.BoxGeometry(t + 0.03, 0.025, depth + 0.05), strap, inner + t / 2, y, 0));
  g.userData.width = w;
  return g;
}

/** Wiring tunnel, centred: a half-round cover with straps and tapered end fairings. */
function wiringArt(def) {
  const h = def.height, w = 0.26, inner = -0.45 * w, cr = 0.12;
  const mat = std(0xd9d7d1, { roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide });
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(cr, cr, h - 0.5, 20, 1, false, 0, Math.PI), mat, inner, 0, 0));
  const capTop = mesh(new THREE.CylinderGeometry(0.01, cr, 0.25, 20, 1, false, 0, Math.PI), mat, inner, h / 2 - 0.125, 0);
  const capBot = mesh(new THREE.CylinderGeometry(cr, 0.01, 0.25, 20, 1, false, 0, Math.PI), mat, inner, -h / 2 + 0.125, 0);
  g.add(capTop, capBot);
  const strap = std(0x6b7280, { roughness: 0.5, metalness: 0.7 });
  for (let y = -h / 2 + 0.45; y < h / 2 - 0.3; y += 0.4) {
    const s = new THREE.Mesh(new THREE.TorusGeometry(cr + 0.006, 0.01, 6, 16, Math.PI), strap);
    s.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
    s.position.set(inner, y, 0);
    g.add(s);
  }
  g.userData.width = w;
  return g;
}

/** Three carbon-wrapped helium bottles on a rack, standing on the attach point. */
function copvArt(def) {
  const h = def.height, w = 0.6, inner = -0.45 * w;
  const g = new THREE.Group();
  const wrap = new THREE.MeshStandardMaterial({ color: 0xffffff, map: rep(carbonTex(), 2, 3), roughness: 0.5, metalness: 0.08 });
  const boss = std(0xc9ccd0, { roughness: 0.3, metalness: 0.9 });
  const rack = std(0x4b5563, { roughness: 0.5, metalness: 0.7 });
  const br = 0.1, len = h * 0.62;
  for (const z of [-0.22, 0, 0.22]) {
    g.add(mesh(new THREE.CapsuleGeometry(br, len, 6, 18), wrap, inner + 0.2, h * 0.5, z));
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10), boss, inner + 0.2, h * 0.5 + len / 2 + br + 0.02, z));
  }
  for (const y of [h * 0.25, h * 0.75]) g.add(mesh(new THREE.BoxGeometry(0.1, 0.06, 0.72), rack, inner + 0.05, y, 0), mesh(new THREE.BoxGeometry(0.22, 0.03, 0.66), rack, inner + 0.15, y, 0));
  g.add(tube([inner + 0.2, h * 0.5 + len / 2 + br + 0.05, -0.22], [inner + 0.2, h * 0.5 + len / 2 + br + 0.05, 0.22], 0.015, boss, 8)); // the manifold joining the three
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.08, 0.08), M.amber(), inner + 0.2, h * 0.5 + len / 2 + br + 0.06, 0.3)); // regulator
  g.userData.width = w;
  return g;
}

/** Art for one placed part: entry = { type, def, attach, height, radius, options?, material? }. Null = the default. */
export function partArt(entry) {
  const def = entry.def;
  if (!def) return null;
  const r = entry.radius ?? BASE_R * (SCALE[def.size] ?? 1);
  const e = { options: entry.options ?? null, material: entry.material ?? null, above: entry.above ?? null, below: entry.below ?? null };
  if (entry.attach === 'axial') {
    if (def.adapter) return adapterArt(def, e);
    if (def.fuel) return tankArt(def, r, e);
    if (def.id === 'avionics_iu_l') return iuArt(def, r);
    if (['intertank_l', 'intertank_m', 'centerbody_m', 'interstage_m', 'interstage_l_composite'].includes(def.id)) return structureArt(def, r, e);
    return null;
  }
  if (def.id === 'feedline_external') return feedlineArt(def);
  if (def.id === 'cable_raceway') return racewayArt(def);
  if (def.id === 'wiring_tunnel') return wiringArt(def);
  if (def.id === 'copv_rack') return copvArt(def);
  return null;
}

// ---------- internals (exploded view) ----------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TANK_KITS = new Set(['tank', 'tank_h2', 'tank_common', 'tank_common_h2', 'tank_balloon']);

function tankPieces(def, options, r, h) {
  const out = [];
  const add = (key, name, object, dir) => out.push({ key, name, object, dir: dir.clone().normalize() });
  const opt = (k) => options?.[k]?.id;
  const kit = def.internals;
  const tanks = def.look?.tanks ?? [['LOX', 0.6], ['FUEL', 0.4]];
  const split = h * (1 - tanks[0][1]);
  const alu = std(0xd2d6da, { roughness: 0.38, metalness: 0.8, side: THREE.DoubleSide });
  const domeGeo = (rr, depth, up = true) => new THREE.LatheGeometry([[0, up ? depth : -depth], [rr * 0.55, up ? depth * 0.85 : -depth * 0.85], [rr * 0.88, up ? depth * 0.4 : -depth * 0.4], [rr, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 40);
  const dr = r * 0.95, dd = r * 0.32;
  // bulkhead
  const bh = new THREE.Group();
  const b = opt('bulkhead');
  const framed = kit === 'tank' || kit === 'tank_h2';
  const common = !framed || b === 'common';
  if (!common) {
    bh.add(mesh(domeGeo(dr, dd, false), alu, 0, split + dd + 0.15, 0), mesh(domeGeo(dr, dd, true), alu, 0, split - dd - 0.15, 0));
  } else {
    const sandwich = b === 'honeycomb' || b === 'common' || (b === 'as_built' && def.fuel?.type === 'hydrolox') || (b == null && def.fuel?.type === 'hydrolox');
    const thin = b === 'thin';
    bh.add(mesh(domeGeo(dr, dd, false), thin ? std(0xe8ecef, { roughness: 0.25, metalness: 0.9, side: THREE.DoubleSide }) : alu, 0, split, 0));
    if (sandwich) {
      const core = new THREE.MeshStandardMaterial({ color: 0xffffff, map: rep(hexTex(), 4, 2), roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide });
      bh.add(mesh(domeGeo(dr * 0.99, dd * 0.94, false), core, 0, split + (b === 'honeycomb' ? 0.12 : 0.07), 0));
      bh.add(mesh(domeGeo(dr * 0.98, dd * 0.9, false), alu, 0, split + (b === 'honeycomb' ? 0.2 : 0.12), 0));
    }
  }
  add('bulkhead', common ? 'Common bulkhead' : 'Bulkheads', bh, V(0.4, 1, 0));
  // pressurisation (tank kits) or the balloon's pressure system
  if (kit === 'tank_balloon') {
    const p = opt('pressure');
    const pg = group(at(box(0.3, 0.22, 0.18, M.dark()), -0.5 * r, 0.12 * h, 0.4 * r), at(cyl(0.09, 0.09, 0.04, std(0xf1f0ec, { roughness: 0.4 })), -0.5 * r, 0.12 * h + 0.16, 0.4 * r));
    pg.children[1].rotation.x = Math.PI / 2;
    if (p === 'stretch') {
      for (const y of [0.15 * h, 0.85 * h]) pg.add(ring(r * 1.08, y, M.amber(), 0.03));
      for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; pg.add(tube([Math.sin(a) * r * 1.1, 0.15 * h, Math.cos(a) * r * 1.1], [Math.sin(a) * r * 1.1, 0.85 * h, Math.cos(a) * r * 1.1], 0.03, M.amber(), 8)); }
      pg.add(at(box(0.3, 0.22, 0.18, M.dark()), -0.5 * r + 0.36, 0.12 * h, 0.4 * r));
    } else if (p === 'thin') {
      pg.add(mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, h * 0.35, 40, 1, true, -0.6, 1.2), std(0xdfe3e6, { roughness: 0.2, metalness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), 0, h * 0.55, 0));
    } else pg.add(tube([-0.5 * r, 0.12 * h + 0.11, 0.4 * r], [-0.5 * r, 0.6 * h, 0.4 * r], 0.025, M.steel(), 8));
    add('pressure', 'Pressure system', pg, V(-1, 0.2, 0.4));
  } else {
    const press = new THREE.Group();
    const p = opt('pressurisation');
    if (p === 'autogenous') press.add(tube([0.55 * r, 0.06 * h, 0.3 * r], [0.55 * r, 0.92 * h, 0.3 * r], 0.03, std(0xc9a24a, { roughness: 0.3, metalness: 0.9 }), 10), at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), std(0xc9a24a, { roughness: 0.3, metalness: 0.9 })), 0.55 * r, 0.92 * h, 0.3 * r));
    else if (p === 'nitrogen') for (const [x, z] of [[0.35, 0.35], [-0.35, 0.35]]) press.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.2 * r, 24, 16), std(0xb9c6d2, { roughness: 0.3, metalness: 0.7 })), x * r, 0.3 * h, z * r));
    else {
      for (const [x, z] of [[0.4, 0.3], [-0.4, 0.3], [0, -0.45]]) press.add(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.1 * r, 0.16 * r, 6, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, map: rep(carbonTex(), 1, 2), roughness: 0.35, metalness: 0.2 })), x * r, 0.3 * h, z * r));
      if (p === 'heated') { // the heat-exchanger coil on the engine end
        const pts = [];
        for (let i = 0; i <= 60; i++) { const a = i * 0.45; pts.push(V(Math.cos(a) * 0.2 * r, 0.02 * h + i * 0.004, Math.sin(a) * 0.2 * r)); }
        press.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.018, 6), std(0xb87333, { roughness: 0.35, metalness: 0.9 })));
      }
    }
    add('pressurisation', 'Pressurisation', press, V(-1, 0, 0));
  }
  // baffles
  if (kit !== 'tank_balloon') {
    const baf = new THREE.Group();
    const bo = opt('baffles');
    if (bo !== 'none') for (const f of [0.22, 0.4, 0.62, 0.8]) baf.add(ring(0.78 * r, f * h, alu, 0.03));
    else baf.add(ring(0.78 * r, 0.45 * h, std(0x4b5563, { roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.35 }), 0.012));
    if (bo === 'antivortex') for (let i = 0; i < 4; i++) baf.add(at(box(0.5 * r, 0.25, 0.02, alu), 0, 0.08 * h, 0)).children.at(-1).rotation.y = (i * Math.PI) / 4;
    add('baffles', 'Slosh baffles', baf, V(1, 0, 0));
  }
  // insulation
  const ins = opt('insulation');
  const insMat = ins === 'foam' ? new THREE.MeshStandardMaterial({ color: 0xffffff, map: rep(foamTex(), 1, 1), roughness: 0.95, metalness: 0, side: THREE.DoubleSide })
    : ins === 'mli' ? new THREE.MeshStandardMaterial({ color: 0xffffff, map: rep(goldTex(), 2, 2), roughness: 0.32, metalness: 0.9, side: THREE.DoubleSide })
      : std(0xe6e3dc, { roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
  const ph = Math.min(h * 0.35, Math.max(0.6, split * 0.8)), py = Math.max(ph / 2 + 0.1, split * 0.5);
  const insPiece = new THREE.Group();
  if (ins === 'bare') {
    const faint = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.5, metalness: 0.4, transparent: true, opacity: 0.55 });
    const p = (th, y) => [Math.sin(th) * r * 1.03, y, Math.cos(th) * r * 1.03];
    for (const y of [py - ph / 2, py + ph / 2]) for (let i = 0; i < 8; i++) insPiece.add(tube(p(-0.6 + i * 0.15, y), p(-0.6 + (i + 1) * 0.15, y), 0.008, faint, 4));
    for (const th of [-0.6, 0.6]) insPiece.add(tube(p(th, py - ph / 2), p(th, py + ph / 2), 0.008, faint, 4));
  } else insPiece.add(mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, ph, 40, 1, true, -0.6, 1.2), insMat, 0, py, 0));
  add('insulation', 'Insulation', insPiece, V(0, 0, 1));
  // feed lines
  const fo = opt('feedline');
  const feed = new THREE.Group();
  if (fo === 'tunnel') {
    feed.add(mesh(new THREE.CylinderGeometry(0.16 * r, 0.16 * r, split - 0.1, 20), std(0xdcd6cb, { roughness: 0.8 }), 0, split / 2, 0), mesh(new THREE.CylinderGeometry(0.1 * r, 0.1 * r, 0.12, 16), M.amber(), 0, 0.06, 0));
  } else {
    feed.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9 * h, 12), M.steel(), -0.3 * r, 0.47 * h, -0.5 * r), mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 12), M.amber(), -0.3 * r, 0.06 * h, -0.5 * r));
    if (fo === 'dual') feed.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9 * h, 12), M.steel(), 0.3 * r, 0.47 * h, -0.5 * r), mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 12), M.amber(), 0.3 * r, 0.06 * h, -0.5 * r));
  }
  add('feedline', fo === 'tunnel' ? 'Feed tunnel' : 'Feed lines', feed, fo === 'tunnel' ? V(0, -1, 0.3) : V(0, -1, -0.8));
  return out;
}

function structurePieces(def, options, r, h) {
  const out = [];
  const add = (key, name, object, dir) => out.push({ key, name, object, dir: dir.clone().normalize() });
  const cons = options?.construction?.id ?? 'skin_stringer';
  const joints = options?.joints?.id ?? 'riveted';
  // a quarter of the shell, built the chosen way
  const ra = def.adapter ? BASE_R * (SCALE[def.adapter.bottom] ?? 1) : r;
  const ph = Math.min(h, 1.2);
  const panel = new THREE.Group();
  if (cons === 'composite') {
    const carbon = std(0xc9ccd0, { roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide }); // the skins: aluminium here, carbon if that is the material
    const core = new THREE.MeshStandardMaterial({ color: 0xffffff, map: rep(hexTex(), 4, 2), roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide });
    for (const [dr, m] of [[0, carbon], [-0.07, core], [-0.14, carbon]]) panel.add(mesh(new THREE.CylinderGeometry(ra + dr, ra + dr, ph, 24, 1, true, -0.5, 1.0), m, 0, h / 2, 0));
  } else {
    panel.add(constructionShell(ra, ph, cons, joints, STRUCT_BASE[def.id] ?? 0xd9d7d1, h / 2 - ph / 2, [-0.5, 1.0]));
  }
  add('construction', 'Shell construction', panel, V(0, 0.15, 1));
  // the joint: a splice strap with rivets, a weld bead or a glue line
  const joint = new THREE.Group();
  const strapGeo = new THREE.CylinderGeometry(ra + 0.03, ra + 0.03, 0.14, 24, 1, true, Math.PI / 2 - 0.45, 0.9);
  joint.add(mesh(strapGeo, std(joints === 'fsw' ? 0xe3e6e9 : 0x9aa0a6, { roughness: joints === 'fsw' ? 0.2 : 0.45, metalness: 0.85, side: THREE.DoubleSide }), 0, h * 0.5, 0));
  if (joints === 'riveted') for (let i = 0; i < 14; i++) { const a = Math.PI / 2 - 0.42 + (i / 13) * 0.84; for (const dy of [-0.035, 0.035]) joint.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), M.dark(), Math.sin(a) * (ra + 0.035), h * 0.5 + dy, Math.cos(a) * (ra + 0.035))); }
  if (joints === 'bonded') joint.add(mesh(new THREE.CylinderGeometry(ra + 0.034, ra + 0.034, 0.02, 24, 1, true, Math.PI / 2 - 0.45, 0.9), std(0xf59e0b, { roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide }), 0, h * 0.5, 0));
  add('joints', 'Joints', joint, V(1, 0.1, 0));
  return out;
}

function avionicsPieces(def, options, r, h) {
  const out = [];
  const add = (key, name, object, dir) => out.push({ key, name, object, dir: dir.clone().normalize() });
  const opt = (k) => options?.[k]?.id;
  const ink = (c) => std(c, { roughness: 0.5, metalness: 0.5 });
  const comp = new THREE.Group();
  const n = opt('computer') === 'triple' ? 3 : 2;
  for (let i = 0; i < n; i++) comp.add(at(box(0.36, 0.5 * h, 0.2, ink(0x1f2937)), -0.4 + i * 0.4, 0.5 * h, -0.7 * r));
  add('computer', 'Flight computer', comp, V(0, 0, -1));
  const kind = opt('imu');
  const imu = kind === 'mems' ? group(at(box(0.12, 0.08, 0.12, ink(0x0b1220)), 0.7 * r, 0.5 * h, 0))
    : kind === 'fog' ? group(at(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 32), std(0xc9a24a, { roughness: 0.3, metalness: 0.9 })), 0.7 * r, 0.5 * h, 0), at(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 32), std(0xc9a24a, { roughness: 0.3, metalness: 0.9 })), 0.7 * r, 0.5 * h, 0))
      : group(at(box(0.3, 0.3, 0.3, ink(0x374151)), 0.7 * r, 0.5 * h, 0), at(new THREE.Mesh(new THREE.TetrahedronGeometry(0.1), std(0xc9a24a, { roughness: 0.3, metalness: 0.9 })), 0.7 * r, 0.5 * h + 0.2, 0));
  if (kind === 'fog') imu.children[1].rotation.set(0, Math.PI / 2, 0);
  add('imu', 'Inertial measurement unit', imu, V(1, 0, 0));
  const radio = group(at(box(0.3, 0.4 * h, 0.16, ink(0x4b5563)), 0, 0.5 * h, 0.72 * r), at(cyl(0.02, 0.02, 0.3, M.steel(), 8), 0.1, 0.9 * h, 0.72 * r));
  if (opt('transponder') === 'dual') radio.add(at(box(0.3, 0.4 * h, 0.16, ink(0x4b5563)), 0.36, 0.5 * h, 0.7 * r));
  add('transponder', 'Telemetry & range safety', radio, V(0, 0, 1));
  if (options?.navaid) {
    const nav = opt('navaid');
    const g = group(at(box(0.22, 0.16, 0.16, ink(0x374151)), -0.7 * r, 0.5 * h, 0.2 * r));
    if (nav === 'gps') g.add(at(cyl(0.11, 0.11, 0.03, std(0xf1f0ec, { roughness: 0.5 }), 24), -0.7 * r, 0.5 * h + 0.1, 0.2 * r));
    if (nav === 'stellar') { const t = at(cyl(0.06, 0.08, 0.26, std(0xc9a24a, { roughness: 0.3, metalness: 0.9 }), 20), -0.7 * r, 0.5 * h + 0.18, 0.2 * r); t.rotation.z = 0.5; g.add(t); }
    add('navaid', 'Navigation aids', g, V(-1, 0.3, 0.3));
  }
  if (options?.fts) {
    const auto = opt('fts') === 'autonomous';
    const g = group(at(box(0.26, 0.3 * h, 0.16, auto ? std(0xea580c, { roughness: 0.5, metalness: 0.4 }) : ink(0x4b5563)), -0.5 * r, 0.5 * h, -0.5 * r));
    if (auto) for (const dx of [-0.08, 0.08]) g.add(at(box(0.1, 0.18 * h, 0.1, ink(0x1f2937)), -0.5 * r + dx, 0.5 * h, -0.5 * r - 0.14));
    else for (const dx of [-0.08, 0.08]) g.add(at(cyl(0.01, 0.01, 0.34, M.steel(), 6), -0.5 * r + dx, 0.5 * h + 0.25, -0.5 * r));
    add('fts', 'Flight termination', g, V(-1, 0, -1));
  }
  return out;
}

/**
 * The pieces inside a part, for the exploded view: [{ key (the kit slot), name, object, dir (THREE.Vector3) }], or null
 * for the default pieces in bay/internalsArt.js. options = { slotKey: chosenOption }, dims = { radius, height }.
 */
export function internalsArt(def, options, dims) {
  const kit = def?.internals;
  const r = dims?.radius ?? BASE_R, h = dims?.height ?? 1;
  let out = null;
  if (TANK_KITS.has(kit)) out = tankPieces(def, options, r, h);
  else if (kit === 'stage_structure') out = structurePieces(def, options, r, h);
  else if (kit === 'avionics') out = avionicsPieces(def, options, r, h);
  if (!out) return null;
  for (const piece of out) piece.object.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return out;
}
