const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30' })); } catch {}
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type().toUpperCase() + ': ' + m.text().slice(0, 300)); });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(10000);
  const st = await page.evaluate(() => ({
    heroes: window.__bg3.units.filter(u => u.side === 'hero').map(u => u.cls + ':' + u.name),
    units: window.__bg3.units.length,
    mapId: window.__bg3.turn().mapId,
    tut: window.__bg3.tut ? JSON.stringify(window.__bg3.tut()) : 'n/a',
    log: (document.getElementById('logbody') || {}).innerText?.slice(-500),
  }));
  console.log(JSON.stringify(st, null, 1));
  console.log('--- errors (' + errs.length + ') ---');
  errs.slice(0, 12).forEach(e => console.log(e));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
