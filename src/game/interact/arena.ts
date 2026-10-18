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
   Циклы: прогресс зовёт нас через bus.arenaNext (arena→turns→progression),
   прямых обратных импортов из systems в interact/arena нет. */
import { d } from '../rng';
import { G, S, GW, interactables } from '../state';
import { bus } from '../bus';
import { sfx } from '../audio';
import { bigBanner, log } from '../ui/overlays';
import { startCombat } from '../systems/turns';
import { die } from '../systems/combat';
import { checkEnd } from '../systems/progression';
import { healUnit } from '../systems/vitals';
import { gainGold } from './quests';
import { freeSpotNear } from '../world/grid';
import { makeDrowned, makeSkeleton, makeSkeletonKnight, makeCultist, makeKnight, makeAdept, makeOgre, applyElite } from '../entities/roster';
import { aliveHeroes } from '../entities/units';
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
  G.arenaWave=WAVES+1;
  sfx.stinger('wave');
  bigBanner('БЕСКОНЕЧНОЕ ИСПЫТАНИЕ');
  log('Портал ревёт в полный голос: глубины признали победителя — и требуют нового. Волны не иссякнут, пока стоит отряд.','g-sys');
  spawnWave();
}
/* глубина k=w−5: hp ×(1+0.12k), кость урона +⌊k/2⌋, имя «Глубинный».
   weapon клонируем: шаблоны ростера разделяют объект (makeUnit не копирует). */
function endlessBoost(u:Unit,w:number){
  const k=w-WAVES;
  u.weapon={...u.weapon,dice:[...u.weapon.dice]};
  u.weapon.dice[1]+=Math.floor(k/2);
  const mult=1+0.12*k;
  u.maxhp=Math.round(u.maxhp*mult);
  u.hp=u.maxhp;
  u.name='Глубинный '+u.name;
  return u;
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
  for(const u of out)endlessBoost(u,w);
  if((w-WAVES)%5===0){/* чемпион бездны ведёт волну */
    const c=out[0];
    applyElite(c);
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
  S.arenaBest=Math.max(S.arenaBest||0,w);
  const g=40+15*w+(w>WAVES?10*(w-WAVES):0);/* v2.0: глубина — прибавка к награде */
  gainGold(g);
  log('Волна '+w+' отбита: +'+g+' золота, отряд перевязывает раны.','g-heal');
  for(const h of aliveHeroes())healUnit(h,8+2*w,'перевязка после волны');
  if(w===WAVES){arenaComplete();return;}/* ровно 5-я волна закрывает испытание; глубже — бесконечный режим */
  G.arenaWave=w+1;
  setTimeout(()=>{
    if(G.mapId!=='citadel'||G.combatOn){G.arenaWave=0;return;}/* ушли с карты — испытание сорвано */
    sfx.stinger('wave');
    spawnWave();
  },1700);
}
function arenaComplete(){
  G.arenaWave=0;
  S.arenaBest=Math.max(S.arenaBest||0,WAVES);
  const bonus=250+d(100);
  gainGold(bonus);
  bigBanner('ИСПЫТАНИЕ ПРОЙДЕНО!');
  log('Пять волн легли у стены. Из портала выступает призрак коменданта и отдаёт вам '+bonus+' золота казны.','g-heal');
  log('Рекорд испытания: волна '+S.arenaBest+' из '+WAVES+'. Портал можно пройти вновь — тени не знают усталости.','g-sys');
  sfx.stinger('victory');
  /* v2.0: портал меняет лик — следующий шаг в него ведёт в бесконечные волны */
  const it=interactables.find(i=>i.label==='Испытание Глубин (арена)');
  if(it){it.label='Бесконечное испытание (арена)';it.fn=arenaEndless;}
}

/* ---- E2E: мгновенно положить живых врагов волны и свести конец боя ---- */
export function arenaWipe(){
  for(const e of S.combatGroup)if(e.alive)die(e,null);
  checkEnd();
}
export function arenaState(){return {wave:G.arenaWave,best:S.arenaBest||0,endless:G.arenaWave>WAVES};}

/* ---- регистрация на шине (разрыв цикла progression→arena) ---- */
bus.arenaNext.bind(arenaNext);
