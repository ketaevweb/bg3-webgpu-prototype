/* Зонд источника анимации blink32 Idle.fbx: мировые позиции костей до/после клипа. */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const PKG = '/home/z/my-project/upload/extract/pkg';
function actualPath(pkg, pattern) {
  const out = execSync(
    `find ${PKG}/${pkg} -name pathname -exec grep -l -- "${pattern}" {} \\; | head -1 | xargs dirname`,
    { encoding: 'utf8' }).trim();
  return out + '/asset';
}
const path = actualPath('blink32', 'Movement/Idle.fbx');
const buf = readFileSync(path);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const grp = new FBXLoader().parse(ab, '');
grp.updateMatrixWorld(true);
console.log('takes:', grp.animations.map((c) => c.name));
const clip = grp.animations.find((c) => c.name === 'human_male_idle_01') ?? grp.animations[0];

const probe = (tag) => {
  grp.updateMatrixWorld(true);
  for (const n of ['Root_M', 'Hips', 'Head_M', 'Wrist_L', 'Wrist_R', 'Ankle_L', 'Ankle_R', 'Hip_L']) {
    const b = grp.getObjectByName(n);
    if (b) { const v = new THREE.Vector3(); b.getWorldPosition(v); console.log(tag, n, v.x.toFixed(1), v.y.toFixed(1), v.z.toFixed(1)); }
  }
};
probe('REST:');
const mixer = new THREE.AnimationMixer(grp);
mixer.clipAction(clip).play();
mixer.update(0.3);
probe('CLIP@0.3:');
/* рест-высота бёдер и поворот корня */
const root = grp.getObjectByName('Root_M');
console.log('Root_M rest quaternion:', root.quaternion.toArray().map((x) => x.toFixed(2)).join(','));
console.log('Root_M rest pos:', root.position.toArray().map((x) => x.toFixed(2)).join(','));
const top = grp.children[0];
console.log('top node:', top.name, top.type, 'pos:', top.position.toArray().map((x) => x.toFixed(1)).join(','), 'quat:', top.quaternion.toArray().map((x) => x.toFixed(2)).join(','));
