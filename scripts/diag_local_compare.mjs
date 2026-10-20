/* Сравнение: локальные кватернионы при сэмплинге vs треки в свежем GLB. */
import { buildHero, animSource, HEROES, NAMES_BLINK } from './bake_synty.mjs';
import * as THREE from 'three';
import { readFileSync } from 'fs';

/* --- 1) свежий ретаргет idle: сэмплим и ловим локали на середине --- */
import { retargetClipManual } from './bake_synty.mjs';
const rec = HEROES.find((h) => h.out === 'fighter');
const hero = buildHero(rec);
const skinned = [];
hero.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
const seen = new Set(); const dstBones = [];
for (const sm of skinned) for (const b of sm.skeleton.bones) if (!seen.has(b.name)) { seen.add(b.name); dstBones.push(b); }
const src = animSource('blink32', 'Movement/Idle.fbx', 'Root_M');
const idleClip = src.animations.find((c) => c.name === 'human_male_idle_01');
/* перехват mixer.update? проще: повторить шаги retarget вручную нельзя — но треки
   в возвращённом клипе и есть сэмплы. Просто сравним клип vs GLB-файл. */
const outClip = retargetClipManual(hero, dstBones, src, idleClip, NAMES_BLINK, 'Root_M', 'rest-local');
outClip.name = 'idle';
const track = outClip.tracks.find((t) => t.name === 'Shoulder_L.quaternion');
const times = track.times;
const mid = Math.floor(times.length / 2);
const bakeLocal = [track.values[mid * 4], track.values[mid * 4 + 1], track.values[mid * 4 + 2], track.values[mid * 4 + 3]];

/* --- 2) GLB файл: idle, Shoulder_L, тот же индекс --- */
const buf = readFileSync('/home/z/my-project/public/models/rig/heroes/fighter.glb');
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
const anim = json.animations.find((a) => a.name === 'idle');
const names = json.nodes.map((n, i) => n.name ?? 'node' + i);
const comp = (s) => {
  const acc = json.accessors[s.output];
  const bv = json.bufferViews[acc.bufferView];
  const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const o = start + i * 16;
    out.push([0, 1, 2, 3].map((k) => +buf.readFloatLE(o + k * 4).toFixed(3)));
  }
  return out;
};
let glbVals = null, glbCount = 0, glbT0 = 0, glbDt = 0;
for (const ch of anim.channels) {
  const nm = names[ch.target.node];
  if (nm !== 'Shoulder_L' || ch.target.path !== 'rotation') continue;
  const s = anim.samplers[ch.sampler];
  glbVals = comp(s);
  const tAcc = json.accessors[s.input];
  const bv = json.bufferViews[tAcc.bufferView];
  const start = (bv.byteOffset || 0) + (tAcc.byteOffset || 0);
  glbCount = tAcc.count;
  glbT0 = buf.readFloatLE(start);
  glbDt = glbCount > 1 ? (buf.readFloatLE(start + (glbCount - 1) * 4) - glbT0) / (glbCount - 1) : 0;
}
console.log('bake track : frames=', times.length, 'mid local=', bakeLocal.map((v) => +v.toFixed(3)));
console.log('glb  track : frames=', glbCount, 'mid local=', glbVals[Math.floor(glbCount / 2)] ?? glbVals[0]);
console.log('bake t0..T :', +times[0].toFixed(3), '..', +times[times.length - 1].toFixed(3));
console.log('glb  t0,dT :', glbT0.toFixed(3), glbDt.toFixed(4));
console.log('bake first local=', [track.values[0], track.values[1], track.values[2], track.values[3]].map((v) => +v.toFixed(3)));
console.log('glb  first local=', glbVals[0]);
