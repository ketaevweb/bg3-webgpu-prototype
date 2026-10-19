/* ================= PROPS (Фаза 4 рефакторинга) =================
   Сиды карт, деревья/камни/шатры/костёр/бочки, сборка мира (ground,
   заплатки, трава). Перенесено дословно из engine.ts. */
import * as THREE from 'three/webgpu';
import { srand } from '../rng';
import { key } from '../utils';
import { GRID, TILE, HALF, W } from '../constants';
import { worldGroup, applyLighting, fx } from '../render/renderer';
import { makeSwayMaterial } from '../render/wind';/* v2.9: качание травы */
import { G, S, solid, grass, barrels, CRYPT, SWAMP, GIANTS, CITADEL } from '../state';
import { placePine, placeDeadPine, placeBoulder, placeNature } from './nature';
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
  ([[7,19],[21,19],[13,13],[23,11],[9,8]] as [number,number][]).forEach(([cx,cz])=>{
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
/* v1.5: болота культистов — сухостой, камни, непроходимая трясина, камыш */
export function seedSwamp(){
  G.TREES=[[4,4],[8,3],[20,3],[25,4],[3,10],[7,12],[21,9],[26,10],[3,19],[9,16],
    [19,20],[24,19],[12,22],[6,24],[18,24],[26,22],[16,3],[10,7],[2,12],[25,14]];
  G.ROCKS=[[6,15],[22,13],[15,17],[11,3],[24,24],[5,12],[13,19]];
  G.TENTS=[];G.FIREPIT=null;G.BARREL_POS=[[8,20],[19,14],[23,8]];
  solid.clear();grass.clear();
  for(let i=0;i<GRID;i++){solid.add(key(i,0));solid.add(key(i,GRID-1));solid.add(key(0,i));solid.add(key(GRID-1,i));}
  for(const [x,z] of SWAMP.MIRE)solid.add(key(x,z));
  solid.add(key(SWAMP.IDOL[0],SWAMP.IDOL[1]));
  solid.add(key(SWAMP.ALTAR[0],SWAMP.ALTAR[1]));
  for(const [cx,cz] of SWAMP.REEDS){
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      const x=cx+dx,z=cz+dz;
      if(x<1||z<1||x>=GRID-1||z>=GRID-1)continue;
      if(solid.has(key(x,z)))continue;
      if(srand()<0.78)grass.add(key(x,z));
    }
  }
  for(const [x,z] of G.BARREL_POS)grass.add(key(x,z));
}
/* v1.6: перевал великанов — сосны, валуны, обрыв с мостом, огрский лагерь */
export function seedGiants(){
  G.TREES=[[4,8],[6,17],[9,21],[24,17],[25,10],[20,21],[3,22],[10,10],[22,13],[5,12],[17,22],[26,20],[7,2],[23,2],[2,9],[11,17]];
  G.ROCKS=[[6,15],[22,13],[15,18],[11,3],[24,24],[8,12],[19,16],[4,19]];
  G.TENTS=[];G.FIREPIT=null;G.BARREL_POS=[[17,10],[23,12],[9,16]];
  solid.clear();grass.clear();
  for(let i=0;i<GRID;i++){solid.add(key(i,0));solid.add(key(i,GRID-1));solid.add(key(0,i));solid.add(key(GRID-1,i));}
  /* обрыв поперёк карты (z 13..14) — проход только по мосту (x 13..14) */
  for(let x=1;x<GRID-1;x++)for(const z of GIANTS.CHASM){
    if(GIANTS.BRIDGE.some(p=>p[0]===x&&p[1]===z))continue;
    solid.add(key(x,z));
  }
  for(const [x,z] of GIANTS.PILLARS)solid.add(key(x,z));
  solid.add(key(GIANTS.CAVE[0],GIANTS.CAVE[1]));
  solid.add(key(GIANTS.CHEST[0],GIANTS.CHEST[1]));
  /* редкая трава у лагеря, входа и моста */
  for(const [cx,cz] of [[19,6],[2,4],[14,20]]){
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
      const x=cx+dx,z=cz+dz;
      if(x<1||z<1||x>=GRID-1||z>=GRID-1)continue;
      if(solid.has(key(x,z)))continue;
      if(srand()<0.5)grass.add(key(x,z));
    }
  }
  for(const [x,z] of G.BARREL_POS)grass.add(key(x,z));
}
/* v1.8: цитадель Дозора — каменная стена с воротами, бразиры, устои,
   сундук со знаменем; деревьев нет — крепостной двор */
