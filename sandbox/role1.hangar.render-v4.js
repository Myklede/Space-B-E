// Same sustained-window/backoff policy as the game/v3, with the v4 55 FPS budget.
// Isolated so saved v2/v3 runtime files remain unchanged.
export {filterMaterial} from './role1.hangar.render.js';
export function automaticResolution(setScale){
  const a={step:0,slow:0,fast:0,hold:0,sum:0,count:0,start:0,settle:performance.now()+1500,retryAt:0,retryDelay:30000,raisedAt:0};
  return {state:a,update(now,gap,on=true){
    if(!on||now<a.settle||gap<=0||gap>250)return;
    a.sum+=gap;a.count++;if(now-a.start<500)return;
    const avg=a.sum/a.count;a.sum=a.count=0;a.start=now;
    a.slow=avg>1000/55?a.slow+1:0;a.fast=avg<13?a.fast+1:0;a.hold=avg<17?a.hold+1:0;
    let step=a.step;
    if(a.slow>=4&&step<2){if(a.raisedAt&&now-a.raisedAt<15000)a.retryDelay=Math.min(a.retryDelay*2,480000);step++;a.retryAt=now+a.retryDelay;}
    else if(step>0&&(a.fast>=12||(a.hold>=2*a.retryDelay/1000&&now>a.retryAt))){step--;a.raisedAt=now;}
    if(step!==a.step){a.step=step;setScale(1-.1*step);a.slow=a.fast=a.hold=0;a.settle=now+500;}
  }};
}
