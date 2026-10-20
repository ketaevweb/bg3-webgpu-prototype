/* Рантайм-эксперимент: fighter.glb в браузере — clone vs без clone, idle 1с,
 * меряем мировую позицию Hand_L относительно Shoulder_L (T-pose = dy≈0, рука горизонтальна). */
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  // перехватываем fetch: /models/... отдаём локальными файлами (минимум зависимостей)
  await page.route('**/models/rig/**', (route) => {
    const url = new URL(route.request().url());
    const fp = path.join(process.cwd(), 'public', decodeURIComponent(url.pathname).replace(/^\/bg3-webgpu-prototype/, ''));
    if (fs.existsSync(fp)) route.fulfill({ body: fs.readFileSync(fp).toString('base64'), encoding: 'base64' });
    else route.abort();
  });
  await page.goto('about:blank');
  // модульный эксперимент прямо на about:blank с локальным three (serve через data URL нельзя — используем dev-сервер)
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  const rep = await page.evaluate(async () => {
    const THREE = await import('/_next/static/chunks/…').catch(() => null); // не сработает — используем окно приложения
    return null;
  });
  // Импортим three с dev-сервера невозможно; грузим с CDN-эсмоха unpgk — но офлайн? Пробуем jsdelivr (RIG_FALLBACK работает).
  const rep2 = await page.evaluate(async () => {
    const out = {};
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
    const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js');
    const SkeletonUtils = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/utils/SkeletonUtils.js');
    const loader = new GLTFLoader();
    const measure = (root) => {
      const get = (n) => root.getObjectByName(n);
      const sL = get('Shoulder_L'), hL = get('Hand_L'), hR = get('Hand_R');
      if (!sL || !hL) return { err: 'no bones', names: ['Shoulder_L', 'Hand_L'].map((n) => !!get(n)) };
      const w1 = new THREE.Vector3(); sL.getWorldPosition(w1);
      const w2 = new THREE.Vector3(); hL.getWorldPosition(w2);
      const w3 = new THREE.Vector3(); if (hR) hR.getWorldPosition(w3);
      return {
        shL: w1.toArray().map((v) => +v.toFixed(3)),
        handL: w2.toArray().map((v) => +v.toFixed(3)),
        dyL: +(w2.y - w1.y).toFixed(3),
        dyR: hR ? +(w3.y - w1.y).toFixed(3) : null,
        rootScale: root.scale.x, rootPos: root.position.toArray().map((v) => +v.toFixed(3)),
      };
    };
    for (const url of ['/models/rig/heroes/fighter.glb', '/models/rig/rivals/goblin.glb']) {
      const g = await loader.loadAsync(url);
      // A) без клона
      const sc = g.scene;
      const m1 = new THREE.AnimationMixer(sc);
      const idle = g.animations.find((a) => /^idle$/i.test(a.name));
      m1.clipAction(idle).reset().play();
      m1.update(1.0);
      sc.updateMatrixWorld(true);
      out[url + ' | noclip-noclone'] = measure(sc.parent ? sc : (() => { const w = new THREE.Group(); return sc; })());
      // меряем в исходной сцене без mixer:
      const m0 = new THREE.AnimationMixer(sc); // (тот же sc, но уже поиграно)
      out[url + ' | idle@1s NOclone'] = measure(sc);
      // B) с SkeletonUtils.clone
      const cl = SkeletonUtils.clone(sc);
      const m2 = new THREE.AnimationMixer(cl);
      m2.clipAction(idle).reset().play();
      m2.update(1.0);
      cl.updateMatrixWorld(true);
      out[url + ' | idle@1s CLONE'] = measure(cl);
      // C) клон без анимации (бинд-поза)
      const cl2 = SkeletonUtils.clone(sc);
      cl2.updateMatrixWorld(true);
      out[url + ' | bind CLONE'] = measure(cl2);
    }
    return out;
  });
  console.log(JSON.stringify(rep2, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
