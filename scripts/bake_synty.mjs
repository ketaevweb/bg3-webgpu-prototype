/* ============================================================
 * v3.1 «Чужие знамёна» — запекание Synty-персонажей в GLB.
 * Шаг RIVALS: Characters.fbx + Characters_BR.fbx (POLYGON Fantasy
 * Rivals v1.01) → 20 врагов: скелет + атлас FantasyRivals_Texture_01_A
 * (+Emissive) + оружие SM_Wep_* на Hand_R + 12 клипов (blink32/doublel
 * ретаргет на Synty-риг Hips/Spine_01/...). Итог:
 * public/models/rig/rivals/<name>.glb
 * Запуск: node scripts/bake_synty.mjs rivals
 * ============================================================ */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/* ---------- Node-шимы ---------- */
globalThis.self = globalThis.self ?? globalThis;
if (!globalThis.FileReader) {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then((x) => { this.result = x; this.onloadend?.({ target: this }); this.onload?.({ target: this }); }); }
    readAsDataURL(blob) { blob.arrayBuffer().then((x) => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(x).toString('base64'); this.onloadend?.({ target: this }); this.onload?.({ target: this }); }); }
  };
}
THREE.ImageLoader.prototype.load = function (url, onLoad) {
  const tex = new THREE.Texture(); setTimeout(() => onLoad?.(tex), 0); return tex;
};

const DIR = '/home/z/my-project/public/models/synty/rivals/';
const OUT = '/home/z/my-project/public/models/rig/rivals/';
const PKG = '/home/z/my-project/upload/extract/pkg';
const SOLDIER_HIP_REST = 1.0;/* высота бёдер Soldier (м) — замер v1.7: ~0.99..1.0 */

/* ---------- источник анимаций (как bake_motions) ---------- */
const A_SOURCES = [
  ['idle', 'blink32', 'Movement/Idle.fbx', 'human_male_idle_01', 'Root_M'],
  ['idleCombat', 'blink32', 'Combat/IdleCombat', null, 'Root_M'],
  ['walk', 'doublel', 'Walk_A_F_InPlace', 'AS_1Hand_Up_Walk_A_F_InPlace', 'pelvis'],
  ['run', 'blink32', 'Movement/RunForward', 'human_male_run_01', 'Root_M'],
  ['attack1h', 'blink32', 'MeleeAttack_OneHanded', 'hum_male_meleeattack_1H_Weapon_01', 'Root_M'],
  ['attack2h', 'blink32', 'MeleeAttack_TwoHanded', 'hum_male_meleeattack_2H_Weapon_01', 'Root_M'],
  ['cast', 'blink32', 'Combat/SpellCast', 'human_male_magicattack_01', 'Root_M'],
  ['hit', 'blink32', 'Combat/GetHit', 'human_male_gethit_01', 'Root_M'],
  ['death', 'blink32', 'Combat/Death', 'human_male_death_01', 'Root_M'],
  ['punchL', 'blink32', 'Combat/PunchLeft', null, 'Root_M'],
  ['punchR', 'blink32', 'Combat/PunchRight', null, 'Root_M'],
  ['block', 'blink32', 'Combat/BlockingLoop', null, 'Root_M'],
];

function actualPath(pkg, pattern) {
  const out = execSync(
    `find ${PKG}/${pkg} -name pathname -exec grep -l -- "${pattern}" {} \\; | head -1 | xargs dirname`,
    { encoding: 'utf8' }).trim();
  if (!out) throw new Error('pathname not found: ' + pkg + ' ' + pattern);
  return out + '/asset';
}

/* ретаргет-карта: names[TARGET(Synty)] = SOURCE(Blink/UE4)
   (three SkeletonUtils: bone=target, getBoneName(names[bone.name]) → ищется в source) */
const NAMES_BLINK = {
  'Hips': 'Root_M', 'Spine_01': 'Spine1_M', 'Spine_02': 'Spine2_M', 'Spine_03': 'Chest_M',
  'Neck': 'Neck_M', 'Head': 'Head_M',
  'Clavicle_L': 'Scapula_L', 'Shoulder_L': 'Shoulder_L', 'Elbow_L': 'Elbow_L', 'Hand_L': 'Wrist_L',
  'Clavicle_R': 'Scapula_R', 'Shoulder_R': 'Shoulder_R', 'Elbow_R': 'Elbow_R', 'Hand_R': 'Wrist_R',
  'UpperLeg_L': 'Hip_L', 'LowerLeg_L': 'Knee_L', 'Ankle_L': 'Ankle_L', 'Ball_L': 'Toes_L',
  'UpperLeg_R': 'Hip_R', 'LowerLeg_R': 'Knee_R', 'Ankle_R': 'Ankle_R', 'Ball_R': 'Toes_R',
};
/* doublel UE4-риг */
const NAMES_UE4 = {
  'Hips': 'pelvis', 'Spine_01': 'spine_01', 'Spine_02': 'spine_02', 'Spine_03': 'spine_03',
  'Neck': 'neck_01', 'Head': 'head',
  'Clavicle_L': 'clavicle_l', 'Shoulder_L': 'upperarm_l', 'Elbow_L': 'lowerarm_l', 'Hand_L': 'hand_l',
  'Clavicle_R': 'clavicle_r', 'Shoulder_R': 'upperarm_r', 'Elbow_R': 'lowerarm_r', 'Hand_R': 'hand_r',
  'UpperLeg_L': 'thigh_l', 'LowerLeg_L': 'calf_l', 'Ankle_L': 'foot_l', 'Ball_L': 'ball_l',
  'UpperLeg_R': 'thigh_r', 'LowerLeg_R': 'calf_r', 'Ankle_R': 'foot_r', 'Ball_R': 'ball_r',
};

