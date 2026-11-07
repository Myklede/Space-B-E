// Role 2 sandbox: real physics (src/flight, src/surface) + Role 3's real graphics.
// npm run dev → /sandbox/role2.html?mode=launch|orbit|challenger|entry|columbia|landing|cabin|eva&q=high|low
import * as THREE from 'three';
import '/src/ui/theme.css';
import { assets, createMarsScene, createSpaceScene, getTerrainHeight, graphics } from '/src/graphics/index.js';
import { audio } from '/src/audio/index.js';
import { FlightController } from '/src/flight/FlightController.js';
import { createCockpitControls } from '/src/flight/cockpitControls.js';
import { assistReadout } from '/src/flight/flightAssist.js';
import { createDebrisField } from '/src/flight/debris.js';
import { pressureRatio } from '/src/flight/atmosphere.js';
import { MOCK_PLANETS, MOCK_SHIPS, STARTS, SCENARIOS } from '/src/flight/presets.js';
import { WalkController } from '/src/surface/WalkController.js';
import { createOxygen } from '/src/surface/oxygen.js';
import { createInteractables } from '/src/surface/interactables.js';
import { createShipInterior, CABIN } from '/src/surface/shipInterior.js';
import { createBodyStats } from '/src/surface/bodyStats.js';

const params = new URLSearchParams(location.search);
graphics.init({ container: document.getElementById('stage'), quality: params.get('q') || 'high' });
await assets.preload(['planet:earth', 'planet:mars']);

// ---------- mock bus (Role 1's core/events.js replaces it) ----------
const listeners = new Map();
const eventLog = [];
const bus = {
  emit(name, payload = {}) {
    if (name !== 'eva:oxygen' && name !== 'body:stats') {
      eventLog.unshift(name === 'flight:event' ? `${name} ${payload.type}` : `${name} ${JSON.stringify(payload).slice(0, 48)}`);
      eventLog.length = Math.min(eventLog.length, 7);
    }
    (listeners.get(name) ?? []).slice().forEach((fn) => fn(payload));
  },
  on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(fn);
    return () => listeners.get(name).splice(listeners.get(name).indexOf(fn), 1);
  },
};
window.__role2 = { bus, graphics, eventLog }; // for automated checks

// ---------- UI helpers ----------
const $ = (id) => document.getElementById(id);
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '∞');
const km = (m) => (Number.isFinite(m) ? (m / 1000).toFixed(1) : '∞');
const panel = (cls, rows) => `<div class="hud-panel ${cls}">${rows.join('')}</div>`;
const row = (label, value, unit = '') => `<div class="row"><span class="hud-label">${label}</span><span class="hud-value">${value}<small>${unit}</small></span></div>`;
const bar = (v) => `<div class="hud-bar" style="--value:${Math.max(0, Math.min(1, v)).toFixed(3)}"></div>`;
const level = (v, amber, red) => (v >= red ? 'hud-alert' : v >= amber ? 'hud-caution' : 'hud-ok');

// ---------- mouse look ----------
let onMouse = null;
graphics.renderer.domElement.addEventListener('click', () => graphics.renderer.domElement.requestPointerLock?.());
addEventListener('mousemove', (e) => { if (document.pointerLockElement === graphics.renderer.domElement) onMouse?.(e.movementX, e.movementY); });

