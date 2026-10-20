/* Диагностика: живые кадры (без loopStop) с ракурса пользователя + дамп моделей юнитов. */
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1568, height: 882 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'mid', res: '100', fps: '30', voice: false, vol: '0' })); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => {
    const a = window.__bg3.animStats();
    return a.rigs.units >= 4 && a.rigs.synty >= 3;
  }, null, { timeout: 45000 });
  await sleep(3000);

  /* Дамп: каждый юнит — класс, сторона, тип меша, сколько скиннинга, текущий клип */
  const dump = await page.evaluate(() => {
    const out = [];
    for (const u of window.__bg3.units) {
      const info = { name: u.name, cls: u.cls || u.unitCls, side: u.side, dead: !!u.dead };
      const m = u.mesh;
      if (m) {
        let skinned = 0, meshes = 0, caps = 0;
        m.traverse((o) => {
          if (o.isMesh || o.isSkinnedMesh) {
            meshes++;
            if (o.isSkinnedMesh) skinned++;
            const g = o.geometry;
            if (g && g.attributes.position) {
              const bb = g.boundingBox || (g.computeBoundingBox(), g.boundingBox);
              const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z;
              if (Math.abs(sx - sz) < 0.08 && sx < 0.8 && sy > sx) caps++;
            }
          }
        });
        info.meshes = meshes; info.skinned = skinned; info.capsuleLike = caps;
      }
      if (u.mixer) { try { info.clip = (u.mixer._activeClip && u.mixer._activeClip.getClip().name) || undefined; } catch {} }
      out.push(info);
    }
    return out;
  });
  console.log('UNITS:', JSON.stringify(dump, null, 1));

  /* Живой кадр №1: ракурс пользователя (лагерь Костей, герои у сундука) */
  await page.evaluate(() => {
    const t = window.__bg3.ctl(), c = window.__bg3.cam();
    t.target.set(0, 0.6, 0);
    c.position.set(1.5, 9, 7.5);
    t.update();
  });
  await sleep(1200);
  await page.screenshot({ path: 'upload/e2e/probe_live_userangle.jpg' });
  console.log('SHOT live_userangle');

  /* Живой кадр №2: крупный план героев (живой цикл, idle играет) */
  await page.evaluate(() => {
    const f = window.__bg3.units.find((u) => u.cls === 'fighter') || window.__bg3.units.find((u) => u.side === 'hero');
    const c = window.__bg3.cam(), t = window.__bg3.ctl();
    t.target.copy(f.mesh.position).add({ x: 0, y: 1.0, z: 0 });
    c.position.set(f.mesh.position.x - 2.2, 1.9, f.mesh.position.z + 3.2);
    t.update();
  });
  await sleep(1500);
  await page.screenshot({ path: 'upload/e2e/probe_live_heroes.jpg' });
  console.log('SHOT live_heroes');

  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
