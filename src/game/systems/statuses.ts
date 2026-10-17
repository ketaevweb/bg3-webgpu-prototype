/* ================= STATUSES & FIRE (Фазы 4–5 рефакторинга) =================
   Статусы (горение/яд/благословение/страх/уклонение/вера) и огонь на тайлах.
   Фаза 5: tickFires переехал в systems/turns.ts (конец раунда — ходовая
   логика; прямой вызов damageUnit из statuses замыкал цикл combat⇄statuses);
   UI-refresh — через bus. Импорты однонаправленные. Перенесено дословно. */
import * as THREE from 'three/webgpu';
import { key } from '../utils';
import { TILE, W, STATUS } from '../constants';
import { fires, grass } from '../state';
import { worldGroup, fx, glows } from '../render/renderer';
import { log, refreshIcons } from '../ui/overlays';
import { bus } from '../bus';
import { sfx } from '../audio';
import type { StatusType, Unit } from '../types';

/* ================= ОГОНЬ ================= */
export const fireGeo=new THREE.PlaneGeometry(TILE*0.95,TILE*0.95);
export function igniteTile(x:number,z:number,turns:number){
  const k=key(x,z);
  if(!grass.has(k))return;
  if(fires.has(k)){const f=fires.get(k);if(f){f.turns=Math.max(f.turns,turns);return;}}
  const g=new THREE.Group();
  const m1=new THREE.Mesh(fireGeo,new THREE.MeshBasicMaterial(
    {color:0xff5a1f,transparent:true,opacity:0.55,depthWrite:false}));
  m1.rotation.x=-Math.PI/2;m1.position.y=0.06;
  const m2=new THREE.Mesh(fireGeo,new THREE.MeshBasicMaterial(
    {color:0xffc23f,transparent:true,opacity:0.5,depthWrite:false}));
  m2.rotation.x=-Math.PI/2;m2.position.y=0.09;m2.scale.setScalar(0.55);
  g.add(m1,m2);
  g.position.set(W(x),0,W(z));
  worldGroup.add(g);
  fires.set(k,{x,z,turns,g,m1,m2});
  /* v0.7: угли над плитой + хало пламени */
  fx.addEmber(k,W(x),W(z),{rate:5,color:0xff9030,up:1.3,spread:0.55,size:0.09,life:1.0});
  glows.attach(k,W(x),W(z),0.85,0xff7a2a);
}
export function removeFire(k:string){
  const f=fires.get(k);
  if(!f)return;
  f.g.removeFromParent();fires.delete(k);/* v0.8: плита живёт в worldGroup */
  fx.removeEmber(k);glows.detach(k);
}
/* Боевая математика → systems/combat.ts (Фаза 2): attackMod/blessed/hitChance/avgDamage */
export function addStatus(u:Unit,type:StatusType,turns:number){
  if(!u||!u.alive||u.isBarrel)return;
  if(type==='fear'&&u.fearImmune){log(u.name+' не ведает страха!','g-enemy');return;}/* v0.8 */
  const ex=u.statuses.find(s=>s.type===type);
  if(ex)ex.turns=Math.max(ex.turns,turns);
  else u.statuses.push({type,turns});
  log(u.name+': '+STATUS[type].name+' ('+turns+' ход.).','g-sys');
  /* v0.7: вспышка статуса + звук */
  fx.burstAtMesh(u,{count:10,color:{burn:0xff9a4d,poison:0x8fd36a,bless:0xffd54f,fear:0xb08fd3,dodge:0x9fc4e8,faith:0x8fb8ff}[type]||0xffffff,speed:1.4,size:0.1,life:0.7,gravity:-0.8});
  if(type==='bless')sfx.bless();else if(type==='poison')sfx.poison();else if(type==='burn')sfx.ignite();
  else if(type==='faith')sfx.bless();else if(type==='dodge')sfx.ui();/* v1.2 */
  refreshIcons(u);bus.refreshParty.call();
}
