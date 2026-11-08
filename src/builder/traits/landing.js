// Flight traits, landing: landing, power and comms: the touchdown speed the legs stand, how slowly the chutes let the ship down, the energy for the rovers, how fast the antenna sends data home.
// Pure (Node-testable, no browser or core imports). Owner: the wave-5 landing agent (see src/builder/CLAUDE.md §8).
// Real numbers live in landing.json next to this file (per part id and per kit option id), never in the section folders;
// they arrive as `data` (catalogData.js imports the JSON for the game, the tests read it), so this file stays pure.
// Returns plain JSON (no Infinity: use null for "unlimited"), so it survives save() and the flight scenes.
/**
 * landingTraits(layout, ctx, data) → this group's traits for ShipSpec.stats.traits.landing.
 * layout: assembly.layout() entries; ctx: { catalog, engines, materials, hull, padFx, stats, optionsOf(entry) };
 * data: the parsed landing.json ({ neutral, ... }).
 * Until the agent fills it in, it returns neutral values: the flight behaves exactly as before.
 */
export function landingTraits(layout, ctx, data) {
  return { ...(data?.neutral ?? {}) };
}
