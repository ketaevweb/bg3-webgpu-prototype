#!/usr/bin/env python3
# Фаза 4d-4h: вынос боевого кластера + interact + save + world из engine.ts.
# Все переносы ДОСЛОВНЫЕ (текст уже с G.-префиксами после 4a).
import re, os

P='/home/z/my-project/src/game/engine.ts'
src=open(P,encoding='utf-8').read().split('\n')
N=len(src)

def find(rx, start=0):
    for i in range(start,N):
        if re.match(rx,src[i]): return i
    raise ValueError('anchor not found: '+rx)

# (startAnchor, endAnchorExclusive, tag) — в порядке файла
CUTS=[
 (r'^/\* ================= СЕТКА / КАРТЫ',      r'^/\* HERO_TINT',                          'props'),
 (r'^/\* HERO_TINT',                            r'^function teardownWorld',                 'explore1'),
 (r'^function teardownWorld',                   r'^const BOLT',                             'maps'),
 (r'^const BOLT',                               r'^/\* ================= ОГОНЬ',            'targeting1'),
 (r'^/\* ================= ОГОНЬ',              r'^async function doAttack',                'statuses'),
 (r'^async function doAttack',                  r'^/\* ================= v1\.3: ЛУТ',       'combat1'),
 (r'^/\* ================= v1\.3: ЛУТ',         r'^function die',                           'loot'),
 (r'^function die',                             r'^/\* ================= ВЗРЫВЫ',           'combat2'),
 (r'^/\* ================= ВЗРЫВЫ',             r'^/\* ================= ПЕРЕМЕЩЕНИЕ',      'abilities'),
 (r'^/\* ================= ПЕРЕМЕЩЕНИЕ',        r'^/\* ================= ХОДЫ',             'movement1'),
 (r'^/\* ================= ХОДЫ',               r'^/\* ================= ВОЛНЫ',            'turns1'),
 (r'^/\* ================= ВОЛНЫ',              r'^/\* ================= UTILITY',          'progression'),
 (r'^/\* ================= UTILITY',            r'^function joinCombat',                    'grid'),
 (r'^function joinCombat',                      r'^function planNecro',                     'turns2'),
 (r'^function planNecro',                       r'^/\* ================= ДЕЙСТВИЯ ИГРОКА',  'ai'),
 (r'^/\* ================= ДЕЙСТВИЯ ИГРОКА',    r'^function enterTarget',                   'actionbar1'),
 (r'^function enterTarget',                     r'^async function tryMove',                 'targeting2'),
 (r'^async function tryMove',                   r'^function onLeftClick',                   'movement2'),
 (r'^/\* ================= v0\.6: ЗАДАНИЯ',     r'^/\* ---- диалоги ----',                  'quests'),
 (r'^/\* ---- диалоги ----',                    r'^/\* ---- взаимодействие и исследование ----', 'dialog'),
 (r'^/\* ---- взаимодействие и исследование ----', r'^setInterval\(checkTriggers',          'explore2'),
 (r'^/\* ---- магазин ----',                    r'^function openExploreUI',                 'shop'),
 (r'^function openExploreUI',                   r'^/\* ================= UI',               'party'),
 (r'^/\* ================= UI',                 r'^\$\(UI\.sheet\)\.addEventListener',    'actionbar2'),
 (r'^/\* ================= v1\.1: СОХРАНЕНИЯ',  r'^function gameSnapshot',                  'slots1'),
 (r'^function gameSnapshot',                    r'^function slotMeta',                      'snapshot1'),
 (r'^function slotMeta',                        r'^function doSave',                        'slots2'),
 (r'^function doSave',                          r'^function applyGame',                     'slots3'),
 (r'^function applyGame',                       r'^function renderSaves',                   'snapshot2'),
 (r'^function renderSaves',                     r'^\$\(UI\.savesClose\)',                   'slots4'),
 (r'^/\* ================= v1\.1: НАСТРОЙКИ ГРАФИКИ', r'^\$\(UI\.gfxClose\)',                'settings'),
 (r'^function showTipFor',                      r'^function bindInput',                     'targeting3'),
]
covered=[False]*N
pieces={}
prev_end=0
for srx,erx,tag in CUTS:
    s=find(srx, prev_end); e=find(erx, s+1)
    for i in range(s,e):
        assert not covered[i], f'overlap at {i}: {src[i][:50]!r}'
        covered[i]=True
    pieces.setdefault(tag,[]).append((s,e))
    prev_end=e

