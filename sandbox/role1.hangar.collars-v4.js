import * as THREE from 'three';
import {fitCollarArc,plateIndices} from '/src/builder/tools/blender/hangar/collarArc.mjs';
export function createWrapCollars(scene,source,layout){
  const cfg=layout.wrap.collar,items=[],batches=[],dummy=new THREE.Object3D(),logged=new Set();let fits=[];
  layout.levels.forEach((l,level)=>layout.wrap.segments.forEach(segment=>plateIndices(segment,cfg).forEach(index=>items.push({level,segment:segment.id,axis:segment.slideAxis,index,angle:cfg.angleStart+(index+.5)*cfg.angularPitch}))));
  const radii=new Float32Array(items.length).fill(cfg.notchRadius);source.updateMatrixWorld(true);
  source.traverse(n=>{
    if(!n.isMesh)return;const geometry=n.geometry.clone().applyMatrix4(n.matrixWorld);geometry.setAttribute('collarRadius',new THREE.InstancedBufferAttribute(radii,1));
    const edge=n.name==='edge',m=n.material.clone();m.normalMap=null;m.roughnessMap=null;m.metalnessMap=null;m.roughness=.76;m.metalness=.22;m.envMapIntensity=.15;
    m.onBeforeCompile=shader=>{shader.vertexShader='attribute float collarRadius;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float t=clamp((length(position.xz)-1.0)/${edge?'0.075':'1.0'},0.0,1.0);
      transformed.xz=normalize(position.xz)*mix(collarRadius,${edge?'collarRadius+0.075':cfg.notchRadius.toFixed(3)},t);`);};
    m.customProgramCacheKey=()=>edge?'wrap-collar-edge-v4':'wrap-collar-panel-v4';
    const mesh=new THREE.InstancedMesh(geometry,m,items.length);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Pick the deformed surface, rather than the undeformed unit wedge used by normal Mesh.raycast.
    mesh.raycast=(raycaster,hits)=>{const p=new THREE.Vector3();items.forEach((item,i)=>{
      const y=layout.levels[item.level].y+(edge?.14:0),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-y);if(!raycaster.ray.intersectPlane(plane,p))return;
      const offset=item.offset??0,x=p.x-item.axis[0]*offset,z=p.z-item.axis[2]*offset,r=Math.hypot(x,z),delta=THREE.MathUtils.euclideanModulo(THREE.MathUtils.radToDeg(Math.atan2(-z,x))-item.angle+180,360)-180;
      const dist=raycaster.ray.origin.distanceTo(p);if(Math.abs(delta)<=cfg.angularPitch/2&&r>=radii[i]&&r<=(edge?radii[i]+.075:cfg.notchRadius)&&dist>=raycaster.near&&dist<=raycaster.far)hits.push({distance:dist,point:p.clone(),object:mesh,instanceId:i});
    });};scene.add(mesh);batches.push(mesh);
  });
  return {batches,items,get fits(){return fits;},get radii(){return Array.from(radii);},fit(entries,hull){
    fits=layout.levels.map(level=>Object.fromEntries(layout.wrap.segments.map(s=>[s.id,fitCollarArc(level,s,entries,hull,cfg)])));
    const top=7+Math.max(0,...entries.filter(e=>e.attach!=='radial').map(e=>e.y+e.height),...hull.map(h=>h.y1));
    fits.forEach((level,i)=>Object.entries(level).forEach(([segment,f])=>{const key=i+'/'+segment;if(f.retract&&layout.levels[i].y<=top){if(!logged.has(key))console.info('[hangar v4] retract oversize collar',i,segment);logged.add(key);}else logged.delete(key);}));return fits;
  },update(dt,holders){
    const byId=new Map(holders.map(h=>[h.userData.placement.level+'/'+h.userData.placement.segment,h]));
    items.forEach((item,i)=>{const f=fits[item.level]?.[item.segment],j=f?.plateIndices.indexOf(item.index)??-1,target=j<0?cfg.notchRadius:f.plateRadii[j];radii[i]=THREE.MathUtils.damp(radii[i],target,7.7,dt);
      const h=byId.get(item.level+'/'+item.segment);item.offset=h?.userData.offset??0;dummy.position.set(item.axis[0]*item.offset,layout.levels[item.level].y,item.axis[2]*item.offset);dummy.rotation.set(0,THREE.MathUtils.degToRad(item.angle),0);dummy.updateMatrix();for(const mesh of batches)mesh.setMatrixAt(i,dummy.matrix);
    });for(const mesh of batches){mesh.geometry.attributes.collarRadius.needsUpdate=true;mesh.instanceMatrix.needsUpdate=true;}
  }};
}