/* ---------- рецепты врагов ----------
   mesh — имя SkinnedMesh; wep — оружие FBX; h — целевой рост (м); set — набор атак */
const ENEMIES = [
  { out: 'goblin',    fbx: 'Characters_BR.fbx', mesh: 'Character_MutantGuy_01',        wep: 'SM_Wep_MutantGuy_01.fbx',      h: 1.05, set: 'brawler' },
  { out: 'undead',    fbx: 'Characters.fbx',    mesh: 'Character_Ancient_Warrior_01',  wep: 'SM_Wep_AncientWarrior_01.fbx', h: 1.80, set: 'blade' },
  { out: 'cultist',   fbx: 'Characters.fbx',    mesh: 'Character_DarkElf_01',          wep: 'SM_Wep_DarkElf_01.fbx',        h: 1.82, set: 'blade' },
  { out: 'necro',     fbx: 'Characters.fbx',    mesh: 'Character_EvilGod_01',          wep: 'SM_Wep_EvilGod_01.fbx',        h: 2.05, set: 'spell' },
  { out: 'ogre',      fbx: 'Characters_BR.fbx', mesh: 'Character_Pig_Butcher_01',      wep: 'SM_Wep_PigButcher_01.fbx',     h: 2.35, set: 'heavy' },
  { out: 'giant',     fbx: 'Characters_BR.fbx', mesh: 'Character_BarbarianGiant_01',   wep: 'SM_Wep_BarbarianGiant_01.fbx', h: 3.10, set: 'heavy' },
  { out: 'boss',      fbx: 'Characters_BR.fbx', mesh: 'Character_RedDemon_01',         wep: 'SM_Wep_RedDemon_01.fbx',       h: 2.60, set: 'heavy' },
  { out: 'swampboss', fbx: 'Characters.fbx',    mesh: 'Character_Medusa_01',           wep: 'SM_Wep_Medusa_01.fbx',         h: 2.00, set: 'spell' },
  { out: 'knight',    fbx: 'Characters_BR.fbx', mesh: 'Character_Slayer_01',           wep: 'SM_Wep_Slayer_01.fbx',         h: 1.95, set: 'blade' },
  { out: 'lord',      fbx: 'Characters_BR.fbx', mesh: 'Character_FortGolem_01',        wep: 'SM_Wep_FortGolem_01.fbx',      h: 2.30, set: 'heavy' },
  { out: 'golem',     fbx: 'Characters_BR.fbx', mesh: 'Character_ElementalGolem_01',   wep: 'SM_Wep_ElementalGolem_01.fbx', h: 2.40, set: 'heavy' },
  { out: 'golem2',    fbx: 'Characters_BR.fbx', mesh: 'Character_MechanicalGolem_01',  wep: 'SM_Wep_MechanicalGolem_01.fbx',h: 2.40, set: 'heavy' },
  { out: 'orc',       fbx: 'Characters_BR.fbx', mesh: 'Character_Big_Ork_01',          wep: 'SM_Wep_BigOrk_01.fbx',         h: 2.20, set: 'heavy' },
  { out: 'troll',     fbx: 'Characters_BR.fbx', mesh: 'Character_Troll_01',            wep: 'SM_Wep_Troll_01.fbx',          h: 2.45, set: 'heavy' },
  { out: 'dwarf',     fbx: 'Characters_BR.fbx', mesh: 'Character_Dwarf_01',            wep: 'SM_Wep_Dwarf_01.fbx',          h: 1.42, set: 'blade' },
  { out: 'witch',     fbx: 'Characters.fbx',    mesh: 'Character_ForestWitch_01',      wep: 'SM_Wep_ForestWitch_01.fbx',    h: 1.78, set: 'spell' },
  { out: 'guardian',  fbx: 'Characters.fbx',    mesh: 'Character_ForestGuardian_01',   wep: 'SM_Wep_ForestGuardian_01.fbx', h: 2.15, set: 'heavy' },
  { out: 'queen',     fbx: 'Characters.fbx',    mesh: 'Character_AncientQueen_01',     wep: 'SM_Wep_AncientQueen_01.fbx',   h: 1.90, set: 'spell' },
  { out: 'spirit',    fbx: 'Characters.fbx',    mesh: 'Character_SpiritDemon',         wep: 'SM_Wep_SpiritDemon_01.fbx',    h: 2.00, set: 'spell', glow: 'Character_SpiritDemon_Glow' },
  { out: 'mystic',    fbx: 'Characters.fbx',    mesh: 'Character_Mystic_01',           wep: 'SM_Wep_Mystic_01.fbx',         h: 1.85, set: 'spell', tex: 'Mystic_Arms.png' },
];