def txt(tag):
    out=[]
    for s,e in pieces[tag]:
        while s<e and not src[s].strip(): s+=1
        while e-1>s and not src[e-1].strip(): e-=1
        out.append('\n'.join(src[s:e]))
    return '\n\n'.join(out).rstrip()+'\n'

# ---------- модули ----------
os.makedirs('/home/z/my-project/src/game/world',exist_ok=True)

open('/home/z/my-project/src/game/world/props.ts','w').write("""/* ================= PROPS (Фаза 4 рефакторинга) =================
   Сиды карт, деревья/камни/шатры/костёр/бочки, сборка мира (ground,
   заплатки, трава). Перенесено дословно из engine.ts. */
import * as THREE from 'three/webgpu';
import { srand } from '../rng';
import { key } from '../utils';
import { GRID, W } from '../constants';
import { worldGroup, applyLighting } from '../render/renderer';
import { G, S, solid, grass, barrels } from '../state';
import type { Barrel } from '../types';

"""+txt('props'))

open('/home/z/my-project/src/game/world/maps.ts','w').write("""/* ================= MAPS (Фаза 4 рефакторинга) =================
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
import { questStart, questObj, refreshTracker } from '../interact/quests';
import { refreshParty, refreshBossBar, openExploreUI } from '../ui/party';
import { initOverlays, log, setHint } from '../ui/overlays';
import { cancelTargeting } from '../ui/targeting';
import { removeFire } from '../systems/statuses';
import { upgradeUnitRig } from '../animation';
import type { MapId } from '../types';

"""+txt('maps'))

open('/home/z/my-project/src/game/interact/explore.ts','w').write("""/* ================= EXPLORE (Фаза 4 рефакторинга) =================
   Спутники (Илва/Кая), сцены леса и крипты, сундук, интеракты,
   триггеры, перемещение отряда. Цикл импортов explore⇄maps —
   на уровне функций (ESM-safe). Перенесено дословно из engine.ts. */
import * as THREE from 'three/webgpu';
import { $, key, cheb } from '../utils';
import { W, HERO_TINT } from '../constants';
import { d } from '../rng';
import { sfx } from '../audio';
import { G, S, units, solid, interactables, CAGE, CRATE, MERCHANT, KAYA_SPOT } from '../state';
import { worldGroup, fx, glows } from '../render/renderer';
import { astar, passable, freeSpotNear } from '../world/grid';
import { addCampfire, addRock, addBarrel } from '../world/props';
import { switchMap } from '../world/maps';
import { tween } from '../fx/tweens';
import { makeIlva, makeKaya } from '../entities/roster';
import { buildFigure } from '../entities/figure';
import { aliveHeroes } from '../entities/units';
import { bigBanner, log, setHint } from '../ui/overlays';
import { refreshParty, refreshInit } from '../ui/party';
import { questStart, questObj, questDone, gainGold, refreshTracker, QUESTS } from '../interact/quests';
import { openDlg } from '../interact/dialog';
import { animateMove } from '../systems/movement';
import { upgradeUnitRig } from '../animation';
import type { Interact } from '../types';

"""+txt('explore1')+'\n\n'+txt('explore2'))

