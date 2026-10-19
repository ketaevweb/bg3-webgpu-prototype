/* Изолированный тест ретаргета одного кадра: руки должны опуститься как в источнике. */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

THREE.ImageLoader.prototype.load = function (url, onLoad) {
  const tex = new THREE.Texture(); setTimeout(() => onLoad?.(tex), 0); return tex;
};
const PKG = '/home/z/my-project/upload/extract/pkg';
function actualPath(pkg, pattern) {
  const out = execSync(`find ${PKG}/${pkg} -name pathname -exec grep -l -- "${pattern}" {} \\; | head -1 | xargs dirname`, { encoding: 'utf8' }).trim();
  return out + '/asset';
}
const blink = new FBXLoader().parse(readFileSync(actualPath('blink32', 'Movement/Idle.fbx')).buffer.slice(0), '');
blink.updateMatrixWorld(true);
const clip = blink.animations.find((c) => c.name === 'human_male_idle_01');

/* состояние источника при t=0.5 */
const mixer = new THREE.AnimationMixer(blink);
mixer.clipAction(clip).play();
mixer.update(0.5);
blink.updateMatrixWorld(true);
for (const n of ['Wrist_L', 'Elbow_L', 'Shoulder_L']) {
  const b = blink.getObjectByName(n);
  const v = new THREE.Vector3(); b.getWorldPosition(v);
  console.log('SRC anim', n, v.x.toFixed(1), v.y.toFixed(1), v.z.toFixed(1));
}
/* рест после сброса */
const m2 = new THREE.AnimationMixer(blink);
m2.stopAllAction();
/* восстановить рест вручную нельзя без снимка — сравним с новой загрузкой */
const blink2 = new FBXLoader().parse(readFileSync(actualPath('blink32', 'Movement/Idle.fbx')).buffer.slice(0), '');
blink2.updateMatrixWorld(true);
for (const n of ['Wrist_L', 'Elbow_L', 'Shoulder_L']) {
  const b = blink2.getObjectByName(n);
  const v = new THREE.Vector3(); b.getWorldPosition(v);
  console.log('SRC rest', n, v.x.toFixed(1), v.y.toFixed(1), v.z.toFixed(1));
}
