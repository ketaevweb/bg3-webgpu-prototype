/* 4 ракурса вокруг бойца (живой цикл) + мёртвый гоблин-труп. */
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 500 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'mid', res: '100', fps: '30', voice: false, vol: '0' })); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__bg3.animStats().rigs.rigs >= 4, null, { timeout: 45000 });
  await sleep(2500);
  const angles = [['front', 0, 2.6], ['back', Math.PI, 2.6], ['left', Math.PI / 2, 2.6], ['right', -Math.PI / 2, 2.6]];
  for (const [name, a, dist] of angles) {
    await page.evaluate(([nm, ang, d]) => {
      const f = window.__bg3.units.find((x) => x.cls === 'fighter');
      const c = window.__bg3.cam(), t = window.__bg3.ctl();
      t.target.copy(f.mesh.position).add({ x: 0, y: 0.9, z: 0 });
      c.position.set(f.mesh.position.x + Math.sin(ang) * d, 1.4, f.mesh.position.z + Math.cos(ang) * d);
      t.update();
    }, [name, a, dist]);
    await sleep(700);
    await page.screenshot({ path: `upload/e2e/probe_fighter_${name}.jpg` });
    console.log('SHOT', name);
  }
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
