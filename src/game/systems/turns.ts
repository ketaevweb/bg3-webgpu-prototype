/* ================= TURNS (Фаза 4 рефакторинга) =================
   Старт боя, инициатива, begin/endTurn. Цикл импортов turns⇄ai —
   на уровне функций (ESM-safe). Перенесено дословно из engine.ts. */
import { $, key, mod } from '../utils';
import { d } from '../rng';
import { UI } from '../hud';
import { sfx } from '../audio';
import { G, S, units, fires } from '../state';
import { bigBanner, log, ftextAbove, setHint, refreshIcons } from '../ui/overlays';
import { closeDlgHard } from '../interact/dialog';
import { aliveHeroes } from '../entities/units';
import { tickFires } from './statuses';
import { damageUnit } from './combat';
import { aiTurn } from './ai';
import { refreshInit, refreshParty } from '../ui/party';
import { refreshUI } from '../ui/actionbar';
import { clearMarkers, clearDots, showReach } from '../ui/markers';
import type { Unit } from '../types';

/* ================= ХОДЫ ================= */
export function startCombat(group){
  closeDlgHard();
  if(!group.length)return;
  S.combatGroup=group;
  G.combatOn=true;
  log('=== БОЙ НАЧИНАЕТСЯ ===','g-sys');
  sfx.stinger('combat');
  if(S.combatGroup.some(g=>g.cryptBoss)){/* v0.8: аутро босса крипты */
    bigBanner('ВХОРИЛ КОСТЕПЁР');
    log('Из тьмы поднимается Вхорил Костепёр — глаза горят могильным огнём.','g-enemy');
  }
  for(const h of aliveHeroes()){
    h.swUsed=false;h.slots=h.slotsMax;
    if(h.cls==='fighter'&&h.level>=2)h.surge=h.level>=3?2:1;
    if(h.cls==='cleric')h.dawnUsed=false;/* v1.2 */
  }
  const list=[...aliveHeroes(),...group.filter(g=>g.alive)];
  for(const u of list)u.init=d(20)+mod(u.dex);
  G.order=list.sort((a,b)=>b.init-a.init);
  G.turnIdx=-1;G.round=1;
  $(UI.round).textContent='Раунд 1';
  $(UI.actionbar).style.display='block';
  refreshInit();refreshParty();
  log('Инициатива: '+G.order.map(u=>u.name+' ('+u.init+')').join(', '),'g-sys');
  endTurn();
}
export function beginTurn(u){
  if(!G.combatOn)return;
  G.current=u;G.targeting=null;
  clearMarkers();clearDots();setHint('');
  for(const x of units)x.mesh.userData.ring.material.color.setHex(x.side==='hero'?0x5a8fc0:(x.elite?0xd8b45a:0xa04a3a));/* v1.3: элита — золотое кольцо */
  u.mesh.userData.ring.material.color.setHex(0xd8b45a);
  refreshInit();
  $(UI.turnb).textContent=u.side==='hero'?'Ваш ход: '+u.name:'Ход противника: '+u.name;
  $(UI.turnb).style.color=u.side==='hero'?'#8fd36a':'#e06c55';
  if(fires.has(key(u.x,u.z))){
    const dmg=d(4);
    log(u.name+' стоит в огне: '+dmg+' урона.','g-fire');
    ftextAbove(u,'−'+dmg,'#ff8a50');
    damageUnit(u,dmg,null);
  }
  const burn=u.alive&&u.statuses.find(s=>s.type==='burn');
  if(burn){
    const dmg=d(4);
    log(u.name+': горение — '+dmg+' урона.','g-fire');
    ftextAbove(u,'−'+dmg,'#ff8a50');
    damageUnit(u,dmg,null);
  }
  if(!u.alive){endTurn();return;}
  u.statuses.forEach(s=>s.turns--);
  u.statuses=u.statuses.filter(s=>s.turns>0);
  refreshIcons(u);
  u.action=u.actionMax;u.bonus=1;u.reaction=1;
  u.moveLeft=u.speed;u.disengaging=false;u.dashUsed=false;
  G.busy=false;
  $(UI.actionbar).style.display='block';
  if(u.side==='hero'){
    G.phase='player';
    refreshUI();showReach(u);
  }else{
    G.phase='ai';
    refreshUI();
    setTimeout(()=>aiTurn(u),550);
  }
}
export function endTurn(){
  if(!G.combatOn)return;
  G.targeting=null;clearMarkers();clearDots();
  let steps=0;
  while(steps<=G.order.length*2){
    G.turnIdx++;
    if(G.turnIdx>=G.order.length){
      G.turnIdx=0;G.round++;
      $(UI.round).textContent='Раунд '+G.round;
      tickFires();
    }
    const c=G.order[G.turnIdx];
    if(c&&c.alive)break;
    steps++;
  }
  const u=G.order[G.turnIdx];
  if(!u||!u.alive||!G.combatOn)return;
  beginTurn(u);
}


export function joinCombat(u){/* v0.8: подкрепление встаёт в очередь инициативы */
  u.init=d(20)+mod(u.dex);
  G.order.push(u);
  log(u.name+' вступает в бой (инициатива '+u.init+').','g-enemy');
  refreshInit();
}
