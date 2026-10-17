/* ================= SYSTEMS/LOOT (Фаза 2 рефакторинга) =================
   Таблицы лута (данные, v1.3). Ключ таблицы выбирается в rollLoot (engine):
   босс → boss, кастеры → cultist, нежить → undead, прочие гоблины → goblin.
   rollLoot/giveToParty переезжают сюда в Фазе 4d — им нужен контекст G,
   fx/glows/log и refreshParty; сейчас движок импортирует только таблицу. */

export const LOOT={
  goblin:{gold:[2,7],potion:0.12,oil:0.10},
  undead:{gold:[3,9],potion:0.15,oil:0.06},
  cultist:{gold:[5,12],potion:0.22,oil:0.15},
  boss:{gold:[18,32],potion:1,oil:0.6},
} as const;

export type LootKey=keyof typeof LOOT;


/* ================= ВЫДАЧА ЛУТА (Фаза 4 рефакторинга) =================
   giveToParty/rollLoot — перенесено дословно из engine.ts. */
import { ri } from '../rng';
import { log } from '../ui/overlays';
import { aliveHeroes } from '../entities/units';
import { gainGold } from '../interact/quests';
import { refreshParty } from '../ui/party';
import { fx, glows } from '../render/renderer';
import type { Unit } from '../types';

/* ================= v1.3: ЛУТ-ТАБЛИЦЫ =================
   Из каждого врага выпадает добыча по таблице его типа:
   гоблины/нежить/культисты/боссы — золото, шанс зелья и масла.
   Элита даёт вдвое больше золота, гарантированный предмет и реликвию. */
/* ri → rng.ts; LOOT → systems/loot.ts (Фаза 2). rollLoot/giveToParty — здесь до p4d */
export function giveToParty(kind,why){
  const hs=aliveHeroes();if(!hs.length)return null;
  const h=kind==='potion'
    ?hs.slice().sort((a,b)=>a.hp/a.maxhp-b.hp/b.maxhp)[0]
    :hs[Math.floor(Math.random()*hs.length)];
  if(kind==='potion')h.potions++;
  else h.oil=(h.oil||0)+1;
  log(h.short+' забирает: '+why+'.','g-sys');
  return h;
}
export function rollLoot(t){
  if(!t||t.isBarrel||t.side!=='goblin'||t.summoned)return;
  const isBoss=!!(t.mainBoss||t.cryptBoss);
  const tbl=isBoss?LOOT.boss:(t.caster?LOOT.cultist:(t.cls==='undead'?LOOT.undead:LOOT.goblin));
  const g=ri(tbl.gold[0],tbl.gold[1])*(t.elite?2:1);
  gainGold(g);
  log('С поверженного «'+t.name+'» собрано '+g+' золота.','g-sys');
  const hs=aliveHeroes();
  if(hs.length){
    fx.burstAtMesh(t,{count:12,color:0xffd54f,speed:2.2,size:0.1,life:0.7,gravity:-1});
    if(Math.random()<tbl.potion)giveToParty('potion','зелье лечения из пожитков врага');
    if(Math.random()<tbl.oil)giveToParty('oil','огненное масло из пожитков врага');
  }
  if(t.elite&&hs.length){/* реликвии элиты — по одной на героя */
    let relic:any=null,cand=aliveHeroes();
    if(t.cls==='undead'){relic={n:'Костяной оберег',apply:h=>{h.ac+=1;h.relic='Костяной оберег';return h.short+': КД +1';}};}
    else if(t.caster){relic={n:'Пыльный фолиант',apply:h=>{h.slotsMax+=1;h.slots+=1;h.relic='Пыльный фолиант';return h.short+': +1 ячейка заклинаний';}};cand=aliveHeroes().filter(h=>h.slotsMax>0);}
    else{relic={n:'Трофейный клык',apply:h=>{h.str+=1;h.relic='Трофейный клык';return h.short+': СИЛ +1';}};cand=aliveHeroes().filter(h=>h.cls==='fighter');}
    const free=(cand.length?cand:aliveHeroes()).filter(h=>!h.relic);
    if(relic&&free.length){
      const h=free[0];
      log('Реликвия «'+relic.n+'» переходит к отряду: '+relic.apply(h)+'.','g-heal');
      glows.flashAtMesh(h,0xd8b45a,1.3);
      refreshParty();
    }else{
      const b=25;gainGold(b);
      log('Носить реликвию некому — она обращена в '+b+' золота.','g-sys');
    }
  }
  refreshParty();
}
