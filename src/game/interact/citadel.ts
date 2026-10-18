/* ================= CITADEL (v1.8 «Цитадель Долгого Дозора») =================
   Пятая карта — финал кампании: тракт на северо-востоке перевала (гейт:
   Гаррум повержен), крепостная стена с воротами, внешний двор культистов,
   внутренний двор лорд-коменданта Малвеха, сундук со Знаменем Дозора
   (печать держится, пока Малвех «жив») и спуск обратно на перевал.
   Аналог interact/giants.ts — отдельный модуль ради лимита 400 строк.
   Декорации — ассеты POLYGON Nature через world/nature.ts. */
import * as THREE from 'three/webgpu';
import { key } from '../utils';
import { W } from '../constants';
import { sfx } from '../audio';
import { S, solid, units, interactables, CITADEL, GW } from '../state';
import { bus } from '../bus';
import { worldGroup, fx, glows } from '../render/renderer';
import { placeNature, placeNatureSync } from '../world/nature';
import { freeSpotNear } from '../world/grid';
import { addInteract, refreshHintExplore, rigHero } from './explore';
import { bigBanner, log, setHint } from '../ui/overlays';
import { QUESTS, questStart, questObj } from '../interact/quests';
import { addToBag } from '../systems/gear';
import { gainGold } from '../interact/quests';
import { d } from '../rng';
import { buildFigure } from '../entities/figure';
import { makeHaldir } from '../entities/roster';
import { arenaStart, arenaEndless, showRecords, WAVES } from './arena';
import type { Unit } from '../types';

/* v1.9: место Хальдира у знамён (внешняя сторона ворот) */
const HALDIR=[16,12];

