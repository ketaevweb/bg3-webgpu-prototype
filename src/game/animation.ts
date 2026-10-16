/* ============================================================
 * BG3 Web Prototype v0.7.x — анимационные риги (GLTF/Mixamo)
 * - Герои и босс получают скелетный риг Soldier.glb (Mixamo-стайл)
 *   с AnimationMixer: Idle/Walk/Run, кроссфейды, фоллбек на капсулы.
 * - Обычные гоблины остаются капсулами с процедурным «дыханием».
 * - mixer.update(dt) получает уже замедленный слоумо dt — криты
 *   замедляют и анимации.
 * ============================================================ */
import * as THREE from 'three/webgpu';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const ENABLE_GLTF = true;

/** Адрес скелетного рига (Mixamo-стайл: SkinnedMesh + Idle/Walk/Run). */
export const RIG_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r180/examples/models/gltf/Soldier.glb';
const RIG_FALLBACK = 'https://threejs.org/examples/models/gltf/Soldier.glb';

type RigUnit = {
  alive: boolean;
  rig?: THREE.Object3D;
  phase?: number;
  moving?: boolean;
  _mixer?: THREE.AnimationMixer | null;
  _actions?: Record<string, THREE.AnimationAction>;
  _currentAnim?: string;
  _gltfRig?: boolean;
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

/* ---------- публичный апгрейд юнита ---------- */

export type RigOpts = {
  tint?: number;        // цвет-подкраска текстуры (класс/фракция)
  tintStrength?: number;// 0..1
  scale?: number;       // рост модели
  yaw?: number;         // разворот модели внутрь рига
};

/**
 * Заменяет капсульную фигуру юнита скелетным ригом.
 * Визуал прячется (не удаляется — дешёвый откат), модель добавляется
 * во внутренний u.rig, создаётся AnimationMixer с Idle/Walk/Run.
 */
export async function upgradeUnitRig(unit: RigUnit, opts: RigOpts = {}): Promise<boolean> {
  if (!ENABLE_GLTF || !unit.rig) return false;
  try {
    const { scene: baseScene, animations } = await loadRigWithFallback();
    const model = SkeletonUtils.clone(baseScene) as THREE.Group;

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
    const idle = find(/idle/i), walk = find(/walk/i), run = find(/run/i);
    if (idle) actions.idle = mixer.clipAction(idle);
    if (walk) actions.walk = mixer.clipAction(walk);
    if (run) actions.run = mixer.clipAction(run);

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

  register(u: RigUnit) { this.units.add(u); }
  unregister(u: RigUnit) { this.units.delete(u); }

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
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u._gltfRig && u._mixer) {
        // GLTF-риг: Idle/Walk/Run с кроссфейдом
        this.setAnim(u, u.moving ? (u._actions?.run ? 'run' : 'walk') : 'idle');
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
