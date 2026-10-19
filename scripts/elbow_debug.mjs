/* Диагностика локтя: оси дельт и направления дочерних костей. */
process.argv[2] = 'noop';
const bake = await import('/home/z/my-project/scripts/bake_synty.mjs');
const THREE = await import('three');
const Q = THREE.Quaternion, V = THREE.Vector3;

const rec = bake.HEROES.find((r) => r.out === 'fighter');
const model = bake.buildHero(rec);
const skinned = [];
model.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
const boneSet = new Set();
for (const sm of skinned) for (const b of sm.skeleton.bones) boneSet.add(b);
const dstBones = [...boneSet];

const src = bake.animSource('blink32', 'Movement/Idle.fbx', 'Root_M');
const idle = src.animations.find((c) => c.name === 'human_male_idle_01');

/* ДО ретаргета: рест-миры цели + направления детей */
model.updateMatrixWorld(true);
const dstRestW = new Map(), childDir = new Map();
for (const b of dstBones) {
  dstRestW.set(b.name, b.getWorldQuaternion(new Q()));
  const ch = b.children.find((c) => c.isBone);
  if (ch) {
    const d = ch.getWorldPosition(new V()).sub(b.getWorldPosition(new V())).normalize();
    childDir.set(b.name, d);
  }
}
const out = bake.retargetClipManual(model, dstBones, src, idle, bake.NAMES_BLINK, 'Root_M', 'world-delta');
const mixer = new THREE.AnimationMixer(model);
mixer.clipAction(out).play();
mixer.update(0.5);
model.updateMatrixWorld(true);

/* источник: мир в idle */
src.updateMatrixWorld(true);
console.log('=== Сравнение направлений детей (мир) ===');
for (const n of ['Shoulder_L', 'Elbow_L']) {
  const sb = src.getObjectByName(n);
  const sch = sb.children.find((c) => c.isBone);
  if (sch) {
    const d = sch.getWorldPosition(new V()).sub(sb.getWorldPosition(new V())).normalize();
    console.log('SRC', n, 'childDir idle:', d.toArray().map((v) => v.toFixed(2)).join(','));
  }
  const db = model.getObjectByName(n);
  const dch = db.children.find((c) => c.isBone);
  if (dch) {
    const d = dch.getWorldPosition(new V()).sub(db.getWorldPosition(new V())).normalize();
    console.log('DST', n, 'childDir after:', d.toArray().map((v) => v.toFixed(2)).join(','), '| rest:', childDir.get(n)?.toArray().map((v) => v.toFixed(2)).join(','));
  }
}
/* дельты мира источника для Elbow_L */
const mT = new THREE.AnimationMixer(src);
const tpose = src.animations.find((c) => /^t-?pose$/i.test(c.name));
mT.clipAction(tpose).play(); mT.update(0);
src.updateMatrixWorld(true);
const srcRestElbow = src.getObjectByName('Elbow_L').getWorldQuaternion(new Q());
const srcRestHand = src.getObjectByName('Wrist_L').getWorldPosition(new V());
const srcRestShoulder = src.getObjectByName('Shoulder_L').getWorldPosition(new V());
console.log('SRC tpose forearm dir:', srcRestHand.sub(srcRestShoulder).normalize().toArray().map((v) => v.toFixed(2)).join(','));
const mI = new THREE.AnimationMixer(src);
mI.clipAction(idle).play(); mI.update(0.5);
src.updateMatrixWorld(true);
const srcIdleElbow = src.getObjectByName('Elbow_L').getWorldQuaternion(new Q());
const delta = srcRestElbow.clone().invert().multiply(srcIdleElbow);
const ang = 2 * Math.acos(Math.min(1, Math.abs(delta.w))) * 180 / Math.PI;
console.log('SRC Elbow_L world delta angle:', ang.toFixed(1), 'axis:', [delta.x, delta.y, delta.z].map((v) => v.toFixed(2)).join(','));
const idleHand = src.getObjectByName('Wrist_L').getWorldPosition(new V());
const idleShoulder = src.getObjectByName('Shoulder_L').getWorldPosition(new V());
console.log('SRC idle forearm dir:', idleHand.sub(idleShoulder).normalize().toArray().map((v) => v.toFixed(2)).join(','));
