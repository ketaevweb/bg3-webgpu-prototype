import { readFileSync } from 'fs';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
for (const p of process.argv.slice(2)) {
  const buf = readFileSync(p);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const grp = new FBXLoader().parse(ab, '');
  grp.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      console.log(p.split('/').pop(), '| mesh:', o.name, '| mat:', m.name, '| map:', m.map ? (m.map.sourceFile || m.map.name || '(embedded)') : 'NULL', '| color:', m.color ? m.color.getHexString() : '-');
    }
  });
}
