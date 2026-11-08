// Part effects in flight, structure: skin, structure and heat shield (traits.structure): the max-Q the structure stands, heating on the climb, what a debris hit does to this skin, how much heat the shield absorbs on entry, wear.
// Owner: the wave-5 structure agent (Role 1, src/builder/CLAUDE.md §8). Hooks: see ./index.js. Every hook is optional;
// with none the flight behaves exactly as before. Record what happened with note() for the hangar's flight analysis.
// eslint-disable-next-line no-unused-vars
import { note } from './index.js';
