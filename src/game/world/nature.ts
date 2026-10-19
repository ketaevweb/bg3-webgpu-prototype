/* ================= NATURE (v3.0 «Дикая чаща») =================
   Ассеты Synty POLYGON Nature Pack v1.09 (полный пак): FBX-модели
   (129 шт, все FBX 7400 — three-совместимые, урок v3.0: пакетные
   FBX-6.1 из старой выборки молча падали в «Unknown format» — горы,
   костёр, сундук, скелеты на живом сайте отсутствовали) + настоящая
   палитра PolygonNature.png (шейдер Synty: albedo = tex2D(UV0) —
   UV трав/листвы сходятся в точку-свотч, вертексные цвета — только
   маски ветра в юнитевом шейдере, в albedo не входят).
   Модели нормализуются один раз: центр XZ, низ на y=0; высота в
   метрах кэшируется — опция h ставит модель ЦЕЛЕВОЙ ВЫСОТОЙ, не
   угадывая масштаб. Кэш по имени: одна загрузка — много клонов.
   Лист по зависимостям: three, utils/constants, rng, state, renderer. */
import * as THREE from 'three/webgpu';
import { key, BASE } from '../utils';/* v2.9-фикс Pages: FBX без basePath давал 404 */
import { W } from '../constants';
import { srand } from '../rng';
import { solid } from '../state';
import { worldGroup } from '../render/renderer';
import { makeSwayMaterial } from '../render/wind';/* v3.0: качание листвы/травы */

const BASE_DIR = (BASE || '') + '/models/nature/';
const TEX_DIR = (BASE || '') + '/models/nature/tex/';/* v3.0: атласы листвы/стволов + текстуры земли */
const cache = new Map<string, Promise<THREE.Group>>();
const heights = new Map<string, number>();/* высота модели в метрах (после нормализации) */
const failed = new Set<string>();/* имена, не загрузившиеся (E2E: natureStats) */

