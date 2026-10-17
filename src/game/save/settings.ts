/* ================= SETTINGS/GFX (Фаза 4 рефакторинга) =================
   Настройки графики (тени/bloom/glow/частицы/разрешение/FPS) +
   пресеты; localStorage bg3w_gfx_v1. bloomOn/fpsLimit/frameAcc живут в G.
   Перенесено дословно из engine.ts. */
import { renderer, fx, glows } from '../render/renderer';
import { G } from '../state';
import { $ } from '../utils';
import { UI } from '../hud';
import { sfx } from '../audio';

/* ================= v1.1: НАСТРОЙКИ ГРАФИКИ =================
   Тени / bloom / glow-хала / плотность частиц / разрешение / лимит FPS.
   Всё применяется на живую и хранится в localStorage (bg3w_gfx_v1). */
export const GFX_KEY='bg3w_gfx_v1';
export const gfx={shadows:'high',bloom:true,glow:true,particles:'high',res:'100',fps:'max'};

export function loadGfx(){try{const raw=localStorage.getItem(GFX_KEY);if(raw)Object.assign(gfx,JSON.parse(raw));}catch(e){}}
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
  G.frameAcc=0;
  try{localStorage.setItem(GFX_KEY,JSON.stringify(gfx));}catch(e){}
}
export const GFX_PRESETS={
  low:{shadows:'off',bloom:false,glow:false,particles:'low',res:'75',fps:'60'},
  mid:{shadows:'low',bloom:true,glow:true,particles:'mid',res:'100',fps:'60'},
  high:{shadows:'high',bloom:true,glow:true,particles:'high',res:'100',fps:'max'},
};
export const GFX_ROWS=[
  {k:'shadows',label:'Тени',opts:[['off','Выкл'],['low','Низк.'],['high','Выс.']]},
  {k:'bloom',label:'Bloom-пасс',bool:true,opts:[['1','Вкл'],['0','Выкл']]},
  {k:'glow',label:'Glow-хала',bool:true,opts:[['1','Вкл'],['0','Выкл']]},
  {k:'particles',label:'Частицы',opts:[['low','Мало'],['mid','Средне'],['high','Много']]},
  {k:'res',label:'Разрешение',opts:[['50','50%'],['75','75%'],['100','100%']]},
  {k:'fps',label:'Лимит FPS',opts:[['30','30'],['60','60'],['max','Макс']]},
];
export function renderGfx(){
  const el=$(UI.gfxBody);if(!el)return;
  el.innerHTML='';
  const pl=document.createElement('div');
  pl.style.cssText='font-size:11px;color:#a89f86;margin:2px 0 3px';
  pl.textContent='Пресет качества:';
  el.appendChild(pl);
  const pre=document.createElement('div');pre.className='gpre';
  for(const [k,n] of [['low','Низкий'],['mid','Средний'],['high','Высокий']]){
    const b=document.createElement('button');b.textContent=n;
    b.onclick=()=>{Object.assign(gfx,GFX_PRESETS[k]);applyGfx();renderGfx();sfx.ui();};
    pre.appendChild(b);
  }
  el.appendChild(pre);
  for(const r of GFX_ROWS){
    const row=document.createElement('div');row.className='grow';
    const lab=document.createElement('span');lab.className='gl';lab.textContent=r.label;
    const seg=document.createElement('div');seg.className='seg';
    for(const [val,name] of r.opts){
      const b=document.createElement('button');b.textContent=name;
      const setVal=r.bool?(val==='1'):val;
      const active=r.bool?(!!gfx[r.k]===setVal):String(gfx[r.k])===val;
      if(active)b.classList.add('on');
      b.onclick=()=>{gfx[r.k]=setVal;applyGfx();renderGfx();sfx.ui();};
      seg.appendChild(b);
    }
    row.appendChild(lab);row.appendChild(seg);
    el.appendChild(row);
  }
}
export function openGfx(){renderGfx();$(UI.gfx).style.display='block';sfx.ui();}
export function closeGfx(){$(UI.gfx).style.display='none';}
export function toggleGfx(){
  if($(UI.gfx).style.display==='block')closeGfx();
  else openGfx();
}
