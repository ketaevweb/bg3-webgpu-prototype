/* ================= DIALOG (Фазы 4–5 рефакторинга) =================
   Диалоги (DLGS), социальные проверки, бегство NPC. Фаза 5: циклы
   turns→dialog и explore→dialog разорваны — closeDlgHard/openDlg
   привязаны к шине bus (turns/explore зовут через неё); сам dialog
   спокойно импортирует turns/explore/progression — теперь это одна
   сторона графа. DLGS/опции типизированы (DlgFn/DlgOpt/DlgNode). */
import { mod } from '../utils';
import { d } from '../rng';
import { sfx } from '../audio';
import { G, S, units, KAYA_SPOT, SWAMP, busyOn, busyOff } from '../state';
import { bus } from '../bus';
import { uiSet } from '../ui/store';
import { setHint, log } from '../ui/overlays';
import { aliveHeroes, removeUnit } from '../entities/units';
import { startCombat } from '../systems/turns';
import { addStatus } from '../systems/statuses';
import { awardXP } from '../systems/progression';
import { questStart, questObj, questDone, QUESTS, refreshTracker } from '../interact/quests';
import { freeIlva, joinKaya, refreshHintExplore } from '../interact/explore';
import { joinOlkha } from '../interact/swamp';/* v1.5: друид болот (свамп не импортирует dialog — цикла нет) */
import { joinHaldir } from './citadel';/* v1.9: капитан Дозора (цитадель не импортирует dialog — цикла нет) */
import { openShop } from '../interact/shop';
import { addToBag, GEAR } from '../systems/gear';/* v2.2: обмен реликвий у стелы; v2.3: апгрейд */
import { tween } from '../fx/tweens';
import type { DlgFn, DlgOpt, Unit } from '../types';

/* ================= v2.2: ОБМЕН РЕЛИКВИЙ У СТЕЛЫ =================
   Призрак коменданта торгует реликвиями Глубин за золото (постгейм,
   цитадель — интеракт в citadel.ts). Каждая реликвия — одна на игру:
   «уже куплена» = в сумке ИЛИ надета кому-то из отряда. Сейф v2 не
   меняется — сумка/надетое и так пишутся (bag/heroes[].gear). */
export const RELIC_PRICE:Record<string,number>={abyss_heart:400,portal_shard:500,deep_seal:600};
export function relicOwned(id:string):boolean{
  return S.bag.includes(id)||units.some(u=>u.gear&&u.gear.trinket===id);
}
export function buyRelic(id:string):boolean{
  const p=RELIC_PRICE[id];
  if(!p||!GEAR[id])return false;
  if(relicOwned(id)){log('«'+GEAR[id].n+'» уже у отряда — вторую Глубины не отдадут.','g-sys');return false;}
  if(S.gold<p){log('Не хватает золота: «'+GEAR[id].n+'» стоит '+p+' (в казне '+S.gold+').','g-enemy');return false;}
  S.gold-=p;
  addToBag(id);
  sfx.gold();
  log('Призрак коменданта отдаёт «'+GEAR[id].n+'»: −'+p+' золота (осталось '+S.gold+').','g-heal');
  return true;
}

/* ================= v2.3: АПГРЕЙД РЕЛИКВИЙ У ПРИЗРАКА =================
   Призрак усиливает уже купленную реликвию за золото (по одному разу
   на игру; состояние — S.relicUp, сейв v2 — опциональное поле).
   Усиливается только реликвия, лежащая в СУМКЕ: эффект eq/uneq
   (gear.ts, relicBoost) читает S.relicUp в момент надевания — так
   бонус применяется симметрично без пересчёта надетого. */
