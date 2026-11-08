import * as THREE from 'three';
import {weatherFor} from '/src/builder/weather.js';
import {sections} from '/src/builder/catalogData.js';

const titles=['LAUNCH WINDOW & WEATHER','SPACECRAFT DESIGN','ENGINE TEST & SIMULATION','LAUNCH DIRECTOR / GO-NO-GO'];
const rects=[[0,0,1/3,.1875],[1/3,0,1/3,.1875],[2/3,0,1/3,.1875],[0,.25,1,.33],[0,.625,1,.1]];
function mergeScreens(nodes){
  const pos=[],norm=[],uv=[];
  nodes.forEach((node,i)=>{const g=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();g.applyMatrix4(node.matrixWorld);const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;const [x,y,w,h]=rects[i];
    for(let j=0;j<p.count;j++){pos.push(p.getX(j),p.getY(j),p.getZ(j));norm.push(n?.getX(j)??0,n?.getY(j)??0,n?.getZ(j)??1);uv.push(x+u.getX(j)*w,1-y-h+(1-u.getY(j))*h);}g.dispose();});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}
function panel(ctx,w,h,title,draw){
  ctx.fillStyle='#071116';ctx.fillRect(0,0,w,h);ctx.fillStyle='#10262c';ctx.fillRect(0,0,w,Math.max(22,h*.14));ctx.fillStyle='#9ac9cc';ctx.font=`600 ${Math.max(10,h*.065)}px monospace`;ctx.fillText(title,12,Math.max(16,h*.10));
  ctx.strokeStyle='#264048';ctx.lineWidth=1;for(let x=12;x<w;x+=w/10){ctx.beginPath();ctx.moveTo(x,h*.22);ctx.lineTo(x,h*.91);ctx.stroke();}for(let y=h*.22;y<h*.92;y+=h/7){ctx.beginPath();ctx.moveTo(12,y);ctx.lineTo(w-12,y);ctx.stroke();}
  draw?.();ctx.fillStyle='#748e95';ctx.font=`${Math.max(8,h*.04)}px monospace`;ctx.fillText('SANDBOX / ILLUSTRATIVE DATA',12,h-8);
}
function line(ctx,w,h,fn,color='#72bbb4'){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<150;i++){const x=12+(w-24)*i/149,y=h*.86-fn(i/149)*h*.58;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();}

