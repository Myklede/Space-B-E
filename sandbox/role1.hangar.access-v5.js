// v5 part "access" (owner: access agent): getting people to the ship, visibly.
// - elevator group mirrored to the front-right corner (data only, access.json);
// - fixed stair tower on the bl slot face and deck-riding stairs along the fr slot face (data only);
// - telescoping crew access arm + white room on the stair tower, posed here with its floor ~1.1 m below the capsule hatch
//   (any height: a caged ladder joins it to the stair-tower landings above and below),
//   its tip stopping at the real hull (axial outline + radial boosters) of the current builder ship.
// Contract: createAccess(ctx) returns {update(dt,time,platforms), poseCrew(holder,crewTargetY,params), objects[]}.
const ML_TOP=7;
const DEFAULT_ARM={root:[-9.2,-1.1],direction:[1,0,0],tipLocal:2.5,extensionRange:[2.4,6.6],halfWidth:.9,cabinHeight:2.5};

// Largest hull radius (axial stack) between ship-local heights h0..h1.
export function hullRadius(ship,h0,h1){
  let r=0;
  for(const s of ship?.hull??[]){
    if(s.y1<h0||s.y0>h1)continue;
    for(const h of [Math.max(h0,s.y0),Math.min(h1,s.y1)]){const t=s.y1>s.y0?(h-s.y0)/(s.y1-s.y0):0;r=Math.max(r,s.r0+(s.r1-s.r0)*t);}
  }
  for(const e of ship?.entries??[]){
    if(e.attach!=='axial')continue;
    const profile=e.outline?.profile;
    if(profile){for(const p of profile)if(p.y>=h0-.05&&p.y<=h1+.05)r=Math.max(r,p.r);}
    else if(e.y<=h1&&e.y+e.height>=h0)r=Math.max(r,e.radius??0);
  }
  return r;
}
// Radial parts (boosters, pods, fins) as rotated boxes in the hall plane. Angle 0 = +X, 90 = -Z (three.js rotation.y).
function radialBoxes(ship,h0,h1){
  const out=[];
  for(const e of ship?.entries??[]){
    const o=e.outline;if(e.attach!=='radial'||!o||o.y1<h0||o.y0>h1)continue;
    const a=(e.angle??0)*Math.PI/180;
    out.push({c:Math.cos(a),s:Math.sin(a),x0:o.centerRadius-o.radialHalf,x1:o.centerRadius+o.radialHalf,t:o.tangentHalf});
  }
  return out;
}
// World x of the white-room seal for an arm floor at world Y: walk the tip inwards from the root until the white room
// (front face and body) would touch the hull or a radial part. `fallbackRadius` is used without real-ship data.
export function armTipX(ship,floorY,arm=DEFAULT_ARM,fallbackRadius=1.25){
  const h0=floorY-ML_TOP,h1=h0+arm.cabinHeight;
  const R=(ship?hullRadius(ship,h0,h1):fallbackRadius)+.06,boxes=ship?radialBoxes(ship,h0,h1):[];
  const [rootX,zc]=arm.root,hw=arm.halfWidth;
  const blocked=(x,z)=>{
    if(x*x+z*z<R*R)return true;
    for(const b of boxes){const lx=x*b.c-z*b.s,lz=x*b.s+z*b.c;if(lx>b.x0-.06&&lx<b.x1+.06&&Math.abs(lz)<b.t+.06)return true;}
    return false;
  };
  const clear=x=>{for(let dx=0;dx<=arm.tipLocal;dx+=.25)for(let z=zc-hw;z<=zc+hw+1e-6;z+=.15)if(blocked(x-dx,z))return false;return true;};
  for(let x=-.05;x>rootX+arm.extensionRange[0]+arm.tipLocal;x-=.04)if(clear(x))return x;
  return rootX+arm.extensionRange[0]+arm.tipLocal;
}
export function armExtension(tipX,arm=DEFAULT_ARM){
  const [lo,hi]=arm.extensionRange;return Math.min(hi,Math.max(lo,tipX-arm.root[0]-arm.tipLocal));
}
// Capsule hatch height (world Y) of the real ship, or null.
export function hatchHeight(ship){
  const cap=ship?.entries?.find(e=>e.def?.flags?.capsule);
  return cap?ML_TOP+cap.y+cap.height*.45:null;
}
export function capsuleTop(ship){
  const cap=ship?.entries?.find(e=>e.def?.flags?.capsule);
  return cap?ML_TOP+cap.y+cap.height:null;
}
const LANDINGS=[0,5.5,11,17,23,29,35,41,47,53,59,65,71];
// White-room floor for a hatch at world Y: hatch centre 1.1 m above the floor (snapped onto a stair-tower landing when
// that keeps the hatch 0.95..1.25 m above it), always >= 1.5 m below the capsule top and above the launcher deck.
export function armFloor(hatch,capTop=null,arm=DEFAULT_ARM){
  const landings=arm.landings??LANDINGS;
  let f=hatch-(arm.hatchOffset??1.1);
  const near=landings.reduce((a,b)=>Math.abs(b-f)<Math.abs(a-f)?b:a);
  if(hatch-near>=.95&&hatch-near<=1.25)f=near;
  if(capTop!=null)f=Math.min(f,capTop-1.5);
  return Math.round(Math.min(68,Math.max(7.6,f))*100)/100;
}
// Tower landings bracketing a floor: the caged ladder runs from `below` to `above`.
export function ladderSpan(floor,arm=DEFAULT_ARM){
  const landings=arm.landings??LANDINGS;
  const below=[...landings].reverse().find(l=>l<=floor+1e-6)??0,above=landings.find(l=>l>below+1e-6)??below+6;
  return {below,above};
}

