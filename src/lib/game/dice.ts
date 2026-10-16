export const roll = (sides: number): number => 1 + Math.floor(Math.random() * sides);

export const d20 = (): number => roll(20);

/**
 * Бросок атаки d20 с учётом преимущества/помехи (2d20 — лучший/худший).
 * Одновременные преимущество и помеха взаимно гасятся (как в D&D 5e).
 */
export function rollD20(adv = false, dis = false): number {
  if (adv && dis) return d20();
  const a = d20();
  if (adv) return Math.max(a, d20());
  if (dis) return Math.min(a, d20());
  return a;
}

/** Шанс попадания (0..1): нужно выбросить не меньше «ac − бонус», с полом/потолком 5%/95%. */
export function hitChance(bonus: number, ac: number, adv = false, dis = false): number {
  const need = Math.max(2, ac - bonus);
  let p = (21 - need) / 20;
  p = Math.max(0.05, Math.min(0.95, p));
  if (adv && !dis) p = 1 - (1 - p) * (1 - p);
  if (dis && !adv) p = p * p;
  return p;
}

export interface DiceResult {
  total: number;
  rolls: number[];
}

export function rollDice(count: number, sides: number, mod = 0): DiceResult {
  const rolls = Array.from({ length: count }, () => roll(sides));
  const total = rolls.reduce((a, b) => a + b, 0) + mod;
  return { total, rolls };
}

export const fmtDice = (c: number, s: number, m: number): string =>
  `${c}d${s}${m >= 0 ? '+' + m : m}`;

export const sleep = (ms: number): Promise<void> =>
  new Promise<void>((res) => setTimeout(res, ms));