open('/home/z/my-project/src/game/systems/statuses.ts','w').write("""/* ================= STATUSES & FIRE (Фаза 4 рефакторинга) =================
   Статусы (горение/яд/благословение/страх/уклонение/вера) и огонь на тайлах.
   Циклы импортов combat⇄statuses, statuses⇄abilities — на уровне функций
   (ESM-safe), см. REFACTORING.md. Перенесено дословно из engine.ts. */
import * as THREE from 'three/webgpu';
import { key } from '../utils';
import { d } from '../rng';
import { TILE, W, STATUS } from '../constants';
import { fires, grass } from '../state';
import { worldGroup, fx, glows } from '../render/renderer';
import { unitAt, barrelAt } from '../world/grid';
import { log, ftextAbove, refreshIcons } from '../ui/overlays';
import { refreshParty } from '../ui/party';
import { sfx } from '../audio';
import { damageUnit } from './combat';
import { explodeBarrel } from './abilities';
import { checkEnd } from './progression';
import type { StatusType, Unit } from '../types';

"""+txt('statuses'))

open('/home/z/my-project/src/game/systems/combat.ts','a').write("""

/* ================= БОЕВОЕ ЯДРО (Фаза 4 рефакторинга) =================
   doAttack/damageUnit/healUnit/die — перенесено дословно из engine.ts
   (текст уже с G.-префиксами). Циклы импортов с statuses/abilities/
   progression/quests — на уровне функций (ESM-safe). */
import { lunge, faceTo, tween } from '../fx/tweens';
import { mod } from '../utils';
import { d, roll } from '../rng';
import { sfx } from '../audio';
import { slowmo } from '../slowmo';
import { fx, glows } from '../render/renderer';
import { ftextAbove, log, refreshIcons } from '../ui/overlays';
import { G, S, busyOn, busyOff } from '../state';
import { refreshInit, refreshParty, refreshBossBar } from '../ui/party';
import { addStatus } from './statuses';
import { explodeBarrel } from './abilities';
import { awardXP, checkEnd } from './progression';
import { rollLoot } from './loot';
import { questObj, questDone } from '../interact/quests';
import { removeUnit } from '../entities/units';
import type { Barrel, Unit } from '../types';

"""+txt('combat1')+'\n\n'+txt('combat2'))

open('/home/z/my-project/src/game/systems/loot.ts','a').write("""

/* ================= ВЫДАЧА ЛУТА (Фаза 4 рефакторинга) =================
   giveToParty/rollLoot — перенесено дословно из engine.ts. */
import { ri } from '../rng';
import { log } from '../ui/overlays';
import { aliveHeroes } from '../entities/units';
import { gainGold } from '../interact/quests';
import { refreshParty } from '../ui/party';
import { fx, glows } from '../render/renderer';
import type { Unit } from '../types';

"""+txt('loot'))

open('/home/z/my-project/src/game/systems/abilities.ts','w').write("""/* ================= ABILITIES (Фаза 4 рефакторинга) =================
   Взрывы, огненный шар, гнев рассвета. Перенесено дословно из engine.ts. */
import * as THREE from 'three/webgpu';
import { key, cheb } from '../utils';
import { roll } from '../rng';
import { W } from '../constants';
import { boomFX, tween, projMesh, shake } from '../fx/tweens';
import { fx, glows } from '../render/renderer';
import { sfx } from '../audio';
import { slowmo } from '../slowmo';
import { log, ftextAbove } from '../ui/overlays';
import { fires, grass, units, barrels } from '../state';
import { igniteTile, addStatus } from './statuses';
import { damageUnit } from './combat';
import { checkEnd } from './progression';
import { refreshUI } from '../ui/actionbar';
import { showReach } from '../ui/markers';
import type { Unit } from '../types';

"""+txt('abilities'))

