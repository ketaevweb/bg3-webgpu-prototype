/* ================= PARTY (Фазы 4b–5 рефакторинга) =================
   Карточки отряда, боссбар, полоса инициативы, лист персонажа.
   Фаза 5: refreshParty/refreshInit/refreshBossBar/openExploreUI живут на
   шине bus (разрыв циклов systems/entities/interact → ui); реализации
   привязываются здесь, потребители зовут bus.*.call(). Перенесено дословно. */
import { UI } from '../hud';
import { $, mod } from '../utils';
import { units, G, S, MAP_NAME } from '../state';
import { STATUS, XP_NEED } from '../constants';
import { bus } from '../bus';
import { refreshTracker } from '../interact/quests';
import { refreshHintExplore } from '../interact/explore';
import type { Unit } from '../types';

function renderParty(){
  const el=$(UI.party);
  el.innerHTML='';
  for(const h of units.filter(u=>u.side==='hero')){
    const card=document.createElement('div');
    card.className='panel pcard'+(G.current===h&&h.alive?' active':'');
    const st=h.statuses.map(s=>
      '<span class="stb" style="background:'+STATUS[s.type].css+'">'+STATUS[s.type].tag+s.turns+'</span>').join('');
    const need=XP_NEED(h.level);
    card.innerHTML=
      '<div class="prow"><span class="pname">'+h.name+'</span><span class="pcls">'+h.clsName+' · ур. '+h.level+'</span></div>'+
      '<div class="pbar"><i style="width:'+Math.max(0,h.hp/h.maxhp*100)+'%"></i></div>'+
      '<div class="pinfo"><span>HP '+Math.max(0,h.hp)+'/'+h.maxhp+' • КД '+h.ac+'</span><span>Зелий: '+h.potions+'</span></div>'+
      '<div class="pst">'+st+'<span style="color:#8f866d;margin-left:auto">XP '+h.xp+'/'+need+'</span></div>';
    card.onclick=()=>showSheet(h);
    el.appendChild(card);
  }
}
/* v0.8: боссбар сверху экрана */
function renderBossBar(){
  const el=$(UI.bossbar);
  if(!el)return;
  const b=G.combatOn?S.combatGroup.find(g=>g.isBoss&&g.alive):null;
  if(!b){el.style.display='none';return;}
  el.style.display='block';
  $(UI.bossname).textContent=b.name+' — '+b.clsName;
  $(UI.bossfill).style.width=Math.max(0,b.hp/b.maxhp*100)+'%';
}
function renderInit(){
  renderBossBar();
  const el=$(UI.initRow);
  if(!G.combatOn){el.innerHTML='';return;}
  el.innerHTML=G.order.map(u=>
    '<span class="chip '+u.side+' '+(u===G.current?'cur ':'')+(!u.alive?'dead':'')+'">'+u.short+' '+u.init+'</span>').join('');
}
export function showSheet(h:Unit){
  const ab=(l:string,v:number)=>{
    const m=mod(v);
    return '<div class="ab"><span>'+l+'</span><b>'+v+'</b><i>'+(m>=0?'+':'')+m+'</i></div>';
  };
  const w=h.weapon,wm=mod(h[w.abil]);
  const need=XP_NEED(h.level);
  let spells='';
  if(h.cls==='wizard'){
    spells='<p>Ячейки заклинаний: <b>'+h.slots+'/'+h.slotsMax+'</b></p>'+
      '<p>• Огненные стрелы — 1d10+'+mod(h.int)+' огонь (действие)</p>'+
      '<p>• Огненный шар — 3d6 огонь, радиус 2.5 кл. (действие+ячейка)</p>'+
      '<p>• Лечащее слово — 1d4+'+mod(h.int)+' (бонус+ячейка)</p>'+
      '<p>• Благословение — +1d4 к атакам, 3 хода (бонус+ячейка)</p>';
  }else if(h.cls==='cleric'){/* v1.2 */
    spells='<p>Ячейки заклинаний: <b>'+h.slots+'/'+h.slotsMax+'</b></p>'+
      '<p>• Лечение — 1d8+'+mod(h.wis)+' (действие+ячейка)</p>'+
      '<p>• Щит веры — +2 КД, 3 хода (бонус+ячейка)</p>'+
      '<p>• Карание света — 2d6 излучения (действие+ячейка)</p>'+
      '<p>• Гнев рассвета — 2d6 излучения вокруг, нежить ×2 (1/бой)</p>';
  }else if(h.cls==='rogue'){/* v1.2 */
    spells='<p>Подлый удар: +'+(h.level>=3?'2d6':'1d6')+', если рядом с целью есть союзник</p>'+
      '<p>Отравленный клинок: зарядов на очереди — '+h.poisonBlade+'</p>';
  }
  $(UI.sheetbox).innerHTML=
    '<h2>'+h.name+'</h2>'+
    '<div class="sub">Человек · '+h.clsName+' · уровень '+h.level+'</div>'+
    '<div class="srow">'+
      '<div><span>КД</span><b>'+h.ac+'</b></div>'+
      '<div><span>Хиты</span><b>'+Math.max(0,h.hp)+'/'+h.maxhp+'</b></div>'+
      '<div><span>Скорость</span><b>'+h.speed+' кл.</b></div>'+
      '<div><span>Иниц.</span><b>'+(mod(h.dex)>=0?'+':'')+mod(h.dex)+'</b></div>'+
    '</div>'+
    '<div class="abgrid">'+
      ab('СИЛ',h.str)+ab('ЛОВ',h.dex)+ab('ТЕЛ',h.con)+ab('ИНТ',h.int)+ab('МДР',h.wis)+ab('ХАР',h.cha)+
    '</div>'+
    '<h3>Снаряжение</h3>'+
    '<p>Оружие: <b>'+w.name+'</b> — '+w.dice[0]+'d'+w.dice[1]+(wm>=0?'+':'')+wm+', '+(w.melee?'ближний бой':'дальность '+w.range+' кл.')+'</p>'+
    '<p>Доспех: <b>'+h.armor+'</b> (КД '+h.ac+')</p>'+
    '<p>Зелья лечения: '+h.potions+' — 2d4+2 (бонусное действие)</p>'+
    (h.cls==='wizard'?spells:'')+
    '<h3>Умения</h3>'+
    h.features.map(f=>'<p>• '+f+'</p>').join('')+
    '<div class="pbar" style="margin-top:10px"><i style="width:'+Math.min(100,h.xp/need*100)+'%"></i></div>'+
    '<p style="margin-top:3px">Опыт: '+h.xp+' / '+need+'</p>';
  $(UI.sheet).style.display='flex';
}

/* v0.8: переключение UI в режим исследования (после боя/карты/загрузки) */
function showExploreUI(){
  $(UI.actionbar).style.display='none';
  $(UI.turnb).textContent='';
  $(UI.round).textContent=MAP_NAME[G.mapId];/* v0.8 */
  renderInit();refreshTracker();
  refreshHintExplore();
}

/* ---- регистрации на шине (Фаза 5: разрыв циклов на ui) ---- */
bus.refreshParty.bind(renderParty);
bus.refreshInit.bind(renderInit);
bus.refreshBossBar.bind(renderBossBar);
bus.openExploreUI.bind(showExploreUI);
