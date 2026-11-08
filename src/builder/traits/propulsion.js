// Flight traits, propulsion: engines and the launch pad: how deep each engine throttles, how many times it can light, how fast and far it steers, how it may fail in flight (an engine-out a cluster survives), how hard the pad lets the ship leave.
// Pure (Node-testable, no browser or core imports). Owner: the wave-5 propulsion agent (see src/builder/CLAUDE.md §8).
// Real numbers live in propulsion.json next to this file (per part id and per kit option id), never in the section folders;
// they arrive as `data` (catalogData.js imports the JSON for the game, the tests read it), so this file stays pure.
// Returns plain JSON (no Infinity: use null for "unlimited"), so it survives save() and the flight scenes.
/**
 * propulsionTraits(layout, ctx, data) → this group's traits for ShipSpec.stats.traits.propulsion.
 * layout: assembly.layout() entries; ctx: { catalog, engines, materials, hull, padFx, stats, optionsOf(entry) };
 * data: the parsed propulsion.json ({ neutral, ... }).
 * Until the agent fills it in, it returns neutral values: the flight behaves exactly as before.
 */
export function propulsionTraits(layout, ctx, data) {
  return { ...(data?.neutral ?? {}) };
}
