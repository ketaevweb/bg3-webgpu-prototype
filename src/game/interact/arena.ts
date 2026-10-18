/* ================= ARENA «ИСПЫТАНИЕ ГЛУБИН» (v1.9 «Слава Дозора» + v2.0 «Бесконечное испытание») ====
   Постгейм-контент после финала кампании (campaignDone): у портала
   цитадели открывается повторяемое испытание — пять волн теней павших
   (утопленники → кости → песнь глубин → стена щитов → гнев бездны).
   За волну — золото и перевязка, за всё испытание — награда коменданта.
   v2.0: после победы в испытании портал меняет лик — БЕСКОНЕЧНОЕ
   ИСПЫТАНИЕ (волны 6+): составы циклятся, глубина k=w−5 поднимает
   hp (×1.12^k) и урон (+½k к кости), каждый 5-й глубинной волны
   приводит Чемпиона бездны (элита). Рекорд волн (S.arenaBest)
   попадает в сейв (опциональное поле v2) и открывает бесконечный
   режим сразу при заходе на карту (citadel.ts читает S.arenaBest).
   v2.3: каждая 10-я глубинная волна (k%10===0) — ТЕНЬ ОТРЯДА: глубины
   соткают зеркальные копии живых героев (КД/оружие/характеристики оригинала,
   тёмный тинт, усиление глубины). Рекорд (S.arenaBest) при каждом улучшении
   уходит в серверную летопись Глубин (/api/scores), стела читает топ-10.
   v2.4: СЕЗОНЫ ГЛУБИНЫ — еженедельный ротационный аффикс (interact/season.ts)
   меняет баланс глубинных волн и красит тени (косметика тени); панель
   «Летопись Глубин» (T) собирает сезон, рекорд, журнал и серверный топ.
   Циклы: прогресс зовёт нас через bus.arenaNext (arena→turns→progression),
   прямых обратных импортов из systems в interact/arena нет. */
import { d } from '../rng';
import { G, S, GW, interactables } from '../state';
import { bus } from '../bus';
import { sfx } from '../audio';
import { bigBanner, log } from '../ui/overlays';
import { startCombat, joinCombat } from '../systems/turns';
import { die } from '../systems/combat';
import { checkEnd } from '../systems/progression';
import { healUnit } from '../systems/vitals';
import { gainGold } from './quests';
import { freeSpotNear } from '../world/grid';
import { makeDrowned, makeSkeleton, makeSkeletonKnight, makeCultist, makeKnight, makeAdept, makeOgre, applyElite } from '../entities/roster';
import { makeUnit, aliveHeroes } from '../entities/units';
import { postScore, topScores } from '../save/leaderboard';/* v2.3: серверная летопись глубины */
import { seasonBoost, seasonExtraEnemy, seasonRewardMult, announceSeason, seasonDef } from './season';/* v2.4: сезоны глубины */
import type { Unit } from '../types';

export const WAVES=5;/* волн в испытании; глубже — бесконечный режим */
const ENDLESS_NAMES=['прилив теней','хор глубин','стражи костей','клеймо бездны','ярость толпы'];/* названия волн 6+ */
const SPAWN=[[10,13],[18,13],[14,16],[8,14],[20,15],[12,12],[16,12]];/* внешний двор */

/* точка спавна: обходим занятые клетки вокруг якоря внешнего двора */
function spot(i:number):{x:number;z:number}{
  const a=SPAWN[i%SPAWN.length];
  return freeSpotNear(GW,{x:a[0],z:a[1]},2)||{x:a[0],z:a[1]};
}

/* состав волны: тенях павших — по восходящей */
function waveGroup(w:number):Unit[]{
  const out:Unit[]=[];
  const n=w===1?2:(w===2?3:(w===3?3:(w===4?2:3)));
  for(let i=0;i<n;i++){
    const p=spot(i);
    if(w===1)out.push(makeDrowned(p.x,p.z));
    else if(w===2)out.push(i===2?makeSkeletonKnight(p.x,p.z):makeSkeleton(p.x,p.z));
    else if(w===3)out.push(i===2?makeCultist('acolyte',p.x,p.z):makeCultist('deep',p.x,p.z));
    else if(w===4)out.push(makeKnight(p.x,p.z));
    else out.push(i===0?makeKnight(p.x,p.z):(i===1?makeAdept(p.x,p.z):makeOgre(p.x,p.z)));
  }
  return out;
}

/* ---- вход в испытание: интеракт у портала цитадели вешает interact/citadel.ts
   (у него уже есть addInteract) — арена даёт arenaStart()/arenaEndless().
   v2.0: рекорд ≥5 (испытание пройдено) — старт в бесконечный режим ---- */
