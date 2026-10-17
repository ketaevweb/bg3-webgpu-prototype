
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { sfx } from './audio';
import { ParticleFX } from './particles';
import { GlowFX } from './glow';
import { slowmo } from './slowmo';
import { AnimRigs, upgradeUnitRig } from './animation';

/* ================= УТИЛИТЫ ================= */
const $=q=>document.querySelector(q);
const d=s=>1+Math.floor(Math.random()*s);
const roll=(n,s)=>{let t=0;for(let i=0;i<n;i++)t+=d(s);return t;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mod=s=>Math.floor((s-10)/2);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const key=(x,z)=>x+'_'+z;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const srand=mulberry32(20251017);

/* ================= КОНСТАНТЫ ================= */
const TILE=1.6, GRID=28, HALF=(GRID-1)/2;
const W=v=>(v-HALF)*TILE;
const XP_NEED=l=>l===1?300:900;
const RANGE_FB=7, RANGE_OIL=5;
const BARREL_POS=[[18,5],[22,6],[24,6]];
const STATUS={
  burn:{name:'Горение',tag:'Г',css:'#ff9a4d'},
  poison:{name:'Отравление',tag:'О',css:'#8fd36a'},
  bless:{name:'Благословение',tag:'Б',css:'#ffd54f'},
  fear:{name:'Страх',tag:'С',css:'#b08fd3'},
};
const S={gold:60,discount:false,patrolDone:false,campDone:false,cageSeen:false,knowsBoss:false,
  hasCrate:false,ilvaFreed:false,mainShown:false,patrolGroup:[],campGroup:[],combatGroup:[],dlgNpc:null,
  cageMesh:null,ilvaMesh:null,crateMesh:null,
  cryptGroup:[],chestLooted:false,necroSlain:false,barrelsUsed:new Set()};/* v0.8+v1.1 */

/* ================= ТОЧКА ВХОДА (v0.7: fullstack src) =================
   Весь игровой стейт живёт в замыкании bootGame(), чтобы React мог
   безопасно монтировать/размонтировать игру (HMR, StrictMode). */
export function bootGame(){

/* ================= СОСТОЯНИЕ ================= */
let busy=false, busyCount=0, combatOn=false, phase='idle', targeting=null;
function busyOn(){busyCount++;busy=true;}
function busyOff(){busyCount=Math.max(0,busyCount-1);if(busyCount===0)busy=false;}
let wave=1, pendingWave=false, round=1, turnIdx=-1, current=null;
let order=[]; const units=[], barrels=[], fires=new Map();
let uid=0; const gobCount={};
const tweens=[]; let shakeT=0;
const pick={tile:null,ent:null,inter:null};
let groundMesh=null, fireLight=null, flameMesh=null;

/* ================= РЕНДЕРЕР / СЦЕНА ================= */
const renderer=new THREE.WebGPURenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
$('#scene').appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0c1510);
scene.fog=new THREE.FogExp2(0x0c1510,0.014);
/* v0.8: вся декорации карты — в worldGroup, чтобы сменять карту одним clear */
const worldGroup=new THREE.Group();scene.add(worldGroup);
function clearGroup(g){for(let i=g.children.length-1;i>=0;i--)g.remove(g.children[i]);}

/* ==== v0.7: эффекты (партиклы / glow-хало / анимационные риги / bloom) ==== */
const fx=new ParticleFX(scene);
const glows=new GlowFX(scene);
const rigs=new AnimRigs();
let postFX=null;
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,0.1,220);
camera.position.set(2,27,41);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=0.08;
controls.maxPolarAngle=1.32; controls.minPolarAngle=0.15;
controls.minDistance=8; controls.maxDistance=62;
controls.target.set(1,0,12);

/* ================= СЕТКА / КАРТЫ (v0.8: лес ↔ крипта) =================
   Одна сетка 28×28, но два набора декораций/обстановки:
   forest — тракт и лагерь Костей, crypt — подземелье босса. */
const solid=new Set(), grass=new Set();
let TREES=null,ROCKS=null,TENTS=null,FIREPIT=null,BARREL_POS=null;
const CAGE={x:9,z:5}, CRATE={x:25,z:7}, MERCHANT={x:17,z:25};
let mapId='forest';
const MAP_NAME={forest:'Тракт: лагерь Костей',crypt:'Крипта Костепёра'};
const CRYPT={
  PILLARS:[[6,8],[10,8],[17,8],[21,8],[6,18],[10,18],[17,18],[21,18]],
  SARCS:[[4,13],[23,13],[8,2],[19,2]],
  BRAZIERS:[[9,15],[18,15]],
  URNS:[[11,10],[17,10]],
  THRONE:[14,3],CHEST:[14,1],EXIT:[14,26],ENTER:[[13,25],[14,25]],
};
function seedForest(){
  TREES=[[3,9],[9,3],[5,20],[3,15],[10,18],[24,20],[25,12],[20,22],[6,6],[26,16],[17,9],[11,11],[8,22],[22,14],[4,12],[15,4]];
  ROCKS=[[7,13],[21,17],[12,8],[25,7],[9,17],[18,11],[23,24]];
  TENTS=[[19,3],[22,3],[19,7]];
  FIREPIT=[21,5];
  BARREL_POS=[[18,5],[22,6],[24,6]];
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
  for(const [x,z] of BARREL_POS)grass.add(key(x,z));
}
function seedCrypt(){
  TREES=[];ROCKS=[];TENTS=[];FIREPIT=null;BARREL_POS=CRYPT.URNS;
  solid.clear();grass.clear();
  for(let i=0;i<GRID;i++){solid.add(key(i,0));solid.add(key(i,GRID-1));solid.add(key(0,i));solid.add(key(GRID-1,i));}
  for(const [x,z] of CRYPT.PILLARS)solid.add(key(x,z));
  for(const [x,z] of CRYPT.SARCS)solid.add(key(x,z));
  for(const [x,z] of CRYPT.BRAZIERS)solid.add(key(x,z));
  solid.add(key(CRYPT.THRONE[0],CRYPT.THRONE[1]));
  solid.add(key(CRYPT.CHEST[0],CRYPT.CHEST[1]));
}

function passable(x,z,mover){
  if(x<1||z<1||x>=GRID-1||z>=GRID-1)return false;
  if(solid.has(key(x,z)))return false;
  const b=barrelAt(x,z); if(b)return false;
  if(unitAt(x,z,mover))return false;
  return true;
}
function unitAt(x,z,mover){
  return units.find(u=>u.alive&&!u.isBarrel&&u!==mover&&u.x===x&&u.z===z)||null;
}
function barrelAt(x,z){return barrels.find(b=>b.alive&&b.x===x&&b.z===z)||null;}
function cheb(a,b){return Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z));}
function enemiesOf(u){return units.filter(o=>o.alive&&!o.isBarrel&&o.side!==u.side);}
function meleeWeaponOf(e){return e.weapon&&e.weapon.melee?e.weapon:(e.dagger||null);}
function dangerAt(x,z,forUnit){
  let p=0;
  if(fires.has(key(x,z)))p+=6;
  for(const e of units)if(e.alive&&e.side==='hero'&&e.side!==forUnit.side&&cheb(e,{x,z})<=1)p+=1.4;
  for(const b of barrels)if(b.alive&&cheb(b,{x,z})<=1)p+=2.2;
  return p;
}

