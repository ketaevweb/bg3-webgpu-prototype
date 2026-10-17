/* ================= SNAPSHOT (Фазы 4–5 рефакторинга) =================
   Снимок игры (формат v2 ЗАМОРОЖЕН, types.ts) и восстановление (applyGame).
   Фаза 5: цикл slots⇄snapshot разорван — closeSaveMenu переехал в вызовы
   doLoad (slots.ts); openExploreUI/refreshParty/refreshBossBar — через шину
   bus. Перенесено дословно из engine.ts. */
import { SAVE_VER, W } from '../constants';
import { clamp } from '../utils';
import { sfx } from '../audio';
import { S, G, units, MAP_NAME } from '../state';
import { bus } from '../bus';
import { uiSet } from '../ui/store';
import { QUESTS, closeJournal, refreshTracker } from '../interact/quests';
import { closeDlgHard } from '../interact/dialog';
import { closeShop, closeChoice } from '../interact/shop';
import { closeGfx } from './settings';
import { cancelTargeting } from '../ui/targeting';
import { teardownWorld, buildMap } from '../world/maps';
import { ensureCompanions, refreshHintExplore } from '../interact/explore';
import { ensureOlkha } from '../interact/swamp';/* v1.5: восстановление друида по флагу сейва */
import { bigBanner, log } from '../ui/overlays';
import type { SaveData } from '../types';

export function gameSnapshot():SaveData{/* Фаза 3: формат v2 заморожен (types.ts) */
  return {
    v:SAVE_VER,when:Date.now(),
    mapId:G.mapId,mapName:MAP_NAME[G.mapId],
    gold:S.gold,discount:!!S.discount,
    flags:{
      patrolDone:!!S.patrolDone,campDone:!!S.campDone,cageSeen:!!S.cageSeen,knowsBoss:!!S.knowsBoss,
      hasCrate:!!S.hasCrate,ilvaFreed:!!S.ilvaFreed,chestLooted:!!S.chestLooted,necroSlain:!!S.necroSlain,
      kayaJoined:!!S.kayaJoined,/* v1.2 */
      swampDone:!!S.swampDone,olkhaJoined:!!S.olkhaJoined,/* v1.5: опциональные поля — v2 совместим */
      giantsDone:!!S.giantsDone,giantsChest:!!S.giantsChest,/* v1.6 */
    },
    barrelsUsed:[...S.barrelsUsed],
    quests:Object.fromEntries(Object.entries(QUESTS).map(([id,q])=>[id,{state:q.state,objs:q.objs.map(o=>!!o.done)}])),
    heroes:units.filter(u=>u.side==='hero').map(h=>({
      cls:h.cls,level:h.level,xp:h.xp,hp:h.hp,maxhp:h.maxhp,ac:h.ac,
      str:h.str,dex:h.dex,con:h.con,int:h.int,wis:h.wis,cha:h.cha,
      slotsMax:h.slotsMax||0,potions:h.potions,oil:h.oil||0,armor:h.armor,relic:h.relic||null,/* v1.3 */
      gear:h.gear?{...h.gear}:undefined,/* v1.6: надетое снаряжение */
      weapon:h.weapon?{name:h.weapon.name,dice:h.weapon.dice,abil:h.weapon.abil,range:h.weapon.range,melee:!!h.weapon.melee}:null,
      x:h.x,z:h.z,
    })),
    bag:[...S.bag],/* v1.6: сумка отряда */
  };
}