export function arenaStart(){
  if(S.arenaBest>=WAVES){arenaEndless();return;}
  if(G.combatOn){log('Испытание ждёт конца текущего боя.','g-sys');return;}
  if(!S.campaignDone){log('Портал молчит: песня Глубинного ещё не умолкла.','g-sys');return;}
  if(G.mapId!=='citadel')return;
  G.arenaRun++;/* v2.1: новый заход — старые таймеры волн умирают молча */
  G.arenaWave=1;
  sfx.stinger('wave');
  bigBanner('ИСПЫТАНИЕ ГЛУБИН');
  log('Изумрудный портал вспыхивает: из-под двора поднимаются тени павших. Пять волн — и награда коменданта.','g-sys');
  spawnWave();
}
/* ---- v2.0: бесконечное испытание — волны 6,7,8… до гибели отряда или ухода ---- */
export function arenaEndless(){
  if(G.combatOn){log('Испытание ждёт конца текущего боя.','g-sys');return;}
  if(!S.campaignDone){log('Портал молчит: песня Глубинного ещё не умолкла.','g-sys');return;}
  if(G.mapId!=='citadel')return;
  G.arenaRun++;/* v2.1: новый заход — старые таймеры волн умирают молча */
  G.arenaWave=WAVES+1;
  sfx.stinger('wave');
  bigBanner('БЕСКОНЕЧНОЕ ИСПЫТАНИЕ');
  log('Портал ревёт в полный голос: глубины признали победителя — и требуют нового. Волны не иссякнут, пока стоит отряд.','g-sys');
  announceSeason();/* v2.4: сезон недели — аффикс и облик тени */
  spawnWave();
}
/* глубина k=w−5 (балансовая таблица v2.1):
   hp ×(1+0.12k) · кость урона +⌊k/2⌋ · КД +min(⌊k/4⌋,2) · имя «Глубинный».
   v2.2: xp ×(1+0.12k) — глубина оплачивается опытом (сверх предела — золотом).
   weapon клонируем: шаблоны ростера разделяют объект (makeUnit не копирует).
   v2.3: noPrefix — тени отряда не получают приставку «Глубинный».
   v2.4: сезонный аффикс недели применяется после глубинного усиления
   (Мора множит уже усиленную жизнь; тинт — облик сезона). */
function endlessBoost(u:Unit,w:number,noPrefix=false){
  const k=w-WAVES;
  u.weapon={...u.weapon,dice:[...u.weapon.dice]};
  u.weapon.dice[1]+=Math.floor(k/2);
  u.ac+=Math.min(Math.floor(k/4),2);/* v2.1: КД растёт медленнее hp — пробитие остаётся */
  const mult=1+0.12*k;
  u.maxhp=Math.round(u.maxhp*mult);
  u.hp=u.maxhp;
  u.xp=Math.round((u.xp||0)*mult);/* v2.2: калибровка XP глубинных волн */
  if(!noPrefix)u.name='Глубинный '+u.name;
  u.depth=k;
  seasonBoost(u);/* v2.4: сезон недели — модификаторы + перекраска */
  return u;
}
/* ---- v2.3: ТЕНЬ ОТРЯДА — зеркальная волна-босс. Состав = живые герои:
   каждый теневой двойник повторяет характеристики, КД и оружие оригинала
   (снаряжение уже учтено в полях героя), тёмный тинт, ИИ рядового врага. ---- */
