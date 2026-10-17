/* ================= TARGETING (Фазы 4–5 рефакторинга) =================
   Выбор цели/клетки, отмена, применение (resolveTargetClick), тултип.
   BOLT/SMITE — общие боевые «заговоры». Фаза 5: refreshUI — через шину bus
   (разрыв цикла targeting→actionbar); explode — из combat (переехал из
   abilities). Перенесено дословно из engine.ts. */
import { $, cheb, mod } from '../utils';
import { roll } from '../rng';
import { UI } from '../hud';
import { GRID, RANGE_FB, RANGE_OIL, STATUS } from '../constants';
import { G, units, barrels, pick, GW, busyOn, busyOff } from '../state';
import { bus } from '../bus';
import { addMarker, clearMarkers, clearDots, showReach } from '../ui/markers';
import { setHint, log, ftextAbove } from '../ui/overlays';
import { passable } from '../world/grid';
import { doAttack, hitChance, avgDamage, explode } from '../systems/combat';
import { healUnit } from '../systems/vitals';
import { castFireball } from '../systems/abilities';
import { addStatus } from '../systems/statuses';
import { aliveHeroes } from '../entities/units';
import type { Interact, TargetType, Unit, Weapon } from '../types';

export const BOLT:Weapon={name:'Огненные стрелы',dice:[1,10],abil:'int',range:9,fire:true};
export const SMITE:Weapon={name:'Карание света',dice:[2,6],abil:'wis',range:6,smite:true};/* v1.2 */



/* A* и достижимость → world/grid.ts (Фаза 2): astar/reachNodes/nodePath
   принимают GW первым аргументом (явный контекст сетки). */


export function enterTarget(type:TargetType){
  const h=G.current;
  if(!h||h.side!=='hero'||!h.alive)return;
  if(G.targeting&&G.targeting.type===type){cancelTargeting();return;}
  G.targeting={type};
  clearMarkers();clearDots();
  if(type==='attack'||type==='bolt'||type==='sneak'||type==='smite'){/* v1.2: +подлый удар и карание */
    const range=(type==='attack'||type==='sneak')?h.weapon.range:(type==='smite'?6:9);
    let hasTgt=false;
    const cands=[...units.filter(x=>x.side==='goblin'&&x.alive),...barrels.filter(b=>b.alive)];
    for(const e of cands)if(cheb(h,e)<=range){addMarker(e.x,e.z,0xe06c55,0.62);hasTgt=true;}
    const hintTxt=type==='attack'?'Выберите цель для атаки'
      :type==='sneak'?'Подлый удар: выберите цель (фланг — +1d6)'
      :type==='smite'?'Карание света: выберите цель'
      :'Огненные стрелы: выберите цель';
    setHint(hasTgt?(hintTxt+' (ПКМ / Esc — отмена)'):'Вне зоны действия!');
  }else if(type==='fireball'){
    for(let x=1;x<GRID-1;x++)for(let z=1;z<GRID-1;z++){
      if(cheb(h,{x,z})<=RANGE_FB&&passable(GW,x,z,h))addMarker(x,z,0xff9a4d,0.5);
    }
    setHint('Огненный шар: выберите клетку. Осторожно — задевает союзников! (ПКМ — отмена)');
  }else if(type==='oil'){
    for(let x=1;x<GRID-1;x++)for(let z=1;z<GRID-1;z++){
      if(cheb(h,{x,z})<=RANGE_OIL&&passable(GW,x,z,h))addMarker(x,z,0xff9a4d,0.5);
    }
    setHint('Огненное масло: выберите клетку. Осторожно — огонь распространяется! (ПКМ — отмена)');
  }else{
    for(const a of units.filter(x=>x.side==='hero'&&x.alive&&cheb(h,x)<=6))addMarker(a.x,a.z,0xffd54f,0.62);
    setHint(type==='bless'?'Благословение: выберите союзника (ПКМ — отмена)':(type==='cure'?'Лечение: выберите союзника (ПКМ — отмена)':'Лечащее слово: выберите союзника (ПКМ — отмена)'));
  }
}
export function cancelTargeting():void{
  G.targeting=null;
  clearMarkers();clearDots();setHint('');
  if(G.combatOn&&G.phase==='player'&&G.current&&G.current.alive)showReach(G.current);
}
export async function resolveTargetClick():Promise<void>{
  const h=G.current,t=G.targeting;
  if(!t||!h)return;
  if(t.type==='attack'||t.type==='bolt'||t.type==='sneak'||t.type==='smite'){
    const tgt=pick.ent;
    if(!tgt){setHint('Нужно выбрать цель!');return;}
    const range=(t.type==='attack'||t.type==='sneak')?h.weapon.range:(t.type==='smite'?6:9);
    if(tgt.side==='hero'){setHint('Это союзник!');return;}
    if(cheb(h,tgt)>range){setHint('Слишком далеко!');return;}
    cancelTargeting();
    h.action--;
    if(t.type==='attack')await doAttack(h,tgt,h.weapon);
    else if(t.type==='sneak'){/* v1.2: подлый удар — усилен во фланге */
      const flank=aliveHeroes().some(a=>a!==h&&a.alive&&cheb(a,tgt)<=1);
      if(flank){const sd=h.level>=3?2:1;await doAttack(h,tgt,h.weapon,{sneakBonus:roll(sd,6)});}
      else{log(h.name+' бьёт без фланга — подлый удар не сработал.','g-sys');await doAttack(h,tgt,h.weapon);}
    }else{/* v1.2: карание света */
      h.slots--;
      await doAttack(h,tgt,SMITE);
    }
    bus.refreshUI.call();showReach(h);
  }else if(t.type==='fireball'){
    if(!pick.tile){setHint('Выберите клетку!');return;}
    if(cheb(h,pick.tile)>RANGE_FB){setHint('Слишком далеко!');return;}
    cancelTargeting();
    h.action--;h.slots--;
    busyOn();
    await castFireball(h,pick.tile.x,pick.tile.z);
    busyOff();
    bus.refreshUI.call();showReach(h);
  }else if(t.type==='oil'){
    if(!pick.tile){setHint('Выберите клетку!');return;}
    if(cheb(h,pick.tile)>RANGE_OIL){setHint('Слишком далеко!');return;}
    cancelTargeting();
    h.action--;h.oil=(h.oil||0)-1;/* Фаза 4a: oil — опциональное поле */
    log(h.name+' метает огненное масло!','g-fire');
    explode(pick.tile.x,pick.tile.z,{dice:[1,6],radius:1.5});
    bus.refreshUI.call();showReach(h);
  }else{
    const ally=pick.ent;
    if(!ally||ally.side!=='hero'){setHint('Выберите союзника!');return;}
    if(cheb(h,ally)>6){setHint('Слишком далеко!');return;}
    cancelTargeting();
    h.slots--;
    if(t.type==='cure')h.action--;else h.bonus--;/* v1.2: лечение жрицы — действие */
    if(t.type==='heal')healUnit(ally,roll(1,4)+mod(h.int),'лечащее слово');
    else if(t.type==='cure')healUnit(ally,roll(1,8)+mod(h.wis),'молитва Кая');
    else{
      addStatus(ally,'bless',3);
      ftextAbove(ally,'Благословение','#ffd54f');
    }
    bus.refreshUI.call();showReach(h);
  }
}


