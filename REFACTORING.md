# Рефакторинг «Врат Бальдура» — план декомпозиции engine.js и унификации на TS

> Статус: ПЛАН → В РАБОТЕ. Прогресс: **Фаза 0 ✅** (тег `v1.3-refactor-base`, скрипт `typecheck`, область ограничена src), **Фаза 1 ✅** (`engine.js → engine.ts`, tsc --noEmit 0 ошибок, E2E-гейт зелёный), **Фаза 2 ✅** (чистые листья: `rng.ts`, `utils.ts`, `constants.ts`, `world/grid.ts` (GridWorld-контекст), `systems/combat.ts` (боевая математика), `systems/loot.ts` (таблицы); engine 2975→2860 строк; детерминизм srand подтверждён E2E), **Фаза 3 ✅** (`types.ts` — доменные типы Unit/Weapon/Status/Quest/GameState/SaveData; типизация контейнеров, S и сейва; UI-реестр `UI` в hud.ts — 0 строковых id в engine; сейв v2 байт-в-байт совместим — JSON 1019==1019).
> Базовый коммит: v1.3 «Слуги Костепёра» (engine.js 2974 строки, всё работает и проверено E2E).
> Главный принцип: **игра остаётся играбельной после каждой фазы**. Ни одной фазы «сломано, доделаем потом».

---

## 1. Диагностика: зачем

Текущие цифры (wc -l по src):

| Файл | Строк | Доля |
|---|---|---|
| **src/game/engine.js** | **2974** | **71% игрового кода** |
| audio.ts | 251 | 6% |
| particles.ts | 210 | 5% |
| game.css | 159 | 4% |
| glow.ts | 158 | 4% |
| animation.ts | 156 | 4% |
| slowmo.ts + hud.ts | 86 | 2% |
| React-слой (GameClient/page/layout) | 125 | 3% |

Проблемы engine.js как god-объекта:

1. **Одно замыкание `bootGame()` на ~2930 строк и ~95 функций**: рендерер+bloom, камера, генерация двух карт, фабрики 8 типов юнитов, A*, бой, статусы, огонь, взрывы, лут, волны, XP/уровни, Utility-ИИ (гоблины/некромант/целитель), таргетинг, квесты, диалоги, магазин, сейвы/экспорт/импорт, gfx-настройки, HUD-биндинги, инпут, игровой цикл.
2. **Скрытая связность через замыкание**: функции обмениваются десятком мутабельных локалов (`units`, `S`, `order`, `phase`, `fx`, `glows`, …). Вынести одну функцию нельзя, не тронув 10 соседних — классический «снежный ком».
3. **Смешанный стандарт**: ядро — plain JS без проверки типов (`allowJs:true`, `checkJs` выключен), периферия — TS. tsconfig ослаблен (`noImplicitAny:false`), т.е. даже .ts-файлы слабо типизированы в сигнатурах.
4. **Скрытый контракт HUD**: engine.js находит DOM по строковым id (`$('#hint')`), а id живут в `HUD_HTML` в hud.ts — дрейф не ловит ни компилятор, ни линтер.
5. **Перекос версий типов**: `three@0.180.0` + `@types/three@^0.186` — типизации `three/tsl` и `BloomNode` могут врать о рантайме.

Цена бездействия: каждые v1.4+ добавляют ~200–400 строк в engine.js; через 2–3 версии правки будут требовать чтения 3500+ строк, а вынос модулей — расширения до недельной работы. Рефакторить сейчас — правильное окно: v1.3 стабилен, есть проверенный E2E-сценарий.

---

## 2. Принципы (не обсуждаются)

1. **Strangler fig, не big-bang**: выносим модули по одному, engine остаётся оркестратором; никакого переписывания «с нуля».
2. **Коммит на фазу, тег на фазу**: `refactor-p1` … `refactor-p6`; откат — всегда возможен.
3. **E2E-гейт после каждой фазы** (agent-browser): boot `[bg3]`, бой (атака/заклинание/ход ИИ), переход лес↔крипта, сейв→лоад (4 героя), магазин, диалог. Фаза не закрыта, пока гейт красный.
4. **Ноль игровых изменений**: баланс, формат сейва `SAVE_VER=2`, тексты, тайминги анимаций — не трогаем. Рефакторинг ≠ ребаланс.
5. **Заморозка контента**: на время рефакторинга v1.4+ на паузе; багфиксы — только в новые модули либо точечно в engine.
6. **Один сеанс = одна фаза**: фаза, вышедшая за сеанс, режется дальше, а не «дотягивается» за счёт качества.
7. **Новый код — строгий TS**: без `any`, без неявных `undefined`; старый код типизируется по мере переезда.

