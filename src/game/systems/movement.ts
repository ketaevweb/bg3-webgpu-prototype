/* ================= MOVEMENT (Фазы 4–5 рефакторинга) =================
   animateMove (с атаками по возможности и огнём) и tryMove игрока.
   Фаза 5: UI-refresh — через bus; параметры типизированы.
   Перенесено дословно из engine.ts. */
import { G, fires, GW, busyOn, busyOff } from '../state';
import { enemiesOf, meleeWeaponOf } from '../entities/units';
import { cheb, key } from '../utils';
import { d } from '../rng';
import { W } from '../constants';
import { tween, faceTo } from '../fx/tweens';
import { log, ftextAbove, setHint } from '../ui/overlays';
import { bus } from '../bus';
import { doAttack, damageUnit } from './combat';
import { addStatus } from './statuses';
import { showReach, clearMarkers, clearDots } from '../ui/markers';
import { passable, astar } from '../world/grid';
import * as THREE from 'three/webgpu';
import type { Unit } from '../types';

/* ================= ПЕРЕМЕЩЕНИЕ ================= */
export async function animateMove(u:Unit,path:{x:number;z:number}[]):Promise<boolean>{
  u.moving=true;
  try{
  for(const step of path){
    if(!u.alive)return false;
    const diag=(step.x!==u.x&&step.z!==u.z);
    const cost=diag?1.5:1;
    if(u.moveLeft+1e-9<cost){
      if(u.side==='hero')log(u.name+': перемещение закончилось.','g-sys');
      break;
    }
    const from={x:u.x,z:u.z};
    if(G.combatOn&&!u.disengaging){
      for(const e of enemiesOf(u)){
        if(e.reaction>0&&!e.pacified&&cheb(e,from)<=1){
          const mw=meleeWeaponOf(e);
          if(mw){
            e.reaction--;
            log(e.name+' совершает АТАКУ ПО ВОЗМОЖНОСТИ!','g-sys');
            await doAttack(e,u,mw,{aoo:true});
            if(!u.alive)return false;
          }
        }
      }
    }
    u.moveLeft-=cost;
    const a=u.mesh.position.clone();
    const b=new THREE.Vector3(W(step.x),0,W(step.z));
    faceTo(u,b);
    await tween(0.13,k=>{const s=k*k*(3-2*k);u.mesh.position.lerpVectors(a,b,s);});
    u.x=step.x;u.z=step.z;
    if(fires.has(key(u.x,u.z))){
      const dmg=d(4);
      log(u.name+' пробегает по огню: '+dmg+' урона.','g-fire');
      ftextAbove(u,'−'+dmg,'#ff8a50');
      damageUnit(u,dmg,null);
      if(!u.alive)return false;
      if(Math.random()<0.45)addStatus(u,'burn',2);
    }
    bus.refreshUI.call();
  }
  return u.alive;
  }finally{u.moving=false;}
}


export async function tryMove(h:Unit,tile:{x:number;z:number}){
  if(G.busy||G.phase!=='player')return;
  if(h.moveLeft<1){setHint('Перемещение закончилось — завершите ход.');return;}
  if(!passable(GW,tile.x,tile.z,h)){setHint('Клетка занята.');return;}
  const path=astar(GW,h.x,h.z,tile.x,tile.z,h,false);
  if(!path||!path.length){setHint('Туда не пройти.');return;}
  busyOn();clearMarkers();clearDots();setHint('');
  await animateMove(h,path);
  busyOff();
  bus.refreshUI.call();showReach(h);
}
