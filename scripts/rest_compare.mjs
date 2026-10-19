/* Сравнение рест-мировых кватернионов: blink32 vs Synty-скелет. */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

THREE.ImageLoader.prototype.load = function (url, onLoad) {
  const tex = new THREE.Texture(); setTimeout(() => onLoad?.(tex), 0); return tex;
};

const PKG = '/home/z/my-project/upload/extract/pkg';
function actualPath(pkg, pattern) {
  const out = execSync(
    `find ${PKG}/${pkg} -name pathname -exec grep -l -- "${pattern}" {} \\; | head -1 | xargs dirname`,
    { encoding: 'utf8' }).trim();
  return out + '/asset';
}
function loadFBX(p) {
  const buf = readFileSync(p);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const grp = new FBXLoader().parse(ab, '');
  grp.updateMatrixWorld(true);
  return grp;
}

const blink = loadFBX(actualPath('blink32', 'Movement/Idle.fbx'));
const rivals = loadFBX('/home/z/my-project/public/models/synty/rivals/Characters_BR.fbx');

console.log('=== blink32: мировые кватернионы (REST) ===');
for (const n of ['Root_M', 'Spine1_M', 'Head_M', 'Shoulder_L', 'Elbow_L', 'Hip_L', 'Knee_L', 'Ankle_L']) {
  const b = blink.getObjectByName(n);
  if (!b) { console.log(n, 'NOT FOUND'); continue; }
  console.log(n.padEnd(12), 'pos', b.position.toArray().map((v) => v.toFixed(1)).join(','), 'quat', b.getWorldQuaternion(new THREE.Quaternion()).toArray().map((v) => v.toFixed(2)).join(','));
}
console.log('=== Synty Big_Ork: мировые кватернионы (REST) ===');
/* скелет Big_Ork: через его кости */
const mesh = rivals.getObjectByName('Character_Big_Ork_01');
mesh.skeleton.pose();
rivals.updateMatrixWorld(true);
for (const n of ['Root', 'Spine_01', 'Head', 'Shoulder_L', 'Elbow_L', 'UpperLeg_L', 'LowerLeg_L', 'Ankle_L']) {
  const b = mesh.skeleton.bones.find((x) => x.name === n);
  if (!b) { console.log(n, 'NOT FOUND'); continue; }
  console.log(n.padEnd(12), 'pos', b.position.toArray().map((v) => v.toFixed(1)).join(','), 'quat', b.getWorldQuaternion(new THREE.Quaternion()).toArray().map((v) => v.toFixed(2)).join(','));
}
console.log('=== Synty: цепочка предков UpperLeg_L ===');
let p = mesh.skeleton.bones.find((x) => x.name === 'UpperLeg_L');
while (p) { console.log(' ', p.name, p.type, 'quat', p.quaternion.toArray().map((v) => v.toFixed(2)).join(','), 'pos', p.position.toArray().map((v) => v.toFixed(1)).join(',')); p = p.parent; if (p && p.type !== 'Bone') { console.log('  ↑ non-bone:', p.name, p.type); break; } }
