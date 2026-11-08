import * as THREE from 'three';
import {fitCollar} from '/src/builder/tools/blender/hangar/collarFit.mjs';
export function createCollars(scene,source,layout){
  const count=layout.levels.length*layout.collar.plateCount,items=[],radii=new Float32Array(count).fill(layout.collar.notchRadius);
  const batches=[];source.updateMatrixWorld(true);
  source.traverse(n=>{
    if(!n.isMesh)return;
    const geometry=n.geometry.clone().applyMatrix4(n.matrixWorld);
    geometry.setAttribute('collarRadius',new THREE.InstancedBufferAttribute(radii,1));
    const m=n.material.clone();m.normalMap=null;m.roughnessMap=null;m.metalnessMap=null;m.roughness=.76;m.metalness=.22;m.envMapIntensity=.15;
    const edge=n.name==='edge';
    m.onBeforeCompile=shader=>{shader.vertexShader='attribute float collarRadius;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float t=clamp((length(position.xz)-1.0)/${edge?'0.075':'1.0'},0.0,1.0);
      transformed.xz=normalize(position.xz)*mix(collarRadius,${edge?'collarRadius+0.075':layout.collar.notchRadius.toFixed(3)},t);`);};
    m.customProgramCacheKey=()=>edge?'collar-edge-v3':'collar-panel-v3';
    const mesh=new THREE.InstancedMesh(geometry,m,count);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);batches.push(mesh);
  });
  let fits=[];const logged=new Set(),dummy=new THREE.Object3D();
  function fit(entries,hull){
    fits=layout.levels.map(l=>fitCollar(l,entries,hull,layout.collar));
    fits.forEach((f,i)=>{if(f.retract&&!logged.has(i)){console.info('[collar] level '+layout.levels[i].label+' retracted: above ship or outside notch');logged.add(i);}});
    return fits;
  }
  function update(dt,halves){
    for(let l=0;l<layout.levels.length;l++)for(let p=0;p<layout.collar.plateCount;p++){
      const idx=l*layout.collar.plateCount+p,target=fits[l]?.plateRadii[p]??layout.collar.notchRadius;
      // 99% settling in 0.6 s, independent of RAF cadence.
      radii[idx]=THREE.MathUtils.damp(radii[idx],target,7.7,dt);
      const side=p<layout.collar.plateCount/2?1:-1,half=halves.find(h=>h.userData.placement.level===l&&h.userData.placement.side===side);
      dummy.position.set(half?.position.x??0,layout.levels[l].y,0);dummy.rotation.set(0,THREE.MathUtils.degToRad(layout.collar.angleStart+(p+.5)*layout.collar.angularPitch),0);dummy.updateMatrix();
      for(const mesh of batches)mesh.setMatrixAt(idx,dummy.matrix);
    }
    for(const mesh of batches){mesh.geometry.attributes.collarRadius.needsUpdate=true;mesh.instanceMatrix.needsUpdate=true;}
  }
  return {fit,update,batches,get fits(){return fits;},get radii(){return Array.from(radii);}};
}
