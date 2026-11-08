// v5 part "decks" (owner: decks agent): smooth collar bands that hug the real ship at every level x segment.
// Contract: createDeckCollars(ctx) returns {fit(entries,hull), update(dt,platforms), fits[level][segmentId].retract, batches[]}.
// One mesh, one draw call for all 33 bands: each vertex carries its band index and a uniform array moves every band
// with its sliding deck segment (platform.userData.offset x slide axis). Geometry is rebuilt only in fit() (ship change).
import {fitCollarSmooth} from '/src/builder/tools/blender/hangar/collarSmooth.mjs';

const COLOURS = {top: 0x7f8585, under: 0x5d6a70, lens: 0xdfe9ef, yellow: 0xd7a024, beam: 0x67747a, rail: 0xc6cdcc, cap: 0x7b8587};

export function createDeckCollars(ctx) {
  const {THREE, scene, layout} = ctx, fragment = ctx.fragment ?? {};
  const cfg = {...layout.collar, ...(fragment.collar ?? {})};
  const segs = fragment.segments?.length ? fragment.segments : [];
  const deckModule = segs[0]?.module ?? 'deck_quad_v5';
  const open = fragment.openSector ?? {center: 135, width: 90};
  const openEdges = [open.center - open.width / 2, open.center + open.width / 2].map(a => ((a % 360) + 360) % 360);
  const levels = layout.levels.map(l => l.y);
  const bands = [];
  levels.forEach((y, level) => segs.forEach(s => bands.push({level, segment: s.id, axis: s.slideAxis, arc: s.arc, y, start: 0, end: 0, box: null})));
  const offsets = bands.map(() => new THREE.Vector3());
  const colour = Object.fromEntries(Object.entries(COLOURS).map(([k, v]) => [k, new THREE.Color(v).toArray()]));

  const material = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .7, metalness: .24, side: THREE.DoubleSide});
  material.name = 'deck_collar_v5';
  // Vertex: per-band slide offset. Fragment: the deck module's 2 m panel grid (seams + per-panel tint) on top
  // surfaces, fixed to the deck so it slides with it; lamp lenses under the band glow (no real lights).
  material.onBeforeCompile = shader => {
    shader.uniforms.bandOffset = {value: offsets};
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float band;\nattribute float glow;\nuniform vec3 bandOffset[${bands.length}];\nvarying vec3 vDeckPos;\nvarying float vGlow;\nvarying float vTop;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDeckPos = position; vGlow = glow; vTop = normal.y * normal.y > .8 ? 1. : 0.;\ntransformed += bandOffset[int(band + .5)];');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDeckPos;\nvarying float vGlow;\nvarying float vTop;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vTop > .5 && vGlow < .5) {
          vec2 g = vDeckPos.xz * .5, f = abs(fract(g) - .5), w = fwidth(g) * 1.5;
          float line = max(smoothstep(.49 - w.x, .49, f.x), smoothstep(.49 - w.y, .49, f.y));
          float hash = fract(sin(dot(floor(g), vec2(12.9898, 78.233))) * 43758.5453);
          // Soft value noise standing in for the baked CC0 plate texture (worn paint), so the band blends in.
          vec2 q = vDeckPos.xz * 2.7, i = floor(q), u = fract(q); u = u * u * (3. - 2. * u);
          #define DH(p) fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453)
          float vn = mix(mix(DH(i), DH(i + vec2(1., 0.)), u.x), mix(DH(i + vec2(0., 1.)), DH(i + vec2(1., 1.)), u.x), u.y);
          float fade = 1. - smoothstep(.15, .5, max(w.x, w.y) * 6.);
          diffuseColor.rgb *= mix(.88 + .12 * hash, .6, line * .65) * (1. + (vn - .5) * .16 * fade);
        }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(.86, .94, 1.) * vGlow * 1.6;');
  };
  material.customProgramCacheKey = () => 'deck-collar-v5c-' + bands.length;
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.name = 'deck_collar_v5'; mesh.frustumCulled = false; mesh.matrixAutoUpdate = false;
  scene.add(mesh);

  // Ray picking for the scene's double-click focus: test each band with its current slide offset.
  const tmpRay = new THREE.Ray(), va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), hit = new THREE.Vector3();
  mesh.raycast = (raycaster, intersects) => {
    const pos = mesh.geometry.attributes.position; if (!pos) return;
    bands.forEach((b, i) => {
      if (b.end <= b.start) return;
      tmpRay.copy(raycaster.ray); tmpRay.origin.sub(offsets[i]);
      if (!tmpRay.intersectsBox(b.box)) return;
      for (let v = b.start; v < b.end; v += 3) {
        va.fromBufferAttribute(pos, v); vb.fromBufferAttribute(pos, v + 1); vc.fromBufferAttribute(pos, v + 2);
        if (!tmpRay.intersectTriangle(va, vb, vc, false, hit)) continue;
        const distance = tmpRay.origin.distanceTo(hit);
        if (distance < raycaster.near || distance > raycaster.far) continue;
        intersects.push({distance, point: hit.clone().add(offsets[i]), object: mesh, faceIndex: v / 3});
      }
    });
  };

  let fits = [];
  function build() {
    const P = [], C = [], B = [], L = [];
    let bandIndex = 0, rgb = colour.top, glow = 0;
    const tri = (a, b, c) => { P.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) { C.push(...rgb); B.push(bandIndex); L.push(glow); } };
    const quad = (a, b, c, d) => { tri(a, b, c); tri(a, c, d); };
    const D = cfg.deckTop ?? 0, F = cfg.fasciaDepth ?? .45, T = D + .004, toe = D + (cfg.toeHeight ?? .13), Rout = cfg.outerRadius ?? 6.04, R = cfg.notchRadius ?? 6;
    bands.forEach((b, i) => {
      bandIndex = i; b.start = P.length / 3;
      const f = fits[b.level]?.[b.segment];
      if (!f || f.retract) { b.end = b.start; return; }
      const y = b.y, A = f.angles.map(a => a * Math.PI / 180), r = f.radii;
      const pt = (rad, a, h) => [rad * Math.cos(a), y + h, -rad * Math.sin(a)];
      for (let k = 0; k < A.length - 1; k++) {
        const a0 = A[k], a1 = A[k + 1], r0 = r[k], r1 = r[k + 1];
        rgb = colour.top; quad(pt(r0, a0, T), pt(Rout, a0, T), pt(Rout, a1, T), pt(r1, a1, T));
        rgb = colour.under; quad(pt(r0 + .07, a0, -.06), pt(Rout, a0, -.06), pt(Rout, a1, -.06), pt(r1 + .07, a1, -.06));
        rgb = colour.yellow;
        quad(pt(r0, a0, -F), pt(r1, a1, -F), pt(r1, a1, T), pt(r0, a0, T));                       // fascia, ship side
        quad(pt(r0 + .07, a0, -F), pt(r1 + .07, a1, -F), pt(r1 + .07, a1, -.06), pt(r0 + .07, a0, -.06));
        quad(pt(r0, a0, -F), pt(r0 + .07, a0, -F), pt(r1 + .07, a1, -F), pt(r1, a1, -F));        // fascia underside
        quad(pt(r0 + .012, a0, T), pt(r1 + .012, a1, T), pt(r1 + .012, a1, toe), pt(r0 + .012, a0, toe)); // toe board
        quad(pt(r0 + .035, a0, T), pt(r1 + .035, a1, T), pt(r1 + .035, a1, toe), pt(r0 + .035, a0, toe));
        quad(pt(r0 + .012, a0, toe), pt(r0 + .035, a0, toe), pt(r1 + .035, a1, toe), pt(r1 + .012, a1, toe));
        if (Math.max(r0, r1) + .62 < R - .15) {                                                   // under-ring beam
          rgb = colour.beam;
          for (const rr of [.34, .52]) quad(pt(r0 + rr, a0, -.42), pt(r1 + rr, a1, -.42), pt(r1 + rr, a1, -.06), pt(r0 + rr, a0, -.06));
          quad(pt(r0 + .34, a0, -.42), pt(r0 + .52, a0, -.42), pt(r1 + .52, a1, -.42), pt(r1 + .34, a1, -.42));
        }
        // Second ring girder halfway to the deck edge, so the underside reads as framed steel, not a flat disc.
        const m0 = (r0 + R) / 2, m1 = (r1 + R) / 2;
        if (R - Math.max(r0, r1) > 1.6) {
          rgb = colour.beam;
          for (const rr of [-.1, .1]) quad(pt(m0 + rr, a0, -.36), pt(m1 + rr, a1, -.36), pt(m1 + rr, a1, -.06), pt(m0 + rr, a0, -.06));
          quad(pt(m0 - .1, a0, -.36), pt(m0 + .1, a0, -.36), pt(m1 + .1, a1, -.36), pt(m1 - .1, a1, -.36));
        }
      }
      // Lamp lenses under the band, between the two rings, every ~15 degrees.
      for (let k = 0; k < A.length - 1; k += 10) {
        const kk = Math.min(A.length - 2, k + 5), a0 = A[kk], a1 = A[kk + 1], rr = (r[kk] + .52 + (r[kk] + R) / 2 - .1) / 2;
        if (R - r[kk] < 1.6) continue;
        rgb = colour.lens; glow = 1;
        quad(pt(rr - .09, a0, -.075), pt(rr + .09, a0, -.075), pt(rr + .09, a1, -.075), pt(rr - .09, a1, -.075));
        glow = 0;
      }
      // End caps and the slot-face beam/rail continuation only where the arc meets the open quarter.
      for (const [end, k] of [[b.arc[0], 0], [b.arc[1], A.length - 1]]) {
        if (!openEdges.some(e => Math.abs(((end - e) % 360 + 540) % 360 - 180) < 1e-6)) continue;
        const a = A[k], re = r[k], U = [Math.cos(a), -Math.sin(a)];
        const n = k === 0 ? [-Math.sin(a), -Math.cos(a)] : [Math.sin(a), Math.cos(a)];        // toward the deck interior
        const Q = (u, w, h) => [U[0] * u + n[0] * w, y + h, U[1] * u + n[1] * w];
        rgb = colour.cap; quad(Q(re, 0, -.06), Q(Rout, 0, -.06), Q(Rout, 0, T), Q(re, 0, T));
        rgb = colour.yellow;
        const box = (u0, u1, w0, w1, h0, h1) => {
          const c = [[u0, w0], [u1, w0], [u1, w1], [u0, w1]];
          quad(Q(...c[0], h0), Q(...c[1], h0), Q(...c[2], h0), Q(...c[3], h0)); quad(Q(...c[0], h1), Q(...c[1], h1), Q(...c[2], h1), Q(...c[3], h1));
          for (let j = 0; j < 4; j++) { const p = c[j], q = c[(j + 1) % 4]; quad(Q(...p, h0), Q(...q, h0), Q(...q, h1), Q(...p, h1)); }
        };
        // Deep yellow I-beam (same section as the deck's slot fascia): flanges, web, stiffeners.
        const sb = cfg.slotBeam ?? {depth: .94, flange: .32, top: -.06}, top = sb.top, bot = sb.top - sb.depth, fl = sb.flange;
        const u0 = re + .02, u1 = R + .02;
        box(u0, u1, 0, fl, top - .035, top); box(u0, u1, 0, fl, bot, bot + .035); box(u0, u1, fl / 2 - .01, fl / 2 + .01, bot + .035, top - .035);
        for (let u = u0 + .45; u < u1 - .2; u += 1) for (const w of [.015, fl / 2 + .01]) box(u - .008, u + .008, w, w + .13, bot + .035, top - .035);
        // Double handrail with posts and toe board, continuing the deck's slot rail up to the ship.
        const rail = cfg.rail ?? {offset: .06, top: 1.07, mid: .53}, ro = rail.offset;
        rgb = colour.rail;
        // Runs between the stair gates (u from the ship axis along the slot line), each closed by end posts.
        const gates = (rail.gates?.[b.segment] ?? []).map(([g0, g1]) => [Math.max(g0, re), Math.min(g1, u1)]).filter(([g0, g1]) => g1 > g0).sort((p, q) => p[0] - q[0]);
        const runs = []; let from = re + .18;
        for (const [g0, g1] of gates) { if (g0 - from > .05) runs.push([from, g0]); from = Math.max(from, g1); }
        if (u1 - from > .05) runs.push([from, u1]);
        for (const [r0, r1] of runs) {
          rgb = colour.rail;
          const posts = Math.max(1, Math.ceil((r1 - r0) / 1.6));
          for (let p = 0; p <= posts; p++) { const u = r0 + (r1 - r0) * p / posts; box(u - .025, u + .025, ro - .025, ro + .025, D, D + 1.1); }
          for (const h of [rail.top, rail.mid]) box(r0, r1, ro - .0225, ro + .0225, D + h - .0225, D + h + .0225);
          rgb = colour.yellow; box(Math.max(r0 - .13, re + .05), r1, .015, .035, T, D + .11);
        }
      }
      b.end = P.length / 3;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    geometry.setAttribute('band', new THREE.Float32BufferAttribute(B, 1));
    geometry.setAttribute('glow', new THREE.Float32BufferAttribute(L, 1));
    geometry.computeVertexNormals();
    const pos = geometry.attributes.position;
    for (const b of bands) { b.box = new THREE.Box3(); for (let v = b.start; v < b.end; v++) b.box.expandByPoint(va.fromBufferAttribute(pos, v)); }
    mesh.geometry.dispose(); mesh.geometry = geometry;
  }

  return {
    batches: [mesh], mesh, bands, cfg,
    get fits() { return fits; },
    fit(entries, hull) {
      fits = levels.map(y => Object.fromEntries(segs.map(s => [s.id, fitCollarSmooth(y, s, entries, hull, cfg)])));
      build();
      return fits;
    },
    update(dt, platforms) {
      const holders = new Map();
      for (const h of platforms) { const p = h.userData.placement; if (p?.module === deckModule) holders.set(p.level + '/' + p.segment, h); }
      bands.forEach((b, i) => { const o = holders.get(b.level + '/' + b.segment)?.userData.offset ?? 0; offsets[i].set(b.axis[0] * o, b.axis[1] * o, b.axis[2] * o); });
    },
  };
}
