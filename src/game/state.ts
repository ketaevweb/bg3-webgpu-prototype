/* ================= STATE (Фазы 4a–5 рефакторинга) =================
   Единственный источник игрового состояния (REFACTORING.md §4).
   S — метапрогресс/флаги (GameState из types.ts);
   G — runtime-контекст: всё, что раньше было мутабельными локалами
   замыкания bootGame() и переприсваивалось. Вынесено дословно —
   имена полей и семантика 1:1. Фаза 5: все any-поля типизированы
   (TargetingState/THREE-типы), TREES/ROCKS/TENTS/BARREL_POS — number[][]
   (инициализируются пустыми массивами — читатели уже после buildWorld).
   Контейнеры (units/barrels/fires/…) — const, мутируются in-place,
   никогда не переприсваиваются (проверено grep в Фазе 2). */
import type * as THREE from 'three/webgpu';
import type { FireTile, GameState, GridWorld, Interact, MapId, Phase, PickState, TargetingState, Unit } from './types';
import { resetUi } from './ui/store';

/* ---- метапрогресс и флаги квестов (S) ---- */
export const S:GameState={gold:60,discount:false,patrolDone:false,campDone:false,cageSeen:false,knowsBoss:false,
  hasCrate:false,ilvaFreed:false,mainShown:false,patrolGroup:[],campGroup:[],combatGroup:[],dlgNpc:null,
  cageMesh:null,ilvaMesh:null,crateMesh:null,kayaMesh:null,
  cryptGroup:[],chestLooted:false,necroSlain:false,kayaJoined:false,barrelsUsed:new Set<string>(),
  swampDone:false,olkhaJoined:false,swampGroup:[],olkhaMesh:null};/* v0.8+v1.1+v1.2+v1.5 */

/* ---- runtime-контекст (G) ---- */
export const G:{
  busy:boolean;busyCount:number;combatOn:boolean;phase:Phase;targeting:TargetingState|null;
  round:number;turnIdx:number;current:Unit|null;
  uid:number;shakeT:number;
  groundMesh:THREE.Mesh|null;fireLight:THREE.PointLight|null;flameMesh:THREE.Mesh|null;
  hemiLight:THREE.HemisphereLight|null;sunLight:THREE.DirectionalLight|null;
  postFX:THREE.PostProcessing|null;mapId:MapId;
  TREES:number[][];ROCKS:number[][];TENTS:number[][];FIREPIT:[number,number]|null;BARREL_POS:number[][];
  order:Unit[];
  bloomOn:boolean;fpsLimit:number;frameAcc:number;
}={
  busy:false,busyCount:0,combatOn:false,phase:'idle',targeting:null,
  round:1,turnIdx:-1,current:null,
  uid:0,shakeT:0,
  groundMesh:null,fireLight:null,flameMesh:null,hemiLight:null,sunLight:null,
  postFX:null,mapId:'forest',
  TREES:[],ROCKS:[],TENTS:[],FIREPIT:null,BARREL_POS:[],
  order:[],
  bloomOn:true,fpsLimit:0,frameAcc:0,
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

/* ---- константы карт (v0.8: лес ↔ крипта; v1.5: +болота) ---- */
export const CAGE={x:9,z:5}, CRATE={x:25,z:7}, MERCHANT={x:17,z:25}, KAYA_SPOT=[15,22];/* v1.2: алтарь Кая */
export const MAP_NAME={forest:'Тракт: лагерь Костей',crypt:'Крипта Костепёра',swamp:'Болота культистов'};
export const CRYPT={
  PILLARS:[[6,8],[10,8],[17,8],[21,8],[6,18],[10,18],[17,18],[21,18]],
  SARCS:[[4,13],[23,13],[8,2],[19,2]],
  BRAZIERS:[[9,15],[18,15]],
  URNS:[[11,10],[17,10]],
  THRONE:[14,3],CHEST:[14,1],EXIT:[14,26],ENTER:[[13,25],[14,25],[12,24],[15,24]],/* v1.2: 4 места отряда */
};
/* v1.5: болота культистов — трясина (непроходимая жижа), идол, алтарь,
   гать на лес и точки отряда; TRAIL — вход с леса (26,21) */
export const SWAMP={
  MIRE:[[5,6],[6,6],[5,7],[12,10],[13,10],[12,11],[20,16],[21,16],[20,17],[24,7],[25,7],
    [9,19],[10,19],[16,12],[17,12],[4,14],[4,15],[23,20],[23,21]],
  REEDS:[[4,9],[10,14],[18,18],[22,10],[8,22],[13,6],[24,16],[6,20],[16,8],[20,22],[10,2],[18,3]],
  IDOL:[14,8],OLKHA:[15,8],BOSS:[14,5],ALTAR:[14,3],
  EXIT:[14,25],ENTER:[[14,24],[13,24],[15,24],[14,23]],TRAIL:[26,21],
};

/* ---- чистый ремоут (REFACTORING.md §4: dispose() → resetState()) ----
   Возвращает S/G/контейнеры в состояние первого запуска; хэндлы рендера
   (hemiLight/sunLight/postFX) сохраняются — это синглтоны render/renderer.ts.
   Фаза 6: вместе с состоянием сбрасывается и UI-стор (React-HUD). */
export function resetState(){
  resetUi();
  Object.assign(S,{gold:60,discount:false,patrolDone:false,campDone:false,cageSeen:false,knowsBoss:false,
    hasCrate:false,ilvaFreed:false,mainShown:false,patrolGroup:[],campGroup:[],combatGroup:[],dlgNpc:null,
    cageMesh:null,ilvaMesh:null,crateMesh:null,kayaMesh:null,
    cryptGroup:[],chestLooted:false,necroSlain:false,kayaJoined:false,barrelsUsed:new Set<string>(),
    swampDone:false,olkhaJoined:false,swampGroup:[],olkhaMesh:null});
  Object.assign(G,{busy:false,busyCount:0,combatOn:false,phase:'idle' as Phase,targeting:null,
    round:1,turnIdx:-1,current:null,uid:0,shakeT:0,
    groundMesh:null,fireLight:null,flameMesh:null,
    mapId:'forest' as MapId,
    TREES:[],ROCKS:[],TENTS:[],FIREPIT:null,BARREL_POS:[],order:[]});
  units.length=0;barrels.length=0;fires.clear();
  pick.tile=null;pick.ent=null;pick.inter=null;
  solid.clear();grass.clear();
  for(const k in gobCount)delete gobCount[k];
  interactables.length=0;
}