/* ================= ПОСТРОЕНИЕ МИРА ================= */
function addTree(x,z){
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
function addRock(x,z){
  solid.add(key(x,z));
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(0.75,0),
    new THREE.MeshStandardMaterial({color:0x6d6d64,roughness:1}));
  m.position.set(W(x),0.35,W(z));
  m.rotation.set(srand()*3,srand()*3,srand()*3);
  m.castShadow=true;m.receiveShadow=true;
  worldGroup.add(m);
}
function addTent(x,z){
  solid.add(key(x,z));
  const m=new THREE.Mesh(new THREE.ConeGeometry(1.15,1.6,4),
    new THREE.MeshStandardMaterial({color:0x7a5c3f,roughness:1}));
  m.position.set(W(x),0.8,W(z));
  m.rotation.y=srand()*3;m.castShadow=true;
  worldGroup.add(m);
}
function addCampfire(x,z){
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
  flameMesh=new THREE.Mesh(new THREE.ConeGeometry(0.32,0.9,7),
    new THREE.MeshBasicMaterial({color:0xff8c2a,transparent:true,opacity:0.9}));
  flameMesh.position.y=0.55;
  g.add(flameMesh);
  fireLight=new THREE.PointLight(0xff9040,22,16,2);
  fireLight.position.y=1.1;
  g.add(fireLight);
  g.position.set(W(x),0,W(z));
  worldGroup.add(g);
}
function addBarrel(x,z,bodyColor){/* v0.8: цвет — лес (дерево) или крипта (урна) */
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
  const b={x,z,alive:true,hp:1,maxhp:1,ac:8,name:mapId==='crypt'?'Погребальная урна':'Взрывная бочка',isBarrel:true,mesh:g};
  g.userData.ent=b;
  barrels.push(b);
}
/* v0.8: атмосфера и свет — параметризованы по карте */
function applyAtmosphere(m){
  if(m==='crypt'){scene.background=new THREE.Color(0x0a0a12);scene.fog=new THREE.FogExp2(0x0a0a12,0.018);}
  else{scene.background=new THREE.Color(0x0c1510);scene.fog=new THREE.FogExp2(0x0c1510,0.014);}
}
let hemiLight=null,sunLight=null;
function applyLighting(m){
  if(!hemiLight){
    hemiLight=new THREE.HemisphereLight(0xbcd8e8,0x2a3325,0.85);
    sunLight=new THREE.DirectionalLight(0xffeecf,2.4);
    sunLight.position.set(14,22,8);sunLight.castShadow=true;
    sunLight.shadow.mapSize.set(2048,2048);
    sunLight.shadow.camera.left=-24;sunLight.shadow.camera.right=24;
    sunLight.shadow.camera.top=24;sunLight.shadow.camera.bottom=-24;
    sunLight.shadow.camera.near=1;sunLight.shadow.camera.far=60;
    scene.add(hemiLight,sunLight);
  }
  if(m==='crypt'){
    hemiLight.color.setHex(0x7c8ca4);hemiLight.groundColor.setHex(0x1a1826);hemiLight.intensity=0.68;
    sunLight.color.setHex(0x9fb4d8);sunLight.intensity=1.05;
  }else{
    hemiLight.color.setHex(0xbcd8e8);hemiLight.groundColor.setHex(0x2a3325);hemiLight.intensity=0.85;
    sunLight.color.setHex(0xffeecf);sunLight.intensity=2.4;
  }
}
function buildWorld(){
  applyLighting(mapId);
  groundMesh=new THREE.Mesh(new THREE.PlaneGeometry(GRID*TILE,GRID*TILE),
    new THREE.MeshStandardMaterial({color:mapId==='crypt'?0x3d3d47:0x3a5530,roughness:1}));
  groundMesh.rotation.x=-Math.PI/2;groundMesh.receiveShadow=true;
  worldGroup.add(groundMesh);
  const patchGeo=new THREE.CircleGeometry(1,16);
  const patchMat=new THREE.MeshStandardMaterial({color:mapId==='crypt'?0x34343e:0x324a2a,roughness:1});
  for(let i=0;i<26;i++){
    const m=new THREE.Mesh(patchGeo,patchMat);
    m.rotation.x=-Math.PI/2;
    m.position.set((srand()-0.5)*GRID*TILE*0.9,0.012,(srand()-0.5)*GRID*TILE*0.9);
    m.scale.setScalar(0.7+srand()*1.6);
    worldGroup.add(m);
  }
  if(mapId==='forest'){
    const tuftG=new THREE.ConeGeometry(0.16,0.5,5);
    const tuftM=new THREE.MeshStandardMaterial({color:0x4e8a34,roughness:1});
    for(const k of grass){
      const [x,z]=k.split('_').map(Number);
      if(BARREL_POS.some(p=>p[0]===x&&p[1]===z))continue;
      for(let i=0;i<3;i++){
        const t=new THREE.Mesh(tuftG,tuftM);
        t.position.set(W(x)+(srand()-0.5),0.22,W(z)+(srand()-0.5));
        t.rotation.z=(srand()-0.5)*0.5;
        t.castShadow=true;
        worldGroup.add(t);
      }
    }
  }
  for(const [x,z] of TREES)addTree(x,z);
  for(const [x,z] of ROCKS)addRock(x,z);
  for(const [x,z] of TENTS)addTent(x,z);
  if(FIREPIT)addCampfire(FIREPIT[0],FIREPIT[1]);
  for(const [x,z] of BARREL_POS)if(!S.barrelsUsed.has(key(x,z)))addBarrel(x,z,mapId==='crypt'?0x4a4238:undefined);
}
/* ================= ЮНИТЫ ================= */
function buildFigure(cfg){
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
function makeUnit(cfg){
  const u=Object.assign({
    id:++uid,statuses:[],alive:true,reaction:1,level:1,xp:0,potions:0,
    slots:0,slotsMax:0,prof:2,swUsed:false,surge:0,actionMax:1,keepDist:false,
  },cfg);
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
const GOB={
  bruiser:{name:'Гоблин-задира',short:'Задира',hp:7,ac:13,xp:50,color:0x5d8f3f,
    weapon:{name:'Скимитар',dice:[1,6],abil:'str',melee:true,range:1}},
  archer:{name:'Гоблин-лучник',short:'Лучник',hp:7,ac:13,xp:50,color:0x6b7d3f,dex:14,
    weapon:{name:'Короткий лук',dice:[1,6],abil:'dex',range:8},
    dagger:{name:'Кинжал',dice:[1,4],abil:'str',melee:true,range:1}},
  shaman:{name:'Гоблин-шаман',short:'Шаман',hp:9,ac:12,xp:75,color:0x7a4f9e,dex:14,keepDist:true,
    weapon:{name:'Отравленный дротик',dice:[1,4],abil:'dex',range:6,status:{type:'poison',turns:2}},
    dagger:{name:'Кинжал',dice:[1,4],abil:'str',melee:true,range:1}},
  chief:{name:'Гоблин-вожак',short:'Вожак',hp:15,ac:14,xp:100,color:0x8f4a3a,
    weapon:{name:'Тесак',dice:[1,8],abil:'str',melee:true,range:1}},
};
function makeGoblin(t,x,z){
  gobCount[t.short]=(gobCount[t.short]||0)+1;
  const n=gobCount[t.short];
  return makeUnit({
    name:t.name+(n>1?' №'+n:''), short:t.short+(n>1?' '+n:''), side:'goblin',
    cls:'goblin',clsName:'Гоблин',x,z,
    str:12,dex:t.dex||12,con:12,int:8,wis:8,cha:8,
    hp:t.hp,maxhp:t.hp,ac:t.ac,speed:6,xp:t.xp,color:t.color,
    weapon:t.weapon,dagger:t.dagger||null,keepDist:!!t.keepDist,features:[],
  });
}
/* ================= v0.8: НЕЖИТЬ КРИПТЫ ================= */
const SKEL={name:'Скелет-страж',short:'Скелет',hp:11,ac:13,xp:60,color:0xcfc7b0,
  weapon:{name:'Ржавый меч',dice:[1,6],abil:'str',melee:true,range:1}};
function makeSkeleton(x,z){
  gobCount[SKEL.short]=(gobCount[SKEL.short]||0)+1;
  const n=gobCount[SKEL.short];
  return makeUnit({
    name:SKEL.name+(n>1?' №'+n:''),short:SKEL.short+(n>1?' '+n:''),side:'goblin',
    cls:'undead',clsName:'Скелет',x,z,
    str:13,dex:12,con:10,int:2,wis:8,cha:6,
    hp:SKEL.hp,maxhp:SKEL.hp,ac:SKEL.ac,speed:6,xp:SKEL.xp,color:SKEL.color,skin:0xd8d2be,
    weapon:SKEL.weapon,dagger:null,keepDist:false,features:[],
  });
}
function makeNecro(){
  return makeUnit({
    name:'Вхорил Костепёр',short:'Костепёр',cls:'necro',clsName:'Некромант',side:'goblin',
    str:10,dex:12,con:14,int:16,wis:14,cha:14,
    hp:46,maxhp:46,ac:15,speed:5,xp:400,x:14,z:4,color:0x3f2f55,skin:0xcac2ae,staff:true,tipColor:0x7fffc0,
    keepDist:true,bossBrain:true,isBoss:true,cryptBoss:true,fearImmune:true,phase2:false,
    weapon:{name:'Жезл гнили',dice:[1,8],abil:'int',range:6,necro:true,status:{type:'poison',turns:2}},
    dagger:{name:'Костяной клинок',dice:[1,6],abil:'str',melee:true,range:1},
    features:['Костяной шквал — 2d6 некротического всем соседям (1 раз в ход)',
      'На половине хитов призывает скелетов из стен',
      'Не ведает страха — запугивание бесполезно',
      'Печать его сундука держится, пока он «жив»'],
  });
}
function buildHeroes(){
  if(units.some(u=>u.side==='hero'))return;/* герои переживают смену карт */
  makeUnit({name:'Торик Кремень',short:'Торик',cls:'fighter',clsName:'Воин',side:'hero',
    str:16,dex:12,con:14,int:10,wis:12,cha:10,hp:14,maxhp:14,ac:16,speed:6,
    weapon:{name:'Длинный меч',dice:[1,8],abil:'str',melee:true,range:1},
    dagger:{name:'Кинжал',dice:[1,4],abil:'str',melee:true,range:1},
    armor:'Кольчуга',potions:2,x:13,z:24,color:0x8a93a6,
    features:['Второе дыхание — бонусное действие, лечение 1d10+1 (1/бой)',
      'Боевой стиль «Защита»: +1 КД (учтён в КД 16)',
      'Со 2 уровня: Дополнительное действие (1/бой)',
      'С 3 уровня: Доп. действие 2/бой']});
  makeUnit({name:'Мирелла Янтарная',short:'Мирелла',cls:'wizard',clsName:'Волшебница',side:'hero',
    str:8,dex:14,con:12,int:16,wis:12,cha:12,hp:10,maxhp:10,ac:12,speed:6,
    weapon:{name:'Посох',dice:[1,6],abil:'str',melee:true,range:1},
    dagger:{name:'Кинжал',dice:[1,4],abil:'str',melee:true,range:1},
    armor:'Роба',potions:2,slots:3,slotsMax:3,staff:true,x:14,z:25,color:0x4a5fae,
    features:['Огненные стрелы — заговор, 1d10+ИНТ огонь, без ячейки',
      'Огненный шар — действие + ячейка, 3d6 огонь, радиус 2.5 кл., задевает своих!',
      'Лечащее слово — бонус + ячейка, лечение 1d4+ИНТ',
      'Благословение — бонус + ячейка, +1d4 к атакам союзника (3 хода)',
      'Со 2 уровня: +5 HP, ИНТ +1, 4 ячейки; с 3 уровня — 5 ячеек']});
}
function spawnEnemies(){/* v0.8: враги зависят от карты и прогресса */
  for(const k in gobCount)delete gobCount[k];
  if(mapId==='forest'){
    S.patrolGroup=S.patrolDone?[]:[makeGoblin(GOB.bruiser,12,13),makeGoblin(GOB.bruiser,14,12)];
    if(S.campDone){S.campGroup=[];return;}
    const grat=makeGoblin(GOB.chief,21,6);
    grat.name='Грат Костолом';grat.short='Грат';grat.hp=grat.maxhp=22;grat.xp=200;
    grat.isBoss=true;grat.mainBoss=true;grat.str=14;
    S.campGroup=[grat,makeGoblin(GOB.shaman,19,4),makeGoblin(GOB.bruiser,23,5),makeGoblin(GOB.archer,24,4)];
  }else{
    S.patrolGroup=[];S.campGroup=[];
    if(S.necroSlain){S.cryptGroup=[];return;}/* v1.1: убитый некромант не поднимается вновь */
    const necro=makeNecro();
    S.cryptGroup=[necro,makeSkeleton(12,5),makeSkeleton(16,5)];
  }
}
function buildForestScenery(){/* v0.8: было buildScenery + охрана прогресса + вход в крипту */
  S.cageMesh=null;S.ilvaMesh=null;S.crateMesh=null;
  addCampfire(12,25);
  const dam=buildFigure({color:0x9a6a3f,side:'npc'});
  dam.scale.setScalar(1.08);
  dam.position.set(W(MERCHANT.x),0,W(MERCHANT.z));
  worldGroup.add(dam);
  solid.add(key(MERCHANT.x,MERCHANT.z));
  const cart=new THREE.Group();
  const box=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.8,1.0),
    new THREE.MeshStandardMaterial({color:0x6a4a2c,roughness:0.9}));
  box.position.y=0.55;box.castShadow=true;
  const cov=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,1.5,10,1,false,0,Math.PI),
    new THREE.MeshStandardMaterial({color:0xb8a888,roughness:1}));
  cov.rotation.z=Math.PI/2;cov.position.y=1.02;
  const whM=new THREE.MeshStandardMaterial({color:0x4a3520,roughness:0.9});
  const wh1=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.12,10),whM);
  wh1.rotation.x=Math.PI/2;wh1.position.set(0.45,0.3,0.55);
  const wh2=wh1.clone();wh2.position.z=-0.55;
  cart.add(box,cov,wh1,wh2);
  cart.position.set(W(MERCHANT.x+1),0,W(MERCHANT.z+1));
  worldGroup.add(cart);
  solid.add(key(MERCHANT.x+1,MERCHANT.z+1));
  addInteract(MERCHANT.x,MERCHANT.z,2.6,'Поговорить с Дамроком',()=>openDlg('damrock'),dam,
    'Дамрок Бочкарь','Торговец. Товар, сплетни и награды за услуги.');
  if(!S.ilvaFreed){
    const cage=new THREE.Group();
    const barM=new THREE.MeshStandardMaterial({color:0x555a60,metalness:0.7,roughness:0.4});
    for(let i=0;i<9;i++){
      const b=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.7,6),barM);
      const a=i/9*Math.PI*2;
      b.position.set(Math.cos(a)*0.55,0.85,Math.sin(a)*0.55);
      cage.add(b);
    }
    const top=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.62,0.08,12),barM);
    top.position.y=1.72;cage.add(top);
    cage.position.set(W(CAGE.x),0,W(CAGE.z));
    worldGroup.add(cage);
    solid.add(key(CAGE.x,CAGE.z));
    const ilva=buildFigure({color:0x3f7a6a,side:'npc'});
    ilva.scale.setScalar(0.92);
    ilva.position.set(W(CAGE.x),0,W(CAGE.z));
    worldGroup.add(ilva);
    addInteract(CAGE.x,CAGE.z,2.4,'Поговорить с пленницей',()=>openDlg('ilva'),ilva,
      'Илва','Пленница в клетке. Похожа на разведчицу.');
    S.cageMesh=cage;S.ilvaMesh=ilva;
  }
  if(!S.hasCrate){
    const crate=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.7,0.95),
      new THREE.MeshStandardMaterial({color:0x8a6a3a,roughness:0.85}));
    crate.position.set(W(CRATE.x),0.35,W(CRATE.z));
    crate.castShadow=true;worldGroup.add(crate);
    solid.add(key(CRATE.x,CRATE.z));
    addInteract(CRATE.x,CRATE.z,2.2,'Осмотреть ящик',()=>takeCrate(),crate,
      'Ящик с товаром','Пометка на крышке: «Д. Бочкарь, поставка №7».');
    S.crateMesh=crate;
  }
  /* v0.8: вход в крипту на северо-востоке */
  const stairs=new THREE.Group();
  const stM=new THREE.MeshStandardMaterial({color:0x6a6a60,roughness:1});
  for(let i=0;i<4;i++){
    const s=new THREE.Mesh(new THREE.BoxGeometry(1.9-i*0.34,0.18,0.72),stM);
    s.position.set(0,0.09+i*0.18,-i*0.56);s.castShadow=true;s.receiveShadow=true;
    stairs.add(s);
  }
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(2.1,0.32,0.8),stM);
  lintel.position.set(0,1.05,-2.05);lintel.castShadow=true;
  stairs.add(lintel);
  stairs.position.set(W(26),0,W(3));
  worldGroup.add(stairs);
  addRock(25,1);addRock(26,6);
  glows.attach('cryptin',W(26),W(3),1.7,0x5fae7f);
  fx.addEmber('cryptin',W(26),W(3),{rate:3,color:0x7fd0a0,up:0.9,spread:0.5,size:0.09,life:1.2});
  addInteract(26,3,2.6,'Вход в крипту',()=>enterCrypt(),stairs,
    'Вход в крипту','Древние ступени под курганом. Изнутри тянет холодом и прахом.');
}
function enterCrypt(){
  if(QUESTS.main.state!=='done'){
    log('Проход в курган завален и охраняется лагерем Костей. Сначала разгромите лагерь.','g-sys');
    setHint('Крипта откроется после разгрома лагеря гоблинов.');
    return;
  }
  void switchMap('crypt');
}
function buildCryptScenery(){/* v0.8: подземелье босса */
  const pilM=new THREE.MeshStandardMaterial({color:0x555560,roughness:1});
  for(const [x,z] of CRYPT.PILLARS){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.5,3.2,8),pilM);
    p.position.set(W(x),1.6,W(z));p.castShadow=true;p.receiveShadow=true;
    worldGroup.add(p);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(1.15,0.28,1.15),pilM);
    cap.position.set(W(x),3.3,W(z));cap.castShadow=true;
    worldGroup.add(cap);
  }
  const sarM=new THREE.MeshStandardMaterial({color:0x4a4a56,roughness:0.9});
  for(const [x,z] of CRYPT.SARCS){
    const s=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.8,2.0),sarM);
    s.position.set(W(x),0.4,W(z));s.castShadow=true;s.receiveShadow=true;
    worldGroup.add(s);
    const lid=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.16,2.1),
      new THREE.MeshStandardMaterial({color:0x5a5a66,roughness:0.85}));
    lid.position.set(W(x),0.88,W(z));lid.castShadow=true;
    worldGroup.add(lid);
  }
  CRYPT.BRAZIERS.forEach(([x,z],i)=>{
    const g=new THREE.Group();
    const legM=new THREE.MeshStandardMaterial({color:0x3a3a30,roughness:0.8,metalness:0.4});
    const bowl=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.22,0.4,9),legM);
    bowl.position.y=0.85;bowl.castShadow=true;
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.12,0.85,6),legM);
    leg.position.y=0.42;
    const fl=new THREE.Mesh(new THREE.ConeGeometry(0.26,0.75,7),
      new THREE.MeshBasicMaterial({color:0x6fe8a0,transparent:true,opacity:0.85}));
    fl.position.y=1.42;
    const lt=new THREE.PointLight(0x66e0a0,19,15,2);
    lt.position.y=1.6;
    g.add(bowl,leg,fl,lt);
    g.position.set(W(x),0,W(z));
    worldGroup.add(g);
    glows.attach('braz'+i,W(x),W(z),1.5,0x5fae7f);
    fx.addEmber('braz'+i,W(x),W(z),{rate:6,color:0x7fd0a0,up:1.4,spread:0.3,size:0.1,life:1.1});
  });
  const th=CRYPT.THRONE;
  const throne=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.35,1.1),sarM);
  throne.position.set(W(th[0]),0.67,W(th[1]));throne.castShadow=true;throne.receiveShadow=true;
  worldGroup.add(throne);
  const thBack=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.6,0.28),sarM);
  thBack.position.set(W(th[0]),1.9,W(th[1])-0.55);thBack.castShadow=true;
  worldGroup.add(thBack);
  glows.attach('throne',W(th[0]),W(th[1])+0.8,1.2,0x4a8a6a);
  /* сундук босса */
  const ch=CRYPT.CHEST;
  const chest=new THREE.Group();
  const cM=new THREE.MeshStandardMaterial({color:0x6a4a26,roughness:0.75});
  const cb=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.5,0.6),cM);
  cb.position.y=0.25;cb.castShadow=true;
  const cl=new THREE.Mesh(new THREE.BoxGeometry(0.99,0.2,0.64),
    new THREE.MeshStandardMaterial({color:0x7a5a30,roughness:0.7,metalness:0.25}));
  cl.position.y=0.56;
  const band=new THREE.Mesh(new THREE.BoxGeometry(0.99,0.54,0.12),
    new THREE.MeshStandardMaterial({color:0xb8a05a,roughness:0.4,metalness:0.7}));
  band.position.y=0.26;
  chest.add(cb,cl,band);
  chest.position.set(W(ch[0]),0,W(ch[1]));
  worldGroup.add(chest);
  addInteract(ch[0],ch[1],2.4,'Открыть сундук Костепёра',()=>openChest(chest),chest,
    'Сундук Костепёра','Запечатан могильной силой. Печать держится, пока некромант «жив».');
  /* лестница наверх */
  const ex=CRYPT.EXIT;
  const out=new THREE.Group();
  for(let i=0;i<3;i++){
    const s=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.16,0.6),pilM);
    s.position.set(0,0.08+i*0.16,i*0.5);s.receiveShadow=true;s.castShadow=true;
    out.add(s);
  }
  out.position.set(W(ex[0]),0,W(ex[1]));
  worldGroup.add(out);
  addInteract(ex[0],ex[1],2.2,'Подняться на тракт',()=>{void switchMap('forest');},out,
    'Лестница на тракт','Слабый серый свет и шум ветра — наверху дневной тракт.');
  for(const [x,z] of CRYPT.URNS)addBarrel(x,z,0x4a4238);
}
function openChest(chest){
  if(S.chestLooted)return;
  if(units.some(u=>u.cryptBoss&&u.alive)){
    setHint('Печать держится, пока Костепёр «жив».');
    log('Сундук не поддаётся: могильная печать питается волей некроманта.','g-sys');
    return;
  }
  S.chestLooted=true;
  const g=100+d(100);
  gainGold(g);
  for(const h of aliveHeroes())h.potions++;
  const f=aliveHeroes().find(h=>h.cls==='fighter')||aliveHeroes()[0];
  if(f){f.ac+=1;log('Перстень Костепёра надет: КД '+f.short+' теперь '+f.ac+'.','g-sys');}
  log('В сундуке: '+g+' золота, зелье каждому и перстень Костепёра (+1 КД)!','g-heal');
  fx.burstAtMesh({mesh:chest},{count:34,color:0xffd54f,speed:3.2,size:0.13,life:1.0,gravity:-1.2});
  glows.flashAtMesh({mesh:chest},0xffd54f,1.5);
  sfx.gold();
  refreshParty();refreshTracker();
}
/* v0.8: размещение отряда в точках входа */
function placeHeroes(list){
  const hs=units.filter(u=>u.side==='hero');
  hs.forEach((h,i)=>{
    const p=list[i%list.length];
    h.x=p[0];h.z=p[1];
    h.mesh.position.set(W(p[0]),0,W(p[1]));
    h.mesh.rotation.set(0,0,0);
  });
}
/* v1.1: разбор мира вынесен из switchMap — используется и при загрузке сейва */
function teardownWorld(){
  cancelTargeting();setHint('');
  for(const u of units.filter(u=>u.side!=='hero'))removeUnit(u);
  for(const b of barrels)if(b.mesh)b.mesh.removeFromParent();
  barrels.length=0;
  for(const k of [...fires.keys()])removeFire(k);
  fx.clearEmbers();
  glows.clear();
  interactables.length=0;
  clearGroup(worldGroup);
  groundMesh=null;fireLight=null;flameMesh=null;
  combatOn=false;order=[];turnIdx=-1;current=null;
  $('#actionbar').style.display='none';
  refreshBossBar();
}
/* v1.1: сборка карты без фейда — общее ядро switchMap и загрузки сейва.
   spots — точки размещения героев (null — не трогать позиции). */
function buildMap(id,spots){
  mapId=id;
  if(id==='crypt'){
    seedCrypt();applyAtmosphere('crypt');
    buildWorld();buildCryptScenery();spawnEnemies();
    if(spots)placeHeroes(spots);
    controls.target.set(1,0,8);
    if(QUESTS.crypt.state==='hidden')questStart('crypt');
    questObj('crypt','enter');
    const nc=units.find(u=>u.cryptBoss);
    if(nc)void upgradeUnitRig(nc,{tint:0x4a7a5f,tintStrength:0.5,scale:1.14,yaw:Math.PI});
    log('Крипта Костепёра. Зелёный свет жаровен, холод и стрёкот костей в темноте.','g-sys');
  }else{
    seedForest();applyAtmosphere('forest');
    buildWorld();buildForestScenery();spawnEnemies();
    if(spots)placeHeroes(spots);
    controls.target.set(1,0,12);
    log('Вы поднимаетесь на тракт. Ветер и пение птиц — мертвецы больше не тревожат дорогу.','g-sys');
  }
  initOverlays();
  phase='explore';
  $('#round').textContent=MAP_NAME[mapId];
}
/* v0.8: смена карты — телепорт отряда, разбор старой декорации, сборка новой */
async function switchMap(id){
  if(busy||mapId===id||phase==='transition')return;
  busyOn();phase='transition';
  sfx.portal();
  const f=$('#fade');
  f.style.opacity=1;
  await sleep(620);
  teardownWorld();
  buildMap(id,CRYPT.ENTER);
  f.style.opacity=0;
  openExploreUI();
  refreshTracker();refreshParty();refreshBossBar();
  busyOff();
}
const BOLT={name:'Огненные стрелы',dice:[1,10],abil:'int',range:9,fire:true};

/* ================= ТВИНЫ / ЭФФЕКТЫ ================= */
function tween(dur,fn){return new Promise(res=>tweens.push({t:0,dur,fn,res}));}
function faceTo(u,p){
  const dx=p.x-u.mesh.position.x,dz=p.z-u.mesh.position.z;
  if(dx||dz)u.mesh.rotation.y=Math.atan2(dx,dz);
}
async function lunge(att,def){
  const back=att.mesh.position.clone();
  const dir=new THREE.Vector3(def.mesh.position.x-back.x,0,def.mesh.position.z-back.z);
  const L=Math.min(0.55,Math.max(0.15,dir.length()*0.35));
  if(dir.lengthSq()<1e-6)return;
  dir.normalize();
  await tween(0.11,k=>{const s=k*k*(3-2*k);att.mesh.position.copy(back).addScaledVector(dir,L*s);});
  await tween(0.13,k=>{const s=k*k*(3-2*k);att.mesh.position.copy(back).addScaledVector(dir,L*(1-s));});
  att.mesh.position.copy(back);
}
const boomPool=[];
function boomFX(x,z,r){
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
function shake(t){shakeT=Math.max(shakeT,t);}
const projMesh=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,8),
  new THREE.MeshBasicMaterial({color:0xffa040}));
