/* Эталон: fighter.glb, каждый клип — кадр на белом фоне (WebGL, изолированно от игры). */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 480, height: 480 } })).newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
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
  const shots = await page.evaluate(async () => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const SkeletonUtils = await import('three/addons/utils/SkeletonUtils.js');
    const buf = await (await fetch('/models/rig/heroes/fighter.glb')).arrayBuffer();
    const g = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
    const model = SkeletonUtils.clone(g.scene);
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x334433);
    sc.add(model);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x445544, 2.2); sc.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 2.0); dir.position.set(2, 4, 3); sc.add(dir);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    cam.position.set(0, 1.1, 3.2);
    cam.lookAt(0, 0.95, 0);
    const rd = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    rd.setSize(480, 480);
    document.body.innerHTML = '';
    document.body.appendChild(rd.domElement);
    document.body.style.margin = '0';
    const mixer = new THREE.AnimationMixer(model);
    const out = [];
    for (const clip of g.animations) {
      const a = mixer.clipAction(clip);
      a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
      a.play();
      mixer.setTime(clip.duration * 0.45);
      model.updateMatrixWorld(true);
      rd.render(sc, cam);
      out.push(clip.name);
      await new Promise((r) => setTimeout(r, 30));
      const data = rd.domElement.toDataURL('image/jpeg', 0.8);
      a.stop(); a.reset();
      window.__shots = window.__shots || [];
      window.__shots.push(data);
    }
    return out;
  });
  fs.mkdirSync('upload/e2e/clips', { recursive: true });
  const b64s = await page.evaluate(() => window.__shots);
  b64s.forEach((d, i) => fs.writeFileSync(`upload/e2e/clips/fig_${shots[i]}.jpg`, Buffer.from(d.split(',')[1], 'base64')));
  console.log('SAVED', shots.join(','));
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
