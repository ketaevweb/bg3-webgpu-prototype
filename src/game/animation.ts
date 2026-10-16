/* ============================================================
 * BG3 Web Prototype v0.7 — анимационные риги
 * Шаг 1 (сейчас): процедурное «дыхание» капсульных фигур через
 * внутренний u.rig (внешний mesh остаётся под управлением твинов
 * движения/смерти — конфликтов нет).
 * Шаг 2 (v0.7.x, флаг ENABLE_GLTF): подмена капсул на GLTF-риги
 * (Mixamo/Soldier.glb) с AnimationMixer и фоллбеком на капсулы.
 * ============================================================ */
import * as THREE from 'three/webgpu';

export const ENABLE_GLTF = false; // включается в v0.7.x после подбора ригов

type RigUnit = {
  alive: boolean;
  rig?: THREE.Object3D;
  phase?: number;
  moving?: boolean;
};

/**
 * Заготовка GLTF-апгрейда: загрузит риг, сгенерирует AnimationMixer
 * и заменит капсулу. Держим инфраструктуру готовой, но выключенной.
 */
export async function tryUpgradeToGltf(
  _unit: RigUnit,
  _url: string,
  _clips: Record<string, string>,
): Promise<boolean> {
  if (!ENABLE_GLTF) return false;
  // v0.7.x: GLTFLoader + AnimationMixer + маппинг Idle/Walk/Run/Attack
  return false;
}

export class AnimRigs {
  private units = new Set<RigUnit>();

  register(u: RigUnit) { this.units.add(u); }
  unregister(u: RigUnit) { this.units.delete(u); }

  update(_dt: number, t: number) {
    for (const u of this.units) {
      if (!u.alive || !u.rig) continue;
      const ph = u.phase ?? 0;
      // «дыхание» + лёгкое покачивание; при движении — частая дрожь шага
      const breathe = Math.sin(t * 2.1 + ph) * 0.032;
      const stepShiver = u.moving ? Math.abs(Math.sin(t * 14 + ph)) * 0.05 : 0;
      u.rig.position.y = breathe + stepShiver;
      u.rig.rotation.z = Math.sin(t * 1.7 + ph) * 0.02;
    }
  }
}
