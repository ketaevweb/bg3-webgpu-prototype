/* ============================================================
 * v3.0 «Дикая чаща» — ОБЛАКА-МЕШИ: модели SM_Prop_Cloud_01..03
 * из POLYGON Nature Pack вместо плоских спрайтов. ЛИСТ-модуль:
 * только three + utils(BASE) + FBXLoader; группу передаёт sky.ts —
 * циклов с renderer нет (sky → clouds, clouds никого из игры).
 * Палитра Nature грузится своей копией (nature.ts не импортируем —
 * он тянет renderer/worldGroup). Фоллбек: null — sky оставит спрайты.
 * ============================================================ */
import * as THREE from 'three/webgpu';
import { BASE } from '../utils';

const DIR = (BASE || '') + '/models/nature/';
const cache = new Map<string, Promise<THREE.Group | null>>();

async function loadCloud(name: string): Promise<THREE.Group | null> {
  let p = cache.get(name);
  if (!p) {
    p = (async () => {
      try {
        const { FBXLoader } = await import('three/addons/loaders/FBXLoader.js');
        const loader = new FBXLoader();
        loader.setResourcePath(DIR);
        const obj = await loader.loadAsync(DIR + name + '.fbx');
        const tex = new THREE.TextureLoader().load(DIR + 'PolygonNature.png');
        tex.colorSpace = THREE.SRGBColorSpace;
        obj.traverse(o => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = false; m.receiveShadow = false;
          m.material = new THREE.MeshStandardMaterial({
            map: tex, color: 0xd6f0f2,/* бледно-голубой тинт (как в .мат пака) */
            roughness: 1, fog: false,/* облака не тонут в тумане — как спрайты v2.9 */
          });
        });
        obj.scale.setScalar(0.01);/* Synty FBX в сантиметрах */
        const box = new THREE.Box3().setFromObject(obj);
        const c = box.getCenter(new THREE.Vector3());
        obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;
        const g = new THREE.Group();
        g.add(obj);
        return g;
      } catch (e) {
        console.warn('[bg3] cloud load fail:', name, (e as Error).message);
        cache.delete(name);/* не кэшируем провал — ретрай при следующем запросе */
        return null;/* фоллбек: спрайты v2.9 */
      }
    })();
    cache.set(name, p);
  }
  return p;
}

/** загрузить три варианта облаков; null — если пак недоступен (фоллбек).
    Ретраи ×3 с паузой — гонка старта против перекомпиляции/HMR (урок v3.0). */
export async function loadCloudVariants(): Promise<Array<THREE.Group> | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const out: Array<THREE.Group> = [];
    for (const n of ['SM_Prop_Cloud_01', 'SM_Prop_Cloud_02', 'SM_Prop_Cloud_03']) {
      const g = await loadCloud(n);
      if (!g) break;
      out.push(g);
    }
    if (out.length === 3) return out;
    await new Promise((r) => setTimeout(r, 1200));
  }
  return null;
}
