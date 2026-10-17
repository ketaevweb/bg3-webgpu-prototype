/* ================= PROPS (Фаза 4 рефакторинга) =================
   Сиды карт, деревья/камни/шатры/костёр/бочки, сборка мира (ground,
   заплатки, трава). Перенесено дословно из engine.ts. */
import * as THREE from 'three/webgpu';
import { srand } from '../rng';
import { key } from '../utils';
import { GRID, TILE, W } from '../constants';
import { worldGroup, applyLighting } from '../render/renderer';
import { G, S, solid, grass, barrels, CRYPT } from '../state';
import type { Barrel } from '../types';

/* ================= СЕТКА / КАРТЫ (v0.8: лес ↔ крипта) =================
   solid/grass/GW и константы карт (CAGE/CRYPT/…) — в state.ts (Фаза 4a).
   Ниже — сиды: заполнение наборов под конкретную карту. */
export function seedForest(){
  G.TREES=[[3,9],[9,3],[5,20],[3,15],[10,18],[24,20],[25,12],[20,22],[6,6],[26,16],[17,9],[11,11],[8,22],[22,14],[4,12],[15,4]];
  G.ROCKS=[[7,13],[21,17],[12,8],[25,7],[9,17],[18,11],[23,24]];
  G.TENTS=[[19,3],[22,3],[19,7]];
  G.FIREPIT=[21,5];
  G.BARREL_POS=[[18,5],[22,6],[24,6]];
  solid.clear();grass.clear();
  for(let i=0;i<GRID;i++){solid.add(key(i,0));solid.add(key(i,GRID-1));solid.add(key(0,i));solid.add(key(GRID-1,i));}
  [[7,19],[21,19],[13,13],[23,11],[9,8]].forEach(([cx,cz])=>{
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
      const x=cx+dx,z=cz+dz;
      if(x<1||z<1||x>=GRID-1||z>=GRID-1)continue;
      if(solid.has(key(x,z)))continue;
      if(srand()<0.72)grass.add(key(x,z));
    }
  });
  for(const [x,z] of G.BARREL_POS)grass.add(key(x,z));
}
export function seedCrypt(){
  G.TREES=[];G.ROCKS=[];G.TENTS=[];G.FIREPIT=null;G.BARREL_POS=CRYPT.URNS;
  solid.clear();grass.clear();
  for(let i=0;i<GRID;i++){solid.add(key(i,0));solid.add(key(i,GRID-1));solid.add(key(0,i));solid.add(key(GRID-1,i));}
  for(const [x,z] of CRYPT.PILLARS)solid.add(key(x,z));
  for(const [x,z] of CRYPT.SARCS)solid.add(key(x,z));
  for(const [x,z] of CRYPT.BRAZIERS)solid.add(key(x,z));
  solid.add(key(CRYPT.THRONE[0],CRYPT.THRONE[1]));
  solid.add(key(CRYPT.CHEST[0],CRYPT.CHEST[1]));
}

/* passable/unitAt/barrelAt/cheb/dangerAt → utils.ts и world/grid.ts (Фаза 2) */

