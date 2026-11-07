// Flight Assist data (TEAM_PROMPT §6.5). Pure functions: Role 3 / HUD code draws the result.
//
//   predictPath(fc)      → coasting trajectory points (planet-centred, metres) for the trajectory line
//   assistReadout(fc)    → arrows, warnings, burn-now marker, formula cards (§6.4 MVP)

import { v3, add, scale, len, norm, dot } from './vec.js';
import { atmosphereTop } from './atmosphere.js';

// Coast (gravity only) from the current state. Adaptive step: bigger steps when far/slow.
export function predictPath(fc, { seconds = 600, maxPoints = 240 } = {}) {
  let pos = { ...fc.pos };
  let vel = { ...fc.vel };
  const R = fc.planet.radius;
  const points = [{ ...pos }];
  const dt = seconds / maxPoints;
  const sub = 8;
  const h = dt / sub;
  for (let i = 0; i < maxPoints; i++) {
    for (let k = 0; k < sub; k++) {
      const r = len(pos);
      const acc = scale(pos, -fc.mu / (r * r * r));
      vel = add(vel, scale(acc, h));
      pos = add(pos, scale(vel, h));
    }
    points.push({ ...pos });
    if (len(pos) <= R) { points.impact = true; break; }
  }
  return points;
}

// Stopping distance for a vertical retro-burn: d = v² / (2 · (a_engine − g)). Infinity if the engine can't beat gravity.
export function stoppingDistance(verticalSpeed, engineAccel, gravity) {
  const net = engineAccel - gravity;
  if (net <= 0) return Infinity;
  return (verticalSpeed * verticalSpeed) / (2 * net);
}

export function assistReadout(fc) {
  const t = fc.telemetry;
  const up = fc.up;
  const engineAccel = fc.thrustNow() / fc.mass;
  const descending = t.verticalSpeed < 0;
  const stopDist = descending ? stoppingDistance(t.verticalSpeed, engineAccel, t.gravity) : Infinity;
  const margin = 1.25; // start the burn with 25% altitude to spare
  const burnNow = descending && t.altitude < 20000 && stopDist * margin >= t.altitude;

  const warnings = [];
  if (t.dynamicPressure > t.maxQ * 0.8) warnings.push({ id: 'maxq', level: t.dynamicPressure > t.maxQ * 0.95 ? 'red' : 'amber', text: 'MAX-Q: throttle down' });
  if (t.gLoad > 4) warnings.push({ id: 'g', level: t.gLoad > 6 ? 'red' : 'amber', text: `G-FORCE ${t.gLoad.toFixed(1)} g` });
  if (t.engineTemp > 0.8) warnings.push({ id: 'engine', level: t.engineTemp > 0.92 ? 'red' : 'amber', text: 'ENGINE HOT: reduce throttle' });
  if (t.heatFlux > t.heatLimit * 0.7) warnings.push({ id: 'heat', level: t.heatFlux > t.heatLimit ? 'red' : 'amber', text: 'HEATING: shallower entry' });
  if (t.fuelFrac < 0.1 && t.fuelFrac > 0) warnings.push({ id: 'fuel', level: 'amber', text: 'FUEL LOW' });
  if (t.fuel <= 0) warnings.push({ id: 'fuel', level: 'red', text: 'NO FUEL' });
  if (descending && t.altitude < 3000 && -t.verticalSpeed > 30) warnings.push({ id: 'landing', level: burnNow ? 'red' : 'amber', text: burnNow ? 'BURN NOW' : 'DESCENT RATE HIGH' });

  const speed = t.speed;
  return {
    thrustDir: fc.forward, // orange arrow (world, planet-centred frame)
    velocityDir: speed > 0.1 ? norm(fc.vel) : v3(), // cyan arrow
    prograde: speed > 0.1 ? norm(fc.vel) : null,
    retrograde: speed > 0.1 ? scale(norm(fc.vel), -1) : null,
    pointingVsMovingDeg: speed > 0.1 ? (Math.acos(Math.max(-1, Math.min(1, dot(fc.forward, norm(fc.vel))))) * 180) / Math.PI : 0,
    burnNow,
    stoppingDistance: stopDist,
    burnTimeLeft: t.thrust > 0 ? fc.fuel / (t.thrust / (t.isp * fc.g0)) : fc.fuel / (fc.thrustNow() / (t.isp * fc.g0) || Infinity),
    aboveAtmosphere: t.altitude > atmosphereTop(fc.planet),
    warnings,
    // Formula cards (§6.4 MVP): show the formula, the numbers, the result.
    cards: {
      liftoff: {
        formula: 'a = F/m − g',
        numbers: `a = ${(t.thrust / 1000).toFixed(0)} kN / ${(t.mass / 1000).toFixed(1)} t − ${t.gravity.toFixed(2)}`,
        result: `${(t.thrust / t.mass - t.gravity).toFixed(2)} m/s²`,
      },
      orbit: {
        formula: 'v = √(GM / r)',
        numbers: `circular speed here = ${t.circularSpeed.toFixed(0)} m/s, you: ${t.horizontalSpeed.toFixed(0)} m/s sideways`,
        result: t.horizontalSpeed >= t.circularSpeed ? 'Fast enough to orbit' : `${(t.circularSpeed - t.horizontalSpeed).toFixed(0)} m/s more sideways speed needed`,
        realNote: 'Real Earth low orbit ≈ 7.8 km/s (this world is 1/10 scale).',
      },
      stopping: {
        formula: 'd = v² / (2·(a_engine − g))',
        numbers: `d = ${(t.verticalSpeed ** 2).toFixed(0)} / (2·(${engineAccel.toFixed(1)} − ${t.gravity.toFixed(2)}))`,
        result: Number.isFinite(stopDist) ? `${stopDist.toFixed(0)} m` : 'engine too weak to stop',
      },
    },
  };
}
