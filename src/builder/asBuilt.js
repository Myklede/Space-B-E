// As built and as flown (Role 1 agent "luck" owns this file). Pure: no browser or core imports, no Math.random.
//
// The idea (src/builder/CLAUDE.md §6, "FIFA-style luck"): the design page shows the ship's numbers as rated. The
// factory delivers something a little different. Every engine and tank comes out with its own Isp, thrust and
// propellant load: good parts (dearer, or more reliable than the standard version) stay within about ±0.5 % of the
// rating, cheap ones wander up to ±3 % (the lead's calibration: a cheap ship 2 % short makes it about one time in eight).
// Rarely a part is bad: a part's reliability covers every way it can fail over the whole mission, and the factory's share
// of that is LUCK.factoryShare, so a unit is built bad with a chance of 0.6 × (1 − reliability), raised by wear on a
// reflown ship. Launch day adds the pad (debris, the hold-down clamps), the outer skin (max-Q, heating) and the real
// temperature instead of the forecast. The player is never told the odds; the investigation board explains afterwards.
//
// Every roll comes from a seeded hash of the part (instance id, type, material, options, engine, replacement count) and
// the build serial in the builder save, so the same build gives the same ship: TEST FIRE (stage 'stand') reveals the
// factory defects that will fly, replacing a part rolls it again, and the Node tests can count the odds.
//
// Real references (notes-luck.md has the list): Shuttle main engines stopped on the pad by the computer after ignition
// five times (1984–1994); Apollo 13's S-II and Falcon 9 CRS-1 lost an engine and flew on (engine-out); Artemis I's
// hydrogen leaks during fuelling (2022); Columbia (2003, foam struck the wing on the climb); Challenger (1986, 2 °C,
// O-rings); Falcon 9 first stages reflown 20+ times.
import { COLD_TEMP_C, partFigures } from './stats.js';
import { HULL_SECTIONS, hullMaterial } from './hull.js';

/** Every tunable of the luck model (game numbers; notes-luck.md says where each comes from). */
export const LUCK = Object.freeze({
  spreadMin: 0.005, // ± share of the rating for the best parts (Isp, thrust, propellant load)
  spreadMax: 0.03, // ± share for the cheapest, least reliable parts (the standard part, quality 0.5: ±1.75 %)
  massSpread: 0.5, // structure and engine mass vary by this share of the part's spread
  weak: [0.05, 0.15], // a weak engine loses this share of its thrust
  weakIsp: 0.2, // … and this share of that loss in Isp (poor combustion: 1–3 %)
  factoryShare: 0.6, // share of a part's failure chance (1 − reliability) that is built in at the factory
  noLightShare: 0.1, // of the engine defects: the engine will not come up to thrust at ignition (seen on the pad)
  inFlightOutShare: 0.3, // … the engine runs on the pad, then shuts down in flight (Apollo 13, CRS-1); the rest run weak
  engineOutCommit: 0.1, // an engine-out cluster may lift off with one engine up to 10 % weak: the others cover it
  leak: [0.01, 0.05], // a slow leak loses this share of one tank's propellant before it is needed
  debris: [0.05, 0.2], // an engine hit by pad debris loses this share of its thrust
  buckleDrag: 1.25, // a skin panel wrinkled at max-Q: the ascent drag area grows by this factor
  lightningHit: 0.9, // a lightning strike on the climb (Apollo 12, 1969): the electronics took it, reliability × 0.9
  wearDefect: 4, // a defect is (1 + 4 · wear) times as likely on a worn part…
  wearFloor: 0.1, // … plus 0.1 · wear on its own (a 30 %-worn skin cracks 3 % of the time even if it was perfect)
  wearPerFlight: Object.freeze({ engine: 0.05, tank: 0.02, booster: 0.02, other: 0, hull: 0.03 }),
  staticFire: Object.freeze({ base: 80000, perEngine: 10000 }), // a test day on the stand: crew, propellant, range
  refurb: Object.freeze({ base: 0.25, step: 0.05, max: 0.9 }), // share of the ship's price to refly it
});

// ---------- seeded randomness ----------
/** 32-bit hash of a string (cyrb53's mixing, folded to 32 bits). */
export function hash32(text) {
  let h1 = 0xdeadbeef ^ 0, h2 = 0x41c6ce57 ^ 0;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}