export const RELIC_UP:Record<string,{p:number;nd:string}>={
  abyss_heart:{p:500,nd:'Талисман (усилен): +18 к макс. хитам. Сердце бездны бьётся в полный голос — приливы отвечают.'},
  portal_shard:{p:700,nd:'Талисман (усилен): +2 к броскам атаки. Глубины смотрят в прицел вместе с вами — обоими глазами.'},
  deep_seal:{p:900,nd:'Талисман (усилен): +3 КД. Печать коменданта признана Глубинами дважды — и это не предел.'},
};
export function relicUpgraded(id:string):boolean{return Array.isArray(S.relicUp)&&S.relicUp.includes(id);}
export function upgradeRelic(id:string):boolean{
  const up=RELIC_UP[id];
  if(!up||!GEAR[id])return false;
  if(!relicOwned(id)){log('Сначала выкупите «'+GEAR[id].n+'» — усиление идёт после покупки.','g-sys');return false;}
  if(relicUpgraded(id)){log('«'+GEAR[id].n+'» уже усилена — глубже Глубины не предлагают.','g-sys');return false;}
  if(!S.bag.includes(id)){log('Снимите «'+GEAR[id].n+'» — призрак усиливает реликвию, лежащую в сумке.','g-sys');return false;}
  if(S.gold<up.p){log('Не хватает золота на усиление: нужно '+up.p+' (в казне '+S.gold+').','g-enemy');return false;}
  S.gold-=up.p;
  S.relicUp=[...(S.relicUp||[]),id];
  GEAR[id].d=up.nd;/* описание в панели снаряжения обновляется следом */
  sfx.gold();
  log('Призрак коменданта усиливает «'+GEAR[id].n+'»: −'+up.p+' золота (осталось '+S.gold+').','g-heal');
  return true;
}

