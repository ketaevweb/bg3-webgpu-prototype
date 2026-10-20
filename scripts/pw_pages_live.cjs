/* Контроль Pages: сцена «лагерь Костей» с живого сайта. */
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1568, height: 882 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'mid', res: '100', fps: '30', voice: false, vol: '0' })); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto('https://ketaevweb.github.io/bg3-webgpu-prototype/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 90000 });
  await page.waitForFunction(() => {
    try { return window.__bg3.animStats().rigs.rigs >= 4; } catch { return false; }
  }, null, { timeout: 90000 });
  await sleep(4000);
  await page.evaluate(() => {
    const c = window.__bg3.cam(), t = window.__bg3.ctl();
    const TILE = 1.6, H = 15.5;
    t.target.set((15.5 - H) * TILE, 0.6, (22 - H) * TILE);
    c.position.set((15.5 - H) * TILE + 2.2, 7.5, (22 - H) * TILE + 6.5);
    t.update();
  });
  await sleep(1500);
  await page.screenshot({ path: 'upload/e2e/pages_live_v32.jpg', quality: 88 });
  console.log('SHOT pages_live');
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
