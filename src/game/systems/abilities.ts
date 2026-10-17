/* ================= ABILITIES (Фазы 4–5 рефакторинга) =================
   Огненный шар, гнев рассвета. Перенесено дословно из engine.ts.
   Фаза 5: explode/explodeBarrel переехали в systems/combat.ts (die→бочка
   без цикла), checkEnd/igniteTile/addStatus уезжают вместе с ними;
   UI-refresh — через bus. Импорты однонаправленные. */
import * as THREE from 'three/webgpu';
import { cheb } from '../utils';
import { roll } from '../rng';
import { W } from '../constants';
import { tween, projMesh, shake } from '../fx/tweens';
import { fx, glows } from '../render/renderer';
import { sfx } from '../audio';
import { log, ftextAbove } from '../ui/overlays';
import { units } from '../state';
import { bus } from '../bus';
import { damageUnit, explode } from './combat';
import { showReach } from '../ui/markers';
import type { Unit } from '../types';

export async function castFireball(h:Unit,tx:number,tz:number):Promise<void>{
  log(h.name+' сотворяет ОГНЕННЫЙ ШАР!','g-fire');
  sfx.fireCast();
  projMesh.visible=true;
  const from=h.mesh.position.clone().add(new THREE.Vector3(0,1.3,0));
  const to=new THREE.Vector3(W(tx),0.5,W(tz));
  await tween(0.32,k=>{
    projMesh.position.lerpVectors(from,to,k);
    projMesh.position.y=0.8+Math.sin(k*Math.PI)*2.2;
  });
  projMesh.visible=false;
  explode(tx,tz,{dice:[3,6],radius:2.5});
}
export async function radiantNova(h:Unit):Promise<void>{/* v1.2: гнев рассвета Кая */
  h.action--;h.dawnUsed=true;
  log(h.name+' призывает ГНЕВ РАССВЕТА!','g-hero');
  sfx.nova();
  shake(0.35);
  const cx=W(h.x),cz=W(h.z);
  fx.burst(cx,0.8,cz,{count:42,color:0xffd54f,speed:4.4,life:0.8,gravity:1.4,spread:0.7});
  fx.burst(cx,0.4,cz,{count:16,color:0xfff2c0,speed:3,life:0.9,gravity:1.1,spread:0.5});
  glows.flash(cx,cz,3.4,0xffd54f);
  for(const e of units)if(e.alive&&!e.isBarrel&&e.side!=='hero'&&cheb(h,e)<=1){
    let dmg=roll(2,6);
    if(e.cls==='undead'){dmg*=2;log('Святой свет выжигает '+e.name+' насквозь!','g-hero');}
    ftextAbove(e,'−'+dmg,'#ffe08a');
    log('Гнев рассвета бьёт '+e.name+': '+dmg+' излучения.','g-hero');
    damageUnit(e,dmg,h);
  }
  bus.refreshUI.call();showReach(h);
}
