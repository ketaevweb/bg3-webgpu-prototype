/* Проба GLB героев: имена клипов, префиксы треков, кости скелета. */
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await sleep(1000);
  const rep = await page.evaluate(async () => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const out = {};
    for (const url of ['/models/rig/heroes/fighter.glb', '/models/rig/heroes/wizard.glb', '/models/rig/rivals/goblin.glb']) {
      const g = await new GLTFLoader().loadAsync(url);
      const bones = [];
      g.scene.traverse((o) => { if (o.isBone) bones.push(o.name); });
      const clips = g.animations.map((c) => {
        const prefixes = [...new Set(c.tracks.map((t) => t.name.split('.')[0]))];
        const bound = prefixes.filter((p) => bones.includes(p)).length;
        return { name: c.name, dur: +c.duration.toFixed(2), tracks: c.tracks.length, nodes: prefixes.length, bound };
      });
      out[url] = { bones: bones.length, rootBones: bones.slice(0, 8), clips };
    }
    return out;
  });
  console.log(JSON.stringify(rep, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
