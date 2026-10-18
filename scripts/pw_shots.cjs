/* v1.7 E2E (playwright): пауза рендер-петли перед скриншотом.
   Сценарий: boot → скрин (стоя?) → шаг отряда → скрин walk → бой →
   болт (hit/death) → скрин → сейв/лоад → крипта → скрин босса. */
const { chromium } = require('playwright');
const SHOT = async (page, name) => {
  await page.evaluate(() => { const r = window.__bg3.rnd(); r.setAnimationLoop(null); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'upload/e2e/' + name, timeout: 15000 });
  await page.evaluate(() => { const r = window.__bg3.rnd(); if (!window.__pwLoop) { /* перезапуск через reload-независимый путь */ } r.setAnimationLoop(window.__pwLoop || (t => {})); });
  await page.waitForTimeout(200);
};
const LOOP_KEEP = () => {
  /* сохраняем ссылку на игровой loop: берём её из первого кадра —
     проще: перед паузой подменяем setAnimationLoop, чтобы поймать колбэк */
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

  /* ловим колбэк loop: оборачиваем setAnimationLoop ДО загрузки игры */
  await page.addInitScript(() => {
    window.__pwLoop = null;
    const orig = Object.getPrototypeOf(document.createElement('canvas')).constructor;/* noop */
    const patch = () => {
      const c = document.querySelector('canvas');
      if (!c) { setTimeout(patch, 50); return; }
      /* WebGPURenderer использует собственный rAF-цикл через setAnimationLoop —
         перехватываем через requestAnimationFrame обёртку ниже (rnd-pause/resume). */
    };
    setTimeout(patch, 100);
  });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);

  console.log('ANIMSTATS:', await page.evaluate(() => JSON.stringify(window.__bg3.animStats())));

  /* резюм-заглушка: после паузы продолжаем рендер вручную (render раз в 200мс) */
  const resume = async () => {
    await page.evaluate(() => {
      const r = window.__bg3.rnd();
      if (window.__pwTimer) clearInterval(window.__pwTimer);
      window.__pwTimer = setInterval(() => { try { r.render(window.__sceneRef || window.__bg3.units[0].mesh.parent || undefined, window.__bg3.cam()); } catch {} }, 250);
    });
  };
  const pause = async () => {
    await page.evaluate(() => {
      const r = window.__bg3.rnd();
      r.setAnimationLoop(null);
      if (window.__pwTimer) clearInterval(window.__pwTimer);
    });
    await page.waitForTimeout(350);
  };

  await pause();
  await page.evaluate(() => {
    const f = window.__bg3.units.find(u => u.cls === 'fighter');
    const c = window.__bg3.cam(), t = window.__bg3.ctl();
    t.target.copy(f.mesh.position).add({ x: 0, y: 0.9, z: 0 });
    c.position.set(f.mesh.position.x - 2.6, 2.3, f.mesh.position.z + 3.8);
    t.update();
  });
  await page.evaluate(() => { const r = window.__bg3.rnd(); r.render; });
  /* один кадр вручную: нет доступа к scene/loop — использую перерисовку через resume-таймер */
  await resume();
  await page.waitForTimeout(600);
  await pause();
  await page.screenshot({ path: 'upload/e2e/pw_boot.png', timeout: 15000 });
  console.log('SHOT boot ok');

  await browser.close();
  console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