projMesh.visible=false;scene.add(projMesh);

/* ================= ИНТЕРФЕЙС: ЛОГ / ТЕКСТ / ПОДСКАЗКИ ================= */
function log(msg,cls){
  const p=document.createElement('p');
  if(cls)p.className=cls;
  p.textContent=msg;
  const lb=$('#logbody');
  lb.appendChild(p);
  while(lb.children.length>80)lb.removeChild(lb.firstChild);
  lb.scrollTop=lb.scrollHeight;
}
const pv=new THREE.Vector3();
function projectPos(x,y,z){
  pv.set(x,y,z).project(camera);
  return {x:(pv.x*0.5+0.5)*innerWidth,y:(-pv.y*0.5+0.5)*innerHeight,behind:pv.z>1};
}
function ftextAbove(ent,text,color){
  const s=projectPos(ent.mesh.position.x,ent.mesh.position.y+1.6,ent.mesh.position.z);
  if(s.behind)return;
  const el=document.createElement('div');
  el.className='ft';el.textContent=text;el.style.color=color;
  el.style.left=s.x+'px';el.style.top=s.y+'px';
  $('#ov').appendChild(el);
  setTimeout(()=>el.remove(),1100);
}
function setHint(t){$('#hint').textContent=t||'';}
function bigBanner(text){
  const b=$('#banner');b.textContent=text;b.style.opacity=1;
  setTimeout(()=>{b.style.opacity=0;},2200);
}
function initOverlays(){
  const ov=$('#ov');
  for(const u of units){
    if(u._el)continue;/* v0.8: герои переживают смену карт */
    const el=document.createElement('div');
    el.className='uhp '+u.side;
    el.innerHTML='<div class="nm">'+u.name+'</div><div class="ubar"><i></i></div><div class="uic"></div>';
    ov.appendChild(el);
    u._el=el;
  }
}
function refreshIcons(u){
  if(!u._el)return;
  const el=u._el.querySelector('.uic');
  if(el)el.innerHTML=u.statuses.map(s=>
    '<span style="background:'+STATUS[s.type].css+'">'+STATUS[s.type].tag+s.turns+'</span>').join('');
}
function updateOverlays(){
  for(const u of units){
    const el=u._el;if(!el)continue;
    if(!u.alive){el.style.display='none';continue;}
    const s=projectPos(u.mesh.position.x,u.mesh.position.y+2.05,u.mesh.position.z);
    if(s.behind){el.style.display='none';continue;}
    el.style.display='block';
    el.style.left=s.x+'px';el.style.top=s.y+'px';
    el.querySelector('.ubar i').style.width=Math.max(0,u.hp/u.maxhp*100)+'%';
  }
}

/* ================= МАРКЕРЫ / ТОЧКИ ПУТИ ================= */
const markerPool=[],dotPool=[];
let mi=0,di=0;
const circGeo=new THREE.CircleGeometry(0.52,20);
const dotGeo=new THREE.SphereGeometry(0.09,8,8);
function initMarkers(){
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
function addMarker(x,z,color,scale){
  if(mi>=markerPool.length)return;
  const m=markerPool[mi++];
  m.visible=true;m.position.set(W(x),0.05,W(z));
  m.material.color.setHex(color);m.material.opacity=0.32;
  m.scale.setScalar(scale||1);
}
function clearMarkers(){mi=0;for(const m of markerPool)m.visible=false;}
function addDot(x,z,inRange){
  if(di>=dotPool.length)return;
  const m=dotPool[di++];
  m.visible=true;m.position.set(W(x),0.12,W(z));
  m.material.color.setHex(inRange?0x8fe0ff:0x3a5560);
}
function clearDots(){di=0;for(const m of dotPool)m.visible=false;}
function showReach(u){
  clearMarkers();
  if(!combatOn||phase!=='player'||!u||!u.alive)return;
  const nodes=reachNodes(u,false);
  for(const n of nodes.values())if(n.g>0)addMarker(n.x,n.z,0x3f7fae,0.45);
}

/* ================= A* И ДОСТИЖИМОСТЬ ================= */
function astar(sx,sz,gx,gz,mover,ai){
  if(!passable(gx,gz,mover))return null;
  if(sx===gx&&sz===gz)return [];
  const open=new Map(),closed=new Set();
  const h=(x,z)=>{const dx=Math.abs(x-gx),dz=Math.abs(z-gz);return Math.max(dx,dz)+0.5*Math.min(dx,dz);};
  open.set(key(sx,sz),{x:sx,z:sz,g:0,f:h(sx,sz),p:null});
  let it=0;
  while(open.size&&it++<4000){
    let bn=null,bk=null;
    for(const [k,n] of open)if(!bn||n.f<bn.f){bn=n;bk=k;}
    open.delete(bk);closed.add(bk);
    if(bn.x===gx&&bn.z===gz){
      const path=[];let c=bn;
      while(c.p){path.push({x:c.x,z:c.z});c=c.p;}
      return path.reverse();
    }
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      if(!dx&&!dz)continue;
      const nx=bn.x+dx,nz=bn.z+dz,nk=key(nx,nz);
      if(closed.has(nk))continue;
      if(dx&&dz&&(!passable(bn.x+dx,bn.z,mover)||!passable(bn.x,bn.z+dz,mover)))continue;
      if(!passable(nx,nz,mover))continue;
      let g=bn.g+((dx&&dz)?1.5:1);
      if(ai)g+=dangerAt(nx,nz,mover)*0.8;
      const ex=open.get(nk);
      if(!ex||g<ex.g-1e-9)open.set(nk,{x:nx,z:nz,g,f:g+h(nx,nz),p:bn});
    }
  }
  return null;
}
function reachNodes(mover,ai){
  const start={x:mover.x,z:mover.z,g:0,p:null};
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
      if(dx&&dz&&(!passable(n.x+dx,n.z,mover)||!passable(n.x,n.z+dz,mover)))continue;
      if(!passable(nx,nz,mover))continue;
      let g=n.g+((dx&&dz)?1.5:1);
      if(ai)g+=dangerAt(nx,nz,mover)*0.8;
      if(g>mover.moveLeft+1e-9)continue;
      const ex=best.get(nk);
      if(!ex||g<ex.g-1e-9){const node={x:nx,z:nz,g,p:n};best.set(nk,node);open.push(node);}
    }
  }
  return best;
}
function nodePath(node){
  const a=[];let c=node;
  while(c.p){a.push({x:c.x,z:c.z});c=c.p;}
  return a.reverse();
}

/* ================= ОГОНЬ ================= */
const fireGeo=new THREE.PlaneGeometry(TILE*0.95,TILE*0.95);
function igniteTile(x,z,turns){
  const k=key(x,z);
  if(!grass.has(k))return;
  if(fires.has(k)){const f=fires.get(k);f.turns=Math.max(f.turns,turns);return;}
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
function removeFire(k){
  const f=fires.get(k);
  if(!f)return;
  f.g.removeFromParent();fires.delete(k);/* v0.8: плита живёт в worldGroup */
  fx.removeEmber(k);glows.detach(k);
}
function tickFires(){
  for(const f of [...fires.values()]){
    const u=unitAt(f.x,f.z,null);
    if(u&&u.alive){
      const dmg=d(4);
      log(u.name+' горит в пламени: '+dmg+' урона.','g-fire');
      ftextAbove(u,'−'+dmg,'#ff8a50');
      damageUnit(u,dmg,null);
      if(u.alive&&Math.random()<0.5)addStatus(u,'burn',2);
    }
  }
  const born=[];
  for(const f of fires.values()){
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      if(!dx&&!dz)continue;
      const nx=f.x+dx,nz=f.z+dz,nk=key(nx,nz);
      const b=barrelAt(nx,nz);
      if(b)setTimeout(()=>explodeBarrel(b),240);
      else if(grass.has(nk)&&!fires.has(nk)&&Math.random()<0.38)born.push([nx,nz]);
    }
  }
  for(const [x,z] of born)igniteTile(x,z,2);
  for(const [k,f] of [...fires]){f.turns--;if(f.turns<=0)removeFire(k);}
  checkEnd();
}
/* ================= БОЕВАЯ МАТЕМАТИКА ================= */
function attackMod(u,w){
  let m=mod(u[w.abil])+(u.prof||0);
  if(u.statuses.some(s=>s.type==='poison'))m-=2;
  if(u.statuses.some(s=>s.type==='fear'))m-=2;
  return m;
}
function blessed(u){return u.statuses.some(s=>s.type==='bless')?d(4):0;}
function hitChance(u,t,w){
  const need=t.ac-attackMod(u,w);
  return clamp((21-need)/20,0.05,0.95);
}
function avgDamage(u,w){
  return w.dice[0]*(w.dice[1]/2+0.5)+mod(u[w.abil]);
}
function addStatus(u,type,turns){
  if(!u||!u.alive||u.isBarrel)return;
  if(type==='fear'&&u.fearImmune){log(u.name+' не ведает страха!','g-enemy');return;}/* v0.8 */
  const ex=u.statuses.find(s=>s.type===type);
  if(ex)ex.turns=Math.max(ex.turns,turns);
  else u.statuses.push({type,turns});
  log(u.name+': '+STATUS[type].name+' ('+turns+' ход.).','g-sys');
  /* v0.7: вспышка статуса + звук */
  fx.burstAtMesh(u,{count:10,color:{burn:0xff9a4d,poison:0x8fd36a,bless:0xffd54f,fear:0xb08fd3}[type]||0xffffff,speed:1.4,size:0.1,life:0.7,gravity:-0.8});
  if(type==='bless')sfx.bless();else if(type==='poison')sfx.poison();else if(type==='burn')sfx.ignite();
  refreshIcons(u);refreshParty();
}
async function doAttack(att,def,w,opts){
  opts=opts||{};
  if(!att.alive||!def.alive)return;
  busyOn();
  faceTo(att,def.mesh.position);
  sfx.swing(w);
  /* v0.7.x: выпад корпусом (работает и для GLTF-рига) */
  void tween(0.26,k=>{if(att.rig)att.rig.rotation.x=Math.sin(k*Math.PI)*0.5;});
  await lunge(att,def);
  const m=attackMod(att,w),bl=blessed(att);
  const nat=d(20),total=nat+m+bl,crit=nat===20;
  const hit=crit||(nat!==1&&total>=def.ac);
  const cls=att.side==='hero'?'g-hero':'g-enemy';
  if(!hit){
    ftextAbove(def,'Промах','#aab2bd');
    log(att.name+': '+w.name+' по «'+def.name+'» — '+total+' против КД '+def.ac+' — промах!',cls);
  }else{
    const n=w.dice[0]*(crit?2:1);
    const dmg=roll(n,w.dice[1])+mod(att[w.abil]);
    ftextAbove(def,(crit?'КРИТ! −':'−')+dmg,crit?'#ffd54f':(w.fire?'#ff8a50':(w.necro?'#9fe8b8':'#ffffff')));
    log(att.name+': '+w.name+' по «'+def.name+'» — '+(crit?'КРИТ! ':'')+total+' против КД '+def.ac+', урон '+dmg+'.',cls);
    /* v0.7: искры попадания, звук удара, слоумо-крит */
    fx.burstAtMesh(def,w.fire?{count:16,color:0xff8a50,speed:3.4,size:0.13,life:0.5}:(w.necro?{count:16,color:0x9fe8b8,speed:2.6,size:0.12,life:0.6}:{count:12,color:0xffe8b0,speed:2.8,size:0.1,life:0.4}));
    sfx.impact(w);
    if(crit){
      sfx.crit();slowmo.trigger(0.55,0.22);
      fx.burstAtMesh(def,{count:30,color:0xffd54f,speed:4.6,size:0.15,life:0.85});
      glows.flashAtMesh(def,0xffd54f,1.5);
    }
    damageUnit(def,dmg,att);
    if(w.status&&def.alive)addStatus(def,w.status.type,w.status.turns);
  }
  if(opts.aoo)refreshInit();
  busyOff();
}
function damageUnit(t,dmg,src){
  if(!t||!t.alive)return;
  t.hp-=dmg;
  refreshBossBar();/* v0.8: боссбар живёт в реальном времени */
  if(t.hp<=0)die(t,src);
}
function healUnit(u,amt,why){
  if(!u.alive)return;
  const before=u.hp;
  u.hp=Math.min(u.maxhp,u.hp+amt);
  refreshBossBar();/* v0.8 */
  ftextAbove(u,'+'+(u.hp-before),'#8fd36a');
  sfx.heal();
  fx.burstAtMesh(u,{count:18,color:0x8fd36a,speed:1.5,size:0.11,life:0.9,gravity:-1.1});
  glows.flashAtMesh(u,0x8fd36a,1.1);
  log(u.name+' восстанавливает '+(u.hp-before)+' HP ('+why+').','g-heal');
  refreshParty();
}
function die(t,src){
  if(!t.alive)return;
  if(t.isBarrel){explodeBarrel(t);return;}
  t.alive=false;t.hp=0;
  log(t.name+' повержен!','g-sys');
  ftextAbove(t,'Повержен','#d8b45a');
  sfx.death();
  fx.burstAtMesh(t,{count:22,color:0x7a2f2f,speed:2.4,size:0.12,life:0.7});
  const m=t.mesh;
  tween(0.5,k=>{m.rotation.z=1.35*k*k;m.position.y=-0.12*k;});
  refreshIcons(t);refreshInit();refreshParty();
  if(t.side==='goblin'&&t.xp)awardXP(t.xp);
  if(t.side==='goblin'){const g=3+d(6);gainGold(g);log('С поверженного собрано '+g+' золота.','g-sys');}
  if(t.mainBoss){questObj('main','boss');questDone('main');}/* v0.8: Грат — босс основного квеста */
  if(t.cryptBoss){
    S.necroSlain=true;/* v1.1: печать сундука и респаун */
    questObj('crypt','boss');questDone('crypt');
    fx.burstAtMesh(t,{count:44,color:0xcfe8d8,speed:3.6,size:0.15,life:1.1,gravity:0.6});
    sfx.bones();
    log('Могильная печать на сундуке у трона рассыпается!','g-sys');
  }
  checkEnd();
}

/* ================= ВЗРЫВЫ ================= */
function explode(tx,tz,opts){
  opts=opts||{};
  const dice=opts.dice||[3,6],radius=opts.radius||2.5;
  const dmg=roll(dice[0],dice[1]);
  const cx=W(tx),cz=W(tz);
  boomFX(cx,cz,radius);
  /* v0.7: партиклы взрыва, хало-вспышка, звук, микро-слоумо */
  fx.explosion(cx,cz,radius);
  glows.flash(cx,cz,radius*1.5,0xffa040);
  sfx.explosion();
  slowmo.trigger(0.4,0.4);
  log('ВЗРЫВ! Урон '+dmg+' в радиусе '+radius+' кл.','g-fire');
  for(const u of units)if(u.alive&&!u.isBarrel){
    if(Math.hypot(u.x-tx,u.z-tz)<=radius+0.35){
      ftextAbove(u,'−'+dmg,'#ff8a50');
      damageUnit(u,dmg,null);
      if(u.alive&&Math.random()<0.6)addStatus(u,'burn',2);
    }
  }
  for(const b of barrels)if(b.alive&&Math.hypot(b.x-tx,b.z-tz)<=radius+0.35){
    setTimeout(()=>explodeBarrel(b),240);
  }
  let lit=0;
  const R=Math.ceil(radius);
  for(let dx=-R;dx<=R;dx++)for(let dz=-R;dz<=R;dz++){
    if(Math.hypot(dx,dz)>radius)continue;
    if(grass.has(key(tx+dx,tz+dz))&&!fires.has(key(tx+dx,tz+dz))){igniteTile(tx+dx,tz+dz,3);lit++;}
  }
  if(lit)log('Трава вспыхивает ('+lit+' кл.)!','g-fire');
  checkEnd();
}
function explodeBarrel(b){
  if(!b.alive)return;
  b.alive=false;
  const m=b.mesh;
  tween(0.15,k=>{m.scale.setScalar(1+0.6*k);}).then(()=>m.removeFromParent());/* v0.8 */
  log('Взрывная бочка детонирует!','g-fire');
  explode(b.x,b.z,{dice:[3,6],radius:2.5});
}
async function castFireball(h,tx,tz){
  log(h.name+' сотворяет ОГНЕННЫЙ ШАР!','g-fire');
  sfx.fireCast();
  projMesh.visible=true;
  const from=h.mesh.position.clone().add(new THREE.Vector3(0,1.3,0));
  const to=new THREE.Vector3(W(tx),0.5,W(tz));
  await tween(0.32,k=>{
    projMesh.position.lerpVectors(from,to,k);
    projMesh.position.y=0.8+Math.sin(k*Math.PI)*2.2;
  });
  projMesh.visible=false;
  explode(tx,tz,{dice:[3,6],radius:2.5});
}

