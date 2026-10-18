/* v1.7: офлайн-запекание Unity-анимаций (blink32/doublel) на скелет Soldier.glb.
   Итог: public/models/rig/motions.glb — клипы mixamorig (роли: idle/walk/run/...).
   Шаги: GLB без текстур → GLTFLoader → SkinnedMesh-таргет; FBXLoader каждого
   исходника; SkeletonUtils.retargetClip (names: mixamorig→риг пакета, scale —
   отношение высот бёдер); треки .bones[N].x → N.x; GLTFExporter → binary GLB. */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const SOLDIER = '/tmp/soldier.glb';
const PKG = '/home/z/my-project/upload/extract/pkg';
const OUT = '/home/z/my-project/public/models/rig/motions.glb';

/* Node-шимы: GLTFExporter использует FileReader; GLTFLoader — self.URL */
globalThis.self = globalThis.self ?? globalThis;
if (!globalThis.FileReader) {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then((x) => { this.result = x; this.onloadend?.({ target: this }); this.onload?.({ target: this }); }); }
    readAsDataURL(blob) { blob.arrayBuffer().then((x) => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(x).toString('base64'); this.onloadend?.({ target: this }); this.onload?.({ target: this }); }); }
  };
}

/* role → [пакет, grep-паттерн pathname, точное имя тейка (или null = первый не-tpose), hip источника] */
const SOURCES = [
  ['idle',      'blink32', 'Movement/Idle.fbx',            'human_male_idle_01',                'Root_M'],
  ['idleCombat','blink32', 'Combat/IdleCombat',            null,                                'Root_M'],
  ['walk',      'doublel', 'Walk_A_F_InPlace',             'AS_1Hand_Up_Walk_A_F_InPlace',      'pelvis'],
  ['run',       'blink32', 'Movement/RunForward',          'human_male_run_01',                 'Root_M'],
  ['attack1h',  'blink32', 'MeleeAttack_OneHanded',        'hum_male_meleeattack_1H_Weapon_01', 'Root_M'],
  ['attack2h',  'blink32', 'MeleeAttack_TwoHanded',        'hum_male_meleeattack_2H_Weapon_01', 'Root_M'],
  ['cast',      'blink32', 'Combat/SpellCast',             'human_male_magicattack_01',         'Root_M'],
  ['hit',       'blink32', 'Combat/GetHit',                'human_male_gethit_01',              'Root_M'],
  ['death',     'blink32', 'Combat/Death',                 'human_male_death_01',               'Root_M'],
  ['punchL',    'blink32', 'Combat/PunchLeft',             null,                                'Root_M'],
  ['punchR',    'blink32', 'Combat/PunchRight',            null,                                'Root_M'],
  ['block',     'blink32', 'Combat/BlockingLoop',          null,                                'Root_M'],
];
function actualPath(pkg, pattern) {
  const out = execSync(
    `find ${PKG}/${pkg} -name pathname -exec grep -l -- "${pattern}" {} \\; | head -1 | xargs dirname`,
    { encoding: 'utf8' }).trim();
  if (!out) throw new Error('pathname not found: ' + pkg + ' ' + pattern);
  return out + '/asset';
}

/* миксамо → риги пакетов */
const BLINK = {
  'mixamorigHips':'Root_M','mixamorigSpine':'Spine1_M','mixamorigSpine1':'Spine2_M','mixamorigSpine2':'Chest_M',
  'mixamorigNeck':'Neck_M','mixamorigHead':'Head_M',
  'mixamorigLeftShoulder':'Scapula_L','mixamorigLeftArm':'Shoulder_L','mixamorigLeftForeArm':'Elbow_L','mixamorigLeftHand':'Wrist_L',
  'mixamorigRightShoulder':'Scapula_R','mixamorigRightArm':'Shoulder_R','mixamorigRightForeArm':'Elbow_R','mixamorigRightHand':'Wrist_R',
  'mixamorigLeftUpLeg':'Hip_L','mixamorigLeftLeg':'Knee_L','mixamorigLeftFoot':'Ankle_L','mixamorigLeftToeBase':'Toes_L',
  'mixamorigRightUpLeg':'Hip_R','mixamorigRightLeg':'Knee_R','mixamorigRightFoot':'Ankle_R','mixamorigRightToeBase':'Toes_R',
};
const UE4 = {
  'mixamorigHips':'pelvis','mixamorigSpine':'spine_01','mixamorigSpine1':'spine_02','mixamorigSpine2':'spine_03',
  'mixamorigNeck':'neck_01','mixamorigHead':'head',
  'mixamorigLeftShoulder':'clavicle_l','mixamorigLeftArm':'upperarm_l','mixamorigLeftForeArm':'lowerarm_l','mixamorigLeftHand':'hand_l',
  'mixamorigRightShoulder':'clavicle_r','mixamorigRightArm':'upperarm_r','mixamorigRightForeArm':'lowerarm_r','mixamorigRightHand':'hand_r',
  'mixamorigLeftUpLeg':'thigh_l','mixamorigLeftLeg':'calf_l','mixamorigLeftFoot':'foot_l','mixamorigLeftToeBase':'ball_l',
  'mixamorigRightUpLeg':'thigh_r','mixamorigRightLeg':'calf_r','mixamorigRightFoot':'foot_r','mixamorigRightToeBase':'ball_r',
};

