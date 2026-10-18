/* ================= SYSTEMS/COMBAT (Фазы 2–3 рефакторинга) =================
   Чистая боевая математика D&D-стиля. Функции не мутируют состояние и не
   знают о сцене — только аргументы. Фаза 3: доменные типы Unit/Weapon.
   doAttack/damageUnit/healUnit/addStatus переезжают сюда в Фазе 4d
   (нужен контекст G и fx/HUD). */

import { d } from '../rng';

/* модификатор атаки: характеристика оружия + мастерство; яд/страх штрафуют */
export function attackMod(u:Unit, w:Weapon){
  let m=mod(u[w.abil])+(u.prof||0);
  if(u.statuses.some(s=>s.type==='poison'))m-=2;
  if(u.statuses.some(s=>s.type==='fear'))m-=2;
  return m;
}

/* благословение: +1d4 к броску атаки */
export function blessed(u:Unit){return u.statuses.some(s=>s.type==='bless')?d(4):0;}

/* шанс попадания 5%..95% (уклонение +3 КД, щит веры +2 КД) */
export function hitChance(u:Unit, t:Unit, w:Weapon){
  let ac=t.ac;
  if(t.statuses&&t.statuses.some(s=>s.type==='dodge'))ac+=3;/* v1.2: уклонение Илвы */
  if(t.statuses&&t.statuses.some(s=>s.type==='faith'))ac+=2;/* v1.2: щит веры Кая */
  const need=ac-attackMod(u,w);
  return clamp((21-need)/20,0.05,0.95);
}

/* средний урон оружия: n·(m+1)/2 + модификатор характеристики */
export function avgDamage(u:Unit, w:Weapon){
  return w.dice[0]*(w.dice[1]/2+0.5)+mod(u[w.abil]);
}


/* ================= БОЕВОЕ ЯДРО (Фазы 4–5 рефакторинга) =================
   doAttack/damageUnit/die — перенесено дословно из engine.ts (4d).
   Фаза 5: explode/explodeBarrel переехали из abilities.ts (die зовёт
   взрыв бочки — прямой импорт combat→abilities замыкал цикл);
   healUnit переехал в vitals.ts (progression→combat замыкал цикл);
   UI-refresh — через bus. Импорты теперь однонаправленные. */
import { key, clamp, mod } from '../utils';
import { W } from '../constants';
import { lunge, faceTo, tween, boomFX, shake } from '../fx/tweens';
import { roll } from '../rng';
import { sfx } from '../audio';
import { slowmo } from '../slowmo';
import { playAttack, playHit, playDeath } from '../animation';/* v1.6/v1.7: атак-анимация + реакция на урон + смерть */
import { fx, glows } from '../render/renderer';
import { ftextAbove, log, refreshIcons } from '../ui/overlays';
import { S, units, barrels, grass, fires, busyOn, busyOff } from '../state';
import { bus } from '../bus';
import { addStatus, igniteTile } from './statuses';
import { awardXP, checkEnd } from './progression';
import { rollLoot } from './loot';
import { questObj, questDone } from '../interact/quests';
import type { ExplodeOpts, Unit, Weapon } from '../types';
export async function doAttack(att:Unit,def:Unit,w:Weapon,opts:{sneakBonus?:number;aoo?:boolean}={}){
  if(!att.alive||!def.alive)return;
  busyOn();
  if(att.side==='hero')bus.tutEvent.call('attack');/* v1.4: шаг обучения «Атака» */
  faceTo(att,def.mesh.position);
  sfx.swing(w);
  /* v1.6: атак-анимация — Mixamo-клип, если есть, иначе процедурный замах;
    v0.7.x: выпад корпусом (lunge) остаётся поверх анимации */
  playAttack(att);
  await lunge(att,def);
  const m=attackMod(att,w),bl=blessed(att);
  const nat=d(20),total=nat+m+bl,crit=nat===20;
  const hit=crit||(nat!==1&&total>=def.ac);
  const cls=att.side==='hero'?'g-hero':'g-enemy';
  if(!hit){
    ftextAbove(def,'Промах','#aab2bd');
    log(att.name+': '+w.name+' по «'+def.name+'» — '+total+' против КД '+def.ac+' — промах!',cls);
  }else{
    const n=w.dice[0]*(crit?2:1);
    let dmg=roll(n,w.dice[1])+mod(att[w.abil]);
    if(opts.sneakBonus){/* v1.2: подлый удар Илвы */
      dmg+=opts.sneakBonus;
      log('Подлый удар добавляет '+opts.sneakBonus+' урона!','g-hero');
    }
    ftextAbove(def,(crit?'КРИТ! −':'−')+dmg,crit?'#ffd54f':(w.fire?'#ff8a50':(w.smite?'#ffe08a':(w.necro?'#9fe8b8':'#ffffff'))));
    log(att.name+': '+w.name+' по «'+def.name+'» — '+(crit?'КРИТ! ':'')+total+' против КД '+def.ac+', урон '+dmg+'.',cls);
    /* v0.7: искры попадания, звук удара, слоумо-крит */
    fx.burstAtMesh(def,w.smite?{count:16,color:0xffe08a,speed:3,size:0.12,life:0.5}:(w.fire?{count:16,color:0xff8a50,speed:3.4,size:0.13,life:0.5}:(w.necro?{count:16,color:0x9fe8b8,speed:2.6,size:0.12,life:0.6}:{count:12,color:0xffe8b0,speed:2.8,size:0.1,life:0.4})));
    sfx.impact(w);
    if(crit){
      sfx.crit();slowmo.trigger(0.55,0.22);
      fx.burstAtMesh(def,{count:30,color:0xffd54f,speed:4.6,size:0.15,life:0.85});
      glows.flashAtMesh(def,0xffd54f,1.5);
    }
    damageUnit(def,dmg,att);
    if(w.status&&def.alive)addStatus(def,w.status.type,w.status.turns);
    if(att.poisonBlade>0&&def.alive&&w.melee){/* v1.2: отравленный клинок */
      att.poisonBlade--;
      addStatus(def,'poison',2);
    }
  }
  if(opts.aoo)bus.refreshInit.call();
  busyOff();
}
export function damageUnit(t:Unit,dmg:number,src:Unit|null){
  if(!t||!t.alive)return;
  t.hp-=dmg;
  playHit(t);/* v1.7: реакция на урон (короткий клип; до проверки смерти) */
  bus.refreshBossBar.call();/* v0.8: боссбар живёт в реальном времени */
  if(t.hp<=0)die(t,src);
}