function mirrorGroup(w:number):Unit[]{
  const out:Unit[]=[];
  for(const h of aliveHeroes()){
    const p=spot(out.length);
    out.push(makeUnit({
      name:'Тень: '+h.name,short:'Тень',side:'goblin',
      cls:h.cls,clsName:'Тень',x:p.x,z:p.z,
      str:h.str,dex:h.dex,con:h.con,int:h.int,wis:h.wis,cha:h.cha,
      hp:h.maxhp,maxhp:h.maxhp,ac:h.ac,speed:h.speed,xp:150,
      color:0x23232e,skin:0x15151d,
      weapon:{...h.weapon,dice:[...h.weapon.dice]},
      dagger:h.dagger?{...h.dagger,dice:[...h.dagger.dice]}:null,
      keepDist:!h.weapon.melee,features:['Отражение из глубин: повторяет снаряжение и закалку оригинала'],
    }));
  }
  for(const u of out)endlessBoost(u,w,true);
  return out;
}
/* состав глубинных волн: цикл рецептов по (w−6)%5, каждый 5-й глубинной — чемпион */
function endlessGroup(w:number):Unit[]{
  const out:Unit[]=[];
  const r=(w-6)%5;
  const push=(mk:(x:number,z:number)=>Unit)=>{const p=spot(out.length);out.push(mk(p.x,p.z));};
  const deep=(x:number,z:number)=>makeCultist('deep',x,z);
  const ac=(x:number,z:number)=>makeCultist('acolyte',x,z);
  if(r===0){push(makeDrowned);push(makeDrowned);push(makeSkeletonKnight);}
  else if(r===1){push(deep);push(deep);push(ac);push(makeDrowned);}
  else if(r===2){push(makeKnight);push(makeKnight);push(makeSkeleton);}
  else if(r===3){push(makeOgre);push(makeKnight);push(makeAdept);}
  else {push(makeSkeleton);push(makeSkeleton);push(deep);push(makeDrowned);}
  if(seasonExtraEnemy()){/* v2.4 «Ярость толпы»: глубины выставляют лишнего */
    const p=spot(out.length);out.push(makeDrowned(p.x,p.z));
  }
  for(const u of out)endlessBoost(u,w);
  if((w-WAVES)%10!==0&&(w-WAVES)%5===0){/* чемпион бездны ведёт волну (v2.3: на k%10===0 вместо него — Тень отряда, маршрутизирует spawnWave) */
    const c=out[0];
    applyElite(c);
    c.champ=true;/* v2.1: подкрепление на полсмерти */
    c.aura=2;/* v2.2: аура чемпиона — единый механизм с аурами боссов кампании */
    c.name='Чемпион бездны: '+c.name;c.short='Чемпион';
    log('Среди теней шагает чемпион бездны!','g-enemy');
  }
  return out;
}
function spawnWave(){
  const w=G.arenaWave;
  if(w<1){G.arenaWave=0;return;}
  if(w<=WAVES){
    bigBanner('ВОЛНА '+w+' ИЗ '+WAVES);
    const names=w===1?'утопленники':(w===2?'кости':(w===3?'песнь глубин':(w===4?'стена щитов':'гнев бездны')));
    log('Волна '+w+' ('+names+'): враги поднимаются во внешнем дворе!','g-enemy');
    startCombat(waveGroup(w));
  }else if((w-WAVES)%10===0){/* v2.3: каждая 10-я глубинная волна — зеркальный босс */
    bigBanner('ТЕНЬ ОТРЯДА');
    log('Глубины соткали ваше отражение: ТЕНЬ ОТРЯДА шагает из портала — те же доспехи, то же оружие!','g-enemy');
    startCombat(mirrorGroup(w));
  }else{
    bigBanner('БЕСКОНЕЧНОЕ ИСПЫТАНИЕ — ВОЛНА '+w);
    log('Волна '+w+' ('+ENDLESS_NAMES[(w-6)%ENDLESS_NAMES.length]+'): глубины выставляют новую волну!','g-enemy');
    startCombat(endlessGroup(w));
  }
}

/* ---- победа в волне: награда + следующая волна (вызов из progression через bus) ---- */
export function arenaNext(){
  const w=G.arenaWave;
  if(w<1)return;
  recordBest(w);/* v2.3: рекорд + серверная летопись */
  const base=40+15*w+(w>WAVES?10*(w-WAVES):0);/* v2.0: глубина — прибавка к награде */
  const g=w>WAVES?Math.round(base*seasonRewardMult()):base;/* v2.4: «Дань глубин» — награда глубины ×1.5 */
  gainGold(g);
  log('Волна '+w+' отбита: +'+g+' золота, отряд перевязывает раны.','g-heal');
  for(const h of aliveHeroes())healUnit(h,8+2*w,'перевязка после волны');
  if(w===WAVES){arenaComplete();return;}/* ровно 5-я волна закрывает испытание; глубже — бесконечный режим */
  G.arenaWave=w+1;
  const run=G.arenaRun;/* v2.1: заход на момент планирования — новый заход убивает таймер */
  setTimeout(()=>{
    if(run!==G.arenaRun||G.phase==='transition')return;/* новый заход/переход карты — таймер устарел (журнал пишет arenaBreak) */
    if(G.mapId!=='citadel'){/* фолбэк: срыв без teardown — конец захода */
      arenaBreakImpl();
      return;
    }
    if(G.combatOn){G.arenaWave=0;return;}/* ушли в бой мимо таймера — испытание сорвано */
    sfx.stinger('wave');
    spawnWave();
  },1700);
}
function arenaComplete(){
  G.arenaWave=0;
  recordBest(WAVES);
  const bonus=250+d(100);
  gainGold(bonus);
  bigBanner('ИСПЫТАНИЕ ПРОЙДЕНО!');
  log('Пять волн легли у стены. Из портала выступает призрак коменданта и отдаёт вам '+bonus+' золота казны.','g-heal');
  log('Рекорд испытания: волна '+S.arenaBest+' из '+WAVES+'. Портал можно пройти вновь — тени не знают усталости.','g-sys');
  sfx.stinger('victory');
  /* v2.1: портал меняет лик — следующий шаг в него ведёт в бесконечные волны */
  const it=interactables.find(i=>i.label==='Испытание Глубин (арена)');
  if(it){it.label='Бесконечное испытание (арена)';it.fn=arenaEndless;}
  recordRun(WAVES);/* v2.1: завершённый заход — в журнал рекордов */
}

