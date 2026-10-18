/* v1.7 E2E (playwright): снимки через синхронный render+toDataURL в одном таске. */
const fs = require('fs');
const { chromium } = require('playwright');

const shot = async (page, name) => {
  const data = await page.evaluate(() => {
    window.__bg3.loopStop();
    const r = window.__bg3.rnd(), s = window.__bg3.scn(), c = window.__bg3.cam();
    r.render(s, c);
    const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.82);
    return url;
  });
  fs.writeFileSync('upload/e2e/' + name, Buffer.from(data.split(',')[1], 'base64'));
};

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '75', fps: '30' })); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  console.log('ANIMSTATS:', await page.evaluate(() => JSON.stringify(window.__bg3.animStats())));

  await page.evaluate(() => {
    const f = window.__bg3.units.find(u => u.cls === 'fighter');
    const c = window.__bg3.cam(), t = window.__bg3.ctl();
    t.target.copy(f.mesh.position).add({ x: 0, y: 0.9, z: 0 });
    c.position.set(f.mesh.position.x - 2.6, 2.3, f.mesh.position.z + 3.8);
    t.update();
  });
  await shot(page, 'g1_boot.jpg');
  console.log('G1 boot shot ok');

  await page.evaluate(() => window.__bg3.loopStart());
  await page.evaluate(() => window.__bg3.moveParty(17, 19));
  await page.waitForTimeout(650);
  console.log('G2 walk anims:', await page.evaluate(() => JSON.stringify(window.__bg3.units.filter(u => u.side === 'hero').map(u => u._currentAnim))));
  await shot(page, 'g2_walk.jpg');

  await page.waitForTimeout(3500);
  await page.evaluate(() => window.__bg3.startCombat(window.__bg3.S.campGroup));
  await page.waitForTimeout(900);
  console.log('G3 combat:', await page.evaluate(() => JSON.stringify({
    inCombat: window.__bg3.units.filter(u => u.inCombat).length,
    heroAnim: window.__bg3.units.filter(u => u.side === 'hero').map(u => u._currentAnim),
  })));

  await browser.close();
  console.log('ERRORS:', errors.length ? errors.slice(0, 6) : 'none');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
