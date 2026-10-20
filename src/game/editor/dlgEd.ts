/* ================= DIALOG EDITOR (v3.4 «Мастерская») =================
   Правка текстов диалогов вживую. DLGS — реестр функций узлов; каждая
   функция возвращает узел {name,text,opts}. Оборачиваем ВСЕ ключи DLGS:
   обёртка зовёт оригинал, затем накладывает правки игрока из localStorage
   (bg3w_dlg_v1): name/text узла и тексты опций по индексу. Игра читает
   те же объекты — правки видны сразу, при переоткрытии узла — тоже.
   Безопасно: оригинальные узлы чистые (побочные эффекты — в opt.fn,
   который не вызывается чтением), поэтому пробник узлов (dlgProbeNodes)
   просто дергает функции с известными id и фильтрует пустые.
   Лист по зависимостям: interact/dialog (DLGS/showNode), state, utils. */
import { DLGS, showNode } from '../interact/dialog';
import { S } from '../state';
import type { DlgNode } from '../types';
import { useEd, uiEdSet, edPushLog, type EdSection } from '../ui/editorStore';

export interface DlgOverride{name?:string;text?:string;opts?:Record<number,string>}
const LS_KEY='bg3w_dlg_v1';
const overrides:Record<string,Record<string,DlgOverride>>=(()=>{
  try{return JSON.parse(localStorage.getItem(LS_KEY)||'{}');}catch{return{};}
})();

/* последний запрошенный узел (обёртка пишет) — для переоткрытия */
let lastNode:{npc:string;id:string}|null=null;

/* известные id узлов (собраны из кода диалогов; пробник фильтрует по npc) */
export const DLG_PROBE_IDS=['start','story','cratedone','discok','discfail',
  'cryptinfo','swampinfo','bossinfo','brave','waver','cow','scared','pass',
  'fight','rumor','ulva','haldeep','giantsinfo','citadelinfo'];

function persist():void{
  try{localStorage.setItem(LS_KEY,JSON.stringify(overrides));}catch{/* сессия */}
}

function applyOv(n:DlgNode|null|undefined,npc:string,id:string):DlgNode|null|undefined{
  if(!n)return n;
  const ov=overrides[npc]?.[id];
  if(!ov)return n;
  if(ov.name)n.name=ov.name;
  if(ov.text)n.text=ov.text;
  if(ov.opts)for(const [i,t] of Object.entries(ov.opts)){
    const idx=Number(i);
    if(t&&n.opts&&n.opts[idx])n.opts[idx].t=t;
  }
  return n;
}

/* обёртка реестра — side-effect при загрузке модуля (мост импортирует) */
for(const k of Object.keys(DLGS)){
  const orig=DLGS[k];
  DLGS[k]=(id:string)=>{
    const n=orig(id);
    lastNode={npc:k,id};
    return applyOv(n,k,id);
  };
}

/* ---------- API для моста ---------- */
export function dlgNpcList():[string,string][]{
  return Object.keys(DLGS).map(k=>[k,k]);
}
/* пробник узлов: какие id у этого npc дают узел (правки не вносятся) */
export function dlgProbeNodes(npc:string):string[]{
  const fn=DLGS[npc];
  if(!fn)return [];
  const out:string[]=[];
  for(const id of DLG_PROBE_IDS){
    try{
      const n=fn(id);
      if(n&&n.text)out.push(id);
    }catch{/* узел читает ещё не готовое состояние — пропускаем */}
  }
  return out;
}
export function dlgNodeSections(npc:string,nodeId:string):{
  name:string;text:string;opts:string[]}|null{
  try{
    const n=DLGS[npc]?.(nodeId);
    if(!n)return null;
    return {name:n.name,text:n.text,opts:(n.opts||[]).map(o=>o.t)};
  }catch{return null;}
}
export function dlgGet(npc:string,id:string):DlgOverride|null{
  return overrides[npc]?.[id]||null;
}
export function dlgSet(npc:string,id:string,ov:DlgOverride):void{
  if(!overrides[npc])overrides[npc]={};
  overrides[npc][id]=ov;
  persist();
  /* если этот узел сейчас открыт — переоткрыть с новыми текстами */
  if(S.dlgNpc===npc&&lastNode&&lastNode.npc===npc&&lastNode.id===id){
    try{showNode(id);}catch{/* диалог уже закрыт игроком */}
  }
}
export function dlgReset(npc:string,id:string):void{
  if(overrides[npc]){delete overrides[npc][id];persist();
    if(S.dlgNpc===npc&&lastNode&&lastNode.npc===npc&&lastNode.id===id){
      try{showNode(id);}catch{/* закрыт */}
    }}
}
export function dlgResetAll():void{
  for(const k of Object.keys(overrides))delete overrides[k];
  persist();
}
export function dlgEdStats():{npcs:number;edits:number}{
  let edits=0;
  for(const k of Object.keys(overrides))edits+=Object.keys(overrides[k]).length;
  return {npcs:Object.keys(DLGS).length,edits};
}
/* текущий открытый узел (для E2E и панели) */
export function dlgLastNode():{npc:string;id:string}|null{return lastNode;}

