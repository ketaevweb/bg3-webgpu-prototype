/* Фазы 4–5: engine.ts — оркестратор (сборка, ввод, игровой цикл, dispose).
   Системы/интеракт/сейвы/мир — в модулях state/render/fx/world/entities/systems/interact/ui/save.
   Фаза 5: все циклы импортов разорваны через шину bus (см. bus.ts) —
   граф зависимостей ацикличен (scripts/cycles.js: NO CYCLES). */
import * as THREE from 'three/webgpu';
import { sfx } from './audio';
import { slowmo } from './slowmo';
import { upgradeUnitRig, animOptsFor, animStats } from './animation';/* v1.7: риги + сводка анимации */
import { clamp, cheb, key } from './utils';
import { TILE, GRID, HALF, W } from './constants';
import { astar, passable } from './world/grid';
import { S, G, units, barrels, fires, pick, interactables, KAYA_SPOT, GW, resetState } from './state';
import { bus } from './bus';
import { uiSet, useUi } from './ui/store';
import { renderer, scene, worldGroup, camera, controls, fx, glows, rigs, initRenderer, ensureRendererInit, clearGroup, setupPostFX, applyAtmosphere } from './render/renderer';/* scene — для __bg3.scn (E2E-снимки) */
import { tickTweens, clearTweens } from './fx/tweens';
import { seedForest, buildWorld } from './world/props';
import { switchMap } from './world/maps';
import { buildHeroes, spawnEnemies } from './entities/roster';
import { doAttack, damageUnit, bossAura } from './systems/combat';
import { LOOT, rollLoot } from './systems/loot';
import { startCombat, endTurn } from './systems/turns';/* v2.6: endTurn — проба пропуска хода (E2E) */
import { QUESTS, questDone, closeJournal, toggleJournal } from './interact/quests';
import { openDlg, closeDlg, DLGS } from './interact/dialog';
import { buildForestScenery, freeIlva, joinKaya, checkTriggers, nearestInteract, moveParty } from './interact/explore';
import { joinOlkha } from './interact/swamp';/* v1.5: друид болот */
import { joinHaldir } from './interact/citadel';/* v1.9: капитан Дозора */
import { arenaStart, arenaWipe, arenaState, arenaEndless } from './interact/arena';/* v1.9+v2.0: испытание Глубин */
import { seasonState, forceSeason, toggleRecords, closeRecords } from './interact/season';/* v2.4: сезоны глубины + летопись (T) */
import { blessState, blessForce, loadBestMeta } from './interact/bless';/* v2.8: глубинные благословения (E2E) + мета-рекорд */
import { ebarkProbe, ebarkState } from './ui/barks';/* v2.8: глас бездны (E2E) */
import { awardXP } from './systems/progression';/* v2.2: калибровка опыта (E2E) */
import { buyRelic, upgradeRelic } from './interact/dialog';/* v2.2: обмен реликвий; v2.3: апгрейд (E2E) */
import { makeMalveh, makeGarrum, makeGrat } from './entities/roster';/* v2.2: пробы аур боссов (E2E) */
import { toggleMinimap, refreshMinimap } from './ui/minimap';/* v1.9: миникарта */
import { log, initOverlays, setHint, updateOverlays } from './ui/overlays';
import { initMarkers, clearMarkers, clearDots, showReach, addDot } from './ui/markers';
import { cancelTargeting, enterTarget, resolveTargetClick, showTipFor } from './ui/targeting';
import { tryMove } from './systems/movement';
import { gameSnapshot } from './save/snapshot';
import { doSave, doLoad, renderSaves, openSaveMenu, toggleSaveMenu, closeSaveMenu } from './save/slots';
import { gfx, applyGfx, loadGfx, renderGfx, toggleGfx, closeGfx } from './save/settings';
import { closeShop, closeChoice } from './interact/shop';
import { toggleBag, equipItem, unequipSlot, addToBag, GEAR } from './systems/gear';/* v1.6: снаряжение */
import { initTutorial, tutState, TUT_STEPS } from './ui/tutorial';/* v1.4: наставник; v2.5: шаги для генератора озвучки */
import { initVoice, voiceState } from './ui/voice';/* v2.5: голоса Глубин */
import { barkProbe, barkHeroes, barks } from './ui/barks';/* v2.6: эхо битвы */
import { initMobile, toggleFullscreen, fsState } from './ui/mobile';/* v2.7: мобильная версия + полный экран */
import { cloudGet, cloudPut } from './save/cloud';/* v1.4: облачные скрижали */
import { serverGet, serverPut } from './save/server';/* v1.5: серверные скрижали */
import { cloudPull, serverPull } from './save/slots';
/* регистрации на шине bus: side-effect импорты (порядок — до bootGame) */
import './ui/party';/* refreshParty/refreshInit/refreshBossBar/openExploreUI */
import './ui/actionbar';/* refreshUI */
import './systems/ai';/* aiTurn (turns зовёт через bus — иначе модуль не загрузится) */
import './ui/tutorial';/* v1.4: биндинг bus.tutEvent (реализация — ui/tutorial.ts) */