// ---------- modes ----------
const earthOrbitSpeed = Math.sqrt((MOCK_PLANETS.earth.g * MOCK_PLANETS.earth.radius ** 2) / (MOCK_PLANETS.earth.radius + 200000));
const MODES = {
  launch: () => flightMode({ planetId: 'earth', ship: MOCK_SHIPS.reliable, start: STARTS.earthPad, scenario: SCENARIOS.normal }),
  orbit: () => flightMode({ planetId: 'earth', ship: MOCK_SHIPS.reliable, start: { altitude: 200000, speed: earthOrbitSpeed } }),
  challenger: () => flightMode({ planetId: 'earth', ship: MOCK_SHIPS.coldMorning, start: STARTS.earthPad, scenario: SCENARIOS.coldMorning }),
  entry: () => flightMode({ planetId: 'mars', ship: MOCK_SHIPS.marsArrival, start: STARTS.marsEntry }),
  columbia: () => flightMode({ planetId: 'mars', ship: { ...MOCK_SHIPS.marsArrival, stats: { ...MOCK_SHIPS.marsArrival.stats, heatShieldDamaged: true } }, start: STARTS.marsEntry }),
  landing: () => flightMode({ planetId: 'mars', ship: MOCK_SHIPS.marsArrival, start: STARTS.marsLanding }),
  cabin: () => walkMode('cabin'),
  eva: () => walkMode('eva'),
};
let mode = null;
for (const name of Object.keys(MODES)) {
  const b = document.createElement('button');
  b.className = 'hud-button';
  b.textContent = name;
  b.onclick = () => setMode(name);
  $('modes').append(b);
}
function setMode(name) {
  mode?.dispose?.();
  audio.stopAll();
  graphics.setEffects({ vignette: 0, blackout: 0, shake: 0 });
  $('end').style.display = 'none';
  $('warn').innerHTML = $('prompt').innerHTML = '';
  [...$('modes').children].forEach((b) => b.classList.toggle('on', b.textContent === name));
  mode = MODES[name]();
  history.replaceState(null, '', `?mode=${name}${params.get('q') ? `&q=${params.get('q')}` : ''}`);
}
bus.on('flight:failed', (p) => {
  audio.play('alarm.master');
  $('end').innerHTML = panel('hud-alert', [
    `<div class="hud-value" style="font-size:var(--hud-text-xl)">${p.endingId.toUpperCase()}</div>`,
    `<div class="hud-label" style="margin-top:8px">${p.cause}</div>`,
    p.historyHint ? `<div class="hud-label" style="color:var(--hud-amber);margin-top:8px">Lesson from history: ${p.historyHint}</div>` : '',
    '<div class="hud-label" style="margin-top:12px">pick a mode to retry</div>',
  ]);
  $('end').style.display = 'grid';
});

