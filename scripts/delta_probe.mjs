/* Численный тест формулы ретаргета для Shoulder_L/Elbow_L. */
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
const buf = readFileSync(actualPath('blink32', 'Movement/Idle.fbx'));
const blink = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
blink.updateMatrixWorld(true);
const idle = blink.animations.find((c) => c.name === 'human_male_idle_01');
const tpose = blink.animations.find((c) => /^t-?pose$/i.test(c.name));
console.log('takes:', blink.animations.map((c) => c.name));

/* мировые кватернионы Shoulder_L в T-позе и в idle@0.5 */
const mT = new THREE.AnimationMixer(blink);
mT.clipAction(tpose).play(); mT.update(0);
blink.updateMatrixWorld(true);
const qTpose = blink.getObjectByName('Shoulder_L').getWorldQuaternion(new THREE.Quaternion());
const wTpose = blink.getObjectByName('Wrist_L').getWorldPosition(new THREE.Vector3());
console.log('T-pose  Wrist_L world:', wTpose.toArray().map((v) => v.toFixed(1)).join(','));

const mI = new THREE.AnimationMixer(blink);
mI.clipAction(idle).play(); mI.update(0.5);
blink.updateMatrixWorld(true);
const qIdle = blink.getObjectByName('Shoulder_L').getWorldQuaternion(new THREE.Quaternion());
const wIdle = blink.getObjectByName('Wrist_L').getWorldPosition(new THREE.Vector3());
console.log('idle@0.5 Wrist_L world:', wIdle.toArray().map((v) => v.toFixed(1)).join(','));

/* дельта = qTpose⁻¹ × qIdle — угол */
const delta = qTpose.clone().invert().multiply(qIdle);
const angle = 2 * Math.acos(Math.min(1, Math.abs(delta.w))) * 180 / Math.PI;
console.log('delta Shoulder_L angle (deg):', angle.toFixed(1), 'axis:', [delta.x, delta.y, delta.z].map((v) => v.toFixed(2)).join(','));
console.log('qTpose:', qTpose.toArray().map((v) => v.toFixed(2)).join(','));
console.log('qIdle :', qIdle.toArray().map((v) => v.toFixed(2)).join(','));
