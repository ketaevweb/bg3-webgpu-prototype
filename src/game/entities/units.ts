/* ================= UNITS (Фазы 4c–5 рефакторинга) =================
   Фабрика юнита (makeUnit), удаление, поиск врагов/героев,
   размещение отряда по точкам входа. Фаза 5: refreshInit — через шину bus
   (разрыв цикла entities → ui). Перенесено дословно из engine.ts. */
import * as THREE from 'three/webgpu';
import { G, units } from '../state';
import { scene, rigs } from '../render/renderer';
import { W } from '../constants';
import { srand } from '../rng';import { buildFigure } from './figure';
import { bus } from '../bus';
import type { Unit, Weapon } from '../types';

export function makeUnit(cfg:Partial<Unit>&{x:number;z:number}):Unit{/* Фаза 3: доменный тип юнита */
  const u=Object.assign({
    id:++G.uid,statuses:[],alive:true,reaction:1,level:1,xp:0,potions:0,
    slots:0,slotsMax:0,prof:2,swUsed:false,surge:0,actionMax:1,keepDist:false,poisonBlade:0,dawnUsed:false,/* v1.2 */
    action:0,bonus:0,/* Фаза 4a: обязательные поля Unit (переопределяются в beginTurn) */
  },cfg) as Unit;
  u.mesh=buildFigure(cfg);
  u.mesh.position.set(W(cfg.x),0,W(cfg.z));
  u.mesh.userData.ent=u;
  /* v0.7: внутренний риг для процедурной анимации (покачивание) —
     внешний mesh остаётся для твинов движения/смерти, кольцо не качается */
  const rig=new THREE.Group();
  for(const ch of [...u.mesh.children])if(ch!==u.mesh.userData.rig&&ch!==u.mesh.userData.ring)rig.add(ch);
  u.mesh.add(rig);
  u.rig=rig;u.phase=srand()*6.28;
  rigs.register(u);
  scene.add(u.mesh);
  units.push(u);
  return u;
}
export function removeUnit(u:Unit){
  const i=units.indexOf(u);
  if(i>=0)units.splice(i,1);
  scene.remove(u.mesh);
  if(u._el)u._el.remove();
  bus.refreshInit.call();
}
export function enemiesOf(u:Unit){return units.filter(o=>o.alive&&!o.isBarrel&&o.side!==u.side);}
export function meleeWeaponOf(e:Unit):Weapon|null{return e.weapon&&e.weapon.melee?e.weapon:(e.dagger||null);}
export function aliveHeroes(){return units.filter(u=>u.side==='hero'&&u.alive);}
/* v0.8: размещение отряда в точках входа */
export function placeHeroes(list:number[][]){
  const hs=units.filter(u=>u.side==='hero');
  hs.forEach((h,i)=>{
    const p=list[i%list.length];
    h.x=p[0];h.z=p[1];
    h.mesh.position.set(W(p[0]),0,W(p[1]));
    h.mesh.rotation.set(0,0,0);
  });
}