/* ================= ПЕРЕМЕЩЕНИЕ ================= */
async function animateMove(u,path){
  u.moving=true;
  try{
  for(const step of path){
    if(!u.alive)return false;
    const diag=(step.x!==u.x&&step.z!==u.z);
    const cost=diag?1.5:1;
    if(u.moveLeft+1e-9<cost){
      if(u.side==='hero')log(u.name+': перемещение закончилось.','g-sys');
      break;
    }
    const from={x:u.x,z:u.z};
    if(combatOn&&!u.disengaging){
      for(const e of enemiesOf(u)){
        if(e.reaction>0&&!e.pacified&&cheb(e,from)<=1){
          const mw=meleeWeaponOf(e);
          if(mw){
            e.reaction--;
            log(e.name+' совершает АТАКУ ПО ВОЗМОЖНОСТИ!','g-sys');
            await doAttack(e,u,mw,{aoo:true});
            if(!u.alive)return false;
          }
        }
      }
    }
    u.moveLeft-=cost;
    const a=u.mesh.position.clone();
    const b=new THREE.Vector3(W(step.x),0,W(step.z));
    faceTo(u,b);
    await tween(0.13,k=>{const s=k*k*(3-2*k);u.mesh.position.lerpVectors(a,b,s);});
    u.x=step.x;u.z=step.z;
    if(fires.has(key(u.x,u.z))){
      const dmg=d(4);
      log(u.name+' пробегает по огню: '+dmg+' урона.','g-fire');
      ftextAbove(u,'−'+dmg,'#ff8a50');
      damageUnit(u,dmg,null);
      if(!u.alive)return false;
      if(Math.random()<0.45)addStatus(u,'burn',2);
    }
    refreshUI();
  }
  return u.alive;
  }finally{u.moving=false;}
}

/* ================= ХОДЫ ================= */
function startCombat(group){
  closeDlgHard();
  if(!group.length)return;
  S.combatGroup=group;
  combatOn=true;
  log('=== БОЙ НАЧИНАЕТСЯ ===','g-sys');
  sfx.stinger('combat');
  if(S.combatGroup.some(g=>g.cryptBoss)){/* v0.8: аутро босса крипты */
    bigBanner('ВХОРИЛ КОСТЕПЁР');
    log('Из тьмы поднимается Вхорил Костепёр — глаза горят могильным огнём.','g-enemy');
  }
  for(const h of aliveHeroes()){
    h.swUsed=false;h.slots=h.slotsMax;
    if(h.cls==='fighter'&&h.level>=2)h.surge=h.level>=3?2:1;
  }
  const list=[...aliveHeroes(),...group.filter(g=>g.alive)];
  for(const u of list)u.init=d(20)+mod(u.dex);
  order=list.sort((a,b)=>b.init-a.init);
  turnIdx=-1;round=1;
  $('#round').textContent='Раунд 1';
  $('#actionbar').style.display='block';
  refreshInit();refreshParty();
  log('Инициатива: '+order.map(u=>u.name+' ('+u.init+')').join(', '),'g-sys');
  endTurn();
}
function beginTurn(u){
  if(!combatOn)return;
  current=u;targeting=null;
  clearMarkers();clearDots();setHint('');
  for(const x of units)x.mesh.userData.ring.material.color.setHex(x.side==='hero'?0x5a8fc0:0xa04a3a);
  u.mesh.userData.ring.material.color.setHex(0xd8b45a);
  refreshInit();
  $('#turnb').textContent=u.side==='hero'?'Ваш ход: '+u.name:'Ход противника: '+u.name;
  $('#turnb').style.color=u.side==='hero'?'#8fd36a':'#e06c55';
  if(fires.has(key(u.x,u.z))){
    const dmg=d(4);
    log(u.name+' стоит в огне: '+dmg+' урона.','g-fire');
    ftextAbove(u,'−'+dmg,'#ff8a50');
    damageUnit(u,dmg,null);
  }
  const burn=u.alive&&u.statuses.find(s=>s.type==='burn');
  if(burn){
    const dmg=d(4);
    log(u.name+': горение — '+dmg+' урона.','g-fire');
    ftextAbove(u,'−'+dmg,'#ff8a50');
    damageUnit(u,dmg,null);
  }
  if(!u.alive){endTurn();return;}
  u.statuses.forEach(s=>s.turns--);
  u.statuses=u.statuses.filter(s=>s.turns>0);
  refreshIcons(u);
  u.action=u.actionMax;u.bonus=1;u.reaction=1;
  u.moveLeft=u.speed;u.disengaging=false;u.dashUsed=false;
  busy=false;
  $('#actionbar').style.display='block';
  if(u.side==='hero'){
    phase='player';
    refreshUI();showReach(u);
  }else{
    phase='ai';
    refreshUI();
    setTimeout(()=>aiTurn(u),550);
  }
}
function endTurn(){
  if(!combatOn)return;
  targeting=null;clearMarkers();clearDots();
  let steps=0;
  while(steps<=order.length*2){
    turnIdx++;
    if(turnIdx>=order.length){
      turnIdx=0;round++;
      $('#round').textContent='Раунд '+round;
      tickFires();
    }
    const c=order[turnIdx];
    if(c&&c.alive)break;
    steps++;
  }
  const u=order[turnIdx];
  if(!u||!u.alive||!combatOn)return;
  beginTurn(u);
}

/* ================= ВОЛНЫ / ОПЫТ / УРОВНИ ================= */
function checkEnd(){
  if(!combatOn)return;
  if(!aliveHeroes().length){combatOn=false;phase='over';sfx.stinger('defeat');showEnd(false);return;}
  if(S.combatGroup.some(g=>g.alive))return;
  combatOn=false;phase='explore';
  victorySequence();
}
function victorySequence(){
  log('=== ПОБЕДА! ===','g-sys');
  bigBanner('ПОБЕДА!');
  sfx.stinger('victory');
  fx.burstAtMesh(aliveHeroes()[0]||units[0],{count:36,color:0xffd54f,speed:3.2,size:0.14,life:1.1,gravity:-1.2});
  for(const h of aliveHeroes())healUnit(h,roll(2,6)+2,'перевязка после боя');
  const summ=units.filter(x=>x.summoned&&x.alive);/* v0.8: призраки рассыпаются */
  for(const s of summ){
    log(s.name+' рассыпается прахом без воли хозяина.','g-sys');
    s.alive=false;
    fx.burstAtMesh(s,{count:14,color:0xbfc8b8,speed:1.8,size:0.1,life:0.7});
    const m=s.mesh;
    tween(0.5,k=>{m.scale.setScalar(Math.max(0.01,1-k));m.rotation.z=1.1*k;}).then(()=>removeUnit(s));
  }
  openExploreUI();
  refreshBossBar();
  if(S.combatGroup.some(g=>g.isBoss))setTimeout(()=>showEnd(true),2000);
  else checkTriggers();
}
function awardXP(n){
  for(const h of aliveHeroes()){
    h.xp+=n;
    while(h.xp>=XP_NEED(h.level)&&h.level<3)levelUp(h);
  }
  log('Отряд получает '+n+' XP.','g-sys');
  sfx.xp();
  refreshParty();refreshTracker();
}
function levelUp(h){
  h.level++;
  if(h.cls==='fighter'){
    h.maxhp+=8;h.hp+=8;
    if(h.level===2){h.str+=1;h.surge=1;
      log(h.name+' — УРОВЕНЬ 2! +8 HP, СИЛ +1, открыто «Доп. действие» (1/бой).','g-sys');}
    else{h.surge=2;
      log(h.name+' — УРОВЕНЬ 3! +8 HP, «Доп. действие» теперь 2/бой.','g-sys');}
  }else{
    h.maxhp+=5;h.hp+=5;
    if(h.level===2){h.int+=1;h.slotsMax=4;h.slots=4;
      log(h.name+' — УРОВЕНЬ 2! +5 HP, ИНТ +1, ячеек заклинаний теперь 4.','g-sys');}
    else{h.slotsMax=5;h.slots=5;
      log(h.name+' — УРОВЕНЬ 3! +5 HP, ячеек заклинаний теперь 5.','g-sys');}
  }
  bigBanner('УРОВЕНЬ '+h.level+'!');
  /* v0.7: фанфары + золотой взрыв */
  sfx.levelUp();
  fx.burstAtMesh(h,{count:40,color:0xffd54f,speed:3,size:0.15,life:1.1,gravity:-1.4});
  glows.flashAtMesh(h,0xffd54f,1.6);
  refreshParty();
}
function showEnd(win){
  const e=$('#end');
  $('#contBtn').style.display=win?'block':'none';
  e.style.display='flex';
  $('#endtitle').textContent=win?'ПОБЕДА!':'ПОРАЖЕНИЕ';
  $('#endtitle').style.color=win?'#d8b45a':'#e06c55';
  const lv=units.find(u=>u.side==='hero');
  if(win){
    const qd=Object.values(QUESTS).filter(q=>q.state==='done').length;
    const total=Object.keys(QUESTS).length;
    const fin=qd>=total?' Долгий Дозор будет помнить вас: тракт свободен — и от гоблинов, и от мертвецов!':'';
    $('#endstats').textContent='Заданий выполнено: '+qd+'/'+total+' • Опыт: '+(lv?lv.xp:0)+' • Золото: '+S.gold+'.'+fin;
  }else{
    $('#endstats').textContent='Отряд пал в бою. Попробуйте иную тактику: огонь, бочки и переговоры.';
  }
}

