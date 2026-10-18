const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30' })); } catch {} });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  const info = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')].map(c => ({ w: c.width, h: c.height, cls: c.className || '-', id: c.id || '-' }));
    const c = window.__bg3.cam();
    const pos = c.position.toArray().map(v => +v.toFixed(1));
    window.__bg3.loopStop();
    const r = window.__bg3.rnd(), s = window.__bg3.scn();
    r.render(s, c);
    return { canvases, camPos: pos, fov: c.fov, aspect: +c.aspect.toFixed(2), sceneChildren: s.children.length, units: window.__bg3.units.length };
  });
  console.log(JSON.stringify(info));
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); });
