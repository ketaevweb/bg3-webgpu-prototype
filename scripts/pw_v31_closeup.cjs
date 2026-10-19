/* v3.1 крупный план: герои у костра + враги — камера вручную. */
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
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
  await sleep(2500);

  /* крупный план героев у костра */
  await page.evaluate(() => {
    window.__bg3.loopStop();
    const f = window.__bg3.units.find((u) => u.cls === 'fighter') || window.__bg3.units.find((u) => u.side === 'hero');
    const c = window.__bg3.cam(), t = window.__bg3.ctl();
    t.target.copy(f.mesh.position).add({ x: 0, y: 1.0, z: 0 });
    c.position.set(f.mesh.position.x - 2.2, 1.9, f.mesh.position.z + 3.2);
    t.update();
    const r = window.__bg3.rnd(), s = window.__bg3.scn();
    r.render(s, c);
  });
  await page.screenshot({ path: 'upload/e2e/v31_closeup_heroes.jpg' });
  console.log('SHOT heroes');

  /* группа: все юниты лагеря сверху-сбоку */
  await page.evaluate(() => {
    const c = window.__bg3.cam(), t = window.__bg3.ctl();
    t.target.set(0, 0.8, 0);
    c.position.set(-4.5, 4.5, 6.5);
    t.update();
    const r = window.__bg3.rnd(), s = window.__bg3.scn();
    r.render(s, c);
  });
  await page.screenshot({ path: 'upload/e2e/v31_closeup_group.jpg' });
  console.log('SHOT group');
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
