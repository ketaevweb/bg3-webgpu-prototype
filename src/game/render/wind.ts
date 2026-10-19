/* ============================================================
 * ВЕТЕР: качание травы/листвы через TSL (v2.9, v3.0 — +текстуры).
 * MeshStandardNodeMaterial с positionNode: вершины гнутся синусоидой
 * от времени + мировой позиции (фаза своя у каждого кустика без
 * инстансинга). Работает на обоих бекендах WebGPURenderer (WebGPU и
 * WebGL2-fоллбек) — bloom на TSL уже стоит в проде. При ошибке сборки
 * узла — честный фоллбек в обычный MeshStandardMaterial (no-throw).
 * v3.0: параметры принимают map (атлас-палитра Nature) — FBX-растения
 * качаются с настоящей раскраской Synty. ЛИСТ-модуль: three/webgpu+tsl.
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

export type SwayParams = {
  color?: number;
  map?: THREE.Texture | null;/* v3.0: палитра/атлас Nature */
  roughness?: number;
};

/** материал с ветровым качанием (изгиб растёт к вершине по локальному y) */
export function makeSwayMaterial(params: SwayParams, o: SwayOpts = {}): THREE.Material {
  const amp = o.amp ?? 0.09;
  const speed = o.speed ?? 1.6;
  const color = params.color ?? 0xffffff;
  try {
    const mat = new THREE.MeshStandardNodeMaterial({ color, roughness: params.roughness ?? 1 });
    if (params.map) mat.map = params.map;
    /* v3.1: прозрачность листвы и в ветровом материале (клоны листвы качаются
       с тем же полупрозрачным краем, что и статичные) */
    if (params.map) { mat.transparent = true; mat.opacity = 0.92; mat.alphaTest = 0.3; mat.side = THREE.DoubleSide; }
    /* фаза: мировая X даёт длинную волну через поле, Z — крест-накрест;
       изгиб — по локальной высоте (конус травинки: низ почти стоит,
       крона дерева гнётся сильнее — маска одна на всё) */
    const phase = positionWorld.x.mul(1.7).add(positionWorld.z.mul(1.1));
    const bend = sin(time.mul(speed).add(phase)).mul(amp);
    const mask = max(positionLocal.y, float(0)).mul(0.9);
    mat.positionNode = positionLocal.add(vec3(bend.mul(mask), float(0), bend.mul(mask).mul(0.55)));
    active++;
    return mat;
  } catch (e) {
    console.warn('[bg3] sway material fallback:', e);
    return new THREE.MeshStandardMaterial({ color, map: params.map ?? undefined, roughness: params.roughness ?? 1 });
  }
}
