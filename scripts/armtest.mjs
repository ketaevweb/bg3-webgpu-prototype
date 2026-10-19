/* Изолированный тест: goblin + blink idle → рука должна опуститься. */
process.argv[2] = 'noop';
const bake = await import('/home/z/my-project/scripts/bake_synty.mjs');
const THREE = await import('three');

const rec = bake.ENEMIES.find((r) => r.out === 'goblin');
const model = bake.buildEnemy(rec);
const skinned = [];
model.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
const dstBones = skinned[0].skeleton.bones;
console.log('dst bones:', dstBones.length, 'model scale:', model.scale.x.toFixed(4));

const src = bake.animSource('blink32', 'Movement/Idle.fbx', 'Root_M');
const idle = src.animations.find((c) => c.name === 'human_male_idle_01');
const out = bake.retargetClipManual(model, dstBones, src, idle, bake.NAMES_BLINK, 'Root_M');
console.log('clip tracks:', out.tracks.length, 'dur', out.duration.toFixed(2));

/* применяем клип и меряем мир */
const mixer = new THREE.AnimationMixer(model);
mixer.clipAction(out).play();
mixer.update(0.5);
model.updateMatrixWorld(true);
const _v = new THREE.Vector3();
for (const n of ['Hips', 'Head', 'Shoulder_L', 'Elbow_L', 'Hand_L', 'Ankle_L']) {
  const b = model.getObjectByName(n);
  if (b) { b.getWorldPosition(_v); console.log(n, _v.x.toFixed(2), _v.y.toFixed(2), _v.z.toFixed(2)); }
}
