/* Тест героя: почему idle не применяется? */
process.argv[2] = 'noop';
const bake = await import('/home/z/my-project/scripts/bake_synty.mjs');
const THREE = await import('three');

const rec = bake.HEROES.find((r) => r.out === 'fighter');
const model = bake.buildHero(rec);
const skinned = [];
model.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
const boneSet = new Set();
for (const sm of skinned) for (const b of sm.skeleton.bones) boneSet.add(b);
const dstBones = [...boneSet];
console.log('dst bones:', dstBones.length, 'parts:', skinned.length);

const src = bake.animSource('blink32', 'Movement/Idle.fbx', 'Root_M');
const idle = src.animations.find((c) => c.name === 'human_male_idle_01');
const out = bake.retargetClipManual(model, dstBones, src, idle, bake.NAMES_BLINK, 'Root_M');
console.log('tracks:', out.tracks.length);
for (const t of out.tracks.slice(0, 4)) console.log(' ', t.name);

const mixer = new THREE.AnimationMixer(model);
mixer.clipAction(out).play();
mixer.update(0.5);
model.updateMatrixWorld(true);
const _v = new THREE.Vector3();
for (const n of ['Hips', 'Head', 'Shoulder_L', 'Hand_L', 'Ankle_L']) {
  const b = model.getObjectByName(n);
  if (b) { b.getWorldPosition(_v); console.log(n, _v.x.toFixed(2), _v.y.toFixed(2), _v.z.toFixed(2)); }
}