export function applyGame(sv:SaveData|null){
  if(!sv||sv.v!==SAVE_VER||!Array.isArray(sv.heroes)){log('Сейв повреждён или от другой версии.','g-enemy');return;}
  if(G.phase==='transition'){log('Идёт переход между картами — подождите.','g-enemy');return;}
  if(S.dlgNpc)closeDlgHard();
  closeJournal();closeShop();closeChoice();closeGfx();
  uiSet({sheet:null,endHidden:true});
  S.gold=sv.gold||0;S.discount=!!sv.discount;
  const fl=sv.flags||{};
  S.patrolDone=!!fl.patrolDone;S.campDone=!!fl.campDone;S.cageSeen=!!fl.cageSeen;S.knowsBoss=!!fl.knowsBoss;
  S.hasCrate=!!fl.hasCrate;S.ilvaFreed=!!fl.ilvaFreed;S.chestLooted=!!fl.chestLooted;S.necroSlain=!!fl.necroSlain;
  S.kayaJoined=!!fl.kayaJoined;/* v1.2 */
  S.swampDone=!!fl.swampDone;S.olkhaJoined=!!fl.olkhaJoined;/* v1.5: в старых сейвах полей нет — дефолт false */
  S.giantsDone=!!fl.giantsDone;S.giantsChest=!!fl.giantsChest;/* v1.6 */
  S.bag=Array.isArray(sv.bag)?sv.bag.filter((id:unknown)=>typeof id==='string'):[];/* v1.6 */
  S.barrelsUsed=new Set(sv.barrelsUsed||[]);
  for(const id in QUESTS){
    const svq=sv.quests&&sv.quests[id];
    const q=QUESTS[id];
    if(!svq){q.state=id==='main'?'active':'hidden';q.objs.forEach(o=>{o.done=false;});continue;}
    q.state=svq.state||'hidden';
    q.objs.forEach((o,i)=>{o.done=!!(svq.objs&&svq.objs[i]);});
  }
  cancelTargeting();
  teardownWorld();
  buildMap(sv.mapId==='swamp'?'swamp':(sv.mapId==='giants'?'giants':(sv.mapId==='crypt'?'crypt':'forest')),null);/* v1.5: +болота; v1.6: +перевал */
  ensureCompanions();/* v1.2: восстановить Илву и Каю по флагам сейва */
  ensureOlkha();/* v1.5: восстановить Ольху по флагу сейва */
  for(const hd of sv.heroes){
    const h=units.find(u=>u.side==='hero'&&u.cls===hd.cls);
    if(!h)continue;
    h.level=hd.level||1;h.xp=hd.xp||0;
    h.maxhp=hd.maxhp||h.maxhp;h.hp=clamp(hd.hp||1,1,h.maxhp);
    h.ac=hd.ac||h.ac;
    (['str','dex','con','int','wis','cha'] as const).forEach(a=>{if(typeof hd[a]==='number')h[a]=hd[a];});
    h.slotsMax=hd.slotsMax||0;h.slots=h.slotsMax;
    h.potions=hd.potions||0;h.oil=hd.oil||0;h.armor=hd.armor||h.armor;h.relic=hd.relic||null;/* v1.3: реликвия элиты */
    h.gear=hd.gear&&typeof hd.gear==='object'?{weapon:hd.gear.weapon,armor:hd.gear.armor,trinket:hd.gear.trinket}:undefined;/* v1.6: бонусы уже учтены в сохранённых ac/maxhp/weapon — повторно НЕ применяем */
    if(hd.weapon&&hd.weapon.dice)h.weapon={name:hd.weapon.name,dice:hd.weapon.dice,abil:hd.weapon.abil,range:hd.weapon.range,melee:!!hd.weapon.melee};
    h.statuses=[];h.swUsed=false;h.surge=0;
    if(typeof hd.x==='number'&&typeof hd.z==='number'){
      h.x=hd.x;h.z=hd.z;
      h.mesh.position.set(W(h.x),0,W(h.z));h.mesh.rotation.set(0,0,0);
    }
  }
  bus.openExploreUI.call();
  bus.refreshParty.call();bus.refreshBossBar.call();refreshHintExplore();refreshTracker();
  bigBanner('ИГРА ЗАГРУЖЕНА');
  log('Отряд приходит в себя: '+MAP_NAME[G.mapId]+'. Прогресс восстановлен из сейва.','g-heal');
  sfx.ui();
}
