/* ================= SEASONS OF THE DEPTH (v2.4 «Сезоны глубины» + v2.8 сезонные составы) =================
   Еженедельный ротационный аффикс бесконечной арены: неделя реального мира
   (Date.now()/7 дней % 5) детерминированно выбирает один из пяти сезонов
   Глубин — «Кровавый прилив» (+1 кость врагам), «Костяная стужа» (КД +2),
   «Мора глубин» (hp ×1.25 сверх глубинного), «Ярость толпы» (лишний враг
   в каждой волне), «Дань глубин» (награда глубины ×1.5). Сезон красит
   глубинных врагов и Тени отряда своим цветом — косметика тени
   (трансмогрификация двойников под облик сезона). Состояние не хранится
   в сейве (формат v2 не менялся): сезон детерминирован неделей.
   E2E: forceSeason(i) форсирует сезон (−1 — «вне сезона», нейтральный
   режим для регрессий), forceSeason(null) возвращает реальную неделю.
   Панель «Летопись Глубин» (T / 🏆): сезон + рекорд + журнал заходов +
   серверный топ-10 (/api/scores, no-throw). */
import { G, S } from '../state';
import { uiSet, useUi } from '../ui/store';
import { topScores } from '../save/leaderboard';
import { log } from '../ui/overlays';
import { voice } from '../ui/voice';/* v2.5: анонс сезона голосом рассказчика */
import { blessActive } from './bless';/* v2.8: благословения в панели T */
import type { Unit } from '../types';

export interface SeasonDef{name:string;desc:string;tint:number;}
export const SEASONS:SeasonDef[]=[
  {name:'Кровавый прилив',desc:'враги глубин бьют на +1 кость сильнее',tint:0x8a2a2a},
  {name:'Костяная стужа',desc:'враги глубин закалены: КД +2',tint:0x7a9ac0},
  {name:'Мора глубин',desc:'враги глубин крепче: запас жизней ×1.25 сверх глубинного',tint:0x5a7a42},
  {name:'Ярость толпы',desc:'глубины выставляют на одного врага больше в каждой волне',tint:0x9a5a30},
  {name:'Дань глубин',desc:'награда за глубинную волну ×1.5 — глубины щедры к смелым',tint:0xb09040},
];
const WEEK_MS=7*24*3600*1000;

/* индекс сезона: форс E2E (−1 — вне сезона) или реальная неделя */
export function seasonIndex():number{
  if(G.seasonForced!==null)return G.seasonForced;
  return Math.floor(Date.now()/WEEK_MS)%SEASONS.length;
}
export function forceSeason(i:number|null){G.seasonForced=i;}
export function seasonDef():SeasonDef|null{
  const i=seasonIndex();
  return i>=0&&i<SEASONS.length?SEASONS[i]:null;
}
export function seasonState(){
  const d=seasonDef();
  return d?{idx:seasonIndex(),name:d.name,desc:d.desc,tint:d.tint}
          :{idx:-1,name:'—',desc:'вне сезона',tint:0};
}
/* «Дань глубин»: награда за глубинную волну ×1.5 */
export function seasonRewardMult():number{return seasonIndex()===4?1.5:1;}
/* «Ярость толпы»: в каждой глубинной волне на одного врага больше */
export function seasonExtraEnemy():boolean{return seasonIndex()===3;}

/* ---- v2.8: СЕЗОННЫЕ СОСТАВЫ — аффикс недели меняет рецепты глубинных волн.
   Карта замены тегов состава (tag→tag): «Кровавый прилив» смывает кости в
   трясину, «Костяная стужа» поднимает кости вместо культистов, «Мора
   глубин» выставляет закалённые кости, «Ярость толпы» уже добавляет лишнего
   врага (состав не трогается), «Дань глубин» платит кастерами. Теги: drowned /
   skeleton / boneknight / cultist / adept / knight / ogre (каталог RECRUIT в
   interact/arena.ts). Единый механизм для клиента и E2E. ---- */
export const SEASON_SWAPS:Array<Record<string,string>|null>=[
  {skeleton:'drowned',boneknight:'drowned'},/* 0 Кровавый прилив: море смывает кости */
  {cultist:'skeleton',adept:'boneknight'},/* 1 Костяная стужа: стужа поднимает кости */
  {skeleton:'boneknight'},/* 2 Мора глубин: мора выставляет закалённые кости */
  null,/* 3 Ярость толпы: свой лишний враг — состав каноничен */
  {drowned:'cultist',skeleton:'cultist'},/* 4 Дань глубин: глубины платят кастерами */
];
export function seasonSwap(tag:string):string{
  const map=SEASON_SWAPS[seasonIndex()];
  return (map&&map[tag])||tag;
}
/* сезонные модификаторы + косметика тени: облик сезона — перекраска
   тела фигурки (buildFigure: children[0] — капсула тела; ринг фракции
   и голова не трогаются). Вызывается из endlessBoost после глубинного
   усиления — Мора множит уже усиленную глубиной жизнь. */
export function seasonBoost(u:Unit){
  const d=seasonDef();
  if(!d)return u;
  const i=seasonIndex();
  if(i===0)u.weapon.dice[0]+=1;
  if(i===1)u.ac+=2;
  if(i===2){u.maxhp=Math.round(u.maxhp*1.25);u.hp=u.maxhp;}
  u.color=d.tint;
  /* тело фигурки: makeUnit переносит body/head/weapon в rig-группу
     (mesh.children=[ring,rig]) — капсула тела это rig.children[0];
     кольцо фракции и голова не трогаются */
  const body=u.rig.children[0] as unknown as {material?:{color?:{setHex:(h:number)=>void}}};
  if(body&&body.material&&body.material.color)body.material.color.setHex(d.tint);
  return u;
}
/* анонс сезона при входе в бесконечный режим (зовёт arenaEndless) */
export function announceSeason(){
  const d=seasonDef();
  if(!d)return;
  voice.play('season.'+seasonIndex());/* v2.5: сезон объявляет рассказчик */
  log('СЕЗОН ГЛУБИНЫ: «'+d.name+'» — '+d.desc+' (смена — на следующей неделе).','g-sys');
}
/* ---- HUD-панель «Летопись Глубин» (T / 🏆): сезон, рекорд, журнал,
   серверный топ-10 — сервер читается асинхронно и без исключений ---- */
export function toggleRecords(){
  if(useUi.getState().recordsOpen){closeRecords();return;}
  const d=seasonDef();
  const me=S.arenaBest||0;
  uiSet({recordsOpen:true,records:{
    season:d?{name:d.name,desc:d.desc,idx:seasonIndex()}:null,
    best:me,
    bless:blessActive().map(b=>({name:b.name,desc:b.desc})),/* v2.8: глубинные благословения рекорда */
    journal:(S.arenaLog||[]).slice(-8).reverse().map(r=>({w:r.w,
      when:new Date(r.when).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})})),
    server:null,
  }});
  void topScores().then(rows=>uiSet(s=>({records:s.records
    ?{...s.records,server:rows.map(r=>({n:r.name,best:r.best}))}:null})));
}
export function closeRecords(){uiSet({recordsOpen:false});}

/* биндинг колбэков стора (владелец — этот модуль; грузится вместе с engine) */
uiSet(s=>({sys:{...s.sys,onRecords:toggleRecords},recordsOnClose:closeRecords}));
