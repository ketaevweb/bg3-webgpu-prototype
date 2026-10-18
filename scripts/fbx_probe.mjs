/* Анализ FBX: кости, клипы, in-place проверка (hips-трек).
   Запуск: node scripts/fbx_probe.mjs <file.fbx> [...more] */
import { readFileSync } from 'fs';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

for (const path of process.argv.slice(2)) {
  console.log('=== ' + path.split('/').slice(-2).join('/'));
  try {
    const buf = readFileSync(path);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const loader = new FBXLoader();
    const grp = loader.parse(ab, '');
    const bones = [];
    grp.traverse(o => { if (o.isBone) bones.push(o.name); });
    console.log('bones(' + bones.length + '):', bones.join(','));
    const sk = [];
    grp.traverse(o => { if (o.isSkinnedMesh) sk.push(o.name + ' bones=' + o.skeleton.bones.length); });
    console.log('skinned:', sk.join(' | ') || '(none)');
    for (const c of grp.animations) {
      const posTracks = c.tracks.filter(t => t.name.endsWith('.position'));
      let hipInfo = 'no pos tracks';
      if (posTracks.length) {
        hipInfo = posTracks.slice(0, 4).map(t => {
          let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
          for (let i = 0; i < t.values.length; i += 3)
            for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], t.values[i + k]); mx[k] = Math.max(mx[k], t.values[i + k]); }
          return t.name.split('.')[0] + ':x[' + mn[0].toFixed(1) + ',' + mx[0].toFixed(1) + ']y[' + mn[1].toFixed(1) + ',' + mx[1].toFixed(1) + ']z[' + mn[2].toFixed(1) + ',' + mx[2].toFixed(1) + ']';
        }).join(' ; ');
      }
      console.log('clip: "' + c.name + '" dur=' + c.duration.toFixed(2) + ' tracks=' + c.tracks.length + ' | ' + hipInfo);
    }
  } catch (e) {
    console.log('PARSE ERROR:', e.message);
  }
}