export function createConsoles({scene,assets,layout,camera,controls,gui,look,builderFolder,ship,getShipController,onEdit}){
  const source=assets.get('engineering_consoles');if(!source)return null;source.updateMatrixWorld(true);
  const chassisNode=source.getObjectByName('station_window').children.find(n=>n.isMesh&&!n.name.startsWith('screen_'));
  const chassis=new THREE.InstancedMesh(chassisNode.geometry,chassisNode.material,4);chassis.frustumCulled=false;scene.add(chassis);
  const screens=[],dummy=new THREE.Object3D(),canvases=[];
  layout.consoles.forEach((st,i)=>{
    dummy.position.fromArray(st.position);dummy.rotation.set(0,THREE.MathUtils.degToRad(st.rotation[1]),0);dummy.updateMatrix();
    chassis.setMatrixAt(i,dummy.matrix.clone().multiply(chassisNode.matrixWorld));
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    const node=new THREE.Mesh(mergeScreens(st.screens.map(id=>source.getObjectByName(id))),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));node.name=st.id+'_screens';node.position.fromArray(st.position);node.rotation.y=THREE.MathUtils.degToRad(st.rotation[1]);scene.add(node);screens.push(node);canvases.push({canvas,texture,ctx:canvas.getContext('2d')});
  });
  let reveal=null,active=null,elapsed=0;
  const folder=gui.addFolder('Engineering console bank');
  function sit(id){const st=layout.consoles.find(s=>s.id===id);active=st;reveal=null;look(st.interactPoint,[st.lookTarget[0],1.62,st.lookTarget[2]],70);controls.enabled=false;if(id==='station_builder')builderFolder.open();showEditor(id==='station_builder');}
  const actions={};layout.consoles.forEach((st,i)=>{actions[st.id]=()=>sit(st.id);folder.add(actions,st.id).name('Sit: '+titles[i]);});
  function stand(){if(!active)return;const target=new THREE.Vector3(...active.turnaroundView.target);target.y=7+(ship()?.top??36)*.5;reveal={t:0,from:camera.position.clone(),q:camera.quaternion.clone(),to:new THREE.Vector3(...active.turnaroundView.position),target};controls.enabled=false;showEditor(false);}
  actions.turnaround=stand;folder.add(actions,'turnaround').name('Stand up and turn around');
  const editor=document.createElement('aside');editor.style.cssText='position:fixed;right:310px;bottom:20px;background:#0d191ef2;color:#dce7e6;padding:16px;width:260px;border:1px solid #627c80;display:none;font:13px system-ui';document.body.append(editor);
  function showEditor(on){editor.style.display=on?'block':'none';if(!on)return;editor.replaceChildren();const h=document.createElement('strong');h.textContent='SPACECRAFT DESIGN';editor.append(h);
    for(const c of builderFolder.controllers){const original=c.domElement.querySelector('select');if(!original)continue;const label=document.createElement('label');label.textContent=c.property;label.style.cssText='display:block;margin-top:12px';const select=original.cloneNode(true);select.value=original.value;select.style.width='100%';select.onchange=()=>{original.value=select.value;original.dispatchEvent(new Event('change',{bubbles:true}));};label.append(select);editor.append(label);}
    const button=document.createElement('button');button.textContent='Stand up and turn around';button.style.cssText='margin-top:16px;padding:8px';button.onclick=stand;editor.append(button);
  }
  function redraw(){
    const data=ship(),s=data?.spec?.stats??{},weather=weatherFor(getShipController?.()?.data.assembly.launch??{}, {pad:sections.pad});
    canvases.forEach(({ctx,texture},station)=>{
      ctx.fillStyle='#071116';ctx.fillRect(0,0,1024,1024);
      rects.forEach(([x,y,rw,rh],pane)=>{ctx.save();ctx.translate(x*1024,y*1024);const w=rw*1024,h=rh*1024;
        if(pane===4){ctx.fillStyle='#b2b6ad';ctx.fillRect(0,0,w,h);ctx.fillStyle='#253236';ctx.font='600 42px monospace';ctx.fillText(titles[station],22,66);ctx.restore();return;}
        const title=pane===3?titles[station]:[['TRANSFER COST','WEATHER RADAR','RANGE CONDITIONS'],['VEHICLE GEOMETRY','MASS / PERFORMANCE','BUILD STATUS'],['THRUST / CHAMBER / PUMP','SIMULATED ASCENT','STATIC FIRE STATUS'],['POLL BOARD','COUNTDOWN','HOLD / GO']][station][pane];
        panel(ctx,w,h,title,()=>{
          if(station===0){
            if(pane===0||pane===3){for(let yy=0;yy<30;yy++)for(let xx=0;xx<75;xx++){const v=Math.min(1,Math.hypot((xx-22)/40,(yy-15)/17));ctx.fillStyle=`hsl(${190-v*155},38%,${15+v*17}%)`;ctx.fillRect(12+xx*(w-24)/75,h*.22+yy*h*.56/30,(w-24)/75+1,h*.56/30+1);}ctx.fillStyle='#efd891';ctx.font=`${h*.06}px monospace`;ctx.fillText('NEXT WINDOW +128 d (demo)',16,h*.87);ctx.fillText('~26 months / Hohmann ~259 days',16,h*.96-20);}
            else if(pane===1){for(let i=0;i<9;i++){ctx.strokeStyle='#318876';ctx.beginPath();ctx.arc(w*.48,h*.58,8+i*7,-1,1.1);ctx.stroke();}ctx.fillStyle='#7ca19e';ctx.fillText('RADAR: schematic / not live',14,h*.92);}
            else {ctx.fillStyle='#b3d4cc';ctx.font=`${h*.09}px monospace`;[weather.tempC+' C',weather.windKts+' kt wind','Lightning '+Math.round(weather.lightning*100)+'%',weather.label,'Ceiling: illustrative 3000 ft'].forEach((t,j)=>ctx.fillText(t,15,h*(.32+j*.12)));}
          }else if(station===1){
            ctx.strokeStyle='#7ebdb5';ctx.lineWidth=2;
            if(pane===0||pane===3){const es=data?.entries?.filter(e=>e.attach==='axial')??[];const top=data?.top??20;for(const e of es){const profile=e.outline?.profile??[{y:e.y,r:e.radius??1.25},{y:e.y+e.height,r:e.radius??1.25}];for(const side of [-1,1]){ctx.beginPath();profile.forEach((p,i)=>{const x=w*.28+side*p.r/2*w*.14,y=h*.86-p.y/top*h*.6;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();}}ctx.fillStyle='#b3d4cc';ctx.font=`${h*.075}px monospace`;['CURRENT SHIP',((s.deltaV??0)/1000).toFixed(2)+' km/s dV','TWR '+(s.twrEarth??0).toFixed(2),(s.wetMass??0).toFixed(0)+' kg','$'+Math.round(s.cost??0).toLocaleString()].forEach((t,j)=>ctx.fillText(t,w*.49,h*(.31+j*.12)));}
            else {ctx.fillStyle='#b3d4cc';ctx.font=`${h*.085}px monospace`;['LAYOUT SYNCHRONIZED',data?.entries?.length+' parts','Hull fitted at 11 levels','Change shapes at this console'].forEach((t,j)=>ctx.fillText(t,14,h*(.33+j*.13)));}
          }else if(station===2){
            if(pane===0||pane===3){line(ctx,w,h,t=>Math.min(1,t*5)*Math.min(1,(1-t)*7)*(.9+.02*Math.sin(t*75)));line(ctx,w,h,t=>Math.min(.83,t*4)*Math.min(1,(1-t)*8),'#d1af67');line(ctx,w,h,t=>Math.min(.7,t*3)*Math.min(1,(1-t)*6),'#79a5d0');ctx.fillStyle='#bbd1c8';ctx.fillText('THRUST / Pc / RPM (normalized)',14,h*.94-8);}
            else if(pane===1)line(ctx,w,h,t=>t*t*.85);
            else{ctx.fillStyle='#b3d4cc';ctx.font=`${h*.085}px monospace`;['NOMINAL TEST / NOT LIVE',((s.thrust??0)/1000).toFixed(0)+' kN rated thrust','Stand: hold-down / release','TWR '+(s.twrEarth??0).toFixed(2)].forEach((t,j)=>ctx.fillText(t,14,h*(.32+j*.14)));}
          }else{
            ctx.fillStyle='#b3d4cc';ctx.font=`${h*.09}px monospace`;
            const rows=pane===1?['T - 00:10:00','COUNTDOWN HOLD','DEMO / no launch action']:pane===2?['HOLD [guarded]','GO [guarded]','Control: inactive mock-up']:['WINDOW / WEATHER   GO','SPACECRAFT DESIGN  GO','ENGINE TEST        HOLD','LAUNCH DIRECTOR    HOLD'];rows.forEach((t,j)=>{ctx.fillStyle=t.includes('HOLD')?'#e1bc72':'#91c5a6';ctx.fillText(t,14,h*(.31+j*.14));});
          }
        });ctx.restore();
      });texture.needsUpdate=true;
    });
  }
  redraw();
  return {sit,stand,redraw,screens,objects:[chassis,...screens],update(dt){elapsed+=dt;if(reveal){reveal.t=Math.min(1,reveal.t+dt/1.5);const t=reveal.t*reveal.t*(3-2*reveal.t);camera.position.copy(reveal.from).lerp(reveal.to,t);const targetQ=new THREE.Quaternion();const temp=new THREE.PerspectiveCamera();temp.position.copy(reveal.to);temp.lookAt(reveal.target);targetQ.copy(temp.quaternion);camera.quaternion.copy(reveal.q).slerp(targetQ,t);if(reveal.t===1){controls.target.copy(reveal.target);controls.enabled=true;controls.update();reveal=null;}}},get active(){return active?.id;}};
}
