/* ================= TUTORIAL (v1.4 «Наставник дозора») =================
   Ненавязчивое обучение: карточка «Наставник» продвигается по РЕАЛЬНЫМ
   действиям игрока — движение отряда, разговор, бой, атака, умение,
   конец хода, сохранение. События идут через шину bus.tutEvent
   (владелец реализации — этот модуль; вызовы — explore/dialog/turns/
   combat/targeting/slots: верхние слои зовут bus, прямых импортов нет).
   Прыжок вперёд: событие с большим индексом засчитывает пропущенные
   шаги (игрок уже умнее подсказки), отматывать назад нельзя.
   Прогресс — в localStorage (bg3w_tut_v1); формат сейва v2 НЕ затронут.
   React-карточка (components/hud/Hud.tsx) читает view-модель tut из стора. */
import { bus } from '../bus';
import { uiSet } from './store';
import { log } from './overlays';
import { sfx } from '../audio';

const LS_KEY='bg3w_tut_v1';

export interface TutStepDef{id:string;title:string;text:string;}
export const TUT_STEPS:readonly TutStepDef[]=[
  {id:'move',  title:'Ход отряда',      text:'ЛКМ по земле — отряд идёт сам (A*). В бою путь ограничен запасом движения за ход.'},
  {id:'talk',  title:'Разговор',        text:'Подойдите к НПС и нажмите E или кликните по нему. Проверки d20+ХАР меняют мир: убеждение, запугивание, скидки.'},
  {id:'fight', title:'Первый бой',      text:'Клик по врагу или приближение к патрулю начинает бой. Порядок хода решает бросок инициативы.'},
  {id:'attack',title:'Атака',           text:'Выберите врага в пределах досягаемости — тултип цели покажет шанс попадания и средний урон.'},
  {id:'spell', title:'Способность',     text:'Умения — на панели действий: заклинания тратят ячейки, огненный шар бьёт по площади, жрица лечит и благословляет.'},
  {id:'end',   title:'Конец хода',      text:'Пробел или кнопка «Завершить ход» передают инициативу. Дождитесь следующего хода героя.'},
  {id:'save',  title:'Скрижаль судьбы', text:'K или 💾 — сохранения: три слота, экспорт/импорт JSON и облачные скрижали (IndexedDB).'},
] as const;

let step=0,done=false;

function persist(){try{localStorage.setItem(LS_KEY,JSON.stringify({step,done}));}catch{/* приватный режим — обучение просто не переживёт ремоунт */}}

function show(){
  const s=TUT_STEPS[step];
  uiSet({tut:s?{title:s.title,text:s.text,i:step+1,n:TUT_STEPS.length,onSkip:tutSkip}:null});
}
function finish(msg:string){
  done=true;persist();
  uiSet({tut:null});
  log(msg,'g-sys');
  sfx.bless();
}

export function tutSkip(){
  if(!done)finish('Обучение пропущено. Шпаргалка клавиш — в приветственных строках журнала и в README.');
}

export function tutEvent(id:string){
  if(done)return;
  const idx=TUT_STEPS.findIndex(s=>s.id===id);
  if(idx<0||idx<step)return;/* старое/неизвестное событие — назад не отматываем */
  step=idx+1;persist();
  if(step>=TUT_STEPS.length){
    finish('Обучение завершено! Долгий Дозор помнит каждый урок — удачи на тракте.');
    return;
  }
  show();
}

/* текущее состояние (E2E-инспектор __bg3.tut) */
export function tutState(){return{step,done};}

/* вызов из bootGame (после renderSaves/loadGfx): side-effect импорта
   не повторяется при ремоуте, поэтому восстановление прогресса — здесь */
export function initTutorial(){
  try{
    const raw=localStorage.getItem(LS_KEY);
    if(raw){
      const sv=JSON.parse(raw) as {step?:number;done?:boolean};
      done=!!sv.done;
      step=done?TUT_STEPS.length:Math.max(0,Math.min(TUT_STEPS.length-1,sv.step||0));
    }
  }catch{}
  uiSet({tut:null});
  if(!done)show();
}

/* биндинг шины (side-effect импорта из engine.ts, до bootGame) */
bus.tutEvent.bind(tutEvent);
