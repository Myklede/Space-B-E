// The 3D hangar: a lit stand with the player's rocket built from Role 3's rocketPart art, plus node and part
// anchors in world space that hangarScreen.js projects onto the terminal. Only index.js creates one.
import * as THREE from 'three';
import { assets } from '/src/graphics/index.js';

const ART_WORDS = /capsule|command|heat|shield|tile|engine|nozzle|pump|chamber|nose|cone|fin|leg|tank|fuel/;
const HIGHLIGHT = new THREE.Color(0x67e8f9);
const SELECTED = new THREE.Color(0xfbbf24);
const CYAN = new THREE.Color(0.25, 1.5, 1.8);

function moduleBox(entry) {
  // Parts without Role 3 art yet (antennas, RCS, tanks of oxygen): a dark module with a cyan strip, not a grey box.
  const w = Math.min(1.1, Math.max(0.5, entry.height * 0.6));
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, entry.height, w), new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.55, metalness: 0.5 }));
  body.position.y = entry.height / 2;
  body.castShadow = body.receiveShadow = true;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, entry.height * 0.12, w * 1.02), new THREE.MeshBasicMaterial({ color: CYAN }));
  strip.position.y = entry.height * 0.7;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: 0x3a4a55 }));
  edges.position.y = entry.height / 2;
  group.add(body, strip, edges);
  group.userData.width = w;
  return group;
}

