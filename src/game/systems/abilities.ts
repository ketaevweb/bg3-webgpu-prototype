/* ================= ABILITIES (Фаза 4 рефакторинга) =================
   Взрывы, огненный шар, гнев рассвета. Перенесено дословно из engine.ts. */
import * as THREE from 'three/webgpu';
import { key, cheb } from '../utils';
import { roll } from '../rng';
import { W } from '../constants';
import { boomFX, tween, projMesh, shake } from '../fx/tweens';
import { fx, glows } from '../render/renderer';
import { sfx } from '../audio';
import { slowmo } from '../slowmo';
import { log, ftextAbove } from '../ui/overlays';
import { fires, grass, units, barrels } from '../state';
import { igniteTile, addStatus } from './statuses';
import { damageUnit } from './combat';
import { checkEnd } from './progression';
import { refreshUI } from '../ui/actionbar';
import { showReach } from '../ui/markers';
import type { Unit } from '../types';

/* ================= ВЗРЫВЫ ================= */
export function explode(tx,tz,opts){
  opts=opts||{};
  const dice=opts.dice||[3,6],radius=opts.radius||2.5;
  const dmg=roll(dice[0],dice[1]);
  const cx=W(tx),cz=W(tz);
  boomFX(cx,cz,radius);
  /* v0.7: партиклы взрыва, хало-вспышка, звук, микро-слоумо */
  fx.explosion(cx,cz,radius);
  glows.flash(cx,cz,radius*1.5,0xffa040);
  sfx.explosion();
  slowmo.trigger(0.4,0.4);
  log('ВЗРЫВ! Урон '+dmg+' в радиусе '+radius+' кл.','g-fire');
  for(const u of units)if(u.alive&&!u.isBarrel){
    if(Math.hypot(u.x-tx,u.z-tz)<=radius+0.35){
      ftextAbove(u,'−'+dmg,'#ff8a50');
      damageUnit(u,dmg,null);
      if(u.alive&&Math.random()<0.6)addStatus(u,'burn',2);
    }
  }
  for(const b of barrels)if(b.alive&&Math.hypot(b.x-tx,b.z-tz)<=radius+0.35){
    setTimeout(()=>explodeBarrel(b),240);
  }
  let lit=0;
  const R=Math.ceil(radius);
  for(let dx=-R;dx<=R;dx++)for(let dz=-R;dz<=R;dz++){
    if(Math.hypot(dx,dz)>radius)continue;
    if(grass.has(key(tx+dx,tz+dz))&&!fires.has(key(tx+dx,tz+dz))){igniteTile(tx+dx,tz+dz,3);lit++;}
  }
  if(lit)log('Трава вспыхивает ('+lit+' кл.)!','g-fire');
  checkEnd();
}
export function explodeBarrel(b){
  if(!b.alive)return;
  b.alive=false;
  const m=b.mesh;
  tween(0.15,k=>{m.scale.setScalar(1+0.6*k);}).then(()=>m.removeFromParent());/* v0.8 */
  log('Взрывная бочка детонирует!','g-fire');
  explode(b.x,b.z,{dice:[3,6],radius:2.5});
}
export async function castFireball(h,tx,tz){
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
export async function radiantNova(h){/* v1.2: гнев рассвета Кая */
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
  refreshUI();showReach(h);
}
