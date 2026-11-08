// Standalone inspection only. Claude: adapt this instancing pattern inside the game's single loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { BlendFunction, BloomEffect, ChromaticAberrationEffect, Effect, EffectComposer, EffectPass, NoiseEffect, RenderPass, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';
import GUI from 'lil-gui';
import {automaticResolution,filterMaterial} from './role1.hangar.render.js';
import {createCollars} from './role1.hangar.collars.js';
import {createConsoles} from './role1.hangar.consoles.js';

const BASE='/assets/models/builder/hangar/';
const layout=await fetch(BASE+'layout.json').then(r=>{if(!r.ok)throw Error('layout '+r.status);return r.json();});
document.querySelector('header p').innerHTML='Real builder ship · 11 adaptive collars · 4 engineering consoles<br>Orbit: drag / wheel. Walk: WASD + drag. Sit at a console from the menu, then turn around.';
const scene=new THREE.Scene(); scene.background=new THREE.Color('#111719'); scene.fog=new THREE.FogExp2('#111719',.009);
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',stencil:false,depth:false,logarithmicDepthBuffer:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,1)); renderer.setSize(innerWidth,innerHeight); renderer.toneMapping=THREE.NoToneMapping; renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMappingExposure=.9;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;document.body.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.08,250);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.maxDistance=140;
const hemi=new THREE.HemisphereLight(0xcbd9dc,0x484335,.32);scene.add(hemi);
const flatSun=new THREE.DirectionalLight(0xffefd6,0);flatSun.position.set(-15,65,-18);scene.add(flatSun);
const rig=[];
for(const [position,target,intensity,angle] of [
  [[-12,73,-8],[-10,0,0],4000,.48],[[12,73,8],[10,0,0],4000,.48],
  [[-6,18,-12],[0,26,0],650,.5],[[6,54,-8],[0,42,0],1200,.5],
]) { const light=new THREE.SpotLight(0xe7f0ff,intensity,110,angle,.65,2);light.position.fromArray(position);light.target.position.fromArray(target);light.userData.power=intensity;scene.add(light,light.target);rig.push(light); }
// Baked module AO supplies contact shadows without rendering the entire hall twice.
// Fixed four-spot count avoids shader recompilation; none cast runtime shadows.
const pmrem=new THREE.PMREMGenerator(renderer);
const hdr=await new HDRLoader().loadAsync('/assets/polyhaven/hdri/small_hangar_01_1k.hdr');
scene.environment=pmrem.fromEquirectangular(hdr).texture;scene.environmentIntensity=.35;hdr.dispose();pmrem.dispose();
class FiniteGuardEffect extends Effect {constructor(){super('FiniteGuardEffect',`void mainImage(const in vec4 inputColor,const in vec2 uv,out vec4 outputColor){vec3 c=inputColor.rgb;if(any(isnan(c))||any(isinf(c)))c=vec3(0.0);outputColor=vec4(min(c,vec3(1000.0)),inputColor.a);}`,{blendFunction:BlendFunction.SET});}}
const composer=new EffectComposer(renderer,{frameBufferType:THREE.HalfFloatType});
const bloom=new BloomEffect({mipmapBlur:true,luminanceThreshold:1.35,luminanceSmoothing:.3,intensity:.7,radius:.72});
const tone=new ToneMappingEffect({mode:ToneMappingMode.ACES_FILMIC});
const grain=new NoiseEffect({blendFunction:BlendFunction.OVERLAY,premultiply:false});grain.blendMode.opacity.value=.06;
for(const pass of [new RenderPass(scene,camera),new EffectPass(camera,new FiniteGuardEffect()),new EffectPass(camera,bloom,tone),new EffectPass(camera,new SMAAEffect({preset:SMAAPreset.HIGH})),new EffectPass(camera,new ChromaticAberrationEffect({offset:new THREE.Vector2(.00055,.00045),radialModulation:true,modulationOffset:.4})),new EffectPass(camera,new VignetteEffect({offset:.36,darkness:.5}),grain)])composer.addPass(pass);
const loader=new GLTFLoader();const draco=new DRACOLoader();draco.setDecoderPath('/assets/draco/');draco.setWorkerLimit(1);loader.setDRACOLoader(draco);
const assets=new Map(),materials=new Map();
// Sequential decode avoids competing with Claude for many CPU workers.
for(const [id,def]of Object.entries(layout.modules)){
  const gltf=await loader.loadAsync(BASE+def.file);
  gltf.scene.traverse(o=>{if(o.isMesh){const key=o.material.name;if(materials.has(key))o.material=materials.get(key);else {o.material=filterMaterial(o.material,renderer,id.endsWith('_far')||id.endsWith('_lod'));materials.set(key,o.material);}}});
  assets.set(id,gltf.scene);
}
const params={height:36,radius:'m',lod:true,wireframe:false,colliders:false,blockout:new URLSearchParams(location.search).has('blockout'),walk:false,level:5,hatchHeight:38,extension:0,door:0,trolley:0,hook:5,cutaway:true,gameLook:true,exposure:.9};
params.renderScale=1;params.autoResolution=true;params.realShip=true;params.preset='Reliable';
let realShip=null,shipData=null,consoleBank=null;
const collars=layout.collar?createCollars(scene,assets.get(layout.collar.plateModule),layout):null;
function setResolution(scale){params.renderScale=scale;renderer.setPixelRatio(Math.min(devicePixelRatio,1)*scale);composer.setSize(innerWidth,innerHeight);}
setResolution(params.renderScale);
const auto=automaticResolution(setResolution);
const farMaterials=new Map();
function farMaterial(m){if(!farMaterials.has(m))farMaterials.set(m,filterMaterial(m,renderer,true));return farMaterials.get(m);}
function setLook(){hemi.intensity=params.gameLook?.32:1.5;flatSun.intensity=params.gameLook?0:2.3;for(const light of rig)light.intensity=params.gameLook?light.userData.power:0;scene.environmentIntensity=params.gameLook?.35:.55;scene.fog=params.gameLook?new THREE.FogExp2('#111719',.009):null;scene.background.set(params.gameLook?'#111719':'#26343c');renderer.toneMapping=params.gameLook?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;}
let capture=null,captureResult=null;
function capturePerformance(){if(capture)return capture.promise;let resolve;const promise=new Promise(r=>resolve=r);capture={start:performance.now(),frames:[],resolve,promise};return promise;}
const hall=new THREE.Group();scene.add(hall);
let batches=[],roots=[],platforms=[],elevator,crew,crane,door,colliderLines;
let platformMode='close',waveStart=-10,elevatorTarget=0,crewTarget=35;
const mat4=new THREE.Matrix4();
const lodChoices=new Map(),lastLodCamera=new THREE.Vector3();let lastLodCheck=0;

