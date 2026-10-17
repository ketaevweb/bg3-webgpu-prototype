/* ================= SHOP (Фаза 4 рефакторинга) =================
   Лавка Дамрока, выбор героя, применение предметов. Перенесено дословно. */
import { $ } from '../utils';
import { UI } from '../hud';
import { sfx } from '../audio';
import { S } from '../state';
import { log } from '../ui/overlays';
import { refreshParty } from '../ui/party';
import { refreshTracker } from '../interact/quests';
import { aliveHeroes } from '../entities/units';
import type { Unit } from '../types';

/* ---- магазин ---- */
export const SHOP=[
  {n:'Зелье лечения',p:25,d:'Бонусное действие в бою: +2d4+2 HP.',t:'potion'},
  {n:'Огненное масло',p:40,d:'Действие в бою: бросок — 1d6 огня в радиусе 1.5 кл., трава вспыхивает.',t:'oil'},
  {n:'Щит',p:60,d:'+2 КД владельцу.',t:'ac',v:2},
  {n:'Амулет дракончика',p:120,d:'+1 КД владельцу.',t:'ac',v:1},
  {n:'Короткий лук',p:60,d:'Оружие: 1d6+ЛОВ, дальность 8 кл.',t:'weapon',w:{name:'Короткий лук',dice:[1,6],abil:'dex',range:8}},
  {n:'Кольчуга',p:150,d:'Доспех: КД 16 (Торику уже знакома, Мирелле даст КД 14).',t:'armor'},
  {n:'Кулон красноречия',p:100,d:'+1 ХАР владельцу — проверки убеждения легче.',t:'cha',v:1},
];
export const price=it=>S.discount?Math.floor(it.p*0.8):it.p;
export function openShop(){renderShop();$(UI.shop).style.display='block';sfx.dialog();}
export function closeShop(){$(UI.shop).style.display='none';}
export function renderShop(){
  const el=$(UI.shopList);el.innerHTML='';
  for(const it of SHOP){
    const row=document.createElement('div');row.className='sitem';
    row.innerHTML='<div><div class="sn">'+it.n+'</div><div class="sd">'+it.d+'</div></div>'+
      '<div class="sp">'+price(it)+' зол.</div>';
    const b=document.createElement('button');
    b.textContent='Купить';
    b.disabled=S.gold<price(it);
    b.onclick=()=>chooseHero('Кому: '+it.n+'?',h=>applyItem(it,h));
    row.appendChild(b);
    el.appendChild(row);
  }
}
export function chooseHero(title,cb){
  $(UI.choiceTitle).textContent=title;
  const el=$(UI.choiceList);el.innerHTML='';
  for(const h of aliveHeroes()){
    const b=document.createElement('button');
    b.textContent=h.name+' — '+h.clsName+' (КД '+h.ac+')';
    b.onclick=()=>{closeChoice();cb(h);};
    el.appendChild(b);
  }
  $(UI.choice).style.display='block';
}
export function closeChoice(){$(UI.choice).style.display='none';}
export function applyItem(it,h){
  S.gold-=price(it);
  if(it.t==='potion')h.potions++;
  else if(it.t==='oil')h.oil=(h.oil||0)+1;
  else if(it.t==='ac')h.ac+=it.v;
  else if(it.t==='weapon')h.weapon={name:it.w.name,dice:it.w.dice,abil:it.w.abil,range:it.w.range};
  else if(it.t==='armor'){h.ac=h.cls==='fighter'?16:14;h.armor='Кольчуга';}
  else if(it.t==='cha')h.cha+=it.v;
  log('Куплено: '+it.n+' → '+h.short+' (−'+price(it)+' зол.).','g-sys');
  refreshTracker();refreshParty();renderShop();
}
