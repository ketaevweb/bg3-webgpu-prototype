/* ================= EDITOR STORE (v3.3 «Кузница») =================
   Zustand-стор редактора игры — ЛИСТ графа импортов (как ui/store.ts):
   движковый мост editor/bridge.ts ПИШЕТ view-модели и биндит колбэки
   act.*, React-панель components/editor/EditorPanel.tsx только ЧИТАЕТ
   стор и зовёт колбэки. Ни одного рантайм-импорта из движковых модулей —
   three/webgpu не попадает в бандл редактора, SSR безопасен.
   Семантика «как в Unity»: Play ▶ / Пауза ⏸ (симуляция стоит, рендер и
   камера живут) / Шаг ⏭ (один кадр симуляции на паузе), Hierarchy
   (дерево сцены) + Inspector (живое редактирование полей юнита) +
   вкладка «Мир» (глобальные параметры) + консоль действий. */
import { create } from 'zustand';

export interface EdTreeRow{
  id:number;
  label:string;
  sub:string;
  side:string;
  alive:boolean;
  boss:boolean;
  barrel:boolean;
}

/* поле инспектора: k — ключ для act.setField, type — вид контрола */
export interface EdField{
  k:string;
  label:string;
  type:'num'|'int'|'bool'|'str'|'sel';
  value:number|boolean|string;
  min?:number;
  max?:number;
  step?:number;
  opts?:[string,string][];/* для sel: [value,label] */
}
export interface EdSection{title:string;rows:EdField[]}

/* строка списка декора мира (v3.4 «Мастерская») */
export interface EdPropRow{id:number;name:string;label:string;x:number;z:number}
/* строка каталога природы (заполняет мост из worldEd) */
export interface EdPropCat{name:string;label:string;group:string}

export type GizmoMode='none'|'move'|'rotate'|'scale';

export interface EdAct{
  setOpen:(o:boolean)=>void;
  setPaused:(p:boolean)=>void;
  step:()=>void;
  setTime:(v:number)=>void;
  setTab:(t:'unit'|'world'|'decor'|'dlg')=>void;
  select:(id:number|null)=>void;
  setField:(k:string,v:number|boolean|string)=>void;
  status:(k:string,turns:number)=>void;
  statusClear:()=>void;
  heal:()=>void;
  kill:()=>void;
  del:()=>void;
  focus:()=>void;
  spawn:(k:string)=>void;
  setPick:(b:boolean)=>void;
  clearLog:()=>void;
  /* v3.4 «Мастерская»: gizmos / кисть / дублирование / анимации */
  setGizmo:(m:GizmoMode)=>void;
  setSnap:(b:boolean)=>void;
  setBrush:(k:string|null)=>void;
  dbl:(id:number)=>void;
  dup:()=>void;
  animPlay:(name:string)=>void;
  animSpeed:(v:number)=>void;
  rigReload:()=>void;
  /* v3.4: декор мира */
  propSelect:(id:number|null)=>void;
  propSetField:(k:string,v:number|boolean|string)=>void;
  propDel:()=>void;
  propFocus:()=>void;
  propClear:()=>void;
  propSetPick:(b:boolean)=>void;
  /* v3.4: правка диалогов */
  dlgPickNpc:(npc:string)=>void;
  dlgPickNode:(id:string)=>void;
  dlgSetField:(k:string,v:string)=>void;
  dlgApply:()=>void;
  dlgReset:()=>void;
}

export interface EdState{
  open:boolean;
  paused:boolean;
  timeScale:number;
  pickMode:boolean;
  tab:'unit'|'world'|'decor'|'dlg';
  tree:EdTreeRow[];
  treeVer:number;
  selId:number|null;
  insp:EdSection[]|null;
  globals:EdSection[];
  spawnList:{k:string;label:string}[];
  log:{id:number;msg:string}[];
  act:EdAct;
  /* v3.4 «Мастерская»: gizmo / кисть / анимации / декор / диалоги */
  gizmoMode:GizmoMode;
  snap:boolean;
  brush:string|null;/* ключ спавна, 'prop:<имя модели>' или null */
  animClips:string[];animCur:string;animSpeed:number;
  props:EdPropRow[];propSel:number|null;propInsp:EdSection[]|null;propPick:boolean;
  propCatalog:EdPropCat[];
  dlgNpc:string;dlgNode:string;dlgNodes:string[];dlgNpcs:[string,string][];dlgInsp:EdSection[]|null;
}

const noop=()=>{};
const noAct:EdAct={
  setOpen:noop,setPaused:noop,step:noop,setTime:noop,setTab:noop,select:noop,
  setField:noop,status:noop,statusClear:noop,heal:noop,kill:noop,del:noop,
  focus:noop,spawn:noop,setPick:noop,clearLog:noop,
  setGizmo:noop,setSnap:noop,setBrush:noop,dbl:noop,dup:noop,
  animPlay:noop,animSpeed:noop,rigReload:noop,
  propSelect:noop,propSetField:noop,propDel:noop,propFocus:noop,propClear:noop,propSetPick:noop,
  dlgPickNpc:noop,dlgPickNode:noop,dlgSetField:noop,dlgApply:noop,dlgReset:noop,
};

/* движковый мост пишет через uiEdSet (в т.ч. функциональные merge-обновления) */

export const useEd=create<EdState>()(()=>({
  open:false,
  paused:false,
  timeScale:1,
  pickMode:false,
  tab:'unit',
  tree:[],
  treeVer:0,
  selId:null,
  insp:null,
  globals:[],
  spawnList:[],
  log:[],
  act:noAct,
  gizmoMode:'move',
  snap:true,
  brush:null,
  animClips:[],animCur:'',animSpeed:1,
  props:[],propSel:null,propInsp:null,propPick:false,
  propCatalog:[],
  dlgNpc:'',dlgNode:'',dlgNodes:[],dlgNpcs:[],dlgInsp:null,
}));

/* движковый мост пишет через uiEdSet (в т.ч. функциональные merge) */
export const uiEdSet=useEd.setState;

let logSeq=0;
export function edPushLog(msg:string){
  uiEdSet(s=>({log:[...s.log,{id:++logSeq,msg}].slice(-60)}));
}
