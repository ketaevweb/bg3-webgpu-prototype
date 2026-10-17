/* ================= FIGURE (Фаза 4c рефакторинга) =================
   Капсульная фигурка юнита (тело/голова/оружие/кольцо фракции).
   GLTF-риг накладывается поверх (upgradeUnitRig, animation.ts).
   Перенесено дословно из engine.ts. */
import * as THREE from 'three/webgpu';

export function buildFigure(cfg:{color?:number;skin?:number;side?:string;staff?:boolean;tipColor?:number}){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.3,0.55,4,10),
    new THREE.MeshStandardMaterial({color:cfg.color,roughness:0.75}));
  body.position.y=0.72;body.castShadow=true;
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.21,12,10),
    new THREE.MeshStandardMaterial({color:cfg.skin||(cfg.side==='goblin'?0x7ba24a:0xd9b48a),roughness:0.8}));
  head.position.y=1.32;head.castShadow=true;
  g.add(body,head);
  if(cfg.staff){
    const st=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.055,1.5,7),
      new THREE.MeshStandardMaterial({color:0x6a4a2c,roughness:0.8}));
    st.position.set(0.38,0.8,0.12);st.castShadow=true;
    const tip=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,8),
      new THREE.MeshBasicMaterial({color:cfg.tipColor||0xffa040}));
    tip.position.set(0.38,1.58,0.12);
    g.add(st,tip);
  }else{
    const wep=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.85,0.14),
      new THREE.MeshStandardMaterial({color:0xb8bcc4,roughness:0.4,metalness:0.6}));
    wep.position.set(0.38,0.85,0.1);wep.rotation.z=-0.5;
    g.add(wep);
  }
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.36,0.46,24),
    new THREE.MeshBasicMaterial({color:cfg.side==='hero'?0x5a8fc0:(cfg.side==='goblin'?0xa04a3a:0x8a7a3a),
      transparent:true,opacity:0.85,side:THREE.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=0.03;
  g.add(ring);
  g.userData.ring=ring;
  return g;
}
