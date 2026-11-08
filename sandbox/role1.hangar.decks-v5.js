// v5 part "decks" (owner: decks agent). Stub: reuses Codex's v4 radial collars until the smooth collars land.
// Contract: createDeckCollars(ctx) returns {fit(entries,hull), update(dt,platforms), fits[level][segmentId].retract, batches[]}.
import {createWrapCollars} from './role1.hangar.collars-v4.js';
export function createDeckCollars({scene,assets,layout}){
  return createWrapCollars(scene,assets.get(layout.collar.plateModule),layout);
}
