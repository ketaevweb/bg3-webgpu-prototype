/* Диагностика fullscreen: клик + F с поллингом состояния. */
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'mid', res: '75', fps: '30', voice: false, vol: '0' })); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 90000 });
  await sleep(4000);

  await page.click('#fsBtn');
  await sleep(800);
  console.log('after click:', await page.evaluate(() => ({ on: window.__bg3.fs().on, el: !!document.fullscreenElement })));

  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' })));
  for (let i = 0; i < 12; i++) {
    await sleep(500);
    const st = await page.evaluate(() => ({ on: window.__bg3.fs().on, el: !!document.fullscreenElement }));
    if (!st.on) { console.log('F turned OFF at', (i + 1) * 500, 'ms', JSON.stringify(st)); break; }
    if (i === 11) console.log('F never turned OFF:', JSON.stringify(st));
  }
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'а' })));
  for (let i = 0; i < 14; i++) {
    await sleep(500);
    const st = await page.evaluate(() => ({ on: window.__bg3.fs().on, el: !!document.fullscreenElement }));
    if (st.on) { console.log('а turned ON at', (i + 1) * 500, 'ms', JSON.stringify(st)); break; }
    if (i === 13) console.log('а never turned ON:', JSON.stringify(st));
  }
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
