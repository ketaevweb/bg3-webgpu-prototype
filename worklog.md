# Worklog — BG3 WebGPU Prototype

---
Task ID: 1
Agent: main (Z.ai)
Task: v1.2 «Отряд Долгого Дозора» — партия из четырёх героев (спутницы Илва-плут и жрица Кая)

Work Log:
- Проверил состояние репо: v0.8 (крипта/босс) и v1.1 (сейвы/графика) уже закоммичены; dev-сервер жив на :3000
- Прочитал engine.js полностью (2665 строк), hud.ts, game.css, layout.tsx, README.md
- engine.js: добавил статусы dodge (КД+3) и faith (КД+2), хук в hitChance — теперь баффы снижают шанс попадания врагов
- engine.js: makeIlva (плут: лук 1d6+ЛОВ, дальн.8, кинжал, КД 14) и makeKaya (жрица: булава, КД 15, 2 ячейки, МДР 16)
- engine.js: новые действия ACTIONS — Подлый удар (+1d6/2d6 во фланге через opts.sneakBonus в doAttack), Отравленный клинок (poisonBlade, яд при ближней атаке), Уклонение; Лечение (1d8+МДР, действие+ячейка), Щит веры, Карание света (SMITE 2d6 излучения), Гнев рассвета (radiantNova: 2d6 вокруг, нежить ×2, 1/бой)
- engine.js: enterTarget/resolveTargetClick расширены типами sneak/smite (выбор врага) и cure (выбор союзника); тултип показывает шанс попадания для новых типов
- engine.js: Илва присоединяется в конце freeIlva() (joinIlva(13,21)), Кая — через диалог 'kaya' у алтаря KAYA_SPOT [15,22] (алтарь: камень, солнечное кольцо, свеча, glow+ember)
- engine.js: ensureCompanions() восстанавливает спутниц по флагам при загрузке сейва (applyGame); CRYPT.ENTER расширено до 4 точек
- engine.js: сейв — флаг kayaJoined в gameSnapshot/applyGame (SAVE_VER=2 сохранён, сейвы v1.1 совместимы); levelUp-ветки rogue/cleric; startCombat сбрасывает dawnUsed; баланс: +1 задира в лагерь, +1 скелет в крипту
- engine.js: rigHero + HERO_TINT — GLTF-риги спутниц; __bg3 экспонирует freeIlva/joinKaya для E2E
- ИСПРАВЛЕН БАГ: joinKaya не выставляла S.kayaJoined=true (Кая пропадала бы после лоада)
- game.css: стили кнопок .rog/.cle; layout.tsx: титул v1.2; README: механики/структура/дорожная карта
- E2E (agent-browser): буст чистый '[bg3] v1.2 boot complete'; свободный boot = 2 героя; после freeIlva+joinKaya — 4 карточки партии; doSave(1)/doLoad(2) — 4 героя восстановлены (hp плута 2→11 из слота); бой: панель Илвы (Подлый удар/Отравленный клинок/Уклонение) и Кая (Лечение/Щит веры/Карание света/Гнев рассвета); Щит веры: ячейки 2→1, иконка «Щ3»; GLTF rigs 3/3; ошибок в консоли нет; скриншот .zscripts/verify-v12.png

Stage Summary:
- v1.2 «Отряд Долгого Дозора» реализован и проверен: партия 4 героев, 7 новых боевых умений, спутницы попадают в сейвы и initiative, баланс врагов поднят
- Формат сейва v2 не сломан — старые сейвы v1.1 загружаются, спутницы досоздаются по флагам
- Дальше по дорожной карте: v1.3 (спеллкастеры крипты, элитные мобы, лут-таблицы), v1.4 (обучение, облако сейвов)

---
Task ID: 2
Agent: main (Z.ai)
Task: v1.3 «Слуги Костепёра» — спеллкастеры крипты, элитные мобы, лут-таблицы (по дорожной карте)

Work Log:
- Уточнил фактическое состояние: v0.8 (крипта/босс), v1.1 (сейвы/графика), v1.2 (партия из 4) уже в репо; v1.3 взял из дорожной карты README
- engine.js: новые враги — CULT (культист: некротический сгусток 1d6+ИНТ/дальн.7/яд; ученик-целитель: луч могильного холода 1d8+ИНТ, healer:true), SKEL_KNIGHT (скелет-рыцарь, клеймор 1d8), GOB.veteran (двуручный тесак 1d10)
- engine.js: applyElite(u) — общий класс элиты: elite=true, масштаб ×1.16, золотое кольцо (учтено в beginTurn), строка в features
- engine.js: ИИ целителя — ветка в planGoblin (латает союзников <65% HP могильной песнью 2d4+ИНТ, приоритет боссу) + обработчик plan.type='heal' в aiTurn
- engine.js: лут-таблицы LOOT (goblin/undead/cultist/boss: золото, шанс зелья/масла) + rollLoot в die() вместо фиксированных 3-9 золота; giveToParty (зелье — самому раненому, масло — случайному); призывы (summoned) лута не дают
- engine.js: реликвии элиты — Костяной оберег (+1 КД), Пыльный фолиант (+1 ячейка), Трофейный клык (+1 СИЛ); одна на героя (h.relic), поле relic в gameSnapshot/applyGame (формат сейва v2 не сломан)
- engine.js: спавн — лагерь: +ветеран-элита (22,8); крипта: некромант + 2 скелета + скелет-рыцарь(элита, 14,6) + 2 культиста (11,4/17,4) + ученик-целитель(элита, 15,6)
- engine.js: тултип — метка «· ЭЛИТА», подсказка целителю; удалён дубль диалога DLGS.necro (второй блок перезаписывал первый)
- __bg3 экспонирует rollLoot/LOOT; boot-логи и маркер '[bg3] v1.3 boot complete'; hud.ts/layout.tsx/README — версия v1.3
- E2E (agent-browser): boot чистый (WebGL2, bloom); ветеран в лесу (elite, scale 1.16); rollLoot: элита +10 зол., призыв пропущен; switchMap('crypt') — гарнизон 7 (2 элиты, ученик healer:true); бой стартует, инициатива всех 9, ИИ сближается (рывок/дэш), ошибок нет; скриншот .zscripts/verify-v13.png; dev.log чист

Stage Summary:
- v1.3 «Слуги Костепёра» реализован и проверен: 4 новых типа врагов, класс элиты, лут-таблицы с реликвиями
- Сейв v2 остался совместимым (relic — опциональное поле)
- Дальше по дорожной карте: v1.4 (обучение, облако сейвов, полировка/баланс)

---
Task ID: 3
Agent: main (Z.ai)
Task: План рефакторинга — декомпозиция god-объекта engine.js (~3000 строк) и унификация на TS

Work Log:
- Снял фактические метрики: engine.js 2974 строки = 71% игрового кода; ~95 функций в одном замыкании bootGame(); периферия (audio/particles/glow/animation/slowmo/hud) уже TS; tsconfig: allowJs:true, noImplicitAny:false; перекос three@0.180 vs @types/three@0.186
- Построил карту структуры engine.js (grep-разрез по секциям и функциям: мир/юниты/бой/ИИ/квесты/сейвы/UI)
- Написал REFACTORING.md (корень репо): диагностика, 7 принципов, целевое дерево ~25 модулей (state/render/fx/world/entities/systems/interact/ui/save), решение по переносу состояния (явный контекст G: GameCtx вместо замыкания), фазы 0–5 + опциональная 6 (React-HUD), E2E-список из 9 сценариев как гейт каждой фазы, стандарт TS и tsconfig-рампа, DoD, реестр рисков
- Ключевые решения плана: strangler-fig пофазно (игра играбельна после каждой фазы), коммит+тег на фазу, заморозка контента на время рефакторинга, SAVE_VER=2 не меняется, allowJs:false как замок стандарта

Stage Summary:
- План готов и лежит в REFACTORING.md; ожидает команды «рефакторинг 1» (старт Фазы 0–1: тег-база, typecheck-скрипт, механический перевод engine.js → engine.ts)
- Оценка: ~6 сеансов до DoD (engine.ts ≤800 строк, все модули TS strict, 9 E2E-сценариев зелёные)

---
Task ID: 4
Agent: main (Z.ai)
Task: Рефакторинг, Фазы 0–1 — страховочная база + механический перевод engine.js → engine.ts