// =====================================================================
// FLIGHT: Role 3 space scene + planet + cockpit, driven by FlightController
// Floating origin: the ship stays at (0,0,0); the planet sits at −pos (physics frame = world frame).
// Below 6 km on Mars the view switches to Role 3's detailed Mars surface scene.
// =====================================================================
function flightMode({ planetId, ship, start, scenario }) {
  const planetData = MOCK_PLANETS[planetId];
  const fc = new FlightController({ bus, planets: MOCK_PLANETS, planetId, shipSpec: ship, start, scenario });
  const body = createBodyStats({ bus });
  let assistOn = true, chase = false, warp = 1;
  const controls = createCockpitControls({ onToggleAssist: () => (assistOn = !assistOn), isLanded: () => fc.landed, onStandUp: () => setMode('cabin') });
  const look = { yaw: 0, pitch: 0 };
  onMouse = (dx, dy) => { look.yaw -= dx * 0.002; look.pitch = Math.max(-1.2, Math.min(1.2, look.pitch - dy * 0.002)); };
  const onKey = (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyC') chase = !chase;
    if (e.code === 'Period') warp = Math.min(100, warp * 10);
    if (e.code === 'Comma') warp = Math.max(1, warp / 10);
    if (e.code === 'KeyB') fc.setObstacles(createDebrisField({ fc, seed: Math.floor(Math.random() * 1e6) }));
  };
  addEventListener('keydown', onKey);
  const offs = [
    bus.on('flight:event', (p) => {
      if (p.type === 'debris_hit') audio.play('impact.small');
      if (['maxq_warning', 'g_high', 'heat_warning', 'engine_hot'].includes(p.type)) audio.play('alarm.master');
      if (p.type === 'parachute' || p.type === 'fairing_sep') audio.play('impact.small');
    }),
  ];

  // --- space view ---
  const space = createSpaceScene();
  graphics.setSunDirection(new THREE.Vector3(0.7, 0.45, 0.55));
  const sunLight = new THREE.DirectionalLight(0xfff4e6, 3);
  sunLight.position.set(0.7, 0.45, 0.55);
  space.add(sunLight, new THREE.AmbientLight(0x8ea4c8, 0.25));
  const planet = assets.get(`planet:${planetId}`);
  planet.scale.setScalar(planetData.radius);
  space.add(planet);

  // ship rig: orientation = ship attitude; ship nose = local +Y, Role 3 cockpit forward = −Z → turn by +90° about X
  const toCockpit = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const rig = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(65, 1, 0.05, 1e10);
  const cockpit = assets.get('cockpit');
  const plasma = assets.get('vfx:entryPlasma');
  cockpit.add(plasma);
  rig.add(cockpit, camera);
  space.add(rig);

  // rocket for the chase camera (Role 3 parts stacked on the axis; local +Y = nose, same as physics)
  const rocket = new THREE.Group();
  let y = 0;
  for (const id of ['engine_m', 'tank_l', 'tank_l', 'capsule_m']) {
    const part = assets.get(`rocketPart:${id}`);
    part.position.y = y;
    y += part.userData.height ?? 3;
    rocket.add(part);
  }
  const flame = assets.get('vfx:engineFlame');
  const exhaust = assets.get('vfx:exhaust');
  flame.rotation.x = exhaust.rotation.x = 0; // Role 3 flames point down (−Y) from the nozzle
  rocket.add(flame, exhaust);
  rocket.position.y = -(y - 1); // put the capsule at the eye
  const rocketRoot = new THREE.Group();
  rocketRoot.add(rocket);
  space.add(rocketRoot);

  // --- Mars low-altitude view (detailed terrain) ---
  let surface = null, surfaceCam = null, landerOnSurface = null, dust = null, site = null;
  const makeSurface = () => {
    const { scene } = createMarsScene({ sunElevation: 26 });
    surfaceCam = new THREE.PerspectiveCamera(65, 1, 0.05, 2e5);
    landerOnSurface = assets.get('lander');
    dust = assets.get('vfx:landingDust');
    const r2 = new THREE.Group();
    const cp = assets.get('cockpit');
    r2.add(cp, surfaceCam);
    scene.add(landerOnSurface, dust, r2);
    // tangent frame at the point under the ship when the view starts
    const up = new THREE.Vector3(fc.up.x, fc.up.y, fc.up.z);
    const east = new THREE.Vector3(fc.vel.x, fc.vel.y, fc.vel.z).projectOnPlane(up).normalize();
    if (east.lengthSq() < 0.5) east.set(1, 0, 0).projectOnPlane(up).normalize();
    const north = new THREE.Vector3().crossVectors(east, up);
    site = { origin: up.clone().multiplyScalar(planetData.radius), up, east, north, rig: r2 };
    surface = scene;
  };

  const shipQ = new THREE.Quaternion();
  const lookQ = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  let view = null;
  const setView = (v) => { if (view !== v) { view = v; graphics.setView(v === 'surface' ? surface : space, v === 'surface' ? surfaceCam : camera); } };

  $('help').textContent = 'click = mouse look · W/S pitch · A/D yaw · Q/E throttle · X cut-off · hold SPACE brake · F assist · C chase · , . warp · B debris';
  let engineSound = false;

  return {
    update(dt) {
      fc.update(dt, controls.input, { timeWarp: warp });
      controls.endFrame();
      const t = fc.telemetry;
      const a = assistReadout(fc);
      const air = pressureRatio(planetData, t.altitude);
      body.update(dt, { env: planetId === 'earth' ? (t.altitude > 100000 ? 'earth_orbit' : 'earth') : 'mars_orbit', gLoad: t.gLoad });

      shipQ.set(fc.orient.x, fc.orient.y, fc.orient.z, fc.orient.w);
      euler.set(look.pitch, look.yaw, 0);
      lookQ.setFromEuler(euler);

      const lowMars = planetId === 'mars' && t.altitude < 6000;
      if (lowMars && !surface) makeSurface();
      if (lowMars) {
        // local position on Role 3's terrain: east = +X, north = −Z, height = altitude + terrain under you
        const p = new THREE.Vector3(fc.pos.x, fc.pos.y, fc.pos.z);
        const d = p.clone().sub(site.origin);
        const x = d.dot(site.east), z = -d.dot(site.north);
        const ground = getTerrainHeight(x, z);
        site.rig.position.set(x, t.altitude + ground + 1.6, z);
        // ship attitude in the local frame: physics basis (east, up, north) → three basis (+X, +Y, −Z)
        const basis = new THREE.Matrix4().makeBasis(site.east, site.up, site.north.clone().negate()).invert();
        const localQ = new THREE.Quaternion().setFromRotationMatrix(basis).multiply(shipQ);
        site.rig.quaternion.copy(localQ).multiply(toCockpit);
        surfaceCam.quaternion.copy(lookQ);
        landerOnSurface.visible = false;
        dust.position.set(x, ground, z);
        dust.userData.set({ intensity: t.thrust > 0 ? Math.max(0, 1 - t.altitude / 40) : 0 });
        setView('surface');
      } else {
        planet.position.set(-fc.pos.x, -fc.pos.y, -fc.pos.z);
        rig.quaternion.copy(shipQ).multiply(toCockpit);
        rocketRoot.quaternion.copy(shipQ);
        rocketRoot.visible = chase;
        cockpit.visible = !chase;
        if (chase) {
          // chase camera: behind and above the rocket, in world space
          rig.quaternion.identity();
          const back = new THREE.Vector3(fc.forward.x, fc.forward.y, fc.forward.z).multiplyScalar(-45);
          const up = new THREE.Vector3(fc.up.x, fc.up.y, fc.up.z);
          camera.position.copy(back).addScaledVector(up, 12);
          camera.up.copy(up);
          camera.lookAt(0, 0, 0);
        } else {
          camera.position.set(0, 0, 0);
          camera.up.set(0, 1, 0);
          camera.quaternion.copy(lookQ);
        }
        setView('space');
      }

      // VFX + effects + audio
      const heatFrac = t.heatLimit ? t.heatFlux / t.heatLimit : 0;
      plasma.userData.set({ intensity: Math.min(1, heatFrac * 1.4) });
      flame.userData.set({ throttle: t.thrust > 0 ? fc.throttle : 0, airDensity: air });
      exhaust.userData.set({ throttle: t.thrust > 0 ? fc.throttle : 0, airDensity: air });
      graphics.setEffects({
        vignette: Math.max(0, Math.min(1, (t.gLoad - 3.5) / 3)),
        shake: Math.min(1, (t.thrust > 0 ? 0.15 + 0.35 * fc.throttle * (0.3 + air) : 0) + t.dynamicPressure / t.maxQ * 0.5 + heatFrac * 0.4),
      });
      audio.setAir(air);
      const burning = t.thrust > 0;
      if (burning !== engineSound) { engineSound = burning; burning ? audio.play('engine.rumble', { loop: true }) : audio.stop('engine.rumble'); }

      // HUD
      if (t.collisionWarning) a.warnings.unshift({ level: 'red', text: `COLLISION IN ${fmt(t.collisionWarning.timeToClosest)} s: BURN SIDEWAYS` });
      if (fc.landed) a.warnings.push({ level: 'amber', text: 'LANDED: press E to stand up' });
      $('warn').innerHTML = a.warnings.map((w) => `<div class="hud-panel ${w.level === 'red' ? 'hud-alert' : 'hud-caution'}"><span class="hud-value">${w.text}</span></div>`).join('');
      const card = t.phase === 'orbit' || t.phase === 'coast' ? a.cards.orbit : ['entry', 'landing'].includes(t.phase) ? a.cards.stopping : a.cards.liftoff;
      $('left').innerHTML =
        panel('hud-ok', [
          row(`${planetId.toUpperCase()} · ${t.phase}`, `T+${fmt(fc.liftoffT === null ? 0 : fc.t - fc.liftoffT)}`, ' s'),
          row('Altitude', km(t.altitude), ' km'), row('Speed', fmt(t.speed), ' m/s'),
          row('Vertical / horizontal', `${fmt(t.verticalSpeed)} / ${fmt(t.horizontalSpeed)}`, ' m/s'),
          row('Apoapsis / periapsis', `${km(t.apoapsis)} / ${km(t.periapsis)}`, ' km'),
          row('Gravity', fmt(t.gravity, 2), ' m/s²'), warp > 1 ? row('Time warp', `×${warp}`) : '',
        ]) +
        (assistOn ? panel('hud-ok', [`<div class="formula"><b>${card.formula}</b><br>${card.numbers}<br>→ ${card.result}${card.realNote ? `<br>${card.realNote}` : ''}</div>`]) : '');
      $('right').innerHTML =
        panel('hud-ok', [row('Throttle', fmt(fc.throttle * 100), ' %'), bar(fc.throttle), row('TWR / Isp', `${fmt(t.twr, 2)} / ${fmt(t.isp)}`, ' s')]) +
        panel(level(1 - t.fuelFrac, 0.8, 0.95), [row('Fuel', fmt(t.fuelFrac * 100), ' %'), bar(t.fuelFrac), row('Δv left', fmt(t.deltaVLeft), ' m/s')]) +
        panel(level(t.dynamicPressure / t.maxQ, 0.8, 0.95), [row('Max-Q', `${fmt(t.dynamicPressure / 1000, 1)} / ${t.maxQ / 1000}`, ' kPa'), bar(t.dynamicPressure / t.maxQ)]) +
        panel(level(t.gLoad, 4, 6), [row('G-force', fmt(t.gLoad, 1), ' g'), bar(t.gLoad / 8)]) +
        panel(level(heatFrac, 0.7, 1), [row('Heat', `${fmt(t.heatFlux / 1000, 1)} / ${fmt(t.heatLimit / 1000)}`, ' kW/m²'), bar(heatFrac), row('Chute / armor', `${fc.chuteOpen ? 'OPEN' : '—'} / ${t.armorLeft}`)]) +
        panel('hud-ok', [row('Radiation', fmt(body.doseMSv, 3), ' mSv')]);
      $('prompt').innerHTML = '';
      $('events').textContent = eventLog.join('\n');
      graphics.render(dt);
    },
    dispose() {
      controls.dispose();
      removeEventListener('keydown', onKey);
      offs.forEach((off) => off());
      onMouse = null;
    },
  };
}

