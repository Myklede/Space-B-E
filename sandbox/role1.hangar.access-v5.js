// v5 part "access" (owner: access agent). Stub: does nothing yet.
// Contract: createAccess(ctx) returns {update(dt,time,platforms), poseCrew?(holder,crewTargetY,params), objects[]}.
// It may add camera actions with ctx.actions[key]=fn and ctx.cameraGui.add(ctx.actions,key).
export function createAccess(){
  return {update(){},objects:[]};
}