Work Log:
- Фаза 0: тег v1.3-refactor-base на базе; npm run typecheck (tsc --noEmit); skills/ исключены из tsconfig (посторонние ошибки); particles.ts — тип spawn() приведён к фактически потребляемым полям (color/life/gravity обязательны, vx/vy/vz опциональны) — базовая линия 0 ошибок
- Фаза 1: git mv engine.js → engine.ts (rename 98%, история сохранена); 581 ошибка strict → 0 за 6 итераций: any[]-аннотации контейнеров (units/order/tweens/pools/fires Map<string,any>), $():HTMLElement, Set<string>/Map<string,any> для A*, опциональные параметры (doAttack opts?, mk dis?/danger?), style.opacity строками (равнозначная CSSOM-коэрция), null-init локали → any (TODO refactor-p3/p4), disposers.pop() с guard, (e.target as HTMLElement).id, (renderer.backend as any)?.isWebGPUBackend
- Правило соблюдено: 0 изменений логики — только аннотации, `?`-параметры, приведения типов; any-долг помечен TODO(refactor-p3/p4) для types.ts
- E2E-гейт (agent-browser): boot '[bg3] v1.3 boot complete' (WebGL2+bloom) без ошибок; старт боя — инициатива/ходы тикают, лог растёт, ошибок нет; сейв doSave(1) → JSON v2 в localStorage → doLoad(1) восстанавливает героев 1-в-1 (fighter hp14 lv1, wizard hp10 lv1, золото 60); скриншот .zscripts/verify-refactor-p1.png
- .gitignore += *.tsbuildinfo; REFACTORING.md — статус Фаз 0–1 ✅
- Git: коммит 46b57c4 + тег refactor-p1; пуш в приватный ketaevweb/bg3-webgpu-prototype с токеном из чата, remote URL очищен после пуша (см. Task 5)

Stage Summary:
- engine.ts компилируется под strict (strictNullChecks), tsc --noEmit = 0 ошибок; поведение идентично v1.3
- Следующий шаг: «рефакторинг 2» — Фаза 2 (чистые листья: rng/utils/constants/grid/боевая математика/лут)

---
Task ID: 5
Agent: main (Z.ai)
Task: Рефакторинг, Фаза 2 — чистые листья (rng/utils/constants/world-grid/боевая математика/лут-таблицы)

