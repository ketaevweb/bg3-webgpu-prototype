/* Сэмплим кватернионы idle-клипа против бинд-ротаций нод. */
const fs = require('fs');
function parseGlb(p) {
  const buf = fs.readFileSync(p);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  // бинарный чанк
  const off = 20 + jsonLen;
  const binLen = buf.readUInt32LE(off);
  const bin = buf.slice(off + 8, off + 8 + binLen);
  return { json, bin };
}
function readAcc(json, bin, idx) {
  const acc = json.accessors[idx];
  const bv = json.bufferViews[acc.bufferView];
  const comp = { 5126: 4, 5123: 2 }[acc.componentType];
  const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[acc.type];
  const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const o = start + i * n * comp;
    const v = [];
    for (let k = 0; k < n; k++) v.push(comp === 4 ? bin.readFloatLE(o + k * 4) : bin.readUInt16LE(o + k * 2));
    out.push(n === 1 ? v[0] : v);
  }
  return out;
}
const qEq = (a, b, eps = 0.01) => {
  if (!a || !b) return false;
  const d = Math.abs(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3]);
  return d > 1 - eps; // |dot| близко к 1 (с точностью до знака)
};
for (const p of process.argv.slice(2)) {
  const { json, bin } = parseGlb(p);
  const names = json.nodes.map((n, i) => n.name ?? 'node' + i);
  const a = (json.animations || []).find((x) => x.name === 'idle');
  console.log('\n=== ' + p + ' ===');
  for (const ch of a.channels) {
    const nm = names[ch.target.node];
    if (!/Shoulder_L$|Elbow_L$|UpperLeg_L$|Hips$|Spine_01$/.test(nm || '')) continue;
    const s = a.samplers[ch.sampler];
    const times = readAcc(json, bin, s.input);
    const vals = readAcc(json, bin, s.output);
    const node = json.nodes[ch.target.node];
    const bind = node.rotation;
    const first = vals[0], mid = vals[Math.floor(vals.length / 2)], last = vals[vals.length - 1];
    const eqBind = qEq(first, bind);
    const flat = first && Math.abs(first[0]) < 0.02 && Math.abs(first[1]) < 0.02 && Math.abs(first[2]) < 0.02 && Math.abs(Math.abs(first[3]) - 1) < 0.02;
    console.log(`${nm}: bind=[${(bind||[]).map(v=>+v.toFixed(3))}] clipT0=[${first.map(v=>+v.toFixed(3))}] mid=[${mid.map(v=>+v.toFixed(3))}] last=[${last.map(v=>+v.toFixed(3))}] eqBind=${eqBind} identity=${flat} dur=${times[times.length-1].toFixed(2)}s`);
  }
}
