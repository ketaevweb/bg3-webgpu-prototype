/* ================= MOBILE (v2.7 «Дальние земли») =================
   Мобильная адаптация и полноэкранный режим.
   - isTouchDevice(): coarse-указатель (телефон/планшет) или ontouchstart —
     от флага зависят тач-кнопки HUD (E «Говорить») и CSS-раскладка
     (game.css @media (pointer:coarse));
   - Fullscreen API: toggleFullscreen() + слушатели fullscreenchange
     (в т.ч. webkit- для старых Safari на iPad); на iPhone Safari
     Fullscreen API для документа недоступен — canFullscreen() false,
     кнопка ⛶ скрывается (графический fullscreen там работает только
     для видео). no-throw: запрет FS (iframe без allow) — молчим.
   ЛИСТ: импортирует только ui/store (view-модель sys) — граф ацикличен.
   E2E: __bg3.fs() — снимок состояния полного экрана. */
import { uiSet } from './store';

/* v2.7: детект тач-устройства (без эвристик по UA — только возможности) */
export function isTouchDevice():boolean{
  try{
    return matchMedia('(pointer: coarse)').matches||'ontouchstart' in window||navigator.maxTouchPoints>0;
  }catch{return false;}
}

interface FsEl{
  requestFullscreen?:(o?:{navigationUI?:string})=>Promise<void>;
  webkitRequestFullscreen?:()=>void;
}
interface FsDoc{
  fullscreenElement?:Element|null;
  webkitFullscreenElement?:Element|null;
  exitFullscreen?:()=>Promise<void>;
  webkitExitFullscreen?:()=>void;
}

/* кнопка ⛶ рендерится, только если API доступен (iPhone — скрыта) */
export function canFullscreen():boolean{
  if(typeof document==='undefined')return false;
  const el=document.documentElement as unknown as FsEl;
  return typeof el.requestFullscreen==='function'||typeof el.webkitRequestFullscreen==='function';
}

export function isFullscreen():boolean{
  if(typeof document==='undefined')return false;
  const d=document as unknown as FsDoc;
  return !!(d.fullscreenElement||d.webkitFullscreenElement);
}

/* переключение полного экрана; клик — пользовательский жест, требования
   браузеров выполнены; ошибки (отказ/iframe) глушим */
export async function toggleFullscreen():Promise<void>{
  try{
    const el=document.documentElement as unknown as FsEl;
    const d=document as unknown as FsDoc;
    if(isFullscreen()){
      if(d.exitFullscreen)await d.exitFullscreen();
      else d.webkitExitFullscreen?.();
    }else{
      if(el.requestFullscreen)await el.requestFullscreen({navigationUI:'hide'});
      else el.webkitRequestFullscreen?.();
    }
  }catch{/* отказано в разрешении/прервано — не ошибка */}
  syncFsState();
}

function syncFsState():void{
  uiSet(s=>({sys:{...s.sys,fsTitle:isFullscreen()?'Выйти из полного экрана (F)':'Полный экран (F)'}}));
}

/* привязка sys-биндингов стора + слушатели смены состояния FS.
   Вызывается из bootGame() один раз; возвращает disposer (ремоут). */
export function initMobile():()=>void{
  uiSet(s=>({sys:{...s.sys,touch:isTouchDevice(),canFs:canFullscreen(),
    fsTitle:isFullscreen()?'Выйти из полного экрана (F)':'Полный экран (F)',
    onFs:()=>void toggleFullscreen()}}));
  const h=()=>syncFsState();
  document.addEventListener('fullscreenchange',h);
  document.addEventListener('webkitfullscreenchange',h);
  return ()=>{
    document.removeEventListener('fullscreenchange',h);
    document.removeEventListener('webkitfullscreenchange',h);
  };
}

/* инспектор E2E (только чтение) */
export function fsState(){
  return{touch:isTouchDevice(),can:canFullscreen(),on:isFullscreen()};
}