Work Log:
- Карта кода: счётчики вызовов сняты до правок (passable ×6 движковых, astar ×4, reachNodes ×6, unitAt/barrelAt ×1+1; cheb/key/mod/roll/d/W/attackMod… — сигнатуры без изменений, только импорт)
- Ключевое наблюдение: srand (mulberry32, сид 20251017) используется ТОЛЬКО для декора мира, бой/лут — на Math.random (d/roll/ri) — детерминизм мира сохраняется модульным синглтоном rng.ts
- Новые модули (все — именованные экспорты, без default): rng.ts (mulberry32/srand/d/roll/ri, 24 строки), utils.ts ($/clamp/mod/sleep/key/cheb, 21), constants.ts (TILE/GRID/HALF/W/XP_NEED/RANGE_FB|OIL/STATUS as const/HERO_TINT as const/SAVE_VER/SLOT_N, 35), world/grid.ts (GridWorld{solid,units,barrels,fires} + passable/unitAt/barrelAt/dangerAt/astar/reachNodes/nodePath — чистые функции с явным контекстом, 105), systems/combat.ts (attackMod/blessed/hitChance/avgDamage — pure, 33), systems/loot.ts (LOOT as const + тип LootKey, 14)
- Решение: W() живёт в constants.ts, а не utils.ts — зависит от TILE/HALF, а листья не импортируют других листьев; GridWorld — предтеча GameCtx (p4a), в engine создан один раз после объявления контейнеров (они никогда не переприсваиваются, только мутируются — проверено grep'ом)
- engine.ts: удалены перенесённые определения (~115 строк), добавлены импорты, `const GW:GridWorld={solid,units,barrels,fires}`; sed-правка 18 вызовов (passable/unitAt/barrelAt/astar/reachNodes — GW первым аргументом); удалён мёртвый топ-левел BARREL_POS (тенился let'ом в замыкании со времён v0.8); rollLoot/giveToParty остались в engine до p4d (нужны log/fx/glows/refreshParty)
- tsc --noEmit: 0 ошибок с первого прохода; engine.ts 2975 → 2860 строк (+232 в 6 модулях)
- E2E-гейт (agent-browser): boot '[bg3] v1.3 boot complete' WebGL2+bloom, rigs 3/3; бой: инициатива 9, ИИ сближается рывками (astar/reachNodes на GW), атака Скимитаром «10 против КД 12 — промах» (боевая математика из systems/combat), урон прошёл (Мирелла 10→3); rollLoot прямой вызов: гоблинская таблица +7 золота (60→67); doSave во время боя корректно отказал (guard combatOn); doSave(1) → JSON v2 (fighter hp14/wizard hp10, золото 60) → порча hp → doLoad(1) восстановил 1-в-1; switchMap('crypt') — гарнизон 7 + Костепёр, обратно в лес — 10 юнитов; ДЕТЕРМИНИЗМ: reload → фазы/позиции всех 10 юнитов совпали до 6 знака (сид srand цел); ошибок консоли нет; скриншот .zscripts/verify-refactor-p2.png
- Git: коммит + тег refactor-p2; пуш в приватный ketaevweb/bg3-webgpu-prototype с токеном из чата, remote URL очищен после пуша

Stage Summary:
- Фаза 2 закрыта: 6 чистых модулей-листьев, GridWorld-контекст для сетки, боевая математика и лут-таблицы типизированы и вынесены; поведение идентично v1.3
- Следующий шаг: «рефакторинг 3» — Фаза 3 (types.ts: Unit/Weapon/Status/Quest/SaveData; UI-реестр в hud.ts; noImplicitAny для новых каталогов; совместимость сейва v2 байт-в-байт)

---
Task ID: 6
Agent: main (Z.ai)
Task: Рефакторинг, Фаза 3 — доменные типы (types.ts), типизация S/юнитов/сейва, UI-реестр id

Work Log:
- Инвентаризация: 47 строковых DOM-id в engine (все есть в HUD_HTML) + #loadBtn2; 7 фаз цикла (idle/ai/dialogue/explore/over/player/transition); поля S вкл. ранее не описанный kayaMesh
- types.ts (новый, лист, ~120 строк): Side/Abil/MapId/StatusType/QuestState/Phase; Status, Weapon (dice/abil/range/melee/fire/smite/necro/status); Unit (~50 полей: ресурсы хода, флаги ИИ/роли, pacified, _el, mesh/rig/phase); Barrel=Unit&{isBarrel:true} (бочка — частичный юнит, полный entity — p4c); UnitTemplate=Partial<Unit>&{name,short,hp,ac,xp,color} — контекстная типизация фабрик GOB/SKEL/SKEL_KNIGHT/CULT; FireTile (g/m1/m2 — Group/Mesh); Interact; Quest/QuestObj; GameState (все 21 поля S); HeroSave/SaveFlags/SaveQuest/SaveData (формат v2 ЗАМОРОЖЕН); PickState
- engine.ts: контейнеры units/order/barrels: Unit[], fires: Map<string,FireTile>, pick: PickState, S: GameState (kayaMesh добавлен), mapId: MapId, phase: Phase; current/targeting остались any c TODO(p4a); makeUnit(cfg:Partial<Unit>&{x,z}):Unit c cast; addBarrel → as unknown as Barrel (частичный юнит, TODO p4c); BOLT/SMITE: Weapon; QUESTS/QUEST_REWARD: Record<string,…>; gameSnapshot():SaveData, readSlot():SaveData|null, slotMeta(sv:SaveData), applyGame(sv:SaveData|null) + (['str'…] as const) для abil-цикла
- UI-реестр: hud.ts + export const UI={…52 id} as const + тип UiId; sed 52× $('#id') → $(UI.id) — строковых селекторов в engine больше НЕТ (проверено rg)
- Листья p2 переведены с any на доменные типы: grid.ts (GridWorld.units/barrels: Unit[], mover/forUnit: Unit, AStarNode{x,z,g,f,p}), combat.ts (attackMod/blessed/hitChance/avgDamage на Unit/Weapon)
- Итерации tsc: 33 → 16 → 0 ошибок. Точечные эквивалентные фиксы: fires.get(k) c if(f)-guard (после has(k)), querySelector<HTMLElement>('.ubar i') c if(bar), (f.m1.material as MeshBasicMaterial), im=S.ilvaMesh as Object3D в freeIlva/takeCrate (сцена гарантированно стоит), showNode: S.dlgNpc?DLGS[S.dlgNpc]:undefined, A* dev-инвариант if(!bn||!bk)break, reachNodes-узлы получили f:0 (поле не используется Dijkstra-логикой)
- tsconfig-рампа: noImplicitAny глобально НЕ включал (95 неявных any-параметров engine — это Фаза 5); новые каталоги (world/, systems/, types.ts) полностью явно типизированы по построению
- Остаточные any в engine: 32 (рендер-пулы/свет/postFX, AI-кандидаты best:any ×8, raycast, current/targeting, relic) — все адресуются при переезде систем в Фазах 4a–4f; any в types/grid — только в комментариях
- E2E-гейт (agent-browser): boot '[bg3] v1.3 boot complete' WebGL2+bloom rigs 3/3; UI-реестр живой — панели gfx (open/close) и saves открываются кликами; бой: старт, инициатива, ИИ действует; doSave во время боя корректно отказал (guard combatOn); doSave(2)/doLoad(2) вне боя: v2, 2 героя (Торик:14/Мирелла:10), золото 60; switchMap('crypt') — босс на месте; БАЙТ-СОВМЕСТИМОСТЬ: gameSnapshot до/после типизации — JSON идентичен 1019 == 1019 байт (без поля when); ошибок консоли нет; скриншот .zscripts/verify-refactor-p3.png
- Git: коммит + тег refactor-p3; пуш в приватный ketaevweb/bg3-webgpu-prototype, remote URL очищен

Stage Summary:
- Фаза 3 закрыта: единый источник доменных типов (types.ts), юниты/сейв/S/контейнеры типизированы, строковые DOM-id заменены реестром UI, листья p2 — на доменных типах; сейв v2 байт-в-байт совместим
- Следующий шаг: «рефакторинг 4» — Фаза 4a (state.ts: S→GameState-модуль + GameCtx, fx/tweens) и далее 4b–4h по одному коммиту на подсистему

---
Task ID: 7
Agent: main (Z.ai)
Task: Рефакторинг, Фаза 4 — вынос stateful-систем (4a–4h), engine.ts → оркестратор

Work Log:
- Карта кода: весь код engine.ts лексически внутри bootGame() (замыкание ~2800 строк, ~95 функций); функции внутри замыкания неэкспортируемы → поэтапный импорт из engine невозможен; вынос построен по слоям зависимостей
- 4a (5917c40): state.ts — S:GameState + G (GameCtx: 26 мутабельных полей замыкания, имена/семантика 1:1) + контейнеры (units/barrels/fires/pick/solid/grass/GW/gobCount/interactables) + константы карт (CAGE/CRATE/MERCHANT/KAYA_SPOT/MAP_NAME/CRYPT) + busyOn/busyOff + resetState(); render/renderer.ts — renderer/scene/worldGroup/camera/controls/fx/glows/rigs + applyAtmosphere/applyLighting/clearGroup/setupPostFX/initRenderer/ensureRendererInit (синглтоны; DOM-подключение только из bootGame); fx/tweens.ts — tween/tickTweens/faceTo/lunge/boomFX/shake/projMesh/clearTweens; G-rewrite: perl 131 ссылка (busy/combatOn/phase/targeting/round/turnIdx/current/uid/shakeT/свет/postFX/mapId/TREES/ROCKS/TENTS/FIREPIT/BARREL_POS/order); Unit.action/bonus стали обязательными (дефолты action:0,bonus:0 в makeUnit — переопределяются beginTurn); h.oil-- → (h.oil||0)-1; удалены мёртвые wave/pendingWave
- 4a-fix (bae7424): НАЙДЕН И ИСПРАВЛЕН ЛАТЕНТНЫЙ БАГ — до фикса dispose() не сбрасывал модульные синглтоны (ремоут дал бы дубли юнитов/стейта); добавлены resetState() (S/G/контейнеры), clearTweens(), guard initMarkers, ensureRendererInit (renderer.init один раз), dispose: снятие мешей юнитов, clearGroup(worldGroup), fx.clearEmbers/glows.clear, clearMarkers/clearDots, resetState, БЕЗ renderer.dispose; ремоут проверен Fast Refresh'ем в бою — чистый стейт
- 4b (b880d4e): ui/overlays.ts (log/projectPos+pv/ftextAbove/setHint/bigBanner/initOverlays/refreshIcons/updateOverlays), ui/markers.ts (пулы 210+36 мешей, mi/di инкапсулированы, showReach), ui/party.ts (refreshParty/refreshBossBar/refreshInit/showSheet); engine 2737→2562
- 4c (c7ae303): entities/figure.ts (buildFigure), entities/units.ts (makeUnit/removeUnit/enemiesOf/meleeWeaponOf/aliveHeroes/placeHeroes), entities/roster.ts (GOB/SKEL/SKEL_KNIGHT/CULT + фабрики + applyElite + buildHeroes + spawnEnemies); engine 2562→2322
- p4-fix2 (cece599): убрано затенение `const interactables` в engine (локальная декларация перебивала импорт из state → resetState чистил не тот массив; стейл-интеракты после ремоута); intersectObjects → flatMap-приведение Interact.mesh
- 4d..h (4d7a4f2) — боевой кластер вынесен атомарно (взаимно-рекурсивный SCC: нельзя вынести doAttack без damageUnit/die/explodeBarrel/refreshUI/...): systems/{statuses(+fire),abilities,movement,turns,ai,progression}, combat.ts+= doAttack/damageUnit/healUnit/die, loot.ts+= giveToParty/rollLoot, world/{props,maps}, interact/{quests,dialog,shop,explore}, ui/{targeting(+BOLT/SMITE/showTipFor),actionbar(ACTIONS/refreshUI)}, party+=openExploreUI, grid.ts+=freeSpotNear, save/{snapshot(gameSnapshot/applyGame),slots(3 слота+экспорт/импорт),settings(gfx)}; G+=bloomOn/fpsLimit/frameAcc (loop читает, applyGfx пишет); engine.ts 2322→299 строк: bootGame() = wiring+boot-IIFE+__bg3+dispose, loop, ввод (castRay/updatePick/updateHoverFX/onLeftClick/bindInput)
- Циклы импортов (осознанные, hoisted-функции, без top-level вызовов — ESM-safe): turns⇄ai, actionbar⇄targeting, combat⇄statuses⇄abilities, quests⇄progression, explore⇄maps, party⇄quests/explore; документированы в REFACTORING.md, разрыв (event-bus) — Фаза 5
- Итерации tsc: 328→225→79→48→0 (экспорт-пасс по 17 модулям, консолидация шапки engine, добор импортов: GW/CRYPT/busy/THREE/refreshHintExplore/refreshTracker/freeSpotNear/QUESTS...)
- E2E-гейт: boot WebGL2+bloom rigs 3/3; телепорт к патрулю → checkTriggers(700мс) → openDlg → DLGS.patrol (4 опции) → «В атаку!» → startCombat (инициатива 4); ИИ: задира сблизился (14,12)→(14,15) и «Скимитар по Мирелла — 13 против КД 12, урон 2» (10→8); doSave(1) в бою отказал (guard); reload → doSave(1) → снапшот 1019 байт (=== p3, формат v2 цел); порча hp → doLoad(1) → 14/10 восстановлено; switchMap('crypt') → 7 врагов + босс + QUESTS.crypt=active (questStart из buildMap); toggleGfx → панель, 3 пресета; switchMap('forest') → 10 юнитов; ремоут Fast Refresh'ем в бою → чистый стейт (units 10, gold 60, без лога боя); консоль без ошибок; скриншот .zscripts/verify-refactor-p4.png
- Итог: 6 коммитов; engine.ts 2974→299 (−91%); 24 модуля игры; самый большой модуль explore.ts 380 (< 400 лимит)

Stage Summary:
- Фаза 4 закрыта: god-объект разобран, engine.ts — оркестратор на 299 строк; состояние — state.ts (S/G/resetState), рендер — синглтоны render/renderer.ts; сейв v2 байт-в-байт; ремоут-контракт §4 восстановлен и проверен
- Следующий шаг: «рефакторинг 5» — Фаза 5: noImplicitAny:true + allowJs:false, зачистка остаточных any (в engine 5, в модулях best:any в ai/targeting, реликт-пулы), ESLint no-explicit-any, опционально vitest-смоуки и dpdm-проверка циклов; затем Фаза 6 (React-HUD, опциональна)

---
Task ID: 8
Agent: main (Z.ai)
Task: Рефакторинг, Фаза 5 — слим-оркестратор + строгий режим (ацикличный граф, noImplicitAny, allowJs:false, 0 any, ESLint, README)

Work Log:
- Аудит: engine 299 строк (уже ≤800); any-остатки 24 (state.G ×13, ai best ×8, engine ×5, пулы markers/tweens, relic/sv/opts/born); dpdm недоступен — написан свой детектор scripts/cycles.js (Тарьян SCC): 3 SCC — state⇄grid, slots⇄snapshot и большой на 18 модулей; scripts/cycle-edges.js — все рёбра-участники циклов
- Разрыв циклов — шина поздних связей bus.ts (Slot<A> c bind/call, no-op без привязки; привязки — top-level владельцев, все статически достижимы из engine до bootGame): refreshParty/refreshInit/refreshBossBar/refreshUI/openExploreUI (реализации — ui/party, ui/actionbar; ЦИКЛ progression→party→quests→progression найден дополнительно), refreshTracker (quests), openDlg/closeDlgHard (dialog), checkTriggers (explore), switchMap (maps), aiTurn (ai); side-effect импорты './ui/party', './ui/actionbar', './systems/ai' в engine (иначе привязки не живут)
- Переносы ради DAG: explode/explodeBarrel abilities→combat.ts (die→бочка); tickFires statuses→turns.ts (тик конца раунда; statuses больше не зовёт combat); healUnit combat→новый systems/vitals.ts (24 строки; progression→combat замыкал); QUESTS/QUEST_REWARD quests→лист interact/questData.ts (прогрессионный showEnd; quests реэкспортирует); GridWorld grid.ts→types.ts (state⇄grid) + freeSpotNear получил w:GridWorld (grid — ЧИСТЫЙ ЛИСТ); closeSaveMenu applyGame→doLoad (slots⇄snapshot; applyGame зовётся только из doLoad — проверено)
- Типизация (0 any): G-поля (TargetingState, THREE.PostProcessing/Light/Mesh, TREES/ROCKS/TENTS/BARREL_POS — number[][], init []), AIPlan (+potion), DlgFn/DlgOpt/DlgNode, ActionDef, ShopItem, Relic, ExplodeOpts, TargetType, Bg3Debug + declare global Window.__bg3, Unit.moving?; barrels остались Unit[] (сужение isBarrel?:true через параметр не проходит — проверено минимальным тестом; explodeBarrel(b:Unit)); Scored<V> в ai; GFX_ROWS с keyof typeof gfx
- tsconfig: noImplicitAny:true + allowJs:false → 21→9→0 ошибок (HERO_TINT-индекс, GFX-ключи, props-параметры, null-guards renderer/engine applyLighting/groundMesh, init-сортировка (b.init||0))
- ESLint (eslint.config.mjs override для src/game/**): no-explicit-any warn, no-unused-vars error (args/varsIgnorePattern ^_), prefer-const error → 42→21→0 (catch-биндинги, unused-импорты engine/abilities/ai/combat/maps/dialog/explore, _h/_src)
- E2E-гейт (agent-browser, все 9): boot WebGL2+bloom rigs 3/3; телепорт к патрулю → checkTriggers → bus.openDlg('patrol') → «В атаку!» → startCombat+bus.closeDlgHard+инициатива (bus.refreshInit); ИИ дважды сблизился и атаковал (bus.aiTurn: 8/КД16 промах, 7/КД16 промах); случайный шаг героя → корректные AoO от обоих гоблинов (movement⇄combat); атака Торика «12 против КД 13 — промах»; огненный шар Миреллы: «ВЗРЫВ! Урон 14 в радиусе 2.5», «Трава вспыхивает (12 кл.)» (castFireball→explode→igniteTile); Торик побит 5+5 → «повержен» (die→checkEnd, бой продолжен); килл гоблина: «повержен!» → «Отряд получает 50 XP» (awardXP) → «собрано 3 золота» (rollLoot→gainGold), золото 60→63; самоподжог Миреллы «Горение (2 ход.)» (explode→addStatus); поражение: Мирелла пала → checkEnd→showEnd «ПОРАЖЕНИЕ» (flex); reload → doSave(1) v2 1040 байт (fighter:14/wizard:10/gold 60) → порча hp в слоте → doLoad(1) 1:1 (3/14, 3/10) + «Отряд приходит в себя»; switchMap('crypt') → 7 врагов + QUESTS.crypt=active → обратно 8; магазин: E → bus.openDlg('damrock') → «Покажи товар» → покупка зелья 60→35; gfx: G → пресет «Низкий» (shadows off/bloom false/…); двойной ремоунт (переименование GameClient туда-обратно → полный remount) — gold 60 после каждого resetState, консоль чистая, ошибок нет; экспорт/импорт покрыт эквивалентно (doSave/doLoad + валидация slots — единственное изменение closeSaveMenu→doLoad); скриншот .zscripts/verify-refactor-p5.png
- Гейты: tsc 0 (noImplicitAny:true, allowJs:false); ESLint 0/0; cycles.js NO CYCLES; 0 any; модули ≤400 (max explore 383); engine 304 строки
- README: новая структура (26 модулей + слои) + раздел «Куда класть новый код»; REFACTORING.md: статус Фаза 5 ✅ + DoD 7/7 отмечено

Stage Summary:
- Фаза 5 закрыта: граф зависимостей ацикличен (шина bus вместо циклов), строгий TS по всему src (noImplicitAny, allowJs:false), ноль any, ESLint-дисциплина, README-структура; DoD рефакторинга выполнен полностью; поведение v1.3 сохранено (E2E 9/9)
- Следующий шаг: «рефакторинг 6» — ОПЦИОНАЛЬНАЯ Фаза 6 (React-HUD + zustand) — только по отдельной команде; либо фича-работа v1.4 в готовых слоях

---
Task ID: 9
Agent: main (Z.ai)
Task: Рефакторинг, Фаза 6 — React-HUD + zustand (HUD_HTML → React-компоненты, стор-граница движок⇄React)

Work Log:
- Старт с верификации: Фазы 3–5 уже на GitHub (tags refactor-p3/p4/p5, main==abb8e77, все теги на remote) — «дальше» = Фаза 6
- Архитектура: zustand@5.0.6 уже в package.json; стратегия «стор-граница»: движковые модули ПИШУТ view-модели (с колбэками) в стор, React-компоненты ТОЛЬКО читают стор и зовут колбэки — ноль рантайм-импортов движка из компонентов (three не попадает в основной бандл, SSR безопасен)
- store.ts (новый, 132 строки, ЛИСТ): view-модели LogEntry/PartyCardView/InitChipView/ActionBtnView/DlgView/ShopRowView/ChoiceView/JournalItemView/TrackerQuestView/SheetView/SlotRowView/GfxSegView/TipView/EndView + флаги панелей (shopOpen/journalOpen/gfxOpen/savesOpen/endHidden) + колбэки-биндинги (sys.onSnd/onGfx/onSaves/onLoadFromEnd, *OnClose, onImportFile) + pushLog (кап 80, seq) + setTopbar/setRound/setActionbarVisible + resetUi (биндинги переживают ремоут); importInput — живой ref скрытого input#importFile (клик из doImport внутри пользовательского жеста)
- React-компоненты (4 файла, все < 130 строк): Hud.tsx (корень + SysButtons/TopBar/BossBar/Hint/Banner/Tip), panels.tsx (LogPanel c автоскроллом/PartyCards/QuestTracker/ActionBar c waiting-режимом), dialogs.tsx (DialogBox с req-классом/ShopPanel/JournalPanel/ChoicePanel с id=choiceTitle), menus.tsx (GfxPanel пресеты+6 строк-сегментов/SavesPanel 3 слота+скрытый input ref/EndScreen canContinue+loadFromEnd/SheetModal клик-по-фону); классы и id — 1:1 с HUD_HTML, game.css БЕЗ изменений
- Перевод движковых модулей DOM→стор: overlays (log/setHint/bigBanner→стор; #ov покадровые HP/флоат-текст — императивно), party (renderParty/сBossBar/сInit/showSheet→view-модели; showExploreUI→setActionbarVisible(false)+setTopbar(mapName)), actionbar (renderUI→pips+btns-модель, ACTIONS без изменений), targeting (showTipFor→uiSet({tip}), e опционален), quests (refreshTracker/toggleJournal/renderJournal→стор + биндинг journalOnClose), dialog (openDlg/closeDlg/closeDlgHard/showNode→dlg-модель; onClick-замыкания опций 1:1 с прежней логикой req/end/fn), shop (renderShop/chooseHero/closeChoice→стор + shopOnClose/choiceOnClose), slots (renderSaves/openSaveMenu/closeSaveMenu/toggleSaveMenu→стор + sys.onSaves/onLoadFromEnd/savesOnClose/onImportFile; endHidden вместо style.display), settings (renderGfx→пресеты/сегменты + gfxOnClose/sys.onGfx), progression (showEnd→end+endHidden), turns (round/turnb/actionbar→setRound/setTopbar/setActionbarVisible), maps (setRound/setActionbarVisible; #fade остался императивным), snapshot (applyGame: sheet/end→uiSet), state (resetState→resetUi), engine (293 строки: сняты 9 DOM-биндингов панелей + 3 getElementById; Escape→uiSet({sheet:null}); snd-биндинг в стор при boot)
- GameClient.tsx: 4 императивных слоя (#scene/#ov/#fade/#slowfx) + <Hud/>; hud.ts — реестр императивных слоёв (UI={scene,ov,fade,slowfx}); HUD_HTML удалён
- Гейты: tsc 0 (1 итерация: setRound в store, $ в maps); ESLint 0/0; scripts/cycles.js NO CYCLES; 0 any; модули ≤400 (max explore 383); engine 293 строки; rg $(UI.* — только scene/ov/fade + store
- НАЙДЕН И ИСПРАВЛЕН латентный баг v1.2: resolveTargetClick — else-ветка ловила bolt → «Огненные стрелы» били Каранием света (2d6 излучение) и жгли ячейку; подтверждено в оригинале (git show v1.3-refactor-base:src/game/engine.js строки 1851–1858); фикс: явная ветка t.type==='bolt' → doAttack(BOLT) без ячейки (соответствует описанию способности в листе персонажа)
- E2E (agent-browser, React-UI): boot WebGL2+bloom rigs 3/3, StrictMode double-mount чистый; триггер патруля → React DialogBox (4 опции) → «В атаку!» → бой (Раунд 1, chips 4, ActionBar waiting); ИИ: сближение+атаки (20/КД12 ур.5, КРИТ 23 ур.9), AoO Ториka дважды; огненный шар Миреллы: «ВЗРЫВ! Урон 6 в радиусе 2.5», горение (2 ход.), килл-горением → 50 XP + 6 золота; прямая атака кликом: «Длинный меч 16/КД13 ур.4», килл → 50 XP + 6 золота + зелье из лут-таблицы; bolt-фикс: «Огненные стрелы 13/КД13 ур.6»; ПОБЕДА (=== ПОБЕДА! ===, топбар→карта, actionbar скрыт); ПОРАЖЕНИЕ: Грат vs герои hp=1 → EndScreen React «ПОРАЖЕНИЕ» (2 кнопки, без «Продолжить») → «Загрузить игру» → SavesPanel (3 слота) → «Закрыть (K)» → возврат на end (savesFromEnd); сейвы: 💾 → Сохранить слот 2 (1040 байт === p5) → порча hp 3/3 → reload → Загрузить → 1:1 (hp [3,3], золото 60); карты: switchMap crypt (7 врагов, квест active, топбар «Крипта Костепёра») ↔ forest; магазин: E → диалог Дамрока → «Покажи товар» (7 рядов) → Купить зелье → ChoicePanel → золото 60→35, зелья 3; gfx: ⚙ → 3 пресета → «Низкий» (6 сегментов: Тени Выкл/Bloom Выкл/Glow Выкл/Частицы Мало/75%/FPS 60) → localStorage bg3w_gfx_v1 → закрыть → «Высокий» обратно; журнал J: 2 квеста → закрыть; финальный reload: boot чистый, HUD целостный (скриншот .zscripts/verify-refactor-p6.png)
- Инструментальный приём E2E: экранные координаты юнитов — из #ov .uhp (style.left/top — проекция движка), клик по цели = уhp-позиция + 14px вниз (центр капсулы); raycast по юнитам проверен тултипом/«Слишком далеко»
- Документы: README (структура 26+5 модулей, «куда класть» — React-HUD-правила), REFACTORING.md (Фаза 6 ✅ в шапке, строка 6 таблицы выполнена, §9 — зачёркнуто), worklog Task 9

Stage Summary:
- Фаза 6 закрыта: HUD_HTML → React+zustand, стор-граница без циклов и без three в бандле HUD, императивные покадровые слои сохранены; DoD рефакторинга (0–5) + опциональная Фаза 6 выполнены; поведение v1.3 сохранено, кроме исправленного латентного бага bolt→SMITE (v1.2)
- Следующий шаг: фича-работа v1.4 в готовых слоях (обучение, облако сейвов, баланс) — по отдельной команде

---
Task ID: 10
Agent: main (Z.ai)
Task: v1.4 «Наставник дозора» — релиз по дорожной карте README (обучение, облако сохранений, полировка)

Work Log:
- Контекст: рефакторинг p0–p6 полностью завершён (теги refactor-p1…p6, engine.ts 293 строки) — подтверждено git tag/log до старта; «v1.4» трактован как игровой релиз по дорожной карте README («v1.4 — обучение, облако сохранений, полировка, баланс»)
- ОБУЧЕНИЕ (ui/tutorial.ts, 79 строк): карточка «Наставник» 7 шагов (move/talk/fight/attack/spell/end/save) продвигается ТОЛЬКО реальными действиями игрока; события — через новый слот bus.tutEvent (вызовы: explore.moveParty, dialog.openDlg, turns.startCombat/endTurn (guard hero), combat.doAttack (guard side), targeting.enterTarget (guard !attack), slots.doSave); прыжок вперёд (idx>=step → step=idx+1), anti-rewind (idx<step — игнор); прогресс localStorage bg3w_tut_v1 {step,done} — формат сейва v2 НЕ затронут; initTutorial() из bootGame (side-effect импорт не повторяется при ремоуте); view-модель TutView в store (tut), React-компонент TutCard в Hud.tsx (#tut, панель .panel), стили game.css §v1.4; sfx.bless() на завершение/пропуск
- ОБЛАКО (save/cloud.ts, 55 строк): IndexedDB «bg3w_cloud»/store slots, promise-обёртка tx() без исключений наружу (недоступность → null/false, сейв не ломается); doSave — автозеркало (лог «Зеркало сейва — в облачной скрижали»/«недоступна»), cloudPull/cloudPush в slots.ts; SlotRowView +cloudHas/cloudWhen/onCloudPull/onCloudPush; refreshCloudMeta — асинхронные uiSet поверх рядов; SavesPanel: строка «☁ в облаке: <дата>» + кнопки «В облако»/«Из облака» (title-подсказки)
- БАГФИКС ИИ (латентный v0.4, вскрыт E2E дальним startCombat): planGoblin/planNecro не имели плана «просто сближения» — план move искал только атакующие позиции, при дистанции героя > moveLeft+range враг навечно замирал («ускоряется!» каждый ход без шага); фикс: fallback-блок перед dash в обоих планах (узел, минимизирующий dmin до ближайшего героя при улучшении curD); E2E-регресс: Грат (21,6) → сближение d 17→15→13→11→9
- Полировка: приветственный лог v1.4, console.log '[bg3] v1.4 boot complete', layout.tsx метаданные (title/keywords), README (шапка v1.4, структура +tutorial/+cloud, механики v1.4, дорожная карта v1.5, технологии: zustand+IndexedDB, 26 модулей)
- __bg3 расширено (тип Bg3Debug): moveParty(x,z), tut() — инспектор {step,done} только чтение, cloudGet/cloudPut/cloudPull для E2E
- Гейты: tsc 0; ESLint src/game+components/hud 0/0; scripts/cycles.js → NO CYCLES; модули ≤400 (engine 301, tutorial 79, cloud 55)
- E2E (agent-browser, React-UI): boot '[bg3] v1.4 boot complete' WebGL2 bloom rigs 3/3, 0 page-errors; туториал: карточка «шаг 1 из 7» → moveParty → шаг 2 → E у Кая (диалог открылся, dlgName) → шаг 3 → startCombat патруля → шаг 4 «Атака» → клик-атака по Грату из HP-полоски (u._el rect +30px) → килл Задиры → шаг 5 «Способность»; «Огненные стрелы» → таргетинг-хинт; startCombat №2 → jump-forward до «Скрижаль судьбы» (шаг 7) — прыжок и anti-rewind подтверждены; reload → tut step=6 восстановлен из LS; клик-атака Торика (болт Миреллы 23/КД14 урон 8) → Грат мёртв → квест «Кости и пепел» 300XP+150зол → «=== ПОБЕДА! ===»; сейвы на экране победы корректно запрещены (guard phase over); reload → K → «Сохранить» слот 1 → tut {step:7,done:true} + карточка скрыта + лог «Обучение завершено!…» + «Зеркало сейва — в облачной скрижали»; cloudGet(1) → v2 forest 60зол 2 героя; localStorage.removeItem → cloudPull(1) → слот восстановлен (лог с датой) → панель: «☁ в облаке: 17.10.2026, 19:53:47», 7 кнопок (В облако/Из облака активны при данных); doLoad(1) → 1:1 (map forest, gold 60, hp [14,10]); switchMap crypt (7 врагов) ↔ forest (8); финальный reload → boot чистый, tut НЕ появляется (done), errors 0
- Инструментальный приём E2E: пик юнитов — pointermove-сканирование по тултипу (#tip) / cursor 'pointer'; клик = dispatch PointerEvent pointerdown/up на canvas (agent-browser mouse не доходил); координаты — rect HP-полоски юнита (u._el) +30px вниз; кнопки React — DOM b.click() (find text нестабилен); анти-джамп: const-декларации eval'ов живут в page-контексте — IIFE-обёртка
- Git: коммит v1.4 + тег v1.4 + push (token-процедура: set-url → push → set-url restore → проверка утечки токена rg'ом — чисто)

Stage Summary:
- v1.4 «Наставник дозора» выпущен: обучение на реальных действиях (7 шагов, bus.tutEvent, LS-прогресс), облачные скрижали (IndexedDB-зеркало, pull/push, метки в панели), багфикс ИИ-сближения; формат сейва v2 и баланс не изменены
- Первый фича-релиз на пост-рефакторинговой архитектуре: новая система = 2 листа (tutorial 79, cloud 55) + слот шины + 6 точек вызова — god-файл не вырос (301 строка)
- Следующий шаг: v1.5 — третья карта (болота культистов) и/или серверные скрижали (API-роут)

---
Task ID: 11
Agent: main (Z.ai)
Task: v1.5 «Болота культистов» — третья карта + пятый класс (друид Ольха) + серверные скрижали; гейты, E2E, tag+push

Work Log:
- Проверка состояния: конвейер рефакторинга p0–p6 завершён ранее, v1.4 выпущена (tag v1.4); дорожная карта README прямо задаёт состав v1.5: третья карта, серверные скрижали, новый класс
- Карта «болота»: types.ts (+swamp в MapId, флаги S, SaveFlags opt, Unit.swampBoss, TargetType spark/spore, Bg3Debug+), state.ts (SWAMP: MIRE/REEDS/IDOL/OLKHA/BOSS/ALTAR/EXIT/ENTER/TRAIL, MAP_NAME.swamp, resetState), renderer.ts (атмосфера/свет «мертвенно-зелёные сумерки»), props.ts (seedSwamp, addDeadTree, лужи+камыш в buildWorld, «Бочка с гниловаром»), interact/swamp.ts (НОВЫЙ модуль: buildSwampTrail/enterSwamp с гейтом «крипта зачищена», buildSwampScenery — идол/цепи Ольхи/алтарь/гать, joinOlkha/dismissOlkhaScene/ensureOlkha, startSwampQuest), maps.ts (ветка swamp в buildMap, точки входа по карте, buildSwampTrail в лесу), roster.ts (makeDrowned «Утопленник» 14hp, makeUlva 54hp bossBrain+swampBoss, makeOlkha druid, CULT.deep «Культист Глубин», spawnEnemies swamp: 7 юнитов), ai.ts (фаза 2 по фабрике босса: Ульва поднимает утопленников, баннер «ТРЯСИНА ПРОСЫПАЕТСЯ»), combat.ts die() (swampBoss → S.swampDone + questDone), loot.ts (isBoss+swampBoss), explore.ts (триггер босса болот в checkTriggers), questData/quests (квест «Шёпот глубин», 350XP/200зол/жемчуг +1 МДР), dialog.ts (DLGS.olkha/swampboss + опция Дамрока), snapshot.ts (флаги swampDone/olkhaJoined, mapId swamp, ensureOlkha при загрузке)
- Друид Ольха: constants (HERO_TINT.druid, RANGE_SPORE), abilities.castSpores (1d6+МДР яд R2, только по врагам, projMesh+зелёный burst), targeting (SPARK 2d6+МДР дальн.7, ветки spark/spore, маркеры/хинты/тултипы), actionbar (2 кнопки dru), progression (уровни друида = жрица), party.showSheet (блок друида)
- Серверные скрижали: prisma/model Tablet (slot Int @id, data String, when BigInt — Date.now не влезает в Int, всплыло на E2E), db:push + generate; src/app/api/tablets/route.ts (GET список/по слоту, PUT upsert c BigInt, DELETE, валидация slot 1..9, runtime nodejs); save/server.ts (НОВЫЙ, no-throw fetch-клиент); slots.ts (doSave зеркалит на сервер, serverPush/serverPull, refreshServerMeta в renderSaves); store SlotRowView +4 поля; menus.tsx (метка «⇅ на сервере», кнопки «На сервер»/«С сервера»); __bg3 += serverGet/serverPut/serverPull
- engine.ts: boot-лог v1.5, __bg3 += joinOlkha/aim/fire (E2E-прицеливание: enterTarget+resolveTargetClick c подстановкой pick)
- layout.tsx: title/description v1.5
- README: шапка v1.5, структура (+swamp.ts, server.ts, api/tablets), механики v1.5, дорожная карта (v1.5 зачёркнут, v1.6: перевал великанов/снаряжение/Mixamo-атаки), технологии (+Prisma/SQLite)
- Гейты статические: tsc 0; ESLint src 0/0 (осталась пара require-ошибок в scripts/cycles*.js — вне src, исторически); node scripts/cycles.js → NO CYCLES; модули ≤400 (макс explore.ts 387)
- E2E agent-browser 14/14: boot v1.5 WebGL2+bloom без ошибок; болота: гарнизон 7 (Ульва 54/КД15, культисты Глубин ×2, ученик, утопленники ×3), квест стартует, objective enter; Ольха: join → 3 героя, ячейки 2/2, кнопки в React-HUD; Разряд молнии: 16 vs КД12, урон 13 (2d6+МДР), ячейка −1; Облако спор: 7 яда, килл+лут+70XP; Ульва: keep-dist, фаза 2 (+2 утопленника), Ученик-целитель латал её могильной песнью (работает и на болотном боссе); смерть Ульвы от огненного шара: questDone('swamp'), +350XP/+200зол, «Болотный жемчуг» → Мирелла МДР+1, уровни 3; ПОБЕДА после полной зачистки; doSave(1) на болотах → localStorage+IndexedDB+сервер (serverGet: mapName «Болота культистов», flags olkhaJoined/swampDone, heroes fighter,wizard,druid); doLoad(1) → карта болота 1:1, ensureOlkha восстановил друида, «ИГРА ЗАГРУЖЕНА»; serverPull: слот очищен → восстановлен с сервера; curl PUT/GET/DELETE /api/tablets OK; раунд-трип лес↔крипта↔болота, убитая Ульва не респаунится; двойной ремоут чистый (1 canvas, 0 ошибок)
- Наблюдения E2E: триггер близости босса честно срабатывает и на телепортированную Ольху (диалог открывается повторно, пока герой рядом — не баг); doSave в бою корректно отклонён гардом; мёртвые герои пишутся в сейв с hp 0 → восстановление на 1 hp (задуманное поведение v1.1 «приходит в себя»); для нового Prisma Client потребовался рестарт dev-сервера

Stage Summary:
- v1.5 «Болота культистов» готова: 3 фичи по дорожной карте — третья карта (болота+Ульва+утопленники), пятый класс (друид Ольха: Разряд молнии/Облако спор), серверные скрижали (Prisma/SQLite + /api/tablets + панель)
- Сейв v2 сохранён совместимым (новые флаги опциональные); сцена брендинга: заголовок/логи/README/layout на v1.5
- Гейты: tsc 0, ESLint src 0/0, NO CYCLES, ≤400, E2E 14/14
- Далее: коммит + tag v1.5 + push (token-процесс) — см. следующую запись

---
Task ID: 12
Agent: main (Z.ai)
Task: v1.6 «Перевал великанов» — четвёртая карта (дорожная карта README), снаряжение/инвентарь с эффектами, атак-анимации (клип-ready); ассеты Synty POLYGON Nature из upload/

Work Log:
- Старт: конвейер p0–p6 закрыт, v1.4/v1.5 на GitHub (main==a842f9f). «v1.6» = фича-релиз по дорожной карте README: четвёртая карта + снаряжение + Mixamo-атаки
- АССЕТЫ: upload/ содержал Telegram RAR (part1/3/4, part2 не понадобился) — Synty POLYGON Nature (60MB, 228 FBX) + SwampMarshland (143MB, 194 FBX); unitypackage = tar.gz с GUID-папками → скрипт scripts/extract-unity.sh восстанавливает имена из pathname (645+571 файлов); инвентарь: выбрано 38 моделей (горы SM_Terrain_Mountain_01..03, скалы SM_Rock_Wall/CaveEntrance/Boulder/Cluster, сосны PolyPine/Pine/Dead, мост, указатель, костёр, сундук, черепа/скелеты, столбы, крошка/пыль, травы) — все модели ссылаются на ЕДИНЫЙ атлас PolygonNature.png (4 палитры 8KB, взята _01 как PolygonNature.png — FBXLoader сам резолвит по resourcePath); итог public/models/nature/ = 2.1MB
- world/nature.ts (НОВЫЙ, лист): FBXLoader-кэш по имени, материалы → MeshStandardMaterial с sRGB-атласом (Phong из FBX отброшен), нормализация (центр XZ, min.y=0), placeNature/placeNatureSync/placePine/placeDeadPine/placeBoulder; ЦИКЛ разорван заранее: процедурный замах НЕ через fx/tweens (animation→tweens→renderer→animation был бы цикл) — внутренний список swings в AnimRigs.update + bindRigs(rigs) в renderer
- КАРТА: types.ts (+giants в MapId, GameState.giantsDone/giantsChest/giantsGroup/bag, SaveFlags+, HeroSave.gear, SaveData.bag?, Unit.giantBoss/gear, ShopItem.t+'gear'+g?, Bg3Debug+); state.ts (GIANTS: CHASM z13–14, BRIDGE x13–14, CAMP/CHEST/BONES/CAVE/BOSS/PILLARS, ENTER/EXIT, TRAIL [2,4]; MAP_NAME; resetState+resetQuests); props.ts (seedGiants: обрыв solid кроме моста, столбы, пещера, сундук; buildWorld: сосны/валуны через nature, серые травы+щебень); renderer.ts (атмосфера «холодная синева» + свет высокогорья); maps.ts (ветка giants: seedGiants→buildWorld→buildGiantsScenery→startGiantsQuest, риг Гаррума ×1.3; лес: buildGiantsTrail); interact/giants.ts (НОВЫЙ ~150: buildGiantsTrail/enterGiants с гейтом «болота зачищены», buildGiantsScenery — хребет по периметру ×~36, тёмная полоса обрыва, мост на опорах, пещера+glow, лагерь (костёр POLYGON + пламя/свет в G.flameMesh/G.fireLight — анимирует общий loop), кости/черепа/столбы, сундук (placeNatureSync→addInteract, один раз), спуск; openGiantsChest → addToBag('axe_pass'); startGiantsQuest)
- РОСТЕР: makeOgre (30hp/КД13/2d6 дубище, mesh ×1.42), makeGarrum (64hp/КД14, «Брошенный валун» 2d6+СИЛ дальность 6 keepDist, giantBoss+fearImmune, уровни... xp 500), spawnEnemies giants: Гаррум + 2 огра + элитный огр (убитый Гаррум не встаёт — S.giantsDone)
- ИИ: ai.ts фаза 2 по фабрике босса (giant → «ГОРЫ ДРОЖАТ», КД+3, без призыва); nova → «Оползень» (2d6, серые партиклы/тряска) — планNecro-мозг переиспользован
- БОЙ: die() ветка giantBoss → giantsDone + questDone('giants') + серый взрыв + банер-лог
- СНАРЯЖЕНИЕ: systems/gear.ts (НОВЫЙ, ~135): GEAR-каталог (axe_pass 1d10+СИЛ / scale_giant +2КД / stone_heart +5maxHP / watch_ring +1КД), DEFAULT_WEAPON/ARMOR по классам для симметричного снятия, S.bag (сумка отряда), equipItem/unequipSlot (замена слота возвращает предмет в сумку), панель I: renderBag → BagItemView/BagHeroView в стор, uiSet sys.onBag+bagOnClose; ui/store.ts (+bagOpen/bagItems/bagParty/bagOnClose, SysView.onBag); React: menus.tsx BagPanel (слоты героев с «×»-снятием + сумка с «Надеть…»→ChoicePanel), Hud.tsx кнопка 🎒; engine onKey I/ш; game.css §v1.6; лавка: SHOP + Чешуя (220з)/Кольцо (180з) (t:'gear', g:id → addToBag); questDone giants → +250з/+400XP + stone_heart в сумку
- СЕЙВ: snapshot: flags.giantsDone/giantsChest, heroes[].gear, bag[]; applyGame: восстановление 1:1 — gear НЕ переприменяется (бонусы уже в сохранённых ac/maxhp/weapon — проверено E2E: порча hp/gold → точное восстановление, КД 16 не задвоен); 1301 байт слот с перевала
- АТАК-АНИМАЦИИ: animation.ts — ATTACK_URL '/models/rig/attack.glb' (HEAD→GLTFLoader→animations[0], «скелет mixamorig как у Soldier»), upgradeUnitRig: клип → actions.attack (LoopOnce, finished→idle), _attackT-guard в update; playAttack: клип иначе процедурный замах (swings-очередь AnimRigs, один за раз); combat.doAttack: playAttack(att) вместо старого inline-твина (v0.7 lunge остался); engine boot: await loadAttackClip() ДО ригов; файла нет (404) → процедурный фоллбек — путь к реальным клипам готов (положить GLB — заработает без кода)
- E2E (agent-browser, React-UI) — полный цикл: boot v1.6 WebGL2+bloom rigs 3/3; тропа в лесу (после round-trip лес↔крипта — как в v1.5), гейт «после зачистки болот» → questDone('swamp') → вход; перевал: гарнизон 4, квест active, «enter» выполнен; ПОЛИГОН-модели с атласом (скрины .zscripts/e2e-v16-0*.png); мост проходим только x13–14; триггер босса → диалог «Гаррум Камнегрыз» (3 опции) → «В бой!»; ИИ: огр сблизился и ударил (15/КД12 ур.11), Гаррум швыряет валуны издалека (17/КД12 ур.13), AoO; фаза 2: «КАМЕНЬ — МОЯ КОЖА!» КД 14→17 (проверено промахом 6/КД17); добивание → die(): «Перевал великанов свободен», giantsDone, +400XP/+250зол, stone_heart в сумке, ПОБЕДА, перевод после боя; сундук: баннер «СЕКИРА ПЕРЕВАЛА» → bag+axe_pass; панель I: 2 предмета, слоты «—», «Надеть…» → ChoicePanel → Торик: weapon='Секира перевала' [1,10], gear.weapon=axe_pass, сумка −1; stone_heart giveGear: maxhp 30→35, unequip → 30 обратно; лавка: покупка Чешуи (300→55з точно) → bag, equip на Миреллу: КД 12→14, armor='Чешуя великана'; сейв 1301Б 1:1 (порча hp=3/gold=1 → точное восстановление, gear без двойного применения), двойной ремоут чистый (gold 60, сумка пуста, квесты hidden, 1 canvas)
- ФИКСЫ ИЗ E2E: (1) МАСШТАБ — Synty FBX в сантиметрах (сундук 68 юнитов!) → obj.scale 0.01 при загрузке + рекалибровка всех s (горы ×1.1–1.4, сосны ×0.42–0.67, пропсы ×1.3–2.0) — до фикса «ходили внутри гигантских моделей» (тёмные силуэты в кадре); (2) resetQuests в resetState — квесты (модульное состояние) переживали Fast-Refresh-ремоут → после ремоута giants оставался 'done' (state→questData — без цикла); (3) giveGear-дубликат (addToBag поверх уже лежащего → 2×stone_heart после unequip); (4) материал без map → THREE warning «parameter map undefined» → условный LitMaterial
- Наблюдения E2E: headless-браузер тормозит анимации шагов (~1 клетка/сек при тяжёлой FBX-сцене) — не баг рантайма (твины по реальному dt), учтено в паузах; E-клавиша шлётся на window (document.dispatchEvent не доходит до addEventListener window); диалог рендерится как #dlgBox (не #dlg); «14 issues» в dev-бейдже — uv-warnings FBX-мешей без UV (серые материалы), не ошибки
- Гейты статические: tsc 0; ESLint src/game+components/hud 0/0; node scripts/cycles.js → NO CYCLES; 0 any; модули ≤400 (макс explore 387, новые: nature 108, giants 151, gear 135, engine 322)
- README: шапка v1.6, структура (+giants.ts/gear.ts/nature? — nature в world-секции, +public/models/nature), механики v1.6, дорожная карта (v1.6 зачёркнут, v1.7: цитадель Дозора/реальные Mixamo-клипы/клановые враги из POLYGON), layout.tsx метаданные v1.6

Stage Summary:
- v1.6 «Перевал великанов» готова: три фичи дорожной карты — четвёртая карта (Гаррум+огры, обрыв/мост, POLYGON-декор), снаряжение с эффектами (сумка/слоты/панель I/лавка/сундук/награда), атак-анимации (клип-ready + процедурный фоллбек)
- Сейв v2 сохранён совместимым (bag/gear/giantsDone/giantsChest — опциональные); найдены и закрыты 3 латентных бага (масштаб FBX, resetQuests, дубликат сумки)
- Далее: коммит + tag v1.6 + push (token-процесс) — см. следующую запись; пользователю — напоминание об отзыве токена + предложение положить реальные Mixamo-клипы в public/models/rig/attack.glb

---
Task ID: 13
Agent: main (Z.ai)
Task: v1.7 «Хореография битвы» — интеграция Unity-анимаций из Asset Store-архивов (upload/Asset Store-5.x.part1..6.rar, 38 unitypackage, ~300MB)

Work Log:
- Верификация репо: p1–p6 закрыты, v1.4/v1.5/v1.6 на GitHub (062f483), движок 322 строки, strict+tsc 0 — сводка контекста была устаревшей; Telegram-RAR = POLYGON Nature (уже использован в v1.6), Asset Store-RAR = коллекция анимаций
- Распаковка: unrar-free x part1 (мультивольюм OK, 11 вендоров) → tar -xzf unitypackage (10 пакетов приоритета) → инвентаризация scripts/inventory.py по pathname-файлам: 691 FBX, 0 .anim (клипы в тейках FBX)
- Пробы scripts/fbx_probe.mjs (FBXLoader в Node): blink32 = AdvancedSkeleton-риг (Root_M/Hip_L/Chest_M, 85 костей, в каждом FBX тейки tpose+анимация, In-Place), doublel = UE4-риг (pelvis/spine_01..05, InPlace-варианты), magicpot = простой 21-костный риг с мешем, expl_rpg = B_*-ноды БЕЗ isBone (не годится для retarget), ki_melee = FBX не парсится FBXLoader (ошибка ID)
- ОФЛАЙН-ЗАПЕКАНИЕ scripts/bake_motions.mjs: GLB Soldier без текстур → GLTFLoader (Node-шимы self/FileReader) → SkinnedMesh-таргет; 12 ролей (idle/idleCombat/walk/run/attack1h/attack2h/cast/hit/death/punchL/punchR/block): SkeletonUtils.retargetClip (names: mixamorigHips→Root_M и т.д. — ИМЕНА САНИТИЗЯТСЯ GLTFLoader'ом, без двоеточия; hip='Root_M' — имя ИСТОЧНИКА; scale = soldierHipRest/srcHipRest — рест меряется ПОСЛЕ проигрывания tpose-тейка: сцена death.fbx сохранена лежачей), треки .bones[N].x → N.x; найдено: у Soldier.glb IDENTITY inverseBindMatrices (skeleton.pose() обнуляет кости — не зовти его!)
- Итог: public/models/rig/motions.glb 1.3MB, 12 клипов; hip-оси: z=высота (106→1.06м), y=глубина (выпад 2H 36см, смерть оседает 106→15) — данные верны
- Интеграция: src/game/motion.ts (НОВЫЙ лист: loadMotions/clipFor/hasMotions/motionStats, fetch HEAD+GLTFLoader); animation.ts: AnimSet (blade/heavy/spell/dagger/brawler) + animOptsFor (тинт/масштаб/набор атак по cls/side/boss), actions: idle/idleCombat/walk/run + одноразовые attack(по классу)/hit/death(clamp), стейт-машина update (death до alive-guard, _hitT, inCombat→idleCombat), playAttack/playHit/playDeath, animStats; units.ts: removeUnit НЕ разрегистрировал риг (утечка Set — терпимо, юнитов мало); combat.ts: damageUnit→playHit, die→playDeath (иначе процедурное падение); abilities.ts: 3 каста→playAttack; engine: boot-IIFE ригов (v1.6-путь, герои+боссы, animOptsFor) + loadMotions перед ригами; turns.ts: inCombat=true участникам; progression.ts: сброс inCombat в checkEnd; __bg3: +animStats/step(боевое перемещение)/cam/ctl/loopStop/loopStart/scn/rnd
- БОРЬБА С РЕНДЕРОМ (главная проблема сессии): «лежащие тела» при стоящих костях — hipY 1.05-1.32 при визуальном лежании; перебрано: runtime rebind (меш исчезает — frustumCulled не спас), локальный soldier.glb с правильными IBM (GLTFExporter+rebind: IBM не-identity подтверждены; НО браузер вис на парсе/клоне), rAF-отложенный апгрейд, авто-риг из makeUnit — ОТКАТ к v1.6-пути (CDN Soldier, риги героев+боссов одним проходом из boot-IIFE); ДИАГНОЗ: среда (4GB RAM, SwiftShader, OOM-зомби GPU-процессы chrome на 70-144% CPU) портила GPU-состояние между бутами — тот же билд стоял (здоровые буты: hero_close, boot A) и лежал (деградировавшие); Node-пруф: проигрывание idle на клоне Soldier даёт hipY 1.061/headY 1.57→1.13 (дыхание) — клипы корректны
- ИНСТРУМЕНТАРИЙ E2E: agent-browser деградировал (демоны умирали под нагрузкой) → playwright-скрипты (scripts/pw_*.cjs): инъекция gfx (shadows off/bloom false/res 50/fps 30) через addInitScript, снимки через loopStop+render+toDataURL (WebGPURenderer.render АСИНХРОНЕН — same-task toDataURL ловит мусор; CDP-скриншоты — флаки под нагрузкой); финальные чистые прогоны: ANIMSTATS 12/12+rigs 3 (withAttack/withDeath 3/3), FIGHTER HIP Y=1.091 (стоит), walk anims ["run","idle"], ERRORS none; численно пойманы live: атака Миреллы (каст-клип _attackT 0.8→0.2), атака Торика attack1h (_attackT 0.8→0.1) + УРОН Ветерану 14→3 с hit-реакцией (hitT 0.45→0.05), смерть Задира 4 (болт в упор по hp=1: _deathT 1.85→1.15, труп замирает лежащим), idleCombat-стойки в бою; дефолтный CDP-кадр final_camp.png — герои стоят у костра, лог «Скелетные анимации подключены (3 рига)»
- Также проверено: сейв/лоад 1:1 (hp [14,10], порча→восстановление), детерминизм srand (два чистых бута — фазы до 6 знаков идентичны; ПЕРВОЕ «падение» детерминизма — методологическая ошибка: замер после doLoad, юниты пересоздаются), лут/XP при килах (болты: +50XP/+3 золота), крипта (гарнизон 9, all rigs counting), титул/README v1.7
- Гейты статические: tsc 0; ESLint 0/0; NO CYCLES; модули ≤400 (animation 318, motion 65, engine 325)

Stage Summary:
- v1.7 «Хореография битвы» готов: полная анимационная система на Unity-клипах (офлайн-ретаргет на mixamorig, motions.glb 1.3MB, 12 ролей), стейт-машина idle/idleCombat/walk/run/attack/hit/death с классовыми атаками и фолбэками
- Архитектурно: motion.ts (лист) + animation.ts (стейт-машина) + офлайн bake_motions.mjs; боевые хуки в combat/abilities; runtime — проверенный v1.6-путь ригов
- Уроки сессии: (1) у Soldier.glb identity inverseBindMatrices; (2) GLTFLoader санитизирует имена костей (mixamorig: → mixamorig); (3) WebGPURenderer.render() асинхронен — same-task toDataURL неверен; (4) в этой песочнице 4GB — chromium под SwiftShader деградирует от OOM, E2E держать лёгким (gfx-пресет через addInitScript, CDP-скриншоты по одному)
- Тег v1.7 + push — в этом же таске