function chosen(o){for(let n=o;n;n=n.parent)if(n.name.startsWith('slot_cut__'))return false;return true;}
function build(){
  const offsets=new Map(platforms.map(h=>[h.userData.placement.id,h.userData.offset]));
  const cabY=elevator?.getObjectByName('pose_cab')?.position.y;
  for(const b of batches){hall.remove(b.mesh);b.mesh.dispose();}batches=[];roots=[];platforms=[];
  const map=new Map();
  for(const placement of layout.placements){
    // Cutaway removes only the front cladding/door, not the lattice or rear wall.
    if(params.cutaway&&((placement.module==='wall_bay'&&placement.position[2]===-22)||placement.module==='high_bay_door'))continue;
    // Keep nearby access levels detailed even above 30 m; overview retains the height rule.
    const distance=camera.position.distanceTo(new THREE.Vector3(...placement.position));
    const far=params.lod&&distance>(lodChoices.has(placement.id)?(lodChoices.get(placement.id)?19:25):22);lodChoices.set(placement.id,far);
    let id=far&&placement.lod?placement.lod:placement.module;
    if(placement.module==='platform_half')id=far?'platform_v3_far':'platform_v3';
    if(placement.module==='catwalk'&&far)id='catwalk_far';
    const object=assets.get(id).clone(true), holder=new THREE.Group();holder.add(object);
    holder.position.fromArray(placement.position);holder.rotation.set(...placement.rotation.map(THREE.MathUtils.degToRad));holder.scale.fromArray(placement.scale);roots.push(holder);
    holder.userData.placement=placement;
    if(placement.dynamic==='platform'){holder.userData.offset=offsets.get(placement.id)??(platformMode==='retract'||collars?.fits[placement.level]?.retract?4:0);platforms.push(holder);}
    if(placement.dynamic==='elevator'){elevator=holder;if(cabY!==undefined)elevator.getObjectByName('pose_cab').position.y=cabY;}
    if(placement.dynamic==='crewArm')crew=holder;
    if(placement.dynamic==='crane')crane=holder;
    if(placement.dynamic==='door')door=holder;
    if(placement.module==='lamp'){const lens=object.getObjectByName('body');if(lens){const close=distance<20;const key='lamp-lens-'+close;if(!materials.has(key)){const m=lens.material.clone();m.name=key;m.emissiveIntensity=close?1.8:.35;materials.set(key,m);}lens.material=materials.get(key);}}
    holder.updateMatrixWorld(true);
    object.traverse(node=>{if(!node.isMesh||!chosen(node))return;
      const key=id+'/'+node.name+'/'+node.material.name+(far?'/far':'/near');let b=map.get(key);if(!b){b={geometry:node.geometry,material:far?farMaterial(node.material):node.material,nodes:[],dynamic:false};map.set(key,b);}b.nodes.push(node);b.dynamic ||= Boolean(placement.dynamic);
    });
  }
  for(const b of map.values()){
    b.mesh=new THREE.InstancedMesh(b.geometry,b.material,b.nodes.length);b.mesh.frustumCulled=false;b.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);hall.add(b.mesh);batches.push(b);
  }
  for(const m of materials.values())m.wireframe=params.wireframe;
  update(0,performance.now()/1000,true);updateColliders();lastLodCamera.copy(camera.position);lastLodCheck=performance.now();
}