---

## 3. Целевая архитектура

```
src/game/
  engine.ts          ← точка входа bootGame(): сборка, инпут, цикл, dispose (~600–800 строк)
  types.ts           ← доменные типы: Unit, Side, Weapon, StatusType, Quest, MapId, SaveData, LootTable…
  constants.ts       ← TILE, GRID, XP_NEED, RANGE_*, STATUS, SLOT_N, SAVE_VER, HERO_TINT
  rng.ts             ← mulberry32/srand, d(), roll()        [чистый, тестируемый]
  utils.ts           ← $, clamp, mod, sleep, key, cheb, W()  [чистый]
  state.ts           ← S (флаги/прогресс) + G (runtime-мир: units, barrels, fires, phase, busy…)
                       + createGameState()/resetGameState()
  render/
    renderer.ts      ← WebGPURenderer + bloom postFX + resize + applyGfxSettings
    camera.ts        ← камера + OrbitControls
  fx/
    particles.ts, glow.ts, slowmo.ts, animation.ts   ← переезд из корня (уже TS)
    tweens.ts        ← tween(), lunge(), boomFX(), shake(), faceTo()
  world/
    grid.ts          ← passable, unitAt, barrelAt, dangerAt, astar, reachNodes, nodePath [почти чистый]
    props.ts         ← addTree/Rock/Tent/Campfire/Barrel, atmosphere, lighting
    maps.ts          ← MAPS, seedForest/Crypt, buildMap, switchMap, teardownWorld
    scenery.ts       ← buildForestScenery, buildCryptScenery, enterCrypt, openChest, interactables
  entities/
    figure.ts        ← buildFigure (меши фигурок)
    units.ts         ← makeUnit, placeHeroes, removeUnit, реестр
    roster.ts        ← makeGoblin/Skeleton/Knight/Cultist/Necro, applyElite, buildHeroes,
                       makeIlva/makeKaya, spawnEnemies, ensureCompanions
  systems/
    combat.ts        ← attackMod, hitChance, doAttack, damageUnit, healUnit
    statuses.ts      ← addStatus + fire: igniteTile/removeFire/tickFires
    abilities.ts     ← castFireball, radiantNova, explode/explodeBarrel
    loot.ts          ← LOOT, rollLoot, giveToParty
    progression.ts   ← awardXP, levelUp, checkEnd, victorySequence, showEnd
    turns.ts         ← startCombat, beginTurn, endTurn, joinCombat, initiative
    ai.ts            ← planGoblin, planNecro, evalAttack, threatened, bestFleeNode, aiTurn
    movement.ts      ← animateMove, tryMove, moveParty
  interact/
    quests.ts, dialog.ts, shop.ts, explore.ts        ← квесты, диалоги/CHA, Дамрок, триггеры
  ui/
    hud.ts           ← (уже TS) HUD_HTML + реестр id: export const UI = {hint:'#hint',…} as const
    overlays.ts      ← log, ftextAbove, bigBanner, setHint, initOverlays, updateOverlays
    markers.ts       ← маркеры пути и зоны хода
    party.ts         ← refreshUI/refreshParty/refreshBossBar/showSheet
    targeting.ts     ← enterTarget, cancelTargeting, resolveTargetClick, onLeftClick
  save/
    snapshot.ts      ← gameSnapshot/applyGame (мост в state; формат v2 заморожен)
    slots.ts         ← doSave/doLoad/doDelete/doExport/doImport/readSlot
    settings.ts      ← gfx-настройки (pixelRatio/тени/частицы/glow/FPS)
  GameClient.tsx     ← без изменений (bootGame()/dispose() контракт сохраняется)
```

Пометка: границы «props/scenery», «statuses/fire», «quests/dialog/shop/explore» могут склеиться, если файл получается < 120 строк — дерево зад*kа гранулярность, а не догму. Мягкий лимит размера модуля: **≤ 400 строк**.

### Правила зависимостей (направление импортов, enforcing ревью + ESLint Boundaries позже)

```
React-слой → engine.ts → { ui, save, systems, world, entities, fx, render } → { state, types, constants, rng, utils }
```

