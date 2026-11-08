// Flight traits, life: the crew's life support: oxygen in kilograms (minutes of spacewalk), carbon-dioxide scrubbing, water, the radiation dose behind the shelter on the way to Mars.
// Pure (Node-testable, no browser or core imports). Owner: the wave-5 life agent (see src/builder/CLAUDE.md §8).
// Real numbers live in life.json next to this file (per part id and per kit option id), never in the section folders;
// they arrive as `data` (catalogData.js imports the JSON for the game, the tests read it), so this file stays pure.
// Returns plain JSON (no Infinity: use null for "unlimited"), so it survives save() and the flight scenes.
/**
 * lifeTraits(layout, ctx, data) → this group's traits for ShipSpec.stats.traits.life.
 * layout: assembly.layout() entries; ctx: { catalog, engines, materials, hull, padFx, stats, optionsOf(entry) };
 * data: the parsed life.json ({ neutral, ... }).
 * Until the agent fills it in, it returns neutral values: the flight behaves exactly as before.
 */
export function lifeTraits(layout, ctx, data) {
  return { ...(data?.neutral ?? {}) };
}
