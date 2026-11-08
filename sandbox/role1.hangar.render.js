// Sandbox-only copy of the game's sustained-frame-time controller, floor limited to 0.8.
export function automaticResolution(setScale) {
  const a={step:0,slow:0,fast:0,hold:0,sum:0,count:0,start:0,settle:performance.now()+1500,retryAt:0,retryDelay:30000,raisedAt:0};
  return {state:a,update(now,gap,on=true){
    if(!on||now<a.settle||gap<=0||gap>250)return;
    a.sum+=gap;a.count++;if(now-a.start<500)return;
    const avg=a.sum/a.count;a.sum=a.count=0;a.start=now;
    a.slow=avg>20?a.slow+1:0;a.fast=avg<13?a.fast+1:0;a.hold=avg<18?a.hold+1:0;
    let step=a.step;
    if(a.slow>=4&&step<2){if(a.raisedAt&&now-a.raisedAt<15000)a.retryDelay=Math.min(a.retryDelay*2,480000);step++;a.retryAt=now+a.retryDelay;}
    else if(step>0&&(a.fast>=12||(a.hold>=2*a.retryDelay/1000&&now>a.retryAt))){step--;a.raisedAt=now;}
    if(step!==a.step){a.step=step;setScale(1-.1*step);a.slow=a.fast=a.hold=0;a.settle=now+500;}
  }};
}
export function filterMaterial(material,renderer,far=false){
  const m=material.clone();const anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  for(const key of ['map','aoMap','normalMap','roughnessMap','metalnessMap'])if(m[key]){m[key].anisotropy=anisotropy;m[key].generateMipmaps=true;}
  if(far){m.roughness=Math.max(.78,m.roughness);m.metalness=.18;m.normalMap=null;m.roughnessMap=null;m.metalnessMap=null;m.aoMap=null;m.envMapIntensity=.12;}
  return m;
}
