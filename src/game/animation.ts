/* ============================================================
 * BG3 Web Prototype v1.7 — анимационные риги (GLTF/Mixamo + Unity-клипы)
 * - Юниты (герои, враги, боссы, саммоны) получают скелетный риг Soldier.glb
 *   с AnimationMixer; движения — библиотека motion.ts (Unity-пакеты,
 *   офлайн-ретаргет на mixamorig, см. scripts/bake_motions.mjs).
 * - Стейт-машина: idle/idleCombat (в бою), walk/run по moving,
 *   одноразовые attack (по классу), hit (реакция на урон),
 *   death (замирает в лежачей позе). Кроссфейды 0.18с.
 * - Без библиотеки/файлов — фолбэки: клипы Soldier.glb + процедурные
 *   «дыхание»/замах. mixer.update(dt) получает слоумо-dt (криты замедляют
 *   и анимации).
 * ============================================================ */
import * as THREE from 'three/webgpu';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { clipFor, loadMotions, motionStats } from './motion';
import type { MotionRole } from './motion';
/* ВАЖНО: без импорта fx/tweens — здесь цикл animation→tweens→renderer→animation;
   процедурный замах анимируется собственным списком в AnimRigs.update (ниже). */

export const ENABLE_GLTF = true;

/** v1.7: модель — CDN Soldier (как в v1.6); клипы — motions.glb (Unity-ретаргет).
 *  Локальный /models/rig/soldier.glb не используем: парс экспорта вешает
 *  SkeletonUtils.clone в браузере (гонка с пересборкой пайплайна рендера). */
export const RIG_URL = '/models/rig/soldier.glb';
const RIG_FALLBACK = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r180/examples/models/gltf/Soldier.glb';

type RigUnit = {
  alive: boolean;
  inCombat?: boolean;
  rig?: THREE.Object3D;
  phase?: number;
  moving?: boolean;
  _mixer?: THREE.AnimationMixer | null;
  _actions?: Record<string, THREE.AnimationAction>;
  _currentAnim?: string;
  _gltfRig?: boolean;
  _attackT?: number;/* v1.6: во время атак-клипа update() не переключает анимацию */
  _hitT?: number;/* v1.7: реакция на урон (одноразовый клип) */
  _deathT?: number;/* v1.7: смерть — миксер крутится и после alive=false */
};

/* ---------- кэш загрузки GLTF (одна модель на всех) ---------- */
let gltfCache: Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> | null = null;

async function loadRig(url: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  if (!gltfCache) {
    gltfCache = (async () => {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      const loaded = await loader.loadAsync(url);
      return { scene: loaded.scene, animations: loaded.animations ?? [] };
    })();
    gltfCache.catch(() => { gltfCache = null; }); // позволяем ретрай по fallback
  }
  return gltfCache;
}

async function loadRigWithFallback(): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  try {
    return await loadRig(RIG_URL);
  } catch {
    return loadRig(RIG_FALLBACK);
  }
}

/* ---------- v1.7: конфиг анимации по классу/роли ---------- */
export type AnimSet = 'blade' | 'heavy' | 'spell' | 'dagger' | 'brawler';
const ATTACK_ROLE: Record<AnimSet, MotionRole> = {
  blade: 'attack1h', heavy: 'attack2h', spell: 'cast', dagger: 'punchR', brawler: 'punchL',
};
const CFG: Record<string, { set: AnimSet; tint: number; scale?: number }> = {
  fighter: { set: 'blade', tint: 0x5a7fb0 },
  wizard: { set: 'spell', tint: 0x9a6ab8 },
  rogue: { set: 'dagger', tint: 0x3f7a6a },
  cleric: { set: 'spell', tint: 0xc9a84a },
  druid: { set: 'spell', tint: 0x4a7a5f },
  goblin: { set: 'brawler', tint: 0x7ba24a, scale: 0.92 },
  undead: { set: 'brawler', tint: 0xb8b8a8, scale: 0.95 },
  cultist: { set: 'blade', tint: 0x8a4a6a },
  necro: { set: 'spell', tint: 0x6a4a8a, scale: 1.1 },
  ogre: { set: 'heavy', tint: 0x8a7a5f, scale: 1.15 },
  giant: { set: 'heavy', tint: 0xb03424, scale: 1.3 },
  boss: { set: 'heavy', tint: 0xb03424, scale: 1.24 },
  swampboss: { set: 'spell', tint: 0x4a6a8a, scale: 1.1 },
  knight: { set: 'blade', tint: 0x6a7a8a, scale: 1.05 },  // v1.8: рыцарь-отступник
  lord: { set: 'heavy', tint: 0x3f6a5a, scale: 1.18 },    // v1.8: лорд-комендант Малвех
};
export type RigOpts = {
  tint?: number;        // цвет-подкраска текстуры (класс/фракция)
  tintStrength?: number;// 0..1
  scale?: number;       // рост модели
  yaw?: number;         // разворот модели внутрь рига
  animSet?: AnimSet;    // v1.7: набор атак-клипов по классу
};

