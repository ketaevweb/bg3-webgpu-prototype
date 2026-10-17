/* ================= QUESTS (Фазы 4–6 рефакторинга) =================
   Журнал заданий, награды, золото, трекер. Фаза 5: данные (QUESTS/
   QUEST_REWARD) — в листе interact/questData.ts; refreshTracker привязан
   к шине bus. Фаза 6: трекер и журнал — view-модели в zustand-стор
   (React-HUD); биндинг journalOnClose — кнопка «Закрыть (J)». 1:1. */
import { sfx } from '../audio';
import { S } from '../state';
import { bus } from '../bus';
import { useUi, uiSet } from '../ui/store';
import { bigBanner, log } from '../ui/overlays';
import { aliveHeroes } from '../entities/units';
import { awardXP } from '../systems/progression';
import { QUESTS, QUEST_REWARD } from './questData';

/* реэкспорт данных — существующие импорты (engine/snapshot/maps/dialog/shop)
   продолжают работать; новые модули могут импортировать прямо из questData */
export { QUESTS, QUEST_REWARD };

export const questActive=(id:string):boolean=>QUESTS[id].state==='active';
export function questStart(id:string){
  const q=QUESTS[id];
  if(q.state!=='hidden')return;
  q.state='active';
  bigBanner('НОВОЕ ЗАДАНИЕ');
  log('Новое задание: «'+q.name+'».','g-sys');
  refreshTracker();
}
export function questObj(id:string,k:string){
  const q=QUESTS[id];
  if(q.state==='hidden')q.state='active';
  const o=q.objs.find(o=>o.k===k);
  if(o&&!o.done){o.done=true;log('«'+q.name+'»: '+o.t+' — выполнено!','g-heal');refreshTracker();}
}
export function questDone(id:string){
  const q=QUESTS[id];
  if(q.state==='done')return;
  q.state='done';
  if(id==='main'){gainGold(150);awardXP(300);}
  if(id==='prisoner'){
    gainGold(100);awardXP(150);
    const m=aliveHeroes().find(h=>h.cls==='wizard');
    if(m){m.cha+=1;log('Илва дарит кулон красноречия: ХАР '+m.short+' +1.','g-sys');}
  }
  if(id==='crate'){gainGold(100);awardXP(150);S.discount=true;}
  if(id==='crypt'){gainGold(150);awardXP(300);log('Крипта очистилась — мертвецы тракта больше не поднимутся.','g-heal');}
  bigBanner('ЗАДАНИЕ ВЫПОЛНЕНО');
  log('Задание «'+q.name+'» выполнено! Награда: '+QUEST_REWARD[id]+'.','g-heal');
  refreshTracker();bus.refreshParty.call();
}
export function gainGold(n:number){S.gold+=n;refreshTracker();sfx.gold();}
export function refreshTracker(){
  const quests=Object.keys(QUESTS).filter(id=>QUESTS[id].state==='active').map(id=>({
    name:QUESTS[id].name,
    objs:QUESTS[id].objs.map(o=>({t:o.t,done:o.done})),
  }));
  uiSet({tracker:{gold:'Золото: '+S.gold+(S.discount?' · скидка 20%':''),quests}});
}
export function toggleJournal(){
  if(useUi.getState().journalOpen){closeJournal();return;}
  renderJournal();uiSet({journalOpen:true});sfx.ui();
}
export function closeJournal(){uiSet({journalOpen:false});}
export function renderJournal(){
  const items=Object.keys(QUESTS).filter(id=>QUESTS[id].state!=='hidden').map(id=>{
    const q=QUESTS[id];
    return {name:q.name,done:q.state==='done',desc:q.desc,
      objs:q.objs.map(o=>({t:o.t,done:o.done})),reward:QUEST_REWARD[id]};
  });
  uiSet({journalItems:items});
}

/* ---- регистрация на шине (Фаза 5: progression → refreshTracker без цикла) ---- */
bus.refreshTracker.bind(refreshTracker);
/* ---- биндинг UI-колбэка (Фаза 6: кнопка «Закрыть (J)») ---- */
uiSet({journalOnClose:closeJournal});
