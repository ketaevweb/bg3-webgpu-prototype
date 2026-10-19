/* ================= GIANTS (v1.6 «Перевал великанов») =================
   Четвёртая карта: подножие перевала на лесу (гейт: болота зачищены),
   обрыв с мостом, огрский лагерь (костёр, сундук с секирой, кости),
   пещера Гаррума и спуск обратно на тракт. Аналог interact/swamp.ts:
   отдельный модуль, чтобы explore.ts держался лимита 400 строк.
   Декорации — ассеты POLYGON Nature через world/nature.ts (FBX+атлас). */
import * as THREE from 'three/webgpu';
import { key } from '../utils';
import { W } from '../constants';
import { sfx } from '../audio';
import { G, S, solid, interactables, GIANTS } from '../state';
import { bus } from '../bus';
import { worldGroup, fx, glows } from '../render/renderer';
import { placeNature, placeNatureSync } from '../world/nature';
import { addInteract, refreshHintExplore } from './explore';
import { bigBanner, log, setHint } from '../ui/overlays';
import { QUESTS, questStart, questObj } from '../interact/quests';
import { addToBag } from '../systems/gear';

/* ---- вход с леса: подножие перевала на северо-западе (гейт: болота) ---- */
export function buildGiantsTrail(){
  const g=new THREE.Group();
  /* каменные ступени в гору */
  const stM=new THREE.MeshStandardMaterial({color:0x6a655c,roughness:1});
  for(let i=0;i<3;i++){
    const s=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.22,0.75),stM);
    s.position.set(0,0.1+i*0.16,-i*0.55);
    s.castShadow=true;s.receiveShadow=true;
    g.add(s);
  }
  g.position.set(W(GIANTS.TRAIL[0]),0,W(GIANTS.TRAIL[1]));
  worldGroup.add(g);
  glows.attach('giantsin',W(GIANTS.TRAIL[0]),W(GIANTS.TRAIL[1]),1.5,0x9fb8d8);
  fx.addEmber('giantsin',W(GIANTS.TRAIL[0]),W(GIANTS.TRAIL[1]),{rate:1.6,color:0xcfd8e8,up:0.7,spread:0.5,size:0.06,life:1.2});
  /* указатель дороги (POLYGON) */
  placeNature('SM_Prop_RoadSign_01',GIANTS.TRAIL[0]+1,GIANTS.TRAIL[1]-1,{s:1.8,ry:0.6});
  addInteract(GIANTS.TRAIL[0],GIANTS.TRAIL[1],2.4,'Тропа на перевал (на северо-запад)',()=>enterGiants(),g,
    'Перевал великанов','Тропа уходит вверх, к горной расщелине. Камни помнят шаги великанов.');
}
export function enterGiants(){
  if(QUESTS.swamp.state!=='done'){
    log('Перевал не примет слабых: наверху живут огры. Сначала разберитесь с Матерью Топей.','g-sys');
    setHint('Перевал откроется после зачистки болот культистов.');
    return;
  }
  void bus.switchMap.call('giants');
}
export function buildGiantsScenery(){/* v1.6: обрыв, мост, лагерь, пещера, спуск */
  /* горный хребет по периметру (декор — границы и так solid); в метрах горы ~20-30м.
    v1.8-фикс: Math.floor в индексах моделей — (z/4)%3 давал дробные имена
    («SM_Terrain_Mountain_01.75.fbx» → 404, горы молча не грузились)
    v2.9-урок: при s 1.1-1.4 (30-55 м) хребет заливал кадр стенами с орбиты
    камеры — холмы-обрамление 8-14 м (s 0.32-0.5), отодвинуты за край */
  for(let x=0;x<28;x+=3){
    placeNature('SM_Terrain_Mountain_0'+(1+Math.floor(x/3)%3),x,-4,{s:0.18+Math.floor(x/3)%3*0.04,spin:true});
    placeNature('SM_Terrain_Mountain_0'+(1+Math.floor((x+2)/3)%3),x,31,{s:0.2+Math.floor(x/3)%3*0.04,spin:true});
  }
  for(let z=3;z<28;z+=4){
    placeNature('SM_Terrain_Mountain_0'+(1+Math.floor(z/4)%3),-4,z,{s:0.18+Math.floor(z/4)%3*0.04,spin:true});
    placeNature('SM_Terrain_Mountain_0'+(1+Math.floor((z+2)/4)%3),31,z,{s:0.19+Math.floor(z/4)%3*0.04,spin:true});
  }
  /* обрыв: тёмная полоса между рядами z 13..14, кроме клеток моста */
  const chM=new THREE.MeshStandardMaterial({color:0x0d0c10,roughness:1});
  const strip=new THREE.Mesh(new THREE.PlaneGeometry(27*1.6,1.4),chM);
  strip.rotation.x=-Math.PI/2;
  strip.position.set(W(13.5),0.015,W(13.5));
  worldGroup.add(strip);
  placeNature('SM_Terrain_DustPile_Small_01',11,15,{s:1.5});
  placeNature('SM_Terrain_Rubble_Pebbles_01',16,12,{s:1.4});
  placeNature('SM_Terrain_Rubble_Pebbles_01',9,12,{s:1.3,spin:true});/* v1.8-фикс: Pebbles_02 не существует в паке → 404 */
  /* мост через обрыв (доски на каменных опорах — детерминированный выравнивание) */
  const brM=new THREE.MeshStandardMaterial({color:0x5f4a34,roughness:1});
  for(let i=0;i<5;i++){
    const p=new THREE.Mesh(new THREE.BoxGeometry(2.9,0.14,0.62),brM);
    p.position.set(W(13.5),0.24,-0.9+i*0.6);
    p.castShadow=true;p.receiveShadow=true;
    worldGroup.add(p);
  }
  const ropeM=new THREE.MeshStandardMaterial({color:0x3f352a,roughness:1});
  for(const sx of [-1.45,1.45]){
    const rope=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.6,6),ropeM);
    rope.rotation.x=Math.PI/2;
    rope.position.set(W(13.5)+sx,0.75,W(13.5));
    worldGroup.add(rope);
    const post=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,1.0,6),ropeM);
    post.position.set(W(13.5)+sx,0.5,W(13.5)-1.35);
    post.castShadow=true;
    worldGroup.add(post);
    const post2=post.clone();post2.position.z=W(13.5)+1.35;
    worldGroup.add(post2);
  }
  /* пещера Гаррума на севере (POLYGON) + холодное свечение */
  placeNature('SM_Rock_CaveEntrance_01',GIANTS.CAVE[0],GIANTS.CAVE[1],{s:1.7});
  glows.attach('cave',W(GIANTS.CAVE[0]),W(GIANTS.CAVE[1]),2.2,0x5f7a9f);
  /* огрский лагерь: костёр (POLYGON+пламя), кости, столбы, черепа */
  const [cx,cz]=GIANTS.CAMP;
  placeNature('SM_Prop_CampFire_01',cx,cz,{s:1.4});
  const flame=new THREE.Mesh(new THREE.ConeGeometry(0.3,0.8,7),
    new THREE.MeshBasicMaterial({color:0xff9440,transparent:true,opacity:0.9}));
  flame.position.set(W(cx),0.55,W(cz));
  worldGroup.add(flame);
  G.flameMesh=flame;/* анимация пламени — общий loop() движка */
  const fireLight=new THREE.PointLight(0xffa050,20,14,2);
  fireLight.position.set(W(cx),1.1,W(cz));
  worldGroup.add(fireLight);
  G.fireLight=fireLight;
  glows.campfire(W(cx),W(cz));
  fx.addEmber('ogrefire',W(cx),W(cz),{rate:7,color:0xffa050,up:1.5,spread:0.3,size:0.11,life:1.4});
  for(const [bx,bz] of GIANTS.BONES){
    placeNature('SM_Prop_Skeleton_Ground_01',bx,bz,{s:1.7,spin:true});
    placeNature('SM_Prop_Skull_01',bx+1,bz,{s:1.8,spin:true});
  }
  for(const [px,pz] of GIANTS.PILLARS)placeNature('SM_Prop_Pillar_Broken_0'+(1+(px%2)),px,pz,{s:2.0,spin:true});
  /* сундук великанов: секира перевала (один раз, POLYGON-модель) */
  const [chx,chz]=GIANTS.CHEST;
  if(!S.giantsChest){
    void placeNatureSync('SM_Prop_Chest_Wood_01',chx,chz,{s:1.9,ry:-0.5}).then(m=>{
      if(S.giantsChest){m.removeFromParent();return;}/* успели открыть при загрузке FBX */
      solid.add(key(chx,chz));
      addInteract(chx,chz,2.2,'Открыть сундук великанов',()=>openGiantsChest(chx,chz),m,
        'Сундук великанов','Тяжёлый сундук из окованной древесины — пахнет горами и старым мясом.');
    });
  }
  /* спуск обратно на тракт */
  const ex=GIANTS.EXIT;
  const out=new THREE.Group();
  const stM=new THREE.MeshStandardMaterial({color:0x6a655c,roughness:1});
  for(let i=0;i<3;i++){
    const s=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.2,0.66),stM);
    s.position.set(0,0.1+i*0.15,i*0.5);
    s.castShadow=true;s.receiveShadow=true;
    out.add(s);
  }
  out.position.set(W(ex[0]),0,W(ex[1]));
  worldGroup.add(out);
  addInteract(ex[0],ex[1],2.2,'Спуститься на тракт',()=>{void bus.switchMap.call('forest');},out,
    'Спуск с перевала','Тропа ведёт вниз, к знакомому тракту.');
}
export function openGiantsChest(x:number,z:number){
  if(S.giantsChest){log('Сундук пуст — только объедки и мухи.','g-sys');return;}
  S.giantsChest=true;
  const it=interactables.find(i=>i.label==='Открыть сундук великанов');
  if(it)interactables.splice(interactables.indexOf(it),1);
  solid.delete(key(x,z));
  addToBag('axe_pass');
  bigBanner('СЕКИРА ПЕРЕВАЛА');
  sfx.gold();
  log('В сундуке — секира огра, отточенная о камни перевала.','g-heal');
  refreshHintExplore();
}
/* ---- квест перевала: старт при входе на карту ---- */
export function startGiantsQuest(){
  if(QUESTS.giants.state==='hidden')questStart('giants');
  questObj('giants','enter');
}