/* v3.0: палитра Nature (стволы/пропсы/травы: albedo = tex2D(UV0) в свотч) */
let palette: THREE.Texture | null = null;
let paletteTried = false;
function ensurePalette(): void {
  if (paletteTried) return;
  paletteTried = true;
  try {
    const tex = new THREE.TextureLoader().load(
      BASE_DIR + 'PolygonNature.png',
      (t) => { t.colorSpace = THREE.SRGBColorSpace; },
      undefined,
      () => { palette = null;/* 404 → семантический фоллбек */ },
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    palette = tex;
  } catch { palette = null; }
}

/* v3.0: АТЛАСЫ листвы — настоящий _MainTexture из .мат пака (урок: слот
   _MainTex в .мат — мусорный; авторитетный — _MainTexture). Крона деревьев
   и листья кустов UV-маплены ПОД АТЛАС (диапазон 0..1), палитра для них
   даёт бурый месив — поэтому у листвы свой атлас по семейству модели. */
const atlasCache = new Map<string, THREE.Texture | null>();
function atlasTex(file: string): THREE.Texture | null {
  let t = atlasCache.get(file);
  if (t === undefined) {
    t = null;
    try {
      t = new THREE.TextureLoader().load(TEX_DIR + file, undefined, undefined, () => { atlasCache.set(file, null); });
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    } catch { t = null; }
  }
  return t;
}

/* семейство модели → атлас для слота: leaf (крона), trunk (ствол), whole (весь меш).
   Тинты — авторитетные _ColorTint из .мат пака (урок v3.0: атласы листвы —
   grayscale-маски, цвет даёт тинт материала: без него кроны белые простыни) */
const TINT: Record<string, number> = {
  'Leaves_Generic_Texture.png': 0xd3c979,/* Leaves_Base — оливково-хаки Synty */
  'Leaves_Willow_Texture.png': 0x737d30,/* Leaves_Willow */
  'Tree_Dead_Branch.png': 0x434343,/* Tree_Dead — тёмный серый */
};
const FAMILY: [RegExp, { leaf?: string; trunk?: string; whole?: string }][] = [
  [/pine|polypine/, { leaf: 'Leaves_Pine_Texture.png' }],/* запечённые цвета — белый тинт */
  [/willow/, { leaf: 'Leaves_Willow_Texture.png' }],
  [/tree_swamp/, { leaf: 'Leaves_Willow_Texture.png' }],/* болотные ивы */
  [/fern/, { whole: 'Fern_Texture.png' }],
  [/undergrowth/, { whole: 'Undergrowth_Texture.png' }],
  [/hedge|flowerbush/, { whole: 'FlowerBush_Texture.png' }],
  [/flowerpatch/, { whole: 'FlowerPatch_02.png' }],
  [/birch/, { leaf: 'Leaves_Generic_Texture.png', trunk: 'Birch_Trunk_Texture.png' }],
  [/dead|twig|branch/, { whole: 'Tree_Dead_Branch.png' }],
  [/tree_generic_giant|tree_generic_|tree_round|tree_tallround|tree_large/, { leaf: 'Leaves_Generic_Texture.png' }],
];
function familyOf(model: string): { leaf?: string; trunk?: string; whole?: string } {
  for (const [re, f] of FAMILY) if (re.test(model.toLowerCase())) return f;
  return {};
}

/* особые тинты поверх палитры (облака — бледно-голубой, как в .мат пака) */
function tintFor(name: string): number {
  if (/cloud/i.test(name)) return 0xd6f0f2;
  return 0xffffff;
}

/* v2.9: семантическая раскраска — фоллбек, если палитра не загрузилась */
const NATURE_COLOR: [RegExp, number][] = [
  [/trunk|bark|log|wood/i, 0x6b4a2e],
  [/leave|leaf/i, 0x3f7d33],
  [/dead/i, 0x7a7a4a],
  [/rock|stone|boulder|gravel|cave/i, 0x777a72],
  [/grass|plant|reed|fern|flower/i, 0x4e8a34],
  [/mushroom/i, 0x9a5a4a],
  [/terrain|mountain|cliff|dust|pile|rubble|pebble/i, 0x5f7a52],
  [/skull|bone|skeleton/i, 0xcfcabc],
  [/pillar|wall|brick|ruin/i, 0x8a8a80],
  [/bridge/i, 0x6b5238],
  [/chest|crate/i, 0x7a5a34],
  [/sign|post|road/i, 0x6b5238],
];
function natureColor(matName: string): number {
  for (const [re, c] of NATURE_COLOR) if (re.test(matName)) return c;
  return 0x8a8f7e;
}

/* v3.0: материалы листвы/растений, которым положено качаться */
const FOLIAGE_RE = /leave|leaf|grass|reed|fern|flower|plant|bush|vine|crop/i;

/* кэш wind-материалов: ключ amp|speed|цвет|текстура — клоны шарят инстанс */
const swayCache = new Map<string, THREE.Material>();
function swayMaterial(color: number, amp: number, speed: number, tex: THREE.Texture | null): THREE.Material {
  const k = amp + '|' + speed + '|' + color + '|' + (tex && tex.uuid || '');
  let m = swayCache.get(k);
  if (!m) { m = makeSwayMaterial({ map: tex, color }, { amp, speed }); swayCache.set(k, m); }
  return m;
}

async function loadNature(name: string): Promise<THREE.Group> {
  ensurePalette();
  let p = cache.get(name);
  if (!p) {
    p = (async () => {
      const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
      const loader = new FBXLoader();
      loader.setResourcePath(BASE_DIR);
      const obj = await loader.loadAsync(BASE_DIR + name + '.fbx');
      const fam = familyOf(name);/* атлас по семейству модели */
      /* материал → MeshStandardMaterial: листва — атлас (alphaTest+DoubleSide),
         остальное — палитра пака; вертексные цвета НЕ включаем (маски ветра) */
      obj.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const paint = (mm: THREE.MeshPhongMaterial | null): THREE.Material => {
          const nm = (mm && mm.name) || '';
          /* Leaves_Dead на живых деревьях — мёртвые ветки-кластеры (атлас веток) */
          const deadLeaf = /leaves?_dead|dead_leaf/i.test(nm);
          const file = deadLeaf ? 'Tree_Dead_Branch.png'
            : fam.whole ?? (/leave|leaf|plant|flower/i.test(nm) ? fam.leaf : /trunk|bark|branch|log|wood/i.test(nm) ? fam.trunk : undefined);
          const tex = file ? atlasTex(file) : palette;
          if (tex) {
            const tint = file ? (TINT[file] ?? 0xffffff) : tintFor(nm);
            return new THREE.MeshStandardMaterial({
              name: nm, map: tex, roughness: 1, color: tint,
              alphaTest: file ? 0.5 : 0, side: file ? THREE.DoubleSide : THREE.FrontSide,
            });
          }
          /* фоллбек: FBX-ссылка на текстуру или семантический цвет */
          const mp = mm && mm.map ? mm.map : null;
          if (mp) mp.colorSpace = THREE.SRGBColorSpace;
          return mp
            ? new THREE.MeshStandardMaterial({ name: nm, map: mp, roughness: 1 })
            : new THREE.MeshStandardMaterial({ name: nm, color: natureColor(nm), roughness: 1 });
        };
        if (Array.isArray(m.material)) m.material = m.material.map((mm) => paint(mm as THREE.MeshPhongMaterial));
        else m.material = paint(m.material as unknown as THREE.MeshPhongMaterial);
      });
      /* Synty FBX в сантиметрах (UnitScaleFactor=1) → метры ДО нормализации */
      obj.scale.setScalar(0.01);
      /* нормализация: центр XZ, низ на y=0 — клоны ставятся позицией */
      const box = new THREE.Box3().setFromObject(obj);
      const c = box.getCenter(new THREE.Vector3());
      obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;
      heights.set(name, Math.max(box.max.y - box.min.y, 0.01));/* v3.0: высота в метрах для опции h */
      const g = new THREE.Group();
      g.add(obj);
      return g;
    })();
    cache.set(name, p);
    p.catch(() => { cache.delete(name); failed.add(name); });/* ретрай после ошибки */
  }
  return p;
}

