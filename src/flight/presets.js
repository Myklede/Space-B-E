// Role 2 MOCK data so flight can be tested before Role 1's builder exists.
// The real preset ships live in core/mocks/ (Role 1). Shapes follow ShipSpec (TEAM_PROMPT §14).

export const MOCK_PLANETS = {
  earth: { g: 9.81, radius: 637e3, realRadius: 6371e3, seaLevelDensity: 1.225, scaleHeight: 8500 },
  mars: { g: 3.71, radius: 339.5e3, realRadius: 3389.5e3, seaLevelDensity: 0.02, scaleHeight: 11100 },
};

const base = {
  cost: 2800000,
  dryMass: 6, // t
  fuelMass: 20, // t
  thrust: 400, // kN (vacuum)
  ispSL: 330,
  ispVac: 350, // methalox, mid nozzle
  hasHeatShield: true,
  heatShieldDamaged: false,
  hasLegs: true,
  hasRCS: true,
  hasParachute: true,
  hasAntenna: true,
  hasShelter: true,
  coldRatedSeals: true,
  armorHits: 1,
  spareO2Tanks: 2,
};

const spec = (name, stats, extra = {}) => ({
  name,
  parts: [],
  engines: [{ fuel: 'methalox', nozzle: 'mid', pump: 'M' }],
  stats: { ...base, ...stats },
  warnings: [],
  ...extra,
});

export const MOCK_SHIPS = {
  reliable: spec('Reliable', {}),
  coldMorning: spec('Cold Morning', { coldRatedSeals: false, cost: 2300000 }, { warnings: ['COLD_SEALS'] }),
  thinSkin: spec('Thin Skin', { heatShieldDamaged: true }, { warnings: ['HEAT_SHIELD_DAMAGED'] }),
  noShield: spec('No Shield', { hasHeatShield: false }, { warnings: ['NO_HEAT_SHIELD'] }),
  // what's left of the ship when it reaches Mars (most fuel spent on the way)
  marsArrival: spec('Mars arrival', { fuelMass: 4, thrust: 200 }),
};

// Start conditions for FlightController({ start })
export const STARTS = {
  earthPad: 'pad',
  // Entry corridor (scaled Mars): about -22° to -30° at 1.4 km/s works. Shallower than ~-20° skips off
  // (1.4 km/s is above Mars escape speed up there), steeper than ~-40° can't slow down in the thin air.
  marsEntry: { altitude: 99000, speed: 1400, flightPathDeg: -26 },
  // just after the chute: start of powered descent (real landers light engines at ~2 km, ~100 m/s)
  marsLanding: { altitude: 3000, speed: 120, flightPathDeg: -65 },
};

export const SCENARIOS = {
  normal: { tempC: 18 },
  coldMorning: { tempC: 2 }, // Challenger launched at about 2 °C (36 °F)
};
