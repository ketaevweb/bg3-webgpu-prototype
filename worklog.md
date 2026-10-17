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
