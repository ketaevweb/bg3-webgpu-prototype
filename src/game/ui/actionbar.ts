/* ================= ACTIONBAR (Фазы 4–6 рефакторинга) =================
   Таблица действий игрока (ACTIONS) и refreshUI. Фаза 5: refreshUI живёт
   на шине bus. Фаза 6: вместо DOM — view-модель в zustand-стор
   (React-HUD рендерит кнопки; клики — колбэки ACTIONS.run). 1:1. */
import { roll } from '../rng';
import { G } from '../state';
import { bus } from '../bus';
import { uiSet } from './store';
import { enterTarget, cancelTargeting } from './targeting';
import { radiantNova } from '../systems/abilities';
import { endTurn } from '../systems/turns';
import { addStatus } from '../systems/statuses';
import { healUnit } from '../systems/vitals';
import { log } from './overlays';
import { showReach } from './markers';
import type { ActionDef } from '../types';

/* ================= ДЕЙСТВИЯ ИГРОКА ================= */
export const ACTIONS:ActionDef[]=[
  {label:'Атака',sub:'Действие',enabled:h=>h.action>0,run:_h=>enterTarget('attack')},
  {label:'Огненные стрелы',sub:'Действие',cls:'wiz',only:h=>h.cls==='wizard',enabled:h=>h.action>0,run:_h=>enterTarget('bolt')},
  {label:'Огненный шар',sub:'Действие · ячейка',cls:'wiz',only:h=>h.cls==='wizard',enabled:h=>h.action>0&&h.slots>0,run:_h=>enterTarget('fireball')},
  {label:'Благословение',sub:'Бонус · ячейка',cls:'wiz',only:h=>h.cls==='wizard',enabled:h=>h.bonus>0&&h.slots>0,run:_h=>enterTarget('bless')},
  {label:'Лечащее слово',sub:'Бонус · ячейка',cls:'wiz',only:h=>h.cls==='wizard',enabled:h=>h.bonus>0&&h.slots>0,run:_h=>enterTarget('heal')},
  /* v1.2: умения Илвы-плута */
  {label:'Подлый удар',sub:'Действие · +1d6 во фланге',cls:'rog',only:h=>h.cls==='rogue',enabled:h=>h.action>0,run:_h=>enterTarget('sneak')},
  {label:'Отравленный клинок',sub:'Бонус · яд',cls:'rog',only:h=>h.cls==='rogue',enabled:h=>h.bonus>0,
    run:h=>{h.bonus--;h.poisonBlade=2;log(h.name+' смазывает клинок ядом: следующая ближняя атака отравит.','g-sys');renderUI();}},
  {label:'Уклонение',sub:'Бонус · КД +3',cls:'rog',only:h=>h.cls==='rogue',enabled:h=>h.bonus>0,
    run:h=>{h.bonus--;addStatus(h,'dodge',1);renderUI();showReach(h);}},
  /* v1.2: умения жрицы Кая */
  {label:'Лечение',sub:'Действие · ячейка',cls:'cle',only:h=>h.cls==='cleric',enabled:h=>h.action>0&&h.slots>0,run:_h=>enterTarget('cure')},
  {label:'Щит веры',sub:'Бонус · ячейка',cls:'cle',only:h=>h.cls==='cleric',enabled:h=>h.bonus>0&&h.slots>0,
    run:h=>{h.bonus--;h.slots--;addStatus(h,'faith',3);renderUI();showReach(h);}},
  {label:'Карание света',sub:'Действие · ячейка',cls:'cle',only:h=>h.cls==='cleric',enabled:h=>h.action>0&&h.slots>0,run:_h=>enterTarget('smite')},
  {label:'Гнев рассвета',sub:'Действие · 1/бой',cls:'cle',only:h=>h.cls==='cleric',enabled:h=>h.action>0&&!h.dawnUsed,run:h=>radiantNova(h)},
  /* v1.5: умения друида Ольхи */
  {label:'Разряд молнии',sub:'Действие · ячейка',cls:'wiz',only:h=>h.cls==='druid',enabled:h=>h.action>0&&h.slots>0,run:_h=>enterTarget('spark')},
  {label:'Облако спор',sub:'Действие · ячейка',cls:'wiz',only:h=>h.cls==='druid',enabled:h=>h.action>0&&h.slots>0,run:_h=>enterTarget('spore')},
  /* v1.9: умения паладина Хальдира */
  {label:'Карающий удар',sub:'Действие · ячейка',cls:'cle',only:h=>h.cls==='paladin',enabled:h=>h.action>0&&h.slots>0,run:_h=>enterTarget('smite')},
  {label:'Аура дозора',sub:'Бонус · ячейка · КД +2',cls:'cle',only:h=>h.cls==='paladin',enabled:h=>h.bonus>0&&h.slots>0,
    run:h=>{h.bonus--;h.slots--;addStatus(h,'faith',3);log(h.name+' воздевает знамя — аура дозора держит строй!','g-hero');renderUI();showReach(h);}},
  {label:'Наложение рук',sub:'Бонус · 1/бой',cls:'cle',only:h=>h.cls==='paladin',enabled:h=>h.bonus>0&&!h.dawnUsed,
    run:h=>{h.bonus--;h.dawnUsed=true;healUnit(h,roll(1,8)+2,'наложение рук');renderUI();showReach(h);}},
  {label:'Второе дыхание',sub:'Бонус · 1/бой',enabled:h=>h.bonus>0&&!h.swUsed,only:h=>h.cls==='fighter',
    run:h=>{h.bonus--;h.swUsed=true;healUnit(h,roll(1,10)+1,'второе дыхание');renderUI();showReach(h);}},
  {label:'Доп. действие',sub:'1/бой',enabled:h=>(h.surge||0)>0,only:h=>h.cls==='fighter'&&h.level>=2,
    run:h=>{h.surge--;h.action=Math.min(2,h.action+1);log(h.name+': дополнительное действие!','g-sys');renderUI();}},
  {label:'Рывок',sub:'Бонус · +3 кл.',enabled:h=>h.bonus>0,
    run:h=>{h.bonus--;h.moveLeft+=3;log(h.name+' ускоряется.','g-sys');renderUI();showReach(h);}},
  {label:'Отход',sub:'Действие',enabled:h=>h.action>0,
    run:h=>{h.action--;h.disengaging=true;log(h.name+' уклоняется от атак по возможности.','g-sys');renderUI();}},
  {label:'Зелье лечения',sub:'Бонус · 2d4+2',enabled:h=>h.bonus>0&&h.potions>0,
    run:h=>{h.bonus--;h.potions--;healUnit(h,roll(2,4)+2,'зелье');renderUI();}},
  {label:'Огненное масло',sub:'Действие · бросок',only:h=>(h.oil||0)>0,enabled:h=>h.action>0&&(h.oil||0)>0,
    run:_h=>enterTarget('oil')},
  {label:'Завершить ход',sub:'',cls:'end',enabled:()=>true,run:()=>{cancelTargeting();endTurn();}},
];


/* ================= UI ================= */
function renderUI(){
  if(G.phase==='explore'||G.phase==='dialogue')return;
  const h=G.current&&G.current.side==='hero'?G.current:null;
  if(h){
    uiSet({actionbar:{visible:true,waiting:false,pips:[
      {label:'Действие',value:String(h.action)},
      {label:'Бонус',value:String(h.bonus)},
      {label:'Реакция',value:String(h.reaction)},
      {label:'Перемещение',value:h.moveLeft+' кл.'},
      {label:'Ячейки',value:h.slotsMax?h.slots+'/'+h.slotsMax:'—'},
    ],btns:ACTIONS.filter(a=>!a.only||a.only(h)).map(a=>({
      label:a.label+(a.sub?' · '+a.sub:''),
      cls:a.cls,
      disabled:!a.enabled(h)||G.phase!=='player',
      onClick:()=>{if(G.phase==='player'&&!G.busy)a.run(h);},
    }))}});
  }else{
    uiSet({actionbar:{visible:true,waiting:true,pips:[],btns:[]}});
  }
  bus.refreshParty.call();
}

/* ---- регистрация на шине (Фаза 5: разрыв циклов на ui) ---- */
bus.refreshUI.bind(renderUI);
