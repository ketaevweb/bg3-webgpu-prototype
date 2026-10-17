/* ================= SLOTS (Фаза 4 рефакторинга) =================
   3 слота localStorage + экспорт/импорт JSON + меню сохранений.
   Перенесено дословно из engine.ts. */
import { SAVE_VER, SLOT_N } from '../constants';
import { $ } from '../utils';
import { UI } from '../hud';
import { sfx } from '../audio';
import { G, S, units, MAP_NAME } from '../state';
import { log } from '../ui/overlays';
import { gameSnapshot, applyGame } from './snapshot';
import type { SaveData } from '../types';

/* ================= v1.1: СОХРАНЕНИЯ (3 слота + экспорт/импорт JSON) =================
   Слоты живут в localStorage (bg3w_slot_1..3), формат — обычный JSON, поэтому
   экспорт/импорт — это просто скачивание файла и обратная запись в слот. */
/* SAVE_VER/SLOT_N → constants.ts (Фаза 2) */
export const slotKey=i=>'bg3w_slot_'+i;
let savesFromEnd=false,importSlot=1;


export function slotMeta(sv:SaveData){
  const lv=sv.heroes&&sv.heroes.length?Math.max(...sv.heroes.map(h=>h.level||1)):1;
  return (sv.mapName||MAP_NAME[sv.mapId]||'?')+' · ур. '+lv+' · '+(sv.gold||0)+' зол. · '+new Date(sv.when).toLocaleString('ru-RU');
}
export function readSlot(i:number):SaveData|null{
  try{const raw=localStorage.getItem(slotKey(i));return raw?JSON.parse(raw):null;}
  catch(e){return null;}
}


export function doSave(i){
  if(G.combatOn||G.busy||G.phase==='transition'||G.phase==='over'){
    log('Сейчас нельзя сохранять: идёт бой, переход или экран поражения.','g-enemy');sfx.ui();return;
  }
  try{localStorage.setItem(slotKey(i),JSON.stringify(gameSnapshot()));}
  catch(e){log('Не удалось сохранить — хранилище браузера недоступно.','g-enemy');return;}
  log('Игра сохранена в слот '+i+'.','g-heal');sfx.ui();renderSaves();
}
export function doLoad(i){
  const sv=readSlot(i);
  if(!sv){log('Слот '+i+' пуст — сохраняйте через «Сохранить» или импортируйте JSON.','g-enemy');sfx.ui();return;}
  if(G.phase==='transition'){log('Идёт переход между картами — подождите секунду.','g-enemy');return;}
  if(G.busy){log('Дождитесь конца текущего действия.','g-enemy');return;}
  applyGame(sv);
}
export function doDelete(i){
  localStorage.removeItem(slotKey(i));
  log('Слот '+i+' очищен.','g-sys');sfx.ui();renderSaves();
}
export function doExport(i){
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
export function doImport(i){importSlot=i;$(UI.importFile).click();}
export function onImportFile(e){
  const file=e.target.files&&e.target.files[0];
  e.target.value='';
  if(!file)return;
  file.text().then(txt=>{
    let sv:any=null;
    try{sv=JSON.parse(txt);}catch(err){}
    if(!sv||sv.v!==SAVE_VER||!Array.isArray(sv.heroes)||!MAP_NAME[sv.mapId]){
      log('Это не файл сохранения «Врат Бальдура» (нужен JSON формата v'+SAVE_VER+').','g-enemy');return;
    }
    try{localStorage.setItem(slotKey(importSlot),JSON.stringify(sv));}
    catch(err){log('Ошибка записи в слот '+importSlot+'.','g-enemy');return;}
    log('JSON импортирован в слот '+importSlot+': '+slotMeta(sv),'g-heal');
    renderSaves();sfx.ui();
  });
}


export function renderSaves(){
  const el=$(UI.saveList);if(!el)return;
  el.innerHTML='';
  const hs=units.filter(u=>u.side==='hero');
  $(UI.curSave).textContent='Текущая игра: '+MAP_NAME[G.mapId]+' · ур. '+Math.max(1,...hs.map(h=>h.level))+' · '+S.gold+' зол.';
  for(let i=1;i<=SLOT_N;i++){
    const sv=readSlot(i);
    const row=document.createElement('div');row.className='slot';
    row.innerHTML='<div class="smeta">Слот '+i+(sv?'':' — пуст')+'</div>'+
      '<div class="ssub">'+(sv?slotMeta(sv):'Нет данных. Сохраните игру или импортируйте JSON-файл.')+'</div>';
    const btns=document.createElement('div');btns.className='sbtns';
    const mk=(t,fn,dis?,danger?)=>{
      const b=document.createElement('button');b.textContent=t;b.disabled=!!dis;
      if(danger)b.className='danger';
      b.onclick=fn;btns.appendChild(b);
    };
    mk('Сохранить',()=>doSave(i));
    mk('Загрузить',()=>doLoad(i),!sv);
    mk('Экспорт JSON',()=>doExport(i),!sv);
    mk('Импорт JSON',()=>doImport(i));
    mk('Удалить',()=>doDelete(i),!sv,true);
    row.appendChild(btns);
    el.appendChild(row);
  }
}
export function openSaveMenu(fromEnd){
  savesFromEnd=!!fromEnd;
  renderSaves();
  $(UI.saves).style.display='block';
  sfx.ui();
}
export function closeSaveMenu(){
  $(UI.saves).style.display='none';
  if(savesFromEnd){
    savesFromEnd=false;
    if(G.phase==='over')$(UI.end).style.display='flex';/* вернулись на экран поражения */
  }
}
export function toggleSaveMenu(){
  if($(UI.saves).style.display==='block')closeSaveMenu();
  else openSaveMenu(false);
}
