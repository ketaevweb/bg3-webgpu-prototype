/* pw_v25probe.cjs — диагностика G9: почему on не выключается */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30', voice: true })); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__bg3.voice().ready, null, { timeout: 30000 });
  const d = await page.evaluate(() => {
    const b = window.__bg3;
    const step1 = { prop: b.gfx.voice, on: b.voice().on };
    b.gfx.voice = false;
    const step2 = { prop: b.gfx.voice, on: b.voice().on };
    b.applyGfx();
    const step3 = { prop: b.gfx.voice, on: b.voice().on,
      ls: JSON.parse(localStorage.getItem('bg3w_gfx_v1') || '{}').voice };
    return { step1, step2, step3 };
  });
  console.log(JSON.stringify(d, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