const rocket=new THREE.Group();scene.add(rocket);
const rocketWhite=new THREE.MeshStandardMaterial({color:0xebeeea,roughness:.55,metalness:.32});
rocketWhite.roughness=.32;rocketWhite.metalness=.18;
const tankOrange=new THREE.MeshStandardMaterial({color:0xb96818,roughness:.75,metalness:.05});
const seamMat=new THREE.MeshStandardMaterial({color:0x42484a,roughness:.65,metalness:.4});
function makeRocket(){
  rocket.visible=!params.realShip||!realShip;
  if(realShip)realShip.object.visible=params.realShip;
  for(const child of [...rocket.children]){child.geometry.dispose();rocket.remove(child);}
  const r=layout.radii[params.radius],nose=Math.min(3,params.height*.15),body=params.height-nose;
  const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(r,r,body,48),rocketWhite);cylinder.position.y=layout.ML_TOP+body/2;rocket.add(cylinder);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(r,nose,48),rocketWhite);cone.position.y=layout.ML_TOP+body+nose/2;rocket.add(cone);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(r+.008,r+.008,body*.4,48),tankOrange);band.position.y=layout.ML_TOP+body*.59;rocket.add(band);
  for(const h of [.08,.35,.8,.96]){const ring=new THREE.Mesh(new THREE.CylinderGeometry(r+.014,r+.014,.055,48),seamMat);ring.position.y=layout.ML_TOP+body*h;rocket.add(ring);}
  for(const side of [-1,1]){const line=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,body,6),seamMat);line.position.set(side*r*.45,layout.ML_TOP+body/2,-r*.9);rocket.add(line);}
  const lightHeight=params.realShip&&shipData?shipData.top:params.height;rig[2].target.position.y=7+lightHeight*.35;rig[3].position.y=Math.min(76,12+lightHeight*.8);rig[3].target.position.y=7+lightHeight*.72;
  refit();
}
// 1.8 m scale witness, intentionally a neutral mannequin rather than an astronaut asset.
const witness=new THREE.Group();const wm=new THREE.MeshStandardMaterial({color:0xeab344,roughness:.65});
for(const [size,pos] of [[[.42,.65,.24],[0,1.15,0]],[[.25,.25,.25],[0,1.67,0]],[[.15,.8,.18],[-.13,.4,0]],[[.15,.8,.18],[.13,.4,0]],[[.12,.65,.13],[-.29,1.1,0]],[[.12,.65,.13],[.29,1.1,0]]]){let m=new THREE.Mesh(new THREE.BoxGeometry(...size),wm);m.position.fromArray(pos);witness.add(m);}witness.position.set(3,0,-10);scene.add(witness);
const ropes=new THREE.Group();scene.add(ropes);const ropeMat=new THREE.MeshStandardMaterial({color:0x282d30});
for(const x of [-.35,.35]){const rope=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1,6),ropeMat);rope.userData.x=x;ropes.add(rope);}

