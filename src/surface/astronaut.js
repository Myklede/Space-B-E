// The astronaut's state shared by flight (src/flight) and surface (src/surface): suit O₂, body stats, suit on/off.
// Both folders are Role 2, so src/flight/index.js may import this file.
import { events, getShip } from '/src/core/index.js';
import { createOxygen } from './oxygen.js';
import { createBodyStats } from './bodyStats.js';

const TANK_SECONDS = 300; // one suit tank ≈ 5 real minutes (gameplay value, TODO tune)

let oxygen = null;
let body = null;
let suited = false;

/** Fresh astronaut for a new mission: spare tanks come from the ship (ShipSpec.stats.spareO2Tanks). */
function reset(shipSpec = getShip()) {
  oxygen = createOxygen({ bus: events, tankSeconds: TANK_SECONDS, spareTanks: shipSpec?.stats?.spareO2Tanks ?? 2 });
  body = createBodyStats();
  suited = false;
}

export const astronaut = {
  reset,
  get oxygen() { if (!oxygen) reset(); return oxygen; },
  get body() { if (!body) reset(); return body; },
  get suited() { return suited; },
  set suited(v) { suited = !!v; },
};
