/* ================= BUS (Фаза 5 рефакторинга) =================
   Шина поздних связей — разрыв оставшихся циклов импортов
   (REFACTORING.md §5 «разрыв циклов (event-bus) — Фаза 5», §7 DoD
   «циклических импортов нет»). Владелец функции привязывает реализацию
   при загрузке модуля (все модули статически достижимы из engine.ts,
   привязки отрабатывают до bootGame()); потребитель из нижнего слоя
   вызывает слот. Несвязанный слот — no-op. Одно имя = одна реализация
   (bind перезаписывает — идемпотентно при ремоунте). */
import type { MapId, Unit } from './types';

export class Slot<A extends unknown[]>{
  private f:((...a:A)=>unknown)|null=null;
  bind(f:(...a:A)=>unknown){this.f=f;}
  call(...a:A){if(this.f)return this.f(...a);}
}

export const bus={
  /* UI-refresh (реализации — ui/party.ts и ui/actionbar.ts) */
  refreshParty:new Slot<[]>(),
  refreshInit:new Slot<[]>(),
  refreshBossBar:new Slot<[]>(),
  refreshUI:new Slot<[]>(),
  openExploreUI:new Slot<[]>(),
  /* трекер квестов (реализация — interact/quests.ts) */
  refreshTracker:new Slot<[]>(),
  /* диалоги (реализации — interact/dialog.ts) */
  openDlg:new Slot<[string]>(),
  closeDlgHard:new Slot<[]>(),
  /* мировой поток (реализации — interact/explore.ts, world/maps.ts, systems/ai.ts) */
  checkTriggers:new Slot<[]>(),
  switchMap:new Slot<[MapId]>(),
  aiTurn:new Slot<[Unit]>(),
  /* v1.4: обучение (реализация — ui/tutorial.ts; события реальных действий
     игрока шлют explore/dialog/turns/combat/targeting/slots) */
  tutEvent:new Slot<[string]>(),
  /* v1.9: арена «Испытание Глубин» (реализация — interact/arena.ts;
     progression зовёт слот после победы в волне — разрыв цикла
     progression→arena: arena импортирует turns→progression) */
  arenaNext:new Slot<[]>(),
  /* v2.1: «БЕЗДНА ЗОВЁТ» — чемпион бездны на полсмерти зовёт подкрепление
     (реализация — interact/arena.ts; combat зовёт слот из damageUnit —
     прямой импорт combat→arena замкнул бы цикл) */
  champCall:new Slot<[Unit]>(),
  /* v2.1: разбор мира срывает заход арены (реализация — interact/arena.ts;
     maps.ts зовёт слот в teardownWorld — запись в журнал без цикла maps→arena) */
  arenaBreak:new Slot<[]>(),
};
