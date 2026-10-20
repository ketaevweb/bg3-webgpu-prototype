/* Диагноз T-pose: таргеты анимаций vs джоинты всех скинов + иерархия. */
const fs = require('fs');
function parseGlb(p) {
  const buf = fs.readFileSync(p);
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
}
for (const p of process.argv.slice(2)) {
  const j = parseGlb(p);
  const names = (j.nodes || []).map((n, i) => n.name ?? 'node' + i);
  const skins = j.skins || [];
  const jointSet = new Set(skins.flatMap((s) => s.joints));
  console.log('\n=== ' + p + ' ===');
  // иерархия: кто родитель скелетных нод
  const parent = new Map();
  (j.nodes || []).forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
  const anims = j.animations || [];
  const a = anims.find((x) => x.name === 'idle') || anims[0];
  if (!a) continue;
  const targets = [...new Set(a.channels.map((c) => c.target.node))];
  const notJoint = targets.filter((t) => !jointSet.has(t));
  const hasParent = targets.filter((t) => parent.has(t));
  console.log('idle targets:', targets.length, '→ NOT in any skin:', notJoint.length);
  if (notJoint.length) console.log('  not-joint targets:', notJoint.map((t) => `${names[t]}(#{${t}})`).slice(0, 25).join(', '));
  // у мешей: skin index
  const meshes = (j.nodes || []).filter((n) => n.mesh !== undefined && n.skin !== undefined);
  console.log('skinned meshes:', meshes.length, 'skins used:', [...new Set(meshes.map((m) => m.skin))].join(','));
  // сэмплы ротаций idle для Shoulder_L/UpperArm: есть ли ненулевые кватернионы
  for (const ch of a.channels) {
    const nm = names[ch.target.node];
    if (/Shoulder_L$|Elbow_L$|UpperLeg_L$/.test(nm || '')) {
      const samp = a.samplers[ch.sampler];
      const acc = j.accessors[samp.output];
      console.log(`  ${nm}: path=${ch.target.path} out acc count=${acc.count} hasMin=${!!acc.min} hasMax=${!!acc.max}`);
    }
  }
}
