// Standalone inspection only. Claude: adapt this instancing pattern inside the game's single loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import GUI from 'lil-gui';

const BASE='/assets/models/builder/hangar/';
const layout=await fetch(BASE+'layout.json').then(r=>{if(!r.ok)throw Error('layout '+r.status);return r.json();});
const scene=new THREE.Scene(); scene.background=new THREE.Color('#26343c'); scene.fog=new THREE.Fog('#26343c',60,170);
const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setSize(innerWidth,innerHeight); renderer.setClearColor('#26343c'); renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.45; document.body.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.08,250);
const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.maxDistance=140;
scene.add(new THREE.HemisphereLight(0xe2f3ff,0x3c3b31,1.5));
const sun=new THREE.DirectionalLight(0xffefd6,2.3);sun.position.set(-15,65,-18);scene.add(sun);
for(const x of [-12,12]){const light=new THREE.PointLight(0xc0e1ff,450,65,2);light.position.set(x,27,-9);scene.add(light);}
const loader=new GLTFLoader();const draco=new DRACOLoader();draco.setDecoderPath('/assets/draco/');draco.setWorkerLimit(1);loader.setDRACOLoader(draco);
const assets=new Map(),materials=new Map();
// Sequential decode avoids competing with Claude for many CPU workers.
for(const [id,def]of Object.entries(layout.modules)){
  const gltf=await loader.loadAsync(BASE+def.file);
  gltf.scene.traverse(o=>{if(o.isMesh){const key=o.material.name;if(materials.has(key))o.material=materials.get(key);else materials.set(key,o.material);}});
  assets.set(id,gltf.scene);
}
const params={height:36,radius:'m',lod:true,wireframe:false,colliders:false,blockout:new URLSearchParams(location.search).has('blockout'),walk:false,level:5,hatchHeight:38,extension:0,door:0,trolley:0,hook:5,cutaway:true};
const hall=new THREE.Group();scene.add(hall);
let batches=[],roots=[],platforms=[],elevator,crew,crane,door,colliderLines;
let platformMode='close',waveStart=-10,elevatorTarget=0,crewTarget=35;
const mat4=new THREE.Matrix4();

function chosen(o){
  for(let n=o;n;n=n.parent){if(n.name.startsWith('slot_cut__')&&n.name!=='slot_cut__'+params.radius)return false;}
  return true;
}
function build(){
  for(const b of batches){hall.remove(b.mesh);b.mesh.dispose();}batches=[];roots=[];platforms=[];
  const map=new Map();
  for(const placement of layout.placements){
    // Cutaway removes only the front cladding/door, not the lattice or rear wall.
    if(params.cutaway&&((placement.module==='wall_bay'&&placement.position[2]===-22)||placement.module==='high_bay_door'))continue;
    const id=params.lod&&placement.position[1]>30&&placement.lod?placement.lod:placement.module;
    const object=assets.get(id).clone(true), holder=new THREE.Group();holder.add(object);
    holder.position.fromArray(placement.position);holder.rotation.set(...placement.rotation.map(THREE.MathUtils.degToRad));holder.scale.fromArray(placement.scale);roots.push(holder);
    holder.userData.placement=placement;
    if(placement.dynamic==='platform'){holder.userData.offset=0;platforms.push(holder);}
    if(placement.dynamic==='elevator')elevator=holder;
    if(placement.dynamic==='crewArm')crew=holder;
    if(placement.dynamic==='crane')crane=holder;
    if(placement.dynamic==='door')door=holder;
    holder.updateMatrixWorld(true);
    object.traverse(node=>{if(!node.isMesh||!chosen(node))return;
      const key=id+'/'+node.name;let b=map.get(key);if(!b){b={geometry:node.geometry,material:node.material,nodes:[]};map.set(key,b);}b.nodes.push(node);
    });
  }
  for(const b of map.values()){
    b.mesh=new THREE.InstancedMesh(b.geometry,b.material,b.nodes.length);b.mesh.frustumCulled=false;b.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);hall.add(b.mesh);batches.push(b);
  }
  for(const m of materials.values())m.wireframe=params.wireframe;
  update(100,performance.now()/1000);updateColliders();
}

