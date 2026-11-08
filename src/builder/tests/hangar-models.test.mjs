// Standalone asset-contract checks. No browser, renderer, Git mutation or dependencies.
import assert from 'node:assert/strict';
import {readFileSync,statSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fitCollar} from '../tools/blender/hangar/collarFit.mjs';
import {automaticResolution} from '../../../sandbox/role1.hangar.render.js';
const root='public/assets/models/builder/hangar';
const layout=JSON.parse(readFileSync(path.join(root,'layout.json'),'utf8'));
const original=JSON.parse(readFileSync('src/builder/tools/blender/hangar/refs/contract-v1.json','utf8'));
for(const key of Object.keys(original).filter(k=>!['modules','placements'].includes(k)))assert.deepEqual(layout[key],original[key],'unchanged layout contract: '+key);
for(const p of original.placements){const actual=layout.placements.find(q=>q.id===p.id);assert.ok(actual,'preserve placement '+p.id);const {lod,...a}=actual;const {lod:oldLod,...b}=p;assert.deepEqual(a,b,'preserve placement transform '+p.id);if(oldLod)assert.equal(lod,oldLod);}
function imageSize(data){
  if(data.readUInt32BE(0)===0x89504e47)return [data.readUInt32BE(16),data.readUInt32BE(20)];
  assert.equal(data.readUInt16BE(0),0xffd8,'PNG or JPEG texture');
  for(let i=2;i<data.length;){while(data[i]===0xff)i++;const marker=data[i++];if(marker===0xd9||marker===0xda)break;const len=data.readUInt16BE(i);if([0xc0,0xc1,0xc2].includes(marker))return [data.readUInt16BE(i+5),data.readUInt16BE(i+3)];i+=len;}
  throw Error('Missing JPEG dimensions');
}
function checkImage(data,label){const size=imageSize(data);assert.ok(size.every(n=>n>0&&n<=1024),label+' texture <=1024');return size;}
let bytes=0;
const models=new Map();
for(const [id,def] of Object.entries(layout.modules)){
  const file=path.join(root,def.file),data=readFileSync(file);bytes+=data.length;
  assert.equal(data.readUInt32LE(0),0x46546c67);assert.equal(data.readUInt32LE(4),2);assert.equal(data.readUInt32LE(8),data.length);
  const g=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
  let triangles=0;for(const m of g.meshes??[]){assert.ok(m.name.startsWith('m_'),id+' mesh naming');for(const p of m.primitives){assert.equal(p.mode??4,4);assert.ok(p.extensions?.KHR_draco_mesh_compression,id+' Draco');triangles+=g.accessors[p.indices].count/3;}}
  assert.ok(triangles<=60000,id+' triangles');assert.ok(data.length<=4*1024*1024,id+' bytes');assert.equal(data.length,def.bytes,id+' manifest bytes');assert.equal(triangles,def.triangles,id+' manifest triangles');
  assert.ok(!g.extensions?.KHR_lights_punctual,id+' no light objects');
  assert.ok(g.nodes.every(n=>n.camera===undefined),id+' no cameras');
  for(const m of g.materials??[]){
    const p=m.pbrMetallicRoughness;
    if(id!=='lamp'&&m.name!=='console_screen'){assert.ok(p.baseColorTexture,id+' baked colour');assert.ok(p.metallicRoughnessTexture,id+' ORM');assert.ok(m.occlusionTexture,id+' baked AO');assert.ok(m.normalTexture,id+' detail normals');}
  }
  if(id==='lamp')assert.ok(g.materials.some(m=>m.emissiveFactor?.some(n=>n>0)),'lamp emissive lens');
  const binaryStart=20+data.readUInt32LE(12)+8;
  for(const im of g.images??[]){assert.ok(im.bufferView!==undefined,id+' embedded texture');const view=g.bufferViews[im.bufferView];checkImage(data.subarray(binaryStart+(view.byteOffset??0),binaryStart+(view.byteOffset??0)+view.byteLength),id);}
  models.set(id,g);console.log(`ok ${id}: ${triangles} triangles, ${(data.length/1024).toFixed(1)} KiB`);
}
for(const [id,names]of Object.entries({platform_half:['attach_slide','slot_cut__s','slot_cut__m','slot_cut__l'],elevator:['pose_cab'],crew_arm:['attach_root','attach_tip','extend'],crane_bridge:['pose_trolley','pose_hook'],high_bay_door:['pose_door'],mobile_launcher:['attach_deck']}))for(const name of names)assert.ok(models.get(id).nodes.some(n=>n.name===name),id+'/'+name);
assert.equal(layout.ML_TOP,7);const deck=models.get('mobile_launcher').nodes.find(n=>n.name==='attach_deck');assert.equal(deck.translation[1],layout.ML_TOP);
assert.equal(layout.hallBounds.max[1]-layout.hallBounds.min[1],80);assert.equal(layout.hallBounds.max[0]-layout.hallBounds.min[0],44);
assert.equal(layout.levels.length,11);for(let i=0;i<11;i++){assert.equal(layout.levels[i].y,11+i*6);assert.equal(layout.elevator.stops[i+1],layout.levels[i].y);assert.ok(layout.levels[i].retracted>=3);}
assert.equal(layout.consoleArea.max[0]-layout.consoleArea.min[0],20);assert.equal(layout.consoleArea.max[2]-layout.consoleArea.min[2],8);
for(const p of layout.placements){assert.ok(models.has(p.module),p.module);if(p.lod)assert.ok(models.has(p.lod));for(const a of ['position','rotation','scale'])assert.ok(p[a].length===3&&p[a].every(Number.isFinite));}
function drawn(id){const g=models.get(id),cuts=g.nodes.filter(n=>/^slot_cut__/.test(n.name)&&n.mesh!==undefined).map(n=>g.meshes[n.mesh].primitives.reduce((t,p)=>t+g.accessors[p.indices].count/3,0));return layout.modules[id].triangles-cuts.reduce((a,b)=>a+b,0)+(cuts.length?Math.max(...cuts):0);}
function total(lod){return layout.placements.reduce((n,p)=>n+drawn(lod&&p.position[1]>30&&p.lod?p.lod:p.module),0);}
// Worst collar per half, complete hall, no frustum-culling deduction.
assert.ok(total(false)<=1000000,'instanced full triangle bound');assert.ok(total(true)<=1000000,'instanced LOD triangle bound');
for(const [high,low]of [['tower_bay','tower_bay_lod'],['wall_bay','wall_bay_lod'],['roof_truss','roof_truss_lod'],['platform_half','platform_half_lod']]){const ratio=drawn(low)/drawn(high);assert.ok(ratio>=.1&&ratio<=.25,low+' 10-25% of full detail: '+ratio);}
for(const lod of [false,true]){const unique=new Set(layout.placements.map(p=>lod&&p.position[1]>30&&p.lod?p.lod:p.module));const calls=[...unique].reduce((n,id)=>n+models.get(id).meshes.reduce((n,m)=>n+m.primitives.length,0)-2*(id.startsWith('platform_half')?1:0),0);assert.ok(calls<=150,'structure calls <=150');}
function directoryBytes(dir){return readdirSync(dir,{withFileTypes:true}).reduce((n,e)=>n+(e.isDirectory()?directoryBytes(path.join(dir,e.name)):statSync(path.join(dir,e.name)).size),0);}
assert.ok(directoryBytes(root)<=20000000,'whole asset directory <=20 MB');
for(const f of readdirSync(path.join(root,'textures')))checkImage(readFileSync(path.join(root,'textures',f)),f);
for(const c of layout.colliders){assert.ok(c.center.every(Number.isFinite));assert.ok(c.size.every(n=>Number.isFinite(n)&&n>0));}
assert.equal(new Set(layout.placements.map(p=>p.id)).size,layout.placements.length,'unique placement IDs');
console.log(`PASS: ${models.size} Draco GLBs; ${bytes} bytes; worst-visible instanced bounds full=${total(false)}, LOD=${total(true)} triangles.`);

