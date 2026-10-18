/* v1.9: DOM-скриншоты миникарты и постгейм-цитадели (page.screenshot) */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30' })); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.keyboard.press('m');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'upload/e2e/v19_mm_dom.png' });
  /* постгейм: цитадель с открытой миникартой */
  await page.evaluate(() => { window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true; window.__bg3.questDone('giants'); window.__bg3.joinHaldir(); });
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: 'upload/e2e/v19_citadel_dom.png' });
  await browser.close();
  console.log('done');
  process.exit(0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
