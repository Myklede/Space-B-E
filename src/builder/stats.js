// ShipSpec from an Assembly (contract.js SHIP_SPEC_SHAPE). Pure JS: planets and g0 are passed in, never written here.
import { partRadius } from './assembly.js';

export const TWR_MIN = 1.2;
export const RELIABILITY_MIN = 0.8;
export const COLD_TEMP_C = 5;
/** With active steering the centre of pressure may sit up to this share of the stack height ahead of the centre of mass. */
export const STEERING_MARGIN = 0.06;
const BONUS_CAP = 0.06; // the most the "good engineering" flags (avionics, wiring tunnel, spheres…) may add to reliability

/** Mass, cost, thrust and Isp of one engine definition { fuel, nozzle, pump } from data/engines.json. */
export function engineStats(def, engines, g0, mods = null) {
  const fuel = engines.fuels[def.fuel] ?? engines.fuels.methalox;
  const nozzle = engines.nozzles[def.nozzle] ?? engines.nozzles.vac;
  const pump = engines.pumps[def.pump] ?? engines.pumps.M;
  const [baseSL, baseVac] = fuel.isp[def.nozzle in engines.nozzles ? def.nozzle : 'vac'];
  const m = mods ?? NO_MODS;
  const ispSL = Math.max(1, baseSL + m.isp);
  const ispVac = Math.max(ispSL, baseVac + m.isp);
  const thrust = pump.thrust * m.thrustF;
  const veSL = ispSL * g0;
  const veVac = ispVac * g0;
  return {
    fuel: def.fuel, nozzle: def.nozzle, pump: def.pump,
    thrust, // N in vacuum
    thrustSL: thrust * (ispSL / ispVac), // N at sea level (same mass flow, lower exhaust speed)
    // the chamber and nozzle scale with the pump (pump.chamberScale, 1 for the large pump)
    mass: (pump.mass + (fuel.chamberMass + nozzle.mass) * (pump.chamberScale ?? 1) + m.massD) * m.massF,
    cost: (pump.cost + (fuel.chamberCost + nozzle.cost) * (pump.chamberScale ?? 1) + m.costD) * m.costF,
    ispSL, ispVac, veSL, veVac,
    mdotVac: thrust / veVac, // kg/s
    mdotSL: thrust / veVac, // the pump moves the same mass; the sea-level thrust is what drops
    heatRate: pump.heatRate,
    special: fuel.special ?? '',
  };
}

const NO_MODS = Object.freeze({ massF: 1, massD: 0, costF: 1, costD: 0, rel: 0, isp: 0, thrustF: 1, powerF: 1, chuteF: 1 });

/** Combined effect of a part's chosen internal options (sections/<id>/internals.json): factors multiply, deltas add. */
export function optionMods(options) {
  const m = { ...NO_MODS };
  for (const o of Object.values(options ?? {})) {
    if (!o) continue;
    m.massF *= o.massF ?? 1;
    m.massD += o.massD ?? 0;
    m.costF *= o.costF ?? 1;
    m.costD += o.costD ?? 0;
    m.rel += o.rel ?? 0;
    m.isp += o.isp ?? 0;
    m.thrustF *= o.thrustF ?? 1;
    m.powerF *= o.powerF ?? 1;
    m.chuteF *= o.chuteF ?? 1;
  }
  return m;
}

const sum = (xs, f) => xs.reduce((acc, x, i) => acc + f(x, i), 0);

/**
 * computeShipSpec(assembly, { catalog, engines, launch, balance, planets, g0, materials })
 * → { spec, breakdown, blocks } where blocks are the hard blocks that need no money check (OVER_BUDGET is added by gonogo.js).
 * Solid motors (def.booster) add their thrust and propellant to the single stage the flight model flies; their casings
 * ride along as dry mass. Internal options (sections/<id>/internals.json) modify mass, cost, reliability, Isp, thrust and power.
 */