/* ================= ПОСТРОЕНИЕ МИРА ================= */
export function addTree(x,z){
  solid.add(key(x,z));
  const g=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.3,1.8,7),
    new THREE.MeshStandardMaterial({color:0x5a4630,roughness:1}));
  trunk.position.y=0.9;trunk.castShadow=true;
  const folM=new THREE.MeshStandardMaterial({color:0x2f5c2b,roughness:1});
  const fol=new THREE.Mesh(new THREE.IcosahedronGeometry(1.05,0),folM);
  fol.position.y=2.2;fol.castShadow=true;
  const fol2=new THREE.Mesh(new THREE.IcosahedronGeometry(0.7,0),folM);
  fol2.position.set(0.35,2.9,0.15);fol2.castShadow=true;
  g.add(trunk,fol,fol2);
  g.position.set(W(x),0,W(z));
  g.rotation.y=srand()*6.28;
  g.scale.setScalar(0.85+srand()*0.5);
  worldGroup.add(g);
}
export function addRock(x,z){
  solid.add(key(x,z));
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(0.75,0),
    new THREE.MeshStandardMaterial({color:0x6d6d64,roughness:1}));
  m.position.set(W(x),0.35,W(z));
  m.rotation.set(srand()*3,srand()*3,srand()*3);
  m.castShadow=true;m.receiveShadow=true;
  worldGroup.add(m);
}
export function addTent(x,z){
  solid.add(key(x,z));
  const m=new THREE.Mesh(new THREE.ConeGeometry(1.15,1.6,4),
    new THREE.MeshStandardMaterial({color:0x7a5c3f,roughness:1}));
  m.position.set(W(x),0.8,W(z));
  m.rotation.y=srand()*3;m.castShadow=true;
  worldGroup.add(m);
}
export function addCampfire(x,z){
  solid.add(key(x,z));
  const g=new THREE.Group();
  const logM=new THREE.MeshStandardMaterial({color:0x4a3520,roughness:1});
  for(let i=0;i<3;i++){
    const l=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,1.1,6),logM);
    l.rotation.z=Math.PI/2;l.rotation.y=i*2.1;l.position.y=0.12;
    g.add(l);
  }
  const stoneM=new THREE.MeshStandardMaterial({color:0x55554e});
  for(let i=0;i<6;i++){
    const s=new THREE.Mesh(new THREE.DodecahedronGeometry(0.16,0),stoneM);
    s.position.set(Math.cos(i*1.05)*0.65,0.08,Math.sin(i*1.05)*0.65);
    g.add(s);
  }
  G.flameMesh=new THREE.Mesh(new THREE.ConeGeometry(0.32,0.9,7),
    new THREE.MeshBasicMaterial({color:0xff8c2a,transparent:true,opacity:0.9}));
  G.flameMesh.position.y=0.55;
  g.add(G.flameMesh);
  G.fireLight=new THREE.PointLight(0xff9040,22,16,2);
  G.fireLight.position.y=1.1;
  g.add(G.fireLight);
  g.position.set(W(x),0,W(z));
  worldGroup.add(g);
}
export function addBarrel(x,z,bodyColor){/* v0.8: цвет — лес (дерево) или крипта (урна) */
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.38,0.85,10),
    new THREE.MeshStandardMaterial({color:bodyColor||0x6b3f24,roughness:0.7}));
  body.position.y=0.43;body.castShadow=true;
  const band=new THREE.Mesh(new THREE.CylinderGeometry(0.435,0.435,0.1,10),
    new THREE.MeshStandardMaterial({color:0x2a2a2a,roughness:0.5,emissive:0x3a1000}));
  band.position.y=0.12;
  const warn=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.16),
    new THREE.MeshBasicMaterial({color:0xff5522}));
  warn.position.set(0,0.15,0.39);
  const g=new THREE.Group();
  g.add(body,band,warn);
  g.position.set(W(x),0,W(z));
  g.rotation.y=srand()*3;
  worldGroup.add(g);
  const b={x,z,alive:true,hp:1,maxhp:1,ac:8,name:G.mapId==='crypt'?'Погребальная урна':'Взрывная бочка',isBarrel:true,mesh:g} as unknown as Barrel;/* Фаза 3: бочка — частичный юнит (только препятствие), полный Barrel — в p4c */
  g.userData.ent=b;
  barrels.push(b);
}
export function buildWorld(){
  applyLighting(G.mapId);
  G.groundMesh=new THREE.Mesh(new THREE.PlaneGeometry(GRID*TILE,GRID*TILE),
    new THREE.MeshStandardMaterial({color:G.mapId==='crypt'?0x3d3d47:0x3a5530,roughness:1}));
  G.groundMesh.rotation.x=-Math.PI/2;G.groundMesh.receiveShadow=true;
  worldGroup.add(G.groundMesh);
  const patchGeo=new THREE.CircleGeometry(1,16);
  const patchMat=new THREE.MeshStandardMaterial({color:G.mapId==='crypt'?0x34343e:0x324a2a,roughness:1});
  for(let i=0;i<26;i++){
    const m=new THREE.Mesh(patchGeo,patchMat);
    m.rotation.x=-Math.PI/2;
    m.position.set((srand()-0.5)*GRID*TILE*0.9,0.012,(srand()-0.5)*GRID*TILE*0.9);
    m.scale.setScalar(0.7+srand()*1.6);
    worldGroup.add(m);
  }
  if(G.mapId==='forest'){
    const tuftG=new THREE.ConeGeometry(0.16,0.5,5);
    const tuftM=new THREE.MeshStandardMaterial({color:0x4e8a34,roughness:1});
    for(const k of grass){
      const [x,z]=k.split('_').map(Number);
      if(G.BARREL_POS.some(p=>p[0]===x&&p[1]===z))continue;
      for(let i=0;i<3;i++){
        const t=new THREE.Mesh(tuftG,tuftM);
        t.position.set(W(x)+(srand()-0.5),0.22,W(z)+(srand()-0.5));
        t.rotation.z=(srand()-0.5)*0.5;
        t.castShadow=true;
        worldGroup.add(t);
      }
    }
  }
  for(const [x,z] of G.TREES)addTree(x,z);
  for(const [x,z] of G.ROCKS)addRock(x,z);
  for(const [x,z] of G.TENTS)addTent(x,z);
  if(G.FIREPIT)addCampfire(G.FIREPIT[0],G.FIREPIT[1]);
  for(const [x,z] of G.BARREL_POS)if(!S.barrelsUsed.has(key(x,z)))addBarrel(x,z,G.mapId==='crypt'?0x4a4238:undefined);
}
