/* Per-material UV ranges via geometry.groups (which palette swatch each slot samples). */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/home/z/my-project/package.json');
const THREE = require('three');
if (!globalThis.document) globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, set src(v) {}, get src() { return ''; } }) };
if (!globalThis.self) globalThis.self = globalThis;
const { FBXLoader } = require('three/examples/jsm/loaders/FBXLoader.js');
const { PNG } = (() => { try { return require('pngjs'); } catch { return {}; } })();

const DIR = '/home/z/my-project/public/models/nature/';
/* sample palette at (u,v) with three flipY=true convention */
let pal = null;
if (PNG) pal = PNG.sync.read(readFileSync(DIR + 'PolygonNature.png'));
function palColor(u, v) {
  if (!pal) return 'n/a';
  const x = Math.min(pal.width - 1, Math.floor(u * pal.width));
  const y = Math.min(pal.height - 1, Math.floor((1 - v) * pal.height));
  const i = (y * pal.width + x) * 4;
  return `(${pal.data[i]},${pal.data[i + 1]},${pal.data[i + 2]})`;
}

for (const f of process.argv.slice(2)) {
  const p = DIR + f + '.fbx';
  if (!existsSync(p)) { console.log(f, 'MISSING'); continue; }
  const loader = new FBXLoader();
  const b = readFileSync(p);
  const obj = loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  obj.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry;
    const uvs = Object.keys(g.attributes).filter(k => k.startsWith('uv'));
    if (!g.attributes.uv) return;
    console.log(`${f} :: UVsets=${uvs.join(',')} groups=${g.groups.length}`);
    const mats = Array.isArray(o.material) ? o.material.map(m => m.name) : [o.material.name];
    const groups = g.groups.length ? g.groups : [{ materialIndex: 0, start: 0, count: Infinity }];
    const seen = new Set();
    for (const gr of groups) {
      const mi = gr.materialIndex ?? 0;
      if (seen.has(mi)) continue;
      seen.add(mi);
      let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, n = 0;
      const end = gr.count === Infinity ? uv.count : Math.min(gr.start + gr.count, uv.count);
      for (let i = gr.start; i < end; i++) {
        minx = Math.min(minx, uv.getX(i)); maxx = Math.max(maxx, uv.getX(i));
        miny = Math.min(miny, uv.getY(i)); maxy = Math.max(maxy, uv.getY(i));
        n++;
      }
      const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
      console.log(`${f} :: mat[${mi}]="${mats[mi]}" n=${n} uv[${minx.toFixed(2)}..${maxx.toFixed(2)},${miny.toFixed(2)}..${maxy.toFixed(2)}] center=${palColor(cx, cy)}`);
    }
  });
}
