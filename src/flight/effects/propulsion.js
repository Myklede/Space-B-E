// Part effects in flight, propulsion: engines and the launch pad (traits.propulsion): throttle depth and ignitions (shipParams already reads them), steering authority, an engine failing in flight by its reliability (a cluster with engine-out keeps going), the pad holding a strong ship back at liftoff (a cheap pad: a slow climb).
// Owner: the wave-5 propulsion agent (Role 1, src/builder/CLAUDE.md §8). Hooks: see ./index.js. Every hook is optional;
// with none the flight behaves exactly as before. Record what happened with note() for the hangar's flight analysis.
// eslint-disable-next-line no-unused-vars
import { note } from './index.js';
