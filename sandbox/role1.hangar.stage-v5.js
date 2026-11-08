// v5 part "stage" (owner: stage agent: launcher, console bank on the diagonal, reveal, camera presets, light rig).
// Stub: reuses Codex's v4 consoles in their old frontal place.
// Contract: createStage(ctx) returns what createConsoles returned: {update(dt), redraw(), cancelReveal(), objects[]}.
import {createConsoles} from './role1.hangar.consoles-v4.js';
export function createStage(ctx){
  return createConsoles(ctx);
}