function update(dt,time,force=false){
  const top=layout.ML_TOP+params.height;
  for(const h of platforms){const p=h.userData.placement,l=layout.levels[p.level];const target=platformMode==='retract'||(params.realShip&&shipData?collars?.fits[p.level]?.retract:l.y>top)?l.retracted:l.closed[params.radius];
    const delay=(10-p.level)*.045;
    if(time-waveStart>=delay)h.userData.offset=THREE.MathUtils.damp(h.userData.offset,target,5.5,dt);
    h.position.x=p.side*h.userData.offset;
  }
  if(elevator){const cab=elevator.getObjectByName('pose_cab');cab.position.y=THREE.MathUtils.damp(cab.position.y,elevatorTarget,1.8,dt);}
  if(crew){crew.position.set(-8,crewTarget,0);crew.getObjectByName('extend').position.x=4+params.extension;}
  if(crane){crane.getObjectByName('pose_trolley').position.x=params.trolley;crane.getObjectByName('pose_hook').position.y=-params.hook;
    for(const r of ropes.children){r.position.set(params.trolley+r.userData.x,75-params.hook/2,0);r.scale.y=params.hook;}}
  if(door)door.getObjectByName('pose_door').position.y=params.door;
  for(const root of roots)if(force||root.userData.placement.dynamic)root.updateMatrixWorld(true);
  for(const b of batches)if(force||b.dynamic){b.nodes.forEach((node,i)=>b.mesh.setMatrixAt(i,node.matrixWorld));b.mesh.instanceMatrix.needsUpdate=true;}
  if(params.colliders)updateColliders();
  collars?.update(dt,platforms);consoleBank?.update(dt);
}

