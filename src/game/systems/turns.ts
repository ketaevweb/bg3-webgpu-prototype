/* ================= TURNS (Фазы 4–5 рефакторинга) =================
   Старт боя, инициатива, begin/endTurn. Фаза 5: tickFires переехал сюда
   из statuses.ts (тика огня — конец раунда; прямой вызов damageUnit из
   statuses замыкал цикл combat⇄statuses); closeDlgHard/aiTurn — через
   шину bus (разрыв cycles turns⇄dialog и turns⇄ai); UI-refresh — через
   bus. Импорты однонаправленные. Перенесено дословно из engine.ts. */
import { key, mod } from '../utils';
import { d } from '../rng';
import { sfx } from '../audio';
import { G, S, units, fires, grass, GW } from '../state';
import { bus } from '../bus';
import { setActionbarVisible, setRound, setTopbar } from '../ui/store';
import { bigBanner, log, ftextAbove, setHint, refreshIcons } from '../ui/overlays';
import { aliveHeroes } from '../entities/units';
import { unitAt, barrelAt } from '../world/grid';
import { igniteTile, removeFire, addStatus } from './statuses';
import { damageUnit, explodeBarrel } from './combat';
import { checkEnd } from './progression';
import { clearMarkers, clearDots, showReach } from '../ui/markers';
import { bark } from '../ui/barks';/* v2.6: боевые реплики */
import type { Unit } from '../types';

/* ================= ОГОНЬ: ТИК КОНЦА РАУНДА (Фаза 5: из statuses.ts) ================= */
export function tickFires(){
  for(const f of [...fires.values()]){
    const u=unitAt(GW,f.x,f.z,null);
    if(u&&u.alive){
      const dmg=d(4);
      log(u.name+' горит в пламени: '+dmg+' урона.','g-fire');
      ftextAbove(u,'−'+dmg,'#ff8a50');
      damageUnit(u,dmg,null);
      if(u.alive&&Math.random()<0.5)addStatus(u,'burn',2);
    }
  }
  const born:[number,number][]=[];
  for(const f of fires.values()){
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      if(!dx&&!dz)continue;
      const nx=f.x+dx,nz=f.z+dz,nk=key(nx,nz);
      const b=barrelAt(GW,nx,nz);
      if(b)setTimeout(()=>explodeBarrel(b),240);
      else if(grass.has(nk)&&!fires.has(nk)&&Math.random()<0.38)born.push([nx,nz]);
    }
  }
  for(const [x,z] of born)igniteTile(x,z,2);
  for(const [k,f] of [...fires]){f.turns--;if(f.turns<=0)removeFire(k);}
  checkEnd();
}

/* ================= ХОДЫ ================= */
export function startCombat(group:Unit[]){
  bus.closeDlgHard.call();
  if(!group.length)return;
  S.combatGroup=group;
  G.combatOn=true;
  bus.tutEvent.call('fight');/* v1.4: шаг обучения «Первый бой» */
  log('=== БОЙ НАЧИНАЕТСЯ ===','g-sys');
  sfx.stinger('combat');
  bark('start');/* v2.6: герой выкрикивает начало боя */
  if(S.combatGroup.some(g=>g.cryptBoss)){/* v0.8: аутро босса крипты */
    bigBanner('ВХОРИЛ КОСТЕПЁР');
    log('Из тьмы поднимается Вхорил Костепёр — глаза горят могильным огнём.','g-enemy');
  }
  for(const h of aliveHeroes()){
    h.swUsed=false;h.slots=h.slotsMax;
    if(h.cls==='fighter'&&h.level>=2)h.surge=h.level>=3?2:1;
    if(h.cls==='cleric')h.dawnUsed=false;/* v1.2 */
    if(h.cls==='paladin')h.dawnUsed=false;/* v1.9: наложение рук — 1/бой */
  }
  const list=[...aliveHeroes(),...group.filter(g=>g.alive)];
  for(const u of list){u.init=d(20)+mod(u.dex);u.inCombat=true;}/* v1.7: боевая стойка idleCombat */
  G.order=list.sort((a,b)=>(b.init||0)-(a.init||0));/* init задан строкой выше */
  G.turnIdx=-1;G.round=1;
  setRound('Раунд 1');
  setActionbarVisible(true);
  bus.refreshInit.call();bus.refreshParty.call();
  log('Инициатива: '+G.order.map(u=>u.name+' ('+u.init+')').join(', '),'g-sys');
  endTurn();
}
export function beginTurn(u:Unit){
  if(!G.combatOn)return;
  G.current=u;G.targeting=null;
  clearMarkers();clearDots();setHint('');
  for(const x of units)x.mesh.userData.ring.material.color.setHex(x.side==='hero'?0x5a8fc0:(x.elite?0xd8b45a:0xa04a3a));/* v1.3: элита — золотое кольцо */
  u.mesh.userData.ring.material.color.setHex(0xd8b45a);
  bus.refreshInit.call();
  const heroTurn=u.side==='hero';
  setTopbar({turn:heroTurn?'Ваш ход: '+u.name:'Ход противника: '+u.name,turnColor:heroTurn?'#8fd36a':'#e06c55'});
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
  setActionbarVisible(true);
  if(u.side==='hero'){
    G.phase='player';
    bus.refreshUI.call();showReach(u);
  }else{
    G.phase='ai';
    bus.refreshUI.call();
    setTimeout(()=>{void bus.aiTurn.call(u);},550);
  }
}
export function endTurn(){
  if(!G.combatOn)return;
  /* v1.4: шаг обучения «Конец хода» — только когда завершается ход героя */
  if(G.current&&G.current.alive&&G.current.side==='hero')bus.tutEvent.call('end');
  G.targeting=null;clearMarkers();clearDots();
  let steps=0;
  while(steps<=G.order.length*2){
    G.turnIdx++;
    if(G.turnIdx>=G.order.length){
      G.turnIdx=0;G.round++;
      setRound('Раунд '+G.round);
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


export function joinCombat(u:Unit){/* v0.8: подкрепление встаёт в очередь инициативы */
  u.init=d(20)+mod(u.dex);
  G.order.push(u);
  /* v2.1: синхронизация S.combatGroup — иначе checkEnd объявит победу,
    пока подкрепление живо (латентный баг summon'ов v0.8/v1.8) */
  if(G.combatOn&&!S.combatGroup.includes(u))S.combatGroup.push(u);
  log(u.name+' вступает в бой (инициатива '+u.init+').','g-enemy');
  bus.refreshInit.call();
}