- `rng/utils/constants/types` — никого не импортируют (листья).
- `state` — только листья. Системы импортируют `state`, но **никогда** — `engine.ts`.
- Запрещены циклы: если двум модулям нужен общий код — он уезжает вниз по слоям.
- `types.ts` — единственный источник доменных типов; дублирование типов между модулями запрещено.

---

## 4. Стратегия переноса состояния (ключевое решение)

Сейчас всё живёт в замыкании `bootGame()`. При выносе модулей состояние нужно отдать наружу. Выбор:

**Решение: единый контекст `G` (runtime) + `S` (метапрогресс) в `state.ts`.**
- `G` — один объект с типизированными полями: `units: Unit[]`, `barrels`, `fires: Map`, `phase`, `busy`, `order`, `current`, ссылки на `scene/worldGroup/fx/glows/rigs/renderer` и пр. — то, что сегодня локалы замыкания.
- Модули — функции вида `doAttack(g: GameCtx, att: Unit, def: Unit, w: Weapon, opts?)`. Явная передача контекста первым аргументом: тестируемо, никаких скрытых глобалов, легко видеть зависимости функции.
- `dispose()` вызывает `resetState()` — гарантия чистого ремоунта под React StrictMode/HMR (тот же контракт, что у сегодняшнего замыкания, только явный).
- Исключение: `save/settings` (localStorage) и `rng` — допустимы модульные синглтоны, как сейчас.
- Альтернатива «передавать только нужные поля» отвергнута: сигнатуры 95 функций придётся придумывать вручную — дороже и ошибочнее, чем один явный `ctx`.

`S` (флаги квестов/прогресса) уже топ-левел в engine.js — при переезде в `state.ts` получит тип `GameState` и `resetGame()` для чистого рестарта.

---

## 5. Фазы

| # | Фаза | Что делаем | Гейт (E2E + сборка) |
|---|---|---|---|
| 0 | Страховка | Тег `v1.3-refactor-base`; `npm run typecheck` (tsc --noEmit) в package.json; список E2E-сценариев в этот файл; worklog-запись | dev.log чист, все сценарии зелёные на base |
| 1 | Механический TS | `engine.js → engine.ts` без единой правки логики; сверка `@types/three` ↔ `three` (пин 0.180.x при конфликтах); фиксация ошибок типов (минимум: сигнатуры, null-checks) | tsc --noEmit 0 ошибок; boot + бой + сейв/лоад зелёные |
| 2 | Чистые листья | Вынос `rng.ts`, `utils.ts`, `constants.ts`, `world/grid.ts` (A* — чистые функции на аргументах), боевой математики (`hitChance/avgDamage/attackMod` как pure), `loot.ts`-таблиц | boot; бои не изменились (тот же сид srand — урон/лут совпадают) |
| 3 | Доменные типы | `types.ts` (Unit/Weapon/Status/Quest/SaveData/MapDef); типизация `S`, сейва, юнитов; UI-реестр `UI` в hud.ts, замена строковых id | tsc; сейв v2 экспорт→импорт байт-в-байт совместим |
| 4 | Stateful-системы (4a–4h, коммит на каждую) | 4a state+ctx и `fx/tweens`; 4b render+world (maps/props/scenery); 4c entities; 4d combat+statuses+abilities; 4e movement+turns+progression; 4f ai; 4g interact (квесты/диалоги/магазин); 4h ui (overlays/markers/party/targeting) + save | Полный E2E-список после каждой подсистемы |
| 5 | Слим-оркестратор + строгий режим | engine.ts = сборка/инпут/цикл/dispose (≤800 строк); `allowJs:false`, `noImplicitAny:true`, ESLint `no-explicit-any: warn`; README-структура | tsc strict; **все** сценарии; двойной ремоунт React чистый |
| 6 | (опц.) Реакт-HUD | Перевод HUD_HTML → React-компоненты, zustand-стор для UI-состояния. Отдельная инициатива — **не в этом рефакторинге** | — |

Оценка объёма: фазы 1–5 — по одному рабочему сеансу каждая (4 делится на 8 коротких шагов). Итого ≈ 6 сеансов до полного DoD; игровой смысл появляется уже после Фазы 2 (математика и сетка вынесены и типизированы).

### E2E-сценарии (неизменный список для всех гейтов)

