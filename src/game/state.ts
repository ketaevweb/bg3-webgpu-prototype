/* ================= STATE (Фаза 4a рефакторинга) =================
   Единственный источник игрового состояния (REFACTORING.md §4).
   S — метапрогресс/флаги (GameState из types.ts);
   G — runtime-контекст: всё, что раньше было мутабельными локалами
   замыкания bootGame() и переприсваивалось. Вынесено дословно —
   имена полей и семантика 1:1 (TODO(refactor-p5): зачистка any-полей).
   Контейнеры (units/barrels/fires/…) — const, мутируются in-place,
   никогда не переприсваиваются (проверено grep в Фазе 2). */
import type { FireTile, GameState, Interact, MapId, Phase, PickState, Unit } from './types';
import type { GridWorld } from './world/grid';

/* ---- метапрогресс и флаги квестов (S) ---- */
export const S:GameState={gold:60,discount:false,patrolDone:false,campDone:false,cageSeen:false,knowsBoss:false,
  hasCrate:false,ilvaFreed:false,mainShown:false,patrolGroup:[],campGroup:[],combatGroup:[],dlgNpc:null,
  cageMesh:null,ilvaMesh:null,crateMesh:null,kayaMesh:null,
  cryptGroup:[],chestLooted:false,necroSlain:false,kayaJoined:false,barrelsUsed:new Set<string>()};/* v0.8+v1.1+v1.2 */

/* ---- runtime-контекст (G) ---- */
export const G:{
  busy:boolean;busyCount:number;combatOn:boolean;phase:Phase;targeting:any;
  round:number;turnIdx:number;current:Unit|null;
  uid:number;shakeT:number;
  groundMesh:any;fireLight:any;flameMesh:any;hemiLight:any;sunLight:any;
  postFX:any;mapId:MapId;
  TREES:any;ROCKS:any;TENTS:any;FIREPIT:any;BARREL_POS:any;
  order:Unit[];
}={
  busy:false,busyCount:0,combatOn:false,phase:'idle',targeting:null,
  round:1,turnIdx:-1,current:null,
  uid:0,shakeT:0,
  groundMesh:null,fireLight:null,flameMesh:null,hemiLight:null,sunLight:null,
  postFX:null,mapId:'forest',
  TREES:null,ROCKS:null,TENTS:null,FIREPIT:null,BARREL_POS:null,
  order:[],
};
export type GameCtx=typeof G;

/* ---- busy-счётчик (был busyOn/busyOff в замыкании) ---- */
export function busyOn(){G.busyCount++;G.busy=true;}
export function busyOff(){G.busyCount=Math.max(0,G.busyCount-1);if(G.busyCount===0)G.busy=false;}

/* ---- контейнеры ---- */
export const units:Unit[]=[],barrels:Unit[]=[],fires=new Map<string,FireTile>();
export const pick:PickState={tile:null,ent:null,inter:null};
export const solid=new Set<string>(), grass=new Set<string>();
export const GW:GridWorld={solid,units,barrels,fires};/* Фаза 2: явный контекст сетки */
export const gobCount:Record<string,number>={};
export const interactables:Interact[]=[];

/* ---- константы карт (v0.8: лес ↔ крипта) ---- */
export const CAGE={x:9,z:5}, CRATE={x:25,z:7}, MERCHANT={x:17,z:25}, KAYA_SPOT=[15,22];/* v1.2: алтарь Кая */
export const MAP_NAME={forest:'Тракт: лагерь Костей',crypt:'Крипта Костепёра'};
export const CRYPT={
  PILLARS:[[6,8],[10,8],[17,8],[21,8],[6,18],[10,18],[17,18],[21,18]],
  SARCS:[[4,13],[23,13],[8,2],[19,2]],
  BRAZIERS:[[9,15],[18,15]],
  URNS:[[11,10],[17,10]],
  THRONE:[14,3],CHEST:[14,1],EXIT:[14,26],ENTER:[[13,25],[14,25],[12,24],[15,24]],/* v1.2: 4 места отряда */
};
