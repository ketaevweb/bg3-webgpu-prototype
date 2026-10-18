/* ================= PROGRESSION (Фазы 4–5 рефакторинга) =================
   Конец боя, победа, XP/уровни, экран финала. Фаза 5: цикл
   quests⇄progression разорван — данные квестов из листа questData.ts,
   refreshTracker/checkTriggers — через шину bus; цикл progression→party
   разорван (openExploreUI/refreshParty/refreshBossBar — через bus);
   healUnit — из vitals.ts (разрыв progression→combat). Перенесено дословно. */
import { roll } from '../rng';
import { sfx } from '../audio';
import { G, S, units } from '../state';
import { XP_NEED } from '../constants';
import { bus } from '../bus';
import { uiSet } from '../ui/store';
import { bigBanner, log } from '../ui/overlays';
import { aliveHeroes, removeUnit } from '../entities/units';
import { healUnit } from './vitals';
import { tween } from '../fx/tweens';
import { fx, glows } from '../render/renderer';
import { QUESTS } from '../interact/questData';
import type { Unit } from '../types';

/* ================= ВОЛНЫ / ОПЫТ / УРОВНИ ================= */
export function checkEnd(){
  if(!G.combatOn)return;
  if(!aliveHeroes().length){G.combatOn=false;for(const u of units)u.inCombat=false;G.phase='over';sfx.stinger('defeat');showEnd(false);return;}
  if(S.combatGroup.some(g=>g.alive))return;
  G.combatOn=false;for(const u of units)u.inCombat=false;/* v1.7: выходим из боевой стойки */
  G.phase='explore';
  victorySequence();
}
export function victorySequence(){
  log('=== ПОБЕДА! ===','g-sys');
  bigBanner('ПОБЕДА!');
  sfx.stinger('victory');
  fx.burstAtMesh(aliveHeroes()[0]||units[0],{count:36,color:0xffd54f,speed:3.2,size:0.14,life:1.1,gravity:-1.2});
  for(const h of aliveHeroes())healUnit(h,roll(2,6)+2,'перевязка после боя');
  const summ=units.filter(x=>x.summoned&&x.alive);/* v0.8: призраки рассыпаются */
  for(const s of summ){
    log(s.name+' рассыпается прахом без воли хозяина.','g-sys');
    s.alive=false;
    fx.burstAtMesh(s,{count:14,color:0xbfc8b8,speed:1.8,size:0.1,life:0.7});
    const m=s.mesh;
    tween(0.5,k=>{m.scale.setScalar(Math.max(0.01,1-k));m.rotation.z=1.1*k;}).then(()=>removeUnit(s));
  }
  bus.openExploreUI.call();
  bus.refreshBossBar.call();
  if(S.combatGroup.some(g=>g.isBoss))setTimeout(()=>showEnd(true),2000);
  else bus.checkTriggers.call();
}
export function awardXP(n:number){
  for(const h of aliveHeroes()){
    h.xp+=n;
    while(h.xp>=XP_NEED(h.level)&&h.level<3)levelUp(h);
  }
  log('Отряд получает '+n+' XP.','g-sys');
  sfx.xp();
  bus.refreshParty.call();bus.refreshTracker.call();
}
export function levelUp(h:Unit){
  h.level++;
  if(h.cls==='fighter'){
    h.maxhp+=8;h.hp+=8;
    if(h.level===2){h.str+=1;h.surge=1;
      log(h.name+' — УРОВЕНЬ 2! +8 HP, СИЛ +1, открыто «Доп. действие» (1/бой).','g-sys');}
    else{h.surge=2;
      log(h.name+' — УРОВЕНЬ 3! +8 HP, «Доп. действие» теперь 2/бой.','g-sys');}
  }else if(h.cls==='rogue'){/* v1.2 */
    h.maxhp+=6;h.hp+=6;
    if(h.level===2){h.dex+=1;
      log(h.name+' — УРОВЕНЬ 2! +6 HP, ЛОВ +1.','g-sys');}
    else{
      log(h.name+' — УРОВЕНЬ 3! +6 HP, подлый удар усилен до 2d6.','g-sys');}
  }else if(h.cls==='cleric'){/* v1.2 */
    h.maxhp+=6;h.hp+=6;
    if(h.level===2){h.wis+=1;h.slotsMax=3;h.slots=3;
      log(h.name+' — УРОВЕНЬ 2! +6 HP, МДР +1, ячеек заклинаний теперь 3.','g-sys');}
    else{h.slotsMax=4;h.slots=4;
      log(h.name+' — УРОВЕНЬ 3! +6 HP, ячеек заклинаний теперь 4.','g-sys');}
  }else if(h.cls==='druid'){/* v1.5: друид растёт как жрица */
    h.maxhp+=6;h.hp+=6;
    if(h.level===2){h.wis+=1;h.slotsMax=3;h.slots=3;
      log(h.name+' — УРОВЕНЬ 2! +6 HP, МДР +1, ячеек заклинаний теперь 3.','g-sys');}
    else{h.slotsMax=4;h.slots=4;
      log(h.name+' — УРОВЕНЬ 3! +6 HP, ячеек заклинаний теперь 4.','g-sys');}
  }else{
    h.maxhp+=5;h.hp+=5;
    if(h.level===2){h.int+=1;h.slotsMax=4;h.slots=4;
      log(h.name+' — УРОВЕНЬ 2! +5 HP, ИНТ +1, ячеек заклинаний теперь 4.','g-sys');}
    else{h.slotsMax=5;h.slots=5;
      log(h.name+' — УРОВЕНЬ 3! +5 HP, ячеек заклинаний теперь 5.','g-sys');}
  }
  bigBanner('УРОВЕНЬ '+h.level+'!');
  /* v0.7: фанфары + золотой взрыв */
  sfx.levelUp();
  fx.burstAtMesh(h,{count:40,color:0xffd54f,speed:3,size:0.15,life:1.1,gravity:-1.4});
  glows.flashAtMesh(h,0xffd54f,1.6);
  bus.refreshParty.call();
}
export function showEnd(win:boolean){
  const lv=units.find(u=>u.side==='hero');
  const fin=S.campaignDone&&win;/* v1.8: финал кампании */
  let stats:string;
  if(win){
    const qd=Object.values(QUESTS).filter(q=>q.state==='done').length;
    const total=Object.keys(QUESTS).length;
    stats=fin
      ?'КАМПАНИЯ ЗАВЕРШЕНА! Малвех свободен, цитадель — снова дом Долгого Дозора, а тракт от леса до глубин — чист. Заданий: '+qd+'/'+total+' • Опыт: '+(lv?lv.xp:0)+' • Золото: '+S.gold+'. Долгой памяти — и Долгого Дозора!'
      :'Заданий выполнено: '+qd+'/'+total+' • Опыт: '+(lv?lv.xp:0)+' • Золото: '+S.gold+'.'
        +(qd>=total?' Долгий Дозор будет помнить вас: тракт свободен — и от гоблинов, и от мертвецов!':'');
  }else{
    stats='Отряд пал в бою. Попробуйте иную тактику: огонь, бочки и переговоры.';
  }
  uiSet({endHidden:false,end:{
    title:fin?'ДОЛГОЙ ДОЗОР!':(win?'ПОБЕДА!':'ПОРАЖЕНИЕ'),
    color:win?'#d8b45a':'#e06c55',
    stats,
    canContinue:win,
  }});
}
