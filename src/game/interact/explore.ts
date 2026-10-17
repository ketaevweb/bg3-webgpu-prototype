/* ================= EXPLORE (Фазы 4–5 рефакторинга) =================
   Спутники (Илва/Кая), сцены леса и крипты, сундук, интеракты,
   триггеры, перемещение отряда. Фаза 5: циклы explore⇄maps и
   explore⇄dialog разорваны — switchMap/openDlg зовутся через шину bus
   (реализации — world/maps.ts и interact/dialog.ts); UI-refresh — через
   bus; параметры типизированы. Перенесено дословно из engine.ts. */
import * as THREE from 'three/webgpu';
import { key, cheb } from '../utils';
import { W, HERO_TINT } from '../constants';
import { d } from '../rng';
import { sfx } from '../audio';
import { G, S, units, solid, interactables, CAGE, CRATE, MERCHANT, KAYA_SPOT, CRYPT, GW, busyOn, busyOff } from '../state';
import { bus } from '../bus';
import { worldGroup, fx, glows } from '../render/renderer';
import { astar, passable, freeSpotNear } from '../world/grid';
import { addCampfire, addRock, addBarrel } from '../world/props';
import { tween } from '../fx/tweens';
import { makeIlva, makeKaya } from '../entities/roster';
import { buildFigure } from '../entities/figure';
import { aliveHeroes } from '../entities/units';
import { bigBanner, log, setHint } from '../ui/overlays';
import { questStart, questObj, questDone, gainGold, refreshTracker, QUESTS } from '../interact/quests';
import { animateMove } from '../systems/movement';
import { upgradeUnitRig } from '../animation';
import type { Interact, Unit } from '../types';

