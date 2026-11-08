import * as THREE from 'three';
export function createInspectionCamera({camera,controls,renderer,scene,params,onModeChange}){
  const keys=new Set(),ray=new THREE.Raycaster(),mouse=new THREE.Vector2(),direction=new THREE.Vector3(),right=new THREE.Vector3(),move=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  let looking=false,lastX=0,lastY=0;params.fly=false;params.flySpeed=4;
  controls.minDistance=.3;camera.near=.05;camera.updateProjectionMatrix();
  const inputTarget=e=>e.target?.closest?.('input,select,textarea,[contenteditable="true"]');
  function setMode(mode){
    const wasFly=params.fly;params.fly=mode==='fly';params.walk=false;looking=false;keys.clear();controls.enabled=!params.fly;onModeChange?.(mode);
    if(wasFly&&!params.fly){camera.getWorldDirection(direction);controls.target.copy(camera.position).addScaledVector(direction,Math.max(.3,Math.min(10,controls.getDistance())));controls.update();}
  }
  window.addEventListener('keydown',e=>{if(inputTarget(e))return;if(e.code==='KeyF'&&!e.repeat){setMode(params.fly?'orbit':'fly');return;}keys.add(e.code);if(params.fly&&['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space'].includes(e.code))e.preventDefault();});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();looking=false;});
  renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
  renderer.domElement.addEventListener('pointerdown',e=>{if(!params.fly||e.button!==2)return;looking=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);e.preventDefault();});
  window.addEventListener('pointerup',()=>looking=false);
  renderer.domElement.addEventListener('pointermove',e=>{
    if(!params.fly||!looking)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;
    const q=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');q.y-=dx*.003;q.x=THREE.MathUtils.clamp(q.x-dy*.003,-1.55,1.55);camera.quaternion.setFromEuler(q);
  });
  renderer.domElement.addEventListener('wheel',e=>{if(!params.fly)return;params.flySpeed=THREE.MathUtils.clamp(params.flySpeed*Math.exp(-e.deltaY*.002),.1,80);e.preventDefault();},{passive:false});
  renderer.domElement.addEventListener('dblclick',e=>{
    if(params.fly||params.walk)return;const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);
    const hit=ray.intersectObjects(scene.children,true).find(h=>{if(!h.object.isMesh)return false;for(let n=h.object;n;n=n.parent)if(!n.visible)return false;return true;});
    if(hit){controls.target.copy(hit.point);controls.update();}
  });
  return {setMode,update(dt){
    if(!params.fly)return;camera.getWorldDirection(direction);right.crossVectors(direction,up).normalize();move.set(0,0,0);
    move.addScaledVector(direction,Number(keys.has('KeyW'))-Number(keys.has('KeyS'))).addScaledVector(right,Number(keys.has('KeyD'))-Number(keys.has('KeyA'))).addScaledVector(up,Number(keys.has('KeyE'))-Number(keys.has('KeyQ')));
    if(move.lengthSq()){const speed=params.flySpeed*(keys.has('ShiftLeft')||keys.has('ShiftRight')?4:1)*(keys.has('ControlLeft')||keys.has('ControlRight')?.15:1);camera.position.addScaledVector(move.normalize(),speed*dt);}
  },get target(){return controls.target;}};
}