export function die(t:Unit,_src:Unit|null){
  if(!t.alive)return;
  if(t.isBarrel){explodeBarrel(t);return;}
  t.alive=false;t.hp=0;
  log(t.name+' повержен!','g-sys');
  ftextAbove(t,'Повержен','#d8b45a');
  sfx.death();
  fx.burstAtMesh(t,{count:22,color:0x7a2f2f,speed:2.4,size:0.12,life:0.7});
  const m=t.mesh;
  if(!playDeath(t))/* v1.7: клип смерти на скелетном риге; без рига — процедурное падение */
    tween(0.5,k=>{m.rotation.z=1.35*k*k;m.position.y=-0.12*k;});
  refreshIcons(t);bus.refreshInit.call();bus.refreshParty.call();
  if(t.side==='goblin'&&t.xp)awardXP(t.xp);
  if(t.side==='goblin')rollLoot(t);/* v1.3: лут-таблицы вместо фиксированных 3-9 золота */
  if(t.mainBoss){questObj('main','boss');questDone('main');}/* v0.8: Грат — босс основного квеста */
  if(t.cryptBoss){
    S.necroSlain=true;/* v1.1: печать сундука и респаун */
    questObj('crypt','boss');questDone('crypt');
    fx.burstAtMesh(t,{count:44,color:0xcfe8d8,speed:3.6,size:0.15,life:1.1,gravity:0.6});
    sfx.bones();
    log('Могильная печать на сундуке у трона рассыпается!','g-sys');
  }
  if(t.swampBoss){/* v1.5: жрица болот — тина оседает */
    S.swampDone=true;
    questObj('swamp','boss');questDone('swamp');
    fx.burstAtMesh(t,{count:44,color:0x8fd36a,speed:3.6,size:0.15,life:1.1,gravity:0.6});
    glows.flashAtMesh(t,0x8fd36a,2.4);
    log('Тина оседает: болота больше не шепчут. Зелёный свет идола гаснет.','g-sys');
  }
  if(t.giantBoss){/* v1.6: Гаррум Камнегрыз — перевал свободен */
    S.giantsDone=true;
    questObj('giants','boss');questDone('giants');
    fx.burstAtMesh(t,{count:44,color:0xb0b8c0,speed:3.6,size:0.15,life:1.1,gravity:0.6});
    glows.flashAtMesh(t,0xb0b8c0,2.4);
    shake(0.5);
    log('Гаррум оседает грудой камней. Перевал великанов свободен!','g-sys');
  }
  checkEnd();
}

/* ================= ВЗРЫВЫ (Фаза 5: из abilities.ts — die→бочка без цикла) ================= */
export function explode(tx:number,tz:number,opts:ExplodeOpts={}){
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
export function explodeBarrel(b:Unit){/* b — Barrel (Unit с isBarrel:true); сужение опционального литерала через параметр не проходит */
  if(!b.alive)return;
  b.alive=false;
  const m=b.mesh;
  tween(0.15,k=>{m.scale.setScalar(1+0.6*k);}).then(()=>m.removeFromParent());/* v0.8 */
  log('Взрывная бочка детонирует!','g-fire');
  explode(b.x,b.z,{dice:[3,6],radius:2.5});
}