const rocket=new THREE.Group();scene.add(rocket);
const rocketWhite=new THREE.MeshStandardMaterial({color:0xebeeea,roughness:.55,metalness:.32});
function makeRocket(){
  for(const child of [...rocket.children]){child.geometry.dispose();rocket.remove(child);}
  const r=layout.radii[params.radius],nose=Math.min(3,params.height*.15),body=params.height-nose;
  const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(r,r,body,48),rocketWhite);cylinder.position.y=layout.ML_TOP+body/2;rocket.add(cylinder);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(r,nose,48),rocketWhite);cone.position.y=layout.ML_TOP+body+nose/2;rocket.add(cone);
}
// 1.8 m scale witness, intentionally a neutral mannequin rather than an astronaut asset.
const witness=new THREE.Group();const wm=new THREE.MeshStandardMaterial({color:0xeab344,roughness:.65});
for(const [size,pos] of [[[.42,.65,.24],[0,1.15,0]],[[.25,.25,.25],[0,1.67,0]],[[.15,.8,.18],[-.13,.4,0]],[[.15,.8,.18],[.13,.4,0]],[[.12,.65,.13],[-.29,1.1,0]],[[.12,.65,.13],[.29,1.1,0]]]){let m=new THREE.Mesh(new THREE.BoxGeometry(...size),wm);m.position.fromArray(pos);witness.add(m);}witness.position.set(3,0,-10);scene.add(witness);
const ropes=new THREE.Group();scene.add(ropes);const ropeMat=new THREE.MeshStandardMaterial({color:0x282d30});
for(const x of [-.35,.35]){const rope=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1,6),ropeMat);rope.userData.x=x;ropes.add(rope);}

function update(dt,time){
  const top=layout.ML_TOP+params.height;
  for(const h of platforms){const p=h.userData.placement,l=layout.levels[p.level];const target=platformMode==='retract'||l.y>top?l.retracted:l.closed[params.radius];
    const delay=(10-p.level)*.045;
    if(time-waveStart>=delay)h.userData.offset=THREE.MathUtils.damp(h.userData.offset,target,5.5,dt);
    h.position.x=p.side*h.userData.offset;
  }
  if(elevator){const cab=elevator.getObjectByName('pose_cab');cab.position.y=THREE.MathUtils.damp(cab.position.y,elevatorTarget,1.8,dt);}
  if(crew){crew.position.set(-8,crewTarget,0);crew.getObjectByName('extend').position.x=4+params.extension;}
  if(crane){crane.getObjectByName('pose_trolley').position.x=params.trolley;crane.getObjectByName('pose_hook').position.y=-params.hook;
    for(const r of ropes.children){r.position.set(params.trolley+r.userData.x,75-params.hook/2,0);r.scale.y=params.hook;}}
  if(door)door.getObjectByName('pose_door').position.y=params.door;
  for(const root of roots)root.updateMatrixWorld(true);
  for(const b of batches){b.nodes.forEach((node,i)=>b.mesh.setMatrixAt(i,node.matrixWorld));b.mesh.instanceMatrix.needsUpdate=true;}
  if(params.colliders)updateColliders();
}

