// The design hologram: a projector on a console throws a scaled, slowly turning holographic copy of the vehicle
// into the air. Parts are dragged onto its glowing nodes; the real vehicle on the stand follows.
import * as THREE from 'three';
import { partArt } from './partArt.js';
import { DEG, box, cylinder, disposeObject, glow, std } from './util.js';

const HOLO_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-(viewMatrix * world).xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const HOLO_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    // a dark translucent body with bright edges, so the shape reads like smoked glass lit from inside
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
    float scan = 0.85 + 0.15 * sin(vWorld.y * 90.0 - uTime * 5.0);
    float flicker = 0.96 + 0.04 * sin(uTime * 23.0) * sin(uTime * 7.3);
    vec3 body = uColor * 0.07;
    vec3 edge = uColor * 0.85 + vec3(0.12);
    vec3 col = mix(body, edge, fresnel) * scan * flicker;
    float alpha = (0.8 + 0.2 * fresnel) * uOpacity;
    gl_FragColor = vec4(col, alpha);
  }
`;

export function holoMaterial(color = 0x67e8f9) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: HOLO_VERT, fragmentShader: HOLO_FRAG,
    transparent: true, depthWrite: true, side: THREE.FrontSide, blending: THREE.NormalBlending,
  });
}

/**
 * createHologram({ scene })
 *   show({ position, layout, freeNodes, yaw })   project the vehicle above `position` (the projector sits there)
 *   hide()
 *   setLayout(layout, freeNodes)                   rebuild the projection (same layout the stand uses)
 *   worldAnchors()                                 node and handle anchors in world space (for DOM markers)
 *   select(id), highlight(ids)
 *   update(dt)
 */
export function createHologram({ scene }) {
  const root = new THREE.Group();
  root.name = 'hologram';
  root.visible = false;
  scene.add(root);

  // projector hardware: a lens on a short mast, the light cone and a glowing floor ring
  const mast = cylinder(0.06, 0.08, 0.6, std(0x23282d, { roughness: 0.5, metalness: 0.7 }), { y: 0.3 });
  const lens = cylinder(0.16, 0.12, 0.08, glow(0x67e8f9, 2.4), { y: 0.64 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.025, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.y = 0.68 + 1.2;
  cone.rotation.x = Math.PI;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 48), new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.69;
  const light = new THREE.PointLight(0x67e8f9, 6, 5, 2);
  light.position.y = 1.6;
  root.add(mast, lens, cone, ring, light);

  const BASE_Y = 0.78; // where the projection stands above the projector
  const vehicle = new THREE.Group(); // the projection: parts with hologram materials, scaled to fit
  vehicle.position.y = BASE_Y;
  root.add(vehicle);
  const platform = new THREE.Mesh(new THREE.CircleGeometry(0.7, 48), new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  platform.rotation.x = -Math.PI / 2;
  platform.position.y = BASE_Y;
  root.add(platform);
  const sweep = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.015), new THREE.MeshBasicMaterial({ color: 0x9df3ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  sweep.rotation.x = -Math.PI / 2;
  root.add(sweep);

  const materials = { base: holoMaterial(0x67e8f9), selected: holoMaterial(0xfbbf24), glow: holoMaterial(0xffffff) };
  const groups = new Map();
  const anchors = [];
  let selected = null;
  let glowing = new Set();
  let scale = 1;
  let spin = 0;
  let exploded = 0; // 0..1
  let targetExploded = 0;
  let layoutCache = [];
  const FIT_HEIGHT = 1.7; // metres the projection may fill
  const nodeMat = new THREE.MeshBasicMaterial({ color: 0x9df3ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });

  function applyMaterials() {
    for (const [id, holder] of groups) {
      const mat = selected === id ? materials.selected : glowing.has(id) ? materials.glow : materials.base;
      holder.traverse((o) => { if (o.isMesh && !o.userData.holoNode) o.material = mat; });
    }
  }

  function setLayout(layout, freeNodes = []) {
    for (const child of [...vehicle.children]) { vehicle.remove(child); disposeObject(child); }
    groups.clear();
    anchors.length = 0;
    layoutCache = layout;
    const height = layout.reduce((top, e) => (e.attach === 'axial' ? Math.max(top, e.y + e.height) : top), 1);
    scale = Math.min(FIT_HEIGHT / height, 0.6);
    vehicle.scale.setScalar(scale);
    for (const e of layout) {
      const art = partArt(e);
      let holder = art;
      if (e.attach === 'radial') {
        const pivot = new THREE.Group();
        pivot.position.set(0, e.y, 0);
        pivot.rotation.y = e.angle * DEG;
        const isFin = /fin/.test(e.type), isLegs = /leg/.test(e.type);
        if (!isFin && !isLegs) art.position.x = e.radius + (art.userData.width ?? 0.6) * 0.45;
        if (isFin) art.position.x = e.radius - 1.2;
        pivot.add(art);
        holder = pivot;
      } else art.position.y = e.y;
      holder.userData.partId = e.id;
      holder.userData.baseY = holder.position.y;
      holder.userData.centerY = e.centerY;
      vehicle.add(holder);
      groups.set(e.id, holder);
      const handleLocal = e.attach === 'radial'
        ? new THREE.Vector3(Math.cos(e.angle * DEG) * (e.radius + 0.9), e.y + e.height * 0.5, -Math.sin(e.angle * DEG) * (e.radius + 0.9))
        : new THREE.Vector3(-e.radius - 0.5, e.centerY, 0);
      anchors.push({ kind: 'handle', partId: e.id, node: null, local: handleLocal, radius: e.radius, y: e.centerY });
    }
    for (const { partId, node } of freeNodes) {
      const e = layout.find((l) => l.id === partId);
      if (!e) continue;
      const local = node === 'top' ? new THREE.Vector3(0, e.y + e.height, 0) : node === 'bottom' ? new THREE.Vector3(0, e.y, 0) : new THREE.Vector3(e.radius + 0.25, e.y + e.height * 0.5, 0);
      anchors.push({ kind: 'node', partId, node, local, radius: e.radius, y: e.y + e.height * 0.5 });
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05 / scale, 10, 10), nodeMat);
      dot.position.copy(local);
      dot.userData.holoNode = true;
      dot.userData.node = { partId, node };
      vehicle.add(dot);
    }
    applyMaterials();
  }

  function worldAnchors() {
    vehicle.updateMatrixWorld(true);
    const toCam = new THREE.Vector3(1, 0, 0);
    const out = [];
    for (const a of anchors) {
      const local = a.local.clone();
      if (a.kind === 'node' && a.node === 'radial') local.set(toCam.x * (a.radius + 0.25), a.y, toCam.z * (a.radius + 0.25)).applyAxisAngle(new THREE.Vector3(0, 1, 0), -spin);
      const holder = groups.get(a.partId);
      if (holder && exploded > 0 && holder.userData.baseY !== undefined) local.y += (holder.position.y - holder.userData.baseY);
      out.push({ ...a, world: local.applyMatrix4(vehicle.matrixWorld) });
    }
    return out;
  }

  function show({ position, facing = 0 }) {
    root.position.copy(position);
    root.rotation.y = facing;
    root.visible = true;
    spin = 0;
  }

  function update(dt) {
    if (!root.visible) return;
    const t = performance.now() / 1000;
    for (const m of Object.values(materials)) m.uniforms.uTime.value = t;
    spin += dt * 0.25;
    vehicle.rotation.y = spin;
    sweep.position.y = BASE_Y + ((t * 0.5) % 1) * FIT_HEIGHT;
    sweep.material.opacity = 0.35 + 0.2 * Math.sin(t * 3);
    lens.material.color.setScalar(2.0 + 0.5 * Math.sin(t * 9));
    exploded += (targetExploded - exploded) * Math.min(1, dt * 5);
    const centre = layoutCache.reduce((top, e) => (e.attach === 'axial' ? Math.max(top, e.y + e.height) : top), 1) / 2;
    for (const [, holder] of groups) {
      if (holder.userData.baseY === undefined) continue;
      const off = (holder.userData.centerY - centre) * 0.35 * exploded;
      holder.position.y = holder.userData.baseY + off;
    }
  }

  return {
    root, vehicle,
    show, hide: () => { root.visible = false; },
    setLayout, worldAnchors, update,
    select(id) { selected = id; applyMaterials(); },
    highlight(ids) { glowing = new Set(ids); applyMaterials(); },
    setExploded(on) { targetExploded = on ? 1 : 0; },
    get exploded() { return targetExploded > 0.5; },
    get visible() { return root.visible; },
    get spin() { return spin; },
    rotateBy(deg) { spin += deg * DEG; },
    dispose() { scene.remove(root); disposeObject(root); },
  };
}
