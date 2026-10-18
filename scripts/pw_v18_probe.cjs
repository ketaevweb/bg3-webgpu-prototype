/* v1.8 probe: где зависает боевой цикл на карте цитадели? */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30' })); } catch {}
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errs.push('CONSOLE: ' + m.text()); });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => { window.__bg3.questDone('main'); window.__bg3.questDone('crypt'); window.__bg3.questDone('swamp'); window.__bg3.questDone('giants'); });
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const b = window.__bg3;
    for (const u of b.S.citadelGroup) if (u.alive && !u.citadelBoss) u.hp = 2;
    b.startCombat(b.S.citadelGroup.filter(u => u.alive));
  });
  let last = '';
  for (let i = 0; i < 60; i++) {
    const st = await page.evaluate(() => {
      const b = window.__bg3;
      const cur = b.units.find(u => u.side === 'hero') && null; /* current не экспонирован — косвенно */
      const t = window.__bg3.turn();
      const m = b.units.find(u => u.citadelBoss);
      return { phase: t.phase, on: t.combatOn, hero: t.hero, act: t.action, round: t.round,
        boss: m ? (m.x + ',' + m.z + ' hp' + m.hp + ' alive:' + m.alive) : 'gone',
        enemies: b.units.filter(u => u.side === 'goblin' && u.alive).length };
    });
    const key = JSON.stringify(st);
    if (key !== last) { console.log(i, key); last = key; }
    await page.waitForTimeout(700);
  }
  console.log('ERRS:', errs.length ? errs.slice(0, 5) : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