/* ---- тракт к цитадели: северо-восток перевала, за мостом (гейт: Гаррум) ---- */
export function buildCitadelTrail(){
  const g=new THREE.Group();
  const stM=new THREE.MeshStandardMaterial({color:0x5c5f66,roughness:1});
  for(let i=0;i<3;i++){
    const s=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.18,0.72),stM);
    s.position.set(0,0.09+i*0.15,-i*0.52);
    s.castShadow=true;s.receiveShadow=true;
    g.add(s);
  }
  g.position.set(W(CITADEL.TRAIL[0]),0,W(CITADEL.TRAIL[1]));
  worldGroup.add(g);
  glows.attach('citin',W(CITADEL.TRAIL[0]),W(CITADEL.TRAIL[1]),1.5,0x6aae8f);
  fx.addEmber('citin',W(CITADEL.TRAIL[0]),W(CITADEL.TRAIL[1]),{rate:1.8,color:0x8fd3b0,up:0.7,spread:0.5,size:0.06,life:1.2});
  placeNature('SM_Prop_RoadSign_01',CITADEL.TRAIL[0]-1,CITADEL.TRAIL[1]+1,{s:1.8,ry:-0.7});
  addInteract(CITADEL.TRAIL[0],CITADEL.TRAIL[1],2.4,'Тракт к цитадели (на северо-восток)',()=>enterCitadel(),g,
    'Тракт к цитадели','Старый дозорный тракт. Где-то там, за камнями, — ворота Долгого Дозора.');
}
export function enterCitadel(){
  if(QUESTS.giants.state!=='done'){
    log('Тракт завален камнями: пока Гаррум Камнегрыз держит перевал, к цитадели не пройти.','g-sys');
    setHint('Цитадель откроется после победы над Гаррумом Камнегрызом.');
    return;
  }
  void bus.switchMap.call('citadel');
}
/* ---- сцена цитадели: стена с воротами, дворы, бразиры, знамёна, сундук ---- */
export function buildCitadelScenery(){
  const stM=new THREE.MeshStandardMaterial({color:0x50545c,roughness:1});
  /* крепостная стена (z=WALL_Z) — POLYGON-сегменты на каждой клетке, кроме ворот */
  for(let x=1;x<27;x++){
    if(CITADEL.GATE.some(g=>g===x))continue;
    placeNature('SM_Prop_StoneWall_0'+(1+(x%2)),x,CITADEL.WALL_Z,{s:1.65});
  }
  /* ворота: устои и перемычка (клетки 13–14 остаются проходимыми) */
  placeNature('SM_Prop_Pillar_Broken_01',12,CITADEL.WALL_Z,{s:2.3});
  placeNature('SM_Prop_Pillar_Broken_02',15,CITADEL.WALL_Z,{s:2.3});
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(5.2,0.42,0.8),
    new THREE.MeshStandardMaterial({color:0x4a4e56,roughness:1}));
  lintel.position.set(W(13.5),2.6,W(CITADEL.WALL_Z));
  lintel.castShadow=true;
  worldGroup.add(lintel);
  /* фасад цитадели на севере: стена-декор, ворота-портал, зелёное чрево */
  const keep=CITADEL.KEEP;
  for(let x=10;x<=18;x++)placeNature('SM_Prop_StoneWall_0'+(1+(x%2)),x,1,{s:1.9});
  const portal=new THREE.Mesh(new THREE.BoxGeometry(2.4,3.2,0.6),stM);
  portal.position.set(W(keep[0]),1.6,W(keep[1]));
  portal.castShadow=true;
  worldGroup.add(portal);
  const doorM=new THREE.MeshBasicMaterial({color:0x3fd08f,transparent:true,opacity:0.28});
  const door=new THREE.Mesh(new THREE.PlaneGeometry(1.7,2.7),doorM);
  door.position.set(W(keep[0]),1.35,W(keep[1])+0.32);
  worldGroup.add(door);
  glows.attach('keep',W(keep[0]),W(keep[1]),2.6,0x4fae7f);
  fx.addEmber('keep',W(keep[0]),W(keep[1]),{rate:5,color:0x6fd3a0,up:1.2,spread:0.4,size:0.09,life:1.3});
  for(const [bx,bz] of [[12,2],[16,2]]){
    placeNature('SM_Prop_Skull_01',bx,bz,{s:1.7,spin:true});
    placeNature('SM_Prop_Skeleton_Ground_01',bx+1,bz,{s:1.5,spin:true});
  }
  /* бразиры Глубинного — зелёное пламя во внутреннем дворе */
  CITADEL.BRAZIERS.forEach(([x,z],i)=>{
    const g=new THREE.Group();
    const legM=new THREE.MeshStandardMaterial({color:0x3a3f38,roughness:0.8,metalness:0.4});
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
    glows.attach('cbraz'+i,W(x),W(z),1.5,0x5fae7f);
    fx.addEmber('cbraz'+i,W(x),W(z),{rate:6,color:0x7fd0a0,up:1.4,spread:0.3,size:0.1,life:1.1});
  });
  for(const [px,pz] of CITADEL.PILLARS)placeNature('SM_Prop_Pillar_Broken_0'+(1+(px%2)),px,pz,{s:2.0,spin:true});
  /* знамёна Долгого Дозора у ворот — полотнище на древке */
  for(const [bx,bz] of CITADEL.BANNERS){
    const b=new THREE.Group();
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,2.6,6),
      new THREE.MeshStandardMaterial({color:0x4a3a28,roughness:1}));
    pole.position.y=1.3;pole.castShadow=true;
    const cloth=new THREE.Mesh(new THREE.PlaneGeometry(0.85,1.15),
      new THREE.MeshStandardMaterial({color:0x2a3a5f,roughness:0.9,side:THREE.DoubleSide}));
    cloth.position.set(0.45,1.85,0);
    const band=new THREE.Mesh(new THREE.PlaneGeometry(0.85,0.18),
      new THREE.MeshStandardMaterial({color:0xd8b45a,roughness:0.7,side:THREE.DoubleSide}));
    band.position.set(0.45,1.95,0.01);
    b.add(pole,cloth,band);
    b.position.set(W(bx),0,W(bz));
    worldGroup.add(b);
    glows.attach('ban'+bx,W(bx),W(bz),0.8,0xd8b45a);
  }
  /* сундук цитадели: Знамя Дозора (один раз; печать — пока Малвех жив) */
  const [chx,chz]=CITADEL.CHEST;
  if(!S.citadelChest){
    void placeNatureSync('SM_Prop_Chest_Wood_01',chx,chz,{s:1.9,ry:Math.PI}).then(m=>{
      if(S.citadelChest){m.removeFromParent();return;}/* успели открыть при загрузке FBX */
      solid.add(key(chx,chz));
      addInteract(chx,chz,2.2,'Открыть сундук цитадели',()=>openCitadelChest(),m,
        'Сундук цитадели','Окованный сундук коменданта. Печать Глубинного держится, пока Малвех «жив».');
    });
  }
  /* спуск обратно на перевал */
  const ex=CITADEL.EXIT;
  const out=new THREE.Group();
  for(let i=0;i<3;i++){
    const s=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.18,0.66),stM);
    s.position.set(0,0.09+i*0.15,i*0.5);
    s.castShadow=true;s.receiveShadow=true;
    out.add(s);
  }
  out.position.set(W(ex[0]),0,W(ex[1]));
  worldGroup.add(out);
  addInteract(ex[0],ex[1],2.2,'Спуститься на перевал',()=>{void bus.switchMap.call('giants');},out,
    'Спуск с цитадели','Тракт ведёт обратно, к огрскому перевалу.');
  /* v1.9: постгейм после финала — Хальдир у знамён и испытание Глубин у портала */
  if(S.campaignDone){
    buildHaldirScene();
    const [kx,kz]=CITADEL.KEEP;
    /* v2.1: стела рекордов у портала — журнал завершённых/сорванных заходов арены */
    addInteract(12,2,2.2,'Стела рекордов (арена)',()=>showRecords(),null,
      'Стела рекордов','Чёрный камень у изумрудного портала. Глубина волн капитанов Дозора выбита на граните.');
    /* v2.2: призрак коменданта у стелы — обмен реликвий Глубин (диалог ghost) */
    const gfig=buildFigure({color:0x6fd3a0,side:'npc'});
    gfig.scale.setScalar(0.96);
    gfig.position.set(W(16),0,W(2));
    worldGroup.add(gfig);
    glows.attach('ghost',W(16),W(2),0.9,0x6fd3a0);
    fx.addEmber('ghost',W(16),W(2),{rate:2.2,color:0x8fd3b0,up:0.9,spread:0.35,size:0.05,life:1.1});
    addInteract(16,2,2.3,'Призрак коменданта (обмен реликвий)',()=>bus.openDlg.call('ghost'),gfig,
      'Призрак коменданта','Полупрозрачный силуэт у стелы. «Казна Дозора против казны Глубин» — реликвии за золото, пока призрак не развеялся.');
    /* v2.0: испытание пройдено (рекорд ≥5) — портал ведёт в БЕСКОНЕЧНОЕ испытание */
    if(S.arenaBest>=WAVES){
      addInteract(kx,kz,2.6,'Бесконечное испытание (арена)',()=>arenaEndless(),null,
        'Бесконечное испытание','Изумрудный портал за спиной коменданта. Испытание пройдено — теперь волны не иссякнут, пока стоит отряд.');
    }else{
      addInteract(kx,kz,2.6,'Испытание Глубин (арена)',()=>arenaStart(),null,
        'Испытание Глубин','Изумрудный портал за спиной коменданта. Тени павших ждут вызвавших — пять волн, награда и слава.');
    }
  }
}
/* ---- сундук со Знаменем Дозора ---- */
export function openCitadelChest(){
  if(S.citadelChest){log('Сундук пуст — только пепел и зелёный свет.','g-sys');return;}
  if(units.some(u=>u.citadelBoss&&u.alive)){
    setHint('Печать держится, пока Малвех «жив».');
    log('Сундук не поддаётся: печать Глубинного питается волей коменданта.','g-sys');
    return;
  }
  S.citadelChest=true;
  const it=interactables.find(i=>i.label==='Открыть сундук цитадели');
  if(it)interactables.splice(interactables.indexOf(it),1);
  solid.delete(key(CITADEL.CHEST[0],CITADEL.CHEST[1]));
  addToBag('watch_banner');
  const g=150+d(100);
  gainGold(g);
  bigBanner('ЗНАМЯ ДОЗОРА');
  sfx.gold();
  log('В сундуке: знамя коменданта и '+g+' золота. Знамя поднимет КД носителя!','g-heal');
  refreshHintExplore();
}
export function startCitadelQuest(){
  if(QUESTS.citadel.state==='hidden')questStart('citadel');
  questObj('citadel','enter');
}
/* ================= v1.9: ПОСТГЕЙМ — ХАЛЬДИР У ЗНАМЁН =================
   Капитан Дозора приходит к воротам после падения Малвеха. Диалог →
   присоединение (шестой спутник, cls 'paladin'); ensureHaldir()
   восстанавливает его при загрузке сейва (по флагу haldirJoined). */
