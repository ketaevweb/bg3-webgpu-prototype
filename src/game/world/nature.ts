/* ================= NATURE (v1.6 «Перевал великанов») =================
   Загрузчик ассетов Synty POLYGON Nature (FBX + общий палитровый атлас
   public/models/nature/PolygonNature.png). Модели нормализуются один раз:
   центрирование XZ, постановка на грунт (min.y=0), материалы →
   MeshStandardMaterial с sRGB-атласом (FBX-ссылки на текстуры бьются в
   имя файла — resourcePath указывает на каталог моделей).
   Кэш по имени: одна загрузка — много клонов (clone() шарит геометрию).
   Лист по зависимостям: three, utils/constants, rng, renderer (сцена). */
import * as THREE from 'three/webgpu';
import { key } from '../utils';
import { BASE } from '../utils';/* v2.9-фикс Pages: FBX без basePath давал 404 (жил с v1.6 на перевале) */
import { W } from '../constants';
import { srand } from '../rng';
import { solid } from '../state';
import { worldGroup } from '../render/renderer';

const BASE_DIR = (BASE || '') + '/models/nature/';
const cache = new Map<string, Promise<THREE.Group>>();

/* v2.9: FBX-материалы не несут ссылок на атлас (probe: map NULL) — раньше все
   модели рендерились фоллбек-серым. Красим по СЕМАНТИКЕ имени материала
   (Trunk/Leave/Leaves_Dead/Rock/Terrain…) — чистый low-poly стиль Synty. */
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

async function loadNature(name: string): Promise<THREE.Group> {
  let p = cache.get(name);
  if (!p) {
    p = (async () => {
      const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
      const loader = new FBXLoader();
      loader.setResourcePath(BASE_DIR);
      const obj = await loader.loadAsync(BASE_DIR + name + '.fbx');
      /* материал → MeshStandardMaterial с атласом (Phong из FBX не нужен) */
      obj.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true; m.receiveShadow = true;
        const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshPhongMaterial | null;
        const map = src && src.map ? src.map : null;
        if (map) map.colorSpace = THREE.SRGBColorSpace;
        /* map передаём только если есть — иначе warning «parameter map undefined»;
           v2.9: без атласа — семантический цвет по имени материала FBX;
           массив материалов (Trunk+Leave) сохраняем поэлементно — иначе крона
           красится цветом первого материала */
        const paint = (mm: THREE.MeshPhongMaterial | null) => {
          const mp = mm && mm.map ? mm.map : null;
          if (mp) mp.colorSpace = THREE.SRGBColorSpace;
          return mp
            ? new THREE.MeshStandardMaterial({ map: mp, roughness: 1 })
            : new THREE.MeshStandardMaterial({ color: natureColor((mm && mm.name) || ''), roughness: 1 });
        };
        if (Array.isArray(m.material)) m.material = m.material.map((mm) => paint(mm as THREE.MeshPhongMaterial));
        else m.material = paint(m.material as unknown as THREE.MeshPhongMaterial);
      });
      /* v1.6-фикс E2E: Synty FBX в сантиметрах (UnitScaleFactor=1) —
        приводим к метрам ДО нормализации, чтобы s-опции были метричными */
      obj.scale.setScalar(0.01);
      /* нормализация: центр XZ, низ на y=0 — клоны ставятся позицией */
      const box = new THREE.Box3().setFromObject(obj);
      const c = box.getCenter(new THREE.Vector3());
      obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;
      const g = new THREE.Group();
      g.add(obj);
      return g;
    })();
    cache.set(name, p);
    p.catch(() => { cache.delete(name); }); /* ретрай после ошибки */
  }
  return p;
}

export interface NatureOpts {
  s?: number;        /* масштаб (после FBX-конверсии единиц) */
  ry?: number;       /* поворот вокруг Y (рад); без srand-разброса */
  spin?: boolean;    /* случайный разворот (декоративные леса/камни) */
  y?: number;        /* подъём над грунтом (мосты/навесы) */
  solid?: boolean;   /* добавить клетку в solid (преграда) */
}

/* поставить модель POLYGON в мировые координаты сетки (x,z) */
export function placeNature(name: string, x: number, z: number, o: NatureOpts = {}): void {
  if (o.solid) solid.add(key(x, z));
  void loadNature(name).then(g => {
    const m = g.clone(true);
    const s = o.s ?? 1;
    m.scale.setScalar(s);
    m.rotation.y = o.spin ? srand() * 6.28 : (o.ry ?? 0);
    m.position.set(W(x), o.y ?? 0, W(z));
    m.traverse(ch => { ch.castShadow = true; ch.receiveShadow = true; });
    worldGroup.add(m);
  });
}

/* поставить модель и вернуть хэндл (для интерактивных мешей, сундук) */
export function placeNatureSync(name: string, x: number, z: number, o: NatureOpts = {}): Promise<THREE.Group> {
  return loadNature(name).then(g => {
    const m = g.clone(true);
    const s = o.s ?? 1;
    m.scale.setScalar(s);
    m.rotation.y = o.spin ? srand() * 6.28 : (o.ry ?? 0);
    m.position.set(W(x), o.y ?? 0, W(z));
    m.traverse(ch => { ch.castShadow = true; ch.receiveShadow = true; });
    worldGroup.add(m);
    return m;
  });
}

/* случайная сосна перевала: 3 варианта; в метрах сосна ~5-7м —
   сжимаем до игровых деревьев (2.3-4.2м) */
export function placePine(x: number, z: number): void {
  const pick = ['SM_Tree_PolyPine_01', 'SM_Tree_PolyPine_02', 'SM_Tree_Pine_01'];
  placeNature(pick[Math.floor(srand() * pick.length)], x, z, { s: 0.42 + srand() * 0.25, spin: true });
}
/* сухостой перевала */
export function placeDeadPine(x: number, z: number): void {
  placeNature('SM_Tree_Pine_Dead_01', x, z, { s: 0.5 + srand() * 0.25, spin: true });
}
/* валун-преграда (solid); v2.9: кластеры крупного камня уменьшены —
   с орбиты камеры не заливают кадр */
export function placeBoulder(x: number, z: number, s = 1.0): void {
  placeNature(srand() < 0.5 ? 'SM_Rock_Boulder_01' : 'SM_Rock_Cluster_Large_01', x, z, { s: Math.min(s, 1.0) * 0.45, solid: true, spin: true });
}
