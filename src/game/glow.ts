/* ============================================================
 * BG3 Web Prototype v0.7 — glow-хало (bloom-lite)
 * Полноценный bloom-постпроцессинг придёт в v0.7.x; сейчас —
 * аддитивные спрайты с радиальным градиентом: костёр, плиты
 * огня, вспышки взрывов/уровней. Дёшево и стабильно на WebGL2.
 * ============================================================ */
import * as THREE from 'three/webgpu';

type Attached = { sprite: THREE.Sprite; base: number; phase: number };
type Flash = { sprite: THREE.Sprite; life: number; maxLife: number; from: number; to: number };

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.16)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class GlowFX {
  private scene: THREE.Scene;
  private tex: THREE.Texture;
  private attached = new Map<string, Attached>();
  private flashes: Flash[] = [];
  private campfireGlow: Attached | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.tex = glowTexture();
  }

  private makeSprite(color: number, opacity: number): THREE.Sprite {
    const mat = new THREE.SpriteMaterial({
      map: this.tex, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    return s;
  }

  /** Постоянное хало костра (мерцает). */
  campfire(x: number, z: number) {
    const s = this.makeSprite(0xff9040, 0.55);
    s.position.set(x, 1.0, z);
    s.scale.setScalar(3.4);
    this.scene.add(s);
    this.campfireGlow = { sprite: s, base: 3.4, phase: Math.random() * 6.28 };
  }

  /** Постоянное хало плиты огня. */
  attach(id: string, x: number, z: number, scale: number, color: number) {
    if (this.attached.has(id)) return;
    const s = this.makeSprite(color, 0.4);
    s.position.set(x, 0.55, z);
    s.scale.setScalar(scale);
    this.scene.add(s);
    this.attached.set(id, { sprite: s, base: scale, phase: Math.random() * 6.28 });
  }

  detach(id: string) {
    const a = this.attached.get(id);
    if (!a) return;
    this.scene.remove(a.sprite);
    (a.sprite.material as THREE.Material).dispose();
    this.attached.delete(id);
  }

  /** Снять все постоянные хала (смена карты, v0.8). */
  clear() {
    for (const a of this.attached.values()) {
      this.scene.remove(a.sprite);
      (a.sprite.material as THREE.Material).dispose();
    }
    this.attached.clear();
    if (this.campfireGlow) {
      this.scene.remove(this.campfireGlow.sprite);
      (this.campfireGlow.sprite.material as THREE.Material).dispose();
      this.campfireGlow = null;
    }
  }

  /** Одноразовая вспышка в точке (взрыв). */
  flash(x: number, z: number, scale: number, color: number) {
    const s = this.makeSprite(color, 0.85);
    s.position.set(x, 1.1, z);
    s.scale.setScalar(scale * 0.4);
    this.scene.add(s);
    this.flashes.push({ sprite: s, life: 0.45, maxLife: 0.45, from: scale * 0.4, to: scale * 1.15 });
  }

  /** Одноразовая вспышка над юнитом (уровень/лечение/крит). */
  flashAtMesh(target: { mesh: { position: THREE.Vector3 } }, color: number, scale: number) {
    const p = target.mesh.position;
    const s = this.makeSprite(color, 0.8);
    s.position.set(p.x, p.y + 1.2, p.z);
    s.scale.setScalar(0.3);
    this.scene.add(s);
    this.flashes.push({ sprite: s, life: 0.5, maxLife: 0.5, from: 0.3, to: scale });
  }

  update(_dt: number, t: number) {
    if (this.campfireGlow) {
      const f = 1 + 0.09 * Math.sin(t * 11) + 0.05 * Math.sin(t * 23.7);
      this.campfireGlow.sprite.scale.setScalar(this.campfireGlow.base * f);
      (this.campfireGlow.sprite.material as THREE.SpriteMaterial).opacity = 0.5 + 0.08 * Math.sin(t * 13);
    }
    for (const a of this.attached.values()) {
      const f = 1 + 0.12 * Math.sin(t * 8 + a.phase);
      a.sprite.scale.setScalar(a.base * f);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= _dt;
      const k = 1 - f.life / f.maxLife;
      if (f.life <= 0) {
        this.scene.remove(f.sprite);
        (f.sprite.material as THREE.Material).dispose();
        this.flashes.splice(i, 1);
        continue;
      }
      f.sprite.scale.setScalar(f.from + (f.to - f.from) * Math.min(1, k * 2.2));
      (f.sprite.material as THREE.SpriteMaterial).opacity = 0.85 * (1 - k);
    }
  }

  dispose() {
    for (const a of this.attached.values()) this.scene.remove(a.sprite);
    for (const f of this.flashes) this.scene.remove(f.sprite);
    this.attached.clear(); this.flashes = [];
    if (this.campfireGlow) this.scene.remove(this.campfireGlow.sprite);
    this.tex.dispose();
  }
}
