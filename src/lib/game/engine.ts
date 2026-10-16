import * as THREE from 'three/webgpu';
import type { SpriteMaterial } from 'three/webgpu';
import { buildWorld, type World } from './world';
import { createActor, updateBar, makeTextSprite, type Actor } from './actors';
import type {
  ActionMode,
  ActorStats,
  BarrelInfo,
  HoverInfo,
  LogEntry,
  LogKind,
  Phase,
  Snapshot,
  DialogueView,
  PartyState,
  SaveData,
  StatusId,
  StatusView,
} from './types';
import { STATUS_DEFS } from './types';
import { d20, rollDice, sleep, roll, rollD20, hitChance, fmtDice } from './dice';
import { sfx } from './sfx';
import { idbGet, idbSet } from './save';
import {
  TILE,
  GRID_W,
  GRID_H,
  idx,
  tileOf,
  tileCenter,
  inGrid,
  findPath,
  findReachable,
  pathFromReach,
  hasLOS,
  buildStaticBlockers,
  STATIC_OBSTACLES,
  DIRS8,
  type PathTile,
} from './grid';

const EXPL_SPEED = 4.2;
const MELEE_RANGE = 2.3;

const RAW_STATS: ActorStats[] = [
  { id: 'cardan', name: 'Кардан', cls: 'Воин', hp: 30, maxHp: 30, ac: 16, speed: 9, atkBonus: 4, dmg: [1, 8, 3], range: MELEE_RANGE, potions: 1, initBonus: 0, saveBonus: 2, mode: 'ally', color: 0x8c4a2f },
  { id: 'liara', name: 'Лиара', cls: 'Волшебница', hp: 20, maxHp: 20, ac: 12, speed: 9, atkBonus: 1, dmg: [1, 4, 1], range: MELEE_RANGE, spell: { name: 'Огненный снаряд', bonus: 5, dmg: [1, 10, 0], range: 18 }, potions: 1, initBonus: 2, saveBonus: 2, mode: 'ally', color: 0x7a3fa0 },
  { id: 'wanderer', name: 'Странник Ворон', cls: 'Бродяга', hp: 99, maxHp: 99, ac: 10, speed: 0, atkBonus: 0, dmg: [1, 2, 0], range: 0, potions: 0, initBonus: 0, saveBonus: 0, mode: 'neutral', color: 0x4a4038 },
  { id: 'dros', name: 'Дрос, вожак', cls: 'Гоблин', hp: 21, maxHp: 21, ac: 15, speed: 9, atkBonus: 4, dmg: [1, 6, 2], range: MELEE_RANGE, potions: 0, initBonus: 2, saveBonus: 1, mode: 'foe', color: 0x55702a },
  { id: 'gob1', name: 'Гоблин А', cls: 'Гоблин', hp: 10, maxHp: 10, ac: 13, speed: 9, atkBonus: 3, dmg: [1, 6, 1], range: MELEE_RANGE, potions: 0, initBonus: 2, saveBonus: 0, mode: 'foe', color: 0x66803a },
  { id: 'gob2', name: 'Гоблин Б', cls: 'Гоблин', hp: 10, maxHp: 10, ac: 13, speed: 9, atkBonus: 3, dmg: [1, 6, 1], range: MELEE_RANGE, potions: 0, initBonus: 2, saveBonus: 0, mode: 'foe', color: 0x6b853e },
  { id: 'gob3', name: 'Гоблин-поджигатель', cls: 'Поджигатель', hp: 9, maxHp: 9, ac: 12, speed: 9, atkBonus: 4, dmg: [1, 6, 1], range: 14, potions: 0, initBonus: 3, saveBonus: 0, mode: 'foe', color: 0x9a5a2a },
];

const SPAWNS: Record<string, [number, number]> = {
  cardan: [-1.6, 2.4],
  liara: [1.4, 2.2],
  wanderer: [2.2, -0.8],
  dros: [0, -14],
  gob1: [-2.6, -15],
  gob2: [2.6, -15.5],
  gob3: [5.4, -16.4],
};

/** Бочка (v0.4): взрывная или с маслом. */
interface Barrel {
  id: number;
  x: number;
  z: number;
  type: 'explosive' | 'oil';
  alive: boolean;
  mesh: THREE.Group | null;
}

/** Горящая клетка (v0.4). */
interface FireTile {
  i: number;
  j: number;
  turns: number;
  fx: THREE.Group;
  seed: number;
}

/** Вариант действия Utility AI (v0.4). */
interface AIOption {
  score: number;
  desc: string;
  run: () => Promise<void>;
}

interface DOpt {
  text: string;
  kind?: 'next' | 'leave' | 'attack' | 'persuasion' | 'buy';
  next?: string;
}
interface DNode {
  speaker: string;
  text: string;
  opts: DOpt[];
}

interface Popup {
  spr: THREE.Sprite;
  life: number;
  vel: number;
}

/** Летящий снаряд (Огненный снаряд, огненная стрела) или вспышка. */
interface Proj {
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  burst: boolean;
  grow?: number;
  onHit?: () => void;
}

export class GameEngine {
  private container: HTMLElement;
  private cb: (s: Snapshot) => void;
  private disposed = false;

  private renderer!: THREE.WebGPURenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private world!: World;
  private ray = new THREE.Raycaster();
  private ptr = new THREE.Vector2();
  private clock = new THREE.Clock();

  private defs: ActorStats[] = RAW_STATS.map((d) => ({
    ...d,
    dmg: [...d.dmg] as [number, number, number],
    spell: d.spell ? { ...d.spell } : undefined,
  }));
  private actors: Actor[] = [];
  private byId = new Map<string, Actor>();
  private hitboxes: THREE.Mesh[] = [];

  private phase: Phase = 'intro';
  private backend = '…';
  private selectedId: string | null = 'cardan';
  private order: string[] = [];
  private activeIdx = 0;
  private round = 1;
  private actionMode: ActionMode = 'attack';
  private log: LogEntry[] = [];
  private logId = 0;
  private dialogue: DialogueView | null = null;
  private curTree: string | null = null;
  private curNode = 'root';
  private campArmed = true;
  private goblinsSpared = false;
  private turnMoveWarned = false;
  private combatToken = 0;
  private healSlots = 2;
  private blessSlots = 2;
  private windUsed = false;
  private party: PartyState = { potions: 2, gold: 0, xp: 0, level: 1 };
  private projs: Proj[] = [];

  // ===== v0.4: сетка, бочки, огонь =====
  private barrels: Barrel[] = [];
  private barrelMeshes: THREE.Mesh[] = [];
  private barrelSeq = 0;
  private gridBlockers = new Set<number>();
  private fireTiles = new Map<number, FireTile>();
  private fireFxList: Array<{ g: THREE.Group; seed: number }> = [];
  private oilTiles = new Set<number>();
  private dryTiles = new Set<number>();
  private scorchedTiles = new Set<number>();
  private pathDots: THREE.Mesh[] = [];
  private dotMatWhite!: THREE.MeshBasicMaterial;
  private dotMatRed!: THREE.MeshBasicMaterial;
  private flash!: THREE.PointLight;
  private shakeT = 0;

  private camYaw = 0;
  private camPitch = 0.6;
  private camDist = 13;
  private camFocus = new THREE.Vector3(0, 0, 0.6);
  private keys = new Set<string>();
  private dragBtn: number | null = null;
  private dragMoved = false;
  private lastPX = 0;
  private lastPY = 0;
  private emitTimer = 0;

  private selRing!: THREE.Mesh;
  private moveRing!: THREE.Mesh;
  private clickMarker!: THREE.Mesh;
  private markerT = 0;
  private popups: Popup[] = [];
  private camFocusTarget: THREE.Vector3 | null = null;

  constructor(container: HTMLElement, cb: (s: Snapshot) => void) {
    this.container = container;
    this.cb = cb;
  }

  static async create(container: HTMLElement, cb: (s: Snapshot) => void): Promise<GameEngine> {
    const e = new GameEngine(container, cb);
    await e.init();
    return e;
  }

  async init(): Promise<void> {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;

    this.renderer = new THREE.WebGPURenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';

    await this.renderer.init();
    if (this.disposed) return;
    const backendAny = (this.renderer as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend;
    this.backend = backendAny?.isWebGPUBackend ? 'WebGPU' : 'WebGL 2 (авто-фоллбек)';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x10160f);
    this.scene.fog = new THREE.Fog(0x10160f, 24, 58);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 220);
    this.world = buildWorld(this.scene);

    // Актёры
    for (const def of this.defs) {
      const [x, z] = SPAWNS[def.id];
      const a = createActor(def, new THREE.Vector3(x, 0, z));
      this.actors.push(a);
      this.byId.set(def.id, a);
      this.hitboxes.push(a.hitbox);
      this.scene.add(a.mesh);
      a.lastTileKey = this.tileKeyOf(x, z);
    }

    // Поле боя v0.4: валуны, бочки, сухая трава, блокировки сетки
    this.buildField();

