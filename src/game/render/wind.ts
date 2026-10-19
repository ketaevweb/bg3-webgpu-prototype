/* ============================================================
 * v2.9 «Лик Фаэруна» — ВЕТЕР: качание травы/камыша через TSL.
 * MeshStandardNodeMaterial с positionNode: вершины гнутся синусоидой
 * от времени + мировой позиции (фаза своя у каждого кустика без
 * инстансинга). Работает на обоих бекендах WebGPURenderer (WebGPU и
 * WebGL2-fоллбек) — bloom на TSL уже стоит в проде. При ошибке сборки
 * узла — честный фоллбек в обычный MeshStandardMaterial (no-throw).
 * ЛИСТ-модуль: только three/webgpu + three/tsl. E2E — windStats().
 * ============================================================ */
import * as THREE from 'three/webgpu';
import { time, positionLocal, positionWorld, sin, vec3, float, max } from 'three/tsl';

let active = 0;/* счётчик живых wind-материалов (E2E) */

export function windStats(): { active: number } {
  return { active };
}

export type SwayOpts = {
  amp?: number;/* амплитуда в метрах на верхушке */
  speed?: number;/* частота взмахов */
};

/** материал с ветровым качанием (изгиб растёт к вершине по локальному y) */
export function makeSwayMaterial(params: { color: number; roughness?: number }, o: SwayOpts = {}): THREE.Material {
  const amp = o.amp ?? 0.09;
  const speed = o.speed ?? 1.6;
  try {
    const mat = new THREE.MeshStandardNodeMaterial({ color: params.color, roughness: params.roughness ?? 1 });
    /* фаза: мировая X даёт длинную волну через поле, Z — крест-накрест;
       изгиб — по локальной высоте (конус травинки: низ почти стоит) */
    const phase = positionWorld.x.mul(1.7).add(positionWorld.z.mul(1.1));
    const bend = sin(time.mul(speed).add(phase)).mul(amp);
    const mask = max(positionLocal.y, float(0)).mul(0.9);
    mat.positionNode = positionLocal.add(vec3(bend.mul(mask), float(0), bend.mul(mask).mul(0.55)));
    active++;
    return mat;
  } catch (e) {
    console.warn('[bg3] sway material fallback:', e);
    return new THREE.MeshStandardMaterial({ color: params.color, roughness: params.roughness ?? 1 });
  }
}