function boxes(){return layout.colliders.map(c=>{const center=[...c.center];if(c.dynamic==='platform'){const h=platforms.find(h=>h.userData.placement.level===c.level&&h.userData.placement.side===c.side);center[0]+=(h?.userData.offset??0)*c.side;}if(c.dynamic==='door'){if(params.cutaway)return null;center[1]+=params.door;}return {...c,center};}).filter(Boolean);}
function updateColliders(){
  if(colliderLines){scene.remove(colliderLines);colliderLines.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  colliderLines=new THREE.Group();colliderLines.visible=params.colliders;
  if(params.colliders)for(const c of boxes()){const box=new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...c.center),new THREE.Vector3(...c.size));colliderLines.add(new THREE.Box3Helper(box,c.decorative?0x7799ff:0x66ffcc));}
  scene.add(colliderLines);
}
function look(pos,target,fov=70){params.walk=false;controls.enabled=true;camera.fov=fov;camera.position.set(...pos);controls.target.set(...target);camera.updateProjectionMatrix();controls.update();captureResult=null;if(params.lod)build();}
const actions={
  ground:()=>look([0,1.7,-20],[0,30,0]),
  overview:()=>look([0,39,-74],[0,38,0],68),
  crewView:()=>look([-11,crewTarget+3,-8],[-1,crewTarget+.8,-1],65),
  elevatorView:()=>look([-12,elevatorTarget+2,-16],[-17,elevatorTarget+1,-10],65),
  platformView:()=>look([7,37,-8],[5,35,0],65),
  collarView:()=>look([3.6,37,-4],[1.25,35,0],62),
  ceilingView:()=>look([0,42,-10],[0,76,0],80),
  capture:()=>{capturePerformance();},
  orbit:()=>{params.walk=false;controls.enabled=true;},
  retract:()=>{platformMode='retract';waveStart=performance.now()/1000;},
  close:()=>{platformMode='close';waveStart=performance.now()/1000;},
  elevator:()=>{elevatorTarget=params.level===0?0:layout.levels[params.level-1].y;},
  arm:()=>{const l=layout.levels.reduce((a,b)=>Math.abs(b.y-params.hatchHeight)<Math.abs(a.y-params.hatchHeight)?b:a);crewTarget=l.y;params.extension=Math.min(2,Math.max(0,2-layout.radii[params.radius]));},
};
const gui=new GUI({title:'HIGH BAY · INSPECT',width:290});
const lookGui=gui.addFolder('Lighting & performance');lookGui.add(params,'gameLook').name('Game look').onChange(setLook);lookGui.add(params,'exposure',.4,2.5,.05).onChange(v=>renderer.toneMappingExposure=v);lookGui.add(actions,'capture').name('Capture performance (5 s)');
lookGui.add(params,'autoResolution').name('Automatic resolution');
lookGui.add(params,'renderScale',.8,1,.1).name('Render scale').onChange(setResolution);
const shipGuiReal=gui.addFolder('Real ship / builder console');
shipGuiReal.add(params,'realShip').name('Real ship (fallback toggle)').onChange(()=>{makeRocket();refit();});
const shipGui=gui.addFolder('Vehicle & service platforms');shipGui.add(params,'height',8,60,1).name('Ship height (m)').onChange(makeRocket);shipGui.add(params,'radius',['s','m','l']).name('Stack radius').onChange(()=>{makeRocket();build();});shipGui.add(actions,'retract').name('Retract · top down');shipGui.add(actions,'close').name('Close platforms');
const moveGui=gui.addFolder('Access & handling');moveGui.add(params,'level',0,11,1).name('Elevator stop');moveGui.add(actions,'elevator').name('Move elevator');moveGui.add(params,'hatchHeight',11,71,1).name('Hatch absolute Y');moveGui.add(actions,'arm').name('Extend arm to nearest level');moveGui.add(params,'extension',0,2,.1);moveGui.add(params,'trolley',-17,17,.1);moveGui.add(params,'hook',2,65,.1);moveGui.add(params,'door',0,70,.5);
const cameraGui=gui.addFolder('Camera');for(const [key,label]of Object.entries({ground:'Ground look-up',overview:'Overview',crewView:'Crew level',elevatorView:'Elevator',platformView:'Platform close-up',collarView:'Collar',ceilingView:'Ceiling vault',orbit:'Free orbit'}))cameraGui.add(actions,key).name(label);cameraGui.add(params,'walk').name('First person · WASD + drag').onChange(v=>{controls.enabled=!v;});
const debugGui=gui.addFolder('Diagnostics');debugGui.add(params,'lod').name('LOD above 30 m').onChange(build);debugGui.add(params,'wireframe').onChange(v=>{scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.wireframe=v;});});debugGui.add(params,'colliders').onChange(updateColliders);debugGui.add(params,'cutaway').name('Front-wall cutaway').onChange(build);debugGui.add(params,'blockout').name('Grey-box massing').onChange(v=>{hall.visible=!v;blockout.visible=v;for(const m of collars?.batches??[])m.visible=!v;for(const m of consoleBank?.objects??[])m.visible=!v;});

