/* ================= SHOP (Фазы 4–6 рефакторинга) =================
   Лавка Дамрока, выбор героя, применение предметов. Фаза 5: refreshParty —
   через шину bus. Фаза 6: DOM-рендер заменён view-моделями zustand-стора;
   биндинги shopOnClose/choiceOnClose — кнопки «Закрыть»/«Отмена». 1:1. */
import { sfx } from '../audio';
import { S } from '../state';
import { bus } from '../bus';
import { uiSet } from '../ui/store';
import { log } from '../ui/overlays';
import { refreshTracker } from '../interact/quests';
import { aliveHeroes } from '../entities/units';
import type { ShopItem, Unit } from '../types';

/* ---- магазин ---- */
export const SHOP:ShopItem[]=[
  {n:'Зелье лечения',p:25,d:'Бонусное действие в бою: +2d4+2 HP.',t:'potion'},
  {n:'Огненное масло',p:40,d:'Действие в бою: бросок — 1d6 огня в радиусе 1.5 кл., трава вспыхивает.',t:'oil'},
  {n:'Щит',p:60,d:'+2 КД владельцу.',t:'ac',v:2},
  {n:'Амулет дракончика',p:120,d:'+1 КД владельцу.',t:'ac',v:1},
  {n:'Короткий лук',p:60,d:'Оружие: 1d6+ЛОВ, дальность 8 кл.',t:'weapon',w:{name:'Короткий лук',dice:[1,6],abil:'dex',range:8}},
  {n:'Кольчуга',p:150,d:'Доспех: КД 16 (Торику уже знакома, Мирелле даст КД 14).',t:'armor'},
  {n:'Кулон красноречия',p:100,d:'+1 ХАР владельцу — проверки убеждения легче.',t:'cha',v:1},
];
export const price=(it:ShopItem):number=>S.discount?Math.floor(it.p*0.8):it.p;
export function openShop(){renderShop();uiSet({shopOpen:true});sfx.dialog();}
export function closeShop(){uiSet({shopOpen:false});}
export function renderShop(){
  uiSet({shopRows:SHOP.map(it=>({
    n:it.n,d:it.d,price:price(it),canBuy:S.gold>=price(it),
    buy:()=>chooseHero('Кому: '+it.n+'?',h=>applyItem(it,h)),
  }))});
}
export function chooseHero(title:string,cb:(h:Unit)=>void){
  uiSet({choice:{
    title,
    options:aliveHeroes().map(h=>({
      label:h.name+' — '+h.clsName+' (КД '+h.ac+')',
      onClick:()=>{closeChoice();cb(h);},
    })),
  }});
}
export function closeChoice(){uiSet({choice:null});}
export function applyItem(it:ShopItem,h:Unit){
  S.gold-=price(it);
  if(it.t==='potion')h.potions++;
  else if(it.t==='oil')h.oil=(h.oil||0)+1;
  else if(it.t==='ac')h.ac+=it.v||0;
  else if(it.t==='weapon')h.weapon={name:it.w!.name,dice:it.w!.dice,abil:it.w!.abil,range:it.w!.range};
  else if(it.t==='armor'){h.ac=h.cls==='fighter'?16:14;h.armor='Кольчуга';}
  else if(it.t==='cha')h.cha+=it.v||0;
  log('Куплено: '+it.n+' → '+h.short+' (−'+price(it)+' зол.).','g-sys');
  refreshTracker();bus.refreshParty.call();renderShop();
}

/* ---- биндинги UI-колбэков (Фаза 6: кнопки панелей) ---- */
uiSet({shopOnClose:closeShop,choiceOnClose:closeChoice});
