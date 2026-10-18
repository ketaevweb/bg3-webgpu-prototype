/* v1.7 E2E на playwright: стабильный запуск (fps 30, без блума, res 75%),
   инъекция gfx ДО скриптов страницы, скриншоты/eval без CDP-голодания. */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
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
  await page.waitForTimeout(9000);/* boot + риги */

  const stats = await page.evaluate(() => JSON.stringify(window.__bg3.animStats()));
  console.log('ANIMSTATS:', stats);

  /* камера вплотную к воину */
  await page.evaluate(() => {
    const f = window.__bg3.units.find(u => u.cls === 'fighter');
    const c = window.__bg3.cam(), t = window.__bg3.ctl();
    t.target.copy(f.mesh.position).add({ x: 0, y: 0.9, z: 0 });
    c.position.set(f.mesh.position.x - 2.6, 2.3, f.mesh.position.z + 3.8);
    t.update();
  });
  await page.waitForTimeout(800);
  // screenshot отключён: SwiftShader-петля держит main thread

  const boneY = await page.evaluate(() => {
    const f = window.__bg3.units.find(u => u.cls === 'fighter');
    let hip = null;
    f.mesh.traverse(o => { if (o.isBone && /Hips/.test(o.name) && !hip) hip = o; });
    return hip ? +hip.matrixWorld.elements[13].toFixed(3) : -1;
  });
  console.log('FIGHTER HIP Y:', boneY, '(стоя ~1.0-1.1)');

  await browser.close();
  console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
