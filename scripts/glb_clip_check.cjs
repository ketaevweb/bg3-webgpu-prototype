/* Парс GLB без three: клипы vs ноды скелета. */
const fs = require('fs');
function parseGlb(path) {
  const buf = fs.readFileSync(path);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  return json;
}
for (const p of process.argv.slice(2)) {
  const j = parseGlb(p);
  const nodeNames = (j.nodes || []).map((n, i) => n.name ?? ('node' + i));
  console.log('\n=== ' + p + ' ===');
  console.log('nodes:', nodeNames.length);
  (j.skins || []).forEach((s, si) => console.log(`skin[${si}]: joints=${s.joints.length} first=${s.joints.slice(0, 6).map((x) => nodeNames[x]).join(',')}`));
  const jointsAll = new Set((j.skins || []).flatMap((s) => s.joints));
  const armBones = nodeNames.filter((n) => /Arm|Hand|Leg|Foot/i.test(n));
  console.log('arm/leg bones in nodes:', armBones.length, '→ in skin:', armBones.filter((n) => jointsAll.has(nodeNames.indexOf(n))).length);
  const anims = j.animations || [];
  console.log('clips:', anims.length);
  for (const a of anims.slice(0, 3)) {
    const chans = a.channels || [];
    const targets = [...new Set(chans.map((c) => c.target.node))];
    console.log(`  ${a.name ?? 'clip'}: chans=${chans.length} targets=${targets.length}`);
  }
}