// =====================================================================
// WALKING: Role 3 cabin / Mars surface + WalkController, oxygen, interactables
// =====================================================================
const shared = { oxygen: createOxygen({ bus, tankSeconds: 300, spareTanks: MOCK_SHIPS.reliable.stats.spareO2Tanks }), suited: false };
const body = createBodyStats({ bus });

function walkMode(kind) {
  const inCabin = kind === 'cabin';
  const o2 = shared.oxygen;
  const ia = createInteractables();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.03, 2e5);
  let scene, walker, cabin = null;
  const offs = [];

  if (inCabin) {
    scene = new THREE.Scene();
    const art = assets.get('cabin');
    scene.add(art);
    cabin = createShipInterior({ bus, interactables: ia, oxygen: o2, stations: art.userData.stations, props: art.userData.props });
    cabin.suited = shared.suited;
    walker = new WalkController({ bus, gravity: MOCK_PLANETS.mars.g, bounds: CABIN.bounds, mode: 'cabin', start: CABIN.spawn, yaw: CABIN.spawnYaw });
    offs.push(bus.on('interior:suit', (p) => { shared.suited = p.suited; }));
    offs.push(bus.on('interior:airlock', (p) => art.userData.setAlarm?.(p.stage === 'cycling')));
    audio.play('ambience.ship', { loop: true });
  } else {
    ({ scene } = createMarsScene({ sunElevation: 26 }));
    const lander = assets.get('lander');
    const g0 = getTerrainHeight(0, 0);
    lander.position.set(0, g0, 0);
    scene.add(lander);
    ia.register({ id: 'hatch', position: { x: 0, y: g0 + 1.5, z: 3.6 }, radius: 3, minFacing: 0.3, prompt: 'E: enter the airlock', onUse: () => bus.emit('state:request', { to: 'INTERIOR', reason: 'hatch' }) });
    // a sample like Role 4 will place (demo of registerInteractable)
    const sx = 16, sz = -18, sy = getTerrainHeight(sx, sz);
    const rock = assets.get('sampleRock');
    rock.position.set(sx, sy, sz);
    scene.add(rock);
    ia.register({ id: 'sample-basalt', position: { x: sx, y: sy + 0.3, z: sz }, radius: 2.4, minFacing: 0.3, hold: 2, prompt: 'Hold E: collect basalt sample', onUse: (it) => { scene.remove(rock); ia.unregister(it.id); bus.emit('task:completed', { taskId: 'sample-basalt', category: 'samples', reward: 150000 }); } });
    walker = new WalkController({ bus, gravity: MOCK_PLANETS.mars.g, getGroundHeight: getTerrainHeight, colliders: [{ x: 0, z: 0, r: 3.2 }], mode: 'suit', start: { x: 0, z: 9 }, yaw: 0 });
    audio.play('ambience.mars', { loop: true });
    audio.play('suit.breath', { loop: true });
  }
  graphics.setView(scene, camera);

  offs.push(bus.on('state:request', (p) => {
    if (p.to === 'SURFACE') { shared.suited = true; setTimeout(() => setMode('eva')); }
    if (p.to === 'INTERIOR') { shared.suited = true; setTimeout(() => setMode('cabin')); }
    if (p.to === 'LANDING') setTimeout(() => setMode('landing'));
  }));

  const keys = new Set();
  let eHeld = false;
  const kd = (e) => {
    if (e.code === 'Space') e.preventDefault();
    keys.add(e.code);
    if (e.code === 'KeyE' && !e.repeat) { ia.press(); eHeld = true; }
  };
  const ku = (e) => { keys.delete(e.code); if (e.code === 'KeyE') eHeld = false; };
  addEventListener('keydown', kd);
  addEventListener('keyup', ku);
  onMouse = (dx, dy) => walker.look(dx, dy);
  $('help').textContent = 'click = mouse look · WASD walk · SHIFT run · SPACE jump · E use / hold E';
  $('left').innerHTML = $('right').innerHTML = '';

  return {
    update(dt) {
      walker.update(dt, {
        forward: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
        right: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0),
        run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        jump: keys.has('Space'),
      });
      cabin?.update(dt);
      o2.update(dt, { inside: inCabin, running: walker.running, suited: inCabin ? cabin.suited : true });
      body.update(dt, { env: inCabin ? 'cabin_mars' : 'mars', heartRate: walker.heartRate });
      const ui = ia.update(dt, walker.eye, walker.lookDir, eHeld);
      const eye = walker.eye;
      camera.position.set(eye.x, eye.y, eye.z);
      camera.quaternion.setFromEuler(new THREE.Euler(walker.pitch, walker.yaw, 0, 'YXZ'));

      const w = walker.telemetry;
      const lvl = o2.level;
      const o2cls = { ok: 'hud-good', caution: 'hud-caution', warning: 'hud-alert', critical: 'hud-alert' }[lvl];
      $('left').innerHTML = panel('hud-ok', [
        row(inCabin ? 'Ship cabin' : 'Mars · Jezero', inCabin ? (cabin.suited ? 'suit on' : 'suit off') : 'EVA'),
        row('Gravity', `${fmt(w.gravity, 2)} m/s² · ${fmt(w.gEarth, 2)}`, ' g'),
        row('Heart rate', w.heartRate, ' bpm'),
        inCabin ? '' : row('Ship', fmt(Math.hypot(w.pos.x, w.pos.z)), ' m'),
        inCabin ? '' : '<div class="hud-label">No compass on Mars: follow the ship beacon</div>',
      ]);
      $('right').innerHTML =
        panel(o2cls, [row('Suit O₂', fmt(o2.percent), ' %'), bar(o2.percent / 100), row('Spare tanks', o2.spareTanks), inCabin ? '<div class="hud-label">No drain inside the cabin</div>' : '']) +
        panel('hud-ok', [row('Radiation', fmt(body.doseMSv, 3), ' mSv'), row('Rate', fmt(body.rateMSvPerDay, 2), ' mSv/day')]) +
        (cabin?.airlockProgress ? panel('hud-caution', [row('Airlock', fmt(cabin.airlockProgress * 100), ' %'), bar(cabin.airlockProgress)]) : '');
      $('warn').innerHTML = inCabin || lvl === 'ok' ? '' : `<div class="hud-panel ${lvl === 'caution' ? 'hud-caution' : 'hud-alert'}"><span class="hud-value">${lvl === 'caution' ? 'LOW OXYGEN' : lvl === 'warning' ? 'OXYGEN 15%: RETURN TO SHIP' : 'OXYGEN CRITICAL'}</span></div>`;
      graphics.setEffects({ vignette: lvl === 'critical' ? 0.8 : lvl === 'warning' ? 0.4 : 0 });
      $('prompt').innerHTML = ui.focused ? `<span class="hud-value" style="font-size:var(--hud-text-md)">${ui.focused.prompt}</span>${ui.focused.holdProgress !== null ? bar(ui.focused.holdProgress) : ''}` : '';
      $('events').textContent = eventLog.join('\n');
      graphics.render(dt);
    },
    dispose() {
      removeEventListener('keydown', kd);
      removeEventListener('keyup', ku);
      offs.forEach((off) => off());
      cabin?.dispose();
      ia.clear();
      onMouse = null;
    },
  };
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  try { mode?.update(dt); } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
setMode(params.get('mode') in MODES ? params.get('mode') : 'launch');
requestAnimationFrame(frame);