/* ================= DIALOG EDITOR UI (v3.4) =================
   Редактор узла: секции полей (имя/текст/опции), pending-патч, применение
   и сброс. Логи — через edPushLog стора (мост не нужен). */
let dlgPending:{name?:string;text?:string;opts?:Record<number,string>}={};
function dlgSections(npc:string,nodeId:string):EdSection[]|null{
  const base=dlgNodeSections(npc,nodeId);
  if(!base)return null;
  const ov=dlgGet(npc,nodeId);
  const f=(k:string,label:string,value:string)=>({k,label,type:'str' as const,value});
  const rows=[f('dlgName','Имя говорящего',ov?.name??base.name),f('dlgText','Текст узла',ov?.text??base.text)];
  base.opts.forEach((t,i)=>rows.push(f('opt'+i,'Опция '+(i+1),ov?.opts?.[i]??t)));
  return [{title:'Диалог '+npc+' → '+nodeId,rows}];
}
export function edDlgPickNpc(npc:string):void{
  const nodes=dlgProbeNodes(npc);
  uiEdSet({dlgNpc:npc,dlgNodes:nodes,dlgNode:nodes[0]||'',dlgInsp:null});
  if(nodes[0])edDlgPickNode(nodes[0]);
}
export function edDlgPickNode(id:string):void{
  const npc=useEd.getState().dlgNpc;
  dlgPending={};
  uiEdSet({dlgNode:id,dlgInsp:dlgSections(npc,id)});
}
export function edDlgSetField(k:string,v:string):void{
  const st=useEd.getState();
  if(!st.dlgNpc||!st.dlgNode)return;
  if(k==='dlgName')dlgPending.name=v;
  else if(k==='dlgText')dlgPending.text=v;
  else if(k.startsWith('opt')){
    if(!dlgPending.opts)dlgPending.opts={};
    dlgPending.opts[parseInt(k.slice(3),10)]=v;
  }
  /* живое отражение в инспекторе */
  const insp=st.dlgInsp;
  if(insp)for(const sec of insp)for(const r of sec.rows)if(r.k===k)r.value=v;
  uiEdSet({dlgInsp:insp?[...insp]:null});
}
export function edDlgApply():void{
  const st=useEd.getState();
  if(!st.dlgNpc||!st.dlgNode){log('Выберите диалог и узел.');return;}
  if(!Object.keys(dlgPending).length){log('Правок нет — текст не менялся.');return;}
  dlgSet(st.dlgNpc,st.dlgNode,dlgPending);
  log('Диалог применён: '+st.dlgNpc+' → '+st.dlgNode+'.');
  dlgPending={};
}
export function edDlgReset():void{
  const st=useEd.getState();
  if(!st.dlgNpc||!st.dlgNode)return;
  dlgReset(st.dlgNpc,st.dlgNode);
  dlgPending={};
  uiEdSet({dlgInsp:dlgSections(st.dlgNpc,st.dlgNode)});
  log('Правки узла '+st.dlgNpc+' → '+st.dlgNode+' сброшены.');
}


function log(m:string){edPushLog(m);}
