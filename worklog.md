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