const cfg=layout.collar;assert.equal(cfg.plateCount*cfg.angularPitch,360);assert.ok(cfg.notchRadius>=cfg.slideLimits[1]);assert.equal(cfg.clearance,.25);assert.ok(models.has(cfg.plateModule));
const cylinder=[{y0:0,y1:20,r0:2,r1:2}];
let f=fitCollar({y:17},[],cylinder,cfg);assert.equal(f.retract,false);assert.ok(f.plateRadii.every(r=>Math.abs(r-2.25)<1e-8));
f=fitCollar({y:17},[],[{y0:0,y1:20,r0:1,r1:3}],cfg);assert.ok(f.plateRadii.every(r=>r>=2.25&&r<2.27),'adapter interpolation across deck thickness');
f=fitCollar({y:23},[],[{y0:0,y1:20,r0:2,r1:0}],cfg);assert.ok(f.plateRadii.every(r=>r>.65&&r<.68),'nose taper');
const booster=angle=>({attach:'radial',y:0,height:15,radius:2,angle,def:{booster:true},outline:{y0:0,y1:15,centerRadius:3,radialHalf:.5,tangentHalf:.5}});
f=fitCollar({y:17},[booster(90),booster(270)],cylinder,cfg);assert.equal(f.retract,false);assert.ok(Math.max(...f.plateRadii)>3.7);assert.ok(Math.min(...f.plateRadii)<2.3);assert.ok(f.plateRadii.slice(22,26).every(r=>r>3.7),'90deg booster sectors');assert.ok([0,1,46,47].every(i=>f.plateRadii[i]>3.7),'270deg booster sectors');
f=fitCollar({y:17},[],[{y0:0,y1:20,r0:8,r1:8}],cfg);assert.equal(f.retract,true);assert.ok(f.plateRadii.every(r=>r===cfg.slideLimits[1]));
assert.equal(fitCollar({y:71},[],cylinder,cfg).retract,true,'above ship retracts');
f=fitCollar({y:11},[{attach:'axial',y:10,height:1,radius:1,outline:{sections:[{y:4,segments:[2,0,0,2,-2,0,0,-2]}]}}],[],cfg);assert.ok(f.plateRadii.every(r=>r>=2.25),'actual core art outside nominal height stays clear');
f=fitCollar({y:17},[{...booster(0),outline:{...booster(0).outline,sections:[{y:10,segments:[3.2,-.2,3.2,.2]}]}}],cylinder,cfg);assert.ok(Math.max(...f.plateRadii)<3.6&&Math.max(...f.plateRadii)>3.4,'actual mesh section replaces conservative booster box');
const bank=models.get('engineering_consoles');assert.ok(layout.modules.engineering_consoles.bytes<=2000000);assert.ok(layout.modules.engineering_consoles.triangles<=80000);
const bankDrawn=bank.nodes.filter(n=>n.mesh!==undefined).reduce((sum,n)=>sum+bank.meshes[n.mesh].primitives.reduce((v,p)=>v+bank.accessors[p.indices].count/3,0),0);
assert.equal(bankDrawn,layout.modules.engineering_consoles.instancedTriangles);assert.ok(bankDrawn<=80000,'whole bank triangles including all station instances');
const v3Full=layout.placements.reduce((n,p)=>n+drawn(p.module==='platform_half'?'platform_v3':p.module),0)+bankDrawn+drawn(cfg.plateModule)*cfg.plateCount*layout.levels.length;
assert.ok(v3Full<=1000000,'v3 full kit including adaptive collars and bank');
console.log('V3 full worst-view structure + bank bound: '+v3Full+' triangles.');
assert.equal(layout.consoles.length,4);
for(const id of ['station_window','station_builder','station_testfire','station_launch']){
  assert.ok(bank.nodes.some(n=>n.name===id),id);const st=layout.consoles.find(s=>s.id===id);assert.ok(st);
  for(const screen of st.screens){const n=bank.nodes.find(n=>n.name===screen);assert.ok(n?.mesh!==undefined,screen);assert.ok(bank.meshes[n.mesh].primitives.every(p=>p.attributes.TEXCOORD_0!==undefined));}
  assert.ok(st.position[0]>=-10&&st.position[0]<=10&&st.position[2]>=-20&&st.position[2]<=-12);assert.equal(st.interactPoint[1],1.7);assert.equal(st.turnaroundView.position[1],1.7);
  assert.ok(st.interactPoint[2]>st.position[2],'operator is rocketward; faces door');
}
const v2=JSON.parse(readFileSync('src/builder/tools/blender/hangar/refs/contract-v2.json','utf8'));
for(const key of Object.keys(v2).filter(k=>k!=='modules'))assert.deepEqual(layout[key],v2[key],'v2 layout contract '+key);
for(const [key,m]of Object.entries(v2.modules))assert.deepEqual(layout.modules[key],m,'v2 module unchanged '+key);
console.log('PASS: collar cylinder, adapter, nose, twin boosters, oversize; four-console nodes, screen UVs and v2 compatibility.');
let fakeTime=1000000;const scales=[];const auto=automaticResolution(s=>scales.push(s));
for(let i=0;i<600;i++){fakeTime+=25;auto.update(fakeTime,25);}
assert.equal(auto.state.step,2);assert.ok(scales.every(s=>s>=.8),'automatic resolution never drops below 0.8');
for(let i=0;i<2000;i++){fakeTime+=10;auto.update(fakeTime,10);}
assert.equal(auto.state.step,0,'automatic resolution recovers to native');
console.log('PASS: sustained slow/fast windows, 0.8 floor and native recovery.');