export interface NatureOpts {
  s?: number;        /* масштаб (после FBX-конверсии единиц) */
  h?: number;        /* v3.0: целевая высота в метрах (точнее, чем угадывать s) */
  ry?: number;       /* поворот вокруг Y (рад); без srand-разброса */
  spin?: boolean;    /* случайный разворот (декоративные леса/камни) */
  y?: number;        /* подъём над грунтом (мосты/навесы) */
  solid?: boolean;   /* добавить клетку в solid (преграда) */
  sway?: { amp?: number; speed?: number; all?: boolean }; /* v3.0: качание (all — всё растение) */
}

/* применить wind-материалы к листве клона (материалы шарятся по кэшу) */
function applySway(root: THREE.Object3D, sway: { amp?: number; speed?: number; all?: boolean } | undefined): void {
  if (!sway) return;
  const amp = sway.amp ?? 0.06, speed = sway.speed ?? 1.5;
  root.traverse(ch => {
    const m = ch as THREE.Mesh;
    if (!m.isMesh) return;
    const repl = (mat: THREE.Material): THREE.Material => {
      const ok = sway.all || FOLIAGE_RE.test(mat.name || '');
      if (!ok) return mat;
      const std = mat as THREE.MeshStandardMaterial;
      const col = std.color;
      return swayMaterial(col ? col.getHex() : 0xffffff, amp, speed, std.map ?? null);
    };
    if (Array.isArray(m.material)) m.material = m.material.map(repl);
    else m.material = repl(m.material);
  });
}

function place(m: THREE.Group, name: string, x: number, z: number, o: NatureOpts): void {
  const hm = heights.get(name);
  const s = (o.h && hm) ? o.h / hm : (o.s ?? 1);
  m.scale.setScalar(s);
  m.rotation.y = o.spin ? srand() * 6.28 : (o.ry ?? 0);
  m.position.set(W(x), o.y ?? 0, W(z));
  m.traverse(ch => { ch.castShadow = true; ch.receiveShadow = true; });
  worldGroup.add(m);
}

/* поставить модель POLYGON в мировые координаты сетки (x,z) */
export function placeNature(name: string, x: number, z: number, o: NatureOpts = {}): void {
  if (o.solid) solid.add(key(x, z));
  void loadNature(name).then(g => {
    const m = g.clone(true);
    applySway(m, o.sway);
    place(m, name, x, z, o);
  });
}