function boxes(){return layout.colliders.map(c=>{const center=[...c.center];if(c.dynamic==='platform'){const h=platforms.find(h=>h.userData.placement.level===c.level&&h.userData.placement.side===c.side);center[0]+=(h?.userData.offset??0)*c.side;}if(c.dynamic==='door'){if(params.cutaway)return null;center[1]+=params.door;}return {...c,center};}).filter(Boolean);}
function updateColliders(){
  if(colliderLines){scene.remove(colliderLines);colliderLines.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  colliderLines=new THREE.Group();colliderLines.visible=params.colliders;
  if(params.colliders)for(const c of boxes()){const box=new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...c.center),new THREE.Vector3(...c.size));colliderLines.add(new THREE.Box3Helper(box,c.decorative?0x7799ff:0x66ffcc));}
  scene.add(colliderLines);
}
function look(pos,target,fov=70){params.walk=false;controls.enabled=true;camera.fov=fov;camera.position.set(...pos);controls.target.set(...target);camera.updateProjectionMatrix();controls.update();}
const actions={
  ground:()=>look([0,1.7,-20],[0,30,0]),
  overview:()=>look([0,39,-74],[0,38,0],68),
  crewView:()=>look([-11,crewTarget+3,-8],[-1,crewTarget+.8,-1],65),
  elevatorView:()=>look([-12,elevatorTarget+2,-16],[-17,elevatorTarget+1,-10],65),
  orbit:()=>{params.walk=false;controls.enabled=true;},
  retract:()=>{platformMode='retract';waveStart=performance.now()/1000;},
  close:()=>{platformMode='close';waveStart=performance.now()/1000;},
  elevator:()=>{elevatorTarget=params.level===0?0:layout.levels[params.level-1].y;},
  arm:()=>{const l=layout.levels.reduce((a,b)=>Math.abs(b.y-params.hatchHeight)<Math.abs(a.y-params.hatchHeight)?b:a);crewTarget=l.y;params.extension=Math.min(2,Math.max(0,2-layout.radii[params.radius]));},
};
const gui=new GUI({title:'HIGH BAY · INSPECT',width:290});
const shipGui=gui.addFolder('Vehicle & service platforms');shipGui.add(params,'height',8,60,1).name('Ship height (m)').onChange(makeRocket);shipGui.add(params,'radius',['s','m','l']).name('Stack radius').onChange(()=>{makeRocket();build();});shipGui.add(actions,'retract').name('Retract · top down');shipGui.add(actions,'close').name('Close platforms');
const moveGui=gui.addFolder('Access & handling');moveGui.add(params,'level',0,11,1).name('Elevator stop');moveGui.add(actions,'elevator').name('Move elevator');moveGui.add(params,'hatchHeight',11,71,1).name('Hatch absolute Y');moveGui.add(actions,'arm').name('Extend arm to nearest level');moveGui.add(params,'extension',0,2,.1);moveGui.add(params,'trolley',-17,17,.1);moveGui.add(params,'hook',2,65,.1);moveGui.add(params,'door',0,70,.5);
const cameraGui=gui.addFolder('Camera');for(const [key,label]of Object.entries({ground:'Ground look-up',overview:'Overview',crewView:'Crew level',elevatorView:'Elevator',orbit:'Free orbit'}))cameraGui.add(actions,key).name(label);cameraGui.add(params,'walk').name('First person · WASD + drag').onChange(v=>{controls.enabled=!v;});
const debugGui=gui.addFolder('Diagnostics');debugGui.add(params,'lod').name('LOD above 30 m').onChange(build);debugGui.add(params,'wireframe').onChange(v=>{for(const m of materials.values())m.wireframe=v;});debugGui.add(params,'colliders').onChange(updateColliders);debugGui.add(params,'cutaway').name('Front-wall cutaway').onChange(build);debugGui.add(params,'blockout').name('Grey-box massing').onChange(v=>{hall.visible=!v;blockout.visible=v;});

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
makeRocket();build();actions.ground();document.getElementById('loading').remove();
let last=performance.now(),frames=0,fps=0,since=last;
const info=document.getElementById('info');
function tick(now){requestAnimationFrame(tick);const dt=Math.min(.1,(now-last)/1000);last=now;update(dt,now/1000);if(params.walk)walk(dt);else controls.update();renderer.render(scene,camera);frames++;if(now-since>=1000){fps=frames*1000/(now-since);frames=0;since=now;info.textContent=`${params.lod?'LOD > 30 m':'FULL DETAIL'}  |  ${fps.toFixed(1)} FPS\n${renderer.info.render.triangles.toLocaleString()} triangles  ·  ${renderer.info.render.calls} calls\n${renderer.info.memory.geometries} geometries  |  ML deck +${layout.ML_TOP} m\nRadius ${params.radius.toUpperCase()} · ship ${params.height} m · ${platformMode}`;}}
requestAnimationFrame(tick);window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
// Inspection hooks only; no game event/state/API changes.
window.hangarInspect={ready:true,layout,params,actions,build,makeRocket,scene,camera,renderer,platforms:()=>platforms,roots:()=>roots,stats:()=>({triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,fps,structuralCalls:batches.length}),settle:()=>update(100,performance.now()/1000+10)};