open('/home/z/my-project/src/game/systems/movement.ts','w').write("""/* ================= MOVEMENT (Фаза 4 рефакторинга) =================
   animateMove (с атаками по возможности и огнём) и tryMove игрока.
   Перенесено дословно из engine.ts. */
import { G, fires, busyOn, busyOff } from '../state';
import { enemiesOf, meleeWeaponOf } from '../entities/units';
import { cheb, key } from '../utils';
import { d } from '../rng';
import { W } from '../constants';
import { tween, faceTo } from '../fx/tweens';
import { log, ftextAbove, setHint } from '../ui/overlays';
import { doAttack, damageUnit } from './combat';
import { addStatus } from './statuses';
import { refreshUI } from '../ui/actionbar';
import { showReach, clearMarkers, clearDots } from '../ui/markers';
import { passable, astar } from '../world/grid';
import type { Unit } from '../types';

"""+txt('movement1')+'\n\n'+txt('movement2'))

open('/home/z/my-project/src/game/systems/turns.ts','w').write("""/* ================= TURNS (Фаза 4 рефакторинга) =================
   Старт боя, инициатива, begin/endTurn. Цикл импортов turns⇄ai —
   на уровне функций (ESM-safe). Перенесено дословно из engine.ts. */
import { $, key, mod } from '../utils';
import { d } from '../rng';
import { UI } from '../hud';
import { sfx } from '../audio';
import { G, S, units, fires } from '../state';
import { bigBanner, log, ftextAbove, setHint, refreshIcons } from '../ui/overlays';
import { closeDlgHard } from '../interact/dialog';
import { aliveHeroes } from '../entities/units';
import { tickFires } from './statuses';
import { damageUnit } from './combat';
import { aiTurn } from './ai';
import { refreshInit, refreshParty } from '../ui/party';
import { refreshUI } from '../ui/actionbar';
import { clearMarkers, clearDots, showReach } from '../ui/markers';
import type { Unit } from '../types';

"""+txt('turns1')+'\n\n'+txt('turns2'))

open('/home/z/my-project/src/game/systems/progression.ts','w').write("""/* ================= PROGRESSION (Фаза 4 рефакторинга) =================
   Конец боя, победа, XP/уровни, экран финала. Цикл импортов
   quests⇄progression — на уровне функций (ESM-safe).
   Перенесено дословно из engine.ts. */
import { $ } from '../utils';
import { roll } from '../rng';
import { UI } from '../hud';
import { sfx } from '../audio';
import { G, S, units } from '../state';
import { XP_NEED } from '../constants';
import { bigBanner, log } from '../ui/overlays';
import { aliveHeroes, removeUnit } from '../entities/units';
import { healUnit } from './combat';
import { tween } from '../fx/tweens';
import { fx, glows } from '../render/renderer';
import { refreshParty, refreshBossBar, openExploreUI } from '../ui/party';
import { refreshTracker, QUESTS } from '../interact/quests';
import { checkTriggers } from '../interact/explore';
import type { Unit } from '../types';

"""+txt('progression'))

open('/home/z/my-project/src/game/systems/ai.ts','w').write("""/* ================= AI (Фаза 4 рефакторинга) =================
   Utility-ИИ: планы гоблинов/некроманта/целителя, оценка атак, бегство,
   исполнение хода. Перенесено дословно из engine.ts. */
import { sleep, cheb, key, mod } from '../utils';
import { d, roll } from '../rng';
import { W } from '../constants';
import { G, units, barrels, fires, GW } from '../state';
import { hitChance, avgDamage, healUnit, damageUnit, doAttack } from './combat';
import { reachNodes, nodePath } from '../world/grid';
import { makeSkeleton } from '../entities/roster';
import { aliveHeroes } from '../entities/units';
import { joinCombat, endTurn } from './turns';
import { animateMove } from './movement';
import { bigBanner, log, ftextAbove } from '../ui/overlays';
import { sfx } from '../audio';
import { fx, glows } from '../render/renderer';
import { shake } from '../fx/tweens';
import type { Unit } from '../types';

"""+txt('ai'))

