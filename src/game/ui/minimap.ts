/* ================= MINIMAP (v1.9 «Слава Дозора») =================
   Схематичная карта сетки в HUD (клавиша M): стены, юниты, пожары,
   интерактивные точки. Модуль-писатель стор-листа: собирает плоский
   снимок из состояния (state.ts — как движковые модули v1.6+) и
   кладёт view-модель в zustand-стор; React-компонент только читает
   стор и рисует canvas. Обновление — троттлинг 0.5 с в loop() движка
   + мгновенный refresh при открытии/сборке карты. */
import { GRID } from '../constants';
import { GW, G, units, fires, interactables } from '../state';
import { useUi, uiSet } from './store';

/* снимок для React: solid — индексы клеток (z*GRID+x); dots — тройки
   [x,z,kind], kind: 0 герой, 1 враг, 2 NPC-интеракт, 3 бочка, 4 огонь;
   cur — клетка текущего героя (белая рамка) */
export interface MiniMapView{ver:number;grid:number;solid:number[];dots:number[];cur:{x:number;z:number}|null;}

let ver=0;

export function refreshMinimap(){
  const solid:number[]=[];
  for(const k of GW.solid){
    const i=k.indexOf('_');
    if(i<=0)continue;
    const x=+k.slice(0,i),z=+k.slice(i+1);
    if(Number.isFinite(x)&&Number.isFinite(z)&&x>=0&&z>=0&&x<GRID&&z<GRID)solid.push(z*GRID+x);
  }
  const dots:number[]=[];
  const push=(x:number,z:number,kind:number)=>{
    if(x>=0&&z>=0&&x<GRID&&z<GRID)dots.push(x,z,kind);
  };
  for(const u of units){
    if(!u.alive)continue;
    push(u.x,u.z,u.side==='hero'?0:(u.isBarrel?3:1));
  }
  for(const f of fires.values())push(f.x,f.z,4);
  for(const it of interactables)push(it.x,it.z,2);
  const c=G.current;
  uiSet({minimap:{ver:++ver,grid:GRID,solid,dots,
    cur:c&&c.side==='hero'&&c.alive?{x:c.x,z:c.z}:null}});
}

export function toggleMinimap(){
  const open=!useUi.getState().minimapOpen;
  uiSet({minimapOpen:open});
  if(open)refreshMinimap();/* мгновенный кадр — троттлинг догонит */
  return open;
}
