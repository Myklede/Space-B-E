// Standalone asset-contract checks. No browser, renderer, Git mutation or dependencies.
import assert from 'node:assert/strict';
import {readFileSync,statSync,readdirSync} from 'node:fs';
import path from 'node:path';
const root='public/assets/models/builder/hangar';
const layout=JSON.parse(readFileSync(path.join(root,'layout.json'),'utf8'));
let bytes=0;
const models=new Map();
for(const [id,def] of Object.entries(layout.modules)){
  const file=path.join(root,def.file),data=readFileSync(file);bytes+=data.length;
  assert.equal(data.readUInt32LE(0),0x46546c67);assert.equal(data.readUInt32LE(4),2);assert.equal(data.readUInt32LE(8),data.length);
  const g=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
  let triangles=0;for(const m of g.meshes??[]){assert.ok(m.name.startsWith('m_'),id+' mesh naming');for(const p of m.primitives){assert.equal(p.mode??4,4);assert.ok(p.extensions?.KHR_draco_mesh_compression,id+' Draco');triangles+=g.accessors[p.indices].count/3;}}
  assert.ok(triangles<=(id.endsWith('_lod')?2000:20000),id+' triangles');assert.ok(data.length<=400*1024,id+' bytes');assert.equal(triangles,def.triangles,id+' manifest triangles');
  assert.ok(!g.extensions?.KHR_lights_punctual,id+' no light objects');
  assert.ok(g.nodes.every(n=>!n.camera),id+' no cameras');
  for(const m of g.materials??[]){assert.ok(m.pbrMetallicRoughness.metallicFactor>=.3&&m.pbrMetallicRoughness.metallicFactor<=.6);assert.ok(m.pbrMetallicRoughness.roughnessFactor>=.4&&m.pbrMetallicRoughness.roughnessFactor<=.7);}
  models.set(id,g);console.log(`ok ${id}: ${triangles} triangles, ${(data.length/1024).toFixed(1)} KiB`);
}
for(const [id,names]of Object.entries({platform_half:['attach_slide','slot_cut__s','slot_cut__m','slot_cut__l'],elevator:['pose_cab'],crew_arm:['attach_root','attach_tip','extend'],crane_bridge:['pose_trolley','pose_hook'],high_bay_door:['pose_door'],mobile_launcher:['attach_deck']}))for(const name of names)assert.ok(models.get(id).nodes.some(n=>n.name===name),id+'/'+name);
assert.equal(layout.ML_TOP,7);const deck=models.get('mobile_launcher').nodes.find(n=>n.name==='attach_deck');assert.equal(deck.translation[1],layout.ML_TOP);
assert.equal(layout.hallBounds.max[1]-layout.hallBounds.min[1],80);assert.equal(layout.hallBounds.max[0]-layout.hallBounds.min[0],44);
assert.equal(layout.levels.length,11);for(let i=0;i<11;i++){assert.equal(layout.levels[i].y,11+i*6);assert.equal(layout.elevator.stops[i+1],layout.levels[i].y);assert.ok(layout.levels[i].retracted>=3);}
assert.equal(layout.consoleArea.max[0]-layout.consoleArea.min[0],20);assert.equal(layout.consoleArea.max[2]-layout.consoleArea.min[2],8);
for(const p of layout.placements){assert.ok(models.has(p.module),p.module);if(p.lod)assert.ok(models.has(p.lod));for(const a of ['position','rotation','scale'])assert.ok(p[a].length===3&&p[a].every(Number.isFinite));}
function drawn(id){const g=models.get(id),cuts=g.nodes.filter(n=>/^slot_cut__/.test(n.name)).map(n=>g.meshes[n.mesh].primitives.reduce((t,p)=>t+g.accessors[p.indices].count/3,0));return layout.modules[id].triangles-cuts.reduce((a,b)=>a+b,0)+(cuts.length?Math.max(...cuts):0);}
function total(lod){return layout.placements.reduce((n,p)=>n+drawn(lod&&p.position[1]>30&&p.lod?p.lod:p.module),0);}
// Worst collar per half, complete hall, no frustum-culling deduction.
assert.ok(total(false)<=600000,'instanced full triangle bound');assert.ok(total(true)<=300000,'instanced LOD triangle bound');
function directoryBytes(dir){return readdirSync(dir,{withFileTypes:true}).reduce((n,e)=>n+(e.isDirectory()?directoryBytes(path.join(dir,e.name)):statSync(path.join(dir,e.name)).size),0);}
assert.ok(directoryBytes(root)<=15*1024*1024,'whole asset directory <=15 MiB');
for(const c of layout.colliders){assert.ok(c.center.every(Number.isFinite));assert.ok(c.size.every(n=>Number.isFinite(n)&&n>0));}
assert.equal(new Set(layout.placements.map(p=>p.id)).size,layout.placements.length,'unique placement IDs');
console.log(`PASS: ${models.size} Draco GLBs; ${bytes} bytes; worst-visible instanced bounds full=${total(false)}, LOD=${total(true)} triangles.`);
