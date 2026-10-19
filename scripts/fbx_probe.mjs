/* Probe Synty FBX: material names, UV ranges, vertex colors presence. */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/home/z/my-project/package.json');
const THREE = require('three');
/* node shim: FBXLoader may build TextureLoader for external texture refs */
if (!globalThis.document) globalThis.document = { createElementNS: () => {
  const img = { addEventListener(t, cb) { if (t === 'error') setTimeout(() => cb(new Event('error')), 0); }, removeEventListener() {} };
  let s = '';
  Object.defineProperty(img, 'src', { set(v) { s = v; setTimeout(() => img.onerror && img.onerror(new Event('error')), 0); }, get: () => s });
  return img;
} };
if (!globalThis.self) globalThis.self = globalThis;
const { FBXLoader } = require('three/examples/jsm/loaders/FBXLoader.js');

const DIR = '/home/z/my-project/public/models/nature/';
const files = process.argv.slice(2);

for (const f of files) {
  const p = DIR + f + '.fbx';
  if (!existsSync(p)) { console.log(f, 'MISSING'); continue; }
  try {
    const loader = new FBXLoader();
    const b = readFileSync(p);/* один read: buffer+byteOffset согласованы */
    const obj = loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
    obj.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry;
      const uv = g.attributes.uv;
      let uvr = '-';
      if (uv) {
        let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
        for (let i = 0; i < uv.count; i++) {
          minx = Math.min(minx, uv.getX(i)); maxx = Math.max(maxx, uv.getX(i));
          miny = Math.min(miny, uv.getY(i)); maxy = Math.max(maxy, uv.getY(i));
        }
        uvr = `uv[${minx.toFixed(2)}..${maxx.toFixed(2)},${miny.toFixed(2)}..${maxy.toFixed(2)}] n=${uv.count}`;
      }
      const vc = g.attributes.color ? `VC(${g.attributes.color.itemSize})` : 'noVC';
      const mats = Array.isArray(o.material) ? o.material.map(m => m.name) : [o.material.name];
      console.log(`${f} :: ${o.name} :: mats=[${mats.join('|')}] :: ${vc} :: ${uvr}`);
    });
  } catch (e) {
    console.log(f, 'ERROR', e.message);
  }
}
