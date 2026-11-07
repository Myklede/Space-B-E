// What the launch pad does to the ship (Role 1 agent "pad" owns this file). Pure: no browser or core imports.
//
// The pad is the ground under the rocket: launch mount and flame trench, water deluge, hold-down clamps, tower,
// lightning protection, weather watch. Its heat limit is compared with the ship's thrust on the pad: over the limit the
// engines throttle back for the first seconds (a little Δv lost), debris may damage an engine (asBuilt.js rolls it),
// and the pad needs repairs before the next launch. Hold-down clamps may catch a bad engine before release.
//
// PHASE 0 STUB: fees and reliability as before, no heat limit. The pad agent replaces the body and keeps the exports
// and the returned fields.

const sum = (xs, f) => xs.reduce((t, x) => t + f(x), 0);

/**
 * padEffects(launch, { pad, weather, thrustSL, engineCount }) → {
 *   choices: [{ eq, option }] the equipment in use,
 *   fee: launch fees paid at confirm, reliability: added to the ship's reliability as (1 + reliability),
 *   heatLimitKN, excess (share of thrust over the limit, 0..), liftoffLossMps (Δv spent throttled on the pad),
 *   damageChance (0..1, an engine hurt by debris), repairFee (charged before the next launch),
 *   holdDownCatch (0..1, chance a bad engine is caught on the pad), lightningRisk (0..1),
 *   notes: [] plain lines for the investigation board,
 *   launch: the ShipSpec launch block ({ tempC, … extras })
 * }
 */
export function padEffects(launch, { pad = null, weather = null, thrustSL = 0, engineCount = 0 } = {}) {
  void thrustSL; void engineCount;
  const choices = (pad?.equipment ?? []).map((eq) => ({ eq, option: eq.options.find((o) => o.id === launch?.pad?.[eq.key]) ?? eq.options[0] })).filter((c) => c.option);
  const fee = (weather?.fee ?? 0) + sum(choices, (c) => c.option.fee ?? 0);
  const reliability = sum(choices, (c) => c.option.reliability ?? 0);
  return {
    choices, fee, reliability, heatLimitKN: Infinity, excess: 0, liftoffLossMps: 0, damageChance: 0, repairFee: 0, holdDownCatch: 0, lightningRisk: 0, notes: [],
    launch: { tempC: weather?.tempC ?? 15, slot: weather?.slot?.id ?? 'mild', ...(weather?.site ? { site: weather.site.id } : {}), ...(choices.length ? { pad: Object.fromEntries(choices.map((c) => [c.eq.key, c.option.id])) } : {}) },
  };
}
