/* ============================================================
 * v1.7 «Хореография битвы» — библиотека движений (motion.ts)
 * Источник: Unity-пакеты анимаций (Blink "FREE - 32 RPG Animations",
 * DoubleL RPG Animations), офлайн-ретаргет на скелет Soldier.glb
 * (mixamorig) — scripts/bake_motions.mjs → public/models/rig/motions.glb.
 * Клипы проименованы ролями: idle/walk/run/attack1h/attack2h/cast/
 * hit/death/punchL/punchR/block. Модуль-лист: только three, без
 * внутреигровых импортов (граф зависимостей ацикличен).
 * ============================================================ */
import * as THREE from 'three/webgpu';

const MOTIONS_URL = '/models/rig/motions.glb';

export type MotionRole =
  | 'idle' | 'idleCombat' | 'walk' | 'run'
  | 'attack1h' | 'attack2h' | 'cast' | 'hit' | 'death'
  | 'punchL' | 'punchR' | 'block';

const ROLES: readonly MotionRole[] = [
  'idle', 'idleCombat', 'walk', 'run',
  'attack1h', 'attack2h', 'cast', 'hit', 'death',
  'punchL', 'punchR', 'block',
];

const clips: Partial<Record<MotionRole, THREE.AnimationClip>> = {};
let pending: Promise<boolean> | null = null;

/** Загружает motions.glb (один раз; повторные вызовы ждут тот же промис). */
export function loadMotions(): Promise<boolean> {
  if (pending) return pending;
  pending = (async () => {
    try {
      const head = await fetch(MOTIONS_URL, { method: 'HEAD' });
      if (!head.ok) { console.warn('[bg3] motions.glb отсутствует — процедурные фолбэки'); return false; }
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(MOTIONS_URL);
      let n = 0;
      for (const c of gltf.animations ?? []) {
        const role = c.name as MotionRole;
        if ((ROLES as readonly string[]).includes(role) && !clips[role]) { clips[role] = c; n++; }
      }
      console.log('[bg3] motion library:', n, 'клипов из', (gltf.animations ?? []).length);
      return n > 0;
    } catch (e) {
      console.warn('[bg3] motions.glb не загрузился:', e);
      return false;
    }
  })();
  return pending;
}

/** Клип по роли (null — нет в библиотеке). */
export function clipFor(role: MotionRole): THREE.AnimationClip | null {
  return clips[role] ?? null;
}

/** Есть ли вообще библиотека (для выбора между клипом и процедурой). */
export function hasMotions(): boolean {
  return Object.keys(clips).length > 0;
}

/** Статистика для E2E-гейтов (__bg3.animStats). */
export function motionStats(): { loaded: number; roles: string[] } {
  return { loaded: Object.keys(clips).length, roles: Object.keys(clips).sort() };
}
