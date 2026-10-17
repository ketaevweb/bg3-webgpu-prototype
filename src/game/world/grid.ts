/* ================= WORLD/GRID (Фазы 2–3 рефакторинга) =================
   Сетка мира, проходимость, опасность и A* — чистые функции, состояние
   передаётся явным аргументом GridWorld (контейнеры в engine создаются один
   раз и только мутируются, поэтому объект-контекст валиден весь рантайм).
   Фаза 3: доменные типы Unit/Barrel из types.ts вместо any.
   TODO(refactor-p4a): GridWorld станет срезом GameCtx из state.ts. */

import { key, cheb } from '../utils';
import { GRID } from '../constants';
import type { Unit } from '../types';

export interface GridWorld {
  solid: Set<string>;        /* непроходимая декорация */
  units: Unit[];             /* живые сущности (вкл. фигурки-преграды) */
  barrels: Unit[];           /* бочки/урны (Unit с isBarrel:true) */
  fires: Map<string, unknown>; /* горящие тайлы (значение — FireTile, сетке не нужен) */
}

export function passable(w:GridWorld, x:number, z:number, mover?:Unit|null){
  if(x<1||z<1||x>=GRID-1||z>=GRID-1)return false;
  if(w.solid.has(key(x,z)))return false;
  const b=barrelAt(w,x,z); if(b)return false;
  if(unitAt(w,x,z,mover))return false;
  return true;
}

export function unitAt(w:GridWorld, x:number, z:number, mover?:Unit|null):Unit|null{
  return w.units.find(u=>u.alive&&!u.isBarrel&&u!==mover&&u.x===x&&u.z===z)||null;
}

export function barrelAt(w:GridWorld, x:number, z:number):Unit|null{
  return w.barrels.find(b=>b.alive&&b.x===x&&b.z===z)||null;
}

/* карта угроз для ИИ: огонь, герои рядом, взрывные бочки */
export function dangerAt(w:GridWorld, x:number, z:number, forUnit:Unit){
  let p=0;
  if(w.fires.has(key(x,z)))p+=6;
  for(const e of w.units)if(e.alive&&e.side==='hero'&&e.side!==forUnit.side&&cheb(e,{x,z})<=1)p+=1.4;
  for(const b of w.barrels)if(b.alive&&cheb(b,{x,z})<=1)p+=2.2;
  return p;
}

/* узел поиска пути (f используется только в A*; reachNodes кладёт 0) */
export interface AStarNode{x:number;z:number;g:number;f:number;p:AStarNode|null;}

/* A* по 8-связной сетке; диагонали дороже (1.5) и только «углом» */
export function astar(w:GridWorld, sx:number, sz:number, gx:number, gz:number, mover?:Unit|null, ai?:boolean){
  if(!passable(w,gx,gz,mover))return null;
  if(sx===gx&&sz===gz)return [];
  const open=new Map<string,AStarNode>(),closed=new Set<string>();
  const h=(x:number,z:number)=>{const dx=Math.abs(x-gx),dz=Math.abs(z-gz);return Math.max(dx,dz)+0.5*Math.min(dx,dz);};
  open.set(key(sx,sz),{x:sx,z:sz,g:0,f:h(sx,sz),p:null});
  let it=0;
  while(open.size&&it++<4000){
    let bn:AStarNode|null=null,bk:string|null=null;
    for(const [k,n] of open)if(!bn||n.f<bn.f){bn=n;bk=k;}
    if(!bn||!bk)break;/* dev-инвариант: open.size>0 ⇒ минимум один узел */
    open.delete(bk);closed.add(bk);
    if(bn.x===gx&&bn.z===gz){
      const path:{x:number;z:number}[]=[];let c:AStarNode|null=bn;
      while(c&&c.p){path.push({x:c.x,z:c.z});c=c.p;}
      return path.reverse();
    }
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      if(!dx&&!dz)continue;
      const nx=bn.x+dx,nz=bn.z+dz,nk=key(nx,nz);
      if(closed.has(nk))continue;
      if(dx&&dz&&(!passable(w,bn.x+dx,bn.z,mover)||!passable(w,bn.x,bn.z+dz,mover)))continue;
      if(!passable(w,nx,nz,mover))continue;
      let g=bn.g+((dx&&dz)?1.5:1);
      if(ai)g+=dangerAt(w,nx,nz,mover as Unit)*0.8;
      const ex=open.get(nk);
      if(!ex||g<ex.g-1e-9)open.set(nk,{x:nx,z:nz,g,f:g+h(nx,nz),p:bn});
    }
  }
  return null;
}

/* все узлы в радиусе хода mover (стоимость ≤ mover.moveLeft) */
export function reachNodes(w:GridWorld, mover:Unit, ai?:boolean){
  const start:AStarNode={x:mover.x,z:mover.z,g:0,f:0,p:null};
  const best=new Map([[key(mover.x,mover.z),start]]);
  const open=[start];
  let it=0;
  while(open.length&&it++<4000){
    let bi=0;
    for(let i=1;i<open.length;i++)if(open[i].g<open[bi].g)bi=i;
    const n=open.splice(bi,1)[0];
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      if(!dx&&!dz)continue;
      const nx=n.x+dx,nz=n.z+dz,nk=key(nx,nz);
      if(dx&&dz&&(!passable(w,n.x+dx,n.z,mover)||!passable(w,n.x,n.z+dz,mover)))continue;
      if(!passable(w,nx,nz,mover))continue;
      let g=n.g+((dx&&dz)?1.5:1);
      if(ai)g+=dangerAt(w,nx,nz,mover)*0.8;
      if(g>mover.moveLeft+1e-9)continue;
      const ex=best.get(nk);
      if(!ex||g<ex.g-1e-9){const node={x:nx,z:nz,g,f:0,p:n};best.set(nk,node);open.push(node);}
    }
  }
  return best;
}

/* разворот цепочки узлов в путь [{x,z}…] */
export function nodePath(node:AStarNode){
  const a:{x:number;z:number}[]=[];let c:AStarNode|null=node;
  while(c&&c.p){a.push({x:c.x,z:c.z});c=c.p;}
  return a.reverse();
}
