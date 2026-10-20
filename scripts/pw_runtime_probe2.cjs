/* Рантайм-эксперимент v2: importmap + GLTFLoader.parse из ArrayBuffer. */
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  // importmap до импортов
  await page.evaluate(() => {
    const im = document.createElement('script');
    im.type = 'importmap';
    im.textContent = JSON.stringify({
      imports: {
        three: 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js',
        'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/',
      },
    });
    document.head.appendChild(im);
  });
  const rep = await page.evaluate(async () => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const SkeletonUtils = await import('three/addons/utils/SkeletonUtils.js');
    const out = {};
    const measure = (root) => {
      const get = (n) => root.getObjectByName(n);
      const sL = get('Shoulder_L'), hL = get('Hand_L'), hR = get('Hand_R');
      if (!sL || !hL) return { err: 'no bones' };
      const w1 = new THREE.Vector3(); sL.getWorldPosition(w1);
      const w2 = new THREE.Vector3(); hL.getWorldPosition(w2);
      const w3 = hR ? (hR.getWorldPosition(new THREE.Vector3()), null) : null;
      return {
        shL: [+w1.x.toFixed(2), +w1.y.toFixed(2), +w1.z.toFixed(2)],
        handL: [+w2.x.toFixed(2), +w2.y.toFixed(2), +w2.z.toFixed(2)],
        dyHandL: +(w2.y - w1.y).toFixed(3),
        dxHandL: +(w2.x - w1.x).toFixed(3),
        dzHandL: +(w2.z - w1.z).toFixed(3),
      };
    };
    for (const url of ['/models/rig/heroes/fighter.glb', '/models/rig/rivals/goblin.glb']) {
      const buf = await (await fetch(url)).arrayBuffer();
      const g = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
      const idle = g.animations.find((a) => /^idle$/i.test(a.name));
      // A) клон + idle 1с
      const cl = SkeletonUtils.clone(g.scene);
      const m = new THREE.AnimationMixer(cl);
      m.clipAction(idle).reset().play();
      m.update(1.0);
      cl.updateMatrixWorld(true);
      out[url + ' | clone idle@1s'] = measure(cl);
      // B) клон без анимации
      const cl2 = SkeletonUtils.clone(g.scene);
      cl2.updateMatrixWorld(true);
      out[url + ' | clone bind'] = measure(cl2);
      // C) исходная сцена + idle
      const m3 = new THREE.AnimationMixer(g.scene);
      m3.clipAction(idle).reset().play();
      m3.update(1.0);
      g.scene.updateMatrixWorld(true);
      out[url + ' | scene idle@1s'] = measure(g.scene);
    }
    return out;
  });
  console.log(JSON.stringify(rep, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
