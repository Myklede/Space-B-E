import * as THREE from "three";
import { FlightController } from "../FlightController.js";
import { createCockpitControls } from "../cockpitControls.js";
import { assistReadout, predictPath } from "../flightAssist.js";
import { createCockpitRig } from "../camera/createCockpitRig.js";
import { createFlightHUD } from "../hud/createFlightHUD.js";
// Role 2 owns presentation only. Planet-centred physics stays in FlightController.
// Injected models are borrowed, never disposed here; fallback resources are owned.
function createLaunchScene({
  renderer, bus, planets, shipSpec,
  planetId = "earth",
  start = "pad",
  scenario = {},
  parent = document.body,
  getModel: externalModel,
  reducedMotion = false,
  scene: suppliedScene,
  renderFrame,
}) {
  const fc = new FlightController({ bus, planets, shipSpec, planetId, start, scenario });
  const scene = suppliedScene ?? new THREE.Scene();
  const world = new THREE.Group();
  scene.add(world, new THREE.HemisphereLight(12183551, 1515547, 1.2));
  const sun = new THREE.DirectionalLight(16771006, 2.8);
  sun.position.set(-1, 0.5, 0.3);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 1e8);
  const rig = createCockpitRig({ camera, element: renderer.domElement, reducedMotion });
  const hud = createFlightHUD({ parent });
  let assistOn = true;
  let disposed = false;
  let pathTimer = 0;
  const controls = createCockpitControls({
    onToggleAssist: () => { assistOn = !assistOn; },
    isLanded: () => fc.landed,
    onStandUp: () => bus.emit("interior:interact", { stationId: "seat" }),
  });
  const key = (e) => {
    if (e.code === "KeyC" && !e.repeat) rig.setChase(!rig.chase);
  };
  window.addEventListener("keydown", key);
  const geometries = new Set();
  const materials = new Set();
  const own = (object) => {
    object.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) for (const m of [].concat(o.material)) materials.add(m);
    });
    return object;
  };
  function getModel(name) {
    const supplied = externalModel?.(name);
    if (supplied) return supplied;
    const group = new THREE.Group();
    if (name === "rocket") {
      const metal = new THREE.MeshStandardMaterial({ color: 14213599, metalness: 0.6, roughness: 0.35 });
      group.add(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 14, 24), metal));
      const nose = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4, 24), metal);
      nose.position.y = 9;
      group.add(nose);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.84, 1.84, 1, 24), new THREE.MeshStandardMaterial({ color: 2242370 }));
      ring.position.y = -3;
      group.add(ring);
      group.position.y = 7;
    } else if (name === "cockpit") {
      // A near-camera canopy rim, aligned to camera coordinates and clear of the central view.
      const trim = new THREE.MeshStandardMaterial({ color: 1583924, metalness: 0.7, roughness: 0.45 });
      for (const side of [-1, 1]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.8, 0.12), trim);
        strut.position.set(side * 1.2, 0, -1.7);
        strut.rotation.z = side * -0.18;
        group.add(strut);
      }
      const sill = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.28), trim);
      sill.position.set(0, -0.95, -1.65);
      group.add(sill);
    }
    return own(group);
  }
  const ship = new THREE.Group();
  ship.add(getModel("rocket"));
  scene.add(ship);
  const cockpit = getModel("cockpit");
  camera.add(cockpit);
  scene.add(camera);
  const mars = planetId === "mars", R = fc.planet.radius;
  const planetModel = externalModel?.(`planet:${planetId}`);
  const planet = planetModel ?? own(new THREE.Mesh(
    new THREE.SphereGeometry(R, 128, 96),
    new THREE.MeshStandardMaterial({ color: mars ? 0xa95732 : 0x28577b, roughness: 0.95 }),
  ));
  if (planetModel) planet.scale.setScalar(R);
  world.add(planet);
  const pad = own(new THREE.Mesh(new THREE.CircleGeometry(1800, 64), new THREE.MeshStandardMaterial({ color: mars ? 10444862 : 3427134, roughness: 1 })));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = R + 0.04;
  world.add(pad);
  if (!mars) {
    const platform = own(new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 1, 48), new THREE.MeshStandardMaterial({ color: 6648954, roughness: 0.85 })));
    platform.position.y = R - 0.5;
    world.add(platform);
    const tower = own(new THREE.Mesh(new THREE.BoxGeometry(4, 40, 4), new THREE.MeshStandardMaterial({ color: 5399405, metalness: 0.6, roughness: 0.55 })));
    tower.position.set(12, R + 20, 0);
    world.add(tower);
  }
  const starPositions = [];
  // Deterministic positions make screenshots reproducible.
  for (let i = 0; i < 1500; i++) {
    const y = 1 - 2 * (i + 0.5) / 1500, angle = i * 2.39996323, r = Math.sqrt(1 - y * y);
    starPositions.push(r * Math.cos(angle) * 1e7, y * 1e7, r * Math.sin(angle) * 1e7);
  }
  const stars = own(new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3)), new THREE.PointsMaterial({ color: 13362414, size: 1.3, sizeAttenuation: false })));
  scene.add(stars);
  const thrustArrow = own(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 24, 16758120, 5, 2));
  const velocityArrow = own(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 24, 7530208, 5, 2));
  scene.add(thrustArrow, velocityArrow);
  const pathGeometry = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(241 * 3), 3));
  pathGeometry.setDrawRange(0, 0);
  const path = own(new THREE.Line(pathGeometry, new THREE.LineBasicMaterial({ color: 7530208, transparent: true, opacity: 0.6 })));
  path.frustumCulled = false;
  scene.add(path);
  // Shared geometry/material; each mesh tracks the controller-owned obstacle by id.
  const debrisGeometry = new THREE.DodecahedronGeometry(1, 0);
  const debrisMaterial = new THREE.MeshStandardMaterial({ color: 0x82939a, metalness: 0.7, roughness: 0.6 });
  geometries.add(debrisGeometry);
  materials.add(debrisMaterial);
  const debrisMeshes = new Map();
  const projectDirection = (direction) => {
    if (!direction) return null;
    const p = new THREE.Vector3(direction.x, direction.y, direction.z).multiplyScalar(1e3).add(camera.position);
    if (p.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert()).z >= 0) return null;
    p.project(camera);
    return Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.9 ? { x: (p.x + 1) * 50, y: (1 - p.y) * 50 } : null;
  };
  return {
    controller: fc,
    camera,
    scene,
    cockpit,
    ship,
    update(dt) {
      if (disposed) return;
      dt = Math.max(0, Math.min(0.1, dt));
      fc.update(dt, controls.input);
      controls.endFrame();
      const t = fc.telemetry, a = assistReadout(fc);
      const canvas = renderer.domElement, aspect = (canvas.clientWidth || canvas.width) / (canvas.clientHeight || canvas.height);
      if (camera.aspect !== aspect) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      }
      world.position.set(-fc.pos.x, -fc.pos.y, -fc.pos.z);
      ship.quaternion.set(fc.orient.x, fc.orient.y, fc.orient.z, fc.orient.w);
      ship.visible = rig.chase;
      cockpit.visible = !rig.chase;
      rig.update(dt, fc, t);
      camera.updateMatrixWorld();
      const darkness = 1 - Math.exp(-Math.max(0, t.altitude) / (fc.planet.scaleHeight * 2));
      if (!suppliedScene) scene.background = new THREE.Color(mars ? 0xbb8b60 : 0x73add0).lerp(new THREE.Color(0x02050b), darkness);
      stars.visible = !suppliedScene && darkness > 0.85;
      const arrowsOrigin = new THREE.Vector3(fc.forward.x, fc.forward.y, fc.forward.z).multiplyScalar(65);
      thrustArrow.visible = assistOn && t.thrust > 0;
      velocityArrow.visible = assistOn && t.speed > 0.1;
      path.visible = assistOn;
      thrustArrow.position.copy(arrowsOrigin).add(new THREE.Vector3(-5, 0, 0));
      velocityArrow.position.copy(arrowsOrigin).add(new THREE.Vector3(5, 0, 0));
      thrustArrow.setDirection(new THREE.Vector3(a.thrustDir.x, a.thrustDir.y, a.thrustDir.z));
      if (t.speed > 0.1) velocityArrow.setDirection(new THREE.Vector3(a.velocityDir.x, a.velocityDir.y, a.velocityDir.z));
      pathTimer -= dt;
      if (assistOn && pathTimer <= 0) {
        pathTimer = 0.5;
        const points = predictPath(fc, { seconds: t.phase === "orbit" ? 2400 : 300, maxPoints: 240 }), positions = pathGeometry.attributes.position;
        points.forEach((p, i) => positions.setXYZ(i, p.x - fc.pos.x, p.y - fc.pos.y, p.z - fc.pos.z));
        positions.needsUpdate = true;
        pathGeometry.setDrawRange(0, points.length);
        path.position.set(0, 0, 0);
        path.userData.origin = { ...fc.pos };
      }
      if (path.userData.origin) {
        const p = path.userData.origin;
        path.position.set(p.x - fc.pos.x, p.y - fc.pos.y, p.z - fc.pos.z);
      }
      const activeObstacles = new Set();
      for (const obstacle of fc.obstacles) {
        activeObstacles.add(obstacle.id);
        let mesh = debrisMeshes.get(obstacle.id);
        if (!mesh) {
          mesh = new THREE.Mesh(debrisGeometry, debrisMaterial);
          mesh.scale.setScalar(obstacle.radius);
          debrisMeshes.set(obstacle.id, mesh);
          scene.add(mesh);
        }
        mesh.position.set(obstacle.pos.x - fc.pos.x, obstacle.pos.y - fc.pos.y, obstacle.pos.z - fc.pos.z);
        const spin = obstacle.spin;
        if (spin) mesh.rotation.set(spin.x * fc.t, spin.y * fc.t, spin.z * fc.t);
      }
      for (const [id, mesh] of debrisMeshes) {
        if (!activeObstacles.has(id)) {
          scene.remove(mesh);
          debrisMeshes.delete(id);
        }
      }
      const hazard = t.collisionWarning
        ? fc.obstacles.find(obstacle => obstacle.id === t.collisionWarning.id)
        : null;
      const hazardDirection = hazard ? {
        x: hazard.pos.x - fc.pos.x,
        y: hazard.pos.y - fc.pos.y,
        z: hazard.pos.z - fc.pos.z,
      } : null;
      if (hazardDirection) {
        const length = Math.hypot(hazardDirection.x, hazardDirection.y, hazardDirection.z) || 1;
        hazardDirection.x /= length;
        hazardDirection.y /= length;
        hazardDirection.z /= length;
      }
      // Safety cue remains visible when the optional Flight Assist overlay is disabled.
      hud.marker("collision", projectDirection(hazardDirection));
      hud.update(t, a, assistOn);
      hud.marker("pro", assistOn ? projectDirection(a.prograde) : null);
      hud.marker("retro", assistOn ? projectDirection(a.retrograde) : null);
      if (renderFrame) renderFrame(dt);
      else renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controls.dispose();
      rig.dispose();
      hud.dispose();
      window.removeEventListener("keydown", key);
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      scene.clear();
    }
  };
}
export {
  createLaunchScene
};