    // Кольца и маркеры
    this.selRing = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.66, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe2b86b, transparent: true, opacity: 0.9, depthWrite: false })
    );
    this.selRing.position.y = 0.04;
    this.moveRing = new THREE.Mesh(
      new THREE.RingGeometry(0.965, 1.0, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x9fd8a0, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide })
    );
    this.moveRing.position.y = 0.05;
    this.clickMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.4, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xe2b86b, transparent: true, opacity: 0.7, depthWrite: false })
    );
    this.clickMarker.position.y = 0.05;
    this.clickMarker.visible = false;
    this.scene.add(this.selRing, this.moveRing, this.clickMarker);

    // v0.4: вспышка взрывов, точки превью пути
    this.flash = new THREE.PointLight(0xffa040, 0, 26, 1.6);
    this.scene.add(this.flash);
    this.dotMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
    this.dotMatRed = new THREE.MeshBasicMaterial({ color: 0xff4433, transparent: true, opacity: 0.9, depthWrite: false });
    const dotGeo = new THREE.CircleGeometry(0.13, 12).rotateX(-Math.PI / 2);
    for (let i = 0; i < 44; i++) {
      const d = new THREE.Mesh(dotGeo, this.dotMatWhite);
      d.visible = false;
      d.position.y = 0.06;
      this.scene.add(d);
      this.pathDots.push(d);
    }

    this.addLog('story', 'Прототип готов. Нажмите «Начать приключение».');
    this.bindInput();
    this.renderer.setAnimationLoop(this.tick);
    (window as unknown as { __bg3?: GameEngine }).__bg3 = this;
    this.emit();
  }

  dispose(): void {
    this.disposed = true;
    this.combatToken++;
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
      this.unbindInput();
      this.renderer.dispose();
      this.renderer.domElement?.remove();
    }
  }

  // ==================== ВВОД ====================

  private onResize = () => {
    if (!this.renderer) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    // Esc — отмена режима прицеливания (исцеление/благословение/заклинание)
    if (e.code === 'Escape' && this.phase === 'combat' && this.actionMode !== 'attack') {
      this.actionMode = 'attack';
      this.emit();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.dragBtn !== null) return;
    this.dragBtn = e.button;
    this.dragMoved = false;
    this.lastPX = e.clientX;
    this.lastPY = e.clientY;
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* синтетические события могут не иметь активного pointerId */
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    // v0.4: превью пути А* при наведении (когда не тянем камеру)
    if (this.dragBtn === null) this.updateHover(e.clientX, e.clientY);
    if (this.dragBtn === null) return;
    const dx = e.clientX - this.lastPX;
    const dy = e.clientY - this.lastPY;
    this.lastPX = e.clientX;
    this.lastPY = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 2) this.dragMoved = true;
    if (this.dragMoved) {
      this.camYaw -= dx * 0.0052;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.004, 0.26, 1.22);
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.dragBtn === 0 && !this.dragMoved) this.onClick(e.clientX, e.clientY);
    this.dragBtn = null;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.camDist = THREE.MathUtils.clamp(this.camDist * (1 + e.deltaY * 0.0011), 6, 26);
  };

  private onCtx = (e: Event) => e.preventDefault();

  private inputBound = false;
  private bindInput(): void {
    if (this.inputBound) return;
    this.inputBound = true;
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', this.onCtx);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
  }

  private unbindInput(): void {
    if (!this.inputBound || !this.renderer) return;
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('wheel', this.onWheel);
    el.removeEventListener('contextmenu', this.onCtx);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    this.inputBound = false;
  }

  // ==================== КАМЕРА ====================

  private applyCamera(): void {
    const cp = Math.cos(this.camPitch);
    this.camera.position.set(
      this.camFocus.x + Math.sin(this.camYaw) * cp * this.camDist,
      this.camFocus.y + Math.sin(this.camPitch) * this.camDist,
      this.camFocus.z + Math.cos(this.camYaw) * cp * this.camDist
    );
    this.camera.lookAt(this.camFocus);
    // v0.4: тряска камеры при взрывах
    if (this.shakeT > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeT * 0.55;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeT * 0.3;
      this.camera.position.z += (Math.random() - 0.5) * this.shakeT * 0.55;
    }
  }

  private updateCameraFollow(dt: number): void {
    if (this.phase === 'explore') {
      const hero = this.byId.get(this.selectedId ?? '');
      if (hero && hero.alive && hero.moveTarget) {
        this.camFocus.lerp(new THREE.Vector3(hero.mesh.position.x, 0, hero.mesh.position.z), Math.min(1, dt * 3));
      }
    } else if (this.phase === 'combat' && this.camFocusTarget) {
      this.camFocus.lerp(
        new THREE.Vector3(this.camFocusTarget.x, 0, this.camFocusTarget.z),
        Math.min(1, dt * 3.5)
      );
      if (this.camFocus.distanceTo(this.camFocusTarget) < 0.15) this.camFocusTarget = null;
    }
  }

  private updateKeyboard(dt: number): void {
    if (this.keys.size === 0) return;
    const f = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const r = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    const sp = this.camDist * 0.85 * dt;
    if (this.keys.has('KeyW')) this.camFocus.addScaledVector(f, sp);
    if (this.keys.has('KeyS')) this.camFocus.addScaledVector(f, -sp);
    if (this.keys.has('KeyA')) this.camFocus.addScaledVector(r, -sp);
    if (this.keys.has('KeyD')) this.camFocus.addScaledVector(r, sp);
    this.camFocus.y = 0;
    if (this.camFocus.length() > 24) this.camFocus.setLength(24);
  }

  // ==================== КЛИКИ ====================

  private setPointerRay(x: number, y: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
  }

  private onClick(cx: number, cy: number): void {
    if (this.phase !== 'explore' && this.phase !== 'combat') return;
    this.setPointerRay(cx, cy);
    const hits = this.ray.intersectObjects(this.hitboxes, false);
    const aliveHits = hits
      .map((h) => ({ a: this.byId.get(h.object.userData.actorId as string), d: h.distance }))
      .filter((h): h is { a: Actor; d: number } => !!h.a && h.a.alive);
    if (aliveHits.length) {
      const first = aliveHits[0].a;
      // В бою ход союзника: если первым на луче стоит свой/нейтрал, а за ним враг — бьём врага
      if (
        this.phase === 'combat' &&
        first.def.mode !== 'foe' &&
        this.activeActor()?.def.mode === 'ally'
      ) {
        const foeHit = aliveHits.find((h) => h.a.def.mode === 'foe');
        if (foeHit) {
          this.clickActor(foeHit.a);
          return;
        }
      }
      this.clickActor(first);
      return;
    }
    // v0.4: бочки — интерактивная цель в бою
    if (this.phase === 'combat') {
      const bh = this.ray.intersectObjects(this.barrelMeshes, false)[0];
      if (bh) {
        const b = this.barrelById(bh.object.userData.barrelId as number);
        if (b && b.alive) {
          this.clickBarrel(b);
          return;
        }
      }
    }
    const g = this.ray.intersectObject(this.world.ground, false)[0];
    if (g) this.clickGround(g.point);
  }

  private clickActor(a: Actor): void {
    if (this.phase === 'explore') {
      if (a.def.mode === 'ally') {
        this.selectedId = a.id;
        this.emit();
      } else if (a.def.mode === 'neutral') {
        this.openDialogue('wanderer');
      } else {
        // Идти в сторону гоблина — триггер диалога сработает по близости
        const hero = this.byId.get(this.selectedId ?? '');
        if (hero && hero.alive) {
          const dir = new THREE.Vector3().subVectors(a.mesh.position, hero.mesh.position);
          dir.y = 0;
          const L = dir.length();
          if (L > 5.4) {
            dir.normalize();
            hero.moveTarget = hero.mesh.position.clone().add(dir.multiplyScalar(L - 5.4));
            this.markerAt(hero.moveTarget);
            this.emit();
          }
        }
      }
      return;
    }
    if (this.phase === 'combat') {
      const me = this.activeActor();
      if (me && me.def.mode === 'ally') {
        if (this.actionMode === 'heal') {
          if (a.def.mode === 'ally' && me.id !== a.id) this.useHeal(a.id);
          return;
        }
        if (this.actionMode === 'bless') {
          if (a.def.mode === 'ally') this.useBless(a.id);
          return;
        }
        if (this.actionMode === 'bash') {
          if (a.def.mode === 'foe') this.useBash(a.id);
          return;
        }
        if (a.def.mode === 'foe') this.tryAttackOnFoe(a);
      }
    }
  }

  private clickGround(p: THREE.Vector3): void {
    if (this.phase === 'explore') {
      const hero = this.byId.get(this.selectedId ?? '');
      if (hero && hero.alive) {
        hero.moveTarget = p.clone().setY(0);
        this.markerAt(p);
        this.emit();
      }
      return;
    }
    if (this.phase === 'combat') {
      const me = this.activeActor();
      if (!me || me.def.mode !== 'ally' || !me.alive) return;
      // v0.4: Огненный снаряд по земле — поджог травы/масла
      if (this.actionMode === 'spell' && me.def.spell) {
        this.castFireboltAtPoint(me, p.x, p.z);
        return;
      }
      if (this.actionMode !== 'attack') return;
      if (me.movementLeft < 0.15) {
        if (!this.turnMoveWarned) {
          this.addLog('info', 'Перемещение на этот ход израсходовано.');
          this.turnMoveWarned = true;
        }
        return;
      }
      this.commandMove(me, p.x, p.z);
    }
  }

  /** Ключ клетки по мировым координатам. */
  private tileKeyOf(x: number, z: number): number {
    const t = tileOf(x, z);
    return inGrid(t.i, t.j) ? idx(t.i, t.j) : -1;
  }

  private markerAt(v: THREE.Vector3): void {
    this.clickMarker.position.set(v.x, 0.05, v.z);
    this.markerT = 0.45;
    this.clickMarker.visible = true;
  }

  // ==================== ЦИКЛ ====================

  private tick = (): void => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    if (this.phase === 'intro') this.camYaw += dt * 0.05;
    this.updateKeyboard(dt);
    this.updateCameraFollow(dt);
    this.applyCamera();
    this.moveActors(dt);
    this.updateAnims(dt, t);
    this.updateProjs(dt);
    this.updateTriggers();
    this.world.update(t);
    this.updatePopups(dt);
    this.updateRings(dt);
    this.updateFireFx(t);
    if (this.flash.intensity > 0) this.flash.intensity = Math.max(0, this.flash.intensity - dt * 700);
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt * 1.7);
    for (const a of this.actors) {
      if (a.barGroup && a.barGroup.visible) a.barGroup.quaternion.copy(this.camera.quaternion);
    }

    this.emitTimer += dt;
    if (this.emitTimer > 0.18) this.emit();
    this.renderer.render(this.scene, this.camera);
  };

  private moveActors(dt: number): void {
    for (const a of this.actors) {
      if (!a.alive) continue;
      // v0.4: движение по маршруту A* — сначала промежуточные точки, потом финал
      const wp = a.path && a.path.length ? a.path[0] : a.moveTarget;
      if (!wp) continue;
      const pos = a.mesh.position;
      const dx = wp.x - pos.x;
      const dz = wp.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.08) {
        if (a.path && a.path.length) {
          a.path.shift();
          if (!a.path.length) a.path = null;
          const tk = this.tileKeyOf(pos.x, pos.z);
          if (tk !== a.lastTileKey) {
            a.lastTileKey = tk;
            this.onEnterTile(a);
          }
          continue;
        }
        pos.x = a.moveTarget!.x;
        pos.z = a.moveTarget!.z;
        pos.y = 0;
        a.moveTarget = null;
        if (this.phase === 'combat') this.checkProvoke(a);
        this.onArrive(a);
        continue;
      }
      const speed = this.phase === 'combat' ? 3.6 : EXPL_SPEED;
      let step = speed * dt;
      if (this.phase === 'combat') {
        if (a.movementLeft <= 0.02) {
          // Бюджет исчерпан — останавливаемся и сбрасываем маршрут
          a.path = null;
          a.moveTarget = null;
          if (a.pendingAttackId) {
            a.pendingAttackId = null;
            this.addLog('info', `${a.def.name}: не хватило перемещения для атаки.`);
            this.emit();
          }
          continue;
        }
        step = Math.min(step, a.movementLeft);
      }
      const k = Math.min(1, step / dist);
      pos.x += dx * k;
      pos.z += dz * k;
      if (this.phase === 'combat') a.movementLeft = Math.max(0, a.movementLeft - step);
      if (this.phase === 'combat') this.checkProvoke(a);
      a.mesh.rotation.y = Math.atan2(dx, dz);
      a.walk += dt * 9;
      pos.y = Math.abs(Math.sin(a.walk)) * 0.06;
    }
  }

  private onArrive(a: Actor): void {
    if (this.phase === 'combat' && a.pendingAttackId) {
      const foe = this.byId.get(a.pendingAttackId);
      a.pendingAttackId = null;
      if (foe && foe.alive && a.actionAvailable && this.dist(a, foe) <= a.def.range + 0.3) {
        this.performAttack(a, foe, false);
      } else if (foe && foe.alive) {
        this.addLog('info', `${a.def.name}: не хватило перемещения для атаки.`);
        this.emit();
      }
    }
  }

  private updateAnims(dt: number, t: number): void {
    for (const a of this.actors) {
      if (!a.alive) {
        // Падение поверженного
        if (a.fall < 1) {
          a.fall = Math.min(1, a.fall + dt * 2.4);
          const k = 1 - Math.pow(1 - a.fall, 2);
          a.mesh.rotation.z = a.fallDir * 1.42 * k;
          a.mesh.position.y = 0.3 * k;
        }
        continue;
      }
      // Страховка: живые актёры не должны иметь крена — иначе хитбокс уходит под землю
      if (Math.abs(a.mesh.rotation.z) > 0.01 || Math.abs(a.mesh.rotation.x) > 0.35) {
        a.mesh.rotation.z = 0;
        a.mesh.rotation.x = 0;
      }
      if (a.attackT > 0) {
        a.attackT = Math.max(0, a.attackT - dt);
        const k = 1 - a.attackT / 0.45;
        a.mesh.rotation.x = Math.sin(k * Math.PI) * 0.32;
        if (a.attackT === 0) a.mesh.rotation.x = 0;
      }
      if (a.id === 'wanderer') {
        a.mesh.rotation.y = 2.5 + Math.sin(t * 0.4) * 0.22;
        a.mesh.position.y = 0;
      }
      if (!a.moveTarget && a.mesh.position.y > 0) a.mesh.position.y = Math.max(0, a.mesh.position.y - dt * 0.3);
    }
  }

  private updateTriggers(): void {
    if (this.phase !== 'explore' || this.dialogue) return;
    const dros = this.byId.get('dros');
    if (!dros || !dros.alive || this.goblinsSpared) return;
    const near = this.actors.some(
      (a) => a.def.mode === 'ally' && a.alive && a.mesh.position.distanceTo(dros.mesh.position) < 6.8
    );
    if (near && this.campArmed) {
      this.campArmed = false;
      this.openDialogue('goblin');
    } else if (!near && !this.campArmed) {
      const far = this.actors.every(
        (a) => a.def.mode !== 'ally' || !a.alive || a.mesh.position.distanceTo(dros.mesh.position) > 11
      );
      if (far) this.campArmed = true;
    }
  }

  private updateRings(dt: number): void {
    const sel = this.phase === 'combat' ? this.activeActor() : this.byId.get(this.selectedId ?? '');
    const showSel = sel && sel.alive && sel.def.mode === 'ally' && this.phase !== 'intro';
    this.selRing.visible = !!showSel;
    if (showSel) {
      this.selRing.position.set(sel!.mesh.position.x, 0.04, sel!.mesh.position.z);
      this.selRing.rotation.y += dt * 0.8;
    }
    const me = this.phase === 'combat' ? this.activeActor() : null;
    const showMove = me && me.def.mode === 'ally' && me.alive && me.movementLeft > 0.3;
    this.moveRing.visible = !!showMove;
    if (showMove) {
      const r = Math.max(0.35, me!.movementLeft);
      this.moveRing.scale.set(r, 1, r);
      this.moveRing.position.set(me!.mesh.position.x, 0.05, me!.mesh.position.z);
    }
    if (this.markerT > 0) {
      this.markerT -= dt;
      const k = Math.max(0, this.markerT / 0.45);
      (this.clickMarker.material as THREE.MeshBasicMaterial).opacity = k * 0.7;
      this.clickMarker.scale.setScalar(1 + (1 - k) * 1.3);
      if (this.markerT <= 0) this.clickMarker.visible = false;
    }
  }

  // ==================== ЭФФЕКТЫ ====================

  private popup(a: Actor, text: string, color: string): void {
    const spr = makeTextSprite(text, color, 1.35);
    spr.position.copy(a.mesh.position).add(new THREE.Vector3(0, 2.3, 0));
    this.scene.add(spr);
    this.popups.push({ spr, life: 1.15, vel: 1.5 });
  }

  private updatePopups(dt: number): void {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.spr.position.y += p.vel * dt;
      p.vel *= 0.94;
      (p.spr.material as SpriteMaterial).opacity = Math.min(1, p.life * 1.5);
      if (p.life <= 0) {
        this.scene.remove(p.spr);
        const m = p.spr.material as SpriteMaterial;
        m.map?.dispose();
        m.dispose();
        this.popups.splice(i, 1);
      }
    }
  }

  // ==================== СОСТОЯНИЕ ====================

  private dist(a: Actor, b: Actor): number {
    return a.mesh.position.distanceTo(b.mesh.position);
  }

  private activeActor(): Actor | null {
    if (this.phase !== 'combat' || !this.order.length) return null;
    return this.byId.get(this.order[this.activeIdx]) ?? null;
  }

  private addLog(kind: LogKind, text: string): void {
    this.log.push({ id: ++this.logId, kind, text });
    if (this.log.length > 60) this.log.splice(0, this.log.length - 60);
    this.emit();
  }

  private buildSnapshot(): Snapshot {
    const act = this.activeActor();
    return {
      phase: this.phase,
      backend: this.backend,
      selectedId: this.selectedId,
      activeId: act ? act.id : null,
      order: this.phase === 'combat' ? [...this.order] : [],
      round: this.round,
      movementLeft: act ? act.movementLeft : 0,
      actionAvailable: act ? act.actionAvailable : false,
      bonusAvailable: act ? act.bonusAvailable : false,
      reactionAvailable: act ? act.reactionAvailable : false,
      actionMode: this.actionMode,
      healSlots: this.healSlots,
      blessSlots: this.blessSlots,
      windReady: !this.windUsed,
      bashReady: act ? act.id === 'cardan' && act.bonusAvailable && act.bashCd === 0 : false,
      bashCd: act ? act.bashCd : 0,
      party: { ...this.party, xpNext: this.party.level * 100 },
      actors: this.actors.map((a) => ({
        id: a.id,
        name: a.def.name,
        cls: a.def.cls,
        hp: a.hp,
        maxHp: a.def.maxHp,
        ac: a.def.ac,
        mode: a.def.mode,
        alive: a.alive,
        hasSpell: !!a.def.spell,
        statuses: a.statuses.map((s): StatusView => ({ id: s.id, turns: s.turns, ...STATUS_DEFS[s.id] })),
        reactionAvailable: a.reactionAvailable,
      })),
      log: this.log.slice(-40),
      dialogue: this.dialogue,
    };
  }

  private emit(): void {
    if (this.disposed) return;
    this.emitTimer = 0;
    this.cb(this.buildSnapshot());
  }

  // ==================== ПУБЛИЧНЫЙ API ====================

  begin(): void {
    if (this.phase !== 'intro') return;
    this.phase = 'explore';
    this.camDist = 12;
    sfx('click');
    this.addLog('story', 'Партия: Кардан и Лиара. Чионтарский лес дышит туманом, а тадпол за глазом пульсирует в такт чужой воле.');
    this.addLog('info', 'ЛКМ — идти и говорить, ЛКМ-тянуть — камера, колесо — зум, WASD — панорама.');
    this.addLog('info', '🧪 Зелья и золото теперь общие. 💾 — сохранить, 📂 — загрузить, 🛌 — отдых вне боя.');
    this.addLog('info', 'Новое в v0.4: путь по A* с метками провокаций, взрывные бочки и поджоги, гоблин-поджигатель, Оглушающий удар.');
    this.addLog('story', 'На севере, у старых руин, горят чужие костры...');
  }

  select(id: string): void {
    const a = this.byId.get(id);
    if (!a || a.def.mode !== 'ally' || !a.alive) return;
    if (this.phase === 'combat' && this.activeActor()?.id !== id) return;
    this.selectedId = id;
    this.emit();
  }

  setActionMode(m: ActionMode): void {
    if (this.phase !== 'combat') return;
    this.actionMode = m;
    this.emit();
  }

  usePotion(): void {
    const a = this.activeActor();
    if (!a || this.phase !== 'combat' || !a.alive) return;
    if (!a.actionAvailable) return this.addLog('info', 'Действие в этом ходу уже использовано.');
    if (this.party.potions < 1)
      return this.addLog('info', 'Зелий не осталось — обыщите гоблинов или купите у Ворона (10 золота).');
    this.party.potions--;
    const healed = Math.min(rollDice(2, 4, 2).total, a.def.maxHp - a.hp);
    a.hp += healed;
    a.actionAvailable = false;
    sfx('heal');
    this.burst(a.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x46e070);
    this.addLog('heal', `${a.def.name} пьёт зелье лечения: 2d4+2 → +${healed} HP (в сумке: ${this.party.potions}).`);
    this.popup(a, `+${healed}`, '#7ed88a');
    updateBar(a);
    this.emit();
    this.scheduleAutoEnd();
  }

  /** Лиара: «Лёгкое исцеление» — бонусное действие, 1d4+2, 2 слота на бой. */
  useHeal(targetId?: string): void {
    if (this.phase !== 'combat') return;
    const a = this.activeActor();
    if (!a || !a.alive || !a.def.spell) return;
    if (!a.bonusAvailable) return this.addLog('info', 'Бонусное действие в этом ходу уже использовано.');
    if (this.healSlots < 1) return this.addLog('info', 'Слоты исцеления на этот бой исчерпаны.');
    const t = targetId ? this.byId.get(targetId) : undefined;
    if (!t || !t.alive || t.def.mode !== 'ally') return this.addLog('info', 'Лечить можно только союзника.');
    if (t.hp >= t.def.maxHp) return this.addLog('info', `${t.def.name} и так здоров — берегите слоты.`);
    if (this.dist(a, t) > 9)
      return this.addLog('info', `Слишком далеко для исцеления: ${this.dist(a, t).toFixed(0)} м (до 9).`);
    this.healSlots--;
    a.bonusAvailable = false;
    this.actionMode = 'attack';
    const healed = Math.min(rollDice(1, 4, 2).total, t.def.maxHp - t.hp);
    t.hp += healed;
    sfx('heal');
    this.burst(t.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x46e070);
    this.addLog('heal', `🌿 Лиара исцеляет ${t.def.name}: 1d4+2 → +${healed} HP (слотов осталось: ${this.healSlots}).`);
    this.popup(t, `+${healed}`, '#7ed88a');
    updateBar(t);
    this.emit();
    this.scheduleAutoEnd();
  }

  /** Кардан: «Второе дыхание» — бонусное действие, 1d10+2, раз в бой. */
  useSecondWind(): void {
    if (this.phase !== 'combat') return;
    const a = this.activeActor();
    if (!a || !a.alive || a.id !== 'cardan') return;
    if (!a.bonusAvailable) return this.addLog('info', 'Бонусное действие в этом ходу уже использовано.');
    if (this.windUsed) return this.addLog('info', 'Второе дыхание уже потрачено в этом бою.');
    if (a.hp >= a.def.maxHp) return this.addLog('info', 'Кардан и так здоров.');
    this.windUsed = true;
    a.bonusAvailable = false;
    const healed = Math.min(rollDice(1, 10, 2).total, a.def.maxHp - a.hp);
    a.hp += healed;
    sfx('heal');
    this.burst(a.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0x46e070);
    this.addLog('heal', `💨 Кардан переводит дух: 1d10+2 → +${healed} HP.`);
    this.popup(a, `+${healed}`, '#7ed88a');
    updateBar(a);
    this.emit();
    this.scheduleAutoEnd();
  }

  /** Лиара: «Благословение» — действие, союзник получает +1d4 к атакам (3 хода), 2 слота на бой. */
  useBless(targetId?: string): void {
    if (this.phase !== 'combat') return;
    const a = this.activeActor();
    if (!a || !a.alive || !a.def.spell) return;
    if (!a.actionAvailable) return this.addLog('info', 'Действие в этом ходу уже использовано.');
    if (this.blessSlots < 1) return this.addLog('info', 'Слоты благословения на этот бой исчерпаны.');
    const t = targetId ? this.byId.get(targetId) : undefined;
    if (!t || !t.alive || t.def.mode !== 'ally') return this.addLog('info', 'Благословение действует только на союзников.');
    if (this.dist(a, t) > 9)
      return this.addLog('info', `Слишком далеко для благословения: ${this.dist(a, t).toFixed(0)} м (до 9).`);
    this.blessSlots--;
    a.actionAvailable = false;
    this.actionMode = 'attack';
    this.applyStatus(t, 'bless', 3, true);
    sfx('good');
    this.burst(t.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xffe066);
    this.addLog('status', `✨ Лиара благословляет ${t.def.name}: +1d4 к атакам на 3 хода (слотов осталось: ${this.blessSlots}).`);
    this.emit();
    this.scheduleAutoEnd();
  }

  /** Кардан: «Оглушающий удар» — бонусное действие, 1d4+3 + спасбросок против оглушения (КД 2 хода). */
  useBash(targetId?: string): void {
    if (this.phase !== 'combat') return;
    const a = this.activeActor();
    if (!a || !a.alive || a.id !== 'cardan') return;
    if (!a.bonusAvailable) return this.addLog('info', 'Бонусное действие в этом ходу уже использовано.');
    if (a.bashCd > 0) return this.addLog('info', `Оглушающий удар будет готов через ${a.bashCd} ход(а).`);
    const t = targetId ? this.byId.get(targetId) : undefined;
    if (!t || !t.alive || t.def.mode !== 'foe') return this.addLog('info', 'Оглушающий удар наносится по врагу.');
    if (this.dist(a, t) > 2.6)
      return this.addLog('info', `Слишком далеко для удара щитом: ${this.dist(a, t).toFixed(1)} м (нужно рядом).`);
    a.bonusAvailable = false;
    a.bashCd = 2;
    this.actionMode = 'attack';
    this.faceTowards(a, t.mesh.position);
    a.attackT = 0.45;
    const dis = this.hasStatus(a, 'poison') || this.hasStatus(a, 'fear');
    const r = rollD20(false, dis);
    const total = r + a.def.atkBonus;
    const hit = r === 20 || (r !== 1 && total >= t.def.ac);
    const pct = Math.round(hitChance(a.def.atkBonus, t.def.ac, false, dis) * 100);
    this.addLog('roll', `${a.def.name} — оглушающий удар щитом: d20 ${r} + ${a.def.atkBonus} = ${total} против КД ${t.def.ac} · шанс ${pct}%`);
    if (!hit) {
      this.addLog('miss', r === 1 ? 'Критический промах — щит со свистом рассекает воздух.' : `${a.def.name} промахивается щитом.`);
      this.popup(t, 'мимо', '#9a958a');
      sfx('miss');
    } else {
      let dmg = rollDice(1, 4, 3).total;
      if (r === 20) {
        dmg += rollDice(1, 4, 3).total;
        this.addLog('crit', `КРИТ! Щит Кардана впечатывает ${t.def.name}: ${dmg} урона!`);
        sfx('crit');
      } else {
        this.addLog('hit', `Удар щитом достигает ${t.def.name}: ${dmg} урона.`);
        sfx('hit');
      }
      t.hp = Math.max(0, t.hp - dmg);
      this.popup(t, `−${dmg}`, '#d8cfa8');
      updateBar(t);
      if (t.hp <= 0) {
        this.kill(t);
      } else {
        const sv = d20() + t.def.saveBonus;
        this.addLog('roll', `Спасбросок Телосложения (${t.def.name}): d20 ${sv - t.def.saveBonus} + ${t.def.saveBonus} = ${sv} против СЛ 12`);
        if (sv < 12) this.applyStatus(t, 'stun', 1);
        else this.addLog('info', `${t.def.name} устоял на ногах.`);
      }
    }
    this.emit();
    this.scheduleAutoEnd();
  }

  /** Короткий отдых вне боя: полное восстановление партии и ресурсов. */
  shortRest(): void {
    if (this.phase !== 'explore') {
      this.addLog('info', 'Отдохнуть можно только вне боя.');
      return;
    }
    let healed = false;
    for (const a of this.actors.filter((x) => x.def.mode === 'ally' && x.alive)) {
      if (a.hp < a.def.maxHp) healed = true;
      a.hp = a.def.maxHp;
      updateBar(a);
      this.popup(a, 'полностью', '#7ed88a');
    }
    this.healSlots = 2;
    this.blessSlots = 2;
    this.windUsed = false;
    for (const a of this.actors) {
      a.statuses = [];
      this.updateStatusIcon(a);
    }
    sfx('heal');
    this.addLog(
      'heal',
      healed
        ? '🛌 Короткий отдых: партия восстановила силы, слоты исцеления обновлены.'
        : '🛌 Партия отдохнула — силы и без того на высоте.'
    );
    this.emit();
  }

  endTurn(): void {
    if (this.phase !== 'combat') return;
    this.actionMode = 'attack';
    const foes = this.actors.filter((a) => a.def.mode === 'foe');
    const allies = this.actors.filter((a) => a.def.mode === 'ally');
    if (!foes.some((f) => f.alive)) return this.victory();
    if (!allies.some((h) => h.alive)) return this.defeat();

    let nextIdx = this.activeIdx;
    let wrapped = false;
    for (let i = 1; i <= this.order.length; i++) {
      const cand = (this.activeIdx + i) % this.order.length;
      const a = this.byId.get(this.order[cand]);
      if (a && a.alive) {
        if (this.activeIdx + i >= this.order.length && !wrapped) {
          wrapped = true;
          this.round++;
          // v0.4: конец раунда — огонь перекидывается на соседние клетки
          this.spreadFire();
          if (!a.alive) continue; // пожар убил следующего — ищем дальше
        }
        nextIdx = cand;
        break;
      }
    }
    this.activeIdx = nextIdx;
    this.beginTurn();
  }

  chooseOption(i: number): void {
    if (this.phase !== 'dialogue' || !this.curTree) return;
    const node = this.trees[this.curTree]?.[this.curNode];
    const opt = node?.opts[i];
    if (!opt) return;
    if (opt.kind === 'leave') return this.closeDialogue();
    if (opt.kind === 'attack') {
      this.closeDialogue();
      this.startCombat();
      return;
    }
    if (opt.kind === 'buy') {
      if (this.party.gold >= 10) {
        this.party.gold -= 10;
        this.party.potions++;
        sfx('coin');
        this.addLog('story', 'Ворон отсыпает зелье из потрёпанной сумки: −10 золота, +1 зелье. «Не пей всё сразу, друг.»');
      } else {
        this.addLog('info', 'Золота не хватает (нужно 10). Ворон сочувственно молчит.');
      }
      this.emit();
      return;
    }
    if (opt.kind === 'persuasion') {
      const r = d20();
      const total = r + 3;
      sfx('dice');
      this.addLog('roll', `Проверка убеждения: d20 ${r} + 3 = ${total} против СЛ 10`);
      if (total >= 10) {
        this.applySpared();
        this.curNode = 'spared';
      } else {
        this.addLog('miss', 'Дрос щурится — он не верит ни единому слову.');
        this.curNode = 'angry';
      }
      this.syncDialogue();
      this.emit();
      return;
    }
    if (opt.next) {
      this.curNode = opt.next;
      this.syncDialogue();
      this.emit();
    } else {
      this.closeDialogue();
    }
  }

  // ==================== ДИАЛОГИ ====================

  private trees: Record<string, Record<string, DNode>> = {
    wanderer: {
      root: {
        speaker: 'Странник Ворон',
        text: 'Тихо. Тадпол за глазом не даёт спать, а? У меня такой же. Мы тут все — одолженные души на этой дороге.',
        opts: [
          { text: '«Что происходит с нами?»', kind: 'next', next: 'worm' },
          { text: '«Кто разбил лагерь на севере?»', kind: 'next', next: 'camp' },
          { text: '«Куплю зелье лечения за 10 золота.»', kind: 'buy' },
          { text: '«Держись подальше от костра, Ворон.»', kind: 'leave' },
        ],
      },
      worm: {
        speaker: 'Странник Ворон',
        text: 'Иллитиды всадили нам тадполов — они превращают нас в одного из них. Медленно и сладко. Кто-то зовёт это даром. Я зову это распиской.',
        opts: [{ text: '«Понял.»', kind: 'next', next: 'root' }, { text: '[Уйти]', kind: 'leave' }],
      },
      camp: {
        speaker: 'Странник Ворон',
        text: 'Гоблины. Дрос водит стаю у старых руин и кормит котёл всеми, кто идёт с юга. Если пойдёте — держитесь вместе и хвалите Абсолюта, пока не проверяют дважды.',
        opts: [{ text: '«Благодарю.»', kind: 'next', next: 'root' }, { text: '[Уйти]', kind: 'leave' }],
      },
    },
    goblin: {
      root: {
        speaker: 'Дрос, вожак стаи',
        text: 'Стоять! Мясо само идёт в котёл — люблю таких гостей. Говори, зачем пришёл, и, может, умрёшь быстрым.',
        opts: [
          { text: '«Мы — посланники Абсолюта. Освободи дорогу.»', kind: 'persuasion' },
          { text: '«Умрите, цепные псы!»', kind: 'attack' },
          { text: '«Мы просто мимо проходили...»', kind: 'leave' },
        ],
      },
      spared: {
        speaker: 'Дрос, вожак стаи',
        text: 'Глаза... как у Истинного Дроса... Х-хорошо. Проходи, посланник. Стая — в сторону, живо!',
        opts: [{ text: '[Отойти, пока не передумали]', kind: 'leave' }],
      },
      angry: {
        speaker: 'Дрос, вожак стаи',
        text: 'Не пахнет от тебя Абсолютом — пахнет обманом и страхом! В КОТЁЛ ЕГО!',
        opts: [{ text: '[В бой!]', kind: 'attack' }],
      },
    },
  };

  private openDialogue(tree: string): void {
    if (this.phase === 'combat') return;
    this.curTree = tree;
    this.curNode = 'root';
    this.phase = 'dialogue';
    this.syncDialogue();
    this.emit();
  }

  private syncDialogue(): void {
    if (!this.curTree) return;
    const node = this.trees[this.curTree][this.curNode];
    this.dialogue = {
      speaker: node.speaker,
      text: node.text,
      options: node.opts.map((o, i) => ({ id: i, text: o.text, tag: o.kind })),
    };
  }

  private closeDialogue(): void {
    this.dialogue = null;
    this.curTree = null;
    this.phase = 'explore';
    this.emit();
  }

  private applySpared(): void {
    this.goblinsSpared = true;
    this.campArmed = false;
    for (const id of ['dros', 'gob1', 'gob2', 'gob3']) {
      const g = this.byId.get(id);
      if (g && g.alive) {
        g.moveTarget = g.mesh.position
          .clone()
          .add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, -9 - Math.random() * 4));
      }
    }
    this.addLog('story', 'Стая расступается и уходит на север, в туман. Путь к руинам свободен.');
  }

  // ==================== БОЙ ====================

  private startCombat(): void {
    if (this.phase === 'combat') return;
    this.combatToken++;
    this.phase = 'combat';
    this.round = 1;
    this.actionMode = 'attack';
    this.healSlots = 2;
    this.blessSlots = 2;
    this.windUsed = false;
    for (const a of this.actors) {
      a.statuses = [];
      this.updateStatusIcon(a);
    }
    sfx('dice');

    const living = this.actors.filter((a) => a.def.mode !== 'neutral' && a.alive);
    for (const a of living) a.initiative = d20() + a.def.initBonus;
    living.sort((x, y) => y.initiative - x.initiative);
    this.order = living.map((a) => a.id);
    this.addLog('story', 'НАЧАЛСЯ БОЙ! Броски инициативы: ' + living.map((a) => `${a.def.name} ${a.initiative}`).join(', '));

    this.activeIdx = 0;
    this.beginTurn();
  }

  private beginTurn(): void {
    const a = this.activeActor();
    if (!a) return;
    a.movementLeft = a.def.speed;
    a.actionAvailable = true;
    a.bonusAvailable = true;
    a.reactionAvailable = true;
    a.disengaged = false;
    if (a.bashCd > 0) a.bashCd--;
    a.threatZones = this.zonesOf(a);
    this.turnMoveWarned = false;
    this.actionMode = 'attack';
    // Тик огня под ногами — до действий (v0.4)
    this.checkTileFire(a);
    if (!a.alive) {
      this.emit();
      this.endTurn();
      return;
    }
    // Оглушение проверяем ДО тика статусов: статус ещё активен в этот ход
    const stunned = this.hasStatus(a, 'stun');
    // Тики статусов в начале хода: горение жжёт до действий
    this.tickStatuses(a);
    if (!a.alive) {
      this.emit();
      this.endTurn();
      return;
    }
    if (stunned) {
      this.addLog('status', `💫 ${a.def.name} оглушён и пропускает ход!`);
      this.emit();
      const token = this.combatToken;
      setTimeout(() => {
        if (this.disposed || token !== this.combatToken || this.phase !== 'combat') return;
        if (this.activeActor() === a) this.endTurn();
      }, 1100);
      return;
    }
    if (a.def.mode === 'ally') this.selectedId = a.id;
    this.camFocusTarget = a.mesh.position.clone();
    this.addLog('info', `— Ход: ${a.def.name} —`);
    this.emit();
    if (a.def.mode === 'foe') void this.runAI(a);
  }

  private tryAttackOnFoe(foe: Actor): void {
    const me = this.activeActor();
    if (!me || me.def.mode !== 'ally' || !me.alive) return;
    if (!me.actionAvailable) {
      this.addLog('info', 'Действие уже использовано — двигайтесь или завершайте ход.');
      return;
    }
    if (this.actionMode === 'spell' && me.def.spell) {
      const d = this.dist(me, foe);
      if (d > me.def.spell.range) {
        this.addLog('info', `Слишком далеко для заклинания: ${d.toFixed(0)} м (максимум ${me.def.spell.range}).`);
        return;
      }
      this.performAttack(me, foe, true);
      return;
    }
    const d = this.dist(me, foe);
    if (d <= me.def.range + 0.25) {
      this.performAttack(me, foe, false);
      return;
    }
    // v0.4: подойти по маршруту A* и ударить, если перемещения хватит
    const plan = this.approachPlan(me, foe);
    if (!plan) {
      this.addLog('info', 'Путь перекрыт — к врагу не подобраться.');
      return;
    }
    me.path = plan.pts;
    me.moveTarget = plan.pts.length ? plan.pts[plan.pts.length - 1].clone() : null;
    me.threatZones = this.zonesOf(me);
    if (plan.pts.length) {
      me.mesh.rotation.y = Math.atan2(plan.pts[0].x - me.mesh.position.x, plan.pts[0].z - me.mesh.position.z);
      this.markerAt(me.moveTarget!);
    }
    me.pendingAttackId = plan.attackAfter ? foe.id : null;
    if (!plan.attackAfter) this.addLog('info', `${me.def.name}: не хватит перемещения — подойду ближе.`);
    this.emit();
  }

  /** Лучший подход к цели по сетке: ближайшая достижимая клетка. */
  private approachPlan(me: Actor, foe: Actor): { pts: THREE.Vector3[]; attackAfter: boolean } | null {
    const blocked = this.blockedFn();
    const start = tileOf(me.mesh.position.x, me.mesh.position.z);
    if (!inGrid(start.i, start.j)) return null;
    const budget = Math.max(0, me.movementLeft - 0.05) / TILE;
    const reach = findReachable(blocked, start.i, start.j, budget);
    let best: { i: number; j: number; wd: number } | null = null;
    for (let j = 0; j < GRID_H; j++) {
      for (let i = 0; i < GRID_W; i++) {
        if (!isFinite(reach.cost[idx(i, j)])) continue;
        const c = tileCenter(i, j);
        const wd = Math.hypot(c.x - foe.mesh.position.x, c.z - foe.mesh.position.z);
        if (!best || wd < best.wd) best = { i, j, wd };
      }
    }
    if (!best) return null;
    const tiles = pathFromReach(reach, best.i, best.j);
    const pts = tiles.map((t) => {
      const c = tileCenter(t.i, t.j);
      return new THREE.Vector3(c.x, 0, c.z);
    });
    return { pts, attackAfter: best.wd <= me.def.range - 0.1 };
  }

  private performAttack(a: Actor, t: Actor, spell: boolean, isReaction = false): void {
    a.moveTarget = null;
    a.pendingAttackId = null;
    // Разворот к цели вручную: lookAt при близких/вырожденных направлениях заваливает крен (rotation.z = ±π)
    const fdx = t.mesh.position.x - a.mesh.position.x;
    const fdz = t.mesh.position.z - a.mesh.position.z;
    if (Math.abs(fdx) > 1e-4 || Math.abs(fdz) > 1e-4) a.mesh.rotation.y = Math.atan2(fdx, fdz);
    a.mesh.rotation.x = 0;
    a.mesh.rotation.z = 0;
    a.attackT = 0.45;
    // Реакция не тратит действие
    if (!isReaction) a.actionAvailable = false;

    const s = spell ? a.def.spell : undefined;
    const bonus = s ? s.bonus : a.def.atkBonus;
    // Преимущество: фланг в ближнем бою или оглушённая цель. Помеха: отравлен/испуган атакующий. Благословение: +1d4 к броску.
    const adv = (!s && this.hasFlank(a, t)) || this.hasStatus(t, 'stun');
    const dis = this.hasStatus(a, 'poison') || this.hasStatus(a, 'fear');
    const blessB = this.hasStatus(a, 'bless') ? roll(4) : 0;
    const r = rollD20(adv, dis);
    const total = r + bonus + blessB;
    const label = s ? `${a.def.name} — ${s.name}` : a.def.name;
    const pct = Math.round(hitChance(bonus, t.def.ac, adv, dis) * 100);
    const flags = [adv ? 'преимущество' : '', dis ? 'помеха' : ''].filter(Boolean).join(', ');
    const tag = isReaction ? ' [по возможности]' : '';
    const blessTxt = blessB ? ` +1d4(${blessB})` : '';
    const flagTxt = flags ? ` · ${flags}` : '';
    this.addLog('roll', `${label}${tag}: d20 ${r}${blessTxt} + ${bonus} = ${total} против КД ${t.def.ac} · шанс ${pct}%${flagTxt}`);
    const hit = r === 20 || (r !== 1 && total >= t.def.ac);
    const dice = s ? s.dmg : a.def.dmg;

    if (s) {
      // Огненный снаряд летит по дуге, урон засчитывается в момент попадания
      sfx('fire');
      const token = this.combatToken;
      this.spawnBolt(a, t, () => {
        if (this.disposed || token !== this.combatToken) return;
        if (t.alive) this.applyDamage(a, t, r, hit, dice, true);
        if (this.phase === 'combat' && a.def.mode === 'ally') this.scheduleAutoEnd();
        this.emit();
      });
      this.emit();
      return;
    }

    this.applyDamage(a, t, r, hit, dice, false);
    this.emit();
    if (a.def.mode === 'ally' && this.phase === 'combat' && !isReaction) this.scheduleAutoEnd();
  }

  /** Применяет результат броска атаки: крит/попадание/промах, урон, статус-эффекты, смерть. */
  private applyDamage(a: Actor, t: Actor, r: number, hit: boolean, dice: [number, number, number], spell = false): void {
    if (!hit) {
      this.addLog(
        'miss',
        r === 1
          ? `Критический промах! ${a.def.name} едва не роняет оружие.`
          : `${a.def.name} промахивается по ${t.def.name}.`
      );
      this.popup(t, 'мимо', '#9a958a');
      sfx('miss');
      return;
    }
    let dmg = rollDice(dice[0], dice[1], dice[2]).total;
    if (r === 20) {
      dmg += rollDice(dice[0], dice[1], dice[2]).total;
      this.addLog('crit', `КРИТ! ${a.def.name} обрушивается на ${t.def.name}: ${dmg} урона!`);
      sfx('crit');
    } else {
      const mod = dice[2] >= 0 ? '+' + dice[2] : '' + dice[2];
      this.addLog('hit', `${a.def.name} попадает по ${t.def.name}: ${dmg} урона (${dice[0]}d${dice[1]}${mod}).`);
      sfx('hit');
    }
    t.hp = Math.max(0, t.hp - dmg);
    this.popup(t, `−${dmg}`, r === 20 ? '#ff5340' : '#ffb04d');
    updateBar(t);
    if (t.hp <= 0) {
      this.kill(t);
    } else if (spell && r === 20) {
      this.applyStatus(t, 'burning', 2); // крит Огненного снаряда поджигает цель
    } else if (a.id === 'dros') {
      this.applyStatus(t, 'poison', 2); // ржавый клинок вожака отравляет при каждом попадании
    }
  }

  // ==================== СТАТУСЫ, РЕАКЦИИ, ИНСПЕКЦИЯ ====================

  private hasStatus(a: Actor, id: StatusId): boolean {
    return a.statuses.some((s) => s.id === id);
  }

  /** Навешивает статус (обновляя длительность) с попапом, записью в журнал и значком над головой. */
  private applyStatus(t: Actor, id: StatusId, turns: number, silent = false): void {
    const ex = t.statuses.find((s) => s.id === id);
    if (ex) ex.turns = Math.max(ex.turns, turns);
    else t.statuses.push({ id, turns });
    const def = STATUS_DEFS[id];
    this.popup(t, def.badge, def.color);
    if (!silent) this.addLog('status', `${def.name} на ${t.def.name} (${turns} ход.).`);
    this.updateStatusIcon(t);
    this.emit();
  }

  /** Тик статусов в начале хода: горение наносит 1d4, длительности уменьшаются. */
  private tickStatuses(a: Actor): void {
    for (const s of [...a.statuses]) {
      if (s.id === 'burning' && a.alive) {
        const dmg = roll(4);
        a.hp = Math.max(0, a.hp - dmg);
        this.popup(a, `−${dmg}`, STATUS_DEFS.burning.color);
        this.addLog('status', `Горение жжёт ${a.def.name}: ${dmg} урона.`);
        updateBar(a);
        if (a.hp <= 0) this.kill(a);
      }
      s.turns--;
    }
    const expired = a.statuses.filter((s) => s.turns <= 0);
    if (expired.length) {
      a.statuses = a.statuses.filter((s) => s.turns > 0);
      for (const s of expired) this.addLog('info', `${STATUS_DEFS[s.id].name} на ${a.def.name} проходит.`);
    }
    this.updateStatusIcon(a);
  }

  /** Значок статусов над головой (спрайт с текстом). */
  private updateStatusIcon(a: Actor): void {
    if (a.statusSprite) {
      a.mesh.remove(a.statusSprite);
      const m = a.statusSprite.material as SpriteMaterial;
      m.map?.dispose();
      m.dispose();
      a.statusSprite = null;
    }
    if (!a.alive || !a.statuses.length) return;
    const first = a.statuses[0];
    const text = a.statuses.map((s) => STATUS_DEFS[s.id].badge).join(' ');
    const spr = makeTextSprite(text, STATUS_DEFS[first.id].color, 0.95);
    spr.position.y = 2.82;
    a.mesh.add(spr);
    a.statusSprite = spr;
  }

  /** Преимущество по флангу: союзник атакующего стоит вплотную к цели. */
  private hasFlank(a: Actor, t: Actor): boolean {
    if (a.def.mode === 'neutral' || t.def.mode === 'neutral') return false;
    return this.actors.some(
      (x) => x !== a && x.alive && x.def.mode === a.def.mode && x.mesh.position.distanceTo(t.mesh.position) < 2.05
    );
  }

  /** Зоны угрозы: враги ближнего боя с доступной реакцией, достающие до актёра. */
  private zonesOf(a: Actor): Set<string> {
    const s = new Set<string>();
    if (this.phase !== 'combat') return s;
    for (const h of this.actors) {
      if (h === a || !h.alive || !h.reactionAvailable) continue;
      if (h.def.mode === 'neutral' || a.def.mode === 'neutral') continue;
      if (h.def.mode === a.def.mode) continue;
      if (h.def.range > MELEE_RANGE + 0.05) continue;
      if (this.dist(h, a) <= h.def.range + 0.15) s.add(h.id);
    }
    return s;
  }

  /** Выход из зоны угрозы провоцирует свободную атаку (реакция не тратит действие). Отход защищает от провокаций. */
  private checkProvoke(a: Actor): void {
    if (!a.alive) return;
    const cur = this.zonesOf(a);
    const prev = a.threatZones;
    a.threatZones = cur;
    if (!prev || a.disengaged) return;
    for (const hid of prev) {
      if (cur.has(hid) || !a.alive) continue;
      const h = this.byId.get(hid);
      if (!h || !h.alive || !h.reactionAvailable) continue;
      h.reactionAvailable = false;
      this.addLog('status', `Провокация! ${a.def.name} уходит от ${h.def.name} — атака по возможности.`);
      this.performAttack(h, a, false, true);
    }
  }

  /** Актёр под курсором (для тултипа). */
  hoverActorAt(cx: number, cy: number): string | null {
    if (!this.renderer) return null;
    this.setPointerRay(cx, cy);
    const hit = this.ray.intersectObjects(this.hitboxes, false)[0];
    if (!hit) return null;
    const a = this.byId.get(hit.object.userData.actorId as string);
    return a && a.alive ? a.id : null;
  }

  /** Бочка под курсором (тултип v0.4). */
  hoverBarrelAt(cx: number, cy: number): BarrelInfo | null {
    if (!this.renderer || this.phase === 'intro') return null;
    this.setPointerRay(cx, cy);
    const hit = this.ray.intersectObjects(this.barrelMeshes, false)[0];
    if (!hit) return null;
    const b = this.barrelById(hit.object.userData.barrelId as number);
    if (!b || !b.alive) return null;
    return b.type === 'explosive'
      ? {
          name: 'Огненная бочка',
          desc: 'Взрыв: 2d6+2 урона в радиусе 3 м, поджигает всё вокруг. Цепная детонация! Разбей оружием рядом или попади Огненным снарядом.',
        }
      : {
          name: 'Бочка с маслом',
          desc: 'При разрушении разливает масло — огонь перекидывается на разлив мгновенно. Подожги рядом с врагами!',
        };
  }

  /** Тестовый хелпер: путь A* от Кардана до точки. */
  debugPath(x: number, z: number): Array<{ i: number; j: number }> | null {
    const me = this.byId.get('cardan');
    if (!me) return null;
    const s = tileOf(me.mesh.position.x, me.mesh.position.z);
    const t = tileOf(x, z);
    if (!inGrid(s.i, s.j) || !inGrid(t.i, t.j)) return null;
    return findPath(this.blockedFn(), s.i, s.j, t.i, t.j);
  }

  /** Данные для тултипа: характеристики, статусы и предсказание атаки активного героя. */
  inspect(id: string): HoverInfo | null {
    const a = this.byId.get(id);
    if (!a) return null;
    const act = this.activeActor();
    let preview: HoverInfo['preview'] = null;
    if (this.phase === 'combat' && act && act.def.mode === 'ally' && act.alive && a.def.mode === 'foe' && a.alive) {
      const spell = this.actionMode === 'spell' ? act.def.spell : undefined;
      const bonus = spell ? spell.bonus : act.def.atkBonus;
      const adv = (!spell && this.hasFlank(act, a)) || this.hasStatus(a, 'stun');
      const dis = this.hasStatus(act, 'poison') || this.hasStatus(act, 'fear');
      const dice = spell ? spell.dmg : act.def.dmg;
      preview = {
        label: spell ? spell.name : 'Оружие',
        dice: fmtDice(dice[0], dice[1], dice[2]),
        pct: Math.round(hitChance(bonus, a.def.ac, adv, dis) * 100),
        adv,
        dis,
      };
    }
    return {
      id: a.id,
      name: a.def.name,
      cls: a.def.cls,
      hp: a.hp,
      maxHp: a.def.maxHp,
      ac: a.def.ac,
      mode: a.def.mode,
      alive: a.alive,
      statuses: a.statuses.map((s): StatusView => ({ id: s.id, turns: s.turns, ...STATUS_DEFS[s.id] })),
      preview,
    };
  }

  // ==================== СНАРЯДЫ И ВСПЫШКИ ====================

  private spawnBoltTo(from: THREE.Vector3, to: THREE.Vector3, color: number, onHit: () => void): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.copy(from);
    this.scene.add(mesh);
    const dur = THREE.MathUtils.clamp(from.distanceTo(to) / 24, 0.18, 0.46);
    this.projs.push({ mesh, from, to, t: 0, dur, burst: false, onHit });
  }

  private spawnBolt(a: Actor, t: Actor, onHit: () => void): void {
    this.spawnBoltTo(
      a.mesh.position.clone().add(new THREE.Vector3(0, 1.45, 0)),
      t.mesh.position.clone().add(new THREE.Vector3(0, 1.05, 0)),
      0xffb050,
      onHit
    );
  }

  private burst(pos: THREE.Vector3, color = 0xff7030): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false })
    );
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.projs.push({ mesh, from: pos.clone(), to: pos.clone(), t: 0, dur: 0.26, burst: true });
  }

  private updateProjs(dt: number): void {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      if (p.burst) {
        p.mesh.scale.setScalar(1 + k * (p.grow ?? 4.2));
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.85;
      } else {
        p.mesh.position.lerpVectors(p.from, p.to, k);
        p.mesh.position.y += Math.sin(k * Math.PI) * 0.55;
        p.mesh.scale.setScalar(0.8 + Math.sin(p.t * 40) * 0.15);
      }
      if (k >= 1) {
        this.scene.remove(p.mesh);
        const m = p.mesh.material as THREE.MeshBasicMaterial;
        m.dispose();
        p.mesh.geometry.dispose();
        this.projs.splice(i, 1);
        if (!p.burst) this.burst(p.to);
        p.onHit?.();
      }
    }
  }

  private kill(t: Actor): void {
    t.alive = false;
    t.moveTarget = null;
    t.path = null;
    t.pendingAttackId = null;
    t.threatZones = null;
    t.statuses = [];
    this.updateStatusIcon(t);
    t.fall = 0;
    t.fallDir = Math.random() < 0.5 ? 1 : -1;
    if (t.barGroup) t.barGroup.visible = false;
    if (t.nameSprite) (t.nameSprite.material as SpriteMaterial).opacity = 0.35;
    this.addLog('death', `${t.def.name} повержен!`);
    sfx('death');
    if (t.def.mode === 'foe') this.loot(t);
    // Активный юнит погиб ( AoO или горение в свой ход) — корректно завершаем его ход
    if (this.phase === 'combat' && this.activeActor() === t) {
      const token = this.combatToken;
      setTimeout(() => {
        if (this.disposed || token !== this.combatToken || this.phase !== 'combat') return;
        const cur = this.activeActor();
        if (cur === t && !t.alive) this.endTurn();
      }, 1000);
    }
  }

  /** Добыча и опыт за поверженного врага. */
  private loot(t: Actor): void {
    const boss = t.id === 'dros';
    const gold = boss ? 10 + roll(8) : 3 + roll(4);
    this.party.gold += gold;
    let msg = `Добыча с ${t.def.name}: ${gold} золота`;
    if (roll(5) >= 3) {
      this.party.potions++;
      msg += ', а в сумке — зелье лечения';
    }
    this.addLog('story', `💰 ${msg}.`);
    sfx('coin');
    this.gainXp(boss ? 50 : 25);
  }

  // ==================== ОПЫТ И УРОВНИ ====================

  private xpNext(): number {
    return this.party.level * 100;
  }

  private gainXp(n: number): void {
    this.party.xp += n;
    this.addLog('story', `⭐ Партия получает ${n} ед. опыта (${this.party.xp}/${this.xpNext()}).`);
    while (this.party.xp >= this.xpNext()) {
      this.party.level++;
      for (const a of this.actors.filter((x) => x.def.mode === 'ally')) {
        a.def.maxHp += 5;
        a.def.atkBonus += 1;
        if (a.alive) {
          a.hp = Math.min(a.def.maxHp, a.hp + 5);
          this.popup(a, `УР. ${this.party.level}!`, '#ffd54a');
        }
        updateBar(a);
      }
      this.addLog('story', `🎉 УРОВЕНЬ ${this.party.level}! Герои стали сильнее: +5 к макс. HP, +1 к атаке.`);
      sfx('level');
    }
    this.emit();
  }

  private scheduleAutoEnd(): void {
    const token = this.combatToken;
    setTimeout(() => {
      if (this.disposed || token !== this.combatToken || this.phase !== 'combat') return;
      const a = this.activeActor();
      if (!a || a.def.mode !== 'ally') return;
      if (!a.actionAvailable && !a.moveTarget && a.movementLeft < 0.3) this.endTurn();
    }, 1400);
  }

  private clearStatuses(): void {
    for (const a of this.actors) {
      a.statuses = [];
      this.updateStatusIcon(a);
    }
  }

  private victory(): void {
    this.phase = 'victory';
    this.clearStatuses();
    this.extinguishAll();
    this.gainXp(25);
    this.addLog('story', 'ПОБЕДА! Стая Дроса разбита, путь к руинам свободен.');
    sfx('good');
    this.emit();
  }

  private defeat(): void {
    this.phase = 'defeat';
    this.clearStatuses();
    this.extinguishAll();
    this.addLog('story', 'Партия пала. Тьма сгущается над Чионтарским лесом...');
    sfx('bad');
    this.emit();
  }

  // ==================== СОХРАНЕНИЯ ====================

  async saveGame(): Promise<void> {
    if (this.phase !== 'explore') {
      this.addLog('info', 'Сохранить можно в режиме исследования (не в бою и не в диалоге).');
      return;
    }
    const data: SaveData = {
      v: 3,
      savedAt: Date.now(),
      party: { ...this.party },
      heroes: this.actors
        .filter((a) => a.def.mode === 'ally')
        .map((a) => ({ id: a.id, x: a.mesh.position.x, z: a.mesh.position.z, hp: a.hp })),
      others: this.actors
        .filter((a) => a.def.mode !== 'ally')
        .map((a) => ({
          id: a.id,
          x: a.mesh.position.x,
          z: a.mesh.position.z,
          hp: a.hp,
          alive: a.alive,
        })),
      flags: { goblinsSpared: this.goblinsSpared, campArmed: this.campArmed },
    };
    try {
      await idbSet('slot1', data);
      sfx('click');
      this.addLog('story', '💾 Игра сохранена (слот 1).');
    } catch {
      this.addLog('info', 'Не удалось сохранить: хранилище недоступно.');
    }
  }

  async loadGame(): Promise<void> {
    if (this.phase === 'combat') {
      this.addLog('info', 'Нельзя загружать сохранение в бою.');
      return;
    }
    let data: SaveData | null = null;
    try {
      data = await idbGet<SaveData>('slot1');
    } catch {
      data = null;
    }
    if (!data || data.v !== 3) {
      this.addLog('info', 'Сохранений пока нет — нажмите 💾 в режиме исследования.');
      return;
    }
    this.applySave(data);
    sfx('click');
    this.addLog('story', '📂 Игра загружена из слота 1.');
    this.emit();
  }

  private reviveVisuals(a: Actor): void {
    a.alive = true;
    a.fall = 1;
    a.mesh.rotation.set(0, a.mesh.rotation.y, 0);
    a.mesh.position.y = 0;
    a.threatZones = null;
    if (a.barGroup) a.barGroup.visible = true;
    if (a.nameSprite) (a.nameSprite.material as SpriteMaterial).opacity = 1;
    updateBar(a);
  }

  private killSilent(a: Actor): void {
    a.alive = false;
    a.fall = 1;
    a.moveTarget = null;
    a.path = null;
    a.pendingAttackId = null;
    a.threatZones = null;
    a.statuses = [];
    this.updateStatusIcon(a);
    a.mesh.rotation.z = a.fallDir * 1.42;
    a.mesh.position.y = 0.3;
    if (a.barGroup) a.barGroup.visible = false;
    if (a.nameSprite) (a.nameSprite.material as SpriteMaterial).opacity = 0.35;
  }

  private applySave(data: SaveData): void {
    this.combatToken++;
    this.phase = 'explore';
    this.dialogue = null;
    this.curTree = null;
    this.actionMode = 'attack';
    this.party = { ...data.party };
    for (const h of data.heroes) {
      const a = this.byId.get(h.id);
      if (!a) continue;
      const raw = RAW_STATS.find((r) => r.id === h.id);
      if (raw) {
        a.def.maxHp = raw.maxHp + (data.party.level - 1) * 5;
        a.def.atkBonus = raw.atkBonus + (data.party.level - 1);
      }
      a.hp = Math.min(h.hp, a.def.maxHp);
      a.mesh.position.set(h.x, 0, h.z);
      a.moveTarget = null;
      a.path = null;
      a.pendingAttackId = null;
      if (!a.alive) this.reviveVisuals(a);
    }
    for (const o of data.others) {
      const a = this.byId.get(o.id);
      if (!a) continue;
      a.mesh.position.set(o.x, 0, o.z);
      a.moveTarget = null;
      a.path = null;
      a.hp = o.hp;
      if (o.alive && !a.alive) this.reviveVisuals(a);
      if (!o.alive && a.alive) this.killSilent(a);
    }
    this.goblinsSpared = data.flags.goblinsSpared;
    this.campArmed = data.flags.campArmed;
    for (const a of this.actors) {
      a.statuses = [];
      a.threatZones = null;
      a.reactionAvailable = true;
      this.updateStatusIcon(a);
    }
    const cardan = this.byId.get('cardan');
    if (cardan) {
      this.camFocus.set(cardan.mesh.position.x, 0, cardan.mesh.position.z);
      this.camFocusTarget = null;
    }
    this.emit();
  }

  // ==================== v0.4: ПОЛЕ БОЯ, БОЧКИ И ОГОНЬ ====================

  /** Предикат блокировки клетки: статические препятствия + бочки + горящие клетки. */
  private blockedFn(): (i: number, j: number) => boolean {
    return (i: number, j: number) => {
      const k = idx(i, j);
      return this.gridBlockers.has(k) || this.fireTiles.has(k);
    };
  }

  /** Валгуны, бочки, пятна сухой травы и масляные разливы. */
  private buildField(): void {
    this.gridBlockers = buildStaticBlockers();

    // Новые валуны (мешы; колонны руин и костёр уже отрисованы в world.ts)
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a6d62, roughness: 0.95 });
    for (const o of STATIC_OBSTACLES) {
      if (o.r < 0.7) continue;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(o.r * 0.95, 0), rockMat);
      rock.position.set(o.x, o.r * 0.42, o.z);
      rock.rotation.set(o.x * 0.7, o.z * 0.7, o.z * 0.3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    }

    // Пятна сухой травы — топливо для пожара
    const patches = [
      { x: 0, z: -9, r: 2.0 },
      { x: -3.5, z: -12, r: 1.6 },
      { x: 3.2, z: -10.5, r: 1.8 },
    ];
    for (const p of patches) {
      for (let j = 0; j < GRID_H; j++) {
        for (let i = 0; i < GRID_W; i++) {
          const c = tileCenter(i, j);
          if (Math.hypot(c.x - p.x, c.z - p.z) <= p.r) {
            this.dryTiles.add(idx(i, j));
            this.addDecal(c.x, c.z, 0.62, 0x8a7a3a, 0.3);
          }
        }
      }
    }

    // Бочки: взрывные и масляные
    const barrelDefs: Array<[number, number, 'explosive' | 'oil']> = [
      [-1.2, -6.8, 'explosive'],
      [2.6, -8.6, 'explosive'],
      [-3.4, -10.2, 'explosive'],
      [4.6, -12.4, 'explosive'],
      [0.8, -13.6, 'explosive'],
      [-5.2, -8.8, 'oil'],
      [3.4, -5.6, 'oil'],
    ];
    for (const [x, z, type] of barrelDefs) {
      const t = tileOf(x, z);
      if (!inGrid(t.i, t.j) || this.gridBlockers.has(idx(t.i, t.j))) continue;
      this.spawnBarrel(x, z, type);
    }
  }

  private spawnBarrel(x: number, z: number, type: 'explosive' | 'oil'): void {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: type === 'explosive' ? 0x8a3324 : 0x4a3d2c,
      roughness: 0.8,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.78, 10), bodyMat);
    body.position.y = 0.39;
    body.castShadow = true;
    body.userData.barrelId = this.barrelSeq;
    g.add(body);
    this.barrelMeshes.push(body);
    const bandMat =
      type === 'explosive'
        ? new THREE.MeshStandardMaterial({ color: 0xff5533, emissive: 0xdd2211, emissiveIntensity: 1.1 })
        : new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.4 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.372, 0.372, 0.11, 10), bandMat);
    band.position.y = 0.46;
    g.add(band);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const b: Barrel = { id: this.barrelSeq++, x, z, type, alive: true, mesh: g };
    this.barrels.push(b);
    const t = tileOf(x, z);
    this.gridBlockers.add(idx(t.i, t.j));
  }

  private barrelById(id: number): Barrel | null {
    return this.barrels.find((b) => b.id === id) ?? null;
  }

  /** Клик по бочке: разбить оружием или поджечь Огненным снарядом. */
  private clickBarrel(b: Barrel): void {
    const me = this.activeActor();
    if (!me || me.def.mode !== 'ally' || !me.alive) return;

    if (this.actionMode === 'spell' && me.def.spell) {
      if (!me.actionAvailable) return this.addLog('info', 'Действие уже использовано.');
      const d = Math.hypot(b.x - me.mesh.position.x, b.z - me.mesh.position.z);
      if (d > me.def.spell.range)
        return this.addLog('info', `Слишком далеко для заклинания: ${d.toFixed(0)} м (макс ${me.def.spell.range}).`);
      me.actionAvailable = false;
      this.actionMode = 'attack';
      sfx('fire');
      this.addLog('roll', `${me.def.name} — ${me.def.spell.name} в бочку (${d.toFixed(0)} м).`);
      const token = this.combatToken;
      this.spawnBoltTo(
        me.mesh.position.clone().add(new THREE.Vector3(0, 1.45, 0)),
        new THREE.Vector3(b.x, 0.45, b.z),
        0xffb050,
        () => {
          if (this.disposed || token !== this.combatToken) return;
          this.addLog('fire', '🎯 Снаряд попадает в бочку!');
          this.destroyBarrel(b);
          if (this.phase === 'combat' && me.def.mode === 'ally') this.scheduleAutoEnd();
          this.emit();
        }
      );
      this.emit();
      return;
    }

    if (this.actionMode === 'attack' && me.def.range <= MELEE_RANGE + 0.05) {
      if (!me.actionAvailable) return this.addLog('info', 'Действие уже использовано.');
      const d = Math.hypot(b.x - me.mesh.position.x, b.z - me.mesh.position.z);
      if (d > 2.5)
        return this.addLog('info', 'Подойдите ближе, чтобы разбить бочку, или подожгите её Огненным снарядом.');
      me.actionAvailable = false;
      this.faceTowards(me, new THREE.Vector3(b.x, 0, b.z));
      me.attackT = 0.45;
      sfx('hit');
      this.addLog('story', `${me.def.name} разбивает бочку!`);
      const token = this.combatToken;
      setTimeout(() => {
        if (this.disposed || token !== this.combatToken) return;
        this.destroyBarrel(b);
        if (this.phase === 'combat' && me.def.mode === 'ally') this.scheduleAutoEnd();
        this.emit();
      }, 280);
      this.emit();
      return;
    }

    this.addLog('info', 'Бочку можно разбить оружием рядом или поджечь Огненным снарядом (режим 🔥).');
  }

  private destroyBarrel(b: Barrel, depth = 0): void {
    if (!b.alive) return;
    b.alive = false;
    const t = tileOf(b.x, b.z);
    if (inGrid(t.i, t.j)) this.gridBlockers.delete(idx(t.i, t.j));
    if (b.mesh) {
      this.scene.remove(b.mesh);
      b.mesh = null;
    }
    this.barrelMeshes = this.barrelMeshes.filter((m) => m.userData.barrelId !== b.id);
    if (b.type === 'explosive') {
      void this.explode(b.x, b.z, depth);
    } else {
      sfx('fire');
      this.addLog('story', '🛢️ Бочка с маслом разбита — масло растекается по земле!');
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          const i = t.i + di;
          const j = t.j + dj;
          if (!inGrid(i, j) || this.gridBlockers.has(idx(i, j))) continue;
          this.oilTiles.add(idx(i, j));
          const c = tileCenter(i, j);
          this.addDecal(c.x, c.z, 0.6, 0x14100c, 0.78);
        }
      }
      this.emit();
    }
  }

  /** Взрыв огненной бочки: урон 2d6+2 в радиусе 3 м, страх, поджог, цепная детонация. */
  private async explode(x: number, z: number, depth = 0): Promise<void> {
    sfx('crit');
    this.addLog('fire', '💥 ВЗРЫВ! Огненная бочка детонирует!');
    this.boomFX(x, z);
    this.flash.position.set(x, 1.6, z);
    this.flash.intensity = 320;
    this.shakeT = 0.9;
    const R = 3.2;
    for (const t of this.actors) {
      if (!t.alive || t.def.mode === 'neutral') continue;
      if (Math.hypot(t.mesh.position.x - x, t.mesh.position.z - z) > R) continue;
      const dmg = rollDice(2, 6, 2).total;
      this.damageDirect(t, dmg, 'взрыв бочки');
      if (t.alive) {
        const sv = d20() + t.def.saveBonus;
        if (sv < 10) this.applyStatus(t, 'fear', 1);
      }
      await sleep(70);
    }
    const c = tileOf(x, z);
    let ignited = 0;
    for (let di = -2; di <= 2; di++) {
      for (let dj = -2; dj <= 2; dj++) {
        const i = c.i + di;
        const j = c.j + dj;
        if (!inGrid(i, j)) continue;
        const cc = tileCenter(i, j);
        if (Math.hypot(cc.x - x, cc.z - z) > 2.7) continue;
        if (this.igniteTile(i, j, 3)) ignited++;
      }
    }
    if (ignited) this.addLog('fire', `🔥 Взрыв поджёг всё вокруг — новых очагов: ${ignited}.`);
    if (depth < 3) {
      for (const b of [...this.barrels]) {
        if (!b.alive) continue;
        if (Math.hypot(b.x - x, b.z - z) > R) continue;
        await sleep(230);
        this.destroyBarrel(b, depth + 1);
      }
    }
    this.emit();
  }

  private boomFX(x: number, z: number): void {
    const boom = (delay: number, color: number, maxS: number, dur: number) => {
      setTimeout(() => {
        if (this.disposed) return;
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 14, 10),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false })
        );
        mesh.position.set(x, 0.7, z);
        this.scene.add(mesh);
        this.projs.push({ mesh, from: mesh.position.clone(), to: mesh.position.clone(), t: 0, dur, burst: true, grow: maxS });
      }, delay);
    };
    boom(0, 0xff8833, 8.5, 0.5);
    boom(110, 0xffd97a, 5.5, 0.42);
    this.burst(new THREE.Vector3(x, 0.5, z), 0xff5522);
  }

  /** Поджигает клетку, если на ней есть топливо. Огонь рядом с бочкой взрывает её. */
  private igniteTile(i: number, j: number, turns = 3): boolean {
    if (!inGrid(i, j)) return false;
    const k = idx(i, j);
    if (this.fireTiles.has(k) || this.scorchedTiles.has(k) || this.gridBlockers.has(k)) return false;
    const fuel = this.fuelAt(i, j);
    if (fuel === 'none') return false;
    const c = tileCenter(i, j);
    const fx = this.makeFireFx(c.x, c.z, fuel === 'oil' ? 1.2 : 1);
    this.scene.add(fx);
    const seed = Math.random() * 10;
    this.fireTiles.set(k, { i, j, turns: fuel === 'oil' ? turns + 1 : turns, fx, seed });
    this.fireFxList.push({ g: fx, seed });
    // Пламя добирается до бочки — та детонирует
    for (const b of this.barrels) {
      if (!b.alive) continue;
      if (Math.hypot(b.x - c.x, b.z - c.z) < TILE * 1.05) {
        const bb = b;
        setTimeout(() => {
          if (this.disposed || !bb.alive) return;
          this.addLog('fire', '🔥 Пламя добралось до бочки...');
          this.destroyBarrel(bb);
        }, 420);
        break;
      }
    }
    return true;
  }

  /** Конец раунда: горение затухает/выжигает траву, пламя перекидывается дальше. */
  private spreadFire(): void {
    if (!this.fireTiles.size) return;
    const expired: number[] = [];
    for (const [k, f] of this.fireTiles) {
      f.turns--;
      if (f.turns <= 0) expired.push(k);
    }
    for (const k of expired) {
      const f = this.fireTiles.get(k)!;
      this.scene.remove(f.fx);
      this.fireFxList = this.fireFxList.filter((x) => x.g !== f.fx);
      this.fireTiles.delete(k);
      this.scorchedTiles.add(k);
      const c = tileCenter(f.i, f.j);
      this.addDecal(c.x, c.z, 0.6, 0x0e0c08, 0.55);
    }
    const toIgnite: Array<[number, number]> = [];
    for (const f of this.fireTiles.values()) {
      for (const [di, dj] of DIRS8) {
        const ni = f.i + di;
        const nj = f.j + dj;
        if (!inGrid(ni, nj)) continue;
        const nk = idx(ni, nj);
        if (this.fireTiles.has(nk) || this.gridBlockers.has(nk)) continue;
        const fuel = this.fuelAt(ni, nj);
        if (fuel === 'none') continue;
        const p = fuel === 'oil' ? 0.9 : fuel === 'dry' ? 0.45 : 0.18;
        if (Math.random() < p) toIgnite.push([ni, nj]);
      }
    }
    let n = 0;
    for (const [i, j] of toIgnite) if (this.igniteTile(i, j, 3)) n++;
    if (n > 0) this.addLog('fire', `🔥 Огонь перекидывается дальше — новых очагов: ${n}.`);
    if (n > 0) this.emit();
  }

  /** Урон от огня в начале хода (юнит стоит в пламени). */
  private checkTileFire(a: Actor): void {
    if (!a.alive || this.phase !== 'combat') return;
    const t = tileOf(a.mesh.position.x, a.mesh.position.z);
    if (!inGrid(t.i, t.j) || !this.fireTiles.has(idx(t.i, t.j))) return;
    const dmg = roll(6);
    this.addLog('fire', `🔥 ${a.def.name} стоит в огне: ${dmg} урона!`);
    a.hp = Math.max(0, a.hp - dmg);
    this.popup(a, `−${dmg}`, '#ff7a2e');
    updateBar(a);
    sfx('fire');
    if (a.hp <= 0) {
      this.kill(a);
      return;
    }
    const sv = d20() + a.def.saveBonus;
    if (sv < 10) this.applyStatus(a, 'burning', 2);
  }

  /** Урон от входа в горящую клетку во время перемещения. */
  private onEnterTile(a: Actor): void {
    if (!a.alive || this.phase !== 'combat') return;
    const t = tileOf(a.mesh.position.x, a.mesh.position.z);
    if (!inGrid(t.i, t.j) || !this.fireTiles.has(idx(t.i, t.j))) return;
    const dmg = roll(6);
    this.addLog('fire', `🔥 ${a.def.name} вбегает в пламя: ${dmg} урона!`);
    a.hp = Math.max(0, a.hp - dmg);
    this.popup(a, `−${dmg}`, '#ff7a2e');
    updateBar(a);
    sfx('fire');
    if (a.hp <= 0) {
      this.kill(a);
      return;
    }
    const sv = d20() + a.def.saveBonus;
    if (sv < 12) this.applyStatus(a, 'burning', 2);
  }

  private fuelAt(i: number, j: number): 'none' | 'grass' | 'dry' | 'oil' {
    if (!inGrid(i, j)) return 'none';
    const k = idx(i, j);
    if (this.scorchedTiles.has(k)) return 'none';
    if (this.oilTiles.has(k)) return 'oil';
    if (this.dryTiles.has(k)) return 'dry';
    return 'grass';
  }

  private makeFireFx(x: number, z: number, scale = 1): THREE.Group {
    const g = new THREE.Group();
    const f1 = new THREE.Mesh(
      new THREE.ConeGeometry(0.3 * scale, 0.85 * scale, 7),
      new THREE.MeshBasicMaterial({ color: 0xff7a2e, transparent: true, opacity: 0.92, depthWrite: false })
    );
    f1.position.y = 0.42 * scale;
    const f2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.15 * scale, 0.5 * scale, 7),
      new THREE.MeshBasicMaterial({ color: 0xffd97a, transparent: true, opacity: 0.9, depthWrite: false })
    );
    f2.position.y = 0.36 * scale;
    g.add(f1, f2);
    g.position.set(x, 0, z);
    return g;
  }

  private updateFireFx(t: number): void {
    for (const f of this.fireFxList) {
      const s = 1 + Math.sin(t * 13 + f.seed) * 0.16;
      f.g.scale.set(s, 1 + Math.sin(t * 17 + f.seed * 2) * 0.2, s);
      f.g.rotation.y += 0.012;
    }
  }

  private extinguishAll(): void {
    for (const f of this.fireTiles.values()) this.scene.remove(f.fx);
    this.fireTiles.clear();
    this.fireFxList = [];
  }

  private addDecal(x: number, z: number, r: number, color: number, opacity: number): void {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
    );
    m.position.set(x, 0.02 + Math.random() * 0.012, z);
    this.scene.add(m);
  }

  /** Прямой урон без броска атаки (взрывы, огонь). */
  private damageDirect(t: Actor, dmg: number, src: string): void {
    if (!t.alive || dmg <= 0) return;
    t.hp = Math.max(0, t.hp - dmg);
    this.popup(t, `−${dmg}`, '#ff7a2e');
    updateBar(t);
    this.addLog('hit', `${t.def.name} получает ${dmg} урона (${src}).`);
    if (t.hp <= 0) this.kill(t);
  }

  private faceTowards(a: Actor, to: THREE.Vector3): void {
    const dx = to.x - a.mesh.position.x;
    const dz = to.z - a.mesh.position.z;
    if (Math.abs(dx) > 1e-4 || Math.abs(dz) > 1e-4) a.mesh.rotation.y = Math.atan2(dx, dz);
  }

  /** Маршрут к точке по A* (клик по земле в бою). */
  private commandMove(me: Actor, x: number, z: number): void {
    const start = tileOf(me.mesh.position.x, me.mesh.position.z);
    if (!inGrid(start.i, start.j)) {
      this.addLog('info', 'Выход за пределы арены.');
      return;
    }
    let target = tileOf(x, z);
    if (!inGrid(target.i, target.j)) return;
    const blocked = this.blockedFn();
    if (blocked(target.i, target.j) || me.movementLeft / TILE < 1) {
      // Цель занята препятствием — ищем ближайшую свободную клетку рядом
      let best: { i: number; j: number; w: number } | null = null;
      for (let di = -2; di <= 2; di++) {
        for (let dj = -2; dj <= 2; dj++) {
          const i = target.i + di;
          const j = target.j + dj;
          if (!inGrid(i, j) || blocked(i, j)) continue;
          const c = tileCenter(i, j);
          const w = Math.hypot(c.x - x, c.z - z);
          if (!best || w < best.w) best = { i, j, w };
        }
      }
      if (!best) {
        this.addLog('info', 'Путь перекрыт — сюда не добраться.');
        this.emit();
        return;
      }
      target = { i: best.i, j: best.j };
    }
    const path = findPath(blocked, start.i, start.j, target.i, target.j);
    if (path === null) {
      this.addLog('info', 'Путь перекрыт — препятствия на карте.');
      this.emit();
      return;
    }
    const pts = path.map((t) => {
      const c = tileCenter(t.i, t.j);
      return new THREE.Vector3(c.x, 0, c.z);
    });
    me.path = pts.length ? pts : null;
    me.moveTarget = pts.length ? pts[pts.length - 1].clone() : null;
    me.threatZones = this.zonesOf(me);
    me.pendingAttackId = null;
    if (pts.length) this.markerAt(pts[pts.length - 1]);
    this.emit();
  }

  /** Сколько провокаций АоО вызовет движение по маршруту (для превью и ИИ). */
  private countProvokeSteps(mover: Actor, pts: THREE.Vector3[]): number {
    let n = 0;
    for (let s = 1; s < pts.length; s++) {
      const A = pts[s - 1];
      const B = pts[s];
      for (const h of this.actors) {
        if (h === mover || !h.alive || !h.reactionAvailable) continue;
        if (h.def.mode === 'neutral' || mover.def.mode === 'neutral') continue;
        if (h.def.mode === mover.def.mode) continue;
        if (h.def.range > MELEE_RANGE + 0.05) continue;
        const dA = Math.hypot(h.mesh.position.x - A.x, h.mesh.position.z - A.z);
        const dB = Math.hypot(h.mesh.position.x - B.x, h.mesh.position.z - B.z);
        if (dA <= h.def.range + 0.15 && dB > h.def.range + 0.15) {
          n++;
          break;
        }
      }
    }
    return n;
  }

  // ==================== v0.4: ПРЕВЬЮ ПУТИ ====================

  private updateHover(cx: number, cy: number): void {
    if (this.phase !== 'combat' || this.actionMode !== 'attack') {
      this.clearPathPreview();
      return;
    }
    const me = this.activeActor();
    if (!me || me.def.mode !== 'ally' || !me.alive || me.path || me.moveTarget) {
      this.clearPathPreview();
      return;
    }
    this.setPointerRay(cx, cy);
    const g = this.ray.intersectObject(this.world.ground, false)[0];
    if (!g) {
      this.clearPathPreview();
      return;
    }
    this.showPathPreview(me, g.point);
  }

  /** Белые точки — маршрут A*, красные — шаги, провоцирующие АоО. */
  private showPathPreview(me: Actor, p: THREE.Vector3): void {
    this.clearPathPreview();
    const blocked = this.blockedFn();
    const start = tileOf(me.mesh.position.x, me.mesh.position.z);
    const target = tileOf(p.x, p.z);
    if (!inGrid(start.i, start.j) || !inGrid(target.i, target.j) || blocked(target.i, target.j)) return;
    const budget = Math.max(0, me.movementLeft) / TILE;
    const reach = findReachable(blocked, start.i, start.j, budget);
    if (!isFinite(reach.cost[idx(target.i, target.j)])) return; // не дойти за оставшееся перемещение
    const tiles = pathFromReach(reach, target.i, target.j);
    if (!tiles.length) return;
    const pts: THREE.Vector3[] = [
      me.mesh.position.clone(),
      ...tiles.map((t) => {
        const c = tileCenter(t.i, t.j);
        return new THREE.Vector3(c.x, 0, c.z);
      }),
    ];
    const danger = new Set<number>();
    for (let s = 1; s < pts.length; s++) {
      const A = pts[s - 1];
      const B = pts[s];
      for (const h of this.actors) {
        if (h === me || !h.alive || !h.reactionAvailable) continue;
        if (h.def.mode === 'neutral' || h.def.mode === me.def.mode) continue;
        if (h.def.range > MELEE_RANGE + 0.05) continue;
        const dA = Math.hypot(h.mesh.position.x - A.x, h.mesh.position.z - A.z);
        const dB = Math.hypot(h.mesh.position.x - B.x, h.mesh.position.z - B.z);
        if (dA <= h.def.range + 0.15 && dB > h.def.range + 0.15) {
          danger.add(s - 1);
          break;
        }
      }
    }
    let n = 0;
    for (let s = 1; s < pts.length && n < this.pathDots.length; s++) {
      const dot = this.pathDots[n++];
      dot.position.set(pts[s].x, 0.06, pts[s].z);
      dot.material = danger.has(s - 1) ? this.dotMatRed : this.dotMatWhite;
      dot.scale.setScalar(1);
      dot.visible = true;
    }
    // Дополнительно помечаем красным клетку, которую покидаем с риском АоО
    for (const s of danger) {
      if (s <= 0 || n >= this.pathDots.length) continue;
      const dot = this.pathDots[n++];
      dot.position.set(pts[s].x, 0.06, pts[s].z);
      dot.material = this.dotMatRed;
      dot.scale.setScalar(1.55);
      dot.visible = true;
    }
  }

  private clearPathPreview(): void {
    for (const d of this.pathDots) d.visible = false;
  }

  /** Огненный снаряд по земле — поджог клетки. */
  private castFireboltAtPoint(a: Actor, x: number, z: number): void {
    if (!a.def.spell) return;
    if (!a.actionAvailable) {
      this.addLog('info', 'Действие в этом ходу уже использовано.');
      return;
    }
    const d = Math.hypot(x - a.mesh.position.x, z - a.mesh.position.z);
    if (d > a.def.spell.range) {
      this.addLog('info', `Слишком далеко для заклинания: ${d.toFixed(0)} м (максимум ${a.def.spell.range}).`);
      return;
    }
    a.actionAvailable = false;
    this.actionMode = 'attack';
    sfx('fire');
    this.addLog('roll', `${a.def.name} — ${a.def.spell.name} в землю (${d.toFixed(0)} м).`);
    const token = this.combatToken;
    this.spawnBoltTo(
      a.mesh.position.clone().add(new THREE.Vector3(0, 1.45, 0)),
      new THREE.Vector3(x, 0.4, z),
      0xffb050,
      () => {
        if (this.disposed || token !== this.combatToken) return;
        // Прямое попадание в бочку — детонация
        const hitBarrel = this.barrels.find((bb) => bb.alive && Math.hypot(bb.x - x, bb.z - z) < 0.9);
        if (hitBarrel) {
          this.addLog('fire', '🎯 Снаряд попадает в бочку!');
          sfx('fire');
          this.destroyBarrel(hitBarrel);
          if (this.phase === 'combat') this.scheduleAutoEnd();
          this.emit();
          return;
        }
        const t = tileOf(x, z);
        let ignited = this.igniteTile(t.i, t.j, 3);
        if (!ignited) {
          // Клетка перекрыта (бочка/препятствие) — пытаемся поджечь соседнюю
          for (const [di, dj] of DIRS8) {
            if (this.igniteTile(t.i + di, t.j + dj, 3)) {
              ignited = true;
              break;
            }
          }
        }
        if (ignited) {
          this.addLog('fire', '🔥 Лиара поджигает землю — трава вспыхивает!');
          sfx('fire');
        } else {
          this.addLog('info', 'Здесь нечему гореть.');
        }
        if (this.phase === 'combat') this.scheduleAutoEnd();
        this.emit();
      }
    );
    this.emit();
  }

  // ==================== ИИ ГОБЛИНОВ (Utility AI, v0.4) ====================

  private async runAI(a: Actor): Promise<void> {
    const token = this.combatToken;
    await sleep(650);
    if (this.disposed || token !== this.combatToken || this.phase !== 'combat') return;
    if (!a.alive || this.order[this.activeIdx] !== a.id) return;

    // Utility AI: оцениваем все варианты действия и выбираем лучший (v0.4)
    const opts = this.aiOptions(a);
    if (!opts.length) {
      this.endTurn();
      return;
    }
    opts.sort((x, y) => y.score - x.score);
    const top = opts.filter((o) => o.score >= opts[0].score - 0.35);
    const pick = top[Math.floor(Math.random() * top.length)];
    this.addLog('info', `🧠 ${a.def.name}: ${pick.desc}`);
    this.emit();
    try {
      await pick.run();
    } catch (err) {
      console.error('AI error:', err);
    }
    if (this.disposed || token !== this.combatToken || this.phase !== 'combat' || !a.alive) return;
    await sleep(250);
    if (this.disposed || token !== this.combatToken || this.phase !== 'combat') return;
    if (this.order[this.activeIdx] === a.id) this.endTurn();
  }

  /** Движение ИИ по маршруту A* с ожиданием завершения. */
  private async aiWalk(a: Actor, pts: THREE.Vector3[], token: number): Promise<void> {
    if (!pts.length) return;
    a.path = pts;
    a.moveTarget = pts[pts.length - 1].clone();
    a.threatZones = this.zonesOf(a);
    while ((a.path && a.path.length > 0) || a.moveTarget) {
      await sleep(90);
      if (this.disposed || token !== this.combatToken || this.phase !== 'combat' || !a.alive) return;
    }
  }

  /** Стрела-снаряд ИИ в точку (бочка) с колбэком попадания. */
  private async aiFireArrow(a: Actor, to: THREE.Vector3, token: number, onHit: () => void): Promise<void> {
    this.faceTowards(a, to);
    sfx('fire');
    await new Promise<void>((res) => {
      this.spawnBoltTo(a.mesh.position.clone().add(new THREE.Vector3(0, 1.35, 0)), to, 0xff6030, () => {
        onHit();
        res();
      });
    });
    if (this.disposed || token !== this.combatToken) return;
    this.emit();
    await sleep(500);
  }

  /** Огненная стрела по герою: бросок атаки + поджог земли под целью. */
  private async aiFireArrowAtActor(a: Actor, h: Actor, token: number): Promise<void> {
    const dis = this.hasStatus(a, 'poison') || this.hasStatus(a, 'fear');
    const r = rollD20(false, dis);
    const total = r + a.def.atkBonus;
    const hit = r === 20 || (r !== 1 && total >= h.def.ac);
    const pct = Math.round(hitChance(a.def.atkBonus, h.def.ac, false, dis) * 100);
    this.addLog('roll', `${a.def.name} — огненная стрела: d20 ${r} + ${a.def.atkBonus} = ${total} против КД ${h.def.ac} · шанс ${pct}%`);
    await this.aiFireArrow(a, h.mesh.position.clone().add(new THREE.Vector3(0, 1.05, 0)), token, () => {
      if (this.disposed || token !== this.combatToken) return;
      if (hit && h.alive) {
        this.applyDamage(a, h, r, true, [1, 6, 1], true);
        if (h.alive && Math.random() < 0.35) this.applyStatus(h, 'burning', 2);
      }
      // Поджог земли в точке попадания (даже промах втыкается в траву!)
      const t = tileOf(h.mesh.position.x, h.mesh.position.z);
      if (inGrid(t.i, t.j) && Math.random() < (hit ? 0.75 : 0.5)) {
        if (this.igniteTile(t.i, t.j, 3)) this.addLog('fire', `🔥 Трава под ${h.def.name} вспыхивает!`);
      }
      this.emit();
    });
  }

  /** Utility AI: оцениваем варианты действий (отход, выстрел по бочке, огненная стрела, атака, сближение). */
  private aiOptions(a: Actor): AIOption[] {
    const opts: AIOption[] = [];
    const heroes = this.actors.filter((x) => x.def.mode === 'ally' && x.alive);
    if (!heroes.length) return opts;
    const blocked = this.blockedFn();
    const start = tileOf(a.mesh.position.x, a.mesh.position.z);
    if (!inGrid(start.i, start.j)) return opts;
    const budget = Math.max(0, a.movementLeft - 0.05) / TILE;
    const reach = findReachable(blocked, start.i, start.j, budget);
    const nearestHeroDist = Math.min(...heroes.map((h) => this.dist(a, h)));
    const hpFrac = a.hp / a.def.maxHp;
    const token = this.combatToken;

    // --- Отход: подранки, испуганные и поджигатель держит дистанцию ---
    const wantFlee =
      (a.id !== 'dros' && hpFrac <= 0.34) ||
      this.hasStatus(a, 'fear') ||
      (a.id === 'gob3' && nearestHeroDist < 3.2);
    if (wantFlee) {
      let best: { i: number; j: number; s: number } | null = null;
      for (let j = 0; j < GRID_H; j++) {
        for (let i = 0; i < GRID_W; i++) {
          if (!isFinite(reach.cost[idx(i, j)])) continue;
          const c = tileCenter(i, j);
          let mind = Infinity;
          for (const h of heroes) {
            mind = Math.min(mind, Math.hypot(c.x - h.mesh.position.x, c.z - h.mesh.position.z));
          }
          const s = mind * 2 - reach.cost[idx(i, j)] * 0.1;
          if (!best || s > best.s) best = { i, j, s };
        }
      }
      if (best && (best.i !== start.i || best.j !== start.j)) {
        const pts = pathFromReach(reach, best.i, best.j).map((t) => {
          const c = tileCenter(t.i, t.j);
          return new THREE.Vector3(c.x, 0, c.z);
        });
        opts.push({
          score: 9 + (this.hasStatus(a, 'fear') ? 6 : 0) + (a.id === 'gob3' ? 2 : 0),
          desc: 'держит дистанцию (Отход)',
          run: async () => {
            if (a.actionAvailable) {
              a.actionAvailable = false;
              a.disengaged = true;
              this.addLog('info', `🛡 ${a.def.name} уходит из-под удара — провокации не страшны.`);
            }
            await this.aiWalk(a, pts, token);
          },
        });
      }
    }

    // --- Поджигатель: выстрел по взрывной бочке ---
    if (a.id === 'gob3' && a.actionAvailable) {
      for (const b of this.barrels) {
        if (!b.alive || b.type !== 'explosive') continue;
        const d = Math.hypot(b.x - a.mesh.position.x, b.z - a.mesh.position.z);
        if (d > 14) continue;
        if (!hasLOS(blocked, a.mesh.position.x, a.mesh.position.z, b.x, b.z)) continue;
        let hh = 0;
        let kills = 0;
        let aa = 0;
        for (const t of this.actors) {
          if (!t.alive || t.def.mode === 'neutral') continue;
          if (Math.hypot(t.mesh.position.x - b.x, t.mesh.position.z - b.z) <= 3.2) {
            if (t.def.mode === 'ally') {
              hh++;
              if (t.hp <= 9) kills++;
            } else aa++;
          }
        }
        const sc = hh === 0 ? 0 : 9 * hh + 7 * kills - 11 * aa;
        if (sc > 0.5) {
          const bb = b;
          opts.push({
            score: sc,
            desc: 'целится в огненную бочку!',
            run: async () => {
              a.actionAvailable = false;
              await this.aiFireArrow(a, new THREE.Vector3(bb.x, 0.45, bb.z), token, () => {
                if (this.disposed || token !== this.combatToken) return;
                this.destroyBarrel(bb);
                this.emit();
              });
            },
          });
        }
      }
    }

    // --- Поджигатель: огненная стрела по герою ---
    if (a.id === 'gob3' && a.actionAvailable) {
      for (const h of heroes) {
        const d = this.dist(a, h);
        if (d > 14) continue;
        if (!hasLOS(blocked, a.mesh.position.x, a.mesh.position.z, h.mesh.position.x, h.mesh.position.z)) continue;
        const p = hitChance(a.def.atkBonus, h.def.ac);
        const ht = tileOf(h.mesh.position.x, h.mesh.position.z);
        const onFuel = this.fuelAt(ht.i, ht.j) !== 'none' ? 2 : 0;
        const sc =
          5.5 * p + (1 - h.hp / h.def.maxHp) * 4 + (h.id === 'liara' ? 2 : 0) + onFuel - (nearestHeroDist < 3 ? 3 : 0);
        opts.push({
          score: sc,
          desc: `стреляет огненной стрелой в ${h.def.name}`,
          run: async () => {
            a.actionAvailable = false;
            await this.aiFireArrowAtActor(a, h, token);
          },
        });
      }
    }

    // --- Ближний бой: выбрать лучшую пару «цель + клетка подхода» ---
    if (a.def.range <= MELEE_RANGE + 0.05) {
      for (const h of heroes) {
        let best: { i: number; j: number; wd: number } | null = null;
        for (let j = 0; j < GRID_H; j++) {
          for (let i = 0; i < GRID_W; i++) {
            if (!isFinite(reach.cost[idx(i, j)])) continue;
            const c = tileCenter(i, j);
            const wd = Math.hypot(c.x - h.mesh.position.x, c.z - h.mesh.position.z);
            if (!best || wd < best.wd) best = { i, j, wd };
          }
        }
        if (!best) continue;
        const tiles = pathFromReach(reach, best.i, best.j);
        const pts = tiles.map((t) => {
          const c = tileCenter(t.i, t.j);
          return new THREE.Vector3(c.x, 0, c.z);
        });
        const p = hitChance(a.def.atkBonus, h.def.ac);
        const ed = 6.5 * p;
        let sc = ed + (h.hp <= ed + 1 ? 7 : 0) + (h.id === 'liara' ? 2.5 : 0) + (1 - h.hp / h.def.maxHp) * 3;
        if (pts.length) sc -= this.countProvokeSteps(a, [a.mesh.position.clone(), ...pts]) * 4.5;
        opts.push({
          score: sc,
          desc: `идёт в атаку на ${h.def.name}`,
          run: async () => {
            await this.aiWalk(a, pts, token);
            if (this.disposed || token !== this.combatToken || this.phase !== 'combat' || !a.alive) return;
            if (h.alive && this.dist(a, h) <= a.def.range + 0.25 && a.actionAvailable) {
              this.performAttack(a, h, false);
              await sleep(650);
            }
          },
        });
      }
    }

    // --- Сближение (если атака недостижима) ---
    {
      const tgt = heroes.reduce((m, h) => (this.dist(a, h) < this.dist(a, m) ? h : m), heroes[0]);
      let best: { i: number; j: number; wd: number } | null = null;
      for (let j = 0; j < GRID_H; j++) {
        for (let i = 0; i < GRID_W; i++) {
          if (!isFinite(reach.cost[idx(i, j)])) continue;
          const c = tileCenter(i, j);
          const wd = Math.hypot(c.x - tgt.mesh.position.x, c.z - tgt.mesh.position.z);
          if (!best || wd < best.wd) best = { i, j, wd };
        }
      }
      if (best && (best.i !== start.i || best.j !== start.j)) {
        const pts = pathFromReach(reach, best.i, best.j).map((t) => {
          const c = tileCenter(t.i, t.j);
          return new THREE.Vector3(c.x, 0, c.z);
        });
        opts.push({
          score: 0.5,
          desc: 'приближается, пригибаясь',
          run: async () => {
            await this.aiWalk(a, pts, token);
          },
        });
      }
    }

    return opts;
  }
}