export function seedCitadel(){
  G.TREES=[];
  G.ROCKS=[[4,14],[24,15],[5,21],[23,20],[10,15],[18,15]];
  G.TENTS=[];G.FIREPIT=null;G.BARREL_POS=[[7,18],[21,18],[12,21]];/* взрывные бочки внешнего двора */
  solid.clear();grass.clear();
  for(let i=0;i<GRID;i++){solid.add(key(i,0));solid.add(key(i,GRID-1));solid.add(key(0,i));solid.add(key(GRID-1,i));}
  /* стена поперёк карты (z=WALL_Z) — проход только через ворота по центру */
  for(let x=1;x<GRID-1;x++){
    if(CITADEL.GATE.some(g=>g===x))continue;
    solid.add(key(x,CITADEL.WALL_Z));
  }
  for(const [x,z] of CITADEL.BRAZIERS)solid.add(key(x,z));
  for(const [x,z] of CITADEL.PILLARS)solid.add(key(x,z));
  solid.add(key(CITADEL.CHEST[0],CITADEL.CHEST[1]));
  /* редкая блёклая трава у ворот и входа */
  for(const [cx,cz] of [[14,12],[14,21]]){
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
      const x=cx+dx,z=cz+dz;
      if(x<1||z<1||x>=GRID-1||z>=GRID-1)continue;
      if(solid.has(key(x,z)))continue;
      if(srand()<0.4)grass.add(key(x,z));
    }
  }
  for(const [x,z] of G.BARREL_POS)grass.add(key(x,z));
}