/** A deterministic stream of numbers in [0, 1) (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const streamOf = (...keys) => rng(hash32(keys.join('|')));
const between = (r, [lo, hi]) => lo + (hi - lo) * r();
const sym = (r) => 2 * r() - 1; // uniform in [−1, 1]
const clamp01 = (x) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
const stable = (o) => (o && typeof o === 'object' ? JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]])) : '');
const engineKey = (e) => (e ? `${e.fuel}/${e.nozzle}/${e.pump}` : '');

/** What makes a part instance this part: rolling again needs one of these to change. */
export function partKey(entry, units = {}) {
  return [entry.id, entry.type, entry.material ?? '', stable(entry.options), engineKey(entry.engine), `u${units?.[entry.id] ?? 0}`].join('|');
}

// ---------- quality and odds ----------
/**
 * How good a part is, 0..1, against the standard version of the same part: 0.5 is the standard build. Reliability
 * (failure rate halved = +0.25) and price (30 % dearer = +0.25) each count half.
 */
export function partQuality({ reliability = 1, baseReliability = null, costRatio = 1 } = {}) {
  const f = Math.max(1e-4, 1 - reliability);
  const f0 = Math.max(1e-4, 1 - (baseReliability ?? reliability));
  const relScore = clamp01(0.5 - 0.5 * Math.log2(f / f0));
  const costScore = clamp01(0.5 + (costRatio - 1) / 0.6);
  return (relScore + costScore) / 2;
}
/** ± share by which this quality of part differs from its rating. */
export const spreadFor = (quality) => LUCK.spreadMax - (LUCK.spreadMax - LUCK.spreadMin) * clamp01(quality);
/** Chance that one unit comes out of the factory bad: the factory's share of (1 − reliability), raised by wear. */
export const defectChance = (reliability, wear = 0) => Math.min(0.95, LUCK.factoryShare * Math.max(0, 1 - reliability) * (1 + LUCK.wearDefect * wear) + LUCK.wearFloor * wear);
/** A risk from hull.js (0..1) on a skin with this much wear. */
export const wornRisk = (risk, wear = 0) => Math.min(0.95, Math.max(0, risk || 0) * (1 + LUCK.wearDefect * wear) + LUCK.wearFloor * wear);

// ---------- money ----------
/** Static fire on the stand: a test day (crew, propellant, range) plus a little per engine to inspect. */
export const staticFireFee = (breakdown) => LUCK.staticFire.base + LUCK.staticFire.perEngine * Math.max(1, breakdown?.engineCount ?? 1);
/** Price to fly a ship that came home again, after `flown` flights (1 = it has flown once). Grows with every flight. */
export function refurbFee(cost, flown) {
  const share = Math.min(LUCK.refurb.max, LUCK.refurb.base + LUCK.refurb.step * Math.max(0, flown - 1));
  return Math.round(cost * share);
}