export function computeShipSpec(assembly, { catalog, engines, launch, balance, planets, g0, materials = null, pad = null }) {
  const layout = assembly.layout();
  // launch site, window and pad equipment (sections/pad/section.json); without pad data, the old launch.json slots
  const site = pad?.sites?.find((x) => x.id === assembly.launch.site) ?? pad?.sites?.[0] ?? null;
  const slots = site?.slots ?? launch.slots ?? [];
  const slot = slots.find((x) => x.id === assembly.launch.slot) ?? slots[0] ?? { id: 'mild', tempC: 15, fee: 0 };
  const padChoices = (pad?.equipment ?? []).map((eq) => ({ eq, option: eq.options.find((o) => o.id === assembly.launch.pad?.[eq.key]) ?? eq.options[0] })).filter((c) => c.option);
  const launchFee = (slot.fee ?? 0) + (site?.fee ?? 0) + sum(padChoices, (c) => c.option.fee ?? 0);
  const padReliability = sum(padChoices, (c) => c.option.reliability ?? 0);
  const flags = (e) => e.def.flags ?? {};
  // material of a part: factors on dry mass, cost and reliability (data/materials.json); the first option is the default
  const materialOf = (e) => {
    const fam = materials?.families?.[e.def.materialFamily];
    if (!fam) return null;
    return fam.options.find((o) => o.id === e.material) ?? fam.options[0];
  };
  const massFactor = (e) => materialOf(e)?.mass ?? 1;
  const costFactor = (e) => materialOf(e)?.cost ?? 1;
  const reliabilityDelta = (e) => materialOf(e)?.reliability ?? 0;
  const modsOf = (e) => (e.def.internals && catalog.optionsOf ? optionMods(catalog.optionsOf(e.def, e.options)) : NO_MODS);
  const mods = new Map(layout.map((e) => [e.id, modsOf(e)]));
  const mod = (e) => mods.get(e.id) ?? NO_MODS;

  // Liquid engines
  const engineDefOf = (e) => e.engine ?? { fuel: 'methalox', nozzle: 'vac', pump: String(e.def.size).toUpperCase() };
  const engineEntries = layout.filter((e) => e.def.engine);
  const countOf = (e) => e.cluster?.count ?? 1; // engines in a cluster (the thrust structure above sets it)
  const engineSpecs = engineEntries.map((e) => engineStats(engineDefOf(e), engines, g0, mod(e)));
  const engineCount = sum(engineEntries, countOf);
  // Solid motors: fixed thrust and Isp, their own propellant, a casing that stays
  const boosterEntries = layout.filter((e) => e.def.booster);
  const boosterSpecs = boosterEntries.map((e) => {
    const b = e.def.booster, m = mod(e);
    const ispSL = Math.max(1, b.ispSL + m.isp), ispVac = Math.max(ispSL, b.ispVac + m.isp);
    const thrust = b.thrust * m.thrustF;
    return { id: e.id, thrust, thrustSL: thrust * (ispSL / ispVac), ispSL, ispVac, propellant: b.propellant, burnTime: b.burnTime ?? 0 };
  });
  const n = (i) => countOf(engineEntries[i]);
  const thrust = sum(engineSpecs, (s, i) => s.thrust * n(i)) + sum(boosterSpecs, (s) => s.thrust);
  const thrustSL = sum(engineSpecs, (s, i) => s.thrustSL * n(i)) + sum(boosterSpecs, (s) => s.thrustSL);
  const ispVac = thrust > 0 ? (sum(engineSpecs, (s, i) => s.ispVac * s.thrust * n(i)) + sum(boosterSpecs, (s) => s.ispVac * s.thrust)) / thrust : 0;
  const ispSL = thrust > 0 ? (sum(engineSpecs, (s, i) => s.ispSL * s.thrust * n(i)) + sum(boosterSpecs, (s) => s.ispSL * s.thrust)) / thrust : 0;
  const mainFuel = engineSpecs[0]?.fuel ?? null;

  // Masses (engine hardware mass and cost scale with the chamber material; options add on top)
  const dryOf = (e) => (e.def.mass * massFactor(e) + mod(e).massD) * mod(e).massF;
  const engineHardwareMass = (e, i) => engineSpecs[i].mass * massFactor(e) * countOf(e);
  const partMass = sum(layout, dryOf) + sum(engineEntries, engineHardwareMass);
  const usableFuel = sum(layout, (e) => (e.def.fuel && e.def.fuel.type === mainFuel ? e.def.fuel.mass : 0)) + sum(boosterSpecs, (s) => s.propellant);
  const deadFuel = sum(layout, (e) => (e.def.fuel && e.def.fuel.type !== mainFuel ? e.def.fuel.mass : 0));
  const dryMass = partMass + deadFuel; // fuel the engine can't burn is just weight
  const fuelMass = usableFuel;
  const wetMass = dryMass + fuelMass;
  const cost = sum(layout, (e) => (e.def.cost * costFactor(e) + mod(e).costD) * mod(e).costF) + sum(engineEntries, (e, i) => engineSpecs[i].cost * costFactor(e) * countOf(e));

  // Performance (one stage: the flight model burns everything with the thrust-weighted Isp)
  const deltaV = fuelMass > 0 && dryMass > 0 ? ispVac * g0 * Math.log(wetMass / dryMass) : 0;
  const twrEarth = wetMass > 0 ? thrustSL / (wetMass * planets.earth.g) : 0;
  const twrMars = wetMass > 0 ? thrust / (wetMass * planets.mars.g) : 0;

  // Centre of mass and pressure (metres from the stack base)
  // Full mass of one part: structure + any propellant inside (usable or not) + the engine hardware.
  const massOf = (e) => dryOf(e) + (e.def.fuel?.mass ?? 0) + (e.def.booster?.propellant ?? 0) + (e.def.engine ? engineStats(engineDefOf(e), engines, g0, mod(e)).mass * massFactor(e) * countOf(e) : 0);
  const totalMass = sum(layout, massOf);
  const comY = totalMass > 0 ? sum(layout, (e) => massOf(e) * e.centerY) / totalMass : 0;
  const totalArea = sum(layout, (e) => e.def.aero.sideArea);
  const copY = totalArea > 0 ? sum(layout, (e) => e.def.aero.sideArea * e.centerY) / totalArea : comY;
  const stackHeight = layout.reduce((top, e) => (e.attach === 'axial' ? Math.max(top, e.y + e.height) : top), 0);
  const comOffset = comY - stackHeight / 2;
  const copOffset = copY - stackHeight / 2;

  // Flags
  const has = (key) => layout.some((e) => flags(e)[key]);
  const count = (key) => sum(layout, (e) => Number(flags(e)[key]) || 0);
  // A cluster of n engines: with engine-out capability (the thrust structure's flag) the ship survives one failure,
  // so n engines count as about 1 + 0.2 (n - 1) single engines; without it every engine must work (r^n).
  const partReliability = (e) => {
    const r = Math.min(1, Math.max(0.01, (e.def.reliability ?? 1) + reliabilityDelta(e) + mod(e).rel));
    const k = countOf(e);
    if (k <= 1) return r;
    const engineOut = layout.find((x) => x.id === e.parentId)?.def.flags?.engineOut;
    return Math.pow(r, engineOut ? 1 + (k - 1) * 0.2 : k);
  };
  const baseReliability = layout.reduce((r, e) => r * partReliability(e), 1);
  // reliability bonuses: parts in the same group (flags.bonusGroup, e.g. 'steering', 'abort') count once, the best of them
  const grouped = {};
  let ungrouped = 0;
  for (const e of layout) {
    const b = Number(flags(e).reliabilityBonus) || 0;
    if (!b) continue;
    const g = flags(e).bonusGroup;
    if (g) grouped[g] = Math.max(grouped[g] ?? 0, b); else ungrouped += b;
  }
  const bonusSum = ungrouped + Object.values(grouped).reduce((t, b) => t + b, 0);
  const bonus = Math.min(BONUS_CAP, bonusSum + Math.min(0.015, sum(layout, (e) => Number(flags(e).rigidity) || 0)));
  const reliability = Math.min(1, baseReliability * (1 + bonus) * (1 + padReliability));
  const hasHeatShield = has('heatShield');
  const noseCdA = layout.find((e) => e.def.aero.cdA != null)?.def.aero.cdA;
  const shieldCdA = layout.find((e) => e.def.aero.entryCdA != null)?.def.aero.entryCdA;
  const chuteCdA = sum(layout, (e) => (Number(flags(e).chuteCdA) || 0) * mod(e).chuteF);
  const power = sum(layout, (e) => (Number(flags(e).power) || 0) * mod(e).powerF);

  const stats = {
    cost, wetMass, dryMass, fuelMass, thrust, ispSL, ispVac, deltaV, twrEarth, twrMars,
    comOffset, copOffset, reliability,
    hasHeatShield, heatShieldDamaged: has('fragileShield'), hasLegs: has('legs'), hasRCS: has('rcs'),
    hasParachute: has('parachute'), hasAntenna: has('antenna'), hasShelter: has('shelter'), coldRatedSeals: !has('cheapSeals'),
    armorHits: count('armorHits'), spareO2Tanks: count('spareO2Tanks'), power: Math.round(power),
    // Extras Role 2's FlightController reads when present (not in the contract shape, harmless when ignored).
    ascentCdA: noseCdA ?? 6, cdA: hasHeatShield ? (shieldCdA ?? 80) : 3,
    ...(chuteCdA > 0 ? { chuteCdA } : {}),
  };

  const dv = balance.deltaVKmS ?? { ascent: 3.3, transfer: 2.1, landing: 0.4, return: 3.1 };
  const dvNeeded = { ascent: dv.ascent * 1000, transfer: dv.transfer * 1000, landing: dv.landing * 1000, return: dv.return * 1000 };
  const oneWay = dvNeeded.ascent + dvNeeded.transfer + dvNeeded.landing;

  const warnings = [];
  if (deltaV < oneWay) warnings.push('LOW_DV');
  if (twrEarth < TWR_MIN) warnings.push('LOW_TWR');
  if (!hasHeatShield) warnings.push('NO_HEAT_SHIELD');
  if (!stats.hasLegs) warnings.push('NO_LEGS');
  const steering = layout.some((e) => flags(e).gimbal || flags(e).steering);
  const margin = stackHeight > 0 ? (comY - copY) / stackHeight : 0; // > 0: the air pushes behind the balance point
  if (layout.length && (steering ? margin < -STEERING_MARGIN : copY >= comY)) warnings.push('UNSTABLE');
  if (stats.spareO2Tanks < 1) warnings.push('LOW_O2');
  if (!stats.hasAntenna) warnings.push('NO_ANTENNA');
  if (!stats.hasShelter) warnings.push('NO_SHELTER');
  if (!stats.coldRatedSeals && slot.tempC < COLD_TEMP_C) warnings.push('COLD_SEALS');
  if (reliability < RELIABILITY_MIN) warnings.push('LOW_RELIABILITY');

  const blocks = [];
  if (!has('capsule')) blocks.push('NO_CAPSULE');
  if (!engineEntries.length) blocks.push('NO_ENGINE');
  if (!(fuelMass > 0)) blocks.push('NO_FUEL');
  if (assembly.validate().length) blocks.push('NOT_CONNECTED');

  const spec = {
    name: assembly.name,
    parts: layout.map((e) => ({
      id: e.id, type: e.type, x: round(e.x), y: round(e.y), z: round(e.z), rotation: e.angle,
      variant: e.engine ? `${e.engine.fuel}-${e.engine.nozzle}` : e.def.fuel ? e.def.fuel.type : e.def.booster ? 'solid' : flags(e).fragileShield ? 'tiles' : flags(e).cheapSeals ? 'cheap_seals' : (materialOf(e)?.id ?? null),
    })),
    engines: engineSpecs.flatMap((s, i) => Array.from({ length: n(i) }, () => ({ fuel: s.fuel, nozzle: s.nozzle, pump: s.pump }))),
    stats,
    warnings,
    launch: { tempC: slot.tempC, slot: slot.id, ...(site ? { site: site.id } : {}), ...(padChoices.length ? { pad: Object.fromEntries(padChoices.map((c) => [c.eq.key, c.option.id])) } : {}) },
  };

  const breakdown = {
    parts: layout.map((e) => ({ id: e.id, type: e.type, name: e.def.name, family: e.def.family, mass: massOf(e), dry: dryOf(e) + (e.def.engine ? engineStats(engineDefOf(e), engines, g0, mod(e)).mass * massFactor(e) * countOf(e) : 0), cost: (e.def.cost * costFactor(e) + mod(e).costD) * mod(e).costF + (e.def.engine ? engineStats(engineDefOf(e), engines, g0, mod(e)).cost * costFactor(e) * countOf(e) : 0), fuel: (e.def.fuel?.mass ?? 0) + (e.def.booster?.propellant ?? 0), y: e.y, height: e.height, sideArea: e.def.aero.sideArea, attach: e.attach, material: materialOf(e)?.name ?? null, reliability: Math.min(1, (e.def.reliability ?? 1) + reliabilityDelta(e) + mod(e).rel) })),
    fuelPartIds: layout.filter((e) => e.def.fuel || e.def.booster).map((e) => e.id),
    enginePartIds: [...engineEntries, ...boosterEntries].map((e) => e.id),
    finPartIds: layout.filter((e) => /fin/.test(e.type)).map((e) => e.id),
    capsulePartIds: layout.filter((e) => flags(e).capsule).map((e) => e.id),
    comY, copY, stackHeight, steering, stabilityMargin: margin, dvNeeded, oneWay, roundTrip: oneWay + dvNeeded.return,
    usableFuel, deadFuel, slot, site, padChoices, launchFee, padReliability, engineSpecs, engineCount, boosterSpecs, mainFuel, thrustSL, baseReliability, reliabilityBonus: bonus,
    radius: layout.length ? Math.max(...layout.filter((e) => e.attach === 'axial').map((e) => partRadius(e.def))) : 1,
  };

  return { spec, breakdown, blocks };
}