/* ================= UTILITY-ИИ ГОБЛИНОВ ================= */
function freeSpotNear(c,ring){/* v0.8: свободная клетка вокруг точки */
  for(let r=1;r<=ring;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){
    if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
    const x=c.x+dx,z=c.z+dz;
    if(passable(x,z,null))return{x,z};
  }
  return null;
}
function joinCombat(u){/* v0.8: подкрепление встаёт в очередь инициативы */
  u.init=d(20)+mod(u.dex);
  order.push(u);
  log(u.name+' вступает в бой (инициатива '+u.init+').','g-enemy');
  refreshInit();
}
function planNecro(u){/* v0.8: ИИ некроманта — шквал, дистанция, фаза призыва */
  const heroes=aliveHeroes();
  if(!heroes.length)return null;
  if(!u.phase2&&u.hp<=u.maxhp*0.5)return{type:'phase2'};
  if(u.action>0&&heroes.filter(h=>cheb(u,h)<=1).length>=2)return{type:'nova'};
  if(u.action>0){
    let best=null;
    for(const h of heroes)if(cheb(u,h)<=u.weapon.range){
      const s=evalAttack(u,h)+(h.hp<=h.maxhp*0.4?1.6:0);
      if(!best||s>best.s)best={s,target:h};
    }
    if(best)return{type:'attack',target:best.target};
  }
  if(u.keepDist&&u.moveLeft>=1){
    const close=heroes.some(h=>cheb(u,h)<3);
    if(close){
      const nodes=reachNodes(u,true);
      let best=null;
      const curD=Math.min(...heroes.map(h=>cheb(u,h)));
      for(const node of nodes.values()){
        if(node.g<=0)continue;
        const dmin=Math.min(...heroes.map(h=>cheb(node,h)));
        const s=dmin*0.9-node.g*0.12;
        if(!best||s>best.s)best={s,node};
      }
      if(best&&Math.min(...heroes.map(h=>cheb(best.node,h)))>curD)return{type:'move',path:nodePath(best.node)};
    }
  }
  if(u.moveLeft>=1&&u.action>0){
    const nodes=reachNodes(u,true);
    let best=null;
    for(const node of nodes.values()){
      if(node.g<=0)continue;
      for(const h of heroes){
        const dd=cheb(node,h);
        if(dd>u.weapon.range)continue;
        const s=evalAttack(u,h)-node.g*0.05+(dd>=4?0.8:0);
        if(!best||s>best.s)best={s,node};
      }
    }
    if(best)return{type:'move',path:nodePath(best.node)};
  }
  if(u.bonus>0&&u.action>0)return{type:'dash'};
  return null;
}
function evalAttack(u,h){
  const w=u.weapon;
  const exp=hitChance(u,h,w)*avgDamage(u,w);
  let s=exp*1.15;
  if(exp>=h.hp-0.5)s+=6;
  s+=(1-h.hp/h.maxhp)*2.5;
  return s;
}
function threatened(u){
  return units.some(e=>e.side==='hero'&&e.alive&&cheb(e,u)<=1);
}
function bestFleeNode(u){
  const heroes=units.filter(x=>x.side==='hero'&&x.alive);
  if(!heroes.length)return null;
  const nodes=reachNodes(u,true);
  let best=null;
  for(const node of nodes.values()){
    if(node.g<=0)continue;
    const dmin=Math.min(...heroes.map(h=>cheb(node,h)));
    let s=dmin*1.1-node.g*0.08;
    if(fires.has(key(node.x,node.z)))s-=5;
    if(!best||s>best.s)best={s,node};
  }
  return best?best.node:null;
}
function planGoblin(u){
  const heroes=units.filter(x=>x.side==='hero'&&x.alive);
  if(!heroes.length)return null;
  const gobs=units.filter(x=>x.side==='goblin'&&x.alive);
  if(u.bonus>0&&u.potions>0&&u.hp<u.maxhp*0.45)return{type:'potion'};
  if(u.action>0){
    for(const b of barrels)if(b.alive){
      const near=heroes.filter(h=>Math.hypot(h.x-b.x,h.z-b.z)<=2.4).length;
      const own=gobs.filter(g=>Math.hypot(g.x-b.x,g.z-b.z)<=2.4).length;
      if(near>0&&own===0){
        const inR=u.weapon.melee?cheb(u,b)<=1:cheb(u,b)<=u.weapon.range;
        if(inR)return{type:'attack',target:b};
      }
    }
  }
  if(u.action>0){
    let best=null;
    for(const h of heroes)if(cheb(u,h)<=u.weapon.range){
      const s=evalAttack(u,h);
      if(!best||s>best.s)best={s,target:h};
    }
    if(best)return{type:'attack',target:best.target};
  }
  if(u.keepDist&&u.moveLeft>=1){
    const close=heroes.some(h=>cheb(u,h)<3);
    if(close){
      const nodes=reachNodes(u,true);
      let best=null;
      const curD=Math.min(...heroes.map(h=>cheb(u,h)));
      for(const node of nodes.values()){
        if(node.g<=0)continue;
        const dmin=Math.min(...heroes.map(h=>cheb(node,h)));
        let s=dmin*0.9-node.g*0.12;
        if(fires.has(key(node.x,node.z)))s-=5;
        if(!best||s>best.s)best={s,node};
      }
      if(best&&Math.min(...heroes.map(h=>cheb(best.node,h)))>curD)return{type:'move',path:nodePath(best.node)};
    }
  }
  if(u.action>0&&u.hp<u.maxhp*0.3&&threatened(u)){
    const node=bestFleeNode(u);
    if(node)return{type:'dis',path:nodePath(node)};
  }
  if(u.moveLeft>=1&&u.action>0){
    const nodes=reachNodes(u,true);
    let best=null;
    for(const node of nodes.values()){
      if(node.g<=0)continue;
      for(const h of heroes){
        const dd=cheb(node,h);
        const ok=u.weapon.melee?dd<=1:dd<=u.weapon.range;
        if(!ok)continue;
        let s=evalAttack(u,h)-node.g*0.05;
        if(!u.weapon.melee&&dd>=3&&dd<=6)s+=1.2;
        if(!u.weapon.melee&&dd<2)s-=0.8;
        if(fires.has(key(node.x,node.z)))s-=5;
        if(!best||s>best.s)best={s,node};
      }
    }
    if(best)return{type:'move',path:nodePath(best.node)};
  }
  if(u.bonus>0&&u.action>0)return{type:'dash'};
  return null;
}
async function aiTurn(u){
  await sleep(500);
  let guard=0;
  while(combatOn&&u.alive&&guard++<6){
    const plan=u.bossBrain?planNecro(u):planGoblin(u);/* v0.8: у босса свой мозг */
    if(!plan)break;
    if(plan.type==='phase2'){/* v0.8: подъём мёртвых */
      u.phase2=true;
      bigBanner('ФАЗА 2: ПОДЪЁМ МЁРТВЫХ');
      log('Костепёр: «ВСТАНЬТЕ, МОИ ВЕРНЫЕ КОСТИ!»','g-enemy');
      sfx.bones();
      fx.burstAtMesh(u,{count:44,color:0x9fe8b8,speed:3.2,size:0.15,life:1.2,gravity:-1.1});
      glows.flashAtMesh(u,0x9fe8b8,2.6);
      shake(0.35);
      for(let i=0;i<2;i++){
        const spot=freeSpotNear(u,2);
        if(!spot)break;
        const sk=makeSkeleton(spot.x,spot.z);
        sk.summoned=true;
        joinCombat(sk);
      }
      await sleep(700);continue;
    }
    if(plan.type==='nova'){/* v0.8: костяной шквал */
      u.action--;
      log('КОСТЯНОЙ ШКВАЛ! Костепёр выплёскивает могильную силу вокруг себя!','g-enemy');
      sfx.nova();
      shake(0.4);
      const cx=W(u.x),cz=W(u.z);
      fx.burst(cx,0.7,cz,{count:40,color:0x9fe8b8,speed:4.6,life:0.8,gravity:1.6,spread:0.8});
      fx.burst(cx,0.4,cz,{count:18,color:0x6a8a9f,speed:3.2,life:0.9,gravity:1.2,spread:0.6});
      glows.flash(cx,cz,3.2,0x7fd0a0);
      for(const h of aliveHeroes())if(cheb(u,h)<=1){
        const dmg=roll(2,6);
        ftextAbove(h,'−'+dmg,'#b08fd3');
        log('Костяной шквал бьёт '+h.name+': '+dmg+' некротического урона.','g-enemy');
        damageUnit(h,dmg,u);
      }
      await sleep(500);continue;
    }
    if(plan.type==='potion'){
      u.bonus--;u.potions--;
      healUnit(u,roll(2,4)+2,'зелье');
      await sleep(450);continue;
    }
    if(plan.type==='dis'){
      u.action--;u.disengaging=true;
      log(u.name+' уходит из-под удара!','g-enemy');
      await animateMove(u,plan.path);
      await sleep(300);continue;
    }
    if(plan.type==='move'){
      await animateMove(u,plan.path);
      await sleep(250);continue;
    }
    if(plan.type==='dash'){
      u.bonus--;u.moveLeft+=3;
      log(u.name+' ускоряется!','g-enemy');
      await sleep(300);continue;
    }
    if(plan.type==='attack'){
      u.action--;
      await doAttack(u,plan.target,u.weapon);
      await sleep(350);continue;
    }
  }
  if(combatOn)endTurn();
}
/* ================= ДЕЙСТВИЯ ИГРОКА ================= */
const ACTIONS=[
  {label:'Атака',sub:'Действие',enabled:h=>h.action>0,run:h=>enterTarget('attack')},
  {label:'Огненные стрелы',sub:'Действие',cls:'wiz',only:h=>h.cls==='wizard',enabled:h=>h.action>0,run:h=>enterTarget('bolt')},
  {label:'Огненный шар',sub:'Действие · ячейка',cls:'wiz',only:h=>h.cls==='wizard',enabled:h=>h.action>0&&h.slots>0,run:h=>enterTarget('fireball')},
  {label:'Благословение',sub:'Бонус · ячейка',cls:'wiz',only:h=>h.cls==='wizard',enabled:h=>h.bonus>0&&h.slots>0,run:h=>enterTarget('bless')},
  {label:'Лечащее слово',sub:'Бонус · ячейка',cls:'wiz',only:h=>h.cls==='wizard',enabled:h=>h.bonus>0&&h.slots>0,run:h=>enterTarget('heal')},
  {label:'Второе дыхание',sub:'Бонус · 1/бой',enabled:h=>h.bonus>0&&!h.swUsed,only:h=>h.cls==='fighter',
    run:h=>{h.bonus--;h.swUsed=true;healUnit(h,roll(1,10)+1,'второе дыхание');refreshUI();showReach(h);}},
  {label:'Доп. действие',sub:'1/бой',enabled:h=>(h.surge||0)>0,only:h=>h.cls==='fighter'&&h.level>=2,
    run:h=>{h.surge--;h.action=Math.min(2,h.action+1);log(h.name+': дополнительное действие!','g-sys');refreshUI();}},
  {label:'Рывок',sub:'Бонус · +3 кл.',enabled:h=>h.bonus>0,
    run:h=>{h.bonus--;h.moveLeft+=3;log(h.name+' ускоряется.','g-sys');refreshUI();showReach(h);}},
  {label:'Отход',sub:'Действие',enabled:h=>h.action>0,
    run:h=>{h.action--;h.disengaging=true;log(h.name+' уклоняется от атак по возможности.','g-sys');refreshUI();}},
  {label:'Зелье лечения',sub:'Бонус · 2d4+2',enabled:h=>h.bonus>0&&h.potions>0,
    run:h=>{h.bonus--;h.potions--;healUnit(h,roll(2,4)+2,'зелье');refreshUI();}},
  {label:'Огненное масло',sub:'Действие · бросок',only:h=>(h.oil||0)>0,enabled:h=>h.action>0&&(h.oil||0)>0,
    run:h=>enterTarget('oil')},
  {label:'Завершить ход',sub:'',cls:'end',enabled:()=>true,run:()=>{cancelTargeting();endTurn();}},
];
function enterTarget(type){
  const h=current;
  if(!h||h.side!=='hero'||!h.alive)return;
  if(targeting&&targeting.type===type){cancelTargeting();return;}
  targeting={type};
  clearMarkers();clearDots();
  if(type==='attack'||type==='bolt'){
    const range=type==='attack'?h.weapon.range:9;
    let any=false;
    const cands=[...units.filter(x=>x.side==='goblin'&&x.alive),...barrels.filter(b=>b.alive)];
    for(const e of cands)if(cheb(h,e)<=range){addMarker(e.x,e.z,0xe06c55,0.62);any=true;}
    setHint(type==='attack'
      ?(any?'Выберите цель для атаки (ПКМ / Esc — отмена)':'Вне зоны действия — подойдите ближе!')
      :(any?'Огненные стрелы: выберите цель (ПКМ / Esc — отмена)':'Вне зоны действия!'));
  }else if(type==='fireball'){
    for(let x=1;x<GRID-1;x++)for(let z=1;z<GRID-1;z++){
      if(cheb(h,{x,z})<=RANGE_FB&&passable(x,z,h))addMarker(x,z,0xff9a4d,0.5);
    }
    setHint('Огненный шар: выберите клетку. Осторожно — задевает союзников! (ПКМ — отмена)');
  }else if(type==='oil'){
    for(let x=1;x<GRID-1;x++)for(let z=1;z<GRID-1;z++){
      if(cheb(h,{x,z})<=RANGE_OIL&&passable(x,z,h))addMarker(x,z,0xff9a4d,0.5);
    }
    setHint('Огненное масло: выберите клетку. Осторожно — огонь распространяется! (ПКМ — отмена)');
  }else{
    for(const a of units.filter(x=>x.side==='hero'&&x.alive&&cheb(h,x)<=6))addMarker(a.x,a.z,0xffd54f,0.62);
    setHint(type==='bless'?'Благословение: выберите союзника (ПКМ — отмена)':'Лечащее слово: выберите союзника (ПКМ — отмена)');
  }
}
function cancelTargeting(){
  targeting=null;
  clearMarkers();clearDots();setHint('');
  if(combatOn&&phase==='player'&&current&&current.alive)showReach(current);
}
async function resolveTargetClick(){
  const h=current,t=targeting;
  if(!t||!h)return;
  if(t.type==='attack'||t.type==='bolt'){
    const tgt=pick.ent;
    if(!tgt){setHint('Нужно выбрать цель!');return;}
    const range=t.type==='attack'?h.weapon.range:9;
    if(tgt.side==='hero'){setHint('Это союзник!');return;}
    if(cheb(h,tgt)>range){setHint('Слишком далеко!');return;}
    cancelTargeting();
    if(t.type==='attack')h.action--;else h.action--;
    await doAttack(h,tgt,t.type==='attack'?h.weapon:BOLT);
    refreshUI();showReach(h);
  }else if(t.type==='fireball'){
    if(!pick.tile){setHint('Выберите клетку!');return;}
    if(cheb(h,pick.tile)>RANGE_FB){setHint('Слишком далеко!');return;}
    cancelTargeting();
    h.action--;h.slots--;
    busyOn();
    await castFireball(h,pick.tile.x,pick.tile.z);
    busyOff();
    refreshUI();showReach(h);
  }else if(t.type==='oil'){
    if(!pick.tile){setHint('Выберите клетку!');return;}
    if(cheb(h,pick.tile)>RANGE_OIL){setHint('Слишком далеко!');return;}
    cancelTargeting();
    h.action--;h.oil--;
    log(h.name+' метает огненное масло!','g-fire');
    explode(pick.tile.x,pick.tile.z,{dice:[1,6],radius:1.5});
    refreshUI();showReach(h);
  }else{
    const ally=pick.ent;
    if(!ally||ally.side!=='hero'){setHint('Выберите союзника!');return;}
    if(cheb(h,ally)>6){setHint('Слишком далеко!');return;}
    cancelTargeting();
    h.bonus--;h.slots--;
    if(t.type==='heal')healUnit(ally,roll(1,4)+mod(h.int),'лечащее слово');
    else{
      addStatus(ally,'bless',3);
      ftextAbove(ally,'Благословение','#ffd54f');
    }
    refreshUI();showReach(h);
  }
}
async function tryMove(h,tile){
  if(busy||phase!=='player')return;
  if(h.moveLeft<1){setHint('Перемещение закончилось — завершите ход.');return;}
  if(!passable(tile.x,tile.z,h)){setHint('Клетка занята.');return;}
  const path=astar(h.x,h.z,tile.x,tile.z,h,false);
  if(!path||!path.length){setHint('Туда не пройти.');return;}
  busyOn();clearMarkers();clearDots();setHint('');
  await animateMove(h,path);
  busyOff();
  refreshUI();showReach(h);
}
function onLeftClick(){
  if(phase==='explore'){
    if(busy)return;
    if(pick.inter){pick.inter.fn();return;}
    if(pick.ent&&pick.ent.alive&&pick.ent.side==='goblin'&&!pick.ent.pacified){
      if(S.patrolGroup.includes(pick.ent)&&!S.patrolDone){openDlg('patrol');return;}
      if(S.campGroup.includes(pick.ent)&&!S.campDone){openDlg('boss');return;}
    }
    if(pick.tile)moveParty(pick.tile);
    return;
  }
  if(!combatOn||phase!=='player'||busy||!current||current.side!=='hero')return;
  const h=current;
  if(targeting){resolveTargetClick();return;}
  const tgt=pick.ent;
  if(tgt&&(tgt.side==='goblin'||tgt.isBarrel)){
    if(cheb(h,tgt)<=h.weapon.range&&h.action>0){
      h.action--;
      doAttack(h,tgt,h.weapon).then(()=>{refreshUI();showReach(h);});
      return;
    }
    if(h.action<=0)setHint('Нет действия для атаки.');
    else setHint('Слишком далеко для ближнего боя.');
    return;
  }
  if(pick.tile)tryMove(h,pick.tile);
}

/* ================= v0.6: ЗАДАНИЯ, ДИАЛОГИ, ТОРГОВЛЯ, ИССЛЕДОВАНИЕ ================= */
function aliveHeroes(){return units.filter(u=>u.side==='hero'&&u.alive);}
const QUESTS={
  main:{name:'Кости и пепел',state:'active',
    desc:'Гоблины племени Костей перекрыли торговый тракт. Разгромите их лагерь на севере и убейте вожака.',
    objs:[{k:'boss',t:'Убить вожака Грата Костолома',done:false}]},
  prisoner:{name:'Свободу разведчице',state:'hidden',
    desc:'Западнее гоблинского лагеря в клетке томится Илва — разведчица Долгого Дозора.',
    objs:[{k:'free',t:'Освободить Илву',done:false}]},
  crate:{name:'Похищенный товар',state:'hidden',
    desc:'Гоблины утащили у Дамрока ящик с товаром. Он где-то в их лагере.',
    objs:[{k:'find',t:'Найти ящик в лагере',done:false},{k:'return',t:'Вернуть ящик Дамроку',done:false}]},
  crypt:{name:'Сердце крипты',state:'hidden',/* v0.8 */
    desc:'Мертвецы тракта — не гоблинская работа. Под курганом на северо-востоке открылась крипта, где сидит некромант Вхорил Костепёр и дёргает за ниточки своих костяных кукол.',
    objs:[{k:'enter',t:'Спуститься в крипту',done:false},{k:'boss',t:'Уничтожить Костепёра',done:false}]},
};
const QUEST_REWARD={
  main:'300 XP, 150 зол.',
  prisoner:'150 XP, 100 зол., кулон красноречия',
  crate:'150 XP, 100 зол., вечная скидка',
  crypt:'300 XP, 150 зол., перстень Костепёра',
};
function questActive(id){return QUESTS[id].state==='active';}
function questStart(id){
  const q=QUESTS[id];
  if(q.state!=='hidden')return;
  q.state='active';
  bigBanner('НОВОЕ ЗАДАНИЕ');
  log('Новое задание: «'+q.name+'».','g-sys');
  refreshTracker();
}
function questObj(id,k){
  const q=QUESTS[id];
  if(q.state==='hidden')q.state='active';
  const o=q.objs.find(o=>o.k===k);
  if(o&&!o.done){o.done=true;log('«'+q.name+'»: '+o.t+' — выполнено!','g-heal');refreshTracker();}
}
function questDone(id){
  const q=QUESTS[id];
  if(q.state==='done')return;
  q.state='done';
  if(id==='main'){gainGold(150);awardXP(300);}
  if(id==='prisoner'){
    gainGold(100);awardXP(150);
    const m=aliveHeroes().find(h=>h.cls==='wizard');
    if(m){m.cha+=1;log('Илва дарит кулон красноречия: ХАР '+m.short+' +1.','g-sys');}
  }
  if(id==='crate'){gainGold(100);awardXP(150);S.discount=true;}
  if(id==='crypt'){gainGold(150);awardXP(300);log('Крипта очистилась — мертвецы тракта больше не поднимутся.','g-heal');}
  bigBanner('ЗАДАНИЕ ВЫПОЛНЕНО');
  log('Задание «'+q.name+'» выполнено! Награда: '+QUEST_REWARD[id]+'.','g-heal');
  refreshTracker();refreshParty();
}
function gainGold(n){S.gold+=n;refreshTracker();sfx.gold();}
function refreshTracker(){
  $('#goldTxt').textContent='Золото: '+S.gold+(S.discount?' · скидка 20%':'');
  const el=$('#qbody');el.innerHTML='';
  for(const id in QUESTS){
    const q=QUESTS[id];
    if(q.state!=='active')continue;
    const d=document.createElement('div');
    d.className='q';
    d.innerHTML='<div class="qn">'+q.name+'</div>'+q.objs.map(o=>
      '<div class="qo'+(o.done?' done':'')+'">'+(o.done?'✓':'·')+' '+o.t+'</div>').join('');
    el.appendChild(d);
  }
  if(!el.children.length)el.innerHTML='<div class="qo">Активных заданий нет. Поговорите с Дамроком или идите на север.</div>';
}
function toggleJournal(){const j=$('#journal');if(j.style.display==='block'){closeJournal();return;}renderJournal();j.style.display='block';sfx.ui();}
function closeJournal(){$('#journal').style.display='none';}
function renderJournal(){
  const el=$('#jbody');el.innerHTML='';
  for(const id in QUESTS){
    const q=QUESTS[id];
    if(q.state==='hidden')continue;
    const d=document.createElement('div');
    d.className='jq';
    d.innerHTML='<div class="jn">'+q.name+'<span class="jst'+(q.state==='done'?' done':'')+'">'+
      (q.state==='done'?'выполнено':'активно')+'</span></div>'+
      '<div class="jd">'+q.desc+'</div>'+
      q.objs.map(o=>'<div class="jo'+(o.done?' done':'')+'">'+(o.done?'✓':'○')+' '+o.t+'</div>').join('')+
      '<div class="jr">Награда: '+QUEST_REWARD[id]+'</div>';
    el.appendChild(d);
  }
}

