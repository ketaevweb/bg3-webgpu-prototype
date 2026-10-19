/* v3.1 E2E (playwright): «ЧУЖИЕ ЗНАМЁНА» — Synty-персонажи Rivals+MFH.
   Гейты: герои/враги получают Synty-GLB (animStats.rigs.synty > 0, rigs=units),
   свои клипы (attack/death), прозрачная листва (transparent-материалы в сцене),
   мобильный статус-бар жив, бой, чистый reload без 404 на GLB.
   Скриншоты — upload/e2e/v31_*.jpg. Харнес — по урокам v1.7–v3.0. */
const fs = require('fs');
const { chromium } = require('playwright');

const shot = async (page, name) => {
  const data = await page.evaluate(() => {
    window.__bg3.loopStop();
    const r = window.__bg3.rnd(), s = window.__bg3.scn(), c = window.__bg3.cam();
    r.render(s, c);
    const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.82);
    window.__bg3.loopStart();
    return url;
  });
  fs.writeFileSync('upload/e2e/' + name, Buffer.from(data.split(',')[1], 'base64'));
};
const fail = (msg) => { console.log('FAIL: ' + msg); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NOISE = ['soldier.glb', 'favicon'];
const g_errors = [];

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'mid', res: '75', fps: '30', voice: false, vol: '0' })); } catch {}
  });
  const page = await ctx.newPage();
  const errors = g_errors;
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP' + r.status() + ': ' + r.url()); });

  /* G1: boot леса — Synty-персонажи на ригах, клипы, прозрачная листва */
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  /* Synty-GLB грузятся асинхронно — ждём честно */
  await page.waitForFunction(() => {
    const a = window.__bg3.animStats();
    return a.rigs.units >= 4 && a.rigs.synty >= 3;
  }, null, { timeout: 45000 }).catch(() => fail('G1 synty rigs did not settle'));
  await page.waitForTimeout(2500);
  const g1 = await page.evaluate(() => {
    const a = window.__bg3.animStats();
    /* прозрачные материалы листвы в живой сцене */
    let transparentFoliage = 0, opaque = 0;
    window.__bg3.scn().traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of mats) {
        if (m.transparent === true && m.map) transparentFoliage++;
        else if (m.map) opaque++;
      }
    });
    return { anim: a, transparentFoliage, opaque };
  });
  await shot(page, 'v31_forest.jpg');
  console.log('G1 FOREST:', JSON.stringify(g1));
  if (g1.anim.rigs.synty < 3) fail('G1 synty rigs: ' + g1.anim.rigs.synty);
  if (g1.anim.rigs.withAttack < 3) fail('G1 attack clips missing: ' + g1.anim.rigs.withAttack);
  if (g1.anim.rigs.withDeath < 3) fail('G1 death clips missing: ' + g1.anim.rigs.withDeath);
  if (g1.transparentFoliage < 5) fail('G1 transparent foliage materials: ' + g1.transparentFoliage);

  /* G2: игрок — ход/анимации: переключение walk/run не роняет миксер */
  await page.evaluate(() => {
    const u = window.__bg3.units.find((x) => x.side === 'hero' && x.alive);
    if (u) { u.moving = true; setTimeout(() => { u.moving = false; }, 900); }
  });
  await sleep(1400);
  const g2 = await page.evaluate(() => {
    const errs = [];
    const a = window.__bg3.animStats();
    return { anim: a };
  });
  console.log('G2 MOVE:', JSON.stringify(g2));
  if (g2.anim.rigs.synty < 3) fail('G2 rigs lost after move');

  /* G3: бой — Synty-враги в бою, атаки играют */
  await page.evaluate(() => {
    const heroes = window.__bg3.units.filter((u) => u.side === 'hero' && u.alive);
    const spots = [[13, 24], [14, 23], [12, 23], [15, 24], [11, 24], [16, 23]];
    heroes.forEach((h, i) => { const s = spots[i] || [13, 25]; h.x = s[0]; h.z = s[1]; h.mesh.position.set((s[0] - 13.5) * 1.6, 0, (s[1] - 13.5) * 1.6); });
  });
  await page.evaluate(() => window.__bg3.startCombat(window.__bg3.S.campGroup.slice()));
  await page.waitForFunction(() => window.__bg3.turn().combatOn, null, { timeout: 30000 });
  await sleep(3000);
  const g3 = await page.evaluate(() => ({ combat: window.__bg3.turn().combatOn, anim: window.__bg3.animStats() }));
  await shot(page, 'v31_combat.jpg');
  console.log('G3 COMBAT:', JSON.stringify(g3));
  if (!g3.combat) fail('G3 combat not started');
  if (g3.anim.rigs.synty < 3) fail('G3 synty rigs in combat: ' + g3.anim.rigs.synty);
  /* выходим из боя */
  await page.evaluate(() => window.__bg3.arenaWipe());
  await page.waitForFunction(() => { const t = window.__bg3.turn(); return !t.combatOn && !t.busy && t.phase === 'explore'; }, null, { timeout: 20000 });
  await page.evaluate(() => window.__bg3.closeDlg());

  /* G4: чистый reload — ни 404 на GLB героев/врагов, ни ошибок консоли */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => {
    const a = window.__bg3.animStats();
    return a.rigs.units >= 4 && a.rigs.synty >= 3;
  }, null, { timeout: 45000 }).catch(() => fail('G4 synty rigs after reload'));
  await page.waitForTimeout(2000);
  await shot(page, 'v31_reload.jpg');
  const realErr = errors.filter((e) => !NOISE.some((n) => e.includes(n)) && !e.startsWith('CONSOLE: Failed to load resource') && !e.includes('/api/'));
  const bad404 = errors.filter((e) => e.startsWith('HTTP') && !NOISE.some((n) => e.includes(n)) && !e.includes('/api/'));
  console.log('G4 RELOAD:', JSON.stringify({ errors: realErr.length, bad404: bad404.length }));
  if (bad404.length) console.log('G4 bad404:', bad404.slice(0, 6).join(' | '));
  if (bad404.some((e) => /rig\/(rivals|heroes)/.test(e))) fail('G4 404 on Synty GLB: ' + bad404[0]);
  if (realErr.length) fail('G4 console errors: ' + realErr.slice(0, 4).join(' | '));

  await browser.close();
  console.log('PW_V31: ALL GATES GREEN');
})().catch((e) => { console.error('FATAL:', e.message); console.error(e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : ''); console.error('PAGE ERRORS:', g_errors.slice(0, 6).join(' | ') || '-'); process.exit(1); });
