/* ================= PROPS (Фаза 4 рефакторинга) =================
   Сиды карт, деревья/камни/шатры/костёр/бочки, сборка мира (ground,
   заплатки, трава). Перенесено дословно из engine.ts.
   v3.0 «Дикая чаща»: земля — тайловые текстуры Ground_Textures пака
   (Grass/Mud/Moss/Rockwall) поверх вертексных пятен; камни, болотные
   деревья, костёр, камыш, травы и кусты — настоящие модели пака
   (FBX-6.1 урок: старые файлы молча не парсились — вся «природа»
   ниже — из полного Nature Pack v1.09, FBX 7400). */
import * as THREE from 'three/webgpu';
import { srand } from '../rng';
import { key, BASE } from '../utils';
import { GRID, TILE, HALF, W } from '../constants';
import { worldGroup, applyLighting, fx } from '../render/renderer';
import { G, S, solid, grass, barrels, CRYPT, SWAMP, GIANTS, CITADEL } from '../state';
import { placePine, placeDeadPine, placeBoulder, placeNature, placeForestTree, placeSwampTree,
  placeRockModel, placePlant, placeReed, placeLillypad, placeMushroom, placeBush } from './nature';
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
  placeForestTree(x,z);/* v3.0: полный набор деревьев пака, высоты в метрах */
}
/* v1.5→v3.0: болотный сухостой — настоящие ивы/трухляки/корни пака */
export function addDeadTree(x:number,z:number){
  solid.add(key(x,z));
  placeSwampTree(x,z);
}
/* v3.0: камень пака вместо додекаэдра (лес/болота) */
export function addRock(x:number,z:number){
  solid.add(key(x,z));
  placeRockModel(x,z,1.0);
}
export function addTent(x:number,z:number){
  solid.add(key(x,z));
  const m=new THREE.Mesh(new THREE.ConeGeometry(1.15,1.6,4),
    new THREE.MeshStandardMaterial({color:0x7a5c3f,roughness:1}));
  m.position.set(W(x),0.8,W(z));
  m.rotation.y=srand()*3;m.castShadow=true;
  worldGroup.add(m);
}
/* v3.0: костёр — модель пака SM_Prop_CampFire_01 + живое пламя/свет */
export function addCampfire(x:number,z:number){
  solid.add(key(x,z));
  placeNature('SM_Prop_CampFire_01',x,z,{h:0.9});
  G.flameMesh=new THREE.Mesh(new THREE.ConeGeometry(0.3,0.85,7),
    new THREE.MeshBasicMaterial({color:0xff8c2a,transparent:true,opacity:0.9}));
  G.flameMesh.position.set(W(x),0.52,W(z));
  worldGroup.add(G.flameMesh);
  G.fireLight=new THREE.PointLight(0xff9040,22,16,2);
  G.fireLight.position.set(W(x),1.1,W(z));
  worldGroup.add(G.fireLight);
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

/* v3.0: тайловая текстура земли из пака (Ground_Textures) */
function groundTex(file: string, repeat: number): THREE.Texture {
  const t = new THREE.TextureLoader().load((BASE || '') + '/models/nature/tex/' + file);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* v3.0: какая текстура земли на какой карте */
function groundFileFor(map: string): string {
  const cfg: Record<string, string> = {
    forest: 'Grass.png', swamp: 'Grass.png',/* v3.0: Mud темен для пола — он в заплатках-грязи */
    giants: 'Rockwall.png', citadel: 'Rockwall.png', crypt: 'Moss.png',
  };
  return cfg[map] ?? 'Grass.png';
}
function groundTexFor(map: string, repeatMul = 1): { tex: THREE.Texture | null } {
  const base = { forest: 13, swamp: 12, giants: 10, citadel: 14, crypt: 9 }[map] ?? 13;
  try { return { tex: groundTex(groundFileFor(map), Math.round(base * repeatMul)) }; } catch { return { tex: null }; }
}

export function buildWorld(){
  applyLighting(G.mapId);
  /* v1.5: цвет грунта/заплаток — по карте; v2.9: земля — вертексные пятна + холмы за ареной;
     v3.0: + тайловая текстура пака (умножается на вертексные пятна) */
  const groundColor=G.mapId==='crypt'?0x606070:(G.mapId==='swamp'?0x5e7d4a:(G.mapId==='giants'?0x787266:(G.mapId==='citadel'?0x6a6c78:0x51793c)));/* v3.0: тёмные карты подняты — тайл+туман съедали яркость */
  const patchColor=G.mapId==='crypt'?0x424250:(G.mapId==='swamp'?0x344628:(G.mapId==='giants'?0x524d46:(G.mapId==='citadel'?0x4a4c54:0x466a34)));
  const gtex=groundTexFor(G.mapId);
  /* земля: вертексные пятна × тайл текстуры пака */
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(GRID*TILE,GRID*TILE,36,36),
    new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:gtex.tex??undefined}));
  {
    const pos=ground.geometry.attributes.position as THREE.BufferAttribute;
    /* v3.0: лифт ×1.6 — текстура пака умножается на вертексные цвета и темнит
       дважды (урок v3.0: с тайлом семантические палитры уходят в черноту) */
    const base=new THREE.Color(groundColor).multiplyScalar(1.6),patch=new THREE.Color(patchColor).multiplyScalar(1.55),tmp=new THREE.Color();
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
  /* ЛАНДШАФТ за ареной — холмы с рельефом (вне игровой сетки, r>24)
    + дальние горные силуэты; горизонт перестал быть обрывом в туман */
  const skirt=new THREE.Mesh(new THREE.PlaneGeometry(250,250,52,52),
    new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:gtex.tex?groundTexFor(G.mapId,3.5).tex:undefined}));
  {
    const pos=skirt.geometry.attributes.position as THREE.BufferAttribute;
    const low=new THREE.Color(groundColor).multiplyScalar(0.93*1.6);/* v3.0: тот же лифт — шов с ареной не темнее */
    const rock=new THREE.Color(G.mapId==='giants'?0x8a8e94:(G.mapId==='swamp'?0x3e5238:(G.mapId==='crypt'?0x3c3f4c:(G.mapId==='citadel'?0x43464e:0x4a6a3c)))).multiplyScalar(1.45);
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
  /* заплатки v3.0: текстурные пятна (болото — грязь Mud, остальные — свой тайл);
     чуть темнее фона, polygonOffset против z-дребезга */
  const patchFile=G.mapId==='swamp'?'Mud.png':groundFileFor(G.mapId);
  const patchMat=new THREE.MeshStandardMaterial({roughness:1,map:groundTex(patchFile,2),color:0xcfcfcf,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  for(let i=0;i<26;i++){
    const m=new THREE.Mesh(new THREE.CircleGeometry(1,16),patchMat);
    m.rotation.x=-Math.PI/2;
    m.position.set((srand()-0.5)*GRID*TILE*0.9,0.012,(srand()-0.5)*GRID*TILE*0.9);
    m.scale.setScalar(0.7+srand()*1.6);
    worldGroup.add(m);
  }
  if(G.mapId==='forest'){
    /* v3.0: подземный ярус пака — травы/папоротники/цветы (качаются ветром) */
    for(const k of grass){
      const [x,z]=k.split('_').map(Number);
      if(G.BARREL_POS.some(p=>p[0]===x&&p[1]===z))continue;
      for(let i=0;i<2;i++)placePlant(x+(srand()-0.5)*0.8,z+(srand()-0.5)*0.8,1,true);
    }
    const n=Math.round(110*fx.density);/* фоновая трава по всей карте */
    for(let i=0;i<n;i++){
      const gx=1+Math.floor(srand()*(GRID-2)),gz=1+Math.floor(srand()*(GRID-2));
      if(solid.has(key(gx,gz)))continue;
      placePlant(gx+(srand()-0.5)*1.3,gz+(srand()-0.5)*1.3,0.7,false);
    }
    for(let i=0;i<8;i++){/* грибы у деревьев */
      const gx=2+Math.floor(srand()*(GRID-4)),gz=2+Math.floor(srand()*(GRID-4));
      if(!solid.has(key(gx,gz)))placeMushroom(gx+(srand()-0.5),gz+(srand()-0.5));
    }
    for(let i=0;i<7;i++)placeBush(1+Math.floor(srand()*(GRID-2)),1+Math.floor(srand()*(GRID-2)));
    for(let i=0;i<3;i++)placeNature(srand()<0.5?'SM_Tree_Log_01':'SM_Tree_Log_02',2+Math.floor(srand()*(GRID-4)),2+Math.floor(srand()*(GRID-4)),{h:0.55+srand()*0.25,spin:true});
    for(let i=0;i<3;i++)placeNature(srand()<0.5?'SM_Tree_Stump_01':'SM_Tree_Stump_02',2+Math.floor(srand()*(GRID-4)),2+Math.floor(srand()*(GRID-4)),{h:0.55+srand()*0.3,spin:true});
  }else if(G.mapId==='giants'){/* v1.6: серая трава перевала; v3.0: растения пака + настоящая осыпь */
    for(const k of grass){
      const [x,z]=k.split('_').map(Number);
      if(G.BARREL_POS.some(p=>p[0]===x&&p[1]===z))continue;
      for(let i=0;i<2;i++)placePlant(x+(srand()-0.5)*0.8,z+(srand()-0.5)*0.8,0.6,false);
    }
    for(let i=0;i<10;i++)placeNature('SM_Terrain_Rubble_Pebbles_0'+(1+Math.floor(srand()*3)),(srand()-0.5)*GRID*0.85+HALF,(srand()-0.5)*GRID*0.85+HALF,{s:0.9+srand()*0.5,spin:true});
  }else if(G.mapId==='citadel'){/* v1.8: булыжная крошка двора; v3.0: осыпь пака */
    for(let i=0;i<10;i++)placeNature('SM_Terrain_Rubble_Pebbles_0'+(1+Math.floor(srand()*3)),(srand()-0.5)*GRID*0.85+HALF,(srand()-0.5)*GRID*0.85+HALF,{s:0.8+srand()*0.4,spin:true});
  }else if(G.mapId==='swamp'){/* v1.5: лужи + камыш; v3.0: камыш/кувшинки/гниль пака */
    const watM=new THREE.MeshStandardMaterial({color:0x1d3a3a,roughness:0.25,metalness:0.15});
    const pools:[number,number][]=[];
    for(let i=0;i<14;i++){
      const px=(srand()-0.5)*GRID*TILE*0.85,pz=(srand()-0.5)*GRID*TILE*0.85;
      const m=new THREE.Mesh(new THREE.CircleGeometry(0.5+srand()*0.9,12),watM);
      m.rotation.x=-Math.PI/2;
      m.position.set(px,0.014,pz);
      worldGroup.add(m);
      pools.push([px/TILE+HALF,pz/TILE+HALF]);
    }
    for(const [px,pz] of pools)if(srand()<0.45)placeLillypad(px,pz,0.03);
    for(const k of grass){
      const [x,z]=k.split('_').map(Number);
      if(G.BARREL_POS.some(p=>p[0]===x&&p[1]===z))continue;
      for(let i=0;i<3;i++)placeReed(x+(srand()-0.5)*0.8,z+(srand()-0.5)*0.8);
    }
    for(let i=0;i<8;i++){/* гниль/наросты трясины */
      const gx=1+Math.floor(srand()*(GRID-2)),gz=1+Math.floor(srand()*(GRID-2));
      if(solid.has(key(gx,gz)))continue;
      placeNature('SM_Terrain_Swamp_Growth_0'+(1+Math.floor(srand()*3)),gx+(srand()-0.5),gz+(srand()-0.5),{s:0.55+srand()*0.4,spin:true});
    }
    for(let i=0;i<4;i++){/* мухоморы у корней */
      const gx=2+Math.floor(srand()*(GRID-4)),gz=2+Math.floor(srand()*(GRID-4));
      if(!solid.has(key(gx,gz)))placeMushroom(gx+(srand()-0.5),gz+(srand()-0.5));
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
