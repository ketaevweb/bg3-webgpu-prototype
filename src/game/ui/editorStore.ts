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

export interface EdAct{
  setOpen:(o:boolean)=>void;
  setPaused:(p:boolean)=>void;
  step:()=>void;
  setTime:(v:number)=>void;
  setTab:(t:'unit'|'world')=>void;
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
}

export interface EdState{
  open:boolean;
  paused:boolean;
  timeScale:number;
  pickMode:boolean;
  tab:'unit'|'world';
  tree:EdTreeRow[];
  treeVer:number;
  selId:number|null;
  insp:EdSection[]|null;
  globals:EdSection[];
  spawnList:{k:string;label:string}[];
  log:{id:number;msg:string}[];
  act:EdAct;
}

const noop=()=>{};
const noAct:EdAct={
  setOpen:noop,setPaused:noop,step:noop,setTime:noop,setTab:noop,select:noop,
  setField:noop,status:noop,statusClear:noop,heal:noop,kill:noop,del:noop,
  focus:noop,spawn:noop,setPick:noop,clearLog:noop,
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
}));

/* движковый мост пишет через uiEdSet (в т.ч. функциональные merge) */
export const uiEdSet=useEd.setState;

let logSeq=0;
export function edPushLog(msg:string){
  uiEdSet(s=>({log:[...s.log,{id:++logSeq,msg}].slice(-60)}));
}
