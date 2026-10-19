/* ================= DEEP BLESSINGS (v2.8 «Глубинные благословения») =================
   Мета-прогресс бесконечной арены: чем глубже рекорд (S.arenaBest),
   тем сильнее отряд. Каждые 2 покорённые глубины активируют следующее
   благословение из пула BLESSINGS (6 штук — до рекорда 12): КД, урон,
   жизни, скорость, ячейки, финальный «Ярость глубин». Благословения
   ДЕТЕРМИНИРОВАНЫ рекордом и НЕ хранятся в сейве (формат v2 заморожен):
   применяются при создании героя (makeUnit → applyBlessings) и ДОЛИВАЮТСЯ
   живому отряду при каждом новом рекорде (blessRefresh — хук в
   arena.recordBest). При загрузке сейва статы героев перезаписываются
   сейвовыми (уже благословёнными тем же рекордом) — двойного усиления
   нет, актуальный список всегда = floor(best/2).
   Панель «Летопись Глубин» (T) показывает активные благословения.
   E2E: blessForce(best) через __bg3 — ставит рекорд и доливает благословения;
   blessState() — инспектор {best,count,active,heroes}. */
import { S, units } from '../state';
import { bigBanner, log } from '../ui/overlays';
import type { Unit } from '../types';

export interface BlessDef{name:string;desc:string;apply:(u:Unit)=>void;}

export const BLESSINGS:BlessDef[]=[
  {name:'Крепость глубин',desc:'+1 КД всем героям',
    apply:(u)=>{u.ac+=1;}},
  {name:'Клинок бездны',desc:'+1 к урону героев (к любому оружию)',
    apply:(u)=>{u.dmgBonus=(u.dmgBonus||0)+1;}},
  {name:'Мощь глубин',desc:'+6 к запасу жизней героев',
    apply:(u)=>{u.maxhp+=6;u.hp+=6;}},
  {name:'Чуткость бездны',desc:'+1 к скорости героев',
    apply:(u)=>{u.speed+=1;}},
  {name:'Печать глубин',desc:'кастерам +1 ячейка, воинам +4 жизни',
    apply:(u)=>{if(u.slotsMax>0){u.slotsMax+=1;u.slots=Math.min(u.slotsMax,u.slots+1);}else{u.maxhp+=4;u.hp+=4;}}},
  {name:'Ярость глубин',desc:'ещё +1 к урону и +1 КД',
    apply:(u)=>{u.dmgBonus=(u.dmgBonus||0)+1;u.ac+=1;}},
];

/* активных благословений по рекорду: best 0-1 → 0, 2-3 → 1, … 12+ → 6 */
export function blessCount(best?:number):number{
  const b=typeof best==='number'?best:(S.arenaBest||0);
  return Math.min(BLESSINGS.length,Math.max(0,Math.floor(b/2)));
}
export function blessActive():BlessDef[]{return BLESSINGS.slice(0,blessCount());}

/* ---- v2.8: мета-прогресс переживает страницу ----
   Рекорд глубин хранится в localStorage (bg3w_best_v1) — сейв v2
   заморожен и не меняется. Восстановление — loadBestMeta() из bootGame
   ДО buildHeroes (свежий отряд получает благословения по рекорду).
   Рост монотонный: пишем только max(текущий, сохранённый). */
const BEST_KEY='bg3w_best_v1';
export function loadBestMeta(){
  try{
    const v=parseInt(localStorage.getItem(BEST_KEY)||'',10);
    if(Number.isFinite(v)&&v>(S.arenaBest||0))S.arenaBest=v;
  }catch{/* приватный режим — мета просто не восстановится */}
}
function saveBestMeta(){
  try{
    const cur=S.arenaBest||0;
    const prev=parseInt(localStorage.getItem(BEST_KEY)||'',10);
    const v=Number.isFinite(prev)?Math.max(cur,prev):cur;
    if(v>0)localStorage.setItem(BEST_KEY,String(v));
  }catch{}
}

/* применить юниту благословения, которых у него ещё нет (u.blessed —
   список имён на юните; пересозданный юнит получает пустой список).
   Возвращает имена ДОЛИТЫХ сейчас (пусто — ничего нового). */
function grant(u:Unit,logIt:boolean):string[]{
  if(!u.blessed)u.blessed=[];
  const got:string[]=[];
  for(const b of blessActive()){
    if(u.blessed.includes(b.name))continue;
    b.apply(u);
    u.blessed.push(b.name);
    got.push(b.name);
  }
  if(logIt&&got.length)log('Глубины благословляют '+u.name+': '+got.join(', ')+'.','g-heal');
  return got;
}

/* при создании юнита (makeUnit, side==='hero'): молча применить всё
   по текущему рекорду — загрузка сейва позже перезапишет статы
   сейвовыми (согласованными), свежий boot — получит благословения
   по местному рекорду при первом же refresh/recordBest. */
export function applyBlessings(u:Unit){grant(u,false);}

/* доза живому отряду: вызывается при новом рекорде (arena.recordBest)
   и из E2E-хука blessForce. Баннер+лог — один на дозу. no-throw. */
export function blessRefresh(){
  try{
    saveBestMeta();/* v2.8: мета-рекорд переживает перезагрузку страницы */
    const heroes=units.filter(u=>u.side==='hero'&&u.alive);
    const fresh:string[]=[];
    for(const h of heroes){
      const got=grant(h,false);
      for(const g of got)if(!fresh.includes(g))fresh.push(g);
    }
    if(fresh.length){
      bigBanner('ГЛУБИННОЕ БЛАГОСЛОВЕНИЕ');
      log('Глубины признают отряд: '+fresh.join(', ')+' (благословений: '+blessCount()+' из '+BLESSINGS.length+').','g-heal');
    }
  }catch{/* благословения не должны ломать бой */}
}

/* E2E: поставить рекорд (без серверной летописи) и долить благословения;
   null — вернуть рекорд к 0. Откат уже влитых благословений не делается
   (монотонный рост по дизайну) — тесты ставят рекорд после boot. */
export function blessForce(best:number|null){
  if(best===null){S.arenaBest=0;return;}
  S.arenaBest=Math.max(0,Math.floor(best));
  blessRefresh();
}

/* инспектор для панели T и E2E */
export function blessState(){
  const heroes:Record<string,number>={};
  for(const u of units)if(u.side==='hero')heroes[u.name]=u.blessed?u.blessed.length:0;
  return {best:S.arenaBest||0,count:blessCount(),
    active:blessActive().map(b=>b.name),descs:blessActive().map(b=>b.desc),heroes};
}
