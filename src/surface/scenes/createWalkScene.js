import * as THREE from 'three';
import { WalkController } from '../WalkController.js';
import { createOxygen } from '../oxygen.js';
import { createInteractables } from '../interactables.js';
import { createShipInterior, CABIN } from '../shipInterior.js';
import { createWalkCamera } from './createWalkCamera.js';
import { createSuitHUD } from '../hud/createSuitHUD.js';

// Simple fallback surface. Role 3 supplies the actual model and matching height API.
export function fallbackGroundHeight(x, z) {
  return 0.35 * Math.sin(x * 0.06) * Math.cos(z * 0.05);
}

export function createWalkScene({
  renderer,
  bus,
  planets,
  kind = 'cabin',
  parent = document.body,
  oxygen = createOxygen({ bus }),
  session = { suited: false },
  getModel: externalModel,
  getTerrainHeight = fallbackGroundHeight,
  shipPosition = { x: 0, z: 0 },
  start,
  reducedMotion = false,
  onFootstep,
  onOxygenLevel,
  bodyStats,
  scene: suppliedScene,
  renderFrame,
} = {}) {
  if (!['cabin', 'eva'].includes(kind)) throw new Error('Walk scene kind must be cabin or eva');
  const inside = kind === 'cabin';
  if (!inside) session.suited = true;
  const scene = suppliedScene ?? new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 3000);
  const interactables = createInteractables();
  const geometries = new Set();
  const materials = new Set();
  const instancedMeshes = new Set();
  const owned = object => {
    object.traverse(child => {
      if (child.geometry) geometries.add(child.geometry);
      if (child.isInstancedMesh) instancedMeshes.add(child);
      for (const material of [].concat(child.material ?? [])) materials.add(material);
    });
    return object;
  };
  const box = (width, height, depth, color, position) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.3 }),
    );
    mesh.position.set(position.x, position.y, position.z);
    return mesh;
  };
  const label = (text, position) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    context.fillStyle = '#0a2029';
    context.fillRect(0, 0, 512, 96);
    context.fillStyle = '#a7f0e5';
    context.font = '28px monospace';
    context.textAlign = 'center';
    context.fillText(text.toUpperCase(), 256, 59);
    const texture = new THREE.CanvasTexture(canvas);
    textures.add(texture);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true }));
    sprite.position.set(position.x, position.y + 0.46, position.z);
    sprite.scale.set(0.75, 0.14, 1);
    return sprite;
  };
  const textures = new Set();

  function getModel(name) {
    const supplied = externalModel?.(name);
    if (supplied) return supplied;
    const group = new THREE.Group();
    if (name === 'cabin') {
      const bounds = CABIN.bounds;
      const room = new THREE.Mesh(
        new THREE.BoxGeometry(bounds.maxX - bounds.minX, bounds.ceiling, bounds.maxZ - bounds.minZ),
        new THREE.MeshStandardMaterial({ color: 0x34464e, roughness: 0.8, side: THREE.BackSide }),
      );
      room.position.y = bounds.ceiling / 2;
      group.add(room);
      const floor = box(3.95, 0.04, 7.95, 0x14252b, { x: 0, y: -0.02, z: 0 });
      group.add(floor);
      for (let z = -3; z <= 3; z += 1.5) {
        const light = box(0.08, 0.015, 1.1, 0x8bdddf, { x: 0, y: 2.27, z });
        light.material.emissive.set(0x82d8df);
        light.material.emissiveIntensity = 2;
        group.add(light);
      }
      for (const [id, p] of Object.entries(CABIN.stations)) {
        const width = id === 'airlock' ? 1.25 : 0.42;
        const panel = box(width, id === 'airlock' ? 1.9 : 0.65, 0.22, id === 'airlock' ? 0x604c38 : 0x526f78, p);
        if (Math.abs(p.x) > 1) panel.rotation.y = Math.PI / 2;
        group.add(panel, label(id === 'o2' ? 'O2 supply' : id, p));
      }
      for (const [id, p] of Object.entries(CABIN.props)) {
        group.add(box(0.25, 0.25, 0.18, 0x897761, p), label(id, p));
      }
    } else if (name === 'marsTerrain') {
      const geometry = new THREE.PlaneGeometry(800, 800, 160, 160);
      geometry.rotateX(-Math.PI / 2);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        positions.setY(i, getTerrainHeight(positions.getX(i), positions.getZ(i)));
      }
      geometry.computeVertexNormals();
      group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xa4613d, roughness: 1 })));
      const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
      const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x674937, roughness: 1 });
      const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, 200);
      const transform = new THREE.Object3D();
      for (let i = 0; i < 200; i++) {
        const angle = i * 2.39996323;
        const radius = 14 + Math.sqrt(i) * 13;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        transform.position.set(x, getTerrainHeight(x, z), z);
        transform.rotation.set(i * 0.3, angle, i * 0.7);
        transform.scale.setScalar(0.2 + (i % 9) * 0.1);
        transform.updateMatrix();
        rocks.setMatrixAt(i, transform.matrix);
      }
      group.add(rocks);
    } else if (name === 'lander') {
      const hull = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 2.5, 7, 24),
        new THREE.MeshStandardMaterial({ color: 0xd8d1bc, metalness: 0.6, roughness: 0.4 }),
      );
      hull.position.y = 4.5;
      group.add(hull);
      for (const sign of [-1, 1]) {
        group.add(box(0.16, 2, 3.4, 0x61747b, { x: sign * 2.4, y: 0.9, z: 0 }));
      }
      group.add(box(1, 1.9, 0.15, 0x1d3b45, { x: 0, y: 1.2, z: 2.55 }));
      group.add(label('Airlock', { x: 0, y: 1.5, z: 2.7 }));
    }
    return owned(group);
  }

  if (!suppliedScene) {
    scene.background = new THREE.Color(inside ? 0x071218 : 0xc39770);
    if (!inside) scene.fog = new THREE.FogExp2(0xc39770, 0.003);
  }
  if (inside || !suppliedScene) scene.add(new THREE.HemisphereLight(inside ? 0xb8e3e9 : 0xffe1bd, 0x35221c, inside ? 1.6 : 1.2));
  const light = new THREE.DirectionalLight(0xffddac, inside ? 0.5 : 2.5);
  light.position.set(-80, 35, -45);
  if (inside || !suppliedScene) scene.add(light);
  let cabin;
  let cabinModel;
  if (inside) {
    cabinModel = getModel('cabin');
    scene.add(cabinModel);
    const lamp = new THREE.PointLight(0xaee7ee, 7, 12);
    lamp.position.set(0, 2, 0);
    scene.add(lamp);
    cabin = createShipInterior({
      bus, interactables, oxygen,
      canExit: () => !oxygen.depleted,
      stations: cabinModel.userData.stations,
      props: cabinModel.userData.props,
    });
    cabin.suited = session.suited;
  } else {
    if (!suppliedScene) scene.add(getModel('marsTerrain'));
    const lander = getModel('lander');
    lander.position.set(shipPosition.x, getTerrainHeight(shipPosition.x, shipPosition.z), shipPosition.z);
    scene.add(lander);
    interactables.register({
      id: 'ship-hatch',
      position: {
        x: shipPosition.x,
        y: getTerrainHeight(shipPosition.x, shipPosition.z + 2.7) + 1.3,
        z: shipPosition.z + 2.7,
      },
      radius: 2.2,
      prompt: 'E: enter ship airlock',
      onUse: () => bus.emit('state:request', { to: 'INTERIOR', reason: 'hatch' }),
    });
  }
  const walker = new WalkController({
    bus,
    gravity: planets.mars.g,
    mode: inside ? 'cabin' : 'suit',
    bounds: inside ? CABIN.bounds : null,
    getGroundHeight: inside ? () => 0 : getTerrainHeight,
    start: start ?? (inside ? CABIN.spawn : { x: shipPosition.x, z: shipPosition.z + 6 }),
    yaw: inside ? CABIN.spawnYaw ?? 0 : 0,
    colliders: inside ? [] : [{ x: shipPosition.x, z: shipPosition.z, r: 2.5 }],
  });
  const rig = createWalkCamera({ camera, element: renderer.domElement, walker, reducedMotion, onFootstep });
  const hud = createSuitHUD({ parent, reducedMotion });
  const keys = new Set();
  let jump = false;
  let disposed = false;
  let previousLevel;
  const editable = target => target?.closest?.('input,textarea,select,[contenteditable=true]');
  const keydown = event => {
    if (oxygen.depleted || editable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Space') event.preventDefault();
    keys.add(event.code);
    if (!event.repeat && event.code === 'Space') jump = true;
    if (!event.repeat && event.code === 'KeyE') interactables.press();
  };
  const keyup = event => keys.delete(event.code);
  const clearKeys = () => { keys.clear(); jump = false; };
  const lockChanged = () => { if (document.pointerLockElement !== renderer.domElement) clearKeys(); };
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', clearKeys);
  document.addEventListener('visibilitychange', clearKeys);
  document.addEventListener('pointerlockchange', lockChanged);

  return {
    scene,
    camera,
    walker,
    oxygen,
    interactables,
    cabin,
    cabinModel,
    bodyStats,
    update(dt) {
      if (disposed) return;
      dt = Math.max(0, Math.min(0.05, dt));
      let ui = { focused: null };
      if (!oxygen.depleted) {
        walker.update(dt, {
          forward: Number(keys.has('KeyW')) - Number(keys.has('KeyS')),
          right: Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
          run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
          jump,
        });
        cabin?.update(dt);
        ui = interactables.update(dt, walker.eye, walker.lookDir, keys.has('KeyE'));
        session.suited = cabin ? cabin.suited : true;
        oxygen.update(dt, { inside, running: walker.running, suited: session.suited });
        bodyStats?.update(dt, {
          env: inside ? 'cabin_mars' : 'mars',
          gLoad: walker.telemetry.gEarth,
          heartRate: walker.heartRate,
        });
      }
      jump = false;
      const level = inside ? 'ok' : oxygen.level;
      if (level !== previousLevel) {
        previousLevel = level;
        onOxygenLevel?.({ level, inside, percent: oxygen.percent });
      }
      rig.update(dt);
      const canvas = renderer.domElement;
      const aspect = (canvas.clientWidth || canvas.width) / (canvas.clientHeight || canvas.height);
      if (camera.aspect !== aspect) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      }
      hud.update(dt, {
        telemetry: walker.telemetry,
        oxygen,
        suited: session.suited,
        inside,
        focused: ui.focused,
        yaw: walker.yaw,
        shipPosition,
        airlockProgress: cabin?.airlockProgress ?? 0,
        bodyStats,
      });
      if (renderFrame) renderFrame(dt);
      else renderer.render(scene, camera);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (cabin) session.suited = cabin.suited;
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', clearKeys);
      document.removeEventListener('pointerlockchange', lockChanged);
      cabin?.dispose();
      interactables.clear();
      rig.dispose();
      hud.dispose();
      for (const mesh of instancedMeshes) mesh.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      scene.clear();
    },
  };
}