export function showTipFor(ent0:Unit|Interact|null,e:PointerEvent){
  const tip=$(UI.tip);
  if(!ent0){tip.style.display='none';return;}
  let html='';
  if('talkName' in ent0){/* интерактивная точка мира */
    html='<b>'+ent0.talkName+'</b><br>'+ent0.talkDesc;
    if(G.phase==='explore')html+='<br><span class="tc">E или клик — взаимодействовать</span>';
  }else{
    const ent=ent0 as Unit;/* интеракты всегда имеют talkName — здесь только юниты */
    if(ent.isBarrel){
      html='<b>'+(ent.name||'Взрывная бочка')+'</b><br>Детонирует от любого удара: 3d6 огня в радиусе 2.5 кл. Не любит огонь!';
    }else{
      html='<b>'+ent.name+'</b>'+(ent.elite?' · ЭЛИТА':'')+'<br>HP: '+ent.hp+'/'+ent.maxhp+' • КД '+ent.ac;
      if(ent.healer)html+='<br><span class="tc">Целитель: латает слуг Костепёра — бейте первым.</span>';
      if(ent.elite)html+='<br><span class="tc">Элита: крепче рядового, добыча богаче.</span>';
      if(ent.statuses&&ent.statuses.length)html+='<br>Статусы: '+ent.statuses.map(s=>STATUS[s.type].name).join(', ');
      if(G.targeting&&(G.targeting.type==='attack'||G.targeting.type==='bolt'||G.targeting.type==='sneak'||G.targeting.type==='smite')&&ent.side==='goblin'&&G.current){
        const w=(G.targeting.type==='attack'||G.targeting.type==='sneak')?G.current.weapon:(G.targeting.type==='smite'?SMITE:BOLT);
        const ch=Math.round(hitChance(G.current,ent,w)*100);
        html+='<br><span class="tc">Попадание ~'+ch+'% • урон ~'+avgDamage(G.current,w).toFixed(1)+' • крит 5%</span>';
      }
    }
  }
  tip.innerHTML=html;
  tip.style.display='block';
  tip.style.left=Math.min(innerWidth-260,e.clientX+14)+'px';
  tip.style.top=Math.min(innerHeight-90,e.clientY+12)+'px';
}
