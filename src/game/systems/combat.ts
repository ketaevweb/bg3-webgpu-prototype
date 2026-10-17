/* ================= SYSTEMS/COMBAT (Фазы 2–3 рефакторинга) =================
   Чистая боевая математика D&D-стиля. Функции не мутируют состояние и не
   знают о сцене — только аргументы. Фаза 3: доменные типы Unit/Weapon.
   doAttack/damageUnit/healUnit/addStatus переезжают сюда в Фазе 4d
   (нужен контекст G и fx/HUD). */

import { clamp, mod } from '../utils';
import { d } from '../rng';
import type { Unit, Weapon } from '../types';

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


/* ================= БОЕВОЕ ЯДРО (Фаза 4 рефакторинга) =================
   doAttack/damageUnit/healUnit/die — перенесено дословно из engine.ts
   (текст уже с G.-префиксами). Циклы импортов с statuses/abilities/
   progression/quests — на уровне функций (ESM-safe). */
import { lunge, faceTo, tween } from '../fx/tweens';
import { roll } from '../rng';
import { sfx } from '../audio';
import { slowmo } from '../slowmo';
import { fx, glows } from '../render/renderer';
import { ftextAbove, log, refreshIcons } from '../ui/overlays';
import { G, S, busyOn, busyOff } from '../state';
import { refreshInit, refreshParty, refreshBossBar } from '../ui/party';
import { addStatus } from './statuses';
import { explodeBarrel } from './abilities';
import { awardXP, checkEnd } from './progression';
import { rollLoot } from './loot';
import { questObj, questDone } from '../interact/quests';
import { removeUnit } from '../entities/units';
import type { Barrel } from '../types';

export async function doAttack(att,def,w,opts?){
  opts=opts||{};
  if(!att.alive||!def.alive)return;
  busyOn();
  faceTo(att,def.mesh.position);
  sfx.swing(w);
  /* v0.7.x: выпад корпусом (работает и для GLTF-рига) */
  void tween(0.26,k=>{if(att.rig)att.rig.rotation.x=Math.sin(k*Math.PI)*0.5;});
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
  if(opts.aoo)refreshInit();
  busyOff();
}
export function damageUnit(t,dmg,src){
  if(!t||!t.alive)return;
  t.hp-=dmg;
  refreshBossBar();/* v0.8: боссбар живёт в реальном времени */
  if(t.hp<=0)die(t,src);
}
export function healUnit(u,amt,why){
  if(!u.alive)return;
  const before=u.hp;
  u.hp=Math.min(u.maxhp,u.hp+amt);
  refreshBossBar();/* v0.8 */
  ftextAbove(u,'+'+(u.hp-before),'#8fd36a');
  sfx.heal();
  fx.burstAtMesh(u,{count:18,color:0x8fd36a,speed:1.5,size:0.11,life:0.9,gravity:-1.1});
  glows.flashAtMesh(u,0x8fd36a,1.1);
  log(u.name+' восстанавливает '+(u.hp-before)+' HP ('+why+').','g-heal');
  refreshParty();
}


export function die(t,src){
  if(!t.alive)return;
  if(t.isBarrel){explodeBarrel(t);return;}
  t.alive=false;t.hp=0;
  log(t.name+' повержен!','g-sys');
  ftextAbove(t,'Повержен','#d8b45a');
  sfx.death();
  fx.burstAtMesh(t,{count:22,color:0x7a2f2f,speed:2.4,size:0.12,life:0.7});
  const m=t.mesh;
  tween(0.5,k=>{m.rotation.z=1.35*k*k;m.position.y=-0.12*k;});
  refreshIcons(t);refreshInit();refreshParty();
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
  checkEnd();
}