/* поставить модель и вернуть хэндл (для интерактивных мешей, сундук) */
export function placeNatureSync(name: string, x: number, z: number, o: NatureOpts = {}): Promise<THREE.Group> {
  return loadNature(name).then(g => {
    const m = g.clone(true);
    applySway(m, o.sway);
    place(m, name, x, z, o);
    return m;
  });
}

/* ================= НАБОРЫ v3.0 («Дикая чаща») ================= */

/* случайная сосна перевала: 3 варианта, 5-7м → игровые 2.3-4.2м */
export function placePine(x: number, z: number): void {
  const pick = ['SM_Tree_PolyPine_01', 'SM_Tree_PolyPine_02', 'SM_Tree_Pine_01'];
  placeNature(pick[Math.floor(srand() * pick.length)], x, z, { s: 0.42 + srand() * 0.25, spin: true, sway: { amp: 0.03, speed: 1.1 } });
}
/* сухостой перевала */
export function placeDeadPine(x: number, z: number): void {
  placeNature('SM_Tree_Pine_Dead_01', x, z, { s: 0.5 + srand() * 0.25, spin: true });
}
/* валун-преграда (solid); v2.9: кластеры уменьшены — не заливают кадр */
export function placeBoulder(x: number, z: number, s = 1.0): void {
  placeNature(srand() < 0.5 ? 'SM_Rock_Boulder_01' : 'SM_Rock_Cluster_Large_01', x, z, { s: Math.min(s, 1.0) * 0.45, solid: true, spin: true });
}

/* v3.0: лесное дерево — полный набор пака, целевая высота в метрах */
export function placeForestTree(x: number, z: number): void {
  const roll = srand();
  if (roll < 0.30) placeNature('SM_Tree_Generic_Giant_01', x, z, { h: 4.2 + srand() * 1.8, spin: true, sway: { amp: 0.035, speed: 1.0 } });
  else if (roll < 0.48) placeNature('SM_Tree_Round_0' + (1 + Math.floor(srand() * 5)), x, z, { h: 2.6 + srand() * 1.2, spin: true, sway: { amp: 0.04, speed: 1.2 } });
  else if (roll < 0.60) placeNature('SM_Tree_Birch_0' + (1 + Math.floor(srand() * 4)), x, z, { h: 2.8 + srand() * 1.2, spin: true, sway: { amp: 0.045, speed: 1.4 } });
  else if (roll < 0.70) placeNature(srand() < 0.5 ? 'SM_Tree_Willow_Medium_01' : 'SM_Tree_Willow_Small_01', x, z, { h: 3.0 + srand() * 1.0, spin: true, sway: { amp: 0.05, speed: 1.3 } });
  else if (roll < 0.80) placeNature('SM_Tree_Generic_01', x, z, { h: 3.2 + srand() * 1.2, spin: true, sway: { amp: 0.04, speed: 1.1 } });
  else if (roll < 0.88) placeNature('SM_Tree_TallRound_01', x, z, { h: 3.8 + srand() * 1.2, spin: true, sway: { amp: 0.035, speed: 1.0 } });
  else if (roll < 0.94) placeNature('SM_Tree_Pine_02', x, z, { h: 3.4 + srand() * 1.2, spin: true, sway: { amp: 0.03, speed: 1.1 } });
  else placeNature(srand() < 0.5 ? 'SM_Tree_Generic_Dead_01' : 'SM_Tree_Birch_Dead_01', x, z, { h: 2.8 + srand() * 1.0, spin: true });
}

/* v3.0: болотное дерево — ивы с кронами читаются лучше голых трухляков */
export function placeSwampTree(x: number, z: number): void {
  const roll = srand();
  if (roll < 0.46) placeNature(srand() < 0.6 ? 'SM_Tree_Willow_Large_01' : 'SM_Tree_Willow_Medium_01', x, z, { h: 3.2 + srand() * 1.4, spin: true, sway: { amp: 0.04, speed: 1.2 } });
  else if (roll < 0.66) placeNature('SM_Tree_Dead_0' + (1 + Math.floor(srand() * 3)), x, z, { h: 2.8 + srand() * 1.0, spin: true });
  else if (roll < 0.82) placeNature(srand() < 0.5 ? 'SM_Tree_Swamp_Stump_01' : 'SM_Tree_Swamp_Stump_02', x, z, { h: 1.0 + srand() * 0.6, spin: true });
  else placeNature(srand() < 0.5 ? 'SM_Swamp_Root_01' : 'SM_Swamp_Root_02', x, z, { h: 0.7 + srand() * 0.5, spin: true });
}