/* ---- диалоги ---- */
export function openDlg(npc:string){
  if(G.combatOn||G.phase==='over')return;
  busyOn();G.phase='dialogue';
  sfx.dialog();
  S.dlgNpc=npc;
  bus.tutEvent.call('talk');/* v1.4: шаг обучения «Разговор» */
  setHint('');
  showNode('start');
}
export function closeDlg(){
  uiSet({dlg:null});
  S.dlgNpc=null;
  if(G.phase==='dialogue'){G.phase='explore';busyOff();}
  refreshHintExplore();
}
export function closeDlgHard(){
  uiSet({dlg:null});
  S.dlgNpc=null;
  G.busyCount=Math.max(0,G.busyCount-1);G.busy=G.busyCount>0;
}
export function gotoNode(id:string){showNode(id);}
export function socialCheck(req:{skill:string;dc:number}):boolean{
  const hs=aliveHeroes();
  const best=hs.reduce((a,b)=>mod(b.cha)>mod(a.cha)?b:a);
  const r=d(20),m=mod(best.cha)+2,tot=r+m;
  const ok=r===20||(r!==1&&tot>=req.dc);
  log('Проверка «'+req.skill+'» СЛ '+req.dc+': d20 '+r+(m>=0?'+':'')+m+' ('+best.short+') = '+tot+' — '+(ok?'УСПЕХ!':'провал.'),ok?'g-heal':'g-enemy');
  return ok;
}
export function showNode(id:string){
  const fn=S.dlgNpc?DLGS[S.dlgNpc]:undefined;
  const n=fn?fn(id):null;
  if(!n)return closeDlg();
  const opts=(n.opts||[]).filter(o=>!o.show||o.show()).map(o=>({
    t:o.t,
    req:!!o.req,
    onClick:()=>{
      if(o.req){
        const ok=socialCheck(o.req);
        showNode(ok?(o.ok||'start'):(o.fail||'start'));
        return;
      }
      if(o.end){closeDlg();if(o.fn)o.fn();return;}
      if(o.fn)o.fn();
    },
  }));
  uiSet({dlg:{name:n.name,text:n.text,opts}});
}
export const DLGS:Record<string,DlgFn>={
  patrol(id){
    if(id==='start')return{name:'Гоблин-патрульный',
      text:'Стоять! Смердяки с юга?.. Это земля племени Кости! Уходи, пока кишки внутри!',
      opts:[
        {t:'[Запугивание СЛ 13] «У реки мы вырезали ваш дозор. Бежать, пока целы.»',req:{skill:'Запугивание',dc:13},ok:'scared',fail:'fight'},
        {t:'[Убеждение СЛ 15] «Мы торговцы — идём к Грату с дарами. Не мешайте.»',req:{skill:'Убеждение',dc:15},ok:'pass',fail:'fight'},
        {t:'«В атаку, отродья!»',fn:()=>{S.patrolDone=true;startCombat(S.patrolGroup.filter(g=>g.alive));}},
        {t:'«Медленно отойти.»',end:true,fn:()=>{S.patrolDone=true;log('Гоблины провожают вас подозрительными взглядами.','g-sys');}},
      ]};
    if(id==='scared')return{name:'Гоблин-патрульный',text:'Д-демоны!! Отступаем! ОТСТУПАЕМ!!',
      opts:[{t:'(Смотреть, как патруль обращается в бегство)',end:true,fn:()=>{S.patrolDone=true;awardXP(40);fleeUnits(S.patrolGroup);}}]};
    if(id==='pass')return{name:'Гоблин-патрульный',text:'Торговцы, значит?.. Ладно. Ступайте в лагерь, дары Грату. Только не рыпайтесь!',
      opts:[{t:'(Кивнуть и пройти)',end:true,fn:()=>{S.patrolDone=true;S.patrolGroup.forEach(g=>{g.pacified=true;});awardXP(40);log('Патруль вас пропустил.','g-sys');}}]};
    if(id==='fight')return{name:'Гоблин-патрульный',text:'Ложь! Чужакам — смерть!',
      opts:[{t:'«Как знаете.»',fn:()=>{S.patrolDone=true;startCombat(S.patrolGroup.filter(g=>g.alive));}}]};
  },
  boss(id){
    if(id==='start'){
      const opts:DlgOpt[]=[];
      if(S.knowsBoss)opts.push({t:'[Знание Илвы] «Помнишь драконий огонь, что оставил тебе те шрамы, Грат?»',fn:bossFear});
      opts.push(
        {t:'[Запугивание СЛ 16] «Ваш лагерь станет пеплом. Уведите щенков, пока целы.»',req:{skill:'Запугивание',dc:16},ok:'cow',fail:'fight'},
        {t:'«В бой!»',fn:()=>{S.campDone=true;startCombat(S.campGroup.filter(g=>g.alive));}});
      return{name:'Грат Костолом',text:'ХА! Мясо само пришло в котёл! Я — Грат Костолом, и сегодня вы — УЖИН!',opts};
    }
    if(id==='cow')return{name:'Грат Костолом',text:'Ч-что?.. Прочь! УХОДИТЕ! За мной, трусы!',
      opts:[{t:'(Часть гоблинов в панике разбегается)',fn:()=>{S.campDone=true;fleeUnits(S.campGroup.filter(g=>g.alive&&(g.short.startsWith('Лучник')||g.short.startsWith('Задира'))));startCombat(S.campGroup.filter(g=>g.alive));}}]};
    if(id==='fight')return{name:'Грат Костолом',text:'КОСТИ! КОСТИ! КОСТИ!',
      opts:[{t:'«С прискорбием.»',fn:()=>{S.campDone=true;startCombat(S.campGroup.filter(g=>g.alive));}}]};
  },
  damrock(id){
    if(id==='start')return{name:'Дамрок Бочкарь',
      text:'Ох, живые души! Не верю глазам своим. Дамрок я, торговец. Гоблины Костей тракт перекрыли — торчу тут без дела. Чем помогу?',
      opts:[
        {t:'«Покажи товар.»',fn:()=>{closeDlg();openShop();}},
        {t:'«Что случилось?»',show:()=>QUESTS.crate.state==='hidden',fn:()=>gotoNode('story')},
        {t:'«Вот ваш ящик с товаром.»',show:()=>S.hasCrate&&QUESTS.crate.state==='active',fn:()=>gotoNode('cratedone')},
        {t:'[Убеждение СЛ 12] «Героям положена скидка, сам знаешь.»',req:{skill:'Убеждение',dc:12},ok:'discok',fail:'discfail'},
        {t:'«Что известно о крипте в кургане?»',show:()=>QUESTS.main.state==='done'&&QUESTS.crypt.state==='hidden',fn:()=>gotoNode('cryptinfo')},
        {t:'«Что за песня доносится с восточных болот?»',show:()=>QUESTS.crypt.state==='done'&&QUESTS.swamp.state==='hidden',fn:()=>gotoNode('swampinfo')},/* v1.5 */
        {t:'«Тропа на северо-запад — куда она ведёт?»',show:()=>QUESTS.swamp.state==='done'&&QUESTS.giants.state==='hidden',fn:()=>gotoNode('giantsinfo')},/* v1.6 */
        {t:'«Цитадель Дозора — что о ней слыхано?»',show:()=>QUESTS.giants.state==='done'&&QUESTS.citadel.state==='hidden',fn:()=>gotoNode('citadelinfo')},/* v1.8 */
        {t:'«До встречи.»',end:true},
      ]};
    if(id==='story')return{name:'Дамрок Бочкарь',
      text:'Случилось-то — беда! Ограбили меня вдоль и поперёк: ящик с товаром утащили в свой лагерь, вон там валяется, у шатров. Вернёшь — не обижу!',
      opts:[{t:'«Найду ваш ящик.»',fn:()=>{questStart('crate');gotoNode('start');}}]};
    if(id==='cratedone')return{name:'Дамрок Бочкарь',text:'Мой ящичек! Ай да герои! Держите награду — и скидка вечная, слово Бочкаря!',
      opts:[{t:'«Служим Долгому Дозору.»',end:true,fn:()=>{questObj('crate','return');questDone('crate');}}]};
    if(id==='discok')return{name:'Дамрок Бочкарь',text:'Ладно-ладно, краснобай... Десятина скидки — и не больше!',
      opts:[{t:'«Договорились.»',end:true,fn:()=>{S.discount=true;log('Дамрок даёт отряду скидку 20%.','g-sys');refreshTracker();}}]};
    if(id==='discfail')return{name:'Дамрок Бочкарь',text:'Думешь, красные глазки меня тронули? Плати как все, герой.',
      opts:[{t:'«Жадина.»',end:true}]};
    if(id==='cryptinfo')return{name:'Дамрок Бочкарь',/* v0.8 */
      text:'Крипту? Слушай сюда: как Грат пал — вход вскрылся, северо-восток, ступени под корнями кургана. Мертвецы на тракте — не гоблинская работа, это Костепёр ниточки дёргает. Возьмите огня, света и... не умирайте, а то скидку кому оставлять буду?',
      opts:[{t:'«Зачистим. Держи лавку открытой.»',fn:()=>{questStart('crypt');gotoNode('start');}}]};
    if(id==='swampinfo')return{name:'Дамрок Бочкарь',/* v1.5 */
      text:'И слыхал, и сплюнул. На востоке тракт утонул — культисты Глубинного там завелись, жрица ихняя тину будит. Гать я ещё подлатаю, доски держат. Только возьми кого-то, кто громом швыряет: гниловар огня не боится, а вот молния ей — как кочерга по зубам.',
      opts:[{t:'«Зачистим и болота.»',fn:()=>{questStart('swamp');gotoNode('start');}}]};
    if(id==='giantsinfo')return{name:'Дамрок Бочкарь',/* v1.6 */
      text:'Не ходи туда, ой не ходи... Хотя тебе-то что, ты герои. Слыхал: перевал на северо-запад огры заняли, а старшой ихний Гаррум Камнегрыз валунами издалека кидается. Большие, аги! Но жадные: вожак свой сундук с добром при лагере держит. Разгоните — и дорога к дозорным откроется.',
      opts:[{t:'«Перевал будет наш.»',fn:()=>{questStart('giants');gotoNode('start');}}]};
    if(id==='citadelinfo')return{name:'Дамрок Бочкарь',/* v1.8 */
      text:'Цитадель?.. Плохие новости, герой. Дозорные не выходили на тракт три луны, а с севера ветер несёт песню — ту самую, что с болот. Раз Гаррум повержен — тракт на северо-восток перевала свободен, ступени сами покажутся. Но возьми всё: в цитадели теперь поют утопленники, а комендант ихний... говорят, сам МАЛВЕХ им поёт. Вот это поворот, да?',
      opts:[{t:'«Цитадель будет нашей. Дозор встанет.»',fn:()=>{questStart('citadel');gotoNode('start');}}]};
  },
  ilva(id){
    if(id==='start')return{name:'Илва (в клетке)',
      text:'Пс! Эй! Вы не из племени Костей? Илва я, разведчица Долгого Дозора. Эти твари поймали меня, пока я следила за их вожаком.',
      opts:[
        {t:'«Кто их вожак?»',fn:()=>gotoNode('bossinfo')},
        {t:'[Взломать замок] «Сейчас освободим!»',fn:()=>{closeDlg();freeIlva();}},
        {t:'«Держись.»',end:true},
      ]};
    if(id==='bossinfo')return{name:'Илва (в клетке)',
      text:'Грат Костолом. Двухметровый отбойник с тесаком. Но есть слабость: однажды он здорово обгорел в пожаре и ПАНИЧЕСКИ боится огня. Шепни ему об этом — и увидишь, как дрогнут его колени.',
      opts:[{t:'«Запомним. Держись, Илва.»',end:true,fn:()=>{if(!S.knowsBoss){S.knowsBoss=true;log('Получены сведения о слабости вожака!','g-sys');}}}]};
  },
  kaya(id){/* v1.2: жрица-спутница */
    if(id==='start')return{name:'Кая Заря',
      text:'Мир вам, путники. Я — Кая, жрица Рассвета. Иду на север: в кургане кости шумят слишком громко для спокойного мертвеца. Одна мне не справиться с тем, что ждёт под землёй.',
      opts:[
        {t:'«Идём с нами. Нам нужны молитвы и лечащие руки.»',end:true,fn:()=>{closeDlg();joinKaya(KAYA_SPOT[0]+1,KAYA_SPOT[1]);}},
        {t:'«Что слышно о кургане?»',fn:()=>gotoNode('rumor')},
        {t:'«Мы справимся сами.»',end:true,fn:()=>{log('Кая кивает и продолжает молитву.','g-sys');}},
      ]};
    if(id==='rumor')return{name:'Кая Заря',
      text:'Паломники рассказывали: некромант в глубине поднимает мёртвых одну за другой. Мой молот против него слаб, а вот рассветный гнев — нет. Позвольте идти с вами.',
      opts:[
        {t:'«Идём с нами. Нам нужны лечащие руки.»',end:true,fn:()=>{closeDlg();joinKaya(KAYA_SPOT[0]+1,KAYA_SPOT[1]);}},
        {t:'«Позже.»',end:true},
      ]};
  },
  necro(id){/* v0.8: босс крипты */
    if(id==='start')return{name:'Вхорил Костепёр',
      text:'Ах-х... тёплые. ТАКИЕ тёплые гости. Грат был грубым инструментом, а я работаю тонко: одна ниточка за лопатку — и ты уже мой. Останьтесь. НАВСЕГДА.',
      opts:[
        {t:'[Запугивание СЛ 16] «Я сотру твой жезл в пыль, костяной кукловод.»',req:{skill:'Запугивание',dc:16},ok:'brave',fail:'fight'},
        {t:'«Пепел тебе вместо философского камня!»',fn:()=>gotoNode('fight')},
        {t:'«Медленно отойти к лестнице.»',end:true,fn:()=>{log('Костепёр провожает вас смехом, похожим на стрёкот костей.','g-enemy');}},
      ]};
    if(id==='brave')return{name:'Вхорил Костепёр',
      text:'Пыль?.. ПЫЛЬ?! Ну что ж... пусть будет по-вашему. КОСТИ! ПОДНИМАЙТЕСЬ И УБЕЙТЕ ИХ!',
      opts:[{t:'«В бой!»',fn:()=>startCombat(S.cryptGroup.filter(g=>g.alive))}]};
    if(id==='fight')return{name:'Вхорил Костепёр',
      text:'Ха! Философы с мечами. КОСТИ не спорят — КОСТИ ПОВИНУЮТСЯ!',
      opts:[{t:'«В бой!»',fn:()=>startCombat(S.cryptGroup.filter(g=>g.alive))}]};
  },
  swampboss(id){/* v1.5: жрица болот */
    if(id==='start')return{name:'Ульва, Матерь Топей',
      text:'Теплокровные... Шли по моим костьм — Грат, Костепёр... Все шли. Теперь тина их гладит. И вас она погладит. Пой, тина, пой!',
      opts:[
        {t:'[Запугивание СЛ 16] «Твой кумир — гнилое бревно. Я вытащу тебя за волосы.»',req:{skill:'Запугивание',dc:16},ok:'brave',fail:'fight'},
        {t:'«Болота будут дышать свободой!»',fn:()=>gotoNode('fight')},
        {t:'«Медленно отойти по гати.»',end:true,fn:()=>{log('Ульва поёт — и вода под сапогами кажется теплее, чем должна быть.','g-enemy');}},
      ]};
    if(id==='brave')return{name:'Ульва, Матерь Топей',
      text:'ГЛУБИНА... ПОДНИМИ ИХ. ПОДНИМИ ИХ ВСЕХ!',
      opts:[{t:'«В бой!»',fn:()=>startCombat(S.swampGroup.filter(g=>g.alive))}]};
    if(id==='fight')return{name:'Ульва, Матерь Топей',
      text:'Пой, тина, пой! УТОПШИЕ, ПОДНИМАЙТЕСЬ!',
      opts:[{t:'«В бой!»',fn:()=>startCombat(S.swampGroup.filter(g=>g.alive))}]};
  },
  olkha(id){/* v1.5: прикованная друидка */
    if(id==='start')return{name:'Ольха (прикована к идолу)',
      text:'Тихо... не будите тину. Я — Ольха, друид этого тракта. Ульва приковала меня к идолу Глубинного, когда я отказалась петь ей.',
      opts:[
        {t:'«Сейчас освободим. Идём с нами.»',end:true,fn:()=>{closeDlg();joinOlkha(SWAMP.OLKHA[0],SWAMP.OLKHA[1]);}},
        {t:'«Кто такая Ульва?»',fn:()=>gotoNode('ulva')},
        {t:'«Держись.»',end:true},
      ]};
    if(id==='ulva')return{name:'Ольха (прикована к идолу)',
      text:'Жрица Глубинного. Отравила родники — и топь пошла расти. Хлыст её жжётся ядом, а на полсмерти она поднимает утопленников. Возьмите в отряд того, кто бьёт громом: молния ей вреднее огня.',
      opts:[{t:'«Идём с нами.»',end:true,fn:()=>{closeDlg();joinOlkha(SWAMP.OLKHA[0],SWAMP.OLKHA[1]);}}]};
  },
  haldir(id){/* v1.9: капитан Дозора у знамён (постгейм после финала) */
    if(id==='start')return{name:'Хальдир, Капитан Дозора',
      text:'Сорок дней я держал внешнюю башню, пока Малвех пел свою песню. Слышал её и я — но клятва оказалась громче. Вы вернули цитадель, командир. Дозор жив — и я с ним, если возьмёте.',
      opts:[
        {t:'«Твой молот будет кстати. Идём с нами.»',end:true,fn:()=>{closeDlg();joinHaldir();}},
        {t:'«Что ты помнишь о Глубинном?»',fn:()=>gotoNode('haldeep')},
        {t:'«Держи башню. Мы вернёмся.»',end:true},
      ]};
    if(id==='haldeep')return{name:'Хальдир, Капитан Дозора',
      text:'Он пришёл снизу — из-под камня, из-под воды. Не враг, а голод: песня съедает волю, и тело остаётся служить. Мы сжигали знамёна, чтобы не слушать. Портал за его спиной всё ещё открыт — тени там не переводятся. Хотите славы — испытайте себя.',
      opts:[{t:'«Идём с нами.»',end:true,fn:()=>{closeDlg();joinHaldir();}},
        {t:'«Испытание — позже. Держись.»',end:true}]};
  },
  ghost(id){/* v2.2: призрак коменданта у стелы — обмен реликвий Глубин; v2.3: апгрейд */
    if(id==='start')return{name:'Призрак коменданта',
      text:'«Казна Дозора против казны Глубин, капитан. У стелы платят золотом — и глубины платят тем же. В твоей казне '+S.gold+' монет; камни портала держат мои реликвии. Бери, пока я не развеялся».',
      opts:[
        {t:'[Реликвия] Сердце бездны — 400 зол. (талисман: +10 макс. HP)',show:()=>!relicOwned('abyss_heart'),fn:()=>{buyRelic('abyss_heart');showNode('start');}},
        {t:'[Реликвия] Осколок портала — 500 зол. (талисман: +1 к атаке)',show:()=>!relicOwned('portal_shard'),fn:()=>{buyRelic('portal_shard');showNode('start');}},
        {t:'[Реликвия] Печать глубин — 600 зол. (талисман: +2 КД)',show:()=>!relicOwned('deep_seal'),fn:()=>{buyRelic('deep_seal');showNode('start');}},
        {t:'[Улучшение] Сердце бездны — 500 зол. (+10 → +18 макс. HP)',show:()=>relicOwned('abyss_heart')&&!relicUpgraded('abyss_heart'),fn:()=>{upgradeRelic('abyss_heart');showNode('start');}},
        {t:'[Улучшение] Осколок портала — 700 зол. (+1 → +2 к атаке)',show:()=>relicOwned('portal_shard')&&!relicUpgraded('portal_shard'),fn:()=>{upgradeRelic('portal_shard');showNode('start');}},
        {t:'[Улучшение] Печать глубин — 900 зол. (+2 → +3 КД)',show:()=>relicOwned('deep_seal')&&!relicUpgraded('deep_seal'),fn:()=>{upgradeRelic('deep_seal');showNode('start');}},
        {t:'[Уйти] Стела ждёт — волны не ждут.',end:true},
      ]};
    return null;
  },
  giantboss(id){/* v1.6: вожак великанов */
    if(id==='start')return{name:'Гаррум Камнегрыз',
      text:'Кто топчет мой перевал? Мясо... мелкое мясо с железом. Досчитай до ста, мясцо, — я в тебя брошу камень размером с тебя.',
      opts:[
        {t:'[Запугивание СЛ 17] «Дозор снёс Грата, Костепёра и Матерь Топей. Хочешь следующим?»',req:{skill:'Запугивание',dc:17},ok:'scared',fail:'fight'},
        {t:'«Мост — наш, и тропа тоже!»',fn:()=>gotoNode('fight')},
        {t:'«Медленно отойти за мост.»',end:true,fn:()=>{log('Гаррум провожает вас голодным взглядом и грызёт камень.','g-enemy');}},
      ]};
    if(id==='scared')return{name:'Гаррум Камнегрыз',
      text:'П-пустые слова! КАМЕНЬ. НЕ. БОИТСЯ!',
      opts:[{t:'«Что ж, по-старому.»',fn:()=>startCombat(S.giantsGroup.filter(g=>g.alive))}]};
    if(id==='fight')return{name:'Гаррум Камнегрыз',
      text:'ГРА-А-АВ! КАМНИ НА ГОТОВЕ!',
      opts:[{t:'«В бой!»',fn:()=>startCombat(S.giantsGroup.filter(g=>g.alive))}]};
  },
  citadelboss(id){/* v1.8: лорд-комендант цитадели — финальный босс */
    if(id==='start')return{name:'Малвех, лорд-комендант',
      text:'Дозорные?.. Нет. Дозорные — внизу, в тине. Я слышал её песню на стене и понял: глубина — это покой. Опустите оружие. ГЛУБИНА ПРИМЕТ ВСЕХ.',
      opts:[
        {t:'[Убеждение СЛ 18] «Малвех! Дозор не сдаёт стен. Ты — Дозор. Вспомни!»',req:{skill:'Убеждение',dc:18},ok:'waver',fail:'fight'},
        {t:'«Цитадель вернём. С мечом — так с мечом!»',fn:()=>gotoNode('fight')},
        {t:'«Медленно отойти за ворота.»',end:true,fn:()=>{log('Малвех поёт — и бразиры двора гаснут до синевы.','g-enemy');}},
      ]};
    if(id==='waver')return{name:'Малвех, лорд-комендант',
      text:'Дозор... не сдаёт... СТЕН?! Н-нет. НЕТ! ГЛУБИНА — МОЙ ДОЗОР ТЕПЕРЬ!',
      opts:[{t:'«Как знаешь, комендант.»',fn:()=>startCombat(S.citadelGroup.filter(g=>g.alive))}]};
    if(id==='fight')return{name:'Малвех, лорд-комендант',
      text:'ТОГДА ТИНА ПОГЛАДИТ И ВАС! ГЛУБИНА! СЛУШАЙ ЗОВ!',
      opts:[{t:'«В бой!»',fn:()=>startCombat(S.citadelGroup.filter(g=>g.alive))}]};
  },
};
export function bossFear(){
  const grat=S.campGroup.find(g=>g.isBoss);
  log('Вы напоминаете Грату о старом пожаре — вожак бледнеет и хватается за тесак.','g-sys');
  if(grat&&grat.alive)addStatus(grat,'fear',99);
  fleeUnits(S.campGroup.filter(g=>g.alive&&g.short.startsWith('Задира')));
  S.campDone=true;
  startCombat(S.campGroup.filter(g=>g.alive));
}
export function fleeUnits(arr:Unit[]){
  for(const g of arr){
    if(!g.alive)continue;
    log(g.name+' обращается в бегство!','g-sys');
    g.alive=false;
    const m=g.mesh,el=g._el;
    tween(0.45,k=>{m.scale.setScalar(Math.max(0.01,1-k));if(el)el.style.opacity=String(1-k);})
      .then(()=>removeUnit(g));
  }
}

/* ---- регистрация на шине (Фаза 5: turns→closeDlgHard, explore→openDlg без циклов) ---- */
bus.openDlg.bind(openDlg);
bus.closeDlgHard.bind(closeDlgHard);
