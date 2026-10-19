/* ============================================================
 * v2.9 «Лик Фаэруна» — НЕБО: градиентный купол, светило, облака,
 * амбиент-частицы карты (светлячки/споры/снег/пепел/пыль).
 * ЛИСТ-модуль: только three + THREE-типы; сцена передаётся init-ом
 * из renderer.ts (renderer→sky — однонаправленно, циклов нет).
 * Купол — BackSide-сфера с canvas-градиентом (работает и на WebGL2),
 * облака — мягкие спрайты с дрейфом, амбиент — свой маленький пул
 * THREE.Points (не трогает игровой ParticleFX). Выключатель — gfx.sky
 * (панель G); E2E — skyState(). Купол не фогается (краск градиента
 * держится до горизонта), облака/светило — тоже.
 * ============================================================ */
import * as THREE from 'three/webgpu';

export type SkyMap = 'forest' | 'crypt' | 'swamp' | 'giants' | 'citadel';

/* палитры карт: верх/горизонт купола, цвет светила, его позиция и размер,
   тинт облаков (и их счёт), цвет/характер амбиент-частиц */
const PALETTE: Record<SkyMap, {
  top: number; horizon: number; sun: number; sunPos: [number, number, number];
  sunScale: number; cloudTint: number; clouds: number; cloudY: number;
  mote: number; moteRise: number; moteN: number;
}> = {
  forest: { top: 0x2e5c8f, horizon: 0xa8c8d8, sun: 0xffeecf, sunPos: [40, 46, -30], sunScale: 26,
    cloudTint: 0xf2f6f8, clouds: 9, cloudY: 34, mote: 0xd8f090, moteRise: 0.12, moteN: 26 },
  crypt: { top: 0x060810, horizon: 0x1c2233, sun: 0x9fb4d8, sunPos: [-34, 38, 22], sunScale: 17,
    cloudTint: 0x3a4256, clouds: 5, cloudY: 40, mote: 0x8fa8c8, moteRise: 0.05, moteN: 20 },
  swamp: { top: 0x1c2c26, horizon: 0x5a7a58, sun: 0xcfe0a8, sunPos: [34, 30, 18], sunScale: 21,
    cloudTint: 0x8aa088, clouds: 7, cloudY: 30, mote: 0x9fe8a0, moteRise: 0.22, moteN: 30 },
  giants: { top: 0x1c3050, horizon: 0x9ab4cc, sun: 0xd8e4f0, sunPos: [-42, 52, -18], sunScale: 24,
    cloudTint: 0xe8f0f6, clouds: 11, cloudY: 44, mote: 0xeef6ff, moteRise: -0.3, moteN: 34 },
  citadel: { top: 0x0a1a16, horizon: 0x2e5c4a, sun: 0xb4d8c8, sunPos: [30, 44, 26], sunScale: 19,
    cloudTint: 0x6a9a88, clouds: 6, cloudY: 38, mote: 0x9fe8c8, moteRise: 0.16, moteN: 24 },
};

const SKY_R = 150;/* купол внутри far=220 — камера всегда внутри */

