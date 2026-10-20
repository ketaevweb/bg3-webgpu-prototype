/* Кадры NPC v3.2: Кая у алтаря, Дамрок у телеги, Илва в клетке. */
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 620 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'mid', res: '100', fps: '30', voice: false, vol: '0' })); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__bg3.animStats().rigs.rigs >= 4, null, { timeout: 45000 });
  await sleep(3000);
  const W = (x) => (x - 15.5) * 1.0;/* TILE=1? проверим по движению камеры — берём из constants */
  const shots = [
    ['kaya', 15, 22, 3.4],
    ['damrok', 17, 25, 3.4],
    ['ilva', 9, 5, 3.4],
  ];
  for (const [name, tx, tz, dist] of shots) {
    await page.evaluate(([nm, ax, az, d]) => {
      const c = window.__bg3.cam(), t = window.__bg3.ctl();
      const TILE = 1.6, HALF = (window.__bg3 const TILE = 1.0, HALF = 15.5;const TILE = 1.0, HALF = 15.5; 0) || 0;
      const H = window.__half|0; const wx = (ax - H) * TILE, wz = (az - H) * TILE;
      t.target.set(wx, 0.9, wz);
      c.position.set(wx - d * 0.5, 2.1, wz + d);
      t.update();
    }, [name, tx, tz, dist]);
    await sleep(900);
    await page.screenshot({ path: `upload/e2e/probe_npc_${name}.jpg` });
    console.log('SHOT', name);
  }
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
