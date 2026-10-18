/* ================= SETTINGS/GFX (Фазы 4–6 рефакторинга) =================
   Настройки графики (тени/bloom/glow/частицы/разрешение/FPS) + пресеты;
   localStorage bg3w_gfx_v1. bloomOn/fpsLimit/frameAcc живут в G.
   Фаза 6: DOM-рендер заменён view-моделью zustand-стора (React-HUD);
   биндинги gfxOnClose/sys.onGfx. Логика применения — без изменений. */
import { renderer, fx, glows } from '../render/renderer';
import { G } from '../state';
import { sfx } from '../audio';
import { voice } from '../ui/voice';/* v2.5: вкл/выкл голосов */
import { useUi, uiSet } from '../ui/store';

/* ================= v1.1: НАСТРОЙКИ ГРАФИКИ =================
   Тени / bloom / glow-хала / плотность частиц / разрешение / лимит FPS.
   Всё применяется на живую и хранится в localStorage (bg3w_gfx_v1). */
export const GFX_KEY='bg3w_gfx_v1';
export const gfx={shadows:'high',bloom:true,glow:true,particles:'high',res:'100',fps:'max',voice:true};

export function loadGfx(){try{const raw=localStorage.getItem(GFX_KEY);if(raw)Object.assign(gfx,JSON.parse(raw));}catch{}}
export function applyShadows(){
  const q=gfx.shadows;
  renderer.shadowMap.enabled=(q!=='off');
  if(G.sunLight){
    G.sunLight.castShadow=(q!=='off');
    const size=q==='high'?2048:1024;
    if(G.sunLight.shadow.mapSize.x!==size){
      G.sunLight.shadow.mapSize.set(size,size);
      if(G.sunLight.shadow.map){G.sunLight.shadow.map.dispose();G.sunLight.shadow.map=null;}
    }
  }
}
export function applyGfx(){
  applyShadows();
  G.bloomOn=!!gfx.bloom;
  glows.setEnabled(!!gfx.glow);
  fx.density=gfx.particles==='low'?0.4:(gfx.particles==='mid'?0.7:1);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2)*(gfx.res==='50'?0.5:(gfx.res==='75'?0.75:1)));
  G.fpsLimit=gfx.fps==='30'?30:(gfx.fps==='60'?60:0);
  voice.setEnabled(gfx.voice!==false);/* v2.5: голоса подчиняются панели G */
  G.frameAcc=0;
  try{localStorage.setItem(GFX_KEY,JSON.stringify(gfx));}catch{}
}
export const GFX_PRESETS={
  low:{shadows:'off',bloom:false,glow:false,particles:'low',res:'75',fps:'60'},
  mid:{shadows:'low',bloom:true,glow:true,particles:'mid',res:'100',fps:'60'},
  high:{shadows:'high',bloom:true,glow:true,particles:'high',res:'100',fps:'max'},
};
type GfxKey=keyof typeof gfx;
export const GFX_ROWS:{k:GfxKey;label:string;bool?:boolean;opts:[string,string][]}[]=[
  {k:'shadows',label:'Тени',opts:[['off','Выкл'],['low','Низк.'],['high','Выс.']]},
  {k:'bloom',label:'Bloom-пасс',bool:true,opts:[['1','Вкл'],['0','Выкл']]},
  {k:'glow',label:'Glow-хала',bool:true,opts:[['1','Вкл'],['0','Выкл']]},
  {k:'particles',label:'Частицы',opts:[['low','Мало'],['mid','Средне'],['high','Много']]},
  {k:'res',label:'Разрешение',opts:[['50','50%'],['75','75%'],['100','100%']]},
  {k:'fps',label:'Лимит FPS',opts:[['30','30'],['60','60'],['max','Макс']]},
  {k:'voice',label:'Голоса',bool:true,opts:[['1','Вкл'],['0','Выкл']]},/* v2.5 */
];
export function renderGfx(){
  const presets=( [['low','Низкий'],['mid','Средний'],['high','Высокий']] as const ).map(([k,n])=>({
    name:n,
    pick:()=>{Object.assign(gfx,GFX_PRESETS[k]);applyGfx();renderGfx();sfx.ui();},
  }));
  const rows=GFX_ROWS.map(r=>({
    label:r.label,
    segs:r.opts.map(([val,name])=>({
      name,
      active:r.bool?(!!gfx[r.k]===(val==='1')):String(gfx[r.k])===val,
      pick:()=>{
        /* запись в словарь настроек по ключу строки панели */
        (gfx as Record<GfxKey,string|boolean>)[r.k]=r.bool?(val==='1'):val;
        applyGfx();renderGfx();sfx.ui();
      },
    })),
  }));
  uiSet({gfxPresets:presets,gfxRows:rows});
}
export function openGfx(){renderGfx();uiSet({gfxOpen:true});sfx.ui();}
export function closeGfx(){uiSet({gfxOpen:false});}
export function toggleGfx(){
  if(useUi.getState().gfxOpen)closeGfx();
  else openGfx();
}

/* ---- биндинги UI-колбэков (Фаза 6: кнопка ⚙ и «Закрыть (G)») ---- */
uiSet(s=>({sys:{...s.sys,onGfx:toggleGfx},gfxOnClose:closeGfx}));
