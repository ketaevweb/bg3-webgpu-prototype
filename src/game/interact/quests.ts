/* ================= QUESTS (Фазы 4–5 рефакторинга) =================
   Журнал заданий, награды, золото, трекер. Фаза 5: данные (QUESTS/
   QUEST_REWARD) переехали в лист interact/questData.ts (разрыв цикла
   quests⇄progression — progression.showEnd читает данные); refreshParty —
   через шину bus; refreshTracker привязан к шине (progression зовёт через
   bus). Перенесено дословно из engine.ts. */
import { $ } from '../utils';
import { UI } from '../hud';
import { sfx } from '../audio';
import { S } from '../state';
import { bus } from '../bus';
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
  $(UI.goldTxt).textContent='Золото: '+S.gold+(S.discount?' · скидка 20%':'');
  const el=$(UI.qbody);el.innerHTML='';
  for(const id in QUESTS){
    const q=QUESTS[id];
    if(q.state!=='active')continue;
    const d=document.createElement('div');
    d.className='q';
    d.innerHTML='<div class="qn">'+q.name+'</div>'+q.objs.map(o=>
      '<div class="qo'+(o.done?' done':'')+'">'+(o.done?'✓':'·')+' '+o.t+'</div>').join('');
    el.appendChild(d);
  }
  if(!el.children.length)el.innerHTML='<div class="qo">Активных заданий нет. Поговорите с Дамроком или идите на север.</div>';
}
export function toggleJournal(){const j=$(UI.journal);if(j.style.display==='block'){closeJournal();return;}renderJournal();j.style.display='block';sfx.ui();}
export function closeJournal(){$(UI.journal).style.display='none';}
export function renderJournal(){
  const el=$(UI.jbody);el.innerHTML='';
  for(const id in QUESTS){
    const q=QUESTS[id];
    if(q.state==='hidden')continue;
    const d=document.createElement('div');
    d.className='jq';
    d.innerHTML='<div class="jn">'+q.name+'<span class="jst'+(q.state==='done'?' done':'')+'">'+
      (q.state==='done'?'выполнено':'активно')+'</span></div>'+
      '<div class="jd">'+q.desc+'</div>'+
      q.objs.map(o=>'<div class="jo'+(o.done?' done':'')+'">'+(o.done?'✓':'○')+' '+o.t+'</div>').join('')+
      '<div class="jr">Награда: '+QUEST_REWARD[id]+'</div>';
    el.appendChild(d);
  }
}

/* ---- регистрация на шине (Фаза 5: progression → refreshTracker без цикла) ---- */
bus.refreshTracker.bind(refreshTracker);
