/* ================= OVERLAYS (Фаза 6 рефакторинга) =================
   Журнал боя, подсказки и баннеры — через zustand-стор (React-HUD).
   Покадровые слои (#ov: HP-полоски над юнитами, всплывающий текст)
   остались императивными — React противопоказан при 60 fps проекции
   3D→экран. Перенесено дословно (тексты/классы 1:1). */
import * as THREE from 'three/webgpu';
import { UI } from '../hud';
import { $ } from '../utils';
import { units } from '../state';
import { camera } from '../render/renderer';
import { STATUS } from '../constants';
import { pushLog, uiSet } from './store';
import { voice } from './voice';/* v2.5: баннеры говорит рассказчик */
import type { Status, Unit } from '../types';

export function log(msg:string,cls?:string){pushLog(msg,cls);}
const pv=new THREE.Vector3();
export function projectPos(x:number,y:number,z:number){
  pv.set(x,y,z).project(camera);
  return {x:(pv.x*0.5+0.5)*innerWidth,y:(-pv.y*0.5+0.5)*innerHeight,behind:pv.z>1};
}
export function ftextAbove(ent:{mesh:THREE.Object3D},text:string,color:string){
  const s=projectPos(ent.mesh.position.x,ent.mesh.position.y+1.6,ent.mesh.position.z);
  if(s.behind)return;
  const el=document.createElement('div');
  el.className='ft';el.textContent=text;el.style.color=color;
  el.style.left=s.x+'px';el.style.top=s.y+'px';
  $(UI.ov).appendChild(el);
  setTimeout(()=>el.remove(),1100);
}
export function setHint(t:string){uiSet({hint:t||''});}
/* v2.5: баннер озвучивается рассказчиком (слаг → манифест, иначе —
   /api/tts); silent=true — когда вместо баннера говорит конкретная
   строка (задания: quest.<id>.start/done) */
export function bigBanner(text:string,silent=false){
  uiSet({banner:text,bannerOn:true});
  if(!silent)voice.banner(text);
  setTimeout(()=>uiSet({bannerOn:false}),2200);
}
export function initOverlays(){
  const ov=$(UI.ov);
  for(const u of units){
    if(u._el)continue;/* v0.8: герои переживают смену карт */
    const el=document.createElement('div');
    el.className='uhp '+u.side;
    el.innerHTML='<div class="nm">'+u.name+'</div><div class="ubar"><i></i></div><div class="uic"></div>';
    ov.appendChild(el);
    u._el=el;
  }
}
export function refreshIcons(u:Unit){
  if(!u._el)return;
  const el=u._el.querySelector('.uic');
  if(el)el.innerHTML=u.statuses.map((s:Status)=>
    '<span style="background:'+STATUS[s.type].css+'">'+STATUS[s.type].tag+s.turns+'</span>').join('');
}
export function updateOverlays(){
  for(const u of units){
    const el=u._el;if(!el)continue;
    if(!u.alive){el.style.display='none';continue;}
    const s=projectPos(u.mesh.position.x,u.mesh.position.y+2.05,u.mesh.position.z);
    if(s.behind){el.style.display='none';continue;}
    el.style.display='block';
    el.style.left=s.x+'px';el.style.top=s.y+'px';
    const bar=el.querySelector<HTMLElement>('.ubar i');if(bar)bar.style.width=Math.max(0,u.hp/u.maxhp*100)+'%';
  }
}