/* ================= ТОЧКА ВХОДА (v0.7: fullstack src) =================
   bootGame() — оркестратор: сборка, ввод, игровой цикл, dispose.
   Состояние — в state.ts (Фаза 4a), рендер — render/renderer.ts,
   твины — fx/tweens.ts; системы выносятся по REFACTORING.md §5 (4b–4h). */
export function bootGame(){




/* v2.7: говорить/осмотреть — общий код для клавиши E и тач-кнопки 🗣 */
function talkNearest(){
  if(G.phase==='explore'&&!G.busy){const it=nearestInteract();if(it)it.fn();}
}

function onLeftClick(){
  if(G.phase==='explore'){
    if(G.busy)return;
    if(pick.inter){pick.inter.fn();return;}
    if(pick.ent&&pick.ent.alive&&pick.ent.side==='goblin'&&!pick.ent.pacified){
      if(S.patrolGroup.includes(pick.ent)&&!S.patrolDone){openDlg('patrol');return;}
      if(S.campGroup.includes(pick.ent)&&!S.campDone){openDlg('boss');return;}
    }
    if(pick.tile)moveParty(pick.tile);
    return;
  }
  if(!G.combatOn||G.phase!=='player'||G.busy||!G.current||G.current.side!=='hero')return;
  const h=G.current;
  if(G.targeting){resolveTargetClick();return;}
  const tgt=pick.ent;
  if(tgt&&(tgt.side==='goblin'||tgt.isBarrel)){
    if(cheb(h,tgt)<=h.weapon.range&&h.action>0){
      h.action--;
      doAttack(h,tgt,h.weapon).then(()=>{bus.refreshUI.call();showReach(h);});
      return;
    }
    if(h.action<=0)setHint('Нет действия для атаки.');
    else setHint('Слишком далеко для ближнего боя.');
    return;
  }
  if(pick.tile)tryMove(h,pick.tile);
}

setInterval(checkTriggers,700);

/* Фаза 6: панельные биндинги убраны — кнопки в React-HUD зовут колбэки
   из стора (закрытия биндят владельцы: shop/quests/settings/slots);
   экран конца и лист персонажа обрабатывают клики сами. */

/* ================= ВВОД ================= */
const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();
let downPos:{x:number;y:number;b:number;t:string}|null=null;
function castRay(e:PointerEvent){
  ptr.x=(e.clientX/innerWidth)*2-1;
  ptr.y=-(e.clientY/innerHeight)*2+1;
  ray.setFromCamera(ptr,camera);
}
function updatePick(e:PointerEvent){
  pick.tile=null;pick.ent=null;pick.inter=null;
  /* v2.7: на таче нет hover — тултипы не мешают жестам камеры */
  if(e.pointerType==='touch'&&e.type==='pointermove'){showTipFor(null,e);return;}
  if(G.busy||(G.phase!=='player'&&G.phase!=='explore')){showTipFor(null,e);return;}
  castRay(e);
  const ents=[...units.filter(u=>u.alive),...barrels.filter(b=>b.alive)];
  const hits=ray.intersectObjects(ents.map(u=>u.mesh),true);
  if(hits.length){
    let o:THREE.Object3D|null=hits[0].object;
    while(o&&!o.userData.ent)o=o.parent;
    if(o)pick.ent=o.userData.ent;
  }
  if(!pick.ent&&G.phase==='explore'){
    const ims=interactables.flatMap(it=>it.mesh?[it.mesh]:[]);/* Фаза 4: Interact.mesh опционален */
    const ih=ray.intersectObjects(ims,true);
    if(ih.length){
      let o:THREE.Object3D|null=ih[0].object;
      while(o&&!o.userData.it)o=o.parent;
      if(o)pick.inter=o.userData.it;
    }
  }
  if(!pick.ent&&!pick.inter&&G.groundMesh){
    const gh=ray.intersectObject(G.groundMesh,false);
    if(gh.length){
      const p=gh[0].point;
      pick.tile={x:clamp(Math.round(p.x/TILE+HALF),0,GRID-1),z:clamp(Math.round(p.z/TILE+HALF),0,GRID-1)};
    }
  }
  updateHoverFX(e);
}
function updateHoverFX(e:PointerEvent){
  const cv=renderer.domElement;
  if(G.targeting){
    clearDots();
    showTipFor(pick.ent||null,e);
    cv.style.cursor='crosshair';
    return;
  }
  showTipFor(pick.ent||pick.inter||null,e);
  cv.style.cursor=(pick.ent||pick.inter)?'pointer':'default';
  clearDots();
  if(G.phase==='player'&&pick.tile&&G.current&&G.current.side==='hero'&&!G.busy&&G.current.moveLeft>=1&&passable(GW,pick.tile.x,pick.tile.z,G.current)){
    const path=astar(GW,G.current.x,G.current.z,pick.tile.x,pick.tile.z,G.current,false);
    if(path&&path.length){
      let acc=0,px=G.current.x,pz=G.current.z;
      for(const st of path){
        acc+=(st.x!==px&&st.z!==pz)?1.5:1;
        px=st.x;pz=st.z;
        addDot(st.x,st.z,acc<=G.current.moveLeft+1e-9);
      }
    }
  }
}
function bindInput(){
  const el=renderer.domElement;
  el.addEventListener('pointerdown',e=>{sfx.unlock();downPos={x:e.clientX,y:e.clientY,b:e.button,t:e.pointerType};});
  el.addEventListener('pointerup',e=>{
    if(!downPos)return;
    const dx=e.clientX-downPos.x,dy=e.clientY-downPos.y;
    const btn=downPos.b,touch=downPos.t==='touch';downPos=null;
    if(btn===2){cancelTargeting();return;}
    /* v2.7: на таче порог «тапа» шире — палец неточен (14px вместо 7px) */
    if(btn===0&&dx*dx+dy*dy<(touch?196:49)){updatePick(e);onLeftClick();}
  });
  el.addEventListener('pointermove',updatePick);
  el.addEventListener('contextmenu',e=>e.preventDefault());
  const onKey=(e:KeyboardEvent)=>{
    sfx.unlock();
    if(e.key==='Escape'){cancelTargeting();uiSet({sheet:null});closeJournal();closeShop();closeChoice();closeGfx();closeSaveMenu();closeRecords();}/* v2.4: +летопись */
    if(e.key==='e'||e.key==='E'||e.key==='у'||e.key==='У'){
      if(G.phase==='explore'&&!G.busy){const it=nearestInteract();if(it)it.fn();}
    }
    if(e.key==='j'||e.key==='J'||e.key==='о'||e.key==='О'){toggleJournal();}
    if(e.key==='k'||e.key==='K'||e.key==='л'||e.key==='Л'){if(G.phase!=='transition')toggleSaveMenu();}/* v1.1 */
    if(e.key==='g'||e.key==='G'||e.key==='п'||e.key==='П'){toggleGfx();}/* v1.1 */
    if(e.key==='i'||e.key==='I'||e.key==='ш'||e.key==='Ш'){toggleBag();}/* v1.6: снаряжение */
    if(e.key==='m'||e.key==='M'||e.key==='ь'||e.key==='Ь'){toggleMinimap();}/* v1.9: миникарта */
    if(e.key==='t'||e.key==='T'||e.key==='е'||e.key==='Е'){toggleRecords();}/* v2.4: летопись Глубин */
    if(e.key==='f'||e.key==='F'||e.key==='а'||e.key==='А'){void toggleFullscreen();}/* v2.7: полный экран */
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
let mmAcc=0;/* v1.9: троттлинг обновления миникарты */
function loop(){
  const rdt=Math.min(clock.getDelta(),0.05),t=clock.elapsedTime;
  /* v1.1: лимит FPS — пропускаем кадры сверх лимита */
  if(G.fpsLimit>0){G.frameAcc+=rdt;if(G.frameAcc+1e-4<0.98/G.fpsLimit)return;G.frameAcc=0;}
  slowmo.update(rdt);
  const dt=rdt*slowmo.scale;
  mmAcc+=rdt;
  if(mmAcc>0.5){mmAcc=0;if(useUi.getState().minimapOpen)refreshMinimap();}/* v1.9 */
  tickTweens(dt);
  controls.update();
  if(G.fireLight)G.fireLight.intensity=22+Math.sin(t*11)*4+Math.sin(t*23.7)*2.5;
  if(G.flameMesh){G.flameMesh.scale.y=1+Math.sin(t*13)*0.18;G.flameMesh.rotation.y+=dt*2;}
  for(const f of fires.values()){
    (f.m1.material as THREE.MeshBasicMaterial).opacity=0.4+0.18*Math.sin(t*6+f.x*1.3);
    (f.m2.material as THREE.MeshBasicMaterial).opacity=0.35+0.2*Math.sin(t*9+f.z);
    f.m2.scale.setScalar(0.5+0.12*Math.sin(t*8+f.x));
  }
  if(G.shakeT>0){
    G.shakeT=Math.max(0,G.shakeT-dt);
    const s=G.shakeT*0.4;
    scene.position.set((Math.random()-0.5)*s,(Math.random()-0.5)*s*0.6,(Math.random()-0.5)*s);
  }else scene.position.set(0,0,0);
  fx.update(dt);
  glows.update(dt,t);
  rigs.update(dt,t);
  updateOverlays();
  if(G.postFX&&G.bloomOn)G.postFX.render();else renderer.render(scene,camera);/* v1.1: bloom отключаемый */
}
/* ================= СТАРТ ================= */
const disposers:(()=>void)[]=[];
let disposed=false;
(async()=>{
  try{
    console.log('[bg3] init: start');
    initRenderer();
    await ensureRendererInit();/* Фаза 4a: синглтон рендера — init один раз (ремоут переиспользует) */
    console.log('[bg3] init: done, backend=',(renderer.backend as {isWebGPUBackend?:unknown})?.isWebGPUBackend?'WebGPU':'WebGL2');
  }catch(err){
    console.error('[bg3] renderer.init() failed:',err);
    document.body.insertAdjacentHTML('beforeend',
      '<div class="panel" style="top:40%;left:50%;transform:translate(-50%,-50%);z-index:99">'+
      'Не удалось инициализировать WebGPU/WebGL2. Откройте страницу в актуальном Chrome или Edge.</div>');
    return;
  }
  if(disposed)return;
  /* v0.7.x: bloom-пасс (TSL, WebGL2-фолбэк) — сборка в render/renderer.ts */
  await setupPostFX();
  try{
  /* v0.8: карта леса по умолчанию — сетка, мир, герои, враги, декорации */
  seedForest();
  applyAtmosphere('forest');
  buildWorld();
  loadBestMeta();/* v2.8: мета-рекорд глубин ДО buildHeroes — отряд рождается благословлённым */
  buildHeroes();
  spawnEnemies();
  buildForestScenery();
  initMarkers();
  initOverlays();
  bindInput();
  /* v0.7: хало и угли костра (FIREPIT задан buildWorld — guard от null) */
  if(G.FIREPIT){
    glows.campfire(W(G.FIREPIT[0]),W(G.FIREPIT[1]));
    fx.addEmber('campfire',W(G.FIREPIT[0]),W(G.FIREPIT[1]),{rate:9,color:0xffa040,up:1.7,spread:0.3,size:0.12,life:1.5});
  }
  /* v0.7→v1.7: скелетные риги героев и боссов — путь v1.6 (после сборки,
     одним проходом). v1.7: перед ригами грузим библиотеку движений Unity
     (motion.ts, офлайн-ретаргет на mixamorig — scripts/bake_motions.mjs). */
  void (async()=>{
    await import('./motion').then(m=>m.loadMotions());
    const targets=units.filter(u=>u.side==='hero'||u.isBoss);
    let ok=0;
    for(const u of targets){
      const done=await upgradeUnitRig(u,animOptsFor(u));
      if(done)ok++;
    }
    console.log('[bg3] GLTF rigs:',ok+'/'+targets.length);
    if(ok)log('Скелетные анимации подключены ('+ok+' рига).','g-sys');
  })();
  G.phase='explore';
  bus.refreshUI.call();bus.refreshParty.call();
  bus.openExploreUI.call();
  /* v1.1: настройки графики + меню сохранений (view-модели стора); v1.4: наставник; v2.5: голоса */
  loadGfx();applyGfx();renderGfx();renderSaves();
  const disposeMobile=initMobile();/* v2.7: тач-флаги + полноэкранный режим (биндинги стора) */
  disposers.push(disposeMobile);
  uiSet(s=>({sys:{...s.sys,onTalk:talkNearest}}));/* v2.7: тач-кнопка «Говорить» (E) */
  await initVoice();/* v2.5: манифест ДО наставника — первый шаг озвучен */
  initTutorial();
  /* v0.7: звук — биндинг в стор (React-кнопка #sndBtn, Фаза 6) */
  const onSnd=()=>{
    sfx.unlock();sfx.setMuted(!sfx.isMuted());
    uiSet(s=>({sys:{...s.sys,sndIcon:sfx.isMuted()?'🔇':'🔊'}}));
    sfx.ui();
  };
  uiSet(s=>({sys:{...s.sys,onSnd,sndIcon:sfx.isMuted()?'🔇':'🔊',onMm:()=>toggleMinimap(),onRecords:()=>toggleRecords()}}));
  log('BG3 Web-прототип v2.8 «Глубинные благословения»: каждые 2 покорённые глубины усиливают отряд (6 благословений), сезон недели меняет состав волн, носители ауры ревут своим голосом — глубины стали живее.','g-sys');
  log('Освободите Илву в клетке (запад) и найдите алтарь Кая у тракта — обе становятся играбельными спутницами.','g-sys');
  log('В лагере Костей орудует гоблин-ветеран, в крипте ждут культисты и Костепёр, на болотах поёт жрица Глубин, на перевале — великан Гаррум, а в цитадели на севере запел сам лорд-комендант. Элита носит реликвии!','g-sys');
  log('Высадка у южного тракта. Торговец Дамрок зовёт поговорить (E или клик по нему).','g-sys');
  log('ЛКМ — идти отрядом • E — говорить/осматривать • M — миникарта • I — снаряжение • T — летопись Глубин • J — журнал • K — сейвы (и на сервере) • G — графика • ПКМ/Esc — отмена.','g-sys');
  log('Разгромите лагерь Костей — откроется крипта под курганом (северо-восток), после неё — болота (восток), за болотами — тропа на перевал (северо-запад), а с перевала — тракт к цитаделе. ЭТО ФИНАЛ.','g-sys');
  log('После финала у цитадели ждут Хальдир, Капитан Дозора, и портал Испытания Глубин — пять волн теней. Дальше — бесконечные волны под сезоном недели: T — летопись Глубин.','g-sys');
  renderer.setAnimationLoop(loop);
  console.log('[bg3] v2.8 boot complete');
  }catch(err){
    console.error('[bg3] boot failed:',err);
  }
})();
/* v0.8+v1.1+v1.2+v1.4+v1.5: отладочный хук (E2E-проверки в консоли браузера) — тип Bg3Debug */
window.__bg3={units,S,QUESTS,switchMap,startCombat,questDone,
  freeIlva:()=>freeIlva(),joinKaya:(x,z)=>joinKaya(x??KAYA_SPOT[0]+1,z??KAYA_SPOT[1]),
  joinOlkha:(x,z)=>joinOlkha(x??15,z??8),/* v1.5: друид для E2E */
  gameSnapshot,doSave,doLoad,gfx,applyGfx,openSaveMenu,toggleGfx,
  rollLoot,LOOT,/* v1.3: +лут-таблицы для E2E */
  moveParty:(x,z)=>{void moveParty({x,z});},/* v1.4: шаг обучения «Ход отряда» */
  tut:()=>tutState(),/* v1.4: инспектор наставника (только чтение) */
  cloudGet,cloudPut,cloudPull,/* v1.4 */
  serverGet,serverPut,serverPull,/* v1.5: серверные скрижали для E2E */
  aim:(t)=>enterTarget(t as Parameters<typeof enterTarget>[0]),/* v1.5: E2E-прицеливание */
  cam:()=>camera,ctl:()=>controls,/* v1.7: E2E-скриншоты */
  loopStop:()=>renderer.setAnimationLoop(null),loopStart:()=>renderer.setAnimationLoop(loop),/* v1.7: пауза рендера для снимков */
  scn:()=>scene,rnd:()=>renderer,/* v1.7: E2E-снимок: sync render + toDataURL в одном таске */
  step:(x:number,z:number)=>{const h=G.current;if(h&&h.side==='hero'&&G.combatOn)tryMove(h,{x,z});},/* v1.7: боевое перемещение для E2E */
  fire:async(x,z)=>{/* v1.5: E2E-выстрел — подложить pick и применить */
    pick.tile={x,z};
    pick.ent=units.find(u=>u.alive&&!u.isBarrel&&u.x===x&&u.z===z)||null;
    await resolveTargetClick();
  },
  /* v1.6: снаряжение для E2E */
  bag:()=>[...S.bag],
  giveGear:(id,cls)=>{const h=units.find(u=>u.cls===cls&&u.side==='hero');if(!h)return;if(!S.bag.includes(id))addToBag(id);equipItem(id,h);},
  unequipGear:(cls,slot)=>{const h=units.find(u=>u.cls===cls&&u.side==='hero');if(h)unequipSlot(h,slot);},
  openBag:()=>toggleBag(),
  gearKeys:()=>Object.keys(GEAR),
  animStats,/* v1.7: E2E-гейт анимации */
  turn:()=>({phase:G.phase,combatOn:G.combatOn,hero:!!G.current&&G.current.side==='hero',
    action:G.current?G.current.action:0,round:G.round,mapId:G.mapId,busy:G.busy}),/* v1.8: инспектор хода; v2.7: +busy */
  solidAt:(x,z)=>GW.solid.has(key(x,z)),/* v1.8: проверка стены цитадели */
  inters:()=>interactables.map(i=>i.label),/* v1.8: список интерактов */
  callInter:(label)=>{const it=interactables.find(i=>i.label===label);if(it)it.fn();},/* v1.8: вызов интеракта */
  joinHaldir:(x,z)=>joinHaldir(x,z),/* v1.9: паладин для E2E */
  arenaStart:()=>arenaStart(),arenaWipe:()=>arenaWipe(),/* v1.9: арена для E2E */
  arenaEndless:()=>arenaEndless(),/* v2.0: бесконечное испытание для E2E */
  hurt:(u,dmg)=>damageUnit(u,dmg,null),/* v2.1: E2E-урон (триггерит «Бездна зовёт») */
  aura:(u)=>{const a=bossAura(u);return a?a.v:0;},/* v2.1→v2.2: инспектор ауры властителя */
  spawnBoss:(k,x,z)=>{/* v2.2: проба аур боссов кампании (E2E) — юнит вне боя, mesh ставит makeUnit */
    const u=k==='malveh'?makeMalveh():(k==='garrum'?makeGarrum():makeGrat(x,z));
    u.x=x;u.z=z;u.mesh.position.set(W(x),0,W(z));
    units.push(u);return u;
  },
  buyRelic:(id)=>buyRelic(id),/* v2.2: обмен реликвий у стелы (E2E) */
  awardXP:(n)=>awardXP(n),/* v2.2: калибровка опыта (E2E) */
  arenaState:()=>arenaState(),/* v1.9: волна/рекорд */
  arenaSetWave:(n)=>{G.arenaWave=n;},/* v2.3: прыжок к глубинной волне (E2E) */
  upgradeRelic:(id)=>upgradeRelic(id),/* v2.3: апгрейд реликвий (E2E) */
  season:()=>seasonState(),forceSeason:(i)=>forceSeason(i),/* v2.4: сезон глубины (E2E) */
  records:()=>({open:useUi.getState().recordsOpen,data:useUi.getState().records}),/* v2.4: летопись (E2E) */
  mm:()=>useUi.getState().minimap,/* v1.9: снимок миникарты */
  voice:()=>voiceState(),/* v2.5: инспектор озвучки (on/ready/last/hist/dyn/vol) */
  barkProbe:(kind,hero)=>barkProbe(kind,hero),/* v2.6: проба боевых реплик (E2E) */
  fs:()=>fsState(),fsToggle:()=>toggleFullscreen(),/* v2.7: полный экран (E2E) */
  touch:()=>({touch:fsState().touch,dlg:!!useUi.getState().dlg}),/* v2.7: инспектор тача (E2E) */
  blessState:()=>blessState(),blessForce:(b)=>blessForce(b),/* v2.8: благословения (E2E) */
  ebarkProbe:(k)=>ebarkProbe(k),ebarkState:()=>ebarkState(),/* v2.8: глас бездны (E2E) */
  barkKinds:()=>({cd:barks.BARK_CD,heroes:barkHeroes()}),/* v2.6: каталог барьков (E2E) */
  heroPass:()=>{if(G.combatOn&&G.current&&G.current.side==='hero'&&G.phase==='player')endTurn();},/* v2.6: пропуск хода героя (E2E: враги получают ходы) */
  dlgProbe:(npc,id)=>{const f=DLGS[npc];const n=f?f(id):null;
    return n?{name:n.name,text:n.text,opts:(n.opts||[]).map(o=>o.t)}:null;},/* v2.5: пробы реплик (генератор озвучки) */
  tutSteps:()=>TUT_STEPS.map(s=>({id:s.id,title:s.title,text:s.text})),/* v2.5: шаги наставника (генератор) */
  openDlg:(n)=>openDlg(n),closeDlg:()=>closeDlg(),/* v2.5: диалог для E2E */
};
return function dispose(){
  disposed=true;
  renderer.setAnimationLoop(null);
  while(disposers.length){const f=disposers.pop();try{if(f)f();}catch{}}
  /* Фаза 4a: рендерер/сцена — синглтоны приложения; состояние — в resetState (§4) */
  for(const u of [...units])u.mesh.removeFromParent();
  clearGroup(worldGroup);
  fx.clearEmbers();glows.clear();
  clearMarkers();clearDots();
  clearTweens();
  resetState();
  const cv=renderer.domElement;
  if(cv&&cv.parentNode)cv.parentNode.removeChild(cv);
};
}
