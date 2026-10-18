/* ================= GEAR (v1.6 «Перевал великанов») =================
   Снаряжение/инвентарь с эффектами: сумка отряда (S.bag — id предметов)
   и слоты героев (weapon/armor/trinket, h.gear). Эффекты аддитивные:
   надевание меняет ac/maxhp/weapon, снятие возвращает исходные значения
   (справочники DEFAULT_*). Предмет возвращается в сумку при снятии и
   при замене. Сейв v2: опциональные поля bag/heroes[].gear — совместим.
   Лист по зависимостям: state/rng/utils + ui (log/bus/store/renderer). */
import { sfx } from '../audio';
import { S } from '../state';
import { bus } from '../bus';
import { uiSet, useUi, type BagHeroView, type BagItemView } from '../ui/store';
import { log } from '../ui/overlays';
import { glows } from '../render/renderer';
import { aliveHeroes } from '../entities/units';
import type { Unit, Weapon } from '../types';

export type GearSlot='weapon'|'armor'|'trinket';
export interface GearItem{
  id:string;n:string;d:string;slot:GearSlot;
  eq:(h:Unit)=>string;      /* применить бонус, вернуть текст эффекта */
  uneq:(h:Unit)=>void;      /* снять бонус (симметрично) */
}

/* исходное оружие/доспех по классу (восстановление при снятии) */
const DEFAULT_WEAPON:Record<string,Weapon>={
  fighter:{name:'Длинный меч',dice:[1,8],abil:'str',melee:true,range:1},
  wizard:{name:'Посох',dice:[1,6],abil:'str',melee:true,range:1},
  rogue:{name:'Короткий лук',dice:[1,6],abil:'dex',range:8},
  cleric:{name:'Булава',dice:[1,6],abil:'str',melee:true,range:1},
  druid:{name:'Посох тиса',dice:[1,6],abil:'str',melee:true,range:1},
};
const DEFAULT_ARMOR:Record<string,string>={
  fighter:'Кольчуга',wizard:'Роба',rogue:'Кожаный доспех',cleric:'Чешуйчатый доспех',druid:'Кожаный доспех',
};

/* ---- каталог снаряжения v1.6 (эффекты читаются в бою напрямую) ---- */
export const GEAR:Record<string,GearItem>={
  axe_pass:{
    id:'axe_pass',n:'Секира перевала',slot:'weapon',
    d:'Оружие: 1d10+СИЛ в ближнем бою. Снята с плеча огра — тяжёлая, но честная.',
    eq:h=>{h.weapon={name:'Секира перевала',dice:[1,10],abil:'str',melee:true,range:1};return h.short+': оружие — Секира перевала (1d10+СИЛ).';},
    uneq:h=>{h.weapon={...DEFAULT_WEAPON[h.cls]};},
  },
  scale_giant:{
    id:'scale_giant',n:'Чешуя великана',slot:'armor',
    d:'Доспех: +2 КД поверх носимого. Снятые с Гаррума каменные пластины.',
    eq:h=>{h.ac+=2;h.armor='Чешуя великана';return h.short+': КД +2 ('+h.ac+').';},
    uneq:h=>{h.ac-=2;h.armor=DEFAULT_ARMOR[h.cls]||h.armor;},
  },
  stone_heart:{
    id:'stone_heart',n:'Каменное сердце',slot:'trinket',
    d:'Талисман: +5 к макс. хитам. Бьётся в такт землетрясениям перевала.',
    eq:h=>{h.maxhp+=5;h.hp+=5;return h.short+': макс. HP +5 ('+h.maxhp+').';},
    uneq:h=>{h.maxhp=Math.max(1,h.maxhp-5);h.hp=Math.min(h.hp,h.maxhp);},
  },
  watch_ring:{
    id:'watch_ring',n:'Кольцо дозорного',slot:'trinket',
    d:'Талисман: +1 КД. Старый знак Долгого Дозора — хранит в бою.',
    eq:h=>{h.ac+=1;return h.short+': КД +1 ('+h.ac+').';},
    uneq:h=>{h.ac-=1;},
  },
  /* v1.8: финальный трофей — знамя коменданта цитадели */
  watch_banner:{
    id:'watch_banner',n:'Знамя Дозора',slot:'trinket',
    d:'Талисман: +2 КД. Знамя лорда-коменданта — Долгий Дозор снова поднимает его над цитаделью.',
    eq:h=>{h.ac+=2;return h.short+': КД +2 ('+h.ac+').';},
    uneq:h=>{h.ac-=2;},
  },
};
const SLOT_LABEL:Record<GearSlot,string>={weapon:'Оружие',armor:'Доспех',trinket:'Талисман'};

