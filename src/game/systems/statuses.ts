/* ================= STATUSES & FIRE (Фаза 4 рефакторинга) =================
   Статусы (горение/яд/благословение/страх/уклонение/вера) и огонь на тайлах.
   Циклы импортов combat⇄statuses, statuses⇄abilities — на уровне функций
   (ESM-safe), см. REFACTORING.md. Перенесено дословно из engine.ts. */
import * as THREE from 'three/webgpu';
import { key } from '../utils';
import { d } from '../rng';
import { TILE, W, STATUS } from '../constants';
import { fires, grass, GW } from '../state';
import { worldGroup, fx, glows } from '../render/renderer';
import { unitAt, barrelAt } from '../world/grid';
import { log, ftextAbove, refreshIcons } from '../ui/overlays';
import { refreshParty } from '../ui/party';
import { sfx } from '../audio';
import { damageUnit } from './combat';
import { explodeBarrel } from './abilities';
import { checkEnd } from './progression';
import type { StatusType, Unit } from '../types';

/* ================= ОГОНЬ ================= */
export const fireGeo=new THREE.PlaneGeometry(TILE*0.95,TILE*0.95);
export function igniteTile(x,z,turns){
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
export function removeFire(k){
  const f=fires.get(k);
  if(!f)return;
  f.g.removeFromParent();fires.delete(k);/* v0.8: плита живёт в worldGroup */
  fx.removeEmber(k);glows.detach(k);
}
export function tickFires(){
  for(const f of [...fires.values()]){
    const u=unitAt(GW,f.x,f.z,null);
    if(u&&u.alive){
      const dmg=d(4);
      log(u.name+' горит в пламени: '+dmg+' урона.','g-fire');
      ftextAbove(u,'−'+dmg,'#ff8a50');
      damageUnit(u,dmg,null);
      if(u.alive&&Math.random()<0.5)addStatus(u,'burn',2);
    }
  }
  const born:any[]=[];
  for(const f of fires.values()){
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      if(!dx&&!dz)continue;
      const nx=f.x+dx,nz=f.z+dz,nk=key(nx,nz);
      const b=barrelAt(GW,nx,nz);
      if(b)setTimeout(()=>explodeBarrel(b),240);
      else if(grass.has(nk)&&!fires.has(nk)&&Math.random()<0.38)born.push([nx,nz]);
    }
  }
  for(const [x,z] of born)igniteTile(x,z,2);
  for(const [k,f] of [...fires]){f.turns--;if(f.turns<=0)removeFire(k);}
  checkEnd();
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
  refreshIcons(u);refreshParty();
}
