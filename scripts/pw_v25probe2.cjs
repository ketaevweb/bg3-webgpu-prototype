/* pw_v25probe2.cjs — таймлайн арены после вайпа: wave/best/combat/phase */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30', voice: false })); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true;
    window.__bg3.questDone('giants');
    return window.__bg3.switchMap('citadel');
  });
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__bg3.forceSeason(0));
  await page.evaluate(() => window.__bg3.arenaEndless());
  await page.waitForFunction(() => window.__bg3.turn().combatOn, null, { timeout: 30000 });
  await page.evaluate(() => window.__bg3.arenaWipe());
  for (let i = 0; i < 14; i++) {
    const s = await page.evaluate(() => ({
      t: Date.now() % 100000, wave: window.__bg3.arenaState().wave,
      best: window.__bg3.S.arenaBest, combat: window.__bg3.turn().combatOn,
      phase: window.__bg3.turn().phase,
    }));
    console.log(JSON.stringify(s));
    await page.waitForTimeout(500);
  }
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