export function createHangarScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080c);
  scene.fog = new THREE.Fog(0x05080c, 40, 110);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 600);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: 0x0f141a, roughness: 0.92, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const grid = new THREE.GridHelper(120, 60, 0x1f4a56, 0x0c1a20);
  grid.position.y = 0.02;
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.35, 48), new THREE.MeshStandardMaterial({ color: 0x1b2229, roughness: 0.5, metalness: 0.6 }));
  stand.position.y = 0.175;
  stand.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.03, 8, 64), new THREE.MeshBasicMaterial({ color: CYAN }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.36;

  const key = new THREE.SpotLight(0xdff6ff, 1500, 90, Math.PI / 5, 0.5, 2);
  key.position.set(14, 22, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0005;
  const fill = new THREE.DirectionalLight(0x8ea4c8, 0.7);
  fill.position.set(-10, 8, -6);
  const rim = new THREE.PointLight(0x67e8f9, 120, 60, 1.8);
  rim.position.set(-8, 6, -12);
  const ambient = new THREE.AmbientLight(0x3a4a5a, 0.5);

  const rocket = new THREE.Group();
  scene.add(floor, grid, stand, ring, key, key.target, fill, rim, ambient, rocket);

  const groups = new Map(); // partId -> Object3D
  const anchors = []; // [{ kind: 'node' | 'handle', partId, node, local: Vector3 (rocket space) }]
  const glows = new Map(); // partId -> { until, color }
  let selected = null;
  let yaw = 0;
  let sway = 0;
  let frameTarget = { center: new THREE.Vector3(0, 4, 0), distance: 18 };
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3(0, 4, 0);
  let settled = false;

  function disposeObject(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.());
    });
  }

  // Axial parts always use Role 3's art (capsule, tank, engine, nose, shield). Side-mounted parts only when they
  // are fins or legs: an "o2_bottle" must not become a 4 m fuel tank because of a word in its id.
  function partArt(entry) {
    const type = entry.type.toLowerCase();
    if (entry.attach === 'axial' && ART_WORDS.test(type)) return assets.get(`rocketPart:${entry.type}`);
    if (entry.attach === 'radial' && /fin|leg/.test(type)) return assets.get(`rocketPart:${entry.type}`);
    return moduleBox(entry);
  }

  /** Rebuild the rocket from assembly.layout(). freeNodes: [{ partId, node }]. */
  function setLayout(layout, freeNodes = []) {
    for (const child of [...rocket.children]) {
      rocket.remove(child);
      disposeObject(child);
    }
    groups.clear();
    anchors.length = 0;
    for (const e of layout) {
      const art = partArt(e);
      art.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      let holder = art;
      if (e.attach === 'radial') {
        const pivot = new THREE.Group();
        pivot.position.set(0, e.y, 0);
        pivot.rotation.y = (e.angle * Math.PI) / 180;
        const isFin = /fin/.test(e.type);
        const isLegs = /leg/.test(e.type);
        if (!isFin && !isLegs) art.position.x = e.radius + (art.userData.width ?? 0.6) * 0.45;
        if (isFin) art.position.x = e.radius - 1.2; // Role 3's fin sits at x = 1.2 for a radius-1.25 body
        pivot.add(art);
        holder = pivot;
      } else {
        art.position.y = e.y;
      }
      holder.userData.partId = e.id;
      rocket.add(holder);
      groups.set(e.id, holder);
      const handleLocal = e.attach === 'radial'
        ? new THREE.Vector3(Math.cos((e.angle * Math.PI) / 180) * (e.radius + 0.9), e.y + e.height * 0.5, -Math.sin((e.angle * Math.PI) / 180) * (e.radius + 0.9))
        : new THREE.Vector3(-e.radius - 0.6, e.centerY, 0);
      anchors.push({ kind: 'handle', partId: e.id, node: null, local: handleLocal, radius: e.radius, y: e.centerY });
    }
    for (const { partId, node } of freeNodes) {
      const e = layout.find((l) => l.id === partId);
      if (!e) continue;
      const local = node === 'top' ? new THREE.Vector3(0, e.y + e.height, 0)
        : node === 'bottom' ? new THREE.Vector3(0, e.y, 0)
        : new THREE.Vector3(e.radius + 0.25, e.y + e.height * 0.5, 0);
      anchors.push({ kind: 'node', partId, node, local, radius: e.radius, y: e.y + e.height * 0.5 });
    }
    const height = layout.reduce((top, e) => (e.attach === 'axial' ? Math.max(top, e.y + e.height) : top), 0);
    const radius = layout.reduce((r, e) => Math.max(r, e.radius), 1.25);
    frameTarget = { center: new THREE.Vector3(0, Math.max(2.5, height * 0.5), 0), distance: Math.max(14, height * 1.25 + radius * 3 + 4) };
    applyGlow();
  }

  function applyGlow() {
    for (const [id, holder] of groups) {
      const glow = glows.get(id);
      const color = selected === id ? SELECTED : glow ? glow.color : null;
      holder.traverse((o) => {
        if (!o.isMesh || !o.material || !('emissive' in o.material)) return;
        if (!o.material.userData.cloned) {
          o.material = o.material.clone();
          o.material.userData.cloned = true;
          o.material.userData.baseEmissive = o.material.emissive.clone();
          o.material.userData.baseIntensity = o.material.emissiveIntensity;
        }
        if (color) {
          o.material.emissive.copy(color);
          o.material.emissiveIntensity = 0.9;
        } else {
          o.material.emissive.copy(o.material.userData.baseEmissive);
          o.material.emissiveIntensity = o.material.userData.baseIntensity;
        }
      });
    }
  }

  /** Make parts glow for a while (builder:highlightPart). */
  function highlight(ids, seconds = 1.6, color = HIGHLIGHT) {
    const until = performance.now() / 1000 + seconds;
    for (const id of ids) if (groups.has(id)) glows.set(id, { until, color });
    applyGlow();
  }

  function clearHighlight() {
    glows.clear();
    applyGlow();
  }

  function select(id) {
    selected = id;
    applyGlow();
  }

  /** World positions of every anchor for this frame. */
  function worldAnchors() {
    rocket.updateMatrixWorld(true);
    // Radial node markers face the camera: put them on the side of the body nearest the viewer.
    const toCam = new THREE.Vector3().subVectors(camera.position, rocket.position).setY(0).normalize();
    const out = [];
    for (const a of anchors) {
      const local = a.local.clone();
      if (a.kind === 'node' && a.node === 'radial') local.set(toCam.x * (a.radius + 0.25), a.y, toCam.z * (a.radius + 0.25)).applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
      out.push({ ...a, world: local.applyMatrix4(rocket.matrixWorld) });
    }
    return out;
  }

  function rotateBy(degrees) {
    yaw += (degrees * Math.PI) / 180;
  }

  function update(dt) {
    sway += dt;
    rocket.rotation.y = yaw + Math.sin(sway * 0.35) * 0.06;
    const now = performance.now() / 1000;
    let changed = false;
    for (const [id, glow] of glows) if (glow.until < now) { glows.delete(id); changed = true; }
    if (changed) applyGlow();
    for (const [id, holder] of groups) {
      const glow = glows.get(id);
      if (!glow && selected !== id) continue;
      const pulse = 0.55 + 0.45 * Math.sin(now * 6);
      holder.traverse((o) => { if (o.isMesh && o.material?.userData?.cloned && (glow || selected === id)) o.material.emissiveIntensity = 0.5 + 0.7 * pulse; });
    }
    const { center, distance } = frameTarget;
    const wanted = new THREE.Vector3(distance * 0.5, center.y + distance * 0.22, distance * 0.86);
    const k = settled ? 1 - Math.exp(-dt * 4) : 1;
    camPos.lerp(wanted, k);
    camLook.lerp(center, k);
    settled = true;
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    key.target.position.copy(center);
  }

  function dispose() {
    for (const child of [...rocket.children]) disposeObject(child);
    disposeObject(floor);
    disposeObject(stand);
    disposeObject(ring);
  }

  return { scene, camera, rocket, setLayout, highlight, clearHighlight, select, worldAnchors, rotateBy, update, dispose, get yaw() { return yaw; } };
}