/** Numbers for one catalogue part on its own (cards and the detail panel), with material and options applied. */
export function partFigures(def, { engines, g0, materials = null, catalog = null, materialId = null, options = null, engineDef = null, count = 1 }) {
  const fam = materials?.families?.[def.materialFamily];
  const mat = fam ? (fam.options.find((o) => o.id === materialId) ?? fam.options[0]) : null;
  const m = def.internals && catalog?.optionsOf ? optionMods(catalog.optionsOf(def, options)) : NO_MODS;
  const matMass = mat?.mass ?? 1, matCost = mat?.cost ?? 1;
  let mass = (def.mass * matMass + m.massD) * m.massF;
  let cost = (def.cost * matCost + m.costD) * m.costF;
  let engine = null;
  if (def.engine) {
    engine = engineStats(engineDef ?? { fuel: 'methalox', nozzle: 'sl', pump: String(def.size).toUpperCase() }, engines, g0, m);
    engine = { ...engine, count, totalThrust: engine.thrust * count, totalThrustSL: engine.thrustSL * count };
    mass += engine.mass * matMass * count;
    cost += engine.cost * matCost * count;
  }
  const booster = def.booster ? { thrust: def.booster.thrust * m.thrustF, ispSL: def.booster.ispSL + m.isp, ispVac: def.booster.ispVac + m.isp, propellant: def.booster.propellant, burnTime: def.booster.burnTime } : null;
  return {
    mass, cost, dry: mass, wet: mass + (def.fuel?.mass ?? 0) + (def.booster?.propellant ?? 0),
    reliability: Math.min(1, (def.reliability ?? 1) + (mat?.reliability ?? 0) + m.rel),
    power: (Number(def.flags?.power) || 0) * m.powerF, chuteCdA: (Number(def.flags?.chuteCdA) || 0) * m.chuteF,
    engine, booster, material: mat, mods: m,
  };
}

const round = (n) => Math.round(n * 100) / 100;