/* HERO_TINT → constants.ts (Фаза 2); cls-ключ вне словаря — базовый тинт */
export async function rigHero(u:Unit):Promise<void>{/* v1.2: GLTF-риг для спутников */
  try{await upgradeUnitRig(u,{tint:(HERO_TINT as Record<string,number|undefined>)[u.cls]||0x5a7fb0,tintStrength:0.4,scale:1.0,yaw:Math.PI});}catch{}
}
export function dismissKayaScene(){/* v1.2: убрать алтарь после ухода Кая в отряд */
  if(S.kayaMesh){S.kayaMesh.removeFromParent();S.kayaMesh=null;}
  const it=interactables.find(i=>i.label==='Поговорить с Кая');
  if(it)interactables.splice(interactables.indexOf(it),1);
  solid.delete(key(KAYA_SPOT[0],KAYA_SPOT[1]));solid.delete(key(KAYA_SPOT[0]+1,KAYA_SPOT[1]));
  glows.detach('kaya');fx.removeEmber('kaya');
}
export function joinIlva(x:number,z:number):Unit|null{
  if(units.some(u=>u.cls==='rogue'))return null;
  const u=makeIlva(x,z);
  bigBanner('ИЛВА ПРИСОЕДИНИЛАСЬ');
  log('Илва: «Долг Дозору. Идите за мной — я знаю здесь каждый куст.»','g-heal');
  fx.burstAtMesh(u,{count:26,color:0x7fd0a0,speed:2.6,size:0.12,life:0.9,gravity:-1});
  sfx.bless();void rigHero(u);
  bus.refreshParty.call();bus.refreshInit.call();refreshHintExplore();
  return u;
}
export function joinKaya(x:number,z:number):Unit|null{
  if(units.some(u=>u.cls==='cleric'))return null;
  dismissKayaScene();
  S.kayaJoined=true;/* v1.2: флаг для сейва */
  const u=makeKaya(x,z);
  bigBanner('КАЯ ПРИСОЕДИНИЛАСЬ');
  log('Кая: «Рассвет ярче там, где есть кого защищать. Ведите — я прикрою спины.»','g-heal');
  fx.burstAtMesh(u,{count:26,color:0xffd54f,speed:2.6,size:0.12,life:0.9,gravity:-1});
  glows.flashAtMesh(u,0xffd54f,1.4);
  sfx.bless();void rigHero(u);
  bus.refreshParty.call();bus.refreshInit.call();refreshHintExplore();
  return u;
}
export function ensureCompanions(){/* v1.2: восстановление спутников при загрузке сейва по флагам */
  const lead=units.find(u=>u.side==='hero');
  if(!lead)return;
  if(S.ilvaFreed&&!units.some(u=>u.cls==='rogue')){
    const p=freeSpotNear(GW,lead,3)||{x:lead.x,z:lead.z};joinIlva(p.x,p.z);
  }
  if(S.kayaJoined&&!units.some(u=>u.cls==='cleric')){
    const p=freeSpotNear(GW,lead,3)||{x:lead.x,z:lead.z};joinKaya(p.x,p.z);
  }
}
export function buildForestScenery(){/* v0.8: было buildScenery + охрана прогресса + вход в крипту */
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
  addInteract(MERCHANT.x,MERCHANT.z,2.6,'Поговорить с Дамроком',()=>bus.openDlg.call('damrock'),dam,
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
    addInteract(CAGE.x,CAGE.z,2.4,'Поговорить с пленницей',()=>bus.openDlg.call('ilva'),ilva,
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
  /* v1.2: придорожный алтарь жрицы Кая */
  if(!S.kayaJoined){
    const alt=new THREE.Group();
    const st=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.5,0.9),
      new THREE.MeshStandardMaterial({color:0x8a8a80,roughness:1}));
    st.position.y=0.25;st.castShadow=true;st.receiveShadow=true;
    const sun=new THREE.Mesh(new THREE.RingGeometry(0.18,0.26,18),
      new THREE.MeshBasicMaterial({color:0xffd54f,side:THREE.DoubleSide}));
    sun.position.y=1.05;
    const cand=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.25,6),
      new THREE.MeshBasicMaterial({color:0xfff2c0}));
    cand.position.set(0.28,0.62,0.2);
    const cl=new THREE.PointLight(0xffd890,7,7,2);cl.position.y=0.8;
    alt.add(st,sun,cand,cl);
    alt.position.set(W(KAYA_SPOT[0]),0,W(KAYA_SPOT[1]));
    worldGroup.add(alt);
    solid.add(key(KAYA_SPOT[0],KAYA_SPOT[1]));
    glows.attach('kaya',W(KAYA_SPOT[0]),W(KAYA_SPOT[1]),0.8,0xffd070);
    fx.addEmber('kaya',W(KAYA_SPOT[0]),W(KAYA_SPOT[1]),{rate:2.4,color:0xffd070,up:0.7,spread:0.18,size:0.07,life:1.0});
    const kayaFig=buildFigure({color:0xc9b070,side:'npc'});
    kayaFig.scale.setScalar(0.96);
    kayaFig.position.set(W(KAYA_SPOT[0]+1),0,W(KAYA_SPOT[1]));
    worldGroup.add(kayaFig);
    solid.add(key(KAYA_SPOT[0]+1,KAYA_SPOT[1]));
    addInteract(KAYA_SPOT[0],KAYA_SPOT[1],2.6,'Поговорить с Кая',()=>bus.openDlg.call('kaya'),alt,
      'Кая Заря','Жрица Рассвета. Молится у придорожного алтаря — ищет попутчиков на север.');
    S.kayaMesh=kayaFig;
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
export function enterCrypt(){
  if(QUESTS.main.state!=='done'){
    log('Проход в курган завален и охраняется лагерем Костей. Сначала разгромите лагерь.','g-sys');
    setHint('Крипта откроется после разгрома лагеря гоблинов.');
    return;
  }
  void bus.switchMap.call('crypt');
}
export function buildCryptScenery(){/* v0.8: подземелье босса */
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
  addInteract(ex[0],ex[1],2.2,'Подняться на тракт',()=>{void bus.switchMap.call('forest');},out,
    'Лестница на тракт','Слабый серый свет и шум ветра — наверху дневной тракт.');
  for(const [x,z] of CRYPT.URNS)addBarrel(x,z,0x4a4238);
}
export function openChest(chest:THREE.Object3D){
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
  bus.refreshParty.call();refreshTracker();
}
/* v1.1: разбор мира вынесен из switchMap — используется и при загрузке сейва */


