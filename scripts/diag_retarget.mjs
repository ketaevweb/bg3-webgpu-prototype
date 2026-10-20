/* Диагноз ретаргета: источник blink32 idle → куда уходят руки у hero/goblin. */
import { retargetClipManual, buildEnemy, buildHero, animSource, ENEMIES, HEROES, NAMES_BLINK } from './bake_synty.mjs';
import * as THREE from 'three';

const dyOf = (root, sh, wr) => {
  const s = root.getObjectByName(sh), w = root.getObjectByName(wr);
  if (!s || !w) return null;
  root.updateMatrixWorld(true);
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  s.getWorldPosition(a); w.getWorldPosition(b);
  return { dy: +(b.y - a.y).toFixed(3), len: +a.distanceTo(b).toFixed(3) };
};
const dump = (title, root, armSh, armWr) => {
  const r = dyOf(root, armSh, armWr);
  console.log(title, JSON.stringify(r));
};

/* --- источник --- */
const src = animSource('blink32', 'Movement/Idle.fbx', 'Root_M');
console.log('blink32: anims=', src.animations.map((a) => a.name).slice(0, 8), 'tpose take=', src.userData.tpose ? src.userData.tpose.name : 'NONE');
dump('SRC rest  Shoulder_L→Wrist_L:', src, 'Shoulder_L', 'Wrist_L');
const mixIdle = new THREE.AnimationMixer(src);
const idleClip = src.animations.find((c) => c.name === 'human_male_idle_01');
mixIdle.clipAction(idleClip).play();
mixIdle.update(idleClip.duration * 0.45);
src.updateMatrixWorld(true);
dump('SRC idle  Shoulder_L→Wrist_L:', src, 'Shoulder_L', 'Wrist_L');
mixIdle.stopAllAction();

/* --- герой fighter: ретаргет idle, меряем в середине сэмплинга --- */
const rec = HEROES.find((h) => h.out === 'fighter');
const hero = buildHero(rec);
const skinned = [];
hero.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
const seen = new Set(); const dstBones = [];
for (const sm of skinned) for (const b of sm.skeleton.bones) if (!seen.has(b.name)) { seen.add(b.name); dstBones.push(b); }
dump('HERO bind Shoulder_L→Hand_L:', hero, 'Shoulder_L', 'Hand_L');
/* восстановим источник в рест перед ретаргетом */
for (const [b, r] of src.userData.restBones) { b.position.copy(r.p); b.quaternion.copy(r.q); }
src.updateMatrixWorld(true);
const spy = new THREE.Quaternion();
const origCopy = THREE.Quaternion.prototype.copy;
/* перехват: на середине кадров печать мировых позиций (мутирует b.quaternion внутри retarget) */
const outClip = retargetClipManual(hero, dstBones, src, idleClip, NAMES_BLINK, 'Root_M', 'rest-local');
outClip.name = 'idle';
/* применяем запечённый клип на копию героя и меряем */
const SkeletonUtils = await import('three/examples/jsm/utils/SkeletonUtils.js');
const clone = SkeletonUtils.clone(hero);
const m2 = new THREE.AnimationMixer(clone);
m2.clipAction(outClip).play();
m2.setTime(outClip.duration * 0.45);
clone.updateMatrixWorld(true);
dump('HERO baked idle Shoulder_L→Hand_L:', clone, 'Shoulder_L', 'Hand_L');

/* --- гоблин для сравнения --- */
const grec = ENEMIES.find((e) => e.out === 'goblin');
const goblin = buildEnemy(grec);
const gsk = [];
goblin.traverse((o) => { if (o.isSkinnedMesh) gsk.push(o); });
const gBones = gsk[0].skeleton.bones;
dump('GOBLIN bind Shoulder_L→Hand_L:', goblin, 'Shoulder_L', 'Hand_L');
for (const [b, r] of src.userData.restBones) { b.position.copy(r.p); b.quaternion.copy(r.q); }
src.updateMatrixWorld(true);
const gClip = retargetClipManual(goblin, gBones, src, idleClip, NAMES_BLINK, 'Root_M');
gClip.name = 'idle';
const gClone = SkeletonUtils.clone(goblin);
const m3 = new THREE.AnimationMixer(gClone);
m3.clipAction(gClip).play();
m3.setTime(gClip.duration * 0.45);
gClone.updateMatrixWorld(true);
dump('GOBLIN baked idle Shoulder_L→Hand_L:', gClone, 'Shoulder_L', 'Hand_L');
console.log('done');
