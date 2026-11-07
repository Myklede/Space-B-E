// The design studio: the vehicle alone in a dark studio, turned by hand, zoomed with the wheel, and pulled apart
// when a part is selected (its internals slide out along their own directions). Drawn by graphics.setView while the
// design page is open; the page projects anchors from here into DOM labels. No listeners: the page feeds it.
import * as THREE from 'three';
import { assets } from '/src/graphics/index.js';
import { partArt } from './bay/partArt.js';
import { internalsArt } from './bay/internalsArt.js';
import { wantsNasaArt } from './bay/nasa.js';
import { DEG, disposeObject } from './bay/util.js';

const SELECTED = new THREE.Color(0xfbbf24);
const HOVER = new THREE.Color(0x67e8f9);
const UP = new THREE.Vector3(0, 1, 0);

export function createDesignScene() {
  const scene = new THREE.Scene();
  scene.name = 'design-studio';
  scene.background = new THREE.Color(0x070d12);
  scene.fog = new THREE.Fog(0x070d12, 60, 140);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 400);

  // ----- studio: lights, a soft floor disc and a fine grid -----
  const key = new THREE.DirectionalLight(0xfff1e0, 2.2);
  key.position.set(8, 14, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -14;
  key.shadow.camera.right = key.shadow.camera.top = 14;
  key.shadow.camera.far = 60;
  const fill = new THREE.DirectionalLight(0x9fb4d8, 0.8);
  fill.position.set(-10, 6, -6);
  const rim = new THREE.DirectionalLight(0x67e8f9, 1.1);
  rim.position.set(0, 9, -14);
  scene.add(key, fill, rim, new THREE.HemisphereLight(0xdfe9ff, 0x0b1016, 0.5), new THREE.AmbientLight(0x2a3340, 0.6));
  const grid = new THREE.GridHelper(60, 60, 0x14303a, 0x0d1f27);
  grid.position.y = -0.01;
  scene.add(grid);
  const discCanvas = document.createElement('canvas');
  discCanvas.width = discCanvas.height = 256;
  const dctx = discCanvas.getContext('2d');
  const grad = dctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(103,232,249,0.22)');
  grad.addColorStop(0.5, 'rgba(103,232,249,0.06)');
  grad.addColorStop(1, 'rgba(103,232,249,0)');
  dctx.fillStyle = grad;
  dctx.fillRect(0, 0, 256, 256);
  const discTex = new THREE.CanvasTexture(discCanvas);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshBasicMaterial({ map: discTex, transparent: true, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  scene.add(disc);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const vehicle = new THREE.Group();
  vehicle.name = 'vehicle';
  scene.add(vehicle);
  const pieces = new THREE.Group(); // exploded internals of the selected part
  scene.add(pieces);

  const parts = new Map(); // id -> { holder, entry, art }
  const anchors = []; // { kind, id, node, key, name, local: Vector3 }
  let layoutCache = [];
  let layoutKey = '';
  let selected = null;
  let explode = 0, explodeTarget = 0;
  let explodedFor = null; // part id whose pieces are built
  let pieceList = []; // [{ key, name, object, dir, base: Vector3 }]
  let missingArt = [];

  // ----- orbit camera -----
  const orbit = { yaw: 0.6, pitch: 0.22, dist: 20, targetY: 6, fitDist: 20, fitY: 6, minDist: 3, auto: true, idle: 0 };
  const smooth = { yaw: 0.6, pitch: 0.22, dist: 20, targetY: 6 };
  const halfTan = Math.tan((camera.fov * Math.PI) / 360);
  function fitTo(stackHeight, radius) {
    const h = Math.max(4, stackHeight), r = Math.max(1.25, radius);
    orbit.fitY = h * 0.5;
    orbit.fitDist = Math.max((h * 1.28) / (2 * halfTan), r * 5) + 1.5;
  }
  /** Frame one part: close enough to read it, far enough that its exploded internals stay in view. */
  function focusOn(id, { exploded = false } = {}) {
    const p = parts.get(id);
    if (!p) return;
    const e = p.entry;
    const reach = Math.max(1.2, e.radius * 1.6 + 0.4);
    const span = exploded ? e.height + 2 * reach : Math.max(e.height, e.radius * 2.4) + 1;
    orbit.targetY = e.attach === 'radial' ? e.y + Math.min(e.height, 1.2) * 0.5 : e.centerY;
    orbit.dist = Math.min(orbit.fitDist, Math.max(orbit.fitDist * 0.2, (span * 1.15) / (2 * halfTan)));
    orbit.minDist = closestFor(id);
    orbit.pitch = Math.max(orbit.pitch, 0.12);
    orbit.idle = 0;
  }
  /** After looking inside: back out far enough that the part closes up again. */
  function relax() {
    orbit.dist = Math.max(orbit.dist, orbit.fitDist * 0.8);
    orbit.idle = 0;
  }
  // The DOM covers part of the window (side panel, strips): keep the vehicle centred in what is left of the view.
  let viewCentre = null;
  function setViewCentre(cx, cy, fullW, fullH) {
    const key = `${Math.round(cx)}:${Math.round(cy)}:${fullW}:${fullH}`;
    if (viewCentre === key) return;
    viewCentre = key;
    camera.setViewOffset(fullW, fullH, fullW / 2 - cx, fullH / 2 - cy, fullW, fullH);
  }
  function clearViewCentre() { viewCentre = null; camera.clearViewOffset(); }
  function fit() {
    orbit.targetY = orbit.fitY;
    orbit.dist = orbit.fitDist;
    orbit.pitch = 0.22;
  }
  function rotateBy(dxPx, dyPx) {
    orbit.yaw -= dxPx * 0.008;
    orbit.pitch = Math.min(1.35, Math.max(-0.6, orbit.pitch + dyPx * 0.006));
    orbit.idle = 0;
  }
  function zoomBy(factor) {
    orbit.dist = Math.min(orbit.fitDist * 2.2, Math.max(orbit.minDist, orbit.dist * factor));
    orbit.idle = 0;
  }
  /** The closest the wheel may come to a part: its exploded internals must still fit the view. */
  function closestFor(id) {
    const p = parts.get(id);
    if (!p) return orbit.fitDist * 0.12;
    const e = p.entry;
    const reach = Math.max(1.2, e.radius * 1.6 + 0.4);
    const span = e.def.internals ? e.height + 2 * reach : Math.max(e.height, e.radius * 2.4) + 1;
    return Math.max(orbit.fitDist * 0.15, (span * 1.05) / (2 * halfTan));
  }
  /** 0 at the fitted distance, 1 when fully zoomed into a part: the page uses it to decide how far to explode. */
  const zoomFraction = () => Math.min(1, Math.max(0, (orbit.fitDist * 0.75 - orbit.dist) / (orbit.fitDist * 0.5)));

  // ----- vehicle -----
  function setLayout(layout) {
    const keyNow = layout.map((e) => `${e.id}:${e.type}:${e.angle}:${e.yFrac}:${e.y.toFixed(2)}:${e.material ?? ''}:${JSON.stringify(e.options ?? null)}`).join('|');
    layoutCache = layout;
    let stackHeight = 0, radius = 1.25;
    for (const e of layout) if (e.attach === 'axial') { stackHeight = Math.max(stackHeight, e.y + e.height); radius = Math.max(radius, e.radius); }
    fitTo(stackHeight, radius);
    if (keyNow === layoutKey) return;
    layoutKey = keyNow;
    for (const child of [...vehicle.children]) { vehicle.remove(child); disposeObject(child); }
    parts.clear();
    anchors.length = 0;
    missingArt = [];
    for (const e of layout) {
      const art = partArt(e);
      art.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      if (wantsNasaArt(e.type) && !art.userData.nasa) missingArt.push(e.type);
      let holder = art;
      if (e.attach === 'radial') {
        const pivot = new THREE.Group();
        pivot.position.set(0, e.y, 0);
        pivot.rotation.y = e.angle * DEG;
        const isFin = /fin/.test(e.type), isLegs = /leg/.test(e.type), isSrb = !!art.userData.srb;
        const host = layout.find((x) => x.id === e.parentId);
        const taper = host?.def.flags?.capsule ? 1 - 0.3 * Math.max(0, e.yFrac - 0.4) : 1; // capsules narrow towards the top
        if (isSrb) art.position.x = e.radius + (art.userData.width ?? 0.9) * 0.5 + 0.05;
        else if (!isFin && !isLegs) art.position.x = e.radius * taper + (art.userData.width ?? 0.6) * 0.45;
        if (isFin) art.position.x = e.radius - 1.2;
        pivot.add(art);
        holder = pivot;
      } else {
        art.position.y = e.y;
      }
      holder.userData.partId = e.id;
      holder.traverse((o) => { o.userData.partId = e.id; });
      vehicle.add(holder);
      parts.set(e.id, { holder, entry: e, art });
      const local = e.attach === 'radial'
        ? new THREE.Vector3(Math.cos(e.angle * DEG) * (e.radius + 0.55 + (art.userData.width ?? 0.6) * 0.5), e.y + Math.min(e.height, 1.2) * 0.5, -Math.sin(e.angle * DEG) * (e.radius + 0.55 + (art.userData.width ?? 0.6) * 0.5))
        : new THREE.Vector3(-e.radius * 0.95, e.centerY, 0);
      anchors.push({ kind: 'part', id: e.id, local, entry: e });
    }
    explodedFor = null;
    rebuildPieces();
    applyLook();
  }

  function setFreeNodes(freeNodes) {
    for (let i = anchors.length - 1; i >= 0; i--) if (anchors[i].kind === 'slot') anchors.splice(i, 1);
    for (const { partId, node } of freeNodes) {
      const p = parts.get(partId);
      if (!p || node === 'radial') continue;
      const e = p.entry;
      anchors.push({ kind: 'slot', id: partId, node, local: new THREE.Vector3(0, node === 'top' ? e.y + e.height + 0.35 : e.y - 0.35, 0), entry: e });
    }
  }

  // ----- selection, dimming, explosion -----
  function cloneMaterials(root) {
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      if (o.material.userData?.vdCloned) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = mats.map((m) => {
        const c = m.clone();
        c.userData = { ...m.userData, vdCloned: true, baseOpacity: m.opacity, baseTransparent: m.transparent, baseEmissive: m.emissive ? m.emissive.clone() : null, baseEmissiveIntensity: m.emissiveIntensity ?? 1 };
        return c;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
    });
  }
  function setLook(root, { opacity = 1, emissive = null, emissiveIntensity = 0 } = {}) {
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        const u = m.userData;
        if (!u?.vdCloned) continue;
        m.transparent = opacity < 1 || u.baseTransparent;
        m.opacity = Math.min(u.baseOpacity, opacity);
        m.depthWrite = opacity >= 1;
        if (m.emissive && u.baseEmissive) {
          if (emissive) { m.emissive.copy(emissive); m.emissiveIntensity = emissiveIntensity; } else { m.emissive.copy(u.baseEmissive); m.emissiveIntensity = u.baseEmissiveIntensity; }
        }
      }
    });
  }
  function applyLook() {
    const exploded = explode > 0.02 && selected && parts.has(selected);
    for (const [id, p] of parts) {
      cloneMaterials(p.holder);
      if (id === selected) setLook(p.holder, { opacity: exploded ? Math.max(0.08, 1 - explode * 1.15) : 1, emissive: exploded ? null : SELECTED, emissiveIntensity: 0.55 });
      else setLook(p.holder, { opacity: exploded ? 0.22 : 1 });
    }
  }
  function select(id) {
    selected = id && parts.has(id) ? id : null;
    if (selected !== explodedFor) rebuildPieces();
    applyLook();
    if (selected) {
      const e = parts.get(selected).entry;
      orbit.targetY = e.attach === 'radial' ? e.y + Math.min(e.height, 1.2) * 0.5 : e.centerY;
      orbit.minDist = closestFor(selected);
      if (orbit.dist < orbit.minDist) orbit.dist = orbit.minDist;
    } else {
      orbit.minDist = orbit.fitDist * 0.12;
    }
  }
  function rebuildPieces() {
    for (const child of [...pieces.children]) { pieces.remove(child); disposeObject(child); }
    pieceList = [];
    explodedFor = selected;
    const p = selected && parts.get(selected);
    if (!p || !p.entry.def.internals) return;
    const e = p.entry;
    const kit = internalsArt(e.def, e.options ? optionsFor(e) : optionsFor(e), { radius: e.radius, height: e.height });
    const base = new THREE.Group();
    if (e.attach === 'radial') { base.position.set(0, e.y, 0); base.rotation.y = e.angle * DEG; }
    const inner = new THREE.Group();
    if (e.attach === 'radial') inner.position.x = p.art.position.x; else inner.position.y = e.y;
    base.add(inner);
    for (const piece of kit) {
      piece.object.userData.internalKey = piece.key;
      piece.object.traverse((o) => { o.userData.internalKey = piece.key; });
      piece.base = piece.object.position.clone();
      inner.add(piece.object);
      pieceList.push(piece);
    }
    pieces.add(base);
    pieces.userData.inner = inner;
  }
  let optionsResolver = () => ({});
  const optionsFor = (e) => optionsResolver(e.id) ?? {};

  function setExplode(t) { explodeTarget = Math.min(1, Math.max(0, t)); }

  // ----- picking and projection -----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX, clientY, rect) {
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (explode > 0.3 && pieces.children.length) {
      const hit = raycaster.intersectObjects(pieces.children, true)[0];
      if (hit) {
        let o = hit.object;
        while (o && !o.userData.internalKey) o = o.parent;
        if (o) return { internal: o.userData.internalKey, partId: selected };
      }
    }
    const hits = raycaster.intersectObjects(vehicle.children, true);
    for (const hit of hits) {
      let o = hit.object;
      while (o && !o.userData.partId) o = o.parent;
      if (!o) continue;
      const p = parts.get(o.userData.partId);
      // dimmed parts behind an exploded one should not steal the click
      if (explode > 0.3 && selected && o.userData.partId !== selected) continue;
      if (p) return { partId: o.userData.partId };
    }
    return null;
  }
  const v = new THREE.Vector3();
  function project(world, rect) {
    v.copy(world).project(camera);
    return { x: (v.x + 1) / 2 * rect.width, y: (1 - v.y) / 2 * rect.height, visible: v.z < 1 && v.z > -1 };
  }
  /** Screen anchors for the page: parts, slots and (when exploded) internal pieces. */
  function screenAnchors(rect) {
    scene.updateMatrixWorld(true);
    const out = [];
    const exploded = explode > 0.25 && selected;
    for (const a of anchors) {
      if (exploded && !(a.kind === 'part' && a.id === selected)) continue;
      const world = a.local.clone().applyMatrix4(vehicle.matrixWorld);
      out.push({ ...a, ...project(world, rect) });
    }
    if (exploded) {
      for (const piece of pieceList) {
        const world = new THREE.Vector3();
        piece.object.getWorldPosition(world);
        const box = new THREE.Box3().setFromObject(piece.object);
        if (!box.isEmpty()) box.getCenter(world);
        out.push({ kind: 'internal', id: selected, key: piece.key, name: piece.name, ...project(world, rect) });
      }
    }
    return out;
  }

  // ----- frame -----
  function update(dt) {
    orbit.idle += dt;
    if (orbit.auto && orbit.idle > 5 && explode < 0.05) orbit.yaw += dt * 0.12;
    const k = 1 - Math.exp(-dt * 9);
    smooth.yaw += (orbit.yaw - smooth.yaw) * k;
    smooth.pitch += (orbit.pitch - smooth.pitch) * k;
    smooth.dist += (orbit.dist - smooth.dist) * k;
    smooth.targetY += (orbit.targetY - smooth.targetY) * k;
    const cp = Math.cos(smooth.pitch);
    camera.position.set(Math.sin(smooth.yaw) * cp * smooth.dist, smooth.targetY + Math.sin(smooth.pitch) * smooth.dist, Math.cos(smooth.yaw) * cp * smooth.dist);
    camera.up.copy(UP);
    camera.lookAt(0, smooth.targetY, 0);
    const before = explode;
    explode += (explodeTarget - explode) * (1 - Math.exp(-dt * 7));
    if (Math.abs(explode - before) > 0.002) applyLook();
    if (pieceList.length) {
      const p = parts.get(selected);
      const reach = p ? Math.max(1.2, p.entry.radius * 1.6 + 0.4) : 1.6;
      for (const piece of pieceList) piece.object.position.copy(piece.base).addScaledVector(piece.dir, explode * reach);
      pieces.visible = explode > 0.02;
    } else pieces.visible = false;
  }

  function dispose() {
    for (const child of [...vehicle.children]) disposeObject(child);
    for (const child of [...pieces.children]) disposeObject(child);
    discTex.dispose();
  }

  return {
    scene, camera, orbit,
    setLayout, setFreeNodes, select, setExplode, pick, screenAnchors, update, dispose, fit, rotateBy, zoomBy, zoomFraction, focusOn, relax, setViewCentre, clearViewCentre,
    setOptionsResolver: (fn) => { optionsResolver = fn; },
    setEnvironment: () => { scene.environment = assets.environment?.() ?? null; scene.environmentIntensity = 0.35; },
    get selected() { return selected; },
    get explode() { return explode; },
    get missingArt() { return missingArt; },
    get layout() { return layoutCache; },
    /** Forget the built vehicle so the next setLayout rebuilds it (after real models arrive). */
    invalidate() { layoutKey = ''; },
  };
}