function gradientTexture(top: number, horizon: number): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  const t = new THREE.Color(top), h = new THREE.Color(horizon);
  grad.addColorStop(0, '#' + t.getHexString());
  grad.addColorStop(0.55, '#' + t.clone().lerp(h, 0.55).getHexString());
  grad.addColorStop(0.8, '#' + h.clone().lerp(t, 0.18).getHexString());
  grad.addColorStop(1, '#' + h.getHexString());
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function cloudTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 7; i++) {/* кластер мягких радиальных пятен — «пух» */
    const x = 22 + Math.random() * 84, y = 20 + Math.random() * 24;
    const r = 12 + Math.random() * 18;
    const grad = g.createRadialGradient(x, y, 1, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SkyFX {
  private scene: THREE.Scene;
  private dome: THREE.Mesh | null = null;
  private sun: THREE.Sprite | null = null;
  private clouds: THREE.Sprite[] = [];
  private group = new THREE.Group();/* всё небо — в одной группе: вкл/выкл одним флагом */
  private map: SkyMap = 'forest';
  /** v2.9: общий рубильник (gfx.sky) */
  enabled = true;
  /* амбиент-частицы: маленький независимый пул */
  private N = 220;
  private pts: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private geo: THREE.BufferGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.pos = new Float32Array(this.N * 3);
    this.vel = new Float32Array(this.N * 3);
    this.col = new Float32Array(this.N * 3);
    for (let i = 0; i < this.N; i++) this.pos[i * 3 + 1] = -100;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.pts = new THREE.Points(this.geo, mat);
    this.pts.frustumCulled = false;
    this.group.add(this.pts);
    this.buildDome();
    this.buildSun();
    this.buildClouds();
    scene.add(this.group);
    this.applyPalette();/* стартовая палитра леса */
  }

  private buildDome() {
    const mat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 24, 14), mat);
    this.dome.renderOrder = -10;/* рисуется первым, глубину не пишет */
    this.group.add(this.dome);
  }

  private buildSun() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.38)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    this.sun.renderOrder = -9;
    this.group.add(this.sun);
  }

  private buildClouds() {
    const tex = cloudTexture();
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.5 + Math.random() * 0.3,
        depthWrite: false, fog: false,
      }));
      s.renderOrder = -8;
      s.userData.spd = 0.5 + Math.random() * 0.9;/* скорость дрейфа */
      s.userData.scl = 26 + Math.random() * 30;
      this.clouds.push(s);
      this.group.add(s);
    }
  }

  /* палитра текущей карты: купол/светило/облака/амбиент */
  private applyPalette() {
    const p = PALETTE[this.map];
    if (this.dome) {
      const old = (this.dome.material as THREE.MeshBasicMaterial).map;
      (this.dome.material as THREE.MeshBasicMaterial).map = gradientTexture(p.top, p.horizon);
      (this.dome.material as THREE.MeshBasicMaterial).needsUpdate = true;
      old?.dispose();
    }
    if (this.sun) {
      this.sun.position.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
      this.sun.scale.setScalar(p.sunScale);
      (this.sun.material as THREE.SpriteMaterial).color.setHex(p.sun);
    }
    this.clouds.forEach((s, i) => {
      const a = (i / this.clouds.length) * Math.PI * 2 + this.map.length;
      const r = 40 + (i % 4) * 22;
      s.position.set(Math.cos(a) * r, p.cloudY + (i % 3) * 6, Math.sin(a) * r - 20);
      s.scale.set(s.userData.scl, s.userData.scl * 0.42, 1);
      (s.material as THREE.SpriteMaterial).color.setHex(p.cloudTint);
      s.visible = i < p.clouds && this.enabled;
    });
    /* перекраска живых амбиент-частиц под новую карту */
    const col = new THREE.Color(p.mote);
    for (let i = 0; i < this.N; i++) {
      this.col[i * 3] = col.r; this.col[i * 3 + 1] = col.g; this.col[i * 3 + 2] = col.b;
      this.pos[i * 3 + 1] = -100;/* реснуть: спавн заново вокруг новой сцены */
    }
  }

  /** смена карты (applyAtmosphere → renderer): пересобрать палитру */
  setMap(m: SkyMap) {
    if (this.map === m) return;
    this.map = m;
    this.applyPalette();
  }

  /** gfx.sky — вкл/выкл неба целиком (купол/светило/облака; амбиент — тоже) */
  setEnabled(on: boolean) {
    this.enabled = on;
    this.group.visible = on;
  }

  /** плотность амбиента (gfx.particles: low 0.4 / mid 0.7 / high 1) */
  density = 1;

  update(dt: number, t: number) {
    if (!this.enabled || dt <= 0) return;
    /* дрейф облаков: по кругу вокруг центра, каждая со своей скоростью */
    for (const s of this.clouds) {
      if (!s.visible) continue;
      s.position.x += s.userData.spd * dt * 0.7;
      if (s.position.x > 110) s.position.x = -110;
    }
    /* амбиент: медленный спавн вокруг центра сцены, дрейф по ветру */
    const p = PALETTE[this.map];
    const want = Math.floor(p.moteN * this.density);
    let alive = 0;
    for (let i = 0; i < this.N; i++) if (this.pos[i * 3 + 1] > -50) alive++;
    /* подсаживаем недостающие частицы в кольцо вокруг центра сцены */
    let spawned = 0;
    for (let i = 0; i < this.N && alive + spawned < want; i++) {
      if (this.pos[i * 3 + 1] > -50) continue;
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 22;
      this.pos[i * 3] = Math.cos(a) * r;
      this.pos[i * 3 + 1] = p.moteRise < 0 ? 5 + Math.random() * 9 : 0.2 + Math.random() * 3;
      this.pos[i * 3 + 2] = Math.sin(a) * r;
      this.vel[i * 3] = (Math.random() - 0.5) * 0.25;
      this.vel[i * 3 + 1] = p.moteRise * (0.6 + Math.random() * 0.8);
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
      spawned++;
    }
    let dirty = false;
    for (let i = 0; i < this.N; i++) {
      if (this.pos[i * 3 + 1] <= -50) continue;
      dirty = true;
      this.pos[i * 3] += this.vel[i * 3] * dt + Math.sin(t * 1.3 + i) * 0.003;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      /* границы жизни: выше/ниже окна — переспавнить под землю */
      const hi = p.moteRise < 0 ? 0.1 : 6.5;
      if (p.moteRise < 0 ? this.pos[i * 3 + 1] < hi : this.pos[i * 3 + 1] > hi) this.pos[i * 3 + 1] = -100;
    }
    if (dirty) {
      (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
    /* светило чуть дышит */
    if (this.sun) {
      const k = 1 + Math.sin(t * 0.8) * 0.03;
      const base = PALETTE[this.map].sunScale;
      this.sun.scale.setScalar(base * k);
    }
  }

  /** статистика для E2E (skyState) */
  state() {
    return {
      dome: !!this.dome && this.group.visible,
      clouds: this.clouds.filter((s) => s.visible).length,
      sun: !!this.sun && this.group.visible,
      map: this.map,
      motes: this.pos ? this.pos.reduce((a, y, i) => (i % 3 === 1 && y > -50 ? a + 1 : a), 0) : 0,
    };
  }

  dispose() {
    this.scene.remove(this.group);
    this.geo.dispose();
  }
}