/* v3.0: настоящий камень пака (лес/болота — вместо додекаэдра) */
export function placeRockModel(x: number, z: number, s = 1): void {
  const roll = srand();
  const name = roll < 0.40 ? 'SM_Rock_0' + (1 + Math.floor(srand() * 4))
    : roll < 0.55 ? 'SM_Rock_Rounded_01'
    : roll < 0.75 ? 'SM_Rock_Pile_0' + (1 + Math.floor(srand() * 5))
    : 'SM_Rock_Small_0' + (1 + Math.floor(srand() * 2));
  placeNature(name, x, z, { s: s * (0.55 + srand() * 0.35), spin: true });
}

/* v3.0: растение подземного яруса — трава/папоротник/цветы/куст (качается целиком) */
export function placePlant(x: number, z: number, s = 1, lush = true): void {
  const roll = srand();
  if (roll < 0.52) placeNature('SM_Plant_Grass_0' + (2 + Math.floor(srand() * 4)), x, z, { s: s * (0.5 + srand() * 0.35), spin: true, sway: { amp: lush ? 0.075 : 0.05, speed: lush ? 1.6 : 1.9, all: true } });
  else if (roll < 0.70) placeNature('SM_Plant_Fern_0' + (1 + Math.floor(srand() * 3)), x, z, { s: s * (0.45 + srand() * 0.3), spin: true, sway: { amp: lush ? 0.06 : 0.045, speed: 1.5, all: true } });
  else if (roll < 0.78) placeNature('SM_Plant_Undergrowth_01', x, z, { s: s * (0.5 + srand() * 0.3), spin: true, sway: { amp: 0.06, speed: 1.5, all: true } });
  else if (roll < 0.87) placeNature(srand() < 0.5 ? 'SM_Plant_Flowers_01' : 'SM_Plant_FlowerPatch_01', x, z, { s: s * (0.3 + srand() * 0.2), spin: true, sway: { amp: 0.05, speed: 1.7, all: true } });/* v3.0: цветы реже/мельче — белые пятна не шумят */
  else placeNature('SM_Plant_Bush_Leaves_0' + (1 + Math.floor(srand() * 3)), x, z, { s: s * (0.4 + srand() * 0.3), spin: true, sway: { amp: 0.05, speed: 1.4, all: true } });
}

/* v3.0: камыш пака (болота) — вместо конусов */
export function placeReed(x: number, z: number): void {
  placeNature(srand() < 0.5 ? 'SM_Plant_Reeds_01' : 'SM_Plant_Reeds_02', x, z, { s: 0.55 + srand() * 0.35, spin: true, sway: { amp: 0.1, speed: 2.3, all: true } });
}

/* v3.0: кувшинка на воде болот */
export function placeLillypad(x: number, z: number, y = 0.03): void {
  placeNature(srand() < 0.7 ? 'SM_Plant_Lillypad_Large_0' + (1 + Math.floor(srand() * 3)) : 'SM_Plant_Lillypad_Small_01', x, z, { s: 0.5 + srand() * 0.35, spin: true, y });
}

/* v3.0: гриб-свисток у деревьев (декор) */
export function placeMushroom(x: number, z: number): void {
  placeNature('SM_Plant_Mushrooms_0' + (1 + Math.floor(srand() * 6)), x, z, { s: 0.3 + srand() * 0.3, spin: true });
}

/* v3.0: куст (границы арены, декор без преграды) */
export function placeBush(x: number, z: number): void {
  placeNature('SM_Plant_Bush_0' + (1 + Math.floor(srand() * 3)), x, z, { s: 0.5 + srand() * 0.35, spin: true, sway: { amp: 0.05, speed: 1.3, all: true } });
}

/* статистика для E2E (natureStats): сколько моделей в кэше и кто упал */
export function natureStats(): { cached: number; failed: string[] } {
  return { cached: cache.size, failed: [...failed] };
}