/** v1.7: авто-конфиг рига из полей юнита (класс/босс/элита). */
export function animOptsFor(u: { cls?: string; side?: string; isBoss?: boolean; giantBoss?: boolean; isBarrel?:boolean }): RigOpts {
  if (u.isBarrel) return { tint: 0x8a6a4a, tintStrength: 0.4, scale: 1.0, yaw: Math.PI, animSet: 'blade' };
  const c = CFG[u.cls ?? ''] ?? { set: u.side === 'hero' ? 'blade' as const : 'brawler' as const, tint: u.side === 'hero' ? 0x5a7fb0 : 0x7ba24a };
  let scale = c.scale ?? 1.0;
  if (u.giantBoss) scale = Math.max(scale, 1.3);
  else if (u.isBoss) scale = Math.max(scale, 1.24);
  const tint = (u.isBoss || u.giantBoss) ? 0xb03424 : c.tint;
  return { tint, tintStrength: 0.4, scale, yaw: Math.PI, animSet: c.set };
}

/**
 * Заменяет капсульную фигурку юнита скелетным ригом.
 * Идемпотентно (повторный вызов — no-op). Асинхронно ждёт риг и библиотеку
 * движений, строит действия: локомоция (idle/idleCombat/walk/run) + одноразовые
 * attack/hit/death. Возвращает true, если риг подключён.
 */
export async function upgradeUnitRig(unit: RigUnit, opts: RigOpts = {}): Promise<boolean> {
  if (!ENABLE_GLTF || !unit.rig) return false;
  if (unit._gltfRig) return true;/* v1.7: идемпотентность (авто-риг в makeUnit + ручные вызовы) */
  try {
    const [{ scene: baseScene, animations }, ] = await Promise.all([loadRigWithFallback(), loadMotions()]);
    const model = SkeletonUtils.clone(baseScene) as THREE.Group;

    /* v1.7: boundingSphere скелетного меша не следует за костями — не кулим */
    model.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh) m.frustumCulled = false; });

    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
      if (Array.isArray(mat)) {
        mesh.material = mat.map((m) => {
          const c = m.clone();
          if (opts.tint !== undefined) c.color.lerp(new THREE.Color(opts.tint), opts.tintStrength ?? 0.35);
          return c;
        });
      } else if (mat && 'clone' in mat) {
        const c = mat.clone();
        if (opts.tint !== undefined) c.color.lerp(new THREE.Color(opts.tint), opts.tintStrength ?? 0.35);
        mesh.material = c;
      }
    });

    model.scale.setScalar(opts.scale ?? 1.0);

    const holder = new THREE.Group();
    holder.add(model);
    holder.rotation.y = opts.yaw ?? Math.PI;

    // прячем капсулу (тело/голова/оружие), кольцо фракции оставляем
    for (const ch of [...unit.rig.children]) ch.visible = false;
    unit.rig.add(holder);

    const mixer = new THREE.AnimationMixer(model);
    const find = (re: RegExp) => animations.find((a) => re.test(a.name));
    const actions: Record<string, THREE.AnimationAction> = {};
    /* v1.7: приоритет — библиотека движений, фолбэк — родные клипы Soldier */
    const idle = clipFor('idle') ?? find(/^idle/i);
    const idleCombat = clipFor('idleCombat') ?? idle;
    const walk = clipFor('walk') ?? find(/^walk/i);
    const run = clipFor('run') ?? find(/^run/i);
    if (idle) actions.idle = mixer.clipAction(idle);
    if (idleCombat) actions.idleCombat = mixer.clipAction(idleCombat);
    if (walk) actions.walk = mixer.clipAction(walk);
    if (run) actions.run = mixer.clipAction(run);
    const oneShot = (role: MotionRole, clamp: boolean) => {
      const c = clipFor(role);
      if (!c) return null;
      const a = mixer.clipAction(c);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = clamp;
      return a;
    };
    const atk = oneShot(ATTACK_ROLE[opts.animSet ?? 'blade'], false);
    if (atk) {
      actions.attack = atk;
      mixer.addEventListener('finished', () => { unit._currentAnim = 'idle'; });
    }
    const hit = oneShot('hit', false);
    if (hit) actions.hit = hit;
    const death = oneShot('death', true);
    if (death) actions.death = death;

    unit._mixer = mixer;
    unit._actions = actions;
    unit._gltfRig = true;
    unit._currentAnim = 'idle';
    actions.idle?.reset().fadeIn(0.2).play();
    return true;
  } catch (e) {
    console.warn('[bg3] GLTF rig failed:', e);
    return false;
  }
}

export class AnimRigs {
  private units = new Set<RigUnit>();
  /* v1.6: активные процедурные замахи (fallback без клипов) */
  private swings: { u: RigUnit; t: number; dur: number }[] = [];