/* ---- диалоги ---- */
function openDlg(npc){
  if(combatOn||phase==='over')return;
  busyOn();phase='dialogue';
  sfx.dialog();
  S.dlgNpc=npc;
  setHint('');
  $('#dlgBox').style.display='block';
  showNode('start');
}
function closeDlg(){
  $('#dlgBox').style.display='none';
  S.dlgNpc=null;
  if(phase==='dialogue'){phase='explore';busyOff();}
  refreshHintExplore();
}
function closeDlgHard(){
  $('#dlgBox').style.display='none';
  S.dlgNpc=null;
  busyCount=Math.max(0,busyCount-1);busy=busyCount>0;
}
function gotoNode(id){showNode(id);}
function socialCheck(req){
  const hs=aliveHeroes();
  const best=hs.reduce((a,b)=>mod(b.cha)>mod(a.cha)?b:a);
  const r=d(20),m=mod(best.cha)+2,tot=r+m;
  const ok=r===20||(r!==1&&tot>=req.dc);
  log('Проверка «'+req.skill+'» СЛ '+req.dc+': d20 '+r+(m>=0?'+':'')+m+' ('+best.short+') = '+tot+' — '+(ok?'УСПЕХ!':'провал.'),ok?'g-heal':'g-enemy');
  return ok;
}
function showNode(id){
  const fn=DLGS[S.dlgNpc];
  const n=fn?fn(id):null;
  if(!n)return closeDlg();
  $('#dlgName').textContent=n.name;
  $('#dlgText').textContent=n.text;
  const box=$('#dlgOpts');box.innerHTML='';
  for(const o of (n.opts||[])){
    if(o.show&&!o.show())continue;
    const b=document.createElement('button');
    b.textContent=o.t;
    if(o.req)b.className='req';
    b.onclick=()=>{
      if(o.req){
        const ok=socialCheck(o.req);
        showNode(ok?(o.ok||'start'):(o.fail||'start'));
        return;
      }
      if(o.end){closeDlg();if(o.fn)o.fn();return;}
      if(o.fn)o.fn();
    };
    box.appendChild(b);
  }
}
const DLGS={
  patrol(id){
    if(id==='start')return{name:'Гоблин-патрульный',
      text:'Стоять! Смердяки с юга?.. Это земля племени Кости! Уходи, пока кишки внутри!',
      opts:[
        {t:'[Запугивание СЛ 13] «У реки мы вырезали ваш дозор. Бежать, пока целы.»',req:{skill:'Запугивание',dc:13},ok:'scared',fail:'fight'},
        {t:'[Убеждение СЛ 15] «Мы торговцы — идём к Грату с дарами. Не мешайте.»',req:{skill:'Убеждение',dc:15},ok:'pass',fail:'fight'},
        {t:'«В атаку, отродья!»',fn:()=>{S.patrolDone=true;startCombat(S.patrolGroup.filter(g=>g.alive));}},
        {t:'«Медленно отойти.»',end:true,fn:()=>{S.patrolDone=true;log('Гоблины провожают вас подозрительными взглядами.','g-sys');}},
      ]};
    if(id==='scared')return{name:'Гоблин-патрульный',text:'Д-демоны!! Отступаем! ОТСТУПАЕМ!!',
      opts:[{t:'(Смотреть, как патруль обращается в бегство)',end:true,fn:()=>{S.patrolDone=true;awardXP(40);fleeUnits(S.patrolGroup);}}]};
    if(id==='pass')return{name:'Гоблин-патрульный',text:'Торговцы, значит?.. Ладно. Ступайте в лагерь, дары Грату. Только не рыпайтесь!',
      opts:[{t:'(Кивнуть и пройти)',end:true,fn:()=>{S.patrolDone=true;S.patrolGroup.forEach(g=>{g.pacified=true;});awardXP(40);log('Патруль вас пропустил.','g-sys');}}]};
    if(id==='fight')return{name:'Гоблин-патрульный',text:'Ложь! Чужакам — смерть!',
      opts:[{t:'«Как знаете.»',fn:()=>{S.patrolDone=true;startCombat(S.patrolGroup.filter(g=>g.alive));}}]};
  },
  boss(id){
    if(id==='start'){
      const opts=[];
      if(S.knowsBoss)opts.push({t:'[Знание Илвы] «Помнишь драконий огонь, что оставил тебе те шрамы, Грат?»',fn:bossFear});
      opts.push(
        {t:'[Запугивание СЛ 16] «Ваш лагерь станет пеплом. Уведите щенков, пока целы.»',req:{skill:'Запугивание',dc:16},ok:'cow',fail:'fight'},
        {t:'«В бой!»',fn:()=>{S.campDone=true;startCombat(S.campGroup.filter(g=>g.alive));}});
      return{name:'Грат Костолом',text:'ХА! Мясо само пришло в котёл! Я — Грат Костолом, и сегодня вы — УЖИН!',opts};
    }
    if(id==='cow')return{name:'Грат Костолом',text:'Ч-что?.. Прочь! УХОДИТЕ! За мной, трусы!',
      opts:[{t:'(Часть гоблинов в панике разбегается)',fn:()=>{S.campDone=true;fleeUnits(S.campGroup.filter(g=>g.alive&&(g.short.startsWith('Лучник')||g.short.startsWith('Задира'))));startCombat(S.campGroup.filter(g=>g.alive));}}]};
    if(id==='fight')return{name:'Грат Костолом',text:'КОСТИ! КОСТИ! КОСТИ!',
      opts:[{t:'«С прискорбием.»',fn:()=>{S.campDone=true;startCombat(S.campGroup.filter(g=>g.alive));}}]};
  },
  damrock(id){
    if(id==='start')return{name:'Дамрок Бочкарь',
      text:'Ох, живые души! Не верю глазам своим. Дамрок я, торговец. Гоблины Костей тракт перекрыли — торчу тут без дела. Чем помогу?',
      opts:[
        {t:'«Покажи товар.»',fn:()=>{closeDlg();openShop();}},
        {t:'«Что случилось?»',show:()=>QUESTS.crate.state==='hidden',fn:()=>gotoNode('story')},
        {t:'«Вот ваш ящик с товаром.»',show:()=>S.hasCrate&&QUESTS.crate.state==='active',fn:()=>gotoNode('cratedone')},
        {t:'[Убеждение СЛ 12] «Героям положена скидка, сам знаешь.»',req:{skill:'Убеждение',dc:12},ok:'discok',fail:'discfail'},
        {t:'«Что известно о крипте в кургане?»',show:()=>QUESTS.main.state==='done'&&QUESTS.crypt.state==='hidden',fn:()=>gotoNode('cryptinfo')},
        {t:'«До встречи.»',end:true},
      ]};
    if(id==='story')return{name:'Дамрок Бочкарь',
      text:'Случилось-то — беда! Ограбили меня вдоль и поперёк: ящик с товаром утащили в свой лагерь, вон там валяется, у шатров. Вернёшь — не обижу!',
      opts:[{t:'«Найду ваш ящик.»',fn:()=>{questStart('crate');gotoNode('start');}}]};
    if(id==='cratedone')return{name:'Дамрок Бочкарь',text:'Мой ящичек! Ай да герои! Держите награду — и скидка вечная, слово Бочкаря!',
      opts:[{t:'«Служим Долгому Дозору.»',end:true,fn:()=>{questObj('crate','return');questDone('crate');}}]};
    if(id==='discok')return{name:'Дамрок Бочкарь',text:'Ладно-ладно, краснобай... Десятина скидки — и не больше!',
      opts:[{t:'«Договорились.»',end:true,fn:()=>{S.discount=true;log('Дамрок даёт отряду скидку 20%.','g-sys');refreshTracker();}}]};
    if(id==='discfail')return{name:'Дамрок Бочкарь',text:'Думешь, красные глазки меня тронули? Плати как все, герой.',
      opts:[{t:'«Жадина.»',end:true}]};
    if(id==='cryptinfo')return{name:'Дамрок Бочкарь',/* v0.8 */
      text:'Крипту? Слушай сюда: как Грат пал — вход вскрылся, северо-восток, ступени под корнями кургана. Мертвецы на тракте — не гоблинская работа, это Костепёр ниточки дёргает. Возьмите огня, света и... не умирайте, а то скидку кому оставлять буду?',
      opts:[{t:'«Зачистим. Держи лавку открытой.»',fn:()=>{questStart('crypt');gotoNode('start');}}]};
  },
  ilva(id){
    if(id==='start')return{name:'Илва (в клетке)',
      text:'Пс! Эй! Вы не из племени Костей? Илва я, разведчица Долгого Дозора. Эти твари поймали меня, пока я следила за их вожаком.',
      opts:[
        {t:'«Кто их вожак?»',fn:()=>gotoNode('bossinfo')},
        {t:'[Взломать замок] «Сейчас освободим!»',fn:()=>{closeDlg();freeIlva();}},
        {t:'«Держись.»',end:true},
      ]};
    if(id==='bossinfo')return{name:'Илва (в клетке)',
      text:'Грат Костолом. Двухметровый отбойник с тесаком. Но есть слабость: однажды он здорово обгорел в пожаре и ПАНИЧЕСКИ боится огня. Шепни ему об этом — и увидишь, как дрогнут его колени.',
      opts:[{t:'«Запомним. Держись, Илва.»',end:true,fn:()=>{if(!S.knowsBoss){S.knowsBoss=true;log('Получены сведения о слабости вожака!','g-sys');}}}]};
  },
  necro(id){/* v0.8: босс крипты */
    if(id==='start')return{name:'Вхорил Костепёр',
      text:'Ах-х... тёплые. ТАКИЕ тёплые гости. Грат был грубым инструментом, а я работаю тонко: одна ниточка за лопатку — и ты уже мой. Останьтесь. НАВСЕГДА.',
      opts:[
        {t:'[Запугивание СЛ 16] «Я сотру твой жезл в пыль, костяной кукловод.»',req:{skill:'Запугивание',dc:16},ok:'brave',fail:'fight'},
        {t:'«Пепел тебе вместо философского камня!»',fn:()=>gotoNode('fight')},
        {t:'«Медленно отойти к лестнице.»',end:true,fn:()=>{log('Костепёр провожает вас смехом, похожим на стрёкот костей.','g-enemy');}},
      ]};
    if(id==='brave')return{name:'Вхорил Костепёр',
      text:'Пыль?.. ПЫЛЬ?! Ну что ж... пусть будет по-вашему. КОСТИ! ПОДНИМАЙТЕСЬ И УБЕЙТЕ ИХ!',
      opts:[{t:'«В бой!»',fn:()=>startCombat(S.cryptGroup.filter(g=>g.alive))}]};
    if(id==='fight')return{name:'Вхорил Костепёр',
      text:'Ха! Философы с мечами. КОСТИ не спорят — КОСТИ ПОВИНУЮТСЯ!',
      opts:[{t:'«В бой!»',fn:()=>startCombat(S.cryptGroup.filter(g=>g.alive))}]};
  },
  necro(id){/* v0.8: босс крипты */
    if(id==='start')return{name:'Вхорил Костепёр',
      text:'Ах-х... тёплые. ТАКИЕ тёплые гости. Грат был грубым инструментом, а я работаю тонко: одна ниточка за лопатку — и ты уже мой. Останьтесь. НАВСЕГДА.',
      opts:[
        {t:'[Запугивание СЛ 16] «Я сотру твой жезл в пыль, костяной кукловод.»',req:{skill:'Запугивание',dc:16},ok:'brave',fail:'fight'},
        {t:'«Пепел тебе вместо философского камня!»',fn:()=>gotoNode('fight')},
        {t:'«Медленно отойти к лестнице.»',end:true,fn:()=>{log('Костепёр провожает вас смехом, похожим на стрёкот костей.','g-enemy');}},
      ]};
    if(id==='brave')return{name:'Вхорил Костепёр',
      text:'Пыль?.. ПЫЛЬ?! Ну что ж... пусть будет по-вашему. КОСТИ! ПОДНИМАЙТЕСЬ И УБЕЙТЕ ИХ!',
      opts:[{t:'«В бой!»',fn:()=>startCombat(S.cryptGroup.filter(g=>g.alive))}]};
    if(id==='fight')return{name:'Вхорил Костепёр',
      text:'Ха! Философы с мечами. КОСТИ не спорят — КОСТИ ПОВИНУЮТСЯ!',
      opts:[{t:'«В бой!»',fn:()=>startCombat(S.cryptGroup.filter(g=>g.alive))}]};
  },
};
function bossFear(){
  const grat=S.campGroup.find(g=>g.isBoss);
  log('Вы напоминаете Грату о старом пожаре — вожак бледнеет и хватается за тесак.','g-sys');
  if(grat&&grat.alive)addStatus(grat,'fear',99);
  fleeUnits(S.campGroup.filter(g=>g.alive&&g.short.startsWith('Задира')));
  S.campDone=true;
  startCombat(S.campGroup.filter(g=>g.alive));
}
function fleeUnits(arr){
  for(const g of arr){
    if(!g.alive)continue;
    log(g.name+' обращается в бегство!','g-sys');
    g.alive=false;
    const m=g.mesh,el=g._el;
    tween(0.45,k=>{m.scale.setScalar(Math.max(0.01,1-k));if(el)el.style.opacity=1-k;})
      .then(()=>removeUnit(g));
  }
}
function removeUnit(u){
  const i=units.indexOf(u);
  if(i>=0)units.splice(i,1);
  scene.remove(u.mesh);
  if(u._el)u._el.remove();
  refreshInit();
}

/* ---- взаимодействие и исследование ---- */
const interactables=[];
function addInteract(x,z,r,label,fn,mesh,talkName,talkDesc){
  const it={x,z,r,label,fn,mesh,talkName,talkDesc};
  if(mesh)mesh.userData.it=it;
  interactables.push(it);
}
function nearestInteract(){
  let best=null,bd=1e9;
  for(const h of aliveHeroes())for(const it of interactables){
    const dd=cheb(h,it);
    if(dd<=it.r&&dd<bd){bd=dd;best=it;}
  }
  return best;
}
async function freeIlva(){
  if(S.ilvaFreed||!S.ilvaMesh)return;
  S.ilvaFreed=true;
  busyOn();
  log('Вы выламываете засов — клетка открыта!','g-sys');
  solid.delete(key(CAGE.x,CAGE.z));
  if(S.cageMesh){S.cageMesh.removeFromParent();S.cageMesh=null;}
  const it=interactables.find(i=>i.mesh===S.ilvaMesh);
  if(it)interactables.splice(interactables.indexOf(it),1);
  if(QUESTS.prisoner.state==='hidden')questStart('prisoner');
  const path=astar(CAGE.x,CAGE.z,13,21,null,false)||[];
  for(const st of path){
    const a=S.ilvaMesh.position.clone(),b=new THREE.Vector3(W(st.x),0,W(st.z));
    await tween(0.11,k=>S.ilvaMesh.position.lerpVectors(a,b,k));
  }
  S.ilvaMesh.removeFromParent();S.ilvaMesh=null;/* v0.8 */
  busyOff();
  log('Илва: «Долг дозору! Загляните к Дамроку — и берегите кулон!»','g-sys');
  questObj('prisoner','free');
  questDone('prisoner');
  refreshHintExplore();
  checkTriggers();
}
function takeCrate(){
  if(S.hasCrate)return;
  S.hasCrate=true;
  S.crateMesh.removeFromParent();S.crateMesh=null;/* v0.8 */
  const it=interactables.find(i=>i.label==='Осмотреть ящик');
  if(it)interactables.splice(interactables.indexOf(it),1);
  if(QUESTS.crate.state==='hidden')questStart('crate');
  questObj('crate','find');
  log('Вы забираете ящик Дамрока. Отнесите его хозяину на юг.','g-sys');
  refreshHintExplore();
}
async function moveParty(tile){
  if(busy||phase!=='explore')return;
  const hs=aliveHeroes();
  if(!hs.length)return;
  busyOn();
  setHint('');
  for(let i=0;i<hs.length;i++){
    const h=hs[i];
    let t=tile;
    if(i>0){
      const offs=[[0,-1],[1,0],[-1,0],[0,1],[1,1],[-1,1],[1,-1],[-1,-1]];
      for(const [dx,dz] of offs){
        const c={x:tile.x+dx,z:tile.z+dz};
        if(passable(c.x,c.z,h)){t=c;break;}
      }
    }
    if(t.x===h.x&&t.z===h.z)continue;
    const p=astar(h.x,h.z,t.x,t.z,h,false);
    if(p&&p.length){h.moveLeft=999;await animateMove(h,p);}
    if(!h.alive)break;
  }
  busyOff();
  refreshHintExplore();
  checkTriggers();
}
function checkTriggers(){
  if(phase!=='explore'||busy||combatOn)return;
  const hs=aliveHeroes();
  if(!hs.length)return;
  if(!S.patrolDone&&S.patrolGroup.some(g=>g.alive)){
    if(hs.some(h=>S.patrolGroup.some(g=>cheb(h,g)<=6))){openDlg('patrol');return;}
  }
  if(!S.campDone&&S.campGroup.some(g=>g.alive)){
    if(hs.some(h=>S.campGroup.some(g=>cheb(h,g)<=7))){openDlg('boss');return;}
  }
  if(!S.cageSeen&&!S.ilvaFreed&&hs.some(h=>cheb(h,{x:CAGE.x,z:CAGE.z})<=6)){
    S.cageSeen=true;
    questStart('prisoner');
    log('В клетке у тропы кто-то шевелится…','g-sys');
  }
  if(mapId==='crypt'&&S.cryptGroup.some(g=>g.alive&&g.cryptBoss)){/* v0.8: триггер босса крипты */
    if(hs.some(h=>S.cryptGroup.some(g=>cheb(h,g)<=7))){openDlg('necro');return;}
  }
  refreshHintExplore();
}
function refreshHintExplore(){
  if(phase!=='explore'){setHint('');return;}
  const it=nearestInteract();
  setHint(it?('E — '+it.label):'');
}
setInterval(checkTriggers,700);

/* ---- магазин ---- */
const SHOP=[
  {n:'Зелье лечения',p:25,d:'Бонусное действие в бою: +2d4+2 HP.',t:'potion'},
  {n:'Огненное масло',p:40,d:'Действие в бою: бросок — 1d6 огня в радиусе 1.5 кл., трава вспыхивает.',t:'oil'},
  {n:'Щит',p:60,d:'+2 КД владельцу.',t:'ac',v:2},
  {n:'Амулет дракончика',p:120,d:'+1 КД владельцу.',t:'ac',v:1},
  {n:'Короткий лук',p:60,d:'Оружие: 1d6+ЛОВ, дальность 8 кл.',t:'weapon',w:{name:'Короткий лук',dice:[1,6],abil:'dex',range:8}},
  {n:'Кольчуга',p:150,d:'Доспех: КД 16 (Торику уже знакома, Мирелле даст КД 14).',t:'armor'},
  {n:'Кулон красноречия',p:100,d:'+1 ХАР владельцу — проверки убеждения легче.',t:'cha',v:1},
];
const price=it=>S.discount?Math.floor(it.p*0.8):it.p;
function openShop(){renderShop();$('#shop').style.display='block';sfx.dialog();}
function closeShop(){$('#shop').style.display='none';}
function renderShop(){
  const el=$('#shopList');el.innerHTML='';
  for(const it of SHOP){
    const row=document.createElement('div');row.className='sitem';
    row.innerHTML='<div><div class="sn">'+it.n+'</div><div class="sd">'+it.d+'</div></div>'+
      '<div class="sp">'+price(it)+' зол.</div>';
    const b=document.createElement('button');
    b.textContent='Купить';
    b.disabled=S.gold<price(it);
    b.onclick=()=>chooseHero('Кому: '+it.n+'?',h=>applyItem(it,h));
    row.appendChild(b);
    el.appendChild(row);
  }
}
function chooseHero(title,cb){
  $('#choiceTitle').textContent=title;
  const el=$('#choiceList');el.innerHTML='';
  for(const h of aliveHeroes()){
    const b=document.createElement('button');
    b.textContent=h.name+' — '+h.clsName+' (КД '+h.ac+')';
    b.onclick=()=>{closeChoice();cb(h);};
    el.appendChild(b);
  }
  $('#choice').style.display='block';
}
function closeChoice(){$('#choice').style.display='none';}
function applyItem(it,h){
  S.gold-=price(it);
  if(it.t==='potion')h.potions++;
  else if(it.t==='oil')h.oil=(h.oil||0)+1;
  else if(it.t==='ac')h.ac+=it.v;
  else if(it.t==='weapon')h.weapon={name:it.w.name,dice:it.w.dice,abil:it.w.abil,range:it.w.range};
  else if(it.t==='armor'){h.ac=h.cls==='fighter'?16:14;h.armor='Кольчуга';}
  else if(it.t==='cha')h.cha+=it.v;
  log('Куплено: '+it.n+' → '+h.short+' (−'+price(it)+' зол.).','g-sys');
  refreshTracker();refreshParty();renderShop();
}
$('#shopClose').onclick=closeShop;
$('#jClose').onclick=closeJournal;
$('#choiceCancel').onclick=closeChoice;
$('#contBtn').onclick=()=>{$('#end').style.display='none';};
function openExploreUI(){
  $('#actionbar').style.display='none';
  $('#turnb').textContent='';
  $('#round').textContent=MAP_NAME[mapId];/* v0.8 */
  refreshInit();refreshTracker();
  refreshHintExplore();
}