1. boot: консоль `[bg3] … boot complete`, WebGL2/bloom, ошибок нет
2. свободный бой: атака героя → лог/урон/смерть гоблина; ход ИИ (сближение/атака)
3. заклинание: огненный шар по области (взрыв, огонь на тайле, урон через ход)
4. переход карт: вход в крипту → загрузка, босс-бар, выход/возврат
5. сейв: doSave(1) → doLoad(2) → 4 героя с теми же hp/уровнями/статусами
6. экспорт JSON → импорт в другой слот → загрузка
7. магазин: покупка (золото/инвентарь меняются), диалог Илвы/Кая
8. gfx: переключение пресета качества → pixelRatio/тени применились
9. React-ремоунт (двойной mount/unmount GameClient) — консоль чистая, двойной boot не ломает DOM

---

## 6. Стандарт TS (что считаем «единым стандартом»)

- **Только `.ts`/`.tsx`** в `src/` (кроме css). Замок — `allowJs:false` в Фазе 5: новый .js физически не скомпилируется.
- **tsconfig-рампа**: сейчас `strict:true` обесценен `noImplicitAny:false`. Фаза 3 — вернуть `noImplicitAny` для новых каталогов (per-file `// @ts-…`-поблажки запрещены, кроме не более 3 мест с комментарием TODO-ссылкой на фазу), Фаза 5 — глобально true + удалить поблажки.
- **Соглашения**: именованные экспорты (никаких default, кроме Next-страниц); `interface` для форм данных, `type` для юнионов; `as const` для словарей (STATUS, LOOT, MAPS); enum не используем (юнионы строк); `import type` для чисто-типовых импортов; ошибки — через `Result`-стиль не вводим, `throw` только в dev-инвариантах.
- **Запрещено**: `any` (кроме миграционных TODO с тикетом-фазой), `!` non-null вне DOM-реестра, магические строковые DOM-id (только реестр `UI`), дубли констант.
- **Линтер**: `@typescript-eslint/no-explicit-any: warn`, `no-unused-vars: error`, `prefer-const: error`; правило границ слоёв (Boundaries) — опционально в Фазе 5.
- **Тесты**: pure-модули Фазы 2 (rng/математика/A*/лут) покрываются vitest-смоуками (опционально, ≤ 10 кейсов) — защита от регрессий баланса при переносе.

---

## 7. Definition of Done

- [ ] В `src/` нет ни одного `.js`-модуля; `allowJs:false`
- [ ] engine.ts ≤ ~800 строк и не содержит ни одной игровой системы, только сборку/цикл/диспоз
- [ ] tsc --noEmit: 0 ошибок при `noImplicitAny:true`; линт без `any`-предупреждений в игровых модулях
- [ ] Все 9 E2E-сценариев зелёные; сейвы формата v2 (включая существующие слоты пользователей) загружаются
- [ ] Каждый модуль ≤ 400 строк; циклических импортов нет (`dpdm --exit-warn-count 0`)
- [ ] README обновлён (структура, вклад разработчика «куда класть новые системы»)
- [ ] worklog: запись на каждую фазу с результатами E2E

## 8. Реестр рисков

| Риск | Митигация |
|---|---|
| Поведенческие регрессии при переезде closure→ctx (порядок инициализации, hoisting) | Перенос «как есть» без рефакторинга логики внутри функций; E2E-гейт на каждый шаг; теги-коммиты |
| Двойной mount React (StrictMode/HMR) при выносе состояния из замыкания | `dispose() → resetState()`; сценарий 9 в каждом гейте |
| Сломать формат сейва v2 | `gameSnapshot/applyGame` переносится дословно; сценарий 5–6; SAVE_VER не меняется |
| Конфликт `@types/three@0.186` ↔ `three@0.180` при включении типов | Пин `@types/three@~0.180` в Фазе 1, проверка `three/tsl`/`BloomNode` типажей до массового перевода |
| Снежный ком самого рефакторинга (растёт объём фаз) | Правило «сеанс=фаза», заморозка фич, вылет фазы → резать фазу, не «доделывать позже» |
| Потеря игровых фиксов из веток во время заморозки | Заморозка ≤ 6 сеансов; багфиксы сразу портируются в новые модули по факту выноса |

## 9. Что сознательно НЕ входит в этот рефакторинг

- GLTF/Mixamo-анимации и настоящий bloom-TSL апгрейд (отдельная техистория, высокий риск WebGL2).
- Перевод HUD на React-компоненты / zustand (Фаза 6, опционально, после DoD).
- Любой ребаланс, новый контент, новые карты, мультиплеер — после рефакторинга каждая фича кладётся в уже готовые слои (`systems/…`), а не в god-файл.
