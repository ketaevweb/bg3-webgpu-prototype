/* ================= PARTY (Фазы 4b–6 рефакторинга) =================
   Карточки отряда, боссбар, полоса инициативы, лист персонажа.
   Фаза 5: refreshParty/refreshInit/refreshBossBar/openExploreUI живут
   на шине bus. Фаза 6: DOM-рендер заменён view-моделями в zustand-стор
   (React-HUD читает стор; колбэки — open листа). Тексты 1:1. */
import { mod } from '../utils';
import { units, G, S, MAP_NAME } from '../state';
import { STATUS, XP_NEED } from '../constants';
import { bus } from '../bus';
import { uiSet, setTopbar, setActionbarVisible } from './store';
import { refreshTracker } from '../interact/quests';
import { refreshHintExplore } from '../interact/explore';
import type { Unit } from '../types';

function renderParty(){
  const cards=units.filter(u=>u.side==='hero').map(h=>{
    const need=XP_NEED(h.level);
    return {
      name:h.name,clsName:h.clsName||'',level:h.level,
      hp:h.hp,maxhp:h.maxhp,ac:h.ac,potions:h.potions,
      statuses:h.statuses.map(s=>({css:STATUS[s.type].css,label:STATUS[s.type].tag+s.turns})),
      xp:h.xp,need,
      active:G.current===h&&h.alive,
      open:()=>showSheet(h),
    };
  });
  uiSet({party:cards});
}
/* v0.8: боссбар сверху экрана */
function renderBossBar(){
  const b=G.combatOn?S.combatGroup.find(g=>g.isBoss&&g.alive):null;
  uiSet({boss:b?{name:b.name+' — '+b.clsName,hpPct:Math.max(0,b.hp/b.maxhp*100)}:null});
}
function renderInit(){
  renderBossBar();
  uiSet({init:G.combatOn?G.order.map(u=>({
    short:u.short,init:u.init||0,side:u.side,cur:u===G.current,dead:!u.alive,
  })):[]});
}
const signed=(v:number)=>(v>=0?'+':'')+v;
export function showSheet(h:Unit){
  const w=h.weapon,wm=mod(h[w.abil]);
  const need=XP_NEED(h.level);
  let spells:{cells?:string;lines:string[]}|undefined;
  if(h.cls==='wizard'){
    spells={cells:h.slots+'/'+h.slotsMax,lines:[
      '• Огненные стрелы — 1d10+'+mod(h.int)+' огонь (действие)',
      '• Огненный шар — 3d6 огонь, радиус 2.5 кл. (действие+ячейка)',
      '• Лечащее слово — 1d4+'+mod(h.int)+' (бонус+ячейка)',
      '• Благословение — +1d4 к атакам, 3 хода (бонус+ячейка)',
    ]};
  }else if(h.cls==='cleric'){/* v1.2 */
    spells={cells:h.slots+'/'+h.slotsMax,lines:[
      '• Лечение — 1d8+'+mod(h.wis)+' (действие+ячейка)',
      '• Щит веры — +2 КД, 3 хода (бонус+ячейка)',
      '• Карание света — 2d6 излучения (действие+ячейка)',
      '• Гнев рассвета — 2d6 излучения вокруг, нежить ×2 (1/бой)',
    ]};
  }else if(h.cls==='rogue'){/* v1.2 */
    spells={lines:[
      '• Подлый удар: +'+(h.level>=3?'2d6':'1d6')+', если рядом с целью есть союзник',
      '• Отравленный клинок: зарядов на очереди — '+h.poisonBlade,
    ]};
  }else if(h.cls==='druid'){/* v1.5: друид */
    spells={cells:h.slots+'/'+h.slotsMax,lines:[
      '• Разряд молнии — 2d6+'+mod(h.wis)+' молнии, дальность 7 кл. (действие+ячейка)',
      '• Облако спор — 1d6+'+mod(h.wis)+' яда в радиусе 2 кл., отравление (действие+ячейка)',
      '• Посох тиса — 1d6+СИЛ в ближнем бою',
    ]};
  }
  uiSet({sheet:{
    name:h.name,
    sub:'Человек · '+h.clsName+' · уровень '+h.level,
    row:[
      {k:'КД',v:String(h.ac)},
      {k:'Хиты',v:Math.max(0,h.hp)+'/'+h.maxhp},
      {k:'Скорость',v:h.speed+' кл.'},
      {k:'Иниц.',v:signed(mod(h.dex))},
    ],
    ab:[
      {l:'СИЛ',v:h.str,m:signed(mod(h.str))},
      {l:'ЛОВ',v:h.dex,m:signed(mod(h.dex))},
      {l:'ТЕЛ',v:h.con,m:signed(mod(h.con))},
      {l:'ИНТ',v:h.int,m:signed(mod(h.int))},
      {l:'МДР',v:h.wis,m:signed(mod(h.wis))},
      {l:'ХАР',v:h.cha,m:signed(mod(h.cha))},
    ],
    weapon:{name:w.name,dice:w.dice[0]+'d'+w.dice[1],mod:wm?' '+signed(wm):'',
      mode:w.melee?'ближний бой':'дальность '+w.range+' кл.'},
    armor:{name:h.armor||'—',ac:h.ac},
    potions:'Зелья лечения: '+h.potions+' — 2d4+2 (бонусное действие)',
    spells,
    features:[...h.features],
    xpPct:Math.min(100,h.xp/need*100),
    xpText:'Опыт: '+h.xp+' / '+need,
  }});
}

/* v0.8: переключение UI в режим исследования (после боя/карты/загрузки) */
function showExploreUI(){
  setActionbarVisible(false);
  setTopbar({round:MAP_NAME[G.mapId],turn:'',turnColor:null});/* v0.8 */
  renderInit();refreshTracker();
  refreshHintExplore();
}

/* ---- регистрации на шине (Фаза 5: разрыв циклов на ui) ---- */
bus.refreshParty.bind(renderParty);
bus.refreshInit.bind(renderInit);
bus.refreshBossBar.bind(renderBossBar);
bus.openExploreUI.bind(showExploreUI);