// ---------- reuse and wear ----------
/** One hash of the design itself (parts and skin, not the name or the launch day): same hash = the same ship. */
export function designSignature(json) {
  const parts = [...(json?.parts ?? [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const text = parts.map((p) => [p.id, p.type, p.parent ?? '', p.node ?? '', p.angle ?? 0, p.yFrac ?? 0.5, p.material ?? '', stable(p.options), engineKey(p.engine)].join(',')).join(';') + '#' + stable(json?.hull);
  return hash32(text).toString(36);
}
const kindOf = (entry) => (entry?.def?.engine ? 'engine' : entry?.def?.booster ? 'booster' : entry?.def?.fuel ? 'tank' : 'other');
/**
 * Wear after one more flight. wear = { parts: { partId: 0..1 }, hull: { nose, body, tail } }: engines +5 %, tanks and
 * solid motors +2 % a flight; the skin by its material's fatiguePerFlight (hull.js), 3 % if it has none.
 */
export function wearAfterFlight(wear, { layout = [], hull = {} } = {}) {
  const parts = {};
  for (const e of layout) parts[e.id] = Math.min(1, (wear?.parts?.[e.id] ?? 0) + (LUCK.wearPerFlight[kindOf(e)] ?? 0));
  const skin = {};
  for (const s of HULL_SECTIONS) {
    const f = Number(hullMaterial(hull, s)?.fatiguePerFlight);
    skin[s] = Math.min(1, (wear?.hull?.[s] ?? 0) + (Number.isFinite(f) ? f : LUCK.wearPerFlight.hull));
  }
  return { parts, hull: skin };
}
/** Average wear of the parts that wear (engines, tanks, solids) and the skin, 0..1. */
export function meanWear(wear) {
  const xs = [...Object.values(wear?.parts ?? {}).filter((w) => w > 0), ...Object.values(wear?.hull ?? {})];
  return xs.length ? xs.reduce((t, w) => t + w, 0) / xs.length : 0;
}

// ---------- the ship as built ----------
const NUMBERS = ['deltaV', 'twrEarth', 'twrMars', 'thrust', 'thrustSL', 'ispVac', 'ispSL', 'fuelMass', 'dryMass', 'wetMass'];
const pick = (s, thrustSL) => Object.fromEntries(NUMBERS.map((k) => [k, k === 'thrustSL' ? thrustSL : s[k]]));

/**
 * buildAsFlown(result, ctx) → { spec, defects, notes, seed, designed, asBuilt, units, scrub, weather, pad, need }
 *   result: computeShipSpec's { spec, breakdown, blocks }
 *   ctx: { g0, planets, layout (assembly.layout(), or assembly), catalog, engines, materials (for the standard version
 *          of each part), serial (build serial from the save), buildSerial (the serial a reflown ship was built with),
 *          units ({ partId: replacements }), wear (see wearAfterFlight; null for a new ship), hull (assembly.hull, for
 *          the skin materials), stage ('flight' | 'stand') }
 *   spec: the ShipSpec that flies (same shape; Δv, TWR, masses, thrust, Isp, ascentCdA, heatShieldDamaged and
 *         launch.tempC changed; cost unchanged)
 *   defects: [{ kind, source: 'factory' | 'pad' | 'flight', partId, name, unit, count, pct, kg, section, caught }]
 *   scrub: null, or { reason: 'holdDown' | 'noLight' | 'noLift', partIds, defects } when the launch stops on the pad
 *   stage 'stand' (the static fire) rolls only what the factory delivered: no pad, skin, weather or scrub.
 */
export function buildAsFlown(result, ctx = {}) {
  const spec = result.spec;
  const b = result.breakdown ?? {};
  const s0 = spec.stats;
  const layout = ctx.layout ?? ctx.assembly?.layout?.() ?? [];
  const stage = ctx.stage === 'stand' ? 'stand' : 'flight';
  const serial = ctx.serial ?? 0;
  const buildSerial = ctx.buildSerial ?? serial;
  const units = ctx.units ?? {};
  const wear = ctx.wear ?? null;
  const parts = new Map((b.parts ?? []).map((p) => [p.id, p]));
  // g0 and the planets come in from the caller; a missing one is recovered from the designed numbers
  const g0 = ctx.g0 ?? (s0.ispVac > 0 && s0.dryMass > 0 && s0.wetMass > s0.dryMass ? s0.deltaV / (s0.ispVac * Math.log(s0.wetMass / s0.dryMass)) : 0);
  const thrustSL0 = b.thrustSL ?? s0.thrust * (s0.ispVac ? s0.ispSL / s0.ispVac : 1);
  const gEarth = ctx.planets?.earth?.g ?? (s0.twrEarth > 0 ? thrustSL0 / (s0.wetMass * s0.twrEarth) : 0);
  const gMars = ctx.planets?.mars?.g ?? (s0.twrMars > 0 ? s0.thrust / (s0.wetMass * s0.twrMars) : 0);
  const seed = hash32(`${serial}|${buildSerial}|${layout.map((e) => partKey(e, units)).join(';')}`);

  const quality = (e) => {
    const bp = parts.get(e.id);
    const r = bp?.reliability ?? e.def?.reliability ?? 1;
    let r0 = e.def?.reliability ?? r, cost0 = bp?.cost ?? 0;
    if (ctx.engines && e.def) {
      try {
        const std = partFigures(e.def, { engines: ctx.engines, g0: g0 || 1, materials: ctx.materials ?? null, catalog: ctx.catalog ?? null, materialId: null, options: null, engineDef: e.engine ?? null, count: e.cluster?.count ?? 1 });
        r0 = std.reliability;
        cost0 = std.cost;
      } catch { /* the standard version is only for the spread; fall back to the rating */ }
    }
    const costRatio = cost0 > 0 && bp?.cost > 0 ? bp.cost / cost0 : 1;
    return { r, q: partQuality({ reliability: r, baseReliability: r0, costRatio }) };
  };
  const wearOf = (id) => wear?.parts?.[id] ?? 0;
  const defects = [];
  const notes = [];
  const unitRows = [];

  // --- liquid engines: one unit per engine of a cluster ---
  const engineEntries = layout.filter((e) => e.def?.engine);
  const engineUnits = [];
  engineEntries.forEach((e, i) => {
    const es = b.engineSpecs?.[i];
    if (!es) return;
    const count = e.cluster?.count ?? 1;
    const { r, q } = quality(e);
    const s = spreadFor(q);
    const unitMass = (parts.get(e.id)?.dry ?? 0) / count;
    const engineOut = !!layout.find((x) => x.id === e.parentId)?.def?.flags?.engineOut;
    const vary = streamOf(buildSerial, partKey(e, units), 'vary');
    const roll = streamOf(serial, partKey(e, units), 'defect');
    const mine = [];
    for (let j = 0; j < count; j++) {
      const fT = 1 + s * sym(vary), fI = 1 + s * sym(vary), fM = 1 + s * LUCK.massSpread * sym(vary);
      const u = { partId: e.id, name: e.def.name, idx: j, count, engineOut, thrust: es.thrust * fT, ispVac: es.ispVac * fI, ispSL: es.ispSL * fI, dMass: (fM - 1) * unitMass, fT, fI, spread: s };
      if (roll() < defectChance(r, wearOf(e.id))) {
        const x = roll();
        const pct = between(roll, LUCK.weak);
        const base = { source: 'factory', partId: e.id, name: e.def.name, unit: j, count, engineOut };
        // a single engine that would die in flight is a loss the ShipSpec cannot express: it shows at ignition instead
        if (x < LUCK.noLightShare || (count === 1 && x < LUCK.noLightShare + LUCK.inFlightOutShare)) defects.push({ ...base, kind: 'noLight', pct: 1 / count });
        else if (x < LUCK.noLightShare + LUCK.inFlightOutShare) defects.push({ ...base, kind: engineOut ? 'out' : 'outPair', pct: engineOut ? 1 / count : Math.min(1, 2 / count) });
        else defects.push({ ...base, kind: 'weak', pct });
        u.defect = defects[defects.length - 1];
      }
      mine.push(u);
    }
    // apply the factory defects (an engine-out without the structure for it also shuts the opposite engine)
    for (const u of mine) {
      const d = u.defect;
      if (!d) continue;
      if (d.kind === 'weak') { u.thrust *= 1 - d.pct; u.ispVac *= 1 - d.pct * LUCK.weakIsp; u.ispSL *= 1 - d.pct * LUCK.weakIsp; }
      if (d.kind === 'noLight' || d.kind === 'out') u.thrust = 0;
      if (d.kind === 'outPair') { u.thrust = 0; const opp = mine[(u.idx + Math.floor(count / 2)) % count]; if (opp) opp.thrust = 0; }
    }
    engineUnits.push(...mine);
    unitRows.push({ partId: e.id, name: e.def.name, kind: 'engine', count, spread: s, thrustPct: avg(mine, (u) => u.fT - 1), ispPct: avg(mine, (u) => u.fI - 1) });
  });

  // --- solid motors: thrust, Isp and the cast propellant vary; a void in the grain makes one weak ---
  const boosterEntries = layout.filter((e) => e.def?.booster);
  const boosterUnits = [];
  boosterEntries.forEach((e) => {
    const bs = (b.boosterSpecs ?? []).find((x) => x.id === e.id);
    if (!bs) return;
    const { r, q } = quality(e);
    const s = spreadFor(q);
    const vary = streamOf(buildSerial, partKey(e, units), 'vary');
    const roll = streamOf(serial, partKey(e, units), 'defect');
    const fT = 1 + s * sym(vary), fI = 1 + s * sym(vary), fP = 1 + s * sym(vary), fM = 1 + s * LUCK.massSpread * sym(vary);
    const u = { partId: e.id, name: e.def.name, thrust: bs.thrust * fT, ispVac: bs.ispVac * fI, ispSL: bs.ispSL * fI, dFuel: (fP - 1) * bs.propellant, dMass: (fM - 1) * (parts.get(e.id)?.dry ?? 0) };
    if (roll() < defectChance(r, wearOf(e.id))) {
      const pct = between(roll, LUCK.weak);
      defects.push({ kind: 'grain', source: 'factory', partId: e.id, name: e.def.name, unit: 0, count: 1, pct });
      u.thrust *= 1 - pct; u.ispVac *= 1 - pct * LUCK.weakIsp; u.ispSL *= 1 - pct * LUCK.weakIsp;
    }
    boosterUnits.push(u);
    unitRows.push({ partId: e.id, name: e.def.name, kind: 'booster', count: 1, spread: s, thrustPct: fT - 1, ispPct: fI - 1, fuelPct: fP - 1 });
  });

  // --- tanks: the propellant really loaded varies; a slow leak loses some before it is needed ---
  let dFuel = boosterUnits.reduce((t, u) => t + u.dFuel, 0);
  let dDry = engineUnits.reduce((t, u) => t + u.dMass, 0) + boosterUnits.reduce((t, u) => t + u.dMass, 0);
  for (const e of layout.filter((x) => x.def?.fuel)) {
    const { r, q } = quality(e);
    const s = spreadFor(q);
    const usable = e.def.fuel.type === b.mainFuel;
    const vary = streamOf(buildSerial, partKey(e, units), 'vary');
    const roll = streamOf(serial, partKey(e, units), 'defect');
    const fP = 1 + s * sym(vary), fM = 1 + s * LUCK.massSpread * sym(vary);
    const loaded = e.def.fuel.mass * fP;
    dDry += (fM - 1) * (parts.get(e.id)?.dry ?? 0);
    if (!usable) { dDry += loaded - e.def.fuel.mass; continue; } // propellant the engines cannot burn is only weight
    dFuel += loaded - e.def.fuel.mass;
    if (roll() < defectChance(r, wearOf(e.id))) {
      const share = between(roll, LUCK.leak);
      const kg = loaded * share;
      dFuel -= kg;
      defects.push({ kind: 'leak', source: 'factory', partId: e.id, name: e.def.name, unit: 0, count: 1, pct: share, kg });
    }
    unitRows.push({ partId: e.id, name: e.def.name, kind: 'tank', count: 1, spread: s, fuelPct: fP - 1 });
  }

  // --- totals as built (before the pad and the flight) ---
  const totals = () => {
    const all = [...engineUnits, ...boosterUnits];
    const thrust = all.reduce((t, u) => t + u.thrust, 0);
    const thrustSL = all.reduce((t, u) => t + (u.ispVac > 0 ? u.thrust * (u.ispSL / u.ispVac) : 0), 0);
    const ispVac = thrust > 0 ? all.reduce((t, u) => t + u.ispVac * u.thrust, 0) / thrust : 0;
    const ispSL = thrust > 0 ? all.reduce((t, u) => t + u.ispSL * u.thrust, 0) / thrust : 0;
    const dryMass = Math.max(1, s0.dryMass + dDry);
    const fuelMass = Math.max(0, s0.fuelMass + dFuel);
    const wetMass = dryMass + fuelMass;
    const deltaV = fuelMass > 0 && ispVac > 0 && g0 > 0 ? ispVac * g0 * Math.log(wetMass / dryMass) : 0;
    return {
      thrust, thrustSL, ispVac, ispSL, dryMass, fuelMass, wetMass, deltaV,
      twrEarth: wetMass > 0 && gEarth > 0 ? thrustSL / (wetMass * gEarth) : 0,
      twrMars: wetMass > 0 && gMars > 0 ? thrust / (wetMass * gMars) : 0,
    };
  };
  // a ship with no engines or no variation at all keeps its designed numbers exactly
  const hasUnits = engineUnits.length + boosterUnits.length > 0;
  const designedNums = pick(s0, thrustSL0);
  let built = hasUnits ? totals() : { ...designedNums };

  const weatherIn = b.weather ?? {};
  const forecastC = num(weatherIn.forecastC, num(weatherIn.tempC, spec.launch?.tempC ?? 15));
  const actualC = num(weatherIn.actualC, forecastC);
  const padFx = b.padFx ?? {};
  const hullRisk = b.hull?.risk ?? {};
  const hullWear = Math.max(0, ...Object.values(wear?.hull ?? {}));
  const flightRoll = streamOf(serial, seed, `d${num(weatherIn.day, 0)}`, 'flight');
  let scrub = null;
  const stats = { ...s0 };

  if (stage === 'flight') {
    // on the pad: the only engine not lighting stops the count at zero; clamps catch, with their chance, an engine that
    // will not come up in a cluster, or a weak one (an engine-out cluster may lift with one engine up to 10 % weak).
    // An engine that runs on the pad and dies later in flight cannot be seen here.
    const engineDefects = defects.filter((d) => d.source === 'factory' && ['weak', 'out', 'outPair', 'noLight'].includes(d.kind));
    const noLight = engineDefects.filter((d) => d.kind === 'noLight' && d.count === 1);
    const catchChance = clamp01(padFx.holdDownCatch ?? 0);
    const visible = engineDefects.filter((d) => (d.kind === 'noLight' && d.count > 1) || (d.kind === 'weak' && !(d.engineOut && d.count > 1 && d.pct <= LUCK.engineOutCommit)));
    const caught = visible.filter(() => flightRoll() < catchChance);
    if (noLight.length) scrub = { reason: 'noLight', defects: noLight };
    else if (caught.length) { caught.forEach((d) => { d.caught = true; }); scrub = { reason: 'holdDown', defects: caught }; }
    else if (built.twrEarth < 1 && s0.twrEarth >= 1 && engineDefects.length) scrub = { reason: 'noLift', defects: engineDefects };
    if (scrub) scrub.partIds = [...new Set(scrub.defects.map((d) => d.partId))];

    if (!scrub) {
      // liftoff: debris thrown up by the exhaust may hit an engine
      if (engineUnits.length && flightRoll() < clamp01(padFx.damageChance ?? 0)) {
        const live = engineUnits.filter((u) => u.thrust > 0);
        const u = live[Math.floor(flightRoll() * live.length)] ?? null;
        if (u) {
          const pct = between(flightRoll, LUCK.debris);
          u.thrust *= 1 - pct; u.ispVac *= 1 - pct * LUCK.weakIsp; u.ispSL *= 1 - pct * LUCK.weakIsp;
          defects.push({ kind: 'debris', source: 'pad', partId: u.partId, name: u.name, unit: u.idx, count: u.count, pct });
          built = totals();
        }
      }
      // the climb: a skin panel may wrinkle at max-Q, or the skin may overheat and shed pieces onto the heat shield
      const section = weakestSection(b.hull, ctx.hull);
      if (flightRoll() < wornRisk(hullRisk.maxQ, hullWear)) {
        defects.push({ kind: 'buckle', source: 'flight', partId: null, name: null, section, pct: LUCK.buckleDrag - 1 });
        if (Number.isFinite(stats.ascentCdA)) stats.ascentCdA *= LUCK.buckleDrag;
      }
      if (flightRoll() < wornRisk(hullRisk.heat, hullWear)) {
        const shield = !!s0.hasHeatShield;
        defects.push({ kind: shield ? 'overheat' : 'overheatBare', source: 'flight', partId: null, name: null, section });
        if (shield) stats.heatShieldDamaged = true; // the Columbia ending (The Foam)
      }
      // the real temperature replaces the forecast; cheap seals in the cold are the Challenger story (Role 2 flies it)
      if (!s0.coldRatedSeals && actualC < COLD_TEMP_C) defects.push({ kind: 'coldSeals', source: 'flight', partId: null, name: null, tempC: actualC, forecastC, surprise: forecastC >= COLD_TEMP_C });
      // lightning after liftoff (padFx.lightningRisk: the day's storms, less the pad's protection and weather watch).
      // Apollo 12 was struck twice in 1969: the fuel cells dropped off line and the guidance platform tumbled. The
      // ShipSpec has no lever for the guidance itself, so the strike lowers stats.reliability (the electronics took
      // it); Role 2's per-phase roll would use that (docs/SHARE_PROBLEMS.md request).
      if (flightRoll() < clamp01(padFx.lightningRisk ?? 0)) {
        const brain = layout.find((e) => e.def?.flags?.avionics) ?? layout.find((e) => e.def?.flags?.capsule) ?? null;
        defects.push({ kind: 'lightning', source: 'flight', partId: brain?.id ?? null, name: brain?.def?.name ?? null });
        stats.reliability = (stats.reliability ?? 1) * LUCK.lightningHit;
      }
    }
  }

  if (hasUnits) Object.assign(stats, pickStats(built));
  const flown = {
    ...spec,
    stats,
    launch: stage === 'flight' ? { ...(spec.launch ?? {}), tempC: actualC } : { ...(spec.launch ?? {}) },
  };
  // plain notes for the investigation board (what the weather, the pad, the skin and wear did)
  if (stage === 'flight') {
    if (actualC !== forecastC) notes.push({ kind: 'weather', forecastC, actualC });
    if ((padFx.liftoffLossMps ?? 0) > 0) notes.push({ kind: 'liftoffLoss', mps: padFx.liftoffLossMps });
    for (const n of padFx.notesI18n ?? padFx.notes ?? []) notes.push({ kind: 'pad', text: n }); // { en, vi } or a plain line
    for (const n of hullRisk.notes ?? []) notes.push({ kind: 'hull', text: n });
  }
  if (wear) notes.push({ kind: 'wear', mean: meanWear(wear) });

  return {
    spec: flown, defects, notes, seed, scrub: stage === 'flight' ? scrub : null, stage,
    designed: designedNums, asBuilt: pick(stats, hasUnits ? built.thrustSL : thrustSL0), units: unitRows,
    weather: { day: num(weatherIn.day, 0), forecastC, actualC, label: weatherIn.label ?? '', windKts: num(weatherIn.windKts, 0), lightning: num(weatherIn.lightning, 0) },
    pad: { liftoffLossMps: padFx.liftoffLossMps ?? 0, damageChance: padFx.damageChance ?? 0, holdDownCatch: padFx.holdDownCatch ?? 0, repairFee: padFx.repairFee ?? 0, excess: padFx.excess ?? 0, lightningRisk: padFx.lightningRisk ?? 0 },
    need: { oneWay: b.oneWay ?? 0, roundTrip: b.roundTrip ?? 0 },
  };
}

const num = (x, fallback) => (Number.isFinite(x) ? x : fallback);
const avg = (xs, f) => (xs.length ? xs.reduce((t, x) => t + f(x), 0) / xs.length : 0);
const pickStats = (t) => ({ thrust: t.thrust, ispVac: t.ispVac, ispSL: t.ispSL, dryMass: t.dryMass, fuelMass: t.fuelMass, wetMass: t.wetMass, deltaV: t.deltaV, twrEarth: t.twrEarth, twrMars: t.twrMars });
/** The skin section most likely to give: the weakest material, or the body when the skin is not known. */
function weakestSection(hull, choice = null) {
  const by = hull?.bySection ?? {};
  const ids = Object.keys(by).length ? Object.keys(by) : [];
  let best = null, score = Infinity;
  for (const id of ids) {
    const m = by[id]?.material && typeof by[id].material === 'object' ? by[id].material : hullMaterial(choice ?? {}, id);
    const k = Number(m?.strengthKPa);
    if (Number.isFinite(k) && k < score) { score = k; best = id; }
  }
  return best ?? ids[0] ?? null;
}

// ---------- words ----------
/**
 * One defect in plain words. templates = text.json luck.defects ({ kind: { en, vi } } plus unit, section, sections).
 * Placeholders: {part} {unit} {pct} {kg} {tempC} {forecastC} {section}.
 */
export function describeDefect(d, templates, lang = 'en') {
  const t = (entry) => (entry == null ? '' : typeof entry === 'string' ? entry : entry[lang] ?? entry.en ?? '');
  const unit = d.count > 1 ? t(templates?.unit).replace('{i}', String((d.unit ?? 0) + 1)).replace('{n}', String(d.count)) : '';
  const section = d.section ? t(templates?.sections?.[d.section]) || d.section : t(templates?.sections?.any);
  const vars = {
    part: d.name ?? '', unit, pct: localNumber(Math.round((d.pct ?? 0) * 100), lang), kg: localNumber(Math.round(d.kg ?? 0), lang),
    tempC: localNumber(Math.round(d.tempC ?? 0), lang), forecastC: localNumber(Math.round(d.forecastC ?? 0), lang), section,
  };
  const key = d.kind === 'coldSeals' && d.surprise ? 'coldSealsSurprise' : d.kind;
  return t(templates?.[key] ?? d.kind).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/**
 * A number in the reader's style: English 5,400 and 23.2; Vietnamese 5.400 and 23,2. Negative numbers take a real
 * minus sign (−), as the weather line does.
 */
export function localNumber(n, lang = 'en', digits = 0) {
  if (!Number.isFinite(n)) return '—';
  const text = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const styled = lang === 'vi' ? text.replace(/[,.]/g, (c) => (c === ',' ? '.' : ',')) : text;
  return (n < 0 && Number(text.replace(/,/g, '')) !== 0 ? '−' : '') + styled;
}
/** Numbers written in English style inside a sentence (another module's line), restyled for Vietnamese. */
export const localText = (text, lang = 'en') => (lang === 'vi' ? String(text ?? '').replace(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+/g, (m) => m.replace(/[,.]/g, (c) => (c === ',' ? '.' : ','))) : String(text ?? ''));

// ---------- the investigation ----------
// Which parts to look at, and which question to ask, for each ending (and Role 2's causeId when it says more).
const LOOK = {
  adrift: ['engines', 'tanks'], rud: ['engines', 'tanks'], burnup: ['heatShield', 'capsule'], theFoam: ['heatShield'],
  coldMorning: ['seals'], outOfBreath: ['o2'], pureOxygen: ['capsule'], successfulFailure: ['tanks'], silentReturn: ['capsule'],
  unitError: ['engines'], falseTouchdown: ['legs'], spin: ['rcs'], beagle: ['antenna'],
};
const LOOK_CAUSE = {
  max_q_exceeded: ['nose', 'tanks'], engine_overheat: ['engines'], g_force_blackout: ['engines', 'capsule'], crash_landing: ['legs', 'engines'],
  tipped_over: ['legs'], debris_impact: ['capsule'], skipped_off: ['heatShield'], no_heat_shield: ['capsule'], heat_overload: ['heatShield'],
};
/** The parts of a layout by what an investigator would look at (stored with each flight record). */
export function partGroups(layout) {
  const ids = (f) => layout.filter(f).map((e) => e.id);
  const flag = (k) => (e) => !!e.def?.flags?.[k];
  return {
    engines: ids((e) => e.def?.engine || e.def?.booster), tanks: ids((e) => e.def?.fuel), heatShield: ids(flag('heatShield')),
    capsule: ids(flag('capsule')), seals: ids(flag('cheapSeals')), o2: ids((e) => Number(e.def?.flags?.spareO2Tanks) > 0),
    legs: ids(flag('legs')), rcs: ids(flag('rcs')), antenna: ids(flag('antenna')),
    nose: ids((e) => e.attach === 'axial' && e.def?.section === 'nose' && !e.def?.flags?.capsule),
  };
}
/**
 * What the board says about a flight record: { verdict, shortBy, partIds, question }.
 * verdict: 'paperShort' (short of the trip even as designed), 'builtShort' (enough on paper, not as built), 'enough'.
 */
export function investigate(record) {
  const need = record?.need?.oneWay ?? 0;
  const paper = record?.designed?.deltaV ?? 0, built = record?.asBuilt?.deltaV ?? paper;
  const verdict = !(need > 0) ? null : paper < need ? 'paperShort' : built < need ? 'builtShort' : 'enough';
  const ending = record?.outcome?.endingId ?? null;
  const cause = record?.outcome?.causeId ?? null;
  const groups = record?.groups ?? {};
  const keys = LOOK_CAUSE[cause] ?? LOOK[ending] ?? [];
  const partIds = [...new Set([...keys.flatMap((k) => groups[k] ?? []), ...(record?.defects ?? []).map((d) => d.partId).filter(Boolean)])];
  let question = cause && QUESTION_CAUSE[cause] ? QUESTION_CAUSE[cause] : QUESTION[ending] ?? 'other';
  if (question === 'fuel' && verdict === 'builtShort') question = 'margin';
  // the defect that explains this ending comes first (the seals on a cold morning, the skin for The Foam…)
  const first = HEADLINE[ending] ?? [];
  const rank = (d) => { const i = first.indexOf(d.kind); return i < 0 ? first.length : i; };
  const defects = [...(record?.defects ?? [])].sort((x, y) => rank(x) - rank(y));
  const numbersFirst = ['fuel', 'margin', 'landing'].includes(question);
  return { verdict, shortBy: Math.max(0, need - Math.min(paper, built)), need, paper, built, partIds, question, defects, numbersFirst };
}
const HEADLINE = {
  coldMorning: ['coldSeals'], theFoam: ['overheat'], burnup: ['overheat', 'overheatBare'], rud: ['buckle', 'out', 'outPair', 'weak', 'noLight', 'grain', 'debris'],
  adrift: ['leak', 'weak', 'out', 'outPair', 'noLight', 'debris', 'grain'], successfulFailure: ['leak', 'out', 'outPair'],
};
const QUESTION = { adrift: 'fuel', rud: 'loads', burnup: 'heat', theFoam: 'foam', coldMorning: 'cold', outOfBreath: 'oxygen' };
const QUESTION_CAUSE = { out_of_fuel: 'fuel', transfer_short: 'fuel', skipped_off: 'entry', max_q_exceeded: 'loads', engine_overheat: 'engineHeat', g_force_blackout: 'gforce', crash_landing: 'landing', tipped_over: 'tipped', debris_impact: 'debris', no_heat_shield: 'heat', heat_overload: 'heat', heat_shield_damaged: 'foam', seal_failure_cold: 'cold', suit_o2_depleted: 'oxygen' };
