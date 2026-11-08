// All game imports are read-only; no builder singleton, saves, events or game loop are started.
import * as THREE from 'three';
import {Assembly,createCatalog} from '/src/builder/assembly.js';
import {partsJson,internalsJson,sections,traitsData} from '/src/builder/catalogData.js';
import {applyShape} from '/src/builder/sections.js';
import {partArt} from '/src/builder/bay/partArt.js';
import {skinFor,mountRadial} from '/src/builder/bay/hullArt.js';
import {registerNasaModels,preloadNasaParts,nasaFailures} from '/src/builder/bay/nasa.js';
import {disposeObject} from '/src/builder/bay/util.js';
import {computeShipSpec} from '/src/builder/stats.js';
import {PLANETS,G0} from '/src/core/planets.js';
import engines from '/src/builder/data/engines.json';
import launch from '/src/builder/data/launch.json';
import balance from '/src/core/balance.json';
import reliable from '/src/builder/data/presets/reliable.json';
import workhorse from '/src/builder/data/presets/workhorse.json';
import coldMorning from '/src/builder/data/presets/coldMorning.json';
import thinSkin from '/src/builder/data/presets/thinSkin.json';
import apollo from '/src/builder/data/presets/apollo.json';

export const presets={Reliable:reliable,Workhorse:workhorse,'Cold Morning':coldMorning,'Thin Skin':thinSkin,Apollo:apollo};
export {sections};
const catalog=createCatalog(partsJson,internalsJson);registerNasaModels(catalog);
function crossSections(holder,levels,bounds){
  const out=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(const y of levels){
    if(y+.16<bounds.min.y||y-.15>bounds.max.y)continue;const segments=[];
    holder.traverse(n=>{if(!n.isMesh)return;const p=n.geometry.attributes.position,index=n.geometry.index,count=index?.count??p.count;
      for(let i=0;i<count;i+=3){
        a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(n.matrixWorld);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(n.matrixWorld);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(n.matrixWorld);
        if(Math.min(a.y,b.y,c.y)>y+.16||Math.max(a.y,b.y,c.y)<y-.15)continue;
        for(const plane of [y-.15,y,y+.16]){
          const points=[];
          for(const [v,w]of [[a,b],[b,c],[c,a]]){if(Math.abs(w.y-v.y)<1e-9){if(Math.abs(v.y-plane)<1e-7)points.push([v.x,v.z],[w.x,w.z]);continue;}const t=(plane-v.y)/(w.y-v.y);if(t>=0&&t<=1)points.push([v.x+t*(w.x-v.x),v.z+t*(w.z-v.z)]);}
          if(points.length>=2)segments.push(...points[0],...points[1]);
        }
      }
    });out.push({y,segments});
  }return out;
}
export function createShip(onChange,levels=Array.from({length:11},(_,i)=>4+i*6)){
  const object=new THREE.Group();object.name='real_player_ship';object.position.y=7;
  let assembly=new Assembly(reliable,catalog),entries=[],hull=[],spec=null,revision=0;
  const knownMaterials=new Set();
  function release(){
    // nasa.js clones materials per copy and flags shared geometry; disposeObject preserves that geometry.
    for(const child of [...object.children]){object.remove(child);disposeObject(child);}
    knownMaterials.clear();
  }
  async function rebuild(){
    const request=++revision;const layout=assembly.layout();
    // Bounded sequential preloading avoids a burst of Draco workers competing with the shared machine.
    for(const type of new Set(layout.map(e=>e.type)))await preloadNasaParts(catalog,[type]);
    if(request!==revision)return false;
    const made=skinFor(layout),hidden=new Set([...made.hull.insideIds,...made.hull.coveredIds]);
    release();entries=layout;hull=made.hull.segments;
    for(const e of entries){
      if(hidden.has(e.id))continue;
      const art=partArt(e);let holder=art;
      // Measure the same actual art that designScene mounts, not a guessed nominal booster radius.
      art.updateMatrixWorld(true);const localBox=new THREE.Box3().setFromObject(art);
      if(e.attach==='radial'){
        holder=mountRadial(art,e,layout);const angle=holder.rotation.y;holder.rotation.y=0;holder.updateMatrixWorld(true);
        const b=new THREE.Box3().setFromObject(holder);holder.rotation.y=angle;
        e.outline={y0:b.min.y,y1:b.max.y,centerRadius:(b.min.x+b.max.x)/2,radialHalf:(b.max.x-b.min.x)/2,tangentHalf:Math.max(Math.abs(b.min.z),Math.abs(b.max.z)),width:b.max.x-b.min.x};
        // matrixWorld still has the unrotated radial frame, including the actual mount/scale.
        e.outline.sections=crossSections(holder,levels,b);
      }else{
        art.position.y=e.y;art.updateMatrixWorld(true);
        const profile=new Map();
        art.traverse(n=>{if(!n.isMesh)return;const p=n.geometry.attributes.position;
          for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld);const y=Math.round(v.y*1000)/1000;profile.set(y,Math.max(profile.get(y)??0,Math.hypot(v.x,v.z)));}});
        const bounds=new THREE.Box3().setFromObject(art);
        e.outline={profile:[...profile].sort((a,b)=>a[0]-b[0]).map(([y,r])=>({y,r})),sections:crossSections(art,levels,bounds)};
      }
      holder.traverse(n=>{if(n.isMesh){for(const m of Array.isArray(n.material)?n.material:[n.material]){knownMaterials.add(m);if(m.normalMap)m.normalMap.anisotropy=8;}}});
      object.add(holder);
    }
    object.add(made.object);
    spec=computeShipSpec(assembly,{catalog,engines,launch,balance,planets:PLANETS,g0:G0,pad:sections.pad,traitsData}).spec;
    onChange?.({entries,hull,spec,top:Math.max(0,...entries.filter(e=>e.attach==='axial').map(e=>e.y+e.height)),revision});
    return true;
  }
  return {object,rebuild,sections,presets,get selectedShapes(){return Object.fromEntries(['nose','body','tail'].map(sec=>{const types=assembly.chain().filter(p=>catalog.get(p.type)?.section===sec&&!catalog.get(p.type)?.adapter).map(p=>p.type).join('|');return [sec,sections[sec].shapes.find(s=>s.stack.filter(t=>!catalog.get(t)?.adapter).join('|')===types)?.id??'__custom__'];}));},async preset(name){assembly=new Assembly(presets[name],catalog);return rebuild();},async shape(section,id){if(id==='__custom__')return false;const shape=sections[section].shapes.find(s=>s.id===id);if(!shape)throw Error('Unknown existing shape '+id);applyShape(assembly,sections[section],shape);return rebuild();},get data(){return {entries,hull,spec,assembly,failures:nasaFailures()};},dispose:release};
}