/* ---------- загрузка FBX (кэш для оружия; персонажи — свежий парс) ---------- */
const fbxCache = new Map();
function loadFBX(file) {
  if (!fbxCache.has(file)) fbxCache.set(file, loadFBXFresh(file));
  return fbxCache.get(file);
}
function loadFBXFresh(file) {
  const buf = readFileSync(DIR + file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const grp = new FBXLoader().parse(ab, '');
  grp.updateMatrixWorld(true);
  return grp;
}

/* текстуры НЕ вшиваем (GLTFExporter в Node не умеет image) — вешаем пост-патчем GLB:
   материал с именем synty_body/synty_ghost → baseColorTexture на внешний PNG (tex/) */
function charMaterial() {
  return new THREE.MeshStandardMaterial({ name: 'synty_body', roughness: 0.9, metalness: 0 });
}
function glowMaterial() {
  return new THREE.MeshStandardMaterial({
    name: 'synty_ghost', color: 0x9adfff, roughness: 1,
    transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

/* ---------- сборка одного врага ---------- */
function buildEnemy(rec) {
  /* FBX парсим СВЕЖИМ на каждого персонажа (перенос объектов в temp мутирует граф) */
  const grp = loadFBXFresh(rec.fbx);
  const mesh = grp.getObjectByName(rec.mesh);
  if (!mesh) throw new Error('mesh not found: ' + rec.mesh);
  if (!mesh.isSkinnedMesh) throw new Error('not skinned: ' + rec.mesh);

  /* скелет персонажа: кости его Skeleton (собственное поддерево) */
  const bones = mesh.skeleton.bones;
  let root = bones[0];
  while (!bones.every((b) => b === root || isAncestor(root, b))) {
    root = root.parent;
    if (!root) throw new Error('no common bone root for ' + rec.mesh);
  }

  /* temp = корневая кость + меш(и) → SkeletonUtils.clone корректно
     перелинковывает SkinnedMesh.skeleton на кости клона.
     ВАЖНО: в FBX Synty дубли имён (null-node + LimbNode-деформер) —
     ручной ремап по имени брал не того близнеца. */
  const temp = new THREE.Group();
  temp.add(root, mesh);
  const glowSrc = rec.glow ? grp.getObjectByName(rec.glow) : null;
  if (glowSrc && glowSrc.isSkinnedMesh) temp.add(glowSrc);
  const model = SkeletonUtils.clone(temp);
  model.name = rec.out;

  /* деформеры (авторитетный список костей) */
  const skinned = [];
  model.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  const defBones = new Set();
  for (const sm of skinned) for (const b of sm.skeleton.bones) defBones.add(b);

  /* уникализируем имена НЕ-деформеров (дубли ломают PropertyBinding по имени:
     канал '.bones[X].quaternion' может попасть в null-близнеца) */
  const seen = new Set();
  for (const b of defBones) seen.add(b.name);
  model.traverse((o) => {
    if (!o.isBone || defBones.has(o)) return;
    if (seen.has(o.name)) { let i = 2; while (seen.has(o.name + '_p' + i)) i++; o.name = o.name + '_p' + i; }
    seen.add(o.name);
  });

  const meshC = skinned[0];
  meshC.castShadow = true;
  meshC.frustumCulled = false;
  /* клон несёт исходные Phong-материалы с битыми текстурными ссылками —
     заменяем на чистые (GLTFExporter иначе падает на image) */
  for (const sm of skinned) {
    sm.material = /glow|ghost/i.test(sm.name) ? glowMaterial() : charMaterial();
  }

  /* оружие → Hand_R деформера */
  if (rec.wep && existsSync(DIR + rec.wep)) {
    const wgrp = loadFBX(rec.wep);
    let wep = null;
    wgrp.traverse((o) => { if (o.isMesh && !wep) wep = o; });
    if (wep) {
      const wm = new THREE.Mesh(wep.geometry.clone(), charMaterial(rec.tex));
      wm.name = 'wep_' + rec.out;
      wm.castShadow = true;
      const hand = meshC.skeleton.bones.find((b) => b.name === 'Hand_R');
      if (hand) {
        /* Synty-оружие: рукоять в origin, клинок вдоль -Y (вниз от кисти);
           кисть в T-позе смотрит пальцами вбок → клинок вдоль -X локально руки.
           Скейл НЕ ставим: оружие в см, как и кости — корневой скейл модели общий. */
        hand.add(wm);
        wm.rotation.set(0, 0, -Math.PI / 2);
      } else console.warn('no Hand_R for', rec.out);
    }
  }

  /* масштаб: FBX в см. Рост до скейла; hipCm = высота бёдер в модельных см (для ретаргета) */
  model.updateMatrixWorld(true);
  const _hipBone = model.getObjectByName('Hips');
  const _hipV = new THREE.Vector3();
  model.userData.hipCm = _hipBone ? Math.abs(_hipBone.getWorldPosition(_hipV).y) : 90;
  const preBox = new THREE.Box3().setFromObject(model);
  const preH = preBox.max.y - preBox.min.y;
  const s = rec.h / preH;
  model.scale.setScalar(s);
  /* центр XZ в 0, низ на y=0 */
  const box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x * s, -box.min.y, -c.z * s);
  model.updateMatrixWorld(true);
  return model;
}

function isAncestor(a, b) {
  let p = b.parent;
  while (p) { if (p === a) return true; p = p.parent; }
  return false;
}

/* ---------- ручной ретаргет с компенсацией рест-ориентаций ----------
   SkeletonUtils.retarget копирует МИРОВЫЕ повороты источник→цель как есть:
   у blink кости смотрят детьми вдоль -X, у Synty — вдоль +X → выворот конечностей.
   Классическая схема: dstWorld = dstRestWorld × (srcRestWorld⁻¹ × srcAnimWorld) —
   анимация переносится через рест-фрейм каждой кости. Единицы — модельные (см). */
function retargetClipManual(dstModel, dstBones, src, clip, map, srcHipName, modeWorld = 'world-delta') {
  /* 0) вернуть источник в рест (кэш живёт между персонажами/клипами) */
  if (src.userData.restBones) {
    for (const [b, r] of src.userData.restBones) { b.position.copy(r.p); b.quaternion.copy(r.q); }
    src.updateMatrixWorld(true);
  }
  /* 0b) источник в T-позу (если есть тейк) — рест-миры замеряем в ней,
     иначе delta анимации схлопывается (у blink32 сцена сохранена в idle) */
  let mixerT = null;
  if (src.userData.tpose) {
    mixerT = new THREE.AnimationMixer(src);
    mixerT.clipAction(src.userData.tpose).play();
    mixerT.update(0);
    src.updateMatrixWorld(true);
  }
  const mixer = new THREE.AnimationMixer(src);
  mixer.clipAction(clip).play();

  /* 1) рест-миры и оффсеты (источник в T-позе) */
  const srcRest = new Map();
  for (const b of src.skeleton.bones) srcRest.set(b.name, b.getWorldQuaternion(new THREE.Quaternion()));
  if (mixerT) mixerT.stopAllAction();/* T-поза замерена — дальше играет целевой клип */
  dstModel.updateMatrixWorld(true);
  const dstRest = new Map(), dstRestLocal = new Map(), dstBySrc = new Map();
  for (const b of dstBones) {
    const sn = map[b.name];
    if (!sn) continue;
    const sb = src.skeleton.bones.find((x) => x.name === sn);
    if (sb) {
      dstBySrc.set(b, sb);
      dstRest.set(b, b.getWorldQuaternion(new THREE.Quaternion()));
      /* рест ДЛЯ ВОССТАНОВЛЕНИЯ — ЛОКАЛЬНЫЙ (мировой в локаль = поломанная поза
         экспорта на ригах с preRotation — урок MFH) */
      dstRestLocal.set(b, b.quaternion.clone());
    }
  }
  const offset = new Map();/* dstBone → srcRestWorld⁻¹ (мировая дельта-схема) */
  for (const [b, sb] of dstBySrc) {
    offset.set(b, srcRest.get(sb.name).clone().invert());
  }
  const order = [...dstBySrc.keys()];
  const srcHip = src.getObjectByName(srcHipName);
  const dstHip = order.find((b) => map[b.name] === srcHipName);
  srcHip.getWorldPosition(_v);
  const srcHipRestPos = _v.clone();/* мировая позиция бёдер источника (см) */
  const srcHipRestY = Math.abs(srcHipRestPos.y);
  /* высота бёдер цели в МОДЕЛЬНЫХ единицах (см): у Rivals её несёт кость Root
     (Hips local = 0), у MFH — сам Hips (87.6) → buildEnemy/buildHero кладут hipCm */
  const hipCm = dstModel.userData.hipCm ?? Math.abs(dstHip.getWorldPosition(_v).y);
  const k = srcHipRestY > 1e-6 ? hipCm / srcHipRestY : 1;/* см/см */
  const hipRestLocal = dstHip.position.clone();

  /* 2) сэмпл по кадрам */
  const frames = Math.max(2, Math.round(clip.duration * 30));
  const delta = clip.duration / frames;
  const posT = new Float32Array(frames), posV = new Float32Array(frames * 3);
  const quatT = new Float32Array(frames);
  const quatVals = new Map();/* dstBone → Float32Array(frames*4) */
  for (const b of order) quatVals.set(b, new Float32Array(frames * 4));
  const qParentInv = new THREE.Quaternion(), qWorld = new THREE.Quaternion(), qSrc = new THREE.Quaternion();
  for (let f = 0; f < frames; f++) {
    mixer.update(f === frames - 1 ? clip.duration - 0.0001 : f * delta);
    src.updateMatrixWorld(true);
    const t = f * delta;
    quatT[f] = t;
    for (const b of order) {
      const sb = dstBySrc.get(b);
      sb.getWorldQuaternion(qSrc);
      if (modeWorld === 'rest-local') {
        /* схема A: dstWorld = dstRest × (srcRest⁻¹ × srcWorld) —
           воспроизводит конфигурацию источника, замапленную по-костно;
           правильна для ригов с НЕ-identity рест-мирами (MFH).
           Для Rivals (рест ≈ identity) совпадает с B. */
        qWorld.copy(dstRest.get(b)).multiply(offset.get(b)).multiply(qSrc);
      } else {
        /* схема B: мировая дельта — dstWorld = (srcWorld × srcRest⁻¹) × dstRest
           (работает для Rivals: их рест-миры ≈ identity) */
        qWorld.copy(qSrc).multiply(offset.get(b)).multiply(dstRest.get(b));
      }
      b.parent.getWorldQuaternion(qParentInv).invert();
      b.quaternion.copy(qParentInv).multiply(qWorld);
      b.updateMatrixWorld(true);
      const arr = quatVals.get(b);
      arr[f * 4] = b.quaternion.x; arr[f * 4 + 1] = b.quaternion.y;
      arr[f * 4 + 2] = b.quaternion.z; arr[f * 4 + 3] = b.quaternion.w;
      if (process.env.BAKE_DEBUG && f === Math.floor(frames / 2) && /Shoulder_L|Elbow_L/.test(b.name)) {
        const res = b.getWorldQuaternion(new THREE.Quaternion());
        const ang = (qa, qb) => (2 * Math.acos(Math.min(1, Math.abs(qa.dot(qb)))) * 180 / Math.PI).toFixed(1);
        console.log(`[dbg] ${b.name}: srcWorld=${qSrc.toArray().map((v) => v.toFixed(2))} desired=${qWorld.toArray().map((v) => v.toFixed(2))} result=${res.toArray().map((v) => v.toFixed(2))} angDesRest=${ang(qWorld, dstRest.get(b))} angResRest=${ang(res, dstRest.get(b))}`);
      }
    }
    if (dstHip) {
      posT[f] = t;
      /* локальный рест + мировая дельта источника × k — верно для обоих ригов
         (высота может жить в Root или в Hips — рест не трогаем, добавляем дельту) */
      const sp = srcHip.getWorldPosition(_v);
      dstHip.position.set(
        hipRestLocal.x + (sp.x - srcHipRestPos.x) * k,
        hipRestLocal.y + (sp.y - srcHipRestPos.y) * k,
        hipRestLocal.z + (sp.z - srcHipRestPos.z) * k,
      );
      dstHip.updateMatrixWorld(true);
      posV[f * 3] = dstHip.position.x; posV[f * 3 + 1] = dstHip.position.y; posV[f * 3 + 2] = dstHip.position.z;
    }
  }
  /* 3) рест цели назад (ЛОКАЛЬНЫЕ кватернионы!) + экспорт клипа */
  for (const [b] of dstBySrc) b.quaternion.copy(dstRestLocal.get(b));
  if (dstHip) dstHip.position.copy(hipRestLocal);
  dstModel.updateMatrixWorld(true);
  const tracks = [];
  if (dstHip) tracks.push(new THREE.VectorKeyframeTrack(dstHip.name + '.position', posT, posV));
  for (const b of order) tracks.push(new THREE.QuaternionKeyframeTrack(b.name + '.quaternion', quatT, quatVals.get(b)));
  return new THREE.AnimationClip('retargeted', clip.duration, tracks);
}
const _v = new THREE.Vector3();
/* мини-миксер: проигрывает клип на исходном графе */
function AnimationMixerShim(src, clip) {
  const m = new THREE.AnimationMixer(src);
  m.clipAction(clip).play();
  return { update: (t) => m.update(t) };
}

/* ---------- цель ретаргета (клон: ретаргет мутирует кости цели) ---------- */
function makeTarget(model) {
  const t = SkeletonUtils.clone(model);
  const skinned = [];
  t.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  Object.defineProperty(t, 'skeleton', { value: skinned[0].skeleton });
  t.updateMatrixWorld(true);
  return t;
}

/* ---------- источники анимаций (FBX без мешей) ---------- */
const srcCache = new Map();
function animSource(pkg, pattern, hip) {
  const key = pkg + '|' + pattern;
  if (!srcCache.has(key)) {
    const path = actualPath(pkg, pattern);
    const buf = readFileSync(path);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const grp = new FBXLoader().parse(ab, '');
    grp.updateMatrixWorld(true);
    if (!grp.skeleton) {
      const bones = [];
      grp.traverse((o) => { if (o.isBone) bones.push(o); });
      Object.defineProperty(grp, 'skeleton', { value: new THREE.Skeleton(bones) });
      grp.updateMatrixWorld(true);
    }
    /* снимок рест-локал-трансформов костей (ретаргет мутирует источник) */
    const restBones = new Map();
    grp.traverse((o) => { if (o.isBone) restBones.set(o, { p: o.position.clone(), q: o.quaternion.clone() }); });
    grp.userData.restBones = restBones;
    /* тейк T-позы (у blink32 рест сцены = idle, не T-поза — дельта исчезает) */
    grp.userData.tpose = grp.animations.find((c) => /^t-?pose$/i.test(c.name)) ?? null;
    srcCache.set(key, grp);
  }
  return srcCache.get(key);
}

/* ---------- GLB-патч: внешние текстуры ----------
   GLTFExporter в Node не умеет канвасы → экспортируем без текстур и вшиваем
   images/textures/materials-ссылки вручную. PNG заранее перевёрнут по вертикали
   (sharp): FBX UV (flipY=true) ≡ glTF UV (flipY=false) при предперевёрнутой картинке. */
import sharp from 'sharp';
const TEX_OUT = OUT + 'tex/';
const flippedCache = new Map();
async function flippedPNG(file) {
  if (!flippedCache.has(file)) {
    mkdirSync(TEX_OUT, { recursive: true });
    const src = DIR + file;
    const dst = TEX_OUT + file.replace(/[.](png|tga)$/i, '.png');
    if (!existsSync(dst)) {
      await sharp(src).flip().png().toFile(dst);
    }
    flippedCache.set(file, file.replace(/[.](tga)$/i, '.png'));
  }
  return flippedCache.get(file);
}

function patchGLB(buf, materialTex) {
  /* materialTex: { 'synty_body': 'FantasyRivals_Texture_01_A.png', ... } */
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString());
  const binLen = buf.readUInt32LE(20 + jsonLen);/* chunk1 header: len@20+jsonLen, 'BIN\0'@24+jsonLen */
  const bin = buf.slice(20 + jsonLen + 8, 20 + jsonLen + 8 + binLen);

  /* материалы: чистим возможные пустые pbr-текстуры, вешаем ссылки по имени */
  const images = [], textures = [], samplers = [{
    magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497,
  }];
  const texIdxByImage = new Map();
  for (const m of json.materials ?? []) {
    const file = materialTex[m.name];
    if (!file) continue;
    /* удаляем пустые текстурные ссылки, если экспортёр что-то записал */
    if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; }
    delete m.emissiveTexture; delete m.normalTexture; delete m.occlusionTexture;
    if (!m.pbrMetallicRoughness) m.pbrMetallicRoughness = {};
    if (!texIdxByImage.has(file)) {
      const imgIdx = images.length;
      images.push({ uri: 'tex/' + file, mimeType: 'image/png' });
      texIdxByImage.set(file, textures.length);
      textures.push({ sampler: 0, source: imgIdx });
    }
    const ti = texIdxByImage.get(file);
    m.pbrMetallicRoughness.baseColorTexture = { index: ti };
    if (m.name === 'synty_ghost') {
      m.alphaMode = 'BLEND'; m.doubleSided = true;
    }
  }
  if (images.length) { json.images = images; json.textures = textures; json.samplers = samplers; }

  /* MFH: у каждой части своя копия скелета (одноимённые узлы) — размножаем
     каналы анимаций на ВСЕ узлы с тем же именем, иначе двигается только первый */
  if (json.animations && json.nodes) {
    const byName = new Map();
    json.nodes.forEach((n, i) => {
      if (!n.name) return;
      if (!byName.has(n.name)) byName.set(n.name, []);
      byName.get(n.name).push(i);
    });
    for (const anim of json.animations) {
      const extra = [];
      for (const ch of anim.channels) {
        const node = json.nodes[ch.target?.node];
        if (!node?.name) continue;
        const twins = byName.get(node.name) ?? [];
        for (const twin of twins) {
          if (twin === ch.target.node) continue;
          extra.push({ sampler: ch.sampler, target: { node: twin, path: ch.target.path } });
        }
      }
      anim.channels.push(...extra);
    }
  }

  const jstr = JSON.stringify(json);
  const pad = (4 - (jstr.length % 4)) % 4, padded = jstr + ' '.repeat(pad);
  const total = 12 + 8 + padded.length + 8 + bin.length;
  const out = Buffer.alloc(total);
  out.write('glTF', 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
  out.writeUInt32LE(padded.length, 12); out.write('JSON', 16); out.write(padded, 20);
  const off = 20 + padded.length;
  out.writeUInt32LE(bin.length, off); out.write('BIN\u0000', off + 4);
  bin.copy(out, off + 8);
  return out;
}
const mode = process.argv[2] ?? 'rivals';
if (mode === 'noop') { console.log('noop-import'); }
if (mode === 'rivals') {
  mkdirSync(OUT, { recursive: true });
  const exporter = new GLTFExporter();
  for (const rec of ENEMIES) {
    try {
      const model = buildEnemy(rec);
      const skinned = [];
      model.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
      const dstBones = skinned[0].skeleton.bones;
      const clips = [];
      for (const [role, pkg, pattern, take, hip] of A_SOURCES) {
        const src = animSource(pkg, pattern, hip);
        const names = pkg === 'doublel' ? NAMES_UE4 : NAMES_BLINK;
        const takeClip = take ? src.animations.find((c) => c.name === take)
          : src.animations.find((c) => !/^t-?pose$/i.test(c.name));
        if (!takeClip) { console.error('SKIP', role, 'no take'); continue; }
        const out = retargetClipManual(model, dstBones, src, takeClip, names, hip);
        out.name = role;
        clips.push(out);
      }
      const result = await new Promise((res, rej) => exporter.parse(model, res, rej, { binary: true, animations: clips }));
      const texFile = rec.tex ?? 'FantasyRivals_Texture_01_A.png';
      const glb = patchGLB(Buffer.from(result), {
        'synty_body': await flippedPNG(texFile),
        'synty_ghost': await flippedPNG('Mystic_Arms.png'),
      });
      writeFileSync(OUT + rec.out + '.glb', glb);
      console.log('OK', rec.out, (glb.length / 1024).toFixed(0) + 'KB', 'clips=' + clips.length);
    } catch (e) {
      console.error('FAIL', rec.out, e.message);
    }
  }
}
/* ================= HEROES (Modular Fantasy Hero Characters) ================= */
const HDIR = '/home/z/my-project/public/models/synty/heroes/';
const HOUT = '/home/z/my-project/public/models/rig/heroes/';
const HTEX_OUT = HOUT + 'tex/';
const hFlippedCache = new Map();
async function flippedHeroesPNG(file) {
  if (!hFlippedCache.has(file)) {
    mkdirSync(HTEX_OUT, { recursive: true });
    const dst = HTEX_OUT + file;
    if (!existsSync(dst)) await sharp(HDIR + file).flip().png().toFile(dst);
    hFlippedCache.set(file, file);
  }
  return hFlippedCache.get(file);
}
let hFbxCache = null;
function loadMFH() {
  /* СВЕЖИЙ парс на вызов: buildHero переносит узлы в temp — кэш мутируется */
  const buf = readFileSync(HDIR + 'ModularCharacters.fbx');
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const grp = new FBXLoader().parse(ab, '');
  grp.updateMatrixWorld(true);
  return grp;
}
/* плоские цвета Synty-стиля: primary/secondary/metal/leather + кожа/волосы с атласом */
function heroMaterial(kind, cls) {
  const P = {
    fighter: { p: 0x5a6f88, s: 0x4a3a2c }, wizard: { p: 0x7a5aa0, s: 0x453560 },
    rogue: { p: 0x3f6a55, s: 0x5a4a34 }, cleric: { p: 0xc9a84a, s: 0xb8b0a0 },
    druid: { p: 0x4a7a5f, s: 0x6a5a3f }, paladin: { p: 0x8a5a5a, s: 0x6a6a72 },
  }[cls] ?? { p: 0x6a7a8a, s: 0x4a3a2c };
  /* кожа/волосы — плоские цвета (UV голов заточены под масочный шейдер Synty —
     атлас даёт чёрные лица), стиль Polygon это допускает */
  const HAIR = { fighter: 0x4a3626, wizard: 0x2c2320, rogue: 0x3a2a1e, cleric: 0xc8a45a, druid: 0x4e3d2a, paladin: 0x54423a }[cls] ?? 0x3a2c1e;
  switch (kind) {
    case 'skin': return new THREE.MeshStandardMaterial({ name: 'synty_skin', color: 0xd9ab8a, roughness: 0.85 });
    case 'hair': return new THREE.MeshStandardMaterial({ name: 'synty_hair', color: HAIR, roughness: 0.9 });
    case 'primary': return new THREE.MeshStandardMaterial({ name: 'synty_cloth1', color: P.p, roughness: 0.9 });
    case 'secondary': return new THREE.MeshStandardMaterial({ name: 'synty_cloth2', color: P.s, roughness: 0.9 });
    case 'metal': return new THREE.MeshStandardMaterial({ name: 'synty_metal', color: 0x9aa2ac, roughness: 0.45, metalness: 0.5 });
    case 'leather': return new THREE.MeshStandardMaterial({ name: 'synty_leather', color: 0x5a4430, roughness: 0.85 });
    default: return new THREE.MeshStandardMaterial({ name: 'synty_cloth1', color: P.p, roughness: 0.9 });
  }
}
function kindOfPart(n) {
  if (/^Chr_Head(_Female|_Male|_No_Elements)/.test(n)) return 'skin';
  if (/^Chr_(Hair_|FacialHair|Eyebrow|Female_Eyebrow|Attach_Hair|Attach_Beard|Attach_Moustache|Attach_Chops|Attach_Bun|Attach_Ponytail)/.test(n)) return 'hair';
  if (/^Chr_Torso/.test(n)) return 'primary';
  if (/^Chr_(Hips|Leg|Arm|Hand|Jumpsuit|Business|Peasent|Prisoner|Robot|Skeleton|Space|Street|Charred|Underwear)/.test(n)) return 'secondary';
  if (/^Chr_HeadCoverings/.test(n)) return 'secondary';
  if (/^Chr_(ShoulderAttach|KneeAttach|ElbowAttach|HelmetAttachment)/.test(n)) return 'metal';
  if (/^Chr_(BackAttachment|HipsAttachment|Cape)/.test(n)) return 'leather';
  return 'primary';
}
/* рецепты героев: [часть…]; рост и класс */
const HEROES = [
  { out: 'fighter', h: 1.85, parts: ['Chr_Torso_Male_03', 'Chr_Hips_Male_04', 'Chr_LegLeft_Male_07', 'Chr_LegRight_Male_07', 'Chr_ArmUpperLeft_Male_15', 'Chr_ArmUpperRight_Male_15', 'Chr_ArmLowerLeft_Male_04', 'Chr_ArmLowerRight_Male_04', 'Chr_HandLeft_Male_11', 'Chr_HandRight_Male_11', 'Chr_Head_Male_01', 'Chr_HeadCoverings_No_Hair_12', 'Chr_ShoulderAttachLeft_02', 'Chr_ShoulderAttachRight_02', 'Chr_KneeAttachLeft_09', 'Chr_KneeAttachRight_09', 'Chr_FacialHair_Male_04', 'Chr_Eyebrow_Male_03'] },
  { out: 'wizard', h: 1.72, parts: ['Chr_Torso_Female_26', 'Chr_Hips_Female_19', 'Chr_LegLeft_Female_04', 'Chr_LegRight_Female_06', 'Chr_ArmUpperLeft_Female_11', 'Chr_ArmUpperRight_Female_11', 'Chr_ArmLowerLeft_Female_06', 'Chr_ArmLowerRight_Female_06', 'Chr_HandLeft_Female_09', 'Chr_HandRight_Female_09', 'Chr_Head_Female_09', 'Chr_Hair_09', 'Chr_Eyebrow_Female_02'] },
  { out: 'rogue', h: 1.80, parts: ['Chr_Torso_Male_12', 'Chr_Hips_Male_10', 'Chr_LegLeft_Male_05', 'Chr_LegRight_Male_05', 'Chr_ArmUpperLeft_Male_13', 'Chr_ArmUpperRight_Male_13', 'Chr_ArmLowerLeft_Male_06', 'Chr_ArmLowerRight_Male_06', 'Chr_HandLeft_Male_07', 'Chr_HandRight_Male_07', 'Chr_Head_Male_05', 'Chr_Hair_25', 'Chr_FacialHair_Male_11', 'Chr_Eyebrow_Male_03'] },
  { out: 'cleric', h: 1.74, parts: ['Chr_Torso_Female_01', 'Chr_Hips_Female_13', 'Chr_LegLeft_Female_01', 'Chr_LegRight_Female_01', 'Chr_ArmUpperLeft_Female_07', 'Chr_ArmUpperRight_Female_07', 'Chr_ArmLowerLeft_Female_00', 'Chr_ArmLowerRight_Female_00', 'Chr_HandLeft_Female_03', 'Chr_HandRight_Female_03', 'Chr_Head_Female_01', 'Chr_Hair_29', 'Chr_HeadCoverings_Base_Hair_07', 'Chr_Eyebrow_Female_02'] },
  { out: 'druid', h: 1.83, parts: ['Chr_Torso_Male_16', 'Chr_Hips_Male_23', 'Chr_LegLeft_Male_06', 'Chr_LegRight_Male_06', 'Chr_ArmUpperLeft_Male_14', 'Chr_ArmUpperRight_Male_14', 'Chr_ArmLowerLeft_Male_11', 'Chr_ArmLowerRight_Male_11', 'Chr_HandLeft_Male_08', 'Chr_HandRight_Male_08', 'Chr_Head_Male_13', 'Chr_Hair_34', 'Chr_FacialHair_Male_08', 'Chr_Eyebrow_Male_03'] },
  { out: 'paladin', h: 1.88, parts: ['Chr_Torso_Male_22', 'Chr_Hips_Male_25', 'Chr_LegLeft_Male_07', 'Chr_LegRight_Male_07', 'Chr_ArmUpperLeft_Male_17', 'Chr_ArmUpperRight_Male_17', 'Chr_ArmLowerLeft_Male_06', 'Chr_ArmLowerRight_Male_06', 'Chr_HandLeft_Male_11', 'Chr_HandRight_Male_11', 'Chr_Head_Male_18', 'Chr_HeadCoverings_No_Hair_07', 'Chr_ShoulderAttachLeft_20', 'Chr_ShoulderAttachRight_20', 'Chr_FacialHair_Male_13', 'Chr_Eyebrow_Male_03'] },
];
function buildHero(rec) {
  const grp = loadMFH();
  /* КАНОНИЧЕСКИЙ скелет: FBX содержит ~68 копий скелета, ВЛОЖЕННЫХ матрёшкой
     в общее дерево Root (каждая часть ссылается на свою урезанную копию).
     Настоящие кости = самые «мелкие» экземпляры (минимальная глубина, у них
     реальные оффсеты); вложенные копии висят под ними с нулевыми трансформами.
     Собираем чистое дерево из свежих Bone по локальным трансформам настоящих. */
  const best = new Map();/* name → {bone, depth} */
  const depth = (b) => { let d = 0, p = b.parent; while (p && p.isBone) { d++; p = p.parent; } return d; };
  grp.traverse((o) => {
    if (!o.isBone) return;
    const d = depth(o);
    const cur = best.get(o.name);
    if (!cur || d < cur.d) best.set(o.name, { bone: o, d });
  });
  /* иерархия: родитель канонической кости = канонизация ближайшего bone-предка */
  const canon = new Map();/* name → new Bone */
  const getCanon = (name) => {
    if (canon.has(name)) return canon.get(name);
    const info = best.get(name);
    if (!info) return null;
    const nb = new THREE.Bone();
    nb.name = name;
    nb.position.copy(info.bone.position);
    nb.quaternion.copy(info.bone.quaternion);
    nb.scale.copy(info.bone.scale);
    canon.set(name, nb);
    /* родитель */
    let p = info.bone.parent;
    while (p && p.isBone) {
      const par = getCanon(p.name);
      if (par) { par.add(nb); return nb; }
      p = p.parent;
    }
    model.add(nb);/* корень */
    return nb;
  };
  const model = new THREE.Group();
  model.name = rec.out;
  const boneNames = [...best.keys()];
  for (const n of boneNames) getCanon(n);
  model.updateMatrixWorld(true);

  /* части → рибинд на канонические кости */
  for (const p of rec.parts) {
    const m = grp.getObjectByName(p);
    if (!m) { console.warn('part missing:', p); continue; }
    if (!m.isSkinnedMesh) { console.warn('part not skinned:', p); continue; }
    const sm = new THREE.SkinnedMesh(m.geometry.clone(), heroMaterial(kindOfPart(m.name), rec.out));
    sm.name = m.name;
    const newBones = m.skeleton.bones.map((b) => canon.get(b.name)).filter(Boolean);
    sm.bind(new THREE.Skeleton(newBones, m.skeleton.boneInverses), m.bindMatrix);
    sm.castShadow = true;
    sm.frustumCulled = false;
    model.add(sm);
  }
/* масштаб/центр; hipCm = высота бёдер в модельных см (для ретаргета) */
  model.updateMatrixWorld(true);
  const _hipBone = model.getObjectByName('Hips');
  const _hipV = new THREE.Vector3();
  model.userData.hipCm = _hipBone ? Math.abs(_hipBone.getWorldPosition(_hipV).y) : 90;
  const preBox = new THREE.Box3().setFromObject(model);
  const preH = preBox.max.y - preBox.min.y;
  const s = rec.h / preH;
  model.scale.setScalar(s);
  const box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x * s, -box.min.y, -c.z * s);
  model.updateMatrixWorld(true);
  return model;
}
if (mode === 'heroes') {
  mkdirSync(HOUT, { recursive: true });
  const exporter = new GLTFExporter();
  for (const rec of HEROES) {
    try {
      const model = buildHero(rec);
      const skinned = [];
      model.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
      /* у каждой части СВОЯ копия скелета — треки пишем по ИМЕНАМ один раз,
         затем patchGLB размножит каналы на все одноимённые узлы */
      const seenNames = new Set();
      const dstBones = [];
      for (const sm of skinned) for (const b of sm.skeleton.bones) {
        if (!seenNames.has(b.name)) { seenNames.add(b.name); dstBones.push(b); }
      }
      const clips = [];
      for (const [role, pkg, pattern, take, hip] of A_SOURCES) {
        const src = animSource(pkg, pattern, hip);
        const names = pkg === 'doublel' ? NAMES_UE4 : NAMES_BLINK;
        const takeClip = take ? src.animations.find((c) => c.name === take)
          : src.animations.find((c) => !/^t-?pose$/i.test(c.name));
        if (!takeClip) { console.error('SKIP', role, 'no take'); continue; }
        const out = retargetClipManual(model, dstBones, src, takeClip, names, hip, 'rest-local');
        out.name = role;
        clips.push(out);
      }
      const result = await new Promise((res, rej) => exporter.parse(model, res, rej, { binary: true, animations: clips }));
      const glb = patchGLB(Buffer.from(result), {});/* герои — плоские цвета, без атласа */
      writeFileSync(HOUT + rec.out + '.glb', glb);
      console.log('OK', rec.out, (glb.length / 1024).toFixed(0) + 'KB', 'clips=' + clips.length);
    } catch (e) {
      console.error('FAIL', rec.out, e.message);
    }
  }
}
console.log('done');

/* для тестов: node --input-type=module -e "import('...bake_synty.mjs')..." c argv[2]=noop */
export { retargetClipManual, buildEnemy, buildHero, animSource, ENEMIES, HEROES, NAMES_BLINK, NAMES_UE4 };