/* ================= UI ================= */
function refreshUI(){
  if(phase==='explore'||phase==='dialogue')return;
  const h=current&&current.side==='hero'?current:null;
  if(h){
    $('#pips').innerHTML=
      '<span>Действие <b>'+h.action+'</b></span>'+
      '<span>Бонус <b>'+h.bonus+'</b></span>'+
      '<span>Реакция <b>'+h.reaction+'</b></span>'+
      '<span>Перемещение <b>'+h.moveLeft+'</b> кл.</span>'+
      '<span>Ячейки <b>'+(h.slotsMax?h.slots+'\/'+h.slotsMax:'—')+'</b></span>';
  }else{
    $('#pips').innerHTML='<span>Ход противника…</span>';
  }
  const bb=$('#btns');
  bb.innerHTML='';
  if(!h){
    bb.innerHTML='<button disabled>Ожидание…</button>';
    return;
  }
  for(const a of ACTIONS){
    if(a.only&&!a.only(h))continue;
    const b=document.createElement('button');
    b.textContent=a.label+(a.sub?' · '+a.sub:'');
    if(a.cls)b.className=a.cls;
    b.disabled=!a.enabled(h)||phase!=='player';
    b.onclick=()=>{if(phase==='player'&&!busy)a.run(h);};
    bb.appendChild(b);
  }
  refreshParty();
}
function refreshParty(){
  const el=$('#party');
  el.innerHTML='';
  for(const h of units.filter(u=>u.side==='hero')){
    const card=document.createElement('div');
    card.className='panel pcard'+(current===h&&h.alive?' active':'');
    const st=h.statuses.map(s=>
      '<span class="stb" style="background:'+STATUS[s.type].css+'">'+STATUS[s.type].tag+s.turns+'</span>').join('');
    const need=XP_NEED(h.level);
    card.innerHTML=
      '<div class="prow"><span class="pname">'+h.name+'</span><span class="pcls">'+h.clsName+' · ур. '+h.level+'</span></div>'+
      '<div class="pbar"><i style="width:'+Math.max(0,h.hp/h.maxhp*100)+'%"></i></div>'+
      '<div class="pinfo"><span>HP '+Math.max(0,h.hp)+'/'+h.maxhp+' • КД '+h.ac+'</span><span>Зелий: '+h.potions+'</span></div>'+
      '<div class="pst">'+st+'<span style="color:#8f866d;margin-left:auto">XP '+h.xp+'/'+need+'</span></div>';
    card.onclick=()=>showSheet(h);
    el.appendChild(card);
  }
}
/* v0.8: боссбар сверху экрана */
function refreshBossBar(){
  const el=$('#bossbar');
  if(!el)return;
  const b=combatOn?S.combatGroup.find(g=>g.isBoss&&g.alive):null;
  if(!b){el.style.display='none';return;}
  el.style.display='block';
  $('#bossname').textContent=b.name+' — '+b.clsName;
  $('#bossfill').style.width=Math.max(0,b.hp/b.maxhp*100)+'%';
}
function refreshInit(){
  refreshBossBar();
  const el=$('#initRow');
  if(!combatOn){el.innerHTML='';return;}
  el.innerHTML=order.map(u=>
    '<span class="chip '+u.side+' '+(u===current?'cur ':'')+(!u.alive?'dead':'')+'">'+u.short+' '+u.init+'</span>').join('');
}
function showSheet(h){
  const ab=(l,v)=>{
    const m=mod(v);
    return '<div class="ab"><span>'+l+'</span><b>'+v+'</b><i>'+(m>=0?'+':'')+m+'</i></div>';
  };
  const w=h.weapon,wm=mod(h[w.abil]);
  const need=XP_NEED(h.level);
  let spells='';
  if(h.cls==='wizard'){
    spells='<p>Ячейки заклинаний: <b>'+h.slots+'/'+h.slotsMax+'</b></p>'+
      '<p>• Огненные стрелы — 1d10+'+mod(h.int)+' огонь (действие)</p>'+
      '<p>• Огненный шар — 3d6 огонь, радиус 2.5 кл. (действие+ячейка)</p>'+
      '<p>• Лечащее слово — 1d4+'+mod(h.int)+' (бонус+ячейка)</p>'+
      '<p>• Благословение — +1d4 к атакам, 3 хода (бонус+ячейка)</p>';
  }
  $('#sheetbox').innerHTML=
    '<h2>'+h.name+'</h2>'+
    '<div class="sub">Человек · '+h.clsName+' · уровень '+h.level+'</div>'+
    '<div class="srow">'+
      '<div><span>КД</span><b>'+h.ac+'</b></div>'+
      '<div><span>Хиты</span><b>'+Math.max(0,h.hp)+'/'+h.maxhp+'</b></div>'+
      '<div><span>Скорость</span><b>'+h.speed+' кл.</b></div>'+
      '<div><span>Иниц.</span><b>'+(mod(h.dex)>=0?'+':'')+mod(h.dex)+'</b></div>'+
    '</div>'+
    '<div class="abgrid">'+
      ab('СИЛ',h.str)+ab('ЛОВ',h.dex)+ab('ТЕЛ',h.con)+ab('ИНТ',h.int)+ab('МДР',h.wis)+ab('ХАР',h.cha)+
    '</div>'+
    '<h3>Снаряжение</h3>'+
    '<p>Оружие: <b>'+w.name+'</b> — '+w.dice[0]+'d'+w.dice[1]+(wm>=0?'+':'')+wm+', '+(w.melee?'ближний бой':'дальность '+w.range+' кл.')+'</p>'+
    '<p>Доспех: <b>'+h.armor+'</b> (КД '+h.ac+')</p>'+
    '<p>Зелья лечения: '+h.potions+' — 2d4+2 (бонусное действие)</p>'+
    (h.cls==='wizard'?spells:'')+
    '<h3>Умения</h3>'+
    h.features.map(f=>'<p>• '+f+'</p>').join('')+
    '<div class="pbar" style="margin-top:10px"><i style="width:'+Math.min(100,h.xp/need*100)+'%"></i></div>'+
    '<p style="margin-top:3px">Опыт: '+h.xp+' / '+need+'</p>';
  $('#sheet').style.display='flex';
}
$('#sheet').addEventListener('click',e=>{if(e.target.id==='sheet')$('#sheet').style.display='none';});

/* ================= v1.1: СОХРАНЕНИЯ (3 слота + экспорт/импорт JSON) =================
   Слоты живут в localStorage (bg3w_slot_1..3), формат — обычный JSON, поэтому
   экспорт/импорт — это просто скачивание файла и обратная запись в слот. */
const SAVE_VER=2,SLOT_N=3;
const slotKey=i=>'bg3w_slot_'+i;
let savesFromEnd=false,importSlot=1;
function gameSnapshot(){
  return {
    v:SAVE_VER,when:Date.now(),
    mapId,mapName:MAP_NAME[mapId],
    gold:S.gold,discount:!!S.discount,
    flags:{
      patrolDone:!!S.patrolDone,campDone:!!S.campDone,cageSeen:!!S.cageSeen,knowsBoss:!!S.knowsBoss,
      hasCrate:!!S.hasCrate,ilvaFreed:!!S.ilvaFreed,chestLooted:!!S.chestLooted,necroSlain:!!S.necroSlain,
    },
    barrelsUsed:[...S.barrelsUsed],
    quests:Object.fromEntries(Object.entries(QUESTS).map(([id,q])=>[id,{state:q.state,objs:q.objs.map(o=>!!o.done)}])),
    heroes:units.filter(u=>u.side==='hero').map(h=>({
      cls:h.cls,level:h.level,xp:h.xp,hp:h.hp,maxhp:h.maxhp,ac:h.ac,
      str:h.str,dex:h.dex,con:h.con,int:h.int,wis:h.wis,cha:h.cha,
      slotsMax:h.slotsMax||0,potions:h.potions,oil:h.oil||0,armor:h.armor,
      weapon:h.weapon?{name:h.weapon.name,dice:h.weapon.dice,abil:h.weapon.abil,range:h.weapon.range,melee:!!h.weapon.melee}:null,
      x:h.x,z:h.z,
    })),
  };
}
function slotMeta(sv){
  const lv=sv.heroes&&sv.heroes.length?Math.max(...sv.heroes.map(h=>h.level||1)):1;
  return (sv.mapName||MAP_NAME[sv.mapId]||'?')+' · ур. '+lv+' · '+(sv.gold||0)+' зол. · '+new Date(sv.when).toLocaleString('ru-RU');
}
function readSlot(i){
  try{const raw=localStorage.getItem(slotKey(i));return raw?JSON.parse(raw):null;}
  catch(e){return null;}
}
function doSave(i){
  if(combatOn||busy||phase==='transition'||phase==='over'){
    log('Сейчас нельзя сохранять: идёт бой, переход или экран поражения.','g-enemy');sfx.ui();return;
  }
  try{localStorage.setItem(slotKey(i),JSON.stringify(gameSnapshot()));}
  catch(e){log('Не удалось сохранить — хранилище браузера недоступно.','g-enemy');return;}
  log('Игра сохранена в слот '+i+'.','g-heal');sfx.ui();renderSaves();
}
function doLoad(i){
  const sv=readSlot(i);
  if(!sv){log('Слот '+i+' пуст — сохраняйте через «Сохранить» или импортируйте JSON.','g-enemy');sfx.ui();return;}
  if(phase==='transition'){log('Идёт переход между картами — подождите секунду.','g-enemy');return;}
  if(busy){log('Дождитесь конца текущего действия.','g-enemy');return;}
  applyGame(sv);
}
function doDelete(i){
  localStorage.removeItem(slotKey(i));
  log('Слот '+i+' очищен.','g-sys');sfx.ui();renderSaves();
}
function doExport(i){
  const sv=readSlot(i);
  if(!sv){log('Слот '+i+' пуст — нечего экспортировать.','g-enemy');sfx.ui();return;}
  const blob=new Blob([JSON.stringify(sv,null,1)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='bg3web_save_slot'+i+'_'+new Date(sv.when).toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  log('Сейв слота '+i+' выгружен в JSON-файл.','g-sys');sfx.ui();
}
function doImport(i){importSlot=i;$('#importFile').click();}
function onImportFile(e){
  const file=e.target.files&&e.target.files[0];
  e.target.value='';
  if(!file)return;
  file.text().then(txt=>{
    let sv=null;
    try{sv=JSON.parse(txt);}catch(err){}
    if(!sv||sv.v!==SAVE_VER||!Array.isArray(sv.heroes)||!MAP_NAME[sv.mapId]){
      log('Это не файл сохранения «Врат Бальдура» (нужен JSON формата v'+SAVE_VER+').','g-enemy');return;
    }
    try{localStorage.setItem(slotKey(importSlot),JSON.stringify(sv));}
    catch(err){log('Ошибка записи в слот '+importSlot+'.','g-enemy');return;}
    log('JSON импортирован в слот '+importSlot+': '+slotMeta(sv),'g-heal');
    renderSaves();sfx.ui();
  });
}
function applyGame(sv){
  if(!sv||sv.v!==SAVE_VER||!Array.isArray(sv.heroes)){log('Сейв повреждён или от другой версии.','g-enemy');return;}
  if(phase==='transition'){log('Идёт переход между картами — подождите.','g-enemy');return;}
  if(S.dlgNpc)closeDlgHard();
  closeJournal();closeShop();closeChoice();closeGfx();closeSaveMenu();
  $('#sheet').style.display='none';$('#end').style.display='none';
  S.gold=sv.gold||0;S.discount=!!sv.discount;
  const fl=sv.flags||{};
  S.patrolDone=!!fl.patrolDone;S.campDone=!!fl.campDone;S.cageSeen=!!fl.cageSeen;S.knowsBoss=!!fl.knowsBoss;
  S.hasCrate=!!fl.hasCrate;S.ilvaFreed=!!fl.ilvaFreed;S.chestLooted=!!fl.chestLooted;S.necroSlain=!!fl.necroSlain;
  S.barrelsUsed=new Set(sv.barrelsUsed||[]);
  for(const id in QUESTS){
    const svq=sv.quests&&sv.quests[id];
    const q=QUESTS[id];
    if(!svq){q.state=id==='main'?'active':'hidden';q.objs.forEach(o=>{o.done=false;});continue;}
    q.state=svq.state||'hidden';
    q.objs.forEach((o,i)=>{o.done=!!(svq.objs&&svq.objs[i]);});
  }
  cancelTargeting();
  teardownWorld();
  buildMap(sv.mapId==='crypt'?'crypt':'forest',null);
  for(const hd of sv.heroes){
    const h=units.find(u=>u.side==='hero'&&u.cls===hd.cls);
    if(!h)continue;
    h.level=hd.level||1;h.xp=hd.xp||0;
    h.maxhp=hd.maxhp||h.maxhp;h.hp=clamp(hd.hp||1,1,h.maxhp);
    h.ac=hd.ac||h.ac;
    ['str','dex','con','int','wis','cha'].forEach(a=>{if(typeof hd[a]==='number')h[a]=hd[a];});
    h.slotsMax=hd.slotsMax||0;h.slots=h.slotsMax;
    h.potions=hd.potions||0;h.oil=hd.oil||0;h.armor=hd.armor||h.armor;
    if(hd.weapon&&hd.weapon.dice)h.weapon={name:hd.weapon.name,dice:hd.weapon.dice,abil:hd.weapon.abil,range:hd.weapon.range,melee:!!hd.weapon.melee};
    h.statuses=[];h.swUsed=false;h.surge=0;
    if(typeof hd.x==='number'&&typeof hd.z==='number'){
      h.x=hd.x;h.z=hd.z;
      h.mesh.position.set(W(h.x),0,W(h.z));h.mesh.rotation.set(0,0,0);
    }
  }
  openExploreUI();
  refreshParty();refreshBossBar();refreshHintExplore();refreshTracker();
  bigBanner('ИГРА ЗАГРУЖЕНА');
  log('Отряд приходит в себя: '+MAP_NAME[mapId]+'. Прогресс восстановлен из сейва.','g-heal');
  sfx.ui();
}
function renderSaves(){
  const el=$('#saveList');if(!el)return;
  el.innerHTML='';
  const hs=units.filter(u=>u.side==='hero');
  $('#curSave').textContent='Текущая игра: '+MAP_NAME[mapId]+' · ур. '+Math.max(1,...hs.map(h=>h.level))+' · '+S.gold+' зол.';
  for(let i=1;i<=SLOT_N;i++){
    const sv=readSlot(i);
    const row=document.createElement('div');row.className='slot';
    row.innerHTML='<div class="smeta">Слот '+i+(sv?'':' — пуст')+'</div>'+
      '<div class="ssub">'+(sv?slotMeta(sv):'Нет данных. Сохраните игру или импортируйте JSON-файл.')+'</div>';
    const btns=document.createElement('div');btns.className='sbtns';
    const mk=(t,fn,dis,danger)=>{
      const b=document.createElement('button');b.textContent=t;b.disabled=!!dis;
      if(danger)b.className='danger';
      b.onclick=fn;btns.appendChild(b);
    };
    mk('Сохранить',()=>doSave(i));
    mk('Загрузить',()=>doLoad(i),!sv);
    mk('Экспорт JSON',()=>doExport(i),!sv);
    mk('Импорт JSON',()=>doImport(i));
    mk('Удалить',()=>doDelete(i),!sv,true);
    row.appendChild(btns);
    el.appendChild(row);
  }
}
function openSaveMenu(fromEnd){
  savesFromEnd=!!fromEnd;
  renderSaves();
  $('#saves').style.display='block';
  sfx.ui();
}
function closeSaveMenu(){
  $('#saves').style.display='none';
  if(savesFromEnd){
    savesFromEnd=false;
    if(phase==='over')$('#end').style.display='flex';/* вернулись на экран поражения */
  }
}
function toggleSaveMenu(){
  if($('#saves').style.display==='block')closeSaveMenu();
  else openSaveMenu(false);
}
$('#savesClose').onclick=closeSaveMenu;
$('#importFile').addEventListener('change',onImportFile);
$('#loadBtn2').onclick=()=>{$('#end').style.display='none';openSaveMenu(true);};

/* ================= v1.1: НАСТРОЙКИ ГРАФИКИ =================
   Тени / bloom / glow-хала / плотность частиц / разрешение / лимит FPS.
   Всё применяется на живую и хранится в localStorage (bg3w_gfx_v1). */
const GFX_KEY='bg3w_gfx_v1';
const gfx={shadows:'high',bloom:true,glow:true,particles:'high',res:'100',fps:'max'};
let bloomOn=true,fpsLimit=0,frameAcc=0;
function loadGfx(){try{const raw=localStorage.getItem(GFX_KEY);if(raw)Object.assign(gfx,JSON.parse(raw));}catch(e){}}
function applyShadows(){
  const q=gfx.shadows;
  renderer.shadowMap.enabled=(q!=='off');
  if(sunLight){
    sunLight.castShadow=(q!=='off');
    const size=q==='high'?2048:1024;
    if(sunLight.shadow.mapSize.x!==size){
      sunLight.shadow.mapSize.set(size,size);
      if(sunLight.shadow.map){sunLight.shadow.map.dispose();sunLight.shadow.map=null;}
    }
  }
}
function applyGfx(){
  applyShadows();
  bloomOn=!!gfx.bloom;
  glows.setEnabled(!!gfx.glow);
  fx.density=gfx.particles==='low'?0.4:(gfx.particles==='mid'?0.7:1);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2)*(gfx.res==='50'?0.5:(gfx.res==='75'?0.75:1)));
  fpsLimit=gfx.fps==='30'?30:(gfx.fps==='60'?60:0);
  frameAcc=0;
  try{localStorage.setItem(GFX_KEY,JSON.stringify(gfx));}catch(e){}
}
const GFX_PRESETS={
  low:{shadows:'off',bloom:false,glow:false,particles:'low',res:'75',fps:'60'},
  mid:{shadows:'low',bloom:true,glow:true,particles:'mid',res:'100',fps:'60'},
  high:{shadows:'high',bloom:true,glow:true,particles:'high',res:'100',fps:'max'},
};
const GFX_ROWS=[
  {k:'shadows',label:'Тени',opts:[['off','Выкл'],['low','Низк.'],['high','Выс.']]},
  {k:'bloom',label:'Bloom-пасс',bool:true,opts:[['1','Вкл'],['0','Выкл']]},
  {k:'glow',label:'Glow-хала',bool:true,opts:[['1','Вкл'],['0','Выкл']]},
  {k:'particles',label:'Частицы',opts:[['low','Мало'],['mid','Средне'],['high','Много']]},
  {k:'res',label:'Разрешение',opts:[['50','50%'],['75','75%'],['100','100%']]},
  {k:'fps',label:'Лимит FPS',opts:[['30','30'],['60','60'],['max','Макс']]},
];
function renderGfx(){
  const el=$('#gfxBody');if(!el)return;
  el.innerHTML='';
  const pl=document.createElement('div');
  pl.style.cssText='font-size:11px;color:#a89f86;margin:2px 0 3px';
  pl.textContent='Пресет качества:';
  el.appendChild(pl);
  const pre=document.createElement('div');pre.className='gpre';
  for(const [k,n] of [['low','Низкий'],['mid','Средний'],['high','Высокий']]){
    const b=document.createElement('button');b.textContent=n;
    b.onclick=()=>{Object.assign(gfx,GFX_PRESETS[k]);applyGfx();renderGfx();sfx.ui();};
    pre.appendChild(b);
  }
  el.appendChild(pre);
  for(const r of GFX_ROWS){
    const row=document.createElement('div');row.className='grow';
    const lab=document.createElement('span');lab.className='gl';lab.textContent=r.label;
    const seg=document.createElement('div');seg.className='seg';
    for(const [val,name] of r.opts){
      const b=document.createElement('button');b.textContent=name;
      const setVal=r.bool?(val==='1'):val;
      const active=r.bool?(!!gfx[r.k]===setVal):String(gfx[r.k])===val;
      if(active)b.classList.add('on');
      b.onclick=()=>{gfx[r.k]=setVal;applyGfx();renderGfx();sfx.ui();};
      seg.appendChild(b);
    }
    row.appendChild(lab);row.appendChild(seg);
    el.appendChild(row);
  }
}
function openGfx(){renderGfx();$('#gfx').style.display='block';sfx.ui();}
function closeGfx(){$('#gfx').style.display='none';}
function toggleGfx(){
  if($('#gfx').style.display==='block')closeGfx();
  else openGfx();
}
$('#gfxClose').onclick=closeGfx;

