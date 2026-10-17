/* ================= MARKERS (Фаза 4b рефакторинга) =================
   Маркеры зоны хода и точек пути, подсветка достижимости.
   Пулы мешей и индексы (mi/di) — внутренние для модуля.
   Перенесено дословно из engine.ts. */
import * as THREE from 'three/webgpu';
import { scene } from '../render/renderer';
import { GW, G } from '../state';
import { W } from '../constants';
import { reachNodes } from '../world/grid';
import type { Unit } from '../types';

const markerPool:THREE.Mesh[]=[],dotPool:THREE.Mesh[]=[];
let mi=0,di=0;
const circGeo=new THREE.CircleGeometry(0.52,20);
const dotGeo=new THREE.SphereGeometry(0.09,8,8);
export function initMarkers(){
  if(markerPool.length)return;/* синглтоны сцены — пул создаётся один раз */
  for(let i=0;i<210;i++){
    const m=new THREE.Mesh(circGeo,new THREE.MeshBasicMaterial(
      {color:0xffffff,transparent:true,opacity:0.3,depthWrite:false}));
    m.rotation.x=-Math.PI/2;m.position.y=0.05;m.visible=false;m.renderOrder=2;
    scene.add(m);markerPool.push(m);
  }
  for(let i=0;i<36;i++){
    const m=new THREE.Mesh(dotGeo,new THREE.MeshBasicMaterial({color:0x8fe0ff}));
    m.visible=false;scene.add(m);dotPool.push(m);
  }
}
export function addMarker(x:number,z:number,color:number,scale?:number){
  if(mi>=markerPool.length)return;
  const m=markerPool[mi++];
  m.visible=true;m.position.set(W(x),0.05,W(z));
  (m.material as THREE.MeshBasicMaterial).color.setHex(color);
  (m.material as THREE.MeshBasicMaterial).opacity=0.32;
  m.scale.setScalar(scale||1);
}
export function clearMarkers(){mi=0;for(const m of markerPool)m.visible=false;}
export function addDot(x:number,z:number,inRange:boolean){
  if(di>=dotPool.length)return;
  const m=dotPool[di++];
  m.visible=true;m.position.set(W(x),0.12,W(z));
  (m.material as THREE.MeshBasicMaterial).color.setHex(inRange?0x8fe0ff:0x3a5560);
}
export function clearDots(){di=0;for(const m of dotPool)m.visible=false;}
export function showReach(u:Unit|null){
  clearMarkers();
  if(!G.combatOn||G.phase!=='player'||!u||!u.alive)return;
  const nodes=reachNodes(GW,u,false);
  for(const n of nodes.values())if(n.g>0)addMarker(n.x,n.z,0x3f7fae,0.45);
}
