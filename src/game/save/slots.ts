/* ================= SLOTS (Фазы 4–6 рефакторинга) =================
   3 слота localStorage + экспорт/импорт JSON + меню сохранений.
   Фаза 5: closeSaveMenu переехал сюда из applyGame; sv типизирован.
   Фаза 6: DOM-рендер заменён view-моделью zustand-стора; биндинги
   sys.onSaves/onLoadFromEnd/savesOnClose/onImportFile; скрытый
   input#importFile живёт в React-панели (ref — в сторе). 1:1. */
import { SAVE_VER, SLOT_N } from '../constants';
import { sfx } from '../audio';
import { G, S, units, MAP_NAME } from '../state';
import { useUi, uiSet } from '../ui/store';
import { log } from '../ui/overlays';
import { gameSnapshot, applyGame } from './snapshot';
import type { SaveData } from '../types';

/* ================= v1.1: СОХРАНЕНИЯ (3 слота + экспорт/импорт JSON) =================
   Слоты живут в localStorage (bg3w_slot_1..3), формат — обычный JSON, поэтому
   экспорт/импорт — это просто скачивание файла и обратная запись в слот. */
export const slotKey=(i:number):string=>'bg3w_slot_'+i;
let savesFromEnd=false,importSlot=1;


export function slotMeta(sv:SaveData){
  const lv=sv.heroes&&sv.heroes.length?Math.max(...sv.heroes.map(h=>h.level||1)):1;
  return (sv.mapName||MAP_NAME[sv.mapId]||'?')+' · ур. '+lv+' · '+(sv.gold||0)+' зол. · '+new Date(sv.when).toLocaleString('ru-RU');
}
export function readSlot(i:number):SaveData|null{
  try{const raw=localStorage.getItem(slotKey(i));return raw?JSON.parse(raw):null;}
  catch{return null;}
}


export function doSave(i:number){
  if(G.combatOn||G.busy||G.phase==='transition'||G.phase==='over'){
    log('Сейчас нельзя сохранять: идёт бой, переход или экран поражения.','g-enemy');sfx.ui();return;
  }
  try{localStorage.setItem(slotKey(i),JSON.stringify(gameSnapshot()));}
  catch{log('Не удалось сохранить — хранилище браузера недоступно.','g-enemy');return;}
  log('Игра сохранена в слот '+i+'.','g-heal');sfx.ui();renderSaves();
}
export function doLoad(i:number){
  const sv=readSlot(i);
  if(!sv){log('Слот '+i+' пуст — сохраняйте через «Сохранить» или импортируйте JSON.','g-enemy');sfx.ui();return;}
  if(G.phase==='transition'){log('Идёт переход между картами — подождите секунду.','g-enemy');return;}
  if(G.busy){log('Дождитесь конца текущего действия.','g-enemy');return;}
  closeSaveMenu();/* Фаза 5: переехало из applyGame (разрыв slots⇄snapshot) */
  applyGame(sv);
}
export function doDelete(i:number){
  localStorage.removeItem(slotKey(i));
  log('Слот '+i+' очищен.','g-sys');sfx.ui();renderSaves();
}
export function doExport(i:number){
  const sv=readSlot(i);
  if(!sv){log('Слот '+i+' пуст — нечего экспортировать.','g-enemy');sfx.ui();return;}
  const blob=new Blob([JSON.stringify(sv,null,1)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='bg3web_save_slot'+i+'_'+new Date(sv.when).toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  log('Сейв слота '+i+' выгружен в JSON-файл.','g-sys');sfx.ui();
}
export function doImport(i:number){
  importSlot=i;
  const inp=useUi.getState().importInput;
  if(inp)inp.click();/* внутри пользовательского жеста — диалог файла открывается */
}
export function onImportFile(e:{target:HTMLInputElement}){
  const inp=e.target;
  const file=inp.files&&inp.files[0];
  inp.value='';
  if(!file)return;
  file.text().then(txt=>{
    let sv:SaveData|null=null;
    try{sv=JSON.parse(txt) as SaveData;}catch{}
    if(!sv||sv.v!==SAVE_VER||!Array.isArray(sv.heroes)||!MAP_NAME[sv.mapId]){
      log('Это не файл сохранения «Врат Бальдура» (нужен JSON формата v'+SAVE_VER+').','g-enemy');return;
    }
    try{localStorage.setItem(slotKey(importSlot),JSON.stringify(sv));}
    catch{log('Ошибка записи в слот '+importSlot+'.','g-enemy');return;}
    log('JSON импортирован в слот '+importSlot+': '+slotMeta(sv),'g-heal');
    renderSaves();sfx.ui();
  });
}


export function renderSaves(){
  const hs=units.filter(u=>u.side==='hero');
  const cur='Текущая игра: '+MAP_NAME[G.mapId]+' · ур. '+Math.max(1,...hs.map(h=>h.level))+' · '+S.gold+' зол.';
  const slots:{i:number;has:boolean;meta:string;sub:string;
    onSave:()=>void;onLoad:()=>void;onExport:()=>void;onImport:()=>void;onDelete:()=>void}[]=[];
  for(let i=1;i<=SLOT_N;i++){
    const sv=readSlot(i);
    slots.push({
      i,has:!!sv,
      meta:'Слот '+i+(sv?'':' — пуст'),
      sub:sv?slotMeta(sv):'Нет данных. Сохраните игру или импортируйте JSON-файл.',
      onSave:()=>doSave(i),
      onLoad:()=>doLoad(i),
      onExport:()=>doExport(i),
      onImport:()=>doImport(i),
      onDelete:()=>doDelete(i),
    });
  }
  uiSet({savesCur:cur,savesSlots:slots});
}
export function openSaveMenu(fromEnd:boolean){
  savesFromEnd=!!fromEnd;
  renderSaves();
  uiSet({savesOpen:true});
  sfx.ui();
}
export function closeSaveMenu(){
  uiSet({savesOpen:false});
  if(savesFromEnd){
    savesFromEnd=false;
    if(G.phase==='over')uiSet({endHidden:false});/* вернулись на экран поражения */
  }
}
export function toggleSaveMenu(){
  if(useUi.getState().savesOpen)closeSaveMenu();
  else openSaveMenu(false);
}

/* ---- биндинги UI-колбэков (Фаза 6) ---- */
uiSet(s=>({sys:{...s.sys,onSaves:toggleSaveMenu,onLoadFromEnd:()=>{uiSet({endHidden:true});openSaveMenu(true);}},
  savesOnClose:closeSaveMenu,onImportFile}));
