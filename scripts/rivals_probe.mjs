/* Зонд Fantasy Rivals FBX: меши, кости, анимационные тейки, материалы. */
import { readFileSync } from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

/* Node-шима: FBXLoader грузит текстуры через ImageLoader → нужен document */
THREE.ImageLoader.prototype.load = function (url, onLoad, onProgress, onError) {
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.SRGBColorSpace;
  setTimeout(() => onLoad?.(tex), 0);
  return tex;
};

const fbx = process.argv[2];
const buf = readFileSync(fbx);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const grp = new FBXLoader().parse(ab, '');
grp.updateMatrixWorld(true);

const meshes = [], bones = [];
grp.traverse((o) => {
  if (o.isMesh || o.isSkinnedMesh) meshes.push({ n: o.name, sk: !!o.isSkinnedMesh, mt: Array.isArray(o.material) ? o.material.map(m => m.name) : [o.material?.name], verts: o.geometry?.attributes?.position?.count });
  if (o.isBone) bones.push(o.name);
});

console.log('=== MESHES ===', meshes.length);
for (const m of meshes) console.log(` ${m.sk ? 'SKIN' : 'stat'} ${m.n} v=${m.verts} mat=${m.mt.join('|')}`);

console.log('=== BONES ===', bones.length);
console.log(bones.slice(0, 80).join(', '));

console.log('=== ANIM TAKES ===', (grp.animations ?? []).length);
for (const c of grp.animations ?? []) console.log(` ${c.name} dur=${c.duration.toFixed(2)}`);

/* группы верхнего уровня = персонажи */
console.log('=== TOP CHILDREN ===');
for (const ch of grp.children) {
  let sub = [];
  ch.traverse(o => { if (o.isMesh || o.isSkinnedMesh) sub.push(o.name); if (o.isBone) sub.push('🦴' + o.name); });
  console.log(` ${ch.name} (${ch.type}) children=${ch.children.length} meshes/bones=${sub.length}`);
}
