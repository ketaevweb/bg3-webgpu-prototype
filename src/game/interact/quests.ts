/* ================= QUESTS (Фаза 4 рефакторинга) =================
   Журнал заданий, награды, золото, трекер. Цикл импортов
   quests⇄progression — на уровне функций (ESM-safe).
   Перенесено дословно из engine.ts. */
import { $ } from '../utils';
import { UI } from '../hud';
import { sfx } from '../audio';
import { S } from '../state';
import { bigBanner, log } from '../ui/overlays';
import { refreshParty } from '../ui/party';
import { aliveHeroes } from '../entities/units';
import { awardXP } from '../systems/progression';
import type { Quest } from '../types';

/* ================= v0.6: ЗАДАНИЯ, ДИАЛОГИ, ТОРГОВЛЯ, ИССЛЕДОВАНИЕ ================= */
export const QUESTS:Record<string,Quest>={
  main:{name:'Кости и пепел',state:'active',
    desc:'Гоблины племени Костей перекрыли торговый тракт. Разгромите их лагерь на севере и убейте вожака.',
    objs:[{k:'boss',t:'Убить вожака Грата Костолома',done:false}]},
  prisoner:{name:'Свободу разведчице',state:'hidden',
    desc:'Западнее гоблинского лагеря в клетке томится Илва — разведчица Долгого Дозора.',
    objs:[{k:'free',t:'Освободить Илву',done:false}]},
  crate:{name:'Похищенный товар',state:'hidden',
    desc:'Гоблины утащили у Дамрока ящик с товаром. Он где-то в их лагере.',
    objs:[{k:'find',t:'Найти ящик в лагере',done:false},{k:'return',t:'Вернуть ящик Дамроку',done:false}]},
  crypt:{name:'Сердце крипты',state:'hidden',/* v0.8 */
    desc:'Мертвецы тракта — не гоблинская работа. Под курганом на северо-востоке открылась крипта, где сидит некромант Вхорил Костепёр и дёргает за ниточки своих костяных кукол.',
    objs:[{k:'enter',t:'Спуститься в крипту',done:false},{k:'boss',t:'Уничтожить Костепёра',done:false}]},
};
export const QUEST_REWARD:Record<string,string>={
  main:'300 XP, 150 зол.',
  prisoner:'150 XP, 100 зол., кулон красноречия',
  crate:'150 XP, 100 зол., вечная скидка',
  crypt:'300 XP, 150 зол., перстень Костепёра',
};
export function questActive(id){return QUESTS[id].state==='active';}
export function questStart(id){
  const q=QUESTS[id];
  if(q.state!=='hidden')return;
  q.state='active';
  bigBanner('НОВОЕ ЗАДАНИЕ');
  log('Новое задание: «'+q.name+'».','g-sys');
  refreshTracker();
}
export function questObj(id,k){
  const q=QUESTS[id];
  if(q.state==='hidden')q.state='active';
  const o=q.objs.find(o=>o.k===k);
  if(o&&!o.done){o.done=true;log('«'+q.name+'»: '+o.t+' — выполнено!','g-heal');refreshTracker();}
}
export function questDone(id){
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
  refreshTracker();refreshParty();
}
export function gainGold(n){S.gold+=n;refreshTracker();sfx.gold();}
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
