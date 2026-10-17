/* ================= SYSTEMS/LOOT (Фаза 2 рефакторинга) =================
   Таблицы лута (данные, v1.3). Ключ таблицы выбирается в rollLoot (engine):
   босс → boss, кастеры → cultist, нежить → undead, прочие гоблины → goblin.
   rollLoot/giveToParty переезжают сюда в Фазе 4d — им нужен контекст G,
   fx/glows/log и refreshParty; сейчас движок импортирует только таблицу. */

export const LOOT={
  goblin:{gold:[2,7],potion:0.12,oil:0.10},
  undead:{gold:[3,9],potion:0.15,oil:0.06},
  cultist:{gold:[5,12],potion:0.22,oil:0.15},
  boss:{gold:[18,32],potion:1,oil:0.6},
} as const;

export type LootKey=keyof typeof LOOT;