/* ================= ПОСТРОЕНИЕ МИРА ================= */
export function addTree(x:number,z:number){
  solid.add(key(x,z));
  /* v2.9: лес — настоящие модели POLYGON (гигантское дерево/сосны), как на перевале;
    процедурная «ёлка-конус» ушла — силуэты живые, кроны разные */
  const roll=srand();
  if(roll<0.55)placeNature('SM_Tree_Generic_Giant_01',x,z,{s:0.13+srand()*0.06,spin:true});
  else placeNature(roll<0.8?'SM_Tree_Pine_02':'SM_Tree_Pine_01',x,z,{s:0.46+srand()*0.2,spin:true});
}
/* v1.5: болотный сухостой — голые ветви вместо листвы */
export function addDeadTree(x:number,z:number){
  solid.add(key(x,z));
  const g=new THREE.Group();
  const m=new THREE.MeshStandardMaterial({color:0x4a4438,roughness:1});
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.3,2.1,6),m);
  trunk.position.y=1.05;trunk.castShadow=true;
  g.add(trunk);
  for(let i=0;i<3;i++){
    const br=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.09,1.0,5),m);
    br.position.set(Math.cos(i*2.1)*0.32,1.55+i*0.28,Math.sin(i*2.1)*0.32);
    br.rotation.z=Math.cos(i*2.1)*0.95;br.rotation.x=Math.sin(i*2.1)*0.95;
    br.castShadow=true;
    g.add(br);
  }
  g.position.set(W(x),0,W(z));
  g.rotation.y=srand()*6.28;
  g.scale.setScalar(0.85+srand()*0.4);
  worldGroup.add(g);
}
export function addRock(x:number,z:number){
  solid.add(key(x,z));
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(0.75,0),
    new THREE.MeshStandardMaterial({color:0x6d6d64,roughness:1}));
  m.position.set(W(x),0.35,W(z));
  m.rotation.set(srand()*3,srand()*3,srand()*3);
  m.castShadow=true;m.receiveShadow=true;
  worldGroup.add(m);
}
export function addTent(x:number,z:number){
  solid.add(key(x,z));
  const m=new THREE.Mesh(new THREE.ConeGeometry(1.15,1.6,4),
    new THREE.MeshStandardMaterial({color:0x7a5c3f,roughness:1}));
  m.position.set(W(x),0.8,W(z));
  m.rotation.y=srand()*3;m.castShadow=true;
  worldGroup.add(m);
}
export function addCampfire(x:number,z:number){
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
export function addBarrel(x:number,z:number,bodyColor?:number){/* v0.8: цвет — лес (дерево) или крипта (урна) */
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
  const b={x,z,alive:true,hp:1,maxhp:1,ac:8,name:G.mapId==='crypt'?'Погребальная урна':(G.mapId==='swamp'?'Бочка с гниловаром':'Взрывная бочка'),isBarrel:true,mesh:g} as unknown as Barrel;/* Фаза 3: бочка — частичный юнит (только препятствие), полный Barrel — в p4c */
  g.userData.ent=b;
  barrels.push(b);
}
export function buildWorld(){
  applyLighting(G.mapId);
  /* v1.5: цвет грунта/заплаток — по карте; v2.9: земля — вертексные пятна + холмы за ареной;
     v2.9-брайт: палитры подняты ~+35% — тёмный мрак ушёл */
  const groundColor=G.mapId==='crypt'?0x4c4c58:(G.mapId==='swamp'?0x3c5030:(G.mapId==='giants'?0x5e5952:(G.mapId==='citadel'?0x53555e:0x51793c)));
  const patchColor=G.mapId==='crypt'?0x424250:(G.mapId==='swamp'?0x344628:(G.mapId==='giants'?0x524d46:(G.mapId==='citadel'?0x4a4c54:0x466a34)));
  /* v2.9: земля с вертексными цветами — травяные/земляные пятна шумом (srand-детерминизм) */
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(GRID*TILE,GRID*TILE,36,36),
    new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
  {
    const pos=ground.geometry.attributes.position as THREE.BufferAttribute;
    const base=new THREE.Color(groundColor),patch=new THREE.Color(patchColor),tmp=new THREE.Color();
    const colors=new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i);
      const n=Math.sin(x*0.34)*Math.cos(y*0.3)+Math.sin(x*0.11+y*0.19)*0.7;
      tmp.copy(base).lerp(patch,THREE.MathUtils.clamp(n*0.5+0.5,0,1)*0.6);
      colors[i*3]=tmp.r;colors[i*3+1]=tmp.g;colors[i*3+2]=tmp.b;
    }
    ground.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  }
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;
  G.groundMesh=ground;worldGroup.add(ground);
  /* v2.9: ЛАНДШАФТ за ареной — холмы с рельефом (вне игровой сетки, r>24)
    + дальние горные силуэты; горизонт перестал быть обрывом в туман */
  const skirt=new THREE.Mesh(new THREE.PlaneGeometry(250,250,52,52),
    new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
  {
    const pos=skirt.geometry.attributes.position as THREE.BufferAttribute;
    const low=new THREE.Color(groundColor).multiplyScalar(0.93);/* v2.9: без тёмного шва с ареной */
    const rock=new THREE.Color(G.mapId==='giants'?0x8a8e94:(G.mapId==='swamp'?0x3e5238:(G.mapId==='crypt'?0x3c3f4c:(G.mapId==='citadel'?0x43464e:0x4a6a3c))));
    const tmp=new THREE.Color();const colors=new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i);
      const r=Math.hypot(x,y);
      /* урок v2.9×3: рельеф стартует далеко от арены (r>34) и растёт полого —
         близкие холмы 6-9 м заливали кадр стенами с орбиты камеры (27-62 м) */
      const h=r>34?Math.max(0,Math.sin(x*0.05)+Math.sin(y*0.045)+Math.sin((x+y)*0.03))/3*Math.min((r-34)*0.16,7):0;
      pos.setZ(i,h);
      tmp.copy(low).lerp(rock,THREE.MathUtils.clamp(h/6,0,1)*0.8+Math.max(0,Math.sin(x*0.3))*0.12);
      colors[i*3]=tmp.r;colors[i*3+1]=tmp.g;colors[i*3+2]=tmp.b;
    }
    skirt.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    skirt.geometry.computeVertexNormals();
  }
  skirt.rotation.x=-Math.PI/2;skirt.position.y=-0.08;skirt.receiveShadow=true;
  worldGroup.add(skirt);
  const MTS=['SM_Terrain_Mountain_01','SM_Terrain_Mountain_02','SM_Terrain_Mountain_03'];
  /* урок v2.9×2: Synty-горы 25-40 м; орбита камеры до 62 м от центра —
     ставим силуэты ЗА орбитой (86-106 м), иначе южные горы съедают кадр;
     дальние силуэты тонут в тумане — вид «глубокой сцены» как в BG3 */
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2+srand()*0.55;
    const dist=86+srand()*20;
    placeNature(MTS[i%3],Math.cos(a)*dist/TILE+HALF,Math.sin(a)*dist/TILE+HALF,{s:0.3+srand()*0.22,ry:-a+Math.PI});
  }
  const patchGeo=new THREE.CircleGeometry(1,16);
  const patchMat=new THREE.MeshStandardMaterial({color:patchColor,roughness:1});
  for(let i=0;i<26;i++){
    const m=new THREE.Mesh(patchGeo,patchMat);
    m.rotation.x=-Math.PI/2;
    m.position.set((srand()-0.5)*GRID*TILE*0.9,0.012,(srand()-0.5)*GRID*TILE*0.9);
    m.scale.setScalar(0.7+srand()*1.6);
    worldGroup.add(m);
  }
  if(G.mapId==='forest'){
    /* v2.9: трава качается ветром (TSL) — куртины + фоновые травинки по всей карте */
    const tuftG=new THREE.ConeGeometry(0.16,0.5,5);
    const tuftM=makeSwayMaterial({color:0x4e8a34},{amp:0.07,speed:1.7});
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
    const bgG=new THREE.ConeGeometry(0.13,0.42,4);
    const bgM=makeSwayMaterial({color:0x406e2c},{amp:0.06,speed:1.4});
    const n=Math.round(110*fx.density);
    for(let i=0;i<n;i++){
      const gx=1+Math.floor(srand()*(GRID-2)),gz=1+Math.floor(srand()*(GRID-2));
      if(solid.has(key(gx,gz)))continue;
      const t=new THREE.Mesh(bgG,bgM);
      t.position.set(W(gx)+(srand()-0.5)*1.3,0.18,W(gz)+(srand()-0.5)*1.3);
      t.rotation.z=(srand()-0.5)*0.5;
      worldGroup.add(t);
    }
  }else if(G.mapId==='giants'){/* v1.6: каменная крошка + серая трава перевала; v2.9: качается */
    const tuftG=new THREE.ConeGeometry(0.14,0.42,4);
    const tuftM=makeSwayMaterial({color:0x6a7a55},{amp:0.05,speed:2.1});
    for(const k of grass){
      const [x,z]=k.split('_').map(Number);
      if(G.BARREL_POS.some(p=>p[0]===x&&p[1]===z))continue;
      for(let i=0;i<2;i++){
        const t=new THREE.Mesh(tuftG,tuftM);
        t.position.set(W(x)+(srand()-0.5),0.18,W(z)+(srand()-0.5));
        t.rotation.z=(srand()-0.5)*0.5;
        t.castShadow=true;
        worldGroup.add(t);
      }
    }
    const gravM=new THREE.MeshStandardMaterial({color:0x5a564e,roughness:1});
    for(let i=0;i<12;i++){
      const m=new THREE.Mesh(new THREE.DodecahedronGeometry(0.14+srand()*0.12,0),gravM);
      m.position.set((srand()-0.5)*GRID*TILE*0.85,0.06,(srand()-0.5)*GRID*TILE*0.85);
      m.rotation.set(srand()*3,srand()*3,0);
      m.castShadow=true;
      worldGroup.add(m);
    }
  }else if(G.mapId==='citadel'){/* v1.8: булыжная крошка двора */
    const gravM=new THREE.MeshStandardMaterial({color:0x565860,roughness:1});
    for(let i=0;i<14;i++){
      const m=new THREE.Mesh(new THREE.DodecahedronGeometry(0.12+srand()*0.14,0),gravM);
      m.position.set((srand()-0.5)*GRID*TILE*0.85,0.06,(srand()-0.5)*GRID*TILE*0.85);
      m.rotation.set(srand()*3,srand()*3,0);
      m.castShadow=true;
      worldGroup.add(m);
    }
  }else if(G.mapId==='swamp'){/* v1.5: лужи стоячей воды + камыш */
    const watM=new THREE.MeshStandardMaterial({color:0x1d3a3a,roughness:0.25,metalness:0.15});
    for(let i=0;i<14;i++){
      const m=new THREE.Mesh(new THREE.CircleGeometry(0.5+srand()*0.9,12),watM);
      m.rotation.x=-Math.PI/2;
      m.position.set((srand()-0.5)*GRID*TILE*0.85,0.014,(srand()-0.5)*GRID*TILE*0.85);
      worldGroup.add(m);
    }
    const reedG=new THREE.ConeGeometry(0.05,0.95,4);
    const reedM=makeSwayMaterial({color:0x5f7f3a},{amp:0.13,speed:2.4});/* v2.9: камыш клонится от ветра */
    for(const k of grass){
      const [x,z]=k.split('_').map(Number);
      if(G.BARREL_POS.some(p=>p[0]===x&&p[1]===z))continue;
      for(let i=0;i<4;i++){
        const t=new THREE.Mesh(reedG,reedM);
        t.position.set(W(x)+(srand()-0.5),0.44,W(z)+(srand()-0.5));
        t.rotation.z=(srand()-0.5)*0.4;
        t.castShadow=true;
        worldGroup.add(t);
      }
    }
  }
  for(const [x,z] of G.TREES){
    if(G.mapId==='swamp')addDeadTree(x,z);
    else if(G.mapId==='giants')(srand()<0.75?placePine:placeDeadPine)(x,z);
    else addTree(x,z);
  }
  for(const [x,z] of G.ROCKS){
    if(G.mapId==='giants'||G.mapId==='citadel')placeBoulder(x,z,0.85+srand()*0.6);
    else addRock(x,z);
  }
  for(const [x,z] of G.TENTS)addTent(x,z);
  if(G.FIREPIT)addCampfire(G.FIREPIT[0],G.FIREPIT[1]);
  for(const [x,z] of G.BARREL_POS)if(!S.barrelsUsed.has(key(x,z)))addBarrel(x,z,G.mapId==='crypt'?0x4a4238:undefined);
}
