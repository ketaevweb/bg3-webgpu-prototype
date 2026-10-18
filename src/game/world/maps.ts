/* ================= MAPS (Фазы 4–5 рефакторинга) =================
   teardown/buildMap/switchMap — пересборка мира между лесом и криптой.
   Фаза 5: цикл explore⇄maps разорван — explore зовёт switchMap через шину
   bus (здесь привязка); UI-refresh — через bus. Перенесено дословно. */
import { $, sleep } from '../utils';
import { UI } from '../hud';
import { sfx } from '../audio';
import { G, CRYPT, SWAMP, GIANTS, CITADEL, MAP_NAME, units, barrels, fires, interactables, busyOn, busyOff } from '../state';
import { bus } from '../bus';
import { setActionbarVisible, setRound } from '../ui/store';
import { worldGroup, fx, glows, controls, clearGroup, applyAtmosphere } from '../render/renderer';
import { seedForest, seedCrypt, seedSwamp, seedGiants, seedCitadel, buildWorld } from './props';
import { buildForestScenery, buildCryptScenery } from '../interact/explore';
import { buildSwampScenery, buildSwampTrail, startSwampQuest } from '../interact/swamp';
import { buildGiantsScenery, buildGiantsTrail, startGiantsQuest } from '../interact/giants';
import { buildCitadelScenery, buildCitadelTrail, startCitadelQuest } from '../interact/citadel';/* v1.8 */
import { spawnEnemies } from '../entities/roster';
import { removeUnit, placeHeroes } from '../entities/units';
import { QUESTS, questStart, questObj, refreshTracker } from '../interact/quests';
import { initOverlays, log, setHint } from '../ui/overlays';
import { cancelTargeting } from '../ui/targeting';
import { removeFire } from '../systems/statuses';
import { upgradeUnitRig } from '../animation';
import type { MapId } from '../types';

export function teardownWorld(){
  cancelTargeting();setHint('');
  for(const u of units.filter(u=>u.side!=='hero'))removeUnit(u);
  for(const b of barrels)if(b.mesh)b.mesh.removeFromParent();
  barrels.length=0;
  for(const k of [...fires.keys()])removeFire(k);
  fx.clearEmbers();
  glows.clear();
  interactables.length=0;
  clearGroup(worldGroup);
  G.groundMesh=null;G.fireLight=null;G.flameMesh=null;
  G.combatOn=false;G.order=[];G.turnIdx=-1;G.current=null;
  setActionbarVisible(false);
  bus.refreshBossBar.call();
}
/* v1.1: сборка карты без фейда — общее ядро switchMap и загрузки сейва.
   spots — точки размещения героев (null — не трогать позиции). */
export function buildMap(id:MapId,spots:number[][]|null){
  G.mapId=id;
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
  }else if(id==='swamp'){/* v1.5: болота культистов */
    seedSwamp();applyAtmosphere('swamp');
    buildWorld();buildSwampScenery();spawnEnemies();
    if(spots)placeHeroes(spots);
    controls.target.set(14,0,14);
    startSwampQuest();
    const ub=units.find(u=>u.swampBoss);
    if(ub)void upgradeUnitRig(ub,{tint:0x4a6a4f,tintStrength:0.5,scale:1.16,yaw:Math.PI});
    log('Болота культистов. Зелёный туман, тина по колено и песня из глубины.','g-sys');
  }else if(id==='giants'){/* v1.6: перевал великанов */
    seedGiants();applyAtmosphere('giants');
    buildWorld();buildGiantsScenery();buildCitadelTrail();/* v1.8: тракт к цитадели за мостом */
    spawnEnemies();
    if(spots)placeHeroes(spots);
    controls.target.set(14,0,14);
    startGiantsQuest();
    const gb=units.find(u=>u.giantBoss);
    if(gb)void upgradeUnitRig(gb,{tint:0x8a7a5f,tintStrength:0.5,scale:1.3,yaw:Math.PI});
    log('Перевал великанов. Холодный ветер, грохот камней и хруст костей у огрского костра.','g-sys');
  }else if(id==='citadel'){/* v1.8: цитадель Долгого Дозора — финал кампании */
    seedCitadel();applyAtmosphere('citadel');
    buildWorld();buildCitadelScenery();spawnEnemies();
    if(spots)placeHeroes(spots);
    controls.target.set(14,0,14);
    startCitadelQuest();
    const lb=units.find(u=>u.citadelBoss);
    if(lb)void upgradeUnitRig(lb,{tint:0x4a6a5f,tintStrength:0.5,scale:1.18,yaw:Math.PI});
    log('Цитадель Долгого Дозора. Изумрудная мгла, песня в камне и зелёные бразиры. Где-то здесь — лорд-комендант Малвех.','g-sys');
  }else{
    seedForest();applyAtmosphere('forest');
    buildWorld();buildForestScenery();buildSwampTrail();buildGiantsTrail();/* v1.5: гать на болота; v1.6: тропа на перевал */
    spawnEnemies();
    if(spots)placeHeroes(spots);
    controls.target.set(1,0,12);
    log('Вы поднимаетесь на тракт. Ветер и пение птиц — мертвецы больше не тревожат дорогу.','g-sys');
  }
  initOverlays();
  G.phase='explore';
  setRound(MAP_NAME[G.mapId]);
}
/* v0.8: смена карты — телепорт отряда, разбор старой декорации, сборка новой */
export async function switchMap(id:MapId):Promise<void>{
  if(G.busy||G.mapId===id||G.phase==='transition')return;
  busyOn();G.phase='transition';
  sfx.portal();
  const f=$(UI.fade);
  f.style.opacity='1';
  await sleep(620);
  teardownWorld();
  buildMap(id,id==='swamp'?SWAMP.ENTER:(id==='giants'?GIANTS.ENTER:(id==='citadel'?CITADEL.ENTER:CRYPT.ENTER)));/* v1.5: болота; v1.6: перевал; v1.8: цитадель */
  f.style.opacity='0';
  bus.openExploreUI.call();
  refreshTracker();bus.refreshParty.call();bus.refreshBossBar.call();
  busyOff();
}

/* ---- регистрация на шине (Фаза 5: explore → switchMap без цикла) ---- */
bus.switchMap.bind(switchMap);