const blockout=new THREE.Group();scene.add(blockout);const grey=new THREE.MeshStandardMaterial({color:0x879299});
for(const c of layout.colliders.filter(c=>['floor','tower','ml','platform'].includes(c.kind))){const m=new THREE.Mesh(new THREE.BoxGeometry(...c.size),grey);m.position.fromArray(c.center);blockout.add(m);}blockout.visible=params.blockout;hall.visible=!params.blockout;
const keys=new Set();window.addEventListener('keydown',e=>{if(!/INPUT|TEXTAREA/.test(document.activeElement.tagName))keys.add(e.code);});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
let dragging=false;renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;renderer.domElement.setPointerCapture(e.pointerId);});window.addEventListener('pointerup',()=>dragging=false);
renderer.domElement.addEventListener('pointermove',e=>{if(!params.walk||!dragging)return;const q=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');q.y-=e.movementX*.003;q.x=THREE.MathUtils.clamp(q.x-e.movementY*.003,-1.5,1.5);camera.quaternion.setFromEuler(q);});
function walk(dt){
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0));
  const move=new THREE.Vector3().addScaledVector(forward,Number(keys.has('KeyW'))-Number(keys.has('KeyS'))).addScaledVector(right,Number(keys.has('KeyD'))-Number(keys.has('KeyA')));
  if(move.lengthSq()>0)move.normalize().multiplyScalar((keys.has('ShiftLeft')?7:3)*dt);
  const solid=boxes();
  // Axis separation plus 0.30 m player radius. Tower/stair envelopes deliberately conservative.
  for(const axis of ['x','z']){const p=camera.position.clone();p[axis]+=move[axis];const blocked=solid.some(c=>{if(c.kind==='floor')return false;const [x,y,z]=c.center,[sx,sy,sz]=c.size;return p.x+.3>x-sx/2&&p.x-.3<x+sx/2&&p.z+.3>z-sz/2&&p.z-.3<z+sz/2&&p.y>y-sy/2&&p.y-1.65<y+sy/2;});if(!blocked)camera.position[axis]=p[axis];}
  camera.position.y=1.7;
}
function refit(){
  const r=layout.radii[params.radius],h=params.height;
  const entries=params.realShip&&shipData?shipData.entries:[{attach:'axial',y:0,height:h,radius:r}];
  const nose=Math.min(3,h*.15);const hull=params.realShip&&shipData?shipData.hull:[{y0:0,y1:h-nose,r0:r,r1:r},{y0:h-nose,y1:h,r0:r,r1:0}];
  collars?.fit(entries,hull);
}
try{
  const module=await import('./role1.hangar.ship.js');
  realShip=module.createShip(data=>{shipData=data;params.height=data.top;Object.assign(params,realShip.selectedShapes);for(const c of shipGuiReal.controllers)c.updateDisplay();rig[2].target.position.y=7+data.top*.35;rig[3].position.y=Math.min(76,12+data.top*.8);rig[3].target.position.y=7+data.top*.72;refit();consoleBank?.redraw();});scene.add(realShip.object);
  await realShip.rebuild();
  shipGuiReal.add(params,'preset',Object.keys(module.presets)).onChange(async name=>{await realShip.preset(name);makeRocket();build();});
  for(const section of ['nose','body','tail']){params[section]=realShip.selectedShapes[section];shipGuiReal.add(params,section,{'Current custom layout':'__custom__',...Object.fromEntries(module.sections[section].shapes.map(sh=>[sh.name??sh.id,sh.id]))}).onChange(async id=>{await realShip.shape(section,id);makeRocket();build();});}
}catch(error){params.realShip=false;console.warn('[sandbox] real ship unavailable, cylinder fallback:',error);}
// The builder code the real ship uses imports the game's graphics module, which adds its own full-screen canvas on top
// of this page and swallows every drag and wheel event. The sandbox never renders with it, so hide it.
for(const c of document.querySelectorAll('canvas'))if(c!==renderer.domElement){c.style.display='none';c.style.pointerEvents='none';}
consoleBank=createConsoles({scene,assets,layout,camera,controls,gui,params,ship:()=>shipData,look,builderFolder:shipGuiReal,getShipController:()=>realShip});
makeRocket();refit();build();actions.ground();document.getElementById('loading').remove();
let last=performance.now(),frames=0,fps=0,since=last;
const info=document.getElementById('info');
renderer.info.autoReset=false;
function tick(now){
  requestAnimationFrame(tick);const frameMs=now-last;auto.update(now,frameMs,params.autoResolution);const dt=Math.min(.1,frameMs/1000);last=now;
  if(params.lod&&now-lastLodCheck>750&&camera.position.distanceToSquared(lastLodCamera)>16){
    lastLodCheck=now;lastLodCamera.copy(camera.position);
    if(layout.placements.some(p=>{if(params.cutaway&&((p.module==='wall_bay'&&p.position[2]===-22)||p.module==='high_bay_door'))return false;const d=(camera.position.x-p.position[0])**2+(camera.position.y-p.position[1])**2+(camera.position.z-p.position[2])**2;return Boolean(lodChoices.get(p.id))!==(d>(lodChoices.get(p.id)?19**2:25**2));}))build();
  }
  update(dt,now/1000);if(params.walk)walk(dt);else if(controls.enabled)controls.update();renderer.info.reset();
  if(params.gameLook)composer.render(dt);else renderer.render(scene,camera);
  if(capture){capture.frames.push(frameMs);if(now-capture.start>=5000){const samples=capture.frames;captureResult={seconds:(now-capture.start)/1000,frames:samples.length,average:samples.length*1000/samples.reduce((a,b)=>a+b,0),minimum:1000/Math.max(...samples),p95FrameMs:[...samples].sort((a,b)=>a-b)[Math.floor(samples.length*.95)]};capture.resolve(captureResult);capture=null;}}
  frames++;if(now-since>=1000){fps=frames*1000/(now-since);frames=0;since=now;
    info.textContent=`${params.lod?'DISTANCE LOD':'FULL DETAIL'} | ${fps.toFixed(1)} FPS | ${params.gameLook?'GAME LOOK':'FLAT'}\n${renderer.info.render.triangles.toLocaleString()} triangles · ${renderer.info.render.calls} total calls · ${batches.length} structure batches\nRender ${renderer.domElement.width} × ${renderer.domElement.height} (${params.renderScale.toFixed(2)} scale) | ${renderer.info.memory.geometries} geometries / ${renderer.info.memory.textures} textures\n${params.realShip?params.preset:'Cylinder fallback'} · ship ${(params.realShip&&shipData?shipData.top:params.height).toFixed(2)} m · ${platformMode}\nBefore/After: 2026-11-08 · calm steel v3 (?v=2 for backup look)\n${capture?'Capturing 5 seconds…':captureResult?`5 s: avg ${captureResult.average.toFixed(1)} / min ${captureResult.minimum.toFixed(1)} FPS`:'Performance: press Capture (5 s)'}`;
  }
}
requestAnimationFrame(tick);window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});
// Inspection hooks only; no game event/state/API changes.
window.hangarInspect={ready:true,layout,params,actions,build,look,makeRocket,scene,camera,renderer,setLook,setResolution,collars,consoleBank,get realShip(){return realShip;},get shipData(){return shipData;},refit,capturePerformance,platforms:()=>platforms,roots:()=>roots,stats:()=>({triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,fps,structuralCalls:batches.length,kitCalls:batches.length+(collars?.batches.length??0)+(consoleBank?5:0)}),settle:()=>update(100,performance.now()/1000+10)};
