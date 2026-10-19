/* Уникальные имена костей одного скелета Synty-персонажа (по пути от Root до листа). */
import { readFileSync } from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

THREE.ImageLoader.prototype.load = function (url, onLoad) {
  const tex = new THREE.Texture();
  setTimeout(() => onLoad?.(tex), 0);
  return tex;
};

const fbx = process.argv[2];
const buf = readFileSync(fbx);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const grp = new FBXLoader().parse(ab, '');
grp.updateMatrixWorld(true);

/* первый Root-осколок: у каждого скелета свой Root */
const roots = [];
grp.traverse((o) => { if (o.isBone && o.name === 'Root' && o.parent?.type !== 'Bone') roots.push(o); });
const r = roots[0];
console.log('Скелет под Root#0 — путь до листа:');
let n = r;
let depth = 0;
while (n && depth < 30) {
  console.log(' '.repeat(depth * 2) + n.name);
  n = n.children.find((c) => c.isBone);
  depth++;
}
console.log('\nВсе имена костей скелета #0:');
const names = new Set();
r.traverse((o) => { if (o.isBone) names.add(o.name); });
console.log([...names].join(', '));
