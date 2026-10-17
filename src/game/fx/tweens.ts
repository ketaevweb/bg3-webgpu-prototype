/* ================= TWEENS / ЭФФЕКТЫ (Фаза 4a рефакторинга) =================
   Промис-твины, исполняемые на игровом такте (tickTweens вызывается из loop
   в engine.ts), выпад корпуса при атаке, пул взрыв-мешей, тряска камеры,
   общий меш снаряда (огненный шар). Перенесено дословно из engine.ts. */
import * as THREE from 'three/webgpu';
import { scene } from '../render/renderer';
import { G } from '../state';

const tweens:{t:number;dur:number;fn:(k:number)=>void;res:()=>void}[]=[];
export function tween(dur:number,fn:(k:number)=>void){return new Promise<void>(res=>tweens.push({t:0,dur,fn,res}));}
/* игровой такт: продвижение твинов (из loop) */
export function tickTweens(dt:number){
  for(let i=tweens.length-1;i>=0;i--){
    const tw=tweens[i];
    tw.t+=dt;
    const k=Math.min(1,tw.t/tw.dur);
    tw.fn(k);
    if(k>=1){tweens.splice(i,1);tw.res();}
  }
}
export function faceTo(u:{mesh:THREE.Object3D},p:{x:number;z:number}){
  const dx=p.x-u.mesh.position.x,dz=p.z-u.mesh.position.z;
  if(dx||dz)u.mesh.rotation.y=Math.atan2(dx,dz);
}
export async function lunge(att:{mesh:THREE.Object3D},def:{mesh:THREE.Object3D}){
  const back=att.mesh.position.clone();
  const dir=new THREE.Vector3(def.mesh.position.x-back.x,0,def.mesh.position.z-back.z);
  const L=Math.min(0.55,Math.max(0.15,dir.length()*0.35));
  if(dir.lengthSq()<1e-6)return;
  dir.normalize();
  await tween(0.11,k=>{const s=k*k*(3-2*k);att.mesh.position.copy(back).addScaledVector(dir,L*s);});
  await tween(0.13,k=>{const s=k*k*(3-2*k);att.mesh.position.copy(back).addScaledVector(dir,L*(1-s));});
  att.mesh.position.copy(back);
}
const boomPool:any[]=[];
export function boomFX(x:number,z:number,r:number){
  let m=boomPool.find(b=>!b.visible);
  if(!m){
    m=new THREE.Mesh(new THREE.SphereGeometry(1,18,14),
      new THREE.MeshBasicMaterial({color:0xffa040,transparent:true,opacity:0.9,depthWrite:false}));
    scene.add(m);boomPool.push(m);
  }
  m.visible=true;m.position.set(x,0.4,z);m.scale.setScalar(0.3);m.material.opacity=0.9;
  tween(0.4,k=>{m.scale.setScalar(0.3+r*1.05*k);m.material.opacity=0.9*(1-k);}).then(()=>{m.visible=false;});
  const flash=new THREE.PointLight(0xff9040,60,14,2);
  flash.position.set(x,1.5,z);scene.add(flash);
  tween(0.35,k=>{flash.intensity=60*(1-k);}).then(()=>scene.remove(flash));
  shake(0.45);
}
export function shake(t:number){G.shakeT=Math.max(G.shakeT,t);}
/* общий меш снаряда (v0.7: огненный шар летит по дуге) */
export const projMesh=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,8),
  new THREE.MeshBasicMaterial({color:0xffa040}));
projMesh.visible=false;scene.add(projMesh);