/* ---- взаимодействие и исследование ---- */
export function addInteract(x:number,z:number,r:number,label:string,fn:()=>void,mesh?:THREE.Object3D|null,talkName?:string,talkDesc?:string){
  const it:Interact={x,z,r,label,fn,mesh,talkName,talkDesc};
  if(mesh)mesh.userData.it=it;
  interactables.push(it);
}
export function nearestInteract():Interact|null{
  let best:Interact|null=null,bd=1e9;
  for(const h of aliveHeroes())for(const it of interactables){
    const dd=cheb(h,it);
    if(dd<=it.r&&dd<bd){bd=dd;best=it;}
  }
  return best;
}
export async function freeIlva():Promise<void>{
  if(S.ilvaFreed||!S.ilvaMesh)return;
  S.ilvaFreed=true;
  busyOn();
  log('Вы выламываете засов — клетка открыта!','g-sys');
  solid.delete(key(CAGE.x,CAGE.z));
  if(S.cageMesh){S.cageMesh.removeFromParent();S.cageMesh=null;}
  const it=interactables.find(i=>i.mesh===S.ilvaMesh);
  if(it)interactables.splice(interactables.indexOf(it),1);
  if(QUESTS.prisoner.state==='hidden')questStart('prisoner');
  const path=astar(GW,CAGE.x,CAGE.z,13,21,null,false)||[];
  const im=S.ilvaMesh as THREE.Object3D;/* Фаза 3: в этой ветке сцена Илвы гарантированно стоит */
  for(const st of path){
    const a=im.position.clone(),b=new THREE.Vector3(W(st.x),0,W(st.z));
    await tween(0.11,k=>im.position.lerpVectors(a,b,k));
  }
  im.removeFromParent();S.ilvaMesh=null;/* v0.8 */
  busyOff();
  questObj('prisoner','free');
  questDone('prisoner');
  joinIlva(13,21);/* v1.2: освобождённая разведчица встаёт в отряд */
  refreshHintExplore();
  checkTriggers();
}
export function takeCrate(){
  if(S.hasCrate)return;
  S.hasCrate=true;
  (S.crateMesh as THREE.Object3D).removeFromParent();S.crateMesh=null;/* Фаза 3: ящик гарантированно стоит */
  const it=interactables.find(i=>i.label==='Осмотреть ящик');
  if(it)interactables.splice(interactables.indexOf(it),1);
  if(QUESTS.crate.state==='hidden')questStart('crate');
  questObj('crate','find');
  log('Вы забираете ящик Дамрока. Отнесите его хозяину на юг.','g-sys');
  refreshHintExplore();
}
export async function moveParty(tile:{x:number;z:number}):Promise<void>{
  if(G.busy||G.phase!=='explore')return;
  const hs=aliveHeroes();
  if(!hs.length)return;
  busyOn();
  bus.tutEvent.call('move');/* v1.4: шаг обучения «Ход отряда» */
  setHint('');
  for(let i=0;i<hs.length;i++){
    const h=hs[i];
    let t=tile;
    if(i>0){
      const offs=[[0,-1],[1,0],[-1,0],[0,1],[1,1],[-1,1],[1,-1],[-1,-1]];
      for(const [dx,dz] of offs){
        const c={x:tile.x+dx,z:tile.z+dz};
        if(passable(GW,c.x,c.z,h)){t=c;break;}
      }
    }
    if(t.x===h.x&&t.z===h.z)continue;
    const p=astar(GW,h.x,h.z,t.x,t.z,h,false);
    if(p&&p.length){h.moveLeft=999;await animateMove(h,p);}
    if(!h.alive)break;
  }
  busyOff();
  refreshHintExplore();
  checkTriggers();
}
export function checkTriggers(){
  if(G.phase!=='explore'||G.busy||G.combatOn)return;
  const hs=aliveHeroes();
  if(!hs.length)return;
  if(!S.patrolDone&&S.patrolGroup.some(g=>g.alive)){
    if(hs.some(h=>S.patrolGroup.some(g=>cheb(h,g)<=6))){bus.openDlg.call('patrol');return;}
  }
  if(!S.campDone&&S.campGroup.some(g=>g.alive)){
    if(hs.some(h=>S.campGroup.some(g=>cheb(h,g)<=7))){bus.openDlg.call('boss');return;}
  }
  if(!S.cageSeen&&!S.ilvaFreed&&hs.some(h=>cheb(h,{x:CAGE.x,z:CAGE.z})<=6)){
    S.cageSeen=true;
    questStart('prisoner');
    log('В клетке у тропы кто-то шевелится…','g-sys');
  }
  if(G.mapId==='crypt'&&S.cryptGroup.some(g=>g.alive&&g.cryptBoss)){/* v0.8: триггер босса крипты */
    if(hs.some(h=>S.cryptGroup.some(g=>cheb(h,g)<=7))){bus.openDlg.call('necro');return;}
  }
  if(G.mapId==='swamp'&&!S.swampDone&&S.swampGroup.some(g=>g.alive&&g.isBoss)){/* v1.5: триггер Матери Топей */
    if(hs.some(h=>S.swampGroup.some(g=>cheb(h,g)<=7))){bus.openDlg.call('swampboss');return;}
  }
  refreshHintExplore();
}
export function refreshHintExplore(){
  if(G.phase!=='explore'){setHint('');return;}
  const it=nearestInteract();
  setHint(it?('E — '+it.label):'');
}

/* ---- регистрация на шине (Фаза 5: progression → checkTriggers без цикла) ---- */
bus.checkTriggers.bind(checkTriggers);
