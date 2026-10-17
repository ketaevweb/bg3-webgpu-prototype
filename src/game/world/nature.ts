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
import { W } from '../constants';
import { srand } from '../rng';
import { solid } from '../state';
import { worldGroup } from '../render/renderer';

const BASE = '/models/nature/';
const cache = new Map<string, Promise<THREE.Group>>();

async function loadNature(name: string): Promise<THREE.Group> {
  let p = cache.get(name);
  if (!p) {
    p = (async () => {
      const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
      const loader = new FBXLoader();
      loader.setResourcePath(BASE);
      const obj = await loader.loadAsync(BASE + name + '.fbx');
      /* материал → MeshStandardMaterial с атласом (Phong из FBX не нужен) */
      obj.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true; m.receiveShadow = true;
        const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshPhongMaterial | null;
        const map = src && src.map ? src.map : null;
        if (map) map.colorSpace = THREE.SRGBColorSpace;
        /* map передаём только если есть — иначе warning «parameter map undefined» */
        const mat = map
          ? new THREE.MeshStandardMaterial({ map, roughness: 1 })
          : new THREE.MeshStandardMaterial({ color: 0x8a8f7e, roughness: 1 });
        m.material = mat;
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
/* валун-преграда (solid); в метрах ~1.2-2м */
export function placeBoulder(x: number, z: number, s = 1.0): void {
  placeNature(srand() < 0.5 ? 'SM_Rock_Boulder_01' : 'SM_Rock_Cluster_Large_01', x, z, { s, solid: true, spin: true });
}
