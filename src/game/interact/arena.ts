/* ================= ARENA «ИСПЫТАНИЕ ГЛУБИН» (v1.9 «Слава Дозора») =================
   Постгейм-контент после финала кампании (campaignDone): у портала
   цитадели открывается повторяемое испытание — пять волн теней павших
   (утопленники → кости → песнь глубин → стена щитов → гнев бездны).
   За волну — золото и перевязка, за всё испытание — награда коменданта.
   Рекорд волн (S.arenaBest) попадает в сейв (опциональное поле v2).
   Циклы: прогресс зовёт нас через bus.arenaNext (arena→turns→progression),
   прямых обратных импортов из systems в interact/arena нет. */
import { d } from '../rng';
import { G, S, GW } from '../state';
import { bus } from '../bus';
import { sfx } from '../audio';
import { bigBanner, log } from '../ui/overlays';
import { startCombat } from '../systems/turns';
import { die } from '../systems/combat';
import { checkEnd } from '../systems/progression';
import { healUnit } from '../systems/vitals';
import { gainGold } from './quests';
import { freeSpotNear } from '../world/grid';
import { makeDrowned, makeSkeleton, makeSkeletonKnight, makeCultist, makeKnight, makeAdept, makeOgre } from '../entities/roster';
import { aliveHeroes } from '../entities/units';
import type { Unit } from '../types';

const WAVES=5;/* волн в испытании */
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
   (у него уже есть addInteract) — арена даёт только arenaStart() ---- */
export function arenaStart(){
  if(G.combatOn){log('Испытание ждёт конца текущего боя.','g-sys');return;}
  if(!S.campaignDone){log('Портал молчит: песня Глубинного ещё не умолкла.','g-sys');return;}
  if(G.mapId!=='citadel')return;
  G.arenaWave=1;
  sfx.stinger('wave');
  bigBanner('ИСПЫТАНИЕ ГЛУБИН');
  log('Изумрудный портал вспыхивает: из-под двора поднимаются тени павших. Пять волн — и награда коменданта.','g-sys');
  spawnWave();
}
function spawnWave(){
  const w=G.arenaWave;
  if(w<1||w>WAVES){G.arenaWave=0;return;}
  bigBanner('ВОЛНА '+w+' ИЗ '+WAVES);
  const names=w===1?'утопленники':(w===2?'кости':(w===3?'песнь глубин':(w===4?'стена щитов':'гнев бездны')));
  log('Волна '+w+' ('+names+'): враги поднимаются во внешнем дворе!','g-enemy');
  startCombat(waveGroup(w));
}

/* ---- победа в волне: награда + следующая волна (вызов из progression через bus) ---- */
export function arenaNext(){
  const w=G.arenaWave;
  if(w<1)return;
  S.arenaBest=Math.max(S.arenaBest||0,w);
  const g=40+15*w;
  gainGold(g);
  log('Волна '+w+' отбита: +'+g+' золота, отряд перевязывает раны.','g-heal');
  for(const h of aliveHeroes())healUnit(h,8+2*w,'перевязка после волны');
  if(w>=WAVES){arenaComplete();return;}
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
}

/* ---- E2E: мгновенно положить живых врагов волны и свести конец боя ---- */
export function arenaWipe(){
  for(const e of S.combatGroup)if(e.alive)die(e,null);
  checkEnd();
}
export function arenaState(){return {wave:G.arenaWave,best:S.arenaBest||0};}

/* ---- регистрация на шине (разрыв цикла progression→arena) ---- */
bus.arenaNext.bind(arenaNext);
