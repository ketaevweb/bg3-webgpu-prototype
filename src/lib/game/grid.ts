/**
 * v0.4 — Сеточный патфайндинг: A*, Дейкстра (достижимость за бюджет), LOS.
 * Чистая логика без Three.js. Сетка покрывает арену: x ∈ [-20.4, 20.4], z ∈ [-28.8, 16.8].
 */

export const TILE = 1.2;
export const GRID_W = 34;
export const GRID_H = 38;
export const GRID_OX = -(GRID_W * TILE) / 2;
export const GRID_OZ = -6 - (GRID_H * TILE) / 2;

export const idx = (i: number, j: number): number => j * GRID_W + i;
export const inGrid = (i: number, j: number): boolean =>
  i >= 0 && j >= 0 && i < GRID_W && j < GRID_H;

export function tileOf(x: number, z: number): { i: number; j: number } {
  return { i: Math.floor((x - GRID_OX) / TILE), j: Math.floor((z - GRID_OZ) / TILE) };
}

export function tileCenter(i: number, j: number): { x: number; z: number } {
  return { x: GRID_OX + (i + 0.5) * TILE, z: GRID_OZ + (j + 0.5) * TILE };
}

export const DIRS8: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export type BlockedFn = (i: number, j: number) => boolean;

export interface PathTile {
  i: number;
  j: number;
}

/**
 * A* по 8 направлениям. Диагональ запрещена «через угол» (нужны оба ортогональных соседа).
 * Стоимость: прямо 1, по диагонали 1.4. Возвращает путь БЕЗ стартовой клетки.
 */
export function findPath(
  blocked: BlockedFn,
  si: number,
  sj: number,
  ti: number,
  tj: number
): PathTile[] | null {
  if (!inGrid(si, sj) || !inGrid(ti, tj)) return null;
  if (blocked(ti, tj)) return null;
  if (si === ti && sj === tj) return [];

  const N = GRID_W * GRID_H;
  // Float64: float32 вносит погрешность ~2e-8, ломающую проверку устаревших узлов (eps 1e-9)
  const g = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const h = (i: number, j: number): number => {
    const dx = Math.abs(i - ti);
    const dy = Math.abs(j - tj);
    return Math.max(dx, dy) + 0.4 * Math.min(dx, dy);
  };
  const sk = idx(si, sj);
  g[sk] = 0;
  const open: Array<{ i: number; j: number; f: number }> = [{ i: si, j: sj, f: h(si, sj) }];

  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
    const cur = open.splice(bi, 1)[0];
    const ck = idx(cur.i, cur.j);
    if (closed[ck]) continue;
    closed[ck] = 1;

    if (cur.i === ti && cur.j === tj) {
      const path: PathTile[] = [];
      let c = ck;
      while (c !== sk && c >= 0) {
        path.push({ i: c % GRID_W, j: Math.floor(c / GRID_W) });
        c = prev[c];
      }
      return path.reverse();
    }

    for (const [di, dj] of DIRS8) {
      const ni = cur.i + di;
      const nj = cur.j + dj;
      if (!inGrid(ni, nj) || blocked(ni, nj)) continue;
      if (di !== 0 && dj !== 0 && (blocked(cur.i + di, cur.j) || blocked(cur.i, cur.j + dj))) continue;
      const nk = idx(ni, nj);
      if (closed[nk]) continue;
      const ng = g[ck] + (di !== 0 && dj !== 0 ? 1.4 : 1);
      if (ng < g[nk] - 1e-9) {
        g[nk] = ng;
        prev[nk] = ck;
        open.push({ i: ni, j: nj, f: ng + h(ni, nj) });
      }
    }
  }
  return null;
}

export interface Reach {
  cost: Float64Array;
  prev: Int32Array;
  start: number;
}

/** Дейкстра от стартовой клетки в пределах бюджета (в клетках). */
export function findReachable(
  blocked: BlockedFn,
  si: number,
  sj: number,
  budget: number
): Reach {
  const N = GRID_W * GRID_H;
  // Float64: см. findPath — точность стоимостей критична для диагональных шагов
  const cost = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const sk = idx(si, sj);
  cost[sk] = 0;
  const open: Array<{ i: number; j: number; g: number }> = [{ i: si, j: sj, g: 0 }];
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k].g < open[bi].g) bi = k;
    const cur = open.splice(bi, 1)[0];
    const ck = idx(cur.i, cur.j);
    if (cur.g > cost[ck] + 1e-9) continue;
    for (const [di, dj] of DIRS8) {
      const ni = cur.i + di;
      const nj = cur.j + dj;
      if (!inGrid(ni, nj) || blocked(ni, nj)) continue;
      if (di !== 0 && dj !== 0 && (blocked(cur.i + di, cur.j) || blocked(cur.i, cur.j + dj))) continue;
      const ng = cost[ck] + (di !== 0 && dj !== 0 ? 1.4 : 1);
      if (ng > budget + 1e-9) continue;
      const nk = idx(ni, nj);
      if (ng < cost[nk] - 1e-9) {
        cost[nk] = ng;
        prev[nk] = ck;
        open.push({ i: ni, j: nj, g: ng });
      }
    }
  }
  return { cost, prev, start: sk };
}

/** Восстанавливает путь из карты Дейкстры (без стартовой клетки). */
export function pathFromReach(r: Reach, ti: number, tj: number): PathTile[] {
  const k = idx(ti, tj);
  if (!isFinite(r.cost[k])) return [];
  const path: PathTile[] = [];
  let c = k;
  while (c !== r.start && c >= 0) {
    path.push({ i: c % GRID_W, j: Math.floor(c / GRID_W) });
    c = r.prev[c];
  }
  return path.reverse();
}

/** Есть ли прямая видимость между точками (сэмплирование линии по сетке). */
export function hasLOS(blocked: BlockedFn, x1: number, z1: number, x2: number, z2: number): boolean {
  const dist = Math.hypot(x2 - x1, z2 - z1);
  const steps = Math.max(2, Math.ceil(dist / (TILE * 0.4)));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const q = tileOf(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t);
    if (inGrid(q.i, q.j) && blocked(q.i, q.j)) return false;
  }
  return true;
}

/** Статические препятствия арены: колонны руин, костёр, валуны v0.4. */
export const STATIC_OBSTACLES: Array<{ x: number; z: number; r: number }> = [
  // руины (группа в world.ts смещена на (9, -13))
  { x: 6.4, z: -14.4, r: 0.6 },
  { x: 7.4, z: -11.2, r: 0.6 },
  { x: 11.2, z: -13.6, r: 0.6 },
  { x: 12.0, z: -11.4, r: 0.6 },
  { x: 9.2, z: -10.4, r: 0.6 },
  // костёр
  { x: 3.2, z: -2.5, r: 0.55 },
  // валуны v0.4 (мешы строит engine)
  { x: -4.2, z: -7.5, r: 0.9 },
  { x: 5.6, z: -3.2, r: 0.9 },
  { x: -7.0, z: -11.5, r: 0.9 },
  { x: 0.5, z: -9.8, r: 0.85 },
];

export function buildStaticBlockers(): Set<number> {
  const s = new Set<number>();
  for (const o of STATIC_OBSTACLES) {
    const c = tileOf(o.x, o.z);
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const i = c.i + di;
        const j = c.j + dj;
        if (!inGrid(i, j)) continue;
        const t = tileCenter(i, j);
        if (Math.hypot(t.x - o.x, t.z - o.z) <= o.r + TILE * 0.34) s.add(idx(i, j));
      }
    }
  }
  return s;
}
