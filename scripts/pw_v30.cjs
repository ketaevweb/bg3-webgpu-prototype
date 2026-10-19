/* v3.0 E2E (playwright): «ДИКАЯ ЧАЩА» — POLYGON Nature Pack.
   Гейты: 129 моделей пака парсятся (natureStats.failed=0 — урок FBX-6.1),
   мешевые облака в небе, качание листвы/растений, текстурная земля,
   рубильники gfx (sky/grade) живое переключение + persist, бой, reload.
   Скриншоты всех карт — upload/e2e/v30_*.jpg. Харнес — по урокам v1.7–v2.9. */
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
const waitCombat = (page) => page.waitForFunction(() => window.__bg3 && window.__bg3.turn().combatOn, null, { timeout: 30000 });
const fail = (msg) => { console.log('FAIL: ' + msg); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NOISE = ['soldier.glb', 'favicon'];
const FBX_RE = /Unknown format|Unknown property type|FBXLoader/i;
const g_errors = [];

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'mid', res: '75', fps: '30', voice: true, vol: '80' })); } catch {}
  });
  const page = await ctx.newPage();
  const errors = g_errors;
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP' + r.status() + ': ' + r.url()); });

  /* G1: boot леса — пак в кэше без провалов, мешевые облака, ветер листвы */
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  /* мешевые облака/чаща — асинхронная загрузка: ждём честно (урок v3.0: фиксированная пауза гонится с HMR/сетью) */
  await page.waitForFunction(() => {
    const n = window.__bg3.natureStats();
    return n.cached >= 30 && window.__bg3.skyState().meshClouds > 0;
  }, null, { timeout: 45000 }).catch(() => fail('G1 nature/clouds did not settle'));
  await page.waitForTimeout(2500);/* хвост загрузок */
  const g1 = await page.evaluate(() => ({
    nature: window.__bg3.natureStats(), sky: window.__bg3.skyState(),
    wind: window.__bg3.windStats(), gfx: window.__bg3.gfxState(),
  }));
  console.log('G1 FOREST:', JSON.stringify(g1));
  if (g1.nature.cached < 15) fail('G1 nature cache too small: ' + g1.nature.cached);
  if (g1.nature.failed.length) fail('G1 failed models: ' + g1.nature.failed.join(','));
  if (FBX_RE.test(g1.nature.failed.join(' '))) fail('G1 fbx parse errors');
  if (g1.sky.meshClouds < 5) fail('G1 mesh clouds not in sky: ' + g1.sky.meshClouds);
  if (g1.wind.active < 2) fail('G1 wind materials: ' + g1.wind.active);
  if (!g1.sky.dome || g1.sky.map !== 'forest') fail('G1 sky wrong');
  await shot(page, 'v30_forest.jpg');

  /* G2: тур по картам — на каждой карте пак без провалов (горы/камни/скелеты/стены) */
  const maps = ['crypt', 'swamp', 'giants', 'citadel'];
  await page.evaluate(() => { window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true; window.__bg3.questDone('giants'); });
  for (const m of maps) {
    await page.evaluate((mm) => window.__bg3.switchMap(mm), m);
    await page.waitForFunction((mm) => window.__bg3.turn().mapId === mm, m, { timeout: 30000 });
    await page.waitForTimeout(3500);/* модели карты грузятся */
    const st = await page.evaluate(() => ({ nature: window.__bg3.natureStats(), sky: window.__bg3.skyState() }));
    await shot(page, 'v30_' + m + '.jpg');
    console.log('G2 MAP', m, JSON.stringify({ cached: st.nature.cached, failed: st.nature.failed.length, meshClouds: st.sky.meshClouds, map: st.sky.map }));
    if (st.nature.failed.length) fail('G2 failed models on ' + m + ': ' + st.nature.failed.join(','));
    if (st.sky.map !== m || !st.sky.dome) fail('G2 sky wrong on ' + m);
  }

  /* G3: рубильники gfx.sky/gfx.grade — живое переключение + persist */
  await page.evaluate(() => { window.__bg3.gfx.sky = false; window.__bg3.gfx.grade = false; window.__bg3.applyGfx(); });
  await page.waitForTimeout(900);
  const g3off = await page.evaluate(() => ({ gfx: window.__bg3.gfxState(), sky: window.__bg3.skyState() }));
  console.log('G3 OFF:', JSON.stringify(g3off));
  if (g3off.gfx.sky || g3off.gfx.grade) fail('G3 toggles did not apply');
  if (g3off.sky.dome) fail('G3 dome still visible with sky off');
  await shot(page, 'v30_forest_nofx.jpg');
  await page.evaluate(() => { window.__bg3.switchMap('forest'); });
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'forest', null, { timeout: 30000 });
  await page.evaluate(() => { window.__bg3.gfx.sky = true; window.__bg3.gfx.grade = true; window.__bg3.applyGfx(); });
  await page.waitForTimeout(900);
  const g3on = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('bg3w_gfx_v1') || '{}');
    return { gfx: window.__bg3.gfxState(), savedSky: saved.sky, savedGrade: saved.grade };
  });
  console.log('G3 ON:', JSON.stringify(g3on));
  if (!g3on.gfx.sky || !g3on.gfx.grade || !g3on.savedSky || !g3on.savedGrade) fail('G3 toggles back/persist wrong');

  /* G4: бой в лагере — регрессия боя поверх новой природы */
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const heroes = window.__bg3.units.filter((u) => u.side === 'hero' && u.alive);
    const spots = [[13, 24], [14, 23], [12, 23], [15, 24], [11, 24], [16, 23]];
    heroes.forEach((h, i) => { const s = spots[i] || [13, 25]; h.x = s[0]; h.z = s[1]; h.mesh.position.set((s[0] - 13.5) * 1.6, 0, (s[1] - 13.5) * 1.6); });
    window.__bg3.blessForce(4);
    heroes.forEach((h) => { if (h.blessed) h.blessed = ['Крепость глубин']; });
  });
  await page.evaluate(() => window.__bg3.startCombat(window.__bg3.S.campGroup.slice()));
  await waitCombat(page);
  await sleep(2600);
  const g4 = await page.evaluate(() => ({ combat: window.__bg3.turn().combatOn, chars: window.__bg3.charStats(), nature: window.__bg3.natureStats() }));
  await shot(page, 'v30_combat.jpg');
  console.log('G4 COMBAT:', JSON.stringify(g4));
  if (!g4.combat) fail('G4 combat not started');
  if (g4.chars.rings < 2) fail('G4 bless rings wrong');
  if (g4.nature.failed.length) fail('G4 models failed during combat');
  await page.evaluate(() => {
    window.__bg3.arenaWipe();
    const heroes = window.__bg3.units.filter((u) => u.side === 'hero' && u.alive);
    const spots = [[13, 24], [14, 23], [12, 23], [15, 24], [11, 24], [16, 23]];
    heroes.forEach((h, i) => { const s = spots[i] || [13, 25]; h.x = s[0]; h.z = s[1]; h.mesh.position.set((s[0] - 13.5) * 1.6, 0, (s[1] - 13.5) * 1.6); });
  });
  await page.waitForFunction(() => { const t = window.__bg3.turn(); return !t.combatOn && !t.busy && t.phase === 'explore'; }, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__bg3.closeDlg());
  await page.waitForFunction(() => { const t = window.__bg3.turn(); return !t.busy && t.phase === 'explore'; }, null, { timeout: 10000 });

  /* G5: сейв + чистый reload — gfx persist, консоль чиста (нет FBX-ошибок/404) */
  await page.evaluate(() => window.__bg3.doSave(1));
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(5000);
  const g5 = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('bg3w_gfx_v1') || '{}');
    return { gfx: window.__bg3.gfxState(), savedSky: saved.sky, savedGrade: saved.grade, map: window.__bg3.turn().mapId, nature: window.__bg3.natureStats() };
  });
  await shot(page, 'v30_reload.jpg');
  const realErr = errors.filter((e) => !NOISE.some((n) => e.includes(n)) && !e.startsWith('CONSOLE: Failed to load resource') && !e.includes('/api/'));/* /api/ — транспортный шум дев-сервера (tts 503 и т.п.) */
  const bad404 = errors.filter((e) => e.startsWith('HTTP') && !NOISE.some((n) => e.includes(n)) && !e.includes('/api/'));
  const fbxErr = errors.filter((e) => FBX_RE.test(e));
  console.log('G5 RELOAD:', JSON.stringify({ ...g5, errors: realErr.length, bad404: bad404.length, fbxErr: fbxErr.length }));
  if (bad404.length) console.log('G5 bad404:', bad404.slice(0, 6).join(' | '));
  if (fbxErr.length) fail('G5 FBX errors: ' + fbxErr.slice(0, 3).join(' | '));
  if (!g5.gfx.grade || !g5.gfx.sky || !g5.savedSky || !g5.savedGrade) fail('G5 gfx persist wrong');
  if (g5.nature.failed.length) fail('G5 failed models: ' + g5.nature.failed.join(','));
  if (realErr.length) fail('G5 console errors: ' + realErr.slice(0, 4).join(' | '));

  await browser.close();
  console.log('PW_V30: ALL GATES GREEN');
})().catch((e) => { console.error('FATAL:', e.message); console.error(e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : ''); console.error('PAGE ERRORS:', g_errors.slice(0, 6).join(' | ') || '-'); process.exit(1); });