/* ================= ВВОД ================= */
const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();
let downPos=null;
function castRay(e){
  ptr.x=(e.clientX/innerWidth)*2-1;
  ptr.y=-(e.clientY/innerHeight)*2+1;
  ray.setFromCamera(ptr,camera);
}
function updatePick(e){
  pick.tile=null;pick.ent=null;pick.inter=null;
  if(busy||(phase!=='player'&&phase!=='explore')){showTipFor(null,e);return;}
  castRay(e);
  const ents=[...units.filter(u=>u.alive),...barrels.filter(b=>b.alive)];
  const hits=ray.intersectObjects(ents.map(u=>u.mesh),true);
  if(hits.length){
    let o=hits[0].object;
    while(o&&!o.userData.ent)o=o.parent;
    if(o)pick.ent=o.userData.ent;
  }
  if(!pick.ent&&phase==='explore'){
    const ims=interactables.filter(it=>it.mesh).map(it=>it.mesh);
    const ih=ray.intersectObjects(ims,true);
    if(ih.length){
      let o=ih[0].object;
      while(o&&!o.userData.it)o=o.parent;
      if(o)pick.inter=o.userData.it;
    }
  }
  if(!pick.ent&&!pick.inter){
    const gh=ray.intersectObject(groundMesh,false);
    if(gh.length){
      const p=gh[0].point;
      pick.tile={x:clamp(Math.round(p.x/TILE+HALF),0,GRID-1),z:clamp(Math.round(p.z/TILE+HALF),0,GRID-1)};
    }
  }
  updateHoverFX(e);
}
function updateHoverFX(e){
  const cv=renderer.domElement;
  if(targeting){
    clearDots();
    showTipFor(pick.ent||null,e);
    cv.style.cursor='crosshair';
    return;
  }
  showTipFor(pick.ent||pick.inter||null,e);
  cv.style.cursor=(pick.ent||pick.inter)?'pointer':'default';
  clearDots();
  if(phase==='player'&&pick.tile&&current&&current.side==='hero'&&!busy&&current.moveLeft>=1&&passable(pick.tile.x,pick.tile.z,current)){
    const path=astar(current.x,current.z,pick.tile.x,pick.tile.z,current,false);
    if(path&&path.length){
      let acc=0,px=current.x,pz=current.z;
      for(const st of path){
        acc+=(st.x!==px&&st.z!==pz)?1.5:1;
        px=st.x;pz=st.z;
        addDot(st.x,st.z,acc<=current.moveLeft+1e-9);
      }
    }
  }
}
function showTipFor(ent,e){
  const tip=$('#tip');
  if(!ent){tip.style.display='none';return;}
  let html='';
  if(ent.talkName){
    html='<b>'+ent.talkName+'</b><br>'+ent.talkDesc;
    if(phase==='explore')html+='<br><span class="tc">E или клик — взаимодействовать</span>';
  }else if(ent.isBarrel){
    html='<b>'+(ent.name||'Взрывная бочка')+'</b><br>Детонирует от любого удара: 3d6 огня в радиусе 2.5 кл. Не любит огонь!';
  }else{
    html='<b>'+ent.name+'</b><br>HP: '+ent.hp+'/'+ent.maxhp+' • КД '+ent.ac;
    if(ent.statuses&&ent.statuses.length)html+='<br>Статусы: '+ent.statuses.map(s=>STATUS[s.type].name).join(', ');
    if(targeting&&(targeting.type==='attack'||targeting.type==='bolt')&&ent.side==='goblin'&&current){
      const w=targeting.type==='attack'?current.weapon:BOLT;
      const ch=Math.round(hitChance(current,ent,w)*100);
      html+='<br><span class="tc">Попадание ~'+ch+'% • урон ~'+avgDamage(current,w).toFixed(1)+' • крит 5%</span>';
    }
  }
  tip.innerHTML=html;
  tip.style.display='block';
  tip.style.left=Math.min(innerWidth-260,e.clientX+14)+'px';
  tip.style.top=Math.min(innerHeight-90,e.clientY+12)+'px';
}
function bindInput(){
  const el=renderer.domElement;
  el.addEventListener('pointerdown',e=>{sfx.unlock();downPos={x:e.clientX,y:e.clientY,b:e.button};});
  el.addEventListener('pointerup',e=>{
    if(!downPos)return;
    const dx=e.clientX-downPos.x,dy=e.clientY-downPos.y;
    const btn=downPos.b;downPos=null;
    if(btn===2){cancelTargeting();return;}
    if(btn===0&&dx*dx+dy*dy<49){updatePick(e);onLeftClick();}
  });
  el.addEventListener('pointermove',updatePick);
  el.addEventListener('contextmenu',e=>e.preventDefault());
  const onKey=e=>{
    sfx.unlock();
    if(e.key==='Escape'){cancelTargeting();$('#sheet').style.display='none';closeJournal();closeShop();closeChoice();closeGfx();closeSaveMenu();}
    if(e.key==='e'||e.key==='E'||e.key==='у'||e.key==='У'){
      if(phase==='explore'&&!busy){const it=nearestInteract();if(it)it.fn();}
    }
    if(e.key==='j'||e.key==='J'||e.key==='о'||e.key==='О'){toggleJournal();}
    if(e.key==='k'||e.key==='K'||e.key==='л'||e.key==='Л'){if(phase!=='transition')toggleSaveMenu();}/* v1.1 */
    if(e.key==='g'||e.key==='G'||e.key==='п'||e.key==='П'){toggleGfx();}/* v1.1 */
  };
  addEventListener('keydown',onKey);
  const onResize=()=>{
    camera.aspect=innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  };
  addEventListener('resize',onResize);
  disposers.push(()=>removeEventListener('keydown',onKey));
  disposers.push(()=>removeEventListener('resize',onResize));
}

/* ================= ЦИКЛ ================= */
const clock=new THREE.Clock();
function loop(){
  const rdt=Math.min(clock.getDelta(),0.05),t=clock.elapsedTime;
  /* v1.1: лимит FPS — пропускаем кадры сверх лимита */
  if(fpsLimit>0){frameAcc+=rdt;if(frameAcc+1e-4<0.98/fpsLimit)return;frameAcc=0;}
  slowmo.update(rdt);
  const dt=rdt*slowmo.scale;
  for(let i=tweens.length-1;i>=0;i--){
    const tw=tweens[i];
    tw.t+=dt;
    const k=Math.min(1,tw.t/tw.dur);
    tw.fn(k);
    if(k>=1){tweens.splice(i,1);tw.res();}
  }
  controls.update();
  if(fireLight)fireLight.intensity=22+Math.sin(t*11)*4+Math.sin(t*23.7)*2.5;
  if(flameMesh){flameMesh.scale.y=1+Math.sin(t*13)*0.18;flameMesh.rotation.y+=dt*2;}
  for(const f of fires.values()){
    f.m1.material.opacity=0.4+0.18*Math.sin(t*6+f.x*1.3);
    f.m2.material.opacity=0.35+0.2*Math.sin(t*9+f.z);
    f.m2.scale.setScalar(0.5+0.12*Math.sin(t*8+f.x));
  }
  if(shakeT>0){
    shakeT=Math.max(0,shakeT-dt);
    const s=shakeT*0.4;
    scene.position.set((Math.random()-0.5)*s,(Math.random()-0.5)*s*0.6,(Math.random()-0.5)*s);
  }else scene.position.set(0,0,0);
  fx.update(dt);
  glows.update(dt,t);
  rigs.update(dt,t);
  updateOverlays();
  if(postFX&&bloomOn)postFX.render();else renderer.render(scene,camera);/* v1.1: bloom отключаемый */
}

/* ================= СТАРТ ================= */
const disposers=[];
let disposed=false;
(async()=>{
  try{
    console.log('[bg3] init: start');
    await renderer.init();
    console.log('[bg3] init: done, backend=',renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL2');
  }catch(err){
    console.error('[bg3] renderer.init() failed:',err);
    document.body.insertAdjacentHTML('beforeend',
      '<div class="panel" style="top:40%;left:50%;transform:translate(-50%,-50%);z-index:99">'+
      'Не удалось инициализировать WebGPU/WebGL2. Откройте страницу в актуальном Chrome или Edge.</div>');
    return;
  }
  if(disposed)return;
  /* v0.7.x: bloom-пасс (TSL, работает и на WebGL2-бэкенде); при сбое — обычный рендер */
  try{
    const scenePass=pass(scene,camera);
    const sceneColor=scenePass.getTextureNode();
    const bloomPass=bloom(sceneColor,0.45,0.55,0.82);
    postFX=new THREE.PostProcessing(renderer);
    postFX.outputNode=sceneColor.add(bloomPass);
    console.log('[bg3] bloom enabled (TSL PostProcessing)');
  }catch(e){
    console.warn('[bg3] bloom disabled:',e);postFX=null;
  }
  try{
  /* v0.8: карта леса по умолчанию — сетка, мир, герои, враги, декорации */
  seedForest();
  applyAtmosphere('forest');
  buildWorld();
  buildHeroes();
  spawnEnemies();
  buildForestScenery();
  initMarkers();
  initOverlays();
  bindInput();
  /* v0.7: хало и угли костра */
  glows.campfire(W(FIREPIT[0]),W(FIREPIT[1]));
  fx.addEmber('campfire',W(FIREPIT[0]),W(FIREPIT[1]),{rate:9,color:0xffa040,up:1.7,spread:0.3,size:0.12,life:1.5});
  /* v0.7.x: GLTF-риг (Mixamo-стайл) для героев и босса; гоблины — капсулы */
  void (async()=>{
    const targets=units.filter(u=>u.side==='hero'||u.isBoss);
    let ok=0;
    for(const u of targets){
      const tint=u.isBoss?0xb03424:(u.cls==='fighter'?0x5a7fb0:0x9a6ab8);
      const done=await upgradeUnitRig(u,{tint,tintStrength:0.4,scale:u.isBoss?1.24:1.0,yaw:Math.PI});
      if(done)ok++;
    }
    console.log('[bg3] GLTF rigs:',ok+'/'+targets.length);
    if(ok)log('Скелетные анимации подключены ('+ok+' рига).','g-sys');
  })();
  phase='explore';
  refreshUI();refreshParty();
  openExploreUI();
  /* v1.1: настройки графики + меню сохранений */
  loadGfx();applyGfx();renderGfx();renderSaves();
  const gb=document.getElementById('gfxBtn');
  if(gb){const f=()=>toggleGfx();gb.addEventListener('click',f);disposers.push(()=>gb.removeEventListener('click',f));}
  const svb=document.getElementById('saveBtn');
  if(svb){const f=()=>toggleSaveMenu();svb.addEventListener('click',f);disposers.push(()=>svb.removeEventListener('click',f));}
  const sb=document.getElementById('sndBtn');
  if(sb){
    const onSnd=()=>{sfx.unlock();sfx.setMuted(!sfx.isMuted());sb.textContent=sfx.isMuted()?'🔇':'🔊';sfx.ui();};
    sb.addEventListener('click',onSnd);
    disposers.push(()=>sb.removeEventListener('click',onSnd));
  }
  log('BG3 Web-прототип v1.1 «Скрижали судьбы»: 3 слота сохранений, экспорт/импорт JSON, настройки графики.','g-sys');
  log('Высадка у южного тракта. Торговец Дамрок зовёт поговорить (E или клик по нему).','g-sys');
  log('ЛКМ — идти отрядом • E — говорить/осматривать • J — журнал • K — сейвы • G — графика • ПКМ/Esc — отмена.','g-sys');
  log('Разгромите лагерь Костей на севере — тогда откроется вход в крипту под курганом (северо-восток).','g-sys');
  renderer.setAnimationLoop(loop);
  console.log('[bg3] v1.1 boot complete');
  }catch(err){
    console.error('[bg3] boot failed:',err);
  }
})();
/* v0.8+v1.1: отладочный хук (E2E-проверки в консоли браузера) */
window.__bg3={units,S,QUESTS,switchMap,startCombat,questDone,
  gameSnapshot,doSave,doLoad,gfx,applyGfx,openSaveMenu,toggleGfx};
return function dispose(){
  disposed=true;
  renderer.setAnimationLoop(null);
  while(disposers.length){try{disposers.pop()();}catch(e){}}
  try{renderer.dispose();}catch(e){}
  const cv=renderer.domElement;
  if(cv&&cv.parentNode)cv.parentNode.removeChild(cv);
};
}