  register(u: RigUnit) { this.units.add(u); }
  unregister(u: RigUnit) { this.units.delete(u); }
  /* v1.6: поставить процедурный замах в очередь */
  queueSwing(u: RigUnit, dur = 0.34) {
    if (this.swings.some(s => s.u === u)) return;/* не спамим: один замах за раз */
    this.swings.push({ u, t: 0, dur });
  }
  /* v1.7: статистика для E2E */
  stats() {
    let rigs = 0, withAttack = 0, withDeath = 0;
    for (const u of this.units) {
      if (u._gltfRig) rigs++;
      if (u._actions?.attack) withAttack++;
      if (u._actions?.death) withDeath++;
    }
    return { units: this.units.size, rigs, withAttack, withDeath };
  }

  private setAnim(u: RigUnit, next: string) {
    if (u._currentAnim === next) return;
    const actions = u._actions ?? {};
    const from = u._currentAnim ? actions[u._currentAnim] : null;
    const to = actions[next];
    if (!to) return;
    to.reset().fadeIn(0.18).play();
    from?.fadeOut(0.18);
    u._currentAnim = next;
  }

  update(dt: number, t: number) {
    /* v1.6: процедурные замахи — наклон корпуса рига синусом (fire-and-forget) */
    for (let i = this.swings.length - 1; i >= 0; i--) {
      const s = this.swings[i];
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      if (s.u.rig) s.u.rig.rotation.x = -0.55 * Math.sin(k * Math.PI);
      if (k >= 1 || !s.u.alive) {
        if (s.u.rig) s.u.rig.rotation.x = 0;
        this.swings.splice(i, 1);
      }
    }
    for (const u of this.units) {
      /* v1.7: смерть — миксер доигрывает клип и замирает в лежачей позе */
      if (u._deathT !== undefined && u._deathT > 0 && u._mixer) {
        u._deathT -= dt;
        u._mixer.update(dt);
        continue;
      }
      if (!u.alive) continue;
      if (u._gltfRig && u._mixer) {
        // v1.6: во время атак-клипа не переключаем анимацию
        if (u._attackT && u._attackT > 0) {
          u._attackT -= dt;
          u._mixer.update(dt);
          continue;
        }
        // v1.7: реакция на урон (короткий одноразовый клип)
        if (u._hitT && u._hitT > 0) {
          u._hitT -= dt;
          u._mixer.update(dt);
          continue;
        }
        // локомоция: бег/шаг при движении, в бою — боевая стойка
        this.setAnim(u, u.moving ? (u._actions?.run ? 'run' : 'walk') : (u.inCombat && u._actions?.idleCombat ? 'idleCombat' : 'idle'));
        u._mixer.update(dt);
        continue;
      }
      // капсульный фоллбек: «дыхание» + дрожь шага
      if (!u.rig) continue;
      const ph = u.phase ?? 0;
      const breathe = Math.sin(t * 2.1 + ph) * 0.032;
      const stepShiver = u.moving ? Math.abs(Math.sin(t * 14 + ph)) * 0.05 : 0;
      u.rig.position.y = breathe + stepShiver;
      u.rig.rotation.z = Math.sin(t * 1.7 + ph) * 0.02;
    }
  }
}

/* ---------- v1.7: одноразовые клипы-состояния ----------
   playAttack — атака (по классу: 1H/2H/каст/панч); без клипа — процедурный замах.
   playHit — реакция на урон (не перекрывает атаку).
   playDeath — клип смерти; true = die() пропускает процедурное падение. */
export function playAttack(unit: RigUnit): void {
  if (!unit.alive || !unit.rig) return;
  const atk = unit._actions?.attack;
  if (unit._gltfRig && unit._mixer && atk) {
    unit._attackT = Math.min(0.9, atk.getClip().duration);
    unit._hitT = 0;
    atk.reset().fadeIn(0.05).play();
    return;
  }
  /* процедурный fallback — очередь замахов, анимирует AnimRigs.update */
  rigInstance().queueSwing(unit);
}
export function playHit(unit: RigUnit): void {
  if (!unit.alive || !unit._gltfRig || !unit._mixer) return;
  if (unit._attackT && unit._attackT > 0) return;/* атака важнее реакции */
  const hit = unit._actions?.hit;
  if (!hit) return;
  unit._hitT = Math.min(0.45, hit.getClip().duration);
  hit.reset().fadeIn(0.05).play();
}
export function playDeath(unit: RigUnit): boolean {
  if (!unit._gltfRig || !unit._mixer) return false;
  const death = unit._actions?.death;
  if (!death) return false;
  unit._deathT = death.getClip().duration + 0.15;
  unit._attackT = 0; unit._hitT = 0;
  death.reset().fadeIn(0.08).play();
  return true;
}
/* доступ к единственному экземпляру AnimRigs (создаётся в renderer.ts) */
let _rigs: AnimRigs | null = null;
export function bindRigs(r: AnimRigs) { _rigs = r; }
function rigInstance(): AnimRigs {
  if (!_rigs) _rigs = new AnimRigs();
  return _rigs;
}
/** v1.7: сводка анимации для E2E-гейтов (__bg3.animStats). */
export function animStats() {
  return { motions: motionStats(), rigs: rigInstance().stats() };
}