/* ---------- GLB Soldier без текстур ---------- */
function stripTextures(buf) {
  const jsonLen = buf.readUInt32LE(12), binOff = 20 + jsonLen,
    binLen = buf.readUInt32LE(binOff - 8), binHead = buf.readUInt32LE(binOff - 4);
  const json = JSON.parse(buf.slice(20, binOff).toString());
  delete json.images; delete json.samplers; delete json.textures;
  for (const m of json.materials ?? []) {
    for (const k of Object.keys(m)) if (k.endsWith('Texture')) delete m[k];
    if (m.pbrMetallicRoughness) for (const k of Object.keys(m.pbrMetallicRoughness)) if (k.endsWith('Texture')) delete m.pbrMetallicRoughness[k];
  }
  const jstr = JSON.stringify(json);
  const pad = (4 - (jstr.length % 4)) % 4, padded = jstr + ' '.repeat(pad);
  const out = Buffer.alloc(20 + padded.length + binLen);
  out.write('glTF', 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(12 + 8 + padded.length + 8 + binLen, 8);
  out.writeUInt32LE(padded.length, 12); out.write('JSON', 16); out.write(padded, 20);
  out.writeUInt32LE(binLen, 20 + padded.length); out.write(binHead === 0x004E4942 ? 'BIN\0' : 'BIN\0', 24 + padded.length);
  buf.copy(out, 28 + padded.length, binOff, binOff + binLen);
  return out;
}
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(stripTextures(readFileSync(SOLDIER)).buffer, '', res, rej));
const base = gltf.scene;
const soldierMesh = base.getObjectByProperty('isSkinnedMesh', true);
if (!soldierMesh) throw new Error('no skinned mesh in Soldier.glb');
base.updateMatrixWorld(true);
/* ВАЖНО: НЕ pose() — у Soldier.glb identity inverseBindMatrices, pose() обнуляет кости */
const targetHipRest = new THREE.Vector3();
soldierMesh.skeleton.getBoneByName('mixamorigHips').getWorldPosition(targetHipRest);
console.log('soldier hip rest world y =', targetHipRest.y.toFixed(3));

/* таргет-клон с .skeleton на корне (retarget ожидает Object3D с skeleton) */
function makeTarget() {
  const t = SkeletonUtils.clone(base);
  const m = t.getObjectByProperty('isSkinnedMesh', true);
  Object.defineProperty(t, 'skeleton', { value: m.skeleton });
  t.updateMatrixWorld(true);
  return t;
}

/* ---------- retarget каждого источника ---------- */
const loader = new FBXLoader();
const clips = [];
for (const [role, pkg, pattern, take, hip] of SOURCES) {
  const path = actualPath(pkg, pattern);
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const grp = loader.parse(ab, '');
  grp.updateMatrixWorld(true);
  /* скелетон-only FBX: SkinnedMesh нет — собираем Skeleton из isBone и вешаем на корень */
  if (!grp.skeleton) {
    const bones = [];
    grp.traverse(o => { if (o.isBone) bones.push(o); });
    Object.defineProperty(grp, 'skeleton', { value: new THREE.Skeleton(bones) });
    grp.updateMatrixWorld(true);
  }
  const srcHip = grp.getObjectByName(hip);
  if (!srcHip) { console.error('SKIP', role, 'no hip', hip); continue; }
  /* рест-высота бёдра: сцена может быть сохранена в позе конца анимации (death) —
     если есть tpose-тейк, проигрываем его перед замером */
  const tpose = grp.animations.find(c => /^t-?pose$/i.test(c.name));
  if (tpose) {
    const m = new THREE.AnimationMixer(grp);
    m.clipAction(tpose).play();
    m.update(0);
  }
  grp.updateMatrixWorld(true);
  const srcHipY = new THREE.Vector3(); srcHip.getWorldPosition(srcHipY);
  const scale = Math.abs(srcHipY.y) > 1e-6 ? Math.abs(targetHipRest.y) / Math.abs(srcHipY.y) : 0.01;
  const names = pkg === 'doublel' ? UE4 : BLINK;
  const takeClip = take
    ? grp.animations.find(c => c.name === take)
    : grp.animations.find(c => !/^t-?pose$/i.test(c.name));
  if (!takeClip) { console.error('SKIP', role, 'no take'); continue; }
  /* SRC_POSE: применяем клип к источнику до retarget (mixer внутри retargetClip сам проиграет) */
  const target = makeTarget();
  const out = SkeletonUtils.retargetClip(target, grp, takeClip, { names, hip, scale });
  /* переименование треков: .bones[N].prop → N.prop (надёжный резолв PropertyBinding) */
  for (const t of out.tracks) {
    const m = t.name.match(/^\.bones\[(.+)\]\.(\w+)$/);
    if (m) t.name = m[1] + '.' + m[2];
  }
  out.name = role;
  clips.push(out);
  console.log('BAKED', role, 'dur=' + out.duration.toFixed(2), 'tracks=' + out.tracks.length, 'scale=' + scale.toFixed(4), 'from', takeClip.name);
}

/* ---------- экспорт: soldier.glb = модель (с текстурами) + родные клипы
   + 12 Unity-клипов + ПРАВИЛЬНЫЕ inverseBindMatrices (лечим identity-бинд
   исходника — причина «лежащего» рендера в нодовых рендерерах) ---------- */
mkdirSync('/home/z/my-project/public/models/rig', { recursive: true });
const exporter = new GLTFExporter();
const exportScene = SkeletonUtils.clone(base);
exportScene.updateMatrixWorld(true);
const exMesh = exportScene.getObjectByProperty('isSkinnedMesh', true);
exMesh.bind(new THREE.Skeleton(exMesh.skeleton.bones), exMesh.bindMatrix);
const result = await new Promise((res, rej) => exporter.parse(exportScene, res, rej, { binary: true, animations: [...clips, ...(base.animations ?? [])] }));
const outBuf = Buffer.from(result);
writeFileSync('/home/z/my-project/public/models/rig/soldier.glb', outBuf);
console.log('WROTE soldier.glb', (outBuf.length / 1024).toFixed(0) + 'KB, clips:', clips.map(c => c.name).join(','), '+ soldier Idle/Run/Walk');
