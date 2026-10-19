/* ============================================================
 * v2.9 «Лик Фаэруна» — ПЕРСОНАЖИ: визуальные ритуалы поверх ригов.
 * 1) Золотой ореол благословлений: герои с непустым u.blessed (мета-
 *    прогресс v2.8) носят пульсирующее кольцо у ног — «отмечены Глубинами».
 * 2) Пыль шагов: у ригов в движении из-под ног поднимаются пылинки
 *    (глубинная пыль — цвет по карте не нужен: нейтральный тёплый).
 * ЛИСТ-слой над renderer+state: engine зовёт charfx.update(dt,t) в цикле.
 * Циклы исключены: charfx→renderer/state, назад импортов нет.
 * ============================================================ */
import * as THREE from 'three/webgpu';
import { units } from '../state';
import { fx } from './renderer';

type Ringed = { mesh: THREE.Object3D; blessed?: string[]; alive: boolean; side?: string; moving?: boolean; _gltfRig?: boolean; _attackT?: number; _hitT?: number };

function makeBlessRing(): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.5, 0.62, 28);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xd8b45a, transparent: true, opacity: 0.4,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.045;
  m.renderOrder = 5;
  return m;
}

export function charfxUpdate(dt: number, t: number) {
  void dt;
  for (const u of units as unknown as Ringed[]) {
    if (u.side !== 'hero') continue;
    const holder = u.mesh;
    if (!holder) continue;
    const blessed = Array.isArray(u.blessed) && u.blessed.length > 0 && u.alive;
    let ring = holder.userData.blessRing as THREE.Mesh | undefined;
    if (blessed && !ring) {
      ring = makeBlessRing();
      holder.add(ring);
      holder.userData.blessRing = ring;
    } else if (!blessed && ring) {
      ring.removeFromParent();
      (ring.material as THREE.Material).dispose();
      ring.geometry.dispose();
      holder.userData.blessRing = undefined;
    }
    if (ring) {
      /* пульс ореола: тихое «дыхание» Глубин */
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.14 * Math.sin(t * 2.3);
      ring.rotation.z += 0.004;
    }
    /* пыль шагов — только у скелетных ригов в движении (капсульный фоллбек
       дрожит сам, ему пыль не нужна) */
    if (u._gltfRig && u.alive && u.moving && !(u._attackT && u._attackT > 0) && !(u._hitT && u._hitT > 0)) {
      const acc = ((holder.userData.stepAcc as number) ?? 0) + dt;
      if (acc > 0.26) {
        holder.userData.stepAcc = 0;
        const p = holder.position;
        fx.burst(p.x, 0.06, p.z, { count: 3, color: 0x9a8a6a, speed: 0.45, life: 0.5, gravity: -0.15, spread: 0.22 });
      } else holder.userData.stepAcc = acc;
    }
  }
}

/** сводка для E2E (__bg3.charStats): сколько ореолов и бегущих с пылью */
export function charfxStats() {
  let rings = 0, runners = 0;
  for (const u of units as unknown as Ringed[]) {
    if (u.side !== 'hero' || !u.alive) continue;
    if (u.mesh && u.mesh.userData.blessRing) rings++;
    if (u._gltfRig && u.moving) runners++;
  }
  return { rings, runners };
}