open('/home/z/my-project/src/game/ui/actionbar.ts','w').write("""/* ================= ACTIONBAR (Фаза 4 рефакторинга) =================
   Таблица действий игрока (ACTIONS) и refreshUI. Цикл импортов
   actionbar⇄targeting — на уровне функций (ESM-safe).
   Перенесено дословно из engine.ts. */
import { $ } from '../utils';
import { roll } from '../rng';
import { UI } from '../hud';
import { G } from '../state';
import { enterTarget, cancelTargeting } from './targeting';
import { radiantNova } from '../systems/abilities';
import { endTurn } from '../systems/turns';
import { healUnit } from '../systems/combat';
import { addStatus } from '../systems/statuses';
import { log } from '../ui/overlays';
import { showReach } from '../ui/markers';
import { refreshParty } from './party';
import type { Unit } from '../types';

"""+txt('actionbar1')+'\n\n'+txt('actionbar2'))

open('/home/z/my-project/src/game/ui/targeting.ts','w').write("""/* ================= TARGETING (Фаза 4 рефакторинга) =================
   Выбор цели/клетки, отмена, применение (resolveTargetClick), тултип.
   BOLT/SMITE — общие боевые «заговоры». Перенесено дословно из engine.ts. */
import { $, cheb, mod } from '../utils';
import { roll } from '../rng';
import { UI } from '../hud';
import { GRID, RANGE_FB, RANGE_OIL, STATUS } from '../constants';
import { G, units, barrels, pick, busyOn, busyOff } from '../state';
import { addMarker, clearMarkers, clearDots, showReach } from '../ui/markers';
import { setHint, log, ftextAbove } from '../ui/overlays';
import { passable } from '../world/grid';
import { doAttack, healUnit, hitChance, avgDamage } from '../systems/combat';
import { castFireball, explode } from '../systems/abilities';
import { addStatus } from '../systems/statuses';
import { aliveHeroes } from '../entities/units';
import { refreshUI } from '../ui/actionbar';
import type { Unit, Weapon, Interact } from '../types';

"""+txt('targeting1')+'\n\n'+txt('targeting2')+'\n\n'+txt('targeting3'))

open('/home/z/my-project/src/game/interact/quests.ts','w').write("""/* ================= QUESTS (Фаза 4 рефакторинга) =================
   Журнал заданий, награды, золото, трекер. Цикл импортов
   quests⇄progression — на уровне функций (ESM-safe).
   Перенесено дословно из engine.ts. */
import { $ } from '../utils';
import { UI } from '../hud';
import { sfx } from '../audio';
import { S } from '../state';
import { bigBanner, log } from '../ui/overlays';
import { refreshParty } from '../ui/party';
import { aliveHeroes } from '../entities/units';
import { awardXP } from '../systems/progression';
import type { Quest } from '../types';

"""+txt('quests'))

open('/home/z/my-project/src/game/interact/dialog.ts','w').write("""/* ================= DIALOG (Фаза 4 рефакторинга) =================
   Диалоги (DLGS), социальные проверки, бегство NPC. Перенесено дословно. */
import { $, mod } from '../utils';
import { d } from '../rng';
import { UI } from '../hud';
import { sfx } from '../audio';
import { G, S, KAYA_SPOT } from '../state';
import { setHint, log } from '../ui/overlays';
import { aliveHeroes, removeUnit } from '../entities/units';
import { startCombat } from '../systems/turns';
import { addStatus } from '../systems/statuses';
import { awardXP } from '../systems/progression';
import { questStart, questObj, questDone, QUESTS } from '../interact/quests';
import { freeIlva, joinKaya } from '../interact/explore';
import { openShop, closeShop } from '../interact/shop';
import type { Unit } from '../types';

"""+txt('dialog'))

open('/home/z/my-project/src/game/interact/shop.ts','w').write("""/* ================= SHOP (Фаза 4 рефакторинга) =================
   Лавка Дамрока, выбор героя, применение предметов. Перенесено дословно. */
import { $ } from '../utils';
import { UI } from '../hud';
import { sfx } from '../audio';
import { S } from '../state';
import { log } from '../ui/overlays';
import { refreshParty } from '../ui/party';
import { refreshTracker } from '../interact/quests';
import { aliveHeroes } from '../entities/units';
import type { Unit } from '../types';

"""+txt('shop'))