export function createAccess(ctx){
  const {layout,params,actions,fragment={}}=ctx;
  const arm={...DEFAULT_ARM,...(fragment.crewArm??{})};
  params.armFollowsShip??=true;
  const state={y:null,floor:null,extension:arm.extensionRange[0],target:arm.extensionRange[0],tipX:null,key:'',hatch:null,ladder:null};
  let last=performance.now(),revision;

  const baseArm=actions.arm;
  // Same action the GUI button calls. The arm hangs on the fixed stair tower, so it is not snapped to a deck level: the
  // white-room floor goes ~1.1 m below the hatch (capsule hatch, or the GUI value when "follows ship" is off).
  // The base action still runs (it keeps crewTarget, used by nothing else here, at the nearest deck level).
  actions.arm=()=>{
    const ship=params.realShip?ctx.ship():null;
    if(params.armFollowsShip&&ship){const h=hatchHeight(ship);if(h!=null)params.hatchHeight=Math.round(h*10)/10;}
    state.hatch=params.hatchHeight;
    state.floor=armFloor(params.hatchHeight,params.armFollowsShip?capsuleTop(ship):null,arm);
    baseArm?.();
  };
  function targetExtension(y){
    const ship=params.realShip?ctx.ship():null;
    if(!params.armFollowsShip){const [lo,hi]=arm.extensionRange;return lo+(hi-lo)*Math.min(1,Math.max(0,(params.extension??0)/2));}
    const key=[y,ship?.revision??'none',params.realShip,params.radius].join('|');
    if(key!==state.key){state.key=key;state.tipX=armTipX(ship,y,arm,layout.radii?.[params.radius]??1.25);}
    return armExtension(state.tipX,arm);
  }
  function poseCrew(holder,crewTargetY,p){
    const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
    const y=state.floor??crewTargetY;
    holder.position.set(arm.root[0],y,arm.root[1]);
    const ladder=holder.getObjectByName(arm.ladderNode??'ladder');
    if(ladder){const span=ladderSpan(y,arm);state.ladder=span;ladder.position.y=span.below-y;ladder.scale.y=(span.above-span.below)/(arm.ladderLength??6);}
    const extend=holder.getObjectByName(arm.extendNode??'extend');if(!extend)return;
    // A new height: the arm arrives retracted, then telescopes out to the hull (about 1.5 s).
    if(y!==state.y){state.y=y;state.extension=arm.extensionRange[0];}
    state.target=targetExtension(y);
    state.extension+=(state.target-state.extension)*(1-Math.exp(-3*dt));
    extend.position.x=state.extension;
  }
  function update(){
    const ship=ctx.ship();
    if(params.armFollowsShip&&ship&&ship.revision!==revision){revision=ship.revision;actions.arm();}
    if(state.floor==null)actions.arm();
  }

  // Camera presets for the access details.
  actions.crewView=()=>{const y=state.floor??state.y??35;ctx.look([-2.2,y+3.6,-9.4],[-4.8,y+1.1,-1],58);};
  actions.stairsView=()=>ctx.look([-3.6,5.5,-13.5],[-11.6,15.5,-1.4],58);
  actions.frStairsView=()=>ctx.look([-9.5,20.5,-18],[-.8,17.5,-9.5],58);
  actions.accessOverview=()=>ctx.look([-20.6,50,-20.6],[2,24,2],66);
  const folder=ctx.gui.addFolder('Access · stairs & crew arm');
  folder.add(params,'armFollowsShip').name('Arm follows ship hatch').onChange(()=>{state.key='';actions.arm();});
  folder.add(actions,'arm').name('Arm to hatch height');
  for(const [key,label] of Object.entries({crewView:'Crew arm close-up',stairsView:'Stair tower',frStairsView:'Deck stairs (fr)',accessOverview:'High diagonal overview',elevatorView:'Elevator (front-right)'}))folder.add(actions,key).name(label);
  folder.close();

  return {update,poseCrew,objects:[],state,arm};
}