export function buildHaldirScene(){
  if(S.haldirJoined)return;
  const [hx,hz]=HALDIR;
  const fig=buildFigure({color:0x9a5a5a,side:'npc'});
  fig.scale.setScalar(1.04);
  fig.position.set(W(hx),0,W(hz));
  worldGroup.add(fig);
  solid.add(key(hx,hz));
  glows.attach('haldir',W(hx),W(hz),0.8,0xd8b45a);
  addInteract(hx,hz,2.4,'Поговорить с капитаном Дозора',()=>bus.openDlg.call('haldir'),fig,
    'Хальдир','Капитан Дозора. Держал внешнюю башню, пока над цитаделью пела песня Глубинного.');
  S.haldirMesh=fig;
}
export function dismissHaldirScene(){
  if(S.haldirMesh){S.haldirMesh.removeFromParent();S.haldirMesh=null;}
  const it=interactables.find(i=>i.label==='Поговорить с капитаном Дозора');
  if(it)interactables.splice(interactables.indexOf(it),1);
  solid.delete(key(HALDIR[0],HALDIR[1]));
  glows.detach('haldir');
}
export function joinHaldir(x:number=HALDIR[0],z:number=HALDIR[1]):Unit|null{
  if(units.some(u=>u.cls==='paladin'))return null;
  S.haldirJoined=true;
  dismissHaldirScene();
  const u=makeHaldir(x,z);
  bigBanner('ХАЛЬДИР ПРИСОЕДИНИЛСЯ');
  log('Хальдир: «Башня пала, но Дозор — жив. Раз Малвех свободен, мой молот бьётся за вас.»','g-hero');
  fx.burstAtMesh(u,{count:26,color:0xd8b45a,speed:2.6,size:0.12,life:0.9,gravity:-1});
  sfx.bless();void rigHero(u);
  bus.refreshParty.call();bus.refreshInit.call();refreshHintExplore();
  return u;
}
export function ensureHaldir(){/* восстановление капитана по флагу сейва */
  if(!S.haldirJoined||units.some(u=>u.cls==='paladin'))return;
  const lead=units.find(u=>u.side==='hero');
  if(!lead)return;
  const p=freeSpotNear(GW,lead,3)||{x:lead.x,z:lead.z};
  joinHaldir(p.x,p.z);
}