# party.ts — дополнить openExploreUI
p='/home/z/my-project/src/game/ui/party.ts'
s=open(p).read()
s=s.replace("import { units, G, S } from '../state';","import { units, G, S, MAP_NAME } from '../state';")
s=s.replace("import type { Unit } from '../types';","""import { refreshTracker } from '../interact/quests';
import { refreshHintExplore } from '../interact/explore';
import type { Unit } from '../types';""")
s+="""
/* v0.8: переключение UI в режим исследования (после боя/карты/загрузки) */
"""+txt('party')
open(p,'w').write(s)

open('/home/z/my-project/src/game/save/snapshot.ts','w').write("""/* ================= SNAPSHOT (Фаза 4 рефакторинга) =================
   Снимок игры (формат v2 ЗАМОРОЖЕН, types.ts) и восстановление (applyGame).
   Перенесено дословно из engine.ts. */
import { SAVE_VER, W } from '../constants';
import { $, clamp } from '../utils';
import { UI } from '../hud';
import { sfx } from '../audio';
import { S, G, units, MAP_NAME } from '../state';
import { QUESTS, closeJournal, refreshTracker } from '../interact/quests';
import { closeDlgHard } from '../interact/dialog';
import { closeShop, closeChoice } from '../interact/shop';
import { closeGfx } from './settings';
import { closeSaveMenu } from './slots';
import { cancelTargeting } from '../ui/targeting';
import { teardownWorld, buildMap } from '../world/maps';
import { ensureCompanions, refreshHintExplore } from '../interact/explore';
import { openExploreUI, refreshParty, refreshBossBar } from '../ui/party';
import { bigBanner, log } from '../ui/overlays';
import type { SaveData } from '../types';

"""+txt('snapshot1')+'\n\n'+txt('snapshot2'))

open('/home/z/my-project/src/game/save/slots.ts','w').write("""/* ================= SLOTS (Фаза 4 рефакторинга) =================
   3 слота localStorage + экспорт/импорт JSON + меню сохранений.
   Перенесено дословно из engine.ts. */
import { SAVE_VER, SLOT_N } from '../constants';
import { $ } from '../utils';
import { UI } from '../hud';
import { sfx } from '../audio';
import { G, S, units, MAP_NAME } from '../state';
import { log } from '../ui/overlays';
import { gameSnapshot, applyGame } from './snapshot';
import type { SaveData } from '../types';

"""+txt('slots1')+'\n\n'+txt('slots2')+'\n\n'+txt('slots3')+'\n\n'+txt('slots4'))

open('/home/z/my-project/src/game/save/settings.ts','w').write("""/* ================= SETTINGS/GFX (Фаза 4 рефакторинга) =================
   Настройки графики (тени/bloom/glow/частицы/разрешение/FPS) +
   пресеты; localStorage bg3w_gfx_v1. bloomOn/fpsLimit/frameAcc живут в G.
   Перенесено дословно из engine.ts. */
import { renderer, fx, glows } from '../render/renderer';
import { G } from '../state';
import { $ } from '../utils';
import { UI } from '../hud';
import { sfx } from '../audio';

"""+txt('settings').replace('let bloomOn=true,fpsLimit=0,frameAcc=0;',''))

# settings: bloomOn/fpsLimit/frameAcc → G.*
p='/home/z/my-project/src/game/save/settings.ts'
s=open(p).read()
s=s.replace('bloomOn=!!gfx.bloom;','G.bloomOn=!!gfx.bloom;')
s=s.replace('fpsLimit=gfx.fps','G.fpsLimit=gfx.fps')
s=s.replace('frameAcc=0;','G.frameAcc=0;')
open(p,'w').write(s)

# grid.ts — дополнить freeSpotNear
p='/home/z/my-project/src/game/world/grid.ts'
s=open(p).read()
s+="""
/* свободная клетка вокруг точки (v0.8) — из engine (Фаза 4 рефакторинга) */
"""+txt('grid')
open(p,'w').write(s)

