/* ================= SWAMP (v1.5 «Болота культистов») =================
   Третья карта: гать-вход с леса, идол Глубинного, сцена Ольхи (друид),
   алтарь Ульвы и выход на тракт. Аналог buildForestScenery/buildCryptScenery,
   вынесен в отдельный модуль — explore.ts держится лимита 400 строк.
   Импорты однонаправленные: swamp → explore/roster/state (циклов нет:
   explore не импортирует swamp, диалоги зовут joinOlkha напрямую). */
import * as THREE from 'three/webgpu';
import { key } from '../utils';
import { W } from '../constants';
import { sfx } from '../audio';
import { S, units, solid, interactables, SWAMP, GW } from '../state';
import { bus } from '../bus';
import { worldGroup, fx, glows } from '../render/renderer';
import { freeSpotNear } from '../world/grid';
import { addRock } from '../world/props';
import { addInteract, rigHero, refreshHintExplore } from './explore';
import { buildFigure } from '../entities/figure';
import { upgradeNpcFigure } from '../animation';
import { makeOlkha } from '../entities/roster';
import { bigBanner, log, setHint } from '../ui/overlays';
import { QUESTS, questStart, questObj } from '../interact/quests';
import type { Unit } from '../types';

/* ---- вход с леса: гать на восточной опушке (гейт: крипта зачищена) ---- */
export function buildSwampTrail(){
  const gath=new THREE.Group();
  const plM=new THREE.MeshStandardMaterial({color:0x5a4630,roughness:1});
  for(let i=0;i<3;i++){
    const p=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.12,1.8),plM);
    p.position.set(i*0.85-0.85,0.1,i*0.3);
    p.castShadow=true;p.receiveShadow=true;
    gath.add(p);
  }
  const postM=new THREE.MeshStandardMaterial({color:0x4a3a28,roughness:1});
  for(const sx of [-1,1]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,1.1,6),postM);
    post.position.set(sx*0.55,0.55,-0.7);
    gath.add(post);
  }
  gath.position.set(W(SWAMP.TRAIL[0]),0,W(SWAMP.TRAIL[1]));
  worldGroup.add(gath);
  glows.attach('swampin',W(SWAMP.TRAIL[0]),W(SWAMP.TRAIL[1]),1.5,0x7fae5f);
  fx.addEmber('swampin',W(SWAMP.TRAIL[0]),W(SWAMP.TRAIL[1]),{rate:2.2,color:0x8fd36a,up:0.6,spread:0.4,size:0.07,life:1.1});
  addInteract(SWAMP.TRAIL[0],SWAMP.TRAIL[1],2.4,'Утопленный тракт (на восток)',()=>enterSwamp(),gath,
    'Утопленный тракт','Доски гати уходят под зеленоватую жижу. Издалека тянет пением и запахом гнили.');
}
export function enterSwamp(){
  if(QUESTS.crypt.state!=='done'){
    log('Гать тонет в трясине — болота кишат культистами. Сначала разберитесь с Костепёром.','g-sys');
    setHint('Болота откроются после зачистки крипты Костепёра.');
    return;
  }
  void bus.switchMap.call('swamp');
}
export function buildSwampScenery(){/* v1.5: идол, цепи Ольхи, алтарь, выход */
  S.olkhaMesh=null;
  const stM=new THREE.MeshStandardMaterial({color:0x3f4a44,roughness:1});
  /* идол Глубинного с зелёным пламенем */
  const [ix,iz]=SWAMP.IDOL;
  const idol=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.55,1.9,6),stM);
  body.position.y=0.95;body.castShadow=true;body.receiveShadow=true;
  const head=new THREE.Mesh(new THREE.DodecahedronGeometry(0.4,0),stM);
  head.position.y=2.05;head.castShadow=true;
  const eyeM=new THREE.MeshBasicMaterial({color:0x8fe87f});
  const eye1=new THREE.Mesh(new THREE.SphereGeometry(0.07,8,8),eyeM);
  eye1.position.set(-0.14,2.1,0.34);
  const eye2=eye1.clone();eye2.position.x=0.14;
  const fl=new THREE.Mesh(new THREE.ConeGeometry(0.2,0.6,7),
    new THREE.MeshBasicMaterial({color:0x8fe87f,transparent:true,opacity:0.85}));
  fl.position.y=2.75;
  const lt=new THREE.PointLight(0x7fe0a0,14,12,2);lt.position.y=2.6;
  idol.add(body,head,eye1,eye2,fl,lt);
  idol.position.set(W(ix),0,W(iz));
  worldGroup.add(idol);
  glows.attach('idol',W(ix),W(iz),1.6,0x5fae7f);
  fx.addEmber('idol',W(ix),W(iz),{rate:4,color:0x8fe87f,up:1.1,spread:0.25,size:0.08,life:1.2});
  /* Ольха, прикованная к идолу (v1.5: пятая спутница — друид) */
  if(!S.olkhaJoined){
    const [ox,oz]=SWAMP.OLKHA;
    const fig=buildFigure({color:0x6a9a4a,side:'npc'});
    fig.scale.setScalar(0.94);
    fig.position.set(W(ox),0,W(oz));
    /* v3.2: Ольха — Synty-друид вместо капсулы */
    void upgradeNpcFigure(fig,(process.env.NEXT_PUBLIC_BASE_PATH??'')+'/models/rig/heroes/druid.glb',{scale:0.92,yaw:Math.PI});
    const chain=new THREE.Mesh(new THREE.TorusGeometry(0.42,0.05,6,14),
      new THREE.MeshStandardMaterial({color:0x555a60,metalness:0.7,roughness:0.4}));
    chain.rotation.x=Math.PI/2;chain.position.y=0.5;
    fig.add(chain);
    worldGroup.add(fig);
    solid.add(key(ox,oz));
    glows.attach('olkha',W(ox),W(oz),0.7,0x8fd36a);
    addInteract(ox,oz,2.4,'Поговорить с прикованной друидкой',()=>bus.openDlg.call('olkha'),fig,
      'Ольха','Друид. Прикована цепью к идолу — смотрит на тину с ненавистью.');
    S.olkhaMesh=fig;
  }
  /* алтарь Глубинного перед ареной босса */
  const [bx,bz]=SWAMP.BOSS;
  const alt=new THREE.Group();
  const slab=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.5,1.0),stM);
  slab.position.y=0.25;slab.castShadow=true;slab.receiveShadow=true;
  const bowl=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.18,0.3,8),stM);
  bowl.position.y=0.62;
  const goo=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,8),
    new THREE.MeshBasicMaterial({color:0x8fe87f,transparent:true,opacity:0.8}));
  goo.position.y=0.8;
  alt.add(slab,bowl,goo);
  alt.position.set(W(bx),0,W(bz-2));
  worldGroup.add(alt);
  glows.attach('altar',W(bx),W(bz-2),1.2,0x4a8a6a);
  /* гать обратно на тракт */
  const ex=SWAMP.EXIT;
  const out=new THREE.Group();
  const wM=new THREE.MeshStandardMaterial({color:0x5a4630,roughness:1});
  for(let i=0;i<3;i++){
    const s=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.14,0.6),wM);
    s.position.set(0,0.08+i*0.16,i*0.5);
    s.castShadow=true;s.receiveShadow=true;
    out.add(s);
  }
  out.position.set(W(ex[0]),0,W(ex[1]));
  worldGroup.add(out);
  addInteract(ex[0],ex[1],2.2,'Подняться на тракт',()=>{void bus.switchMap.call('forest');},out,
    'Гать на тракт','Доски ведут обратно к сухому тракту.');
  addRock(12,25);addRock(16,25);
}
/* ---- подключение Ольхи (v1.5) — по образцу joinKaya ---- */
export function dismissOlkhaScene(){
  if(S.olkhaMesh){S.olkhaMesh.removeFromParent();S.olkhaMesh=null;}
  const it=interactables.find(i=>i.label==='Поговорить с прикованной друидкой');
  if(it)interactables.splice(interactables.indexOf(it),1);
  solid.delete(key(SWAMP.OLKHA[0],SWAMP.OLKHA[1]));
  glows.detach('olkha');
}
export function joinOlkha(x:number,z:number):Unit|null{
  if(units.some(u=>u.cls==='druid'))return null;
  S.olkhaJoined=true;
  dismissOlkhaScene();
  const u=makeOlkha(x,z);
  bigBanner('ОЛЬХА ПРИСОЕДИНИЛАСЬ');
  log('Ольха: «Тина держала меня три луны. Ведите — болота мне родня, я знаю, где они тонут.»','g-heal');
  fx.burstAtMesh(u,{count:26,color:0x8fd36a,speed:2.6,size:0.12,life:0.9,gravity:-1});
  sfx.bless();void rigHero(u);
  bus.refreshParty.call();bus.refreshInit.call();refreshHintExplore();
  return u;
}
export function ensureOlkha(){/* v1.5: восстановление спутницы при загрузке сейва */
  if(!S.olkhaJoined||units.some(u=>u.cls==='druid'))return;
  const lead=units.find(u=>u.side==='hero');
  if(!lead)return;
  const p=freeSpotNear(GW,lead,3)||{x:lead.x,z:lead.z};
  joinOlkha(p.x,p.z);
}
/* реэкспорт для журнала/трекера: старт квеста болот при входе на карту */
export function startSwampQuest(){
  if(QUESTS.swamp.state==='hidden')questStart('swamp');
  questObj('swamp','enter');
}
