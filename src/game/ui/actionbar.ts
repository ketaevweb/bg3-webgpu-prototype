/* ================= ACTIONBAR (Фаза 4 рефакторинга) =================
   Таблица действий игрока (ACTIONS) и refreshUI. Цикл импортов
   actionbar⇄targeting — на уровне функций (ESM-safe).
   Перенесено дословно из engine.ts. */
import { $ } from '../utils';
import { roll } from '../rng';
import { UI } from '../hud';
import { G } from '../state';
import { enterTarget, cancelTargeting } from './targeting';
import { radiantNova } from '../systems/abilities';
import { endTurn } from '../systems/turns';
import { healUnit } from '../systems/combat';
import { addStatus } from '../systems/statuses';
import { log } from '../ui/overlays';
import { showReach } from '../ui/markers';
import { refreshParty } from './party';
import type { Unit } from '../types';

/* ================= ДЕЙСТВИЯ ИГРОКА ================= */
export const ACTIONS=[
  {label:'Атака',sub:'Действие',enabled:h=>h.action>0,run:h=>enterTarget('attack')},
  {label:'Огненные стрелы',sub:'Действие',cls:'wiz',only:h=>h.cls==='wizard',enabled:h=>h.action>0,run:h=>enterTarget('bolt')},
  {label:'Огненный шар',sub:'Действие · ячейка',cls:'wiz',only:h=>h.cls==='wizard',enabled:h=>h.action>0&&h.slots>0,run:h=>enterTarget('fireball')},
  {label:'Благословение',sub:'Бонус · ячейка',cls:'wiz',only:h=>h.cls==='wizard',enabled:h=>h.bonus>0&&h.slots>0,run:h=>enterTarget('bless')},
  {label:'Лечащее слово',sub:'Бонус · ячейка',cls:'wiz',only:h=>h.cls==='wizard',enabled:h=>h.bonus>0&&h.slots>0,run:h=>enterTarget('heal')},
  /* v1.2: умения Илвы-плута */
  {label:'Подлый удар',sub:'Действие · +1d6 во фланге',cls:'rog',only:h=>h.cls==='rogue',enabled:h=>h.action>0,run:h=>enterTarget('sneak')},
  {label:'Отравленный клинок',sub:'Бонус · яд',cls:'rog',only:h=>h.cls==='rogue',enabled:h=>h.bonus>0,
    run:h=>{h.bonus--;h.poisonBlade=2;log(h.name+' смазывает клинок ядом: следующая ближняя атака отравит.','g-sys');refreshUI();}},
  {label:'Уклонение',sub:'Бонус · КД +3',cls:'rog',only:h=>h.cls==='rogue',enabled:h=>h.bonus>0,
    run:h=>{h.bonus--;addStatus(h,'dodge',1);refreshUI();showReach(h);}},
  /* v1.2: умения жрицы Кая */
  {label:'Лечение',sub:'Действие · ячейка',cls:'cle',only:h=>h.cls==='cleric',enabled:h=>h.action>0&&h.slots>0,run:h=>enterTarget('cure')},
  {label:'Щит веры',sub:'Бонус · ячейка',cls:'cle',only:h=>h.cls==='cleric',enabled:h=>h.bonus>0&&h.slots>0,
    run:h=>{h.bonus--;h.slots--;addStatus(h,'faith',3);refreshUI();showReach(h);}},
  {label:'Карание света',sub:'Действие · ячейка',cls:'cle',only:h=>h.cls==='cleric',enabled:h=>h.action>0&&h.slots>0,run:h=>enterTarget('smite')},
  {label:'Гнев рассвета',sub:'Действие · 1/бой',cls:'cle',only:h=>h.cls==='cleric',enabled:h=>h.action>0&&!h.dawnUsed,run:h=>radiantNova(h)},
  {label:'Второе дыхание',sub:'Бонус · 1/бой',enabled:h=>h.bonus>0&&!h.swUsed,only:h=>h.cls==='fighter',
    run:h=>{h.bonus--;h.swUsed=true;healUnit(h,roll(1,10)+1,'второе дыхание');refreshUI();showReach(h);}},
  {label:'Доп. действие',sub:'1/бой',enabled:h=>(h.surge||0)>0,only:h=>h.cls==='fighter'&&h.level>=2,
    run:h=>{h.surge--;h.action=Math.min(2,h.action+1);log(h.name+': дополнительное действие!','g-sys');refreshUI();}},
  {label:'Рывок',sub:'Бонус · +3 кл.',enabled:h=>h.bonus>0,
    run:h=>{h.bonus--;h.moveLeft+=3;log(h.name+' ускоряется.','g-sys');refreshUI();showReach(h);}},
  {label:'Отход',sub:'Действие',enabled:h=>h.action>0,
    run:h=>{h.action--;h.disengaging=true;log(h.name+' уклоняется от атак по возможности.','g-sys');refreshUI();}},
  {label:'Зелье лечения',sub:'Бонус · 2d4+2',enabled:h=>h.bonus>0&&h.potions>0,
    run:h=>{h.bonus--;h.potions--;healUnit(h,roll(2,4)+2,'зелье');refreshUI();}},
  {label:'Огненное масло',sub:'Действие · бросок',only:h=>(h.oil||0)>0,enabled:h=>h.action>0&&(h.oil||0)>0,
    run:h=>enterTarget('oil')},
  {label:'Завершить ход',sub:'',cls:'end',enabled:()=>true,run:()=>{cancelTargeting();endTurn();}},
];


/* ================= UI ================= */
export function refreshUI(){
  if(G.phase==='explore'||G.phase==='dialogue')return;
  const h=G.current&&G.current.side==='hero'?G.current:null;
  if(h){
    $(UI.pips).innerHTML=
      '<span>Действие <b>'+h.action+'</b></span>'+
      '<span>Бонус <b>'+h.bonus+'</b></span>'+
      '<span>Реакция <b>'+h.reaction+'</b></span>'+
      '<span>Перемещение <b>'+h.moveLeft+'</b> кл.</span>'+
      '<span>Ячейки <b>'+(h.slotsMax?h.slots+'\/'+h.slotsMax:'—')+'</b></span>';
  }else{
    $(UI.pips).innerHTML='<span>Ход противника…</span>';
  }
  const bb=$(UI.btns);
  bb.innerHTML='';
  if(!h){
    bb.innerHTML='<button disabled>Ожидание…</button>';
    return;
  }
  for(const a of ACTIONS){
    if(a.only&&!a.only(h))continue;
    const b=document.createElement('button');
    b.textContent=a.label+(a.sub?' · '+a.sub:'');
    if(a.cls)b.className=a.cls;
    b.disabled=!a.enabled(h)||G.phase!=='player';
    b.onclick=()=>{if(G.phase==='player'&&!G.busy)a.run(h);};
    bb.appendChild(b);
  }
  refreshParty();
}
