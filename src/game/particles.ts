/* ============================================================
 * BG3 Web Prototype v0.7 — партиклы (THREE.Points, единый пул)
 * Additive blending: цвет частицы гаснет к чёрному → плавное
 * исчезновение без per-point alpha. Пул фиксирован (1400),
 * эмиттеры (костёр/плиты огня) спавнят угли постоянно.
 * ============================================================ */
import * as THREE from 'three/webgpu';

export type BurstOpts = {
  count?: number;
  color?: number;
  speed?: number;
  size?: number;
  life?: number;
  gravity?: number;   // >0 — падают, <0 — всплывают
  up?: number;        // вертикальный бонус скорости
  spread?: number;    // разброс позиции (м)
};

type Emitter = {
  x: number; z: number; y: number;
  rate: number; color: number; up: number;
  spread: number; size: number; life: number;
  acc: number;
};

const MAX = 1400;

function roundTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export class ParticleFX {
  private scene: THREE.Scene;
  private points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private base: Float32Array;   // базовый цвет
  private life: Float32Array;
  private maxLife: Float32Array;
  private grav: Float32Array;
  private cursor = 0;
  private emitters = new Map<string, Emitter>();
  private geo: THREE.BufferGeometry;
  /** v1.1: множитель плотности частиц (настройки графики) 0..1+ */
  density = 1;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.base = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    // прячем «мёртвые» частицы под землю
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -100;

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.14,
      map: roundTexture(),
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  private spawn(x: number, y: number, z: number, o: { color: number; life: number; gravity: number; vx?: number; vy?: number; vz?: number }) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = o.vx ?? 0;
    this.vel[i * 3 + 1] = o.vy ?? 0;
    this.vel[i * 3 + 2] = o.vz ?? 0;
    const c = new THREE.Color(o.color);
    this.base[i * 3] = c.r; this.base[i * 3 + 1] = c.g; this.base[i * 3 + 2] = c.b;
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.life[i] = o.life; this.maxLife[i] = o.life;
    this.grav[i] = o.gravity;
  }

  /** Всплеск в точке. */
  burst(x: number, y: number, z: number, o: BurstOpts = {}) {
    const count = Math.max(1, Math.round((o.count ?? 12) * this.density));
    const speed = o.speed ?? 2.5;
    const size = o.size ?? 0.12;
    const life = o.life ?? 0.6;
    const color = o.color ?? 0xffffff;
    const gravity = o.gravity ?? 2.2;
    const up = o.up ?? 0;
    const spread = o.spread ?? 0.15;
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const el = Math.random() * Math.PI * 0.5;
      const s = speed * (0.45 + Math.random() * 0.75);
      this.spawn(
        x + (Math.random() - 0.5) * spread,
        y + Math.random() * spread * 0.5,
        z + (Math.random() - 0.5) * spread,
        {
          color, life: life * (0.7 + Math.random() * 0.6), gravity,
          vx: Math.cos(a) * Math.cos(el) * s,
          vy: Math.sin(el) * s + up,
          vz: Math.sin(a) * Math.cos(el) * s,
        },
      );
      void size; // размер задаётся материалом пула
    }
  }

  /** Всплеск над юнитом/бочкой (объект с .mesh.position). */
  burstAtMesh(target: { mesh: { position: THREE.Vector3 } }, o: BurstOpts = {}) {
    const p = target.mesh.position;
    this.burst(p.x, p.y + 1.0, p.z, o);
  }

  /** Большой взрыв: кольцо искр + всплеск вверх. */
  explosion(x: number, z: number, radius: number) {
    this.burst(x, 0.7, z, { count: 46, color: 0xffa040, speed: 5.2, life: 0.75, gravity: 3.2, spread: 0.6 });
    this.burst(x, 0.5, z, { count: 22, color: 0xffd54f, speed: 7.5, life: 0.5, gravity: 4.5, spread: 0.4 });
    this.burst(x, 0.9, z, { count: 16, color: 0x5a4030, speed: 2.2, life: 1.2, gravity: -0.6, spread: 0.8 });
    void radius;
  }

  /** Постоянный эмиттер углей (костёр, плиты огня). */
  addEmber(id: string, x: number, z: number, o: { rate?: number; color?: number; up?: number; spread?: number; size?: number; life?: number } = {}) {
    this.emitters.set(id, {
      x, z, y: 0.35,
      rate: o.rate ?? 4,
      color: o.color ?? 0xff9030,
      up: o.up ?? 1.3,
      spread: o.spread ?? 0.5,
      size: o.size ?? 0.1,
      life: o.life ?? 1.0,
      acc: 0,
    });
  }

  removeEmber(id: string) { this.emitters.delete(id); }
  clearEmbers() { this.emitters.clear(); }

  update(dt: number) {
    if (dt <= 0) return;
    // спавн из эмиттеров
    for (const e of this.emitters.values()) {
      e.acc += dt * e.rate * this.density;
      while (e.acc >= 1) {
        e.acc -= 1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * e.spread;
        this.spawn(e.x + Math.cos(a) * r, e.y, e.z + Math.sin(a) * r, {
          color: e.color,
          life: e.life * (0.7 + Math.random() * 0.6),
          gravity: -0.4,
          vx: (Math.random() - 0.5) * 0.3,
          vy: e.up * (0.7 + Math.random() * 0.6),
          vz: (Math.random() - 0.5) * 0.3,
        });
        void e.size;
      }
    }
    // интеграция
    let alive = false;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      alive = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -100; this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; continue; }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.35; }
      const k = this.life[i] / this.maxLife[i];
      this.col[i * 3] = this.base[i * 3] * k;
      this.col[i * 3 + 1] = this.base[i * 3 + 1] * k;
      this.col[i * 3 + 2] = this.base[i * 3 + 2] * k;
    }
    if (alive) {
      (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  dispose() {
    this.scene.remove(this.points);
    this.geo.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
