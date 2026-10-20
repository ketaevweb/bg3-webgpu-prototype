/* Числовой тест: цепочка Hips→Shoulder_L при ресте и после idle, ручная сборка из файла. */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 320, height: 320 } })).newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.evaluate(() => {
    const im = document.createElement('script');
    im.type = 'importmap';
    im.textContent = JSON.stringify({
      imports: { three: 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js', 'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/' },
    });
    document.head.appendChild(im);
  });
  const rep = await page.evaluate(async () => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const buf = await (await fetch('/models/rig/heroes/fighter.glb?v=2')).arrayBuffer();
    const g = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
    const model = g.scene;
    const CHAIN = ['Hips', 'Spine_01', 'Spine_02', 'Spine_03', 'Clavicle_L', 'Shoulder_L', 'Elbow_L', 'Hand_L'];
    const loc = (t) => CHAIN.map((n) => {
      const b = model.getObjectByName(n);
      return `${n}:[${[b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w].map((v) => +v.toFixed(2))}]`;
    }).join(' ');
    const dy = () => {
      const s = model.getObjectByName('Shoulder_L'), w = model.getObjectByName('Hand_L');
      model.updateMatrixWorld(true);
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      s.getWorldPosition(a); w.getWorldPosition(b);
      return +(b.y - a.y).toFixed(3);
    };
    const out = {};
    out.rest_dy = dy();
    out.rest_chain = loc();
    const idle = g.animations.find((a) => /^idle$/i.test(a.name));
    const m = new THREE.AnimationMixer(model);
    m.clipAction(idle).reset().play();
    m.update(0.735);
    out.idle_dy = dy();
    out.idle_chain = loc();
    // сколько треков в клипе и на какие ноды
    out.tracks = idle.tracks.map((t) => t.name.split('.')[0]);
    // сравним: локаль Shoulder_L из трека в t=0.735
    const tr = idle.tracks.find((t) => t.name === 'Shoulder_L.quaternion');
    const ev = tr.createInterpolant().evaluate(0.735);
    const v = new THREE.Quaternion(ev[0], ev[1], ev[2], ev[3]);
    out.trackShoulderAtMid = [v.x, v.y, v.z, v.w].map((x) => +x.toFixed(3));
    const bone = model.getObjectByName('Shoulder_L');
    out.boneLocalAtMid = [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w].map((x) => +x.toFixed(3));
    // мировые кватернионы цепочки после апдейта
    const wq = (n) => { const b = model.getObjectByName(n); return b.getWorldQuaternion(new THREE.Quaternion()).toArray().map((x) => +x.toFixed(2)); };
    out.worldShoulder = wq('Shoulder_L');
    return out;
  });
  console.log(JSON.stringify(rep, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