/* ---- сумка отряда ---- */
export function addToBag(id:string){
  if(!GEAR[id])return;
  S.bag.push(id);
  log('В сумку отряда убрано: «'+GEAR[id].n+'» (I — снаряжение).','g-heal');
}
/* надеть предмет из сумки; прежний слот возвращается в сумку */
export function equipItem(id:string,h:Unit){
  const it=GEAR[id];
  if(!it||!S.bag.includes(id))return;
  const cur=h.gear?.[it.slot];
  if(cur){/* снять надетое — в сумку */
    GEAR[cur].uneq(h);
    S.bag.push(cur);
  }
  const i=S.bag.indexOf(id);if(i>=0)S.bag.splice(i,1);
  const msg=it.eq(h);
  h.gear={...h.gear,[it.slot]:id};
  log('Надето: '+msg,'g-heal');
  sfx.bless();
  glows.flashAtMesh(h,0xd8b45a,1.2);
  bus.refreshParty.call();
  renderBag();
}
/* снять предмет в слоте — обратно в сумку */
export function unequipSlot(h:Unit,slot:GearSlot){
  const id=h.gear?.[slot];
  if(!id||!GEAR[id])return;
  GEAR[id].uneq(h);
  h.gear={...h.gear,[slot]:undefined};
  S.bag.push(id);
  log(h.short+': «'+GEAR[id].n+'» снят и убран в сумку.','g-sys');
  bus.refreshParty.call();
  renderBag();
}
export function heroGearName(h:Unit,slot:GearSlot):string|null{
  const id=h.gear?.[slot];
  return id&&GEAR[id]?GEAR[id].n:null;
}

/* ---- панель «Снаряжение» (I) — view-модели для React-HUD ---- */
export function openBag(){renderBag();uiSet({bagOpen:true});sfx.ui();}
export function closeBag(){uiSet({bagOpen:false});}
export function toggleBag(){
  if(useUi.getState().bagOpen)closeBag();
  else openBag();
}
export function renderBag(){
  const items:BagItemView[]=S.bag.filter(id=>GEAR[id]).map(id=>({
    n:GEAR[id].n,d:GEAR[id].d,slot:SLOT_LABEL[GEAR[id].slot],
    equip:()=>{
      const hs=aliveHeroes();
      if(!hs.length)return;
      uiSet({choice:{
        title:'Кому: '+GEAR[id].n+'?',
        options:hs.map(h=>({label:h.name+' — '+h.clsName,onClick:()=>{uiSet({choice:null});equipItem(id,h);}})),
      }});
    },
  }));
  const party:BagHeroView[]=aliveHeroes().map(h=>({
    name:h.name,clsName:h.clsName||h.cls,
    slots:(['weapon','armor','trinket'] as GearSlot[]).map(sl=>{
      const name=heroGearName(h,sl);
      return {label:SLOT_LABEL[sl],item:name,remove:name?()=>unequipSlot(h,sl):()=>{}};
    }),
  }));
  uiSet({bagItems:items,bagParty:party});
}

/* ---- биндинги UI-колбэков (кнопка «Сумка» + закрытие панели) ---- */
uiSet(s=>({sys:{...s.sys,onBag:toggleBag},bagOnClose:closeBag}));
