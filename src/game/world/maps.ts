/* ================= MAPS (Фаза 4 рефакторинга) =================
   teardown/buildMap/switchMap — пересборка мира между лесом и криптой.
   Цикл импортов explore⇄maps — на уровне функций (ESM-safe), см. REFACTORING.md.
   Перенесено дословно из engine.ts. */
import { $, sleep } from '../utils';
import { UI } from '../hud';
import { sfx } from '../audio';
import { G, S, CRYPT, MAP_NAME, units, barrels, fires, interactables, busyOn, busyOff } from '../state';
import { worldGroup, fx, glows, controls, clearGroup, applyAtmosphere } from '../render/renderer';
import { seedForest, seedCrypt, buildWorld, addBarrel } from './props';
import { buildForestScenery, buildCryptScenery } from '../interact/explore';
import { spawnEnemies } from '../entities/roster';
import { removeUnit, placeHeroes } from '../entities/units';
import { QUESTS, questStart, questObj, refreshTracker } from '../interact/quests';
import { refreshParty, refreshBossBar, openExploreUI } from '../ui/party';
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
  $(UI.actionbar).style.display='none';
  refreshBossBar();
}
/* v1.1: сборка карты без фейда — общее ядро switchMap и загрузки сейва.
   spots — точки размещения героев (null — не трогать позиции). */
export function buildMap(id,spots){
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
  }else{
    seedForest();applyAtmosphere('forest');
    buildWorld();buildForestScenery();spawnEnemies();
    if(spots)placeHeroes(spots);
    controls.target.set(1,0,12);
    log('Вы поднимаетесь на тракт. Ветер и пение птиц — мертвецы больше не тревожат дорогу.','g-sys');
  }
  initOverlays();
  G.phase='explore';
  $(UI.round).textContent=MAP_NAME[G.mapId];
}
/* v0.8: смена карты — телепорт отряда, разбор старой декорации, сборка новой */
export async function switchMap(id){
  if(G.busy||G.mapId===id||G.phase==='transition')return;
  busyOn();G.phase='transition';
  sfx.portal();
  const f=$(UI.fade);
  f.style.opacity='1';
  await sleep(620);
  teardownWorld();
  buildMap(id,CRYPT.ENTER);
  f.style.opacity='0';
  openExploreUI();
  refreshTracker();refreshParty();refreshBossBar();
  busyOff();
}
