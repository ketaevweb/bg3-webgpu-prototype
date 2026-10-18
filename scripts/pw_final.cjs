/* v1.7 E2E: снимки = loopStop → прямая камера (position+lookAt) → sync render → toDataURL. */
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30' })); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  console.log('ANIMSTATS:', await page.evaluate(() => JSON.stringify(window.__bg3.animStats())));

  const snap = async (name, camExpr) => {
    const url = await page.evaluate(async (expr) => {
      window.__bg3.loopStop();
      const c = window.__bg3.cam();
      const f = new Function('__bg3', expr);
      f(window.__bg3);
      c.updateProjectionMatrix();
      const r = window.__bg3.rnd(), s = window.__bg3.scn();
      if (r.renderAsync) await r.renderAsync(s, c); else r.render(s, c);
      return document.querySelector('canvas').toDataURL('image/jpeg', 0.82);
    }, camExpr);
    fs.writeFileSync('upload/e2e/' + name, Buffer.from(url.split(',')[1], 'base64'));
    await page.evaluate(() => window.__bg3.loopStart());
    await page.waitForTimeout(150);
  };

  await snap('f1_boot.jpg', `
    const f=__bg3.units.find(u=>u.cls==='fighter');
    const c=__bg3.cam();
    const dir=c.getWorldDirection(new (Object.getPrototypeOf(c.position).constructor)());
    f.mesh.position.copy(c.position).add(dir.multiplyScalar(6));
    f.mesh.position.y=0;
    c.lookAt(f.mesh.position.x,0.9,f.mesh.position.z);
  `);
  console.log('F1 ok');

  /* walk: шаг отряда, кадр в движении */
  await page.evaluate(() => window.__bg3.moveParty(17, 19));
  await page.waitForTimeout(600);
  const an = await page.evaluate(() => JSON.stringify(window.__bg3.units.filter(u => u.side === 'hero').map(u => u._currentAnim)));
  console.log('WALK anims:', an);
  await snap('f2_walk.jpg', `
    const c=__bg3.cam();
    c.position.set(11.2,6.5,-2.0);
    c.lookAt(11.2,0.4,-11.5);
  `);
  console.log('F2 ok');

  await browser.close();
  console.log('ERRORS:', errors.length ? errors.slice(0, 6) : 'none');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
