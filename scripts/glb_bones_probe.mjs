import { readFileSync } from 'fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
  out.writeUInt32LE(binLen, 20 + padded.length); out.write('BIN\0', 24 + padded.length);
  buf.copy(out, 28 + padded.length, binOff, binOff + binLen);
  return out;
}
const b = readFileSync(process.argv[2] || '/tmp/soldier.glb');
const ab = stripTextures(b);
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab.buffer.slice(ab.byteOffset, ab.byteOffset + ab.byteLength), '', res, rej));
const mesh = gltf.scene.getObjectByProperty('isSkinnedMesh', true);
const names = mesh.skeleton.bones.map(x => x.name);
console.log('bones:', names.length);
console.log(names.slice(0, 6).join(' | '));
console.log('Hips name:', JSON.stringify(names.find(n => /Hips/i.test(n))));
console.log('node Hips name:', JSON.stringify(gltf.scene.getObjectByName(/Hips/.test('x') ? 'x' : names.find(n => /Hips/i.test(n)))?.name));
console.log('anims:', gltf.animations.map(a => a.name).join(', '));
console.log('tracks sample:', gltf.animations[0]?.tracks.slice(0, 3).map(t => t.name).join(' ; '));
const hip = mesh.skeleton.getBoneByName('mixamorigHips');
gltf.scene.updateMatrixWorld(true);
console.log('BEFORE pose: hip local', hip.position.toArray().map(v => +v.toFixed(3)).join(','), 'world y', hip.getWorldPosition(new THREE.Vector3()).y.toFixed(3));
mesh.skeleton.pose();
gltf.scene.updateMatrixWorld(true);
console.log('AFTER pose: hip local', hip.position.toArray().map(v => +v.toFixed(3)).join(','), 'world y', hip.getWorldPosition(new THREE.Vector3()).y.toFixed(3));
let p = hip; const chain = [];
while (p) { chain.push(p.name + '(s' + p.scale.x.toFixed(2) + ')'); p = p.parent; }
console.log('chain:', chain.join(' <- '));
console.log('mesh scale world:', mesh.getWorldScale(new THREE.Vector3()).toArray().map(v => +v.toFixed(3)).join(','));