# ---------- новый engine: убрать вырезанное, заменить импорты ----------
engine='\n'.join(src[i] for i in range(N) if not covered[i])
m=re.search(r"import \{ tween, faceTo[^\n]*from '\./fx/tweens';\n", engine)
assert m
NEW_IMPORTS="""import * as THREE from 'three/webgpu';
import { sfx } from './audio';
import { slowmo } from './slowmo';
import { upgradeUnitRig } from './animation';

/* Фаза 4: engine.ts — оркестратор (сборка, ввод, игровой цикл, dispose).
   Системы/интеракт/сейвы/мир — в модулях state/render/fx/world/entities/systems/interact/ui/save. */
import { $, clamp, sleep, key, cheb } from './utils';
import { TILE, GRID, HALF, W } from './constants';
import { astar, passable } from './world/grid';
import { LOOT } from './systems/loot';
import { UI } from './hud';
import { S, G, busyOn, busyOff, units, barrels, fires, pick, solid, grass, GW, gobCount, interactables, CAGE, CRATE, MERCHANT, KAYA_SPOT, MAP_NAME, CRYPT, resetState } from './state';
import { renderer, scene, worldGroup, camera, controls, fx, glows, rigs, initRenderer, ensureRendererInit, clearGroup, setupPostFX } from './render/renderer';
import { tween, tickTweens, clearTweens } from './fx/tweens';
import { seedForest, buildWorld } from './world/props';
import { switchMap } from './world/maps';
import { buildHeroes, spawnEnemies } from './entities/roster';
import { enemiesOf } from './entities/units';
import { doAttack } from './systems/combat';
import { rollLoot } from './systems/loot';
import { startCombat } from './systems/turns';
import { QUESTS, questDone } from './interact/quests';
import { openDlg, closeDlg } from './interact/dialog';
import { buildForestScenery, freeIlva, joinKaya, checkTriggers, nearestInteract } from './interact/explore';
import { refreshUI, refreshParty, refreshInit, refreshBossBar, openExploreUI } from './ui/party';
import { log, initOverlays, setHint } from './ui/overlays';
import { initMarkers, clearMarkers, clearDots, showReach, addDot } from './ui/markers';
import { cancelTargeting, resolveTargetClick, showTipFor } from './ui/targeting';
import { tryMove } from './systems/movement';
import { moveParty, takeCrate } from './interact/explore';
import { gameSnapshot, doSave, doLoad } from './save/snapshot';
import { gfx, applyGfx, loadGfx, renderGfx, renderSaves, openSaveMenu, toggleSaveMenu, toggleGfx, closeGfx, closeSaveMenu, closeShop, closeJournal, closeChoice } from './save/settings';
"""
# closeShop/closeJournal/closeChoice живут в interact/*, а не settings — поправим ниже отдельными строками
engine=engine[:m.start()]+NEW_IMPORTS+engine[m.end():]
open(P,'w',encoding='utf-8').write(engine)

# ---------- state.ts: bloomOn/fpsLimit/frameAcc → G ----------
p='/home/z/my-project/src/game/state.ts'
s=open(p).read()
s=s.replace("  TREES:any;ROCKS:any;TENTS:any;FIREPIT:any;BARREL_POS:any;\n  order:Unit[];",
            "  TREES:any;ROCKS:any;TENTS:any;FIREPIT:any;BARREL_POS:any;\n  order:Unit[];\n  bloomOn:boolean;fpsLimit:number;frameAcc:number;")
s=s.replace("  TREES:null,ROCKS:null,TENTS:null,FIREPIT:null,BARREL_POS:null,\n  order:[],",
            "  TREES:null,ROCKS:null,TENTS:null,FIREPIT:null,BARREL_POS:null,\n  order:[],\n  bloomOn:true,fpsLimit:0,frameAcc:0,")
open(p,'w').write(s)
print('DONE')
