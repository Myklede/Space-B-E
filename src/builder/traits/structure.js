// Flight traits, structure: the skin and structure: the dynamic pressure it stands (max-Q), the heat on the climb, what a debris or micrometeoroid hit does to it, how much the heat shield can absorb on entry, how much it wears per flight.
// Pure (Node-testable, no browser or core imports). Owner: the wave-5 structure agent (see src/builder/CLAUDE.md §8).
// Real numbers live in structure.json next to this file (per part id and per kit option id), never in the section folders;
// they arrive as `data` (catalogData.js imports the JSON for the game, the tests read it), so this file stays pure.
// Returns plain JSON (no Infinity: use null for "unlimited"), so it survives save() and the flight scenes.
/**
 * structureTraits(layout, ctx, data) → this group's traits for ShipSpec.stats.traits.structure.
 * layout: assembly.layout() entries; ctx: { catalog, engines, materials, hull, padFx, stats, optionsOf(entry) };
 * data: the parsed structure.json ({ neutral, ... }).
 * Until the agent fills it in, it returns neutral values: the flight behaves exactly as before.
 */
export function structureTraits(layout, ctx, data) {
  return { ...(data?.neutral ?? {}) };
}