/* ---- v2.1: журнал рекордов — завершённые/сорванные заходы (последние 8 в сейве) ---- */
function recordRun(w:number){
  if(w<1)return;
  S.arenaLog=(S.arenaLog||[]).slice(-7);
  S.arenaLog.push({w,when:Date.now()});
}
/* ---- v2.3: рекорд + серверная летопись — при каждом улучшении постим в /api/scores ---- */
function captainName():string{return aliveHeroes()[0]?.name||'Дозор';}
function recordBest(w:number){
  const prev=S.arenaBest||0;
  if(w<=prev){S.arenaBest=prev;return;}
  S.arenaBest=w;
  void postScore(captainName(),w);/* no-throw: сервер недоступен — рекорд остаётся локальным */
}
export function showRecords(){/* стела у портала — читает журнал и серверную летопись */
  bigBanner('СТЕЛА РЕКОРДОВ');
  const lg=S.arenaLog||[];
  log('Лучший заход: волна '+(S.arenaBest||0)+'.','g-sys');
  const sd=seasonDef();/* v2.4: текущий сезон глубины */
  if(sd)log('Сезон глубины: «'+sd.name+'» — '+sd.desc+'.','g-sys');
  if(!lg.length){log('Стела пока пуста — ни один заход не завершён.','g-sys');}else{
    const last=lg.slice(-5).reverse();
    for(const r of last){
      const dt=new Date(r.when).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      log('Волна '+r.w+' — '+dt,'g-sys');
    }
    if(lg.length>5)log('…и ещё '+(lg.length-5)+' более ранних заходов.','g-sys');
  }
  /* v2.3: летопись Глубин — топ-10 серверного лидерборда (no-throw) */
  const me=captainName();
  void topScores().then(rows=>{
    if(!rows.length){log('Летопись Глубин молчит: сервер не ответил — или рекордов ещё нет.','g-sys');return;}
    log('Летопись Глубин (сервер):','g-sys');
    rows.slice(0,5).forEach((r,i)=>{
      log((i+1)+'. '+r.name+' — волна '+r.best+(r.name===me?' — это вы!':''),'g-sys');
    });
  });
}

/* ---- v2.1: разбор мира сорвал заход (уход с карты/загрузка сейва) — запись в журнал ---- */
function arenaBreakImpl(){
  if(G.arenaWave>=1)recordRun(G.arenaWave-1);/* последняя отбитая волна */
  G.arenaWave=0;
}

/* ---- v2.1: «БЕЗДНА ЗОВЁТ» — чемпион на полсмерти зовёт двух утопленников
   (combat зовёт через bus.champCall — прямой импорт combat→arena замкнул бы цикл) ---- */
function champCallImpl(c:Unit){
  bigBanner('БЕЗДНА ЗОВЁТ');
  sfx.stinger('wave');
  log(c.name+' хрипит — и из-под плит двора поднимаются утопленники!','g-enemy');
  for(let i=0;i<2;i++){
    const p=freeSpotNear(GW,{x:c.x,z:c.z},2);
    if(!p)continue;
    joinCombat(endlessBoost(makeDrowned(p.x,p.z),Math.max(G.arenaWave,WAVES+1)));
  }
  bus.refreshParty.call();
}

/* ---- E2E: мгновенно положить живых врагов волны и свести конец боя.
   v2.6: источник — первый живой герой: kill-bark честно срабатывает ---- */
export function arenaWipe(){
  for(const e of S.combatGroup)if(e.alive)die(e,aliveHeroes()[0]||null);
  checkEnd();
}
export function arenaState(){return {wave:G.arenaWave,best:S.arenaBest||0,endless:G.arenaWave>WAVES};}

/* ---- регистрация на шине (разрыв циклов progression→arena, combat→arena, maps→arena) ---- */
bus.arenaNext.bind(arenaNext);
bus.champCall.bind(champCallImpl);
bus.arenaBreak.bind(arenaBreakImpl);
