/* v2.9 E2E (playwright): «ЛИК ФАЭРУНА» — графика как в большой BG3.
   Гейты: небо (купол/светило/облака/амбиент по 5 картам), ветер травы (TSL),
   кинолюк (цветокор+виньетка) и его рубильники (gfx.sky/grade — живое
   переключение + persist), ореолы благословенных, бой с частицами,
   сейв/лоад, чистый reload. Скриншоты всех карт — upload/e2e/v29_*.jpg.
   Харнес — по урокам v1.7–v2.8 (уход от патруля, ожидание explore без busy). */
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

  /* G1: boot леса — небо/ветер/кинолюк включены, скриншот */
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(4500);/* FBX-деревья/горы подтягиваются */
  const g1 = await page.evaluate(() => ({
    sky: window.__bg3.skyState(), wind: window.__bg3.windStats(),
    gfx: window.__bg3.gfxState(), chars: window.__bg3.charStats(),
  }));
  console.log('G1 FOREST:', JSON.stringify(g1));
  if (!g1.sky.dome || !g1.sky.sun || g1.sky.map !== 'forest') fail('G1 sky dome/sun wrong');
  if (g1.sky.clouds < 5 || g1.sky.motes < 5) fail('G1 clouds/motes wrong');
  if (g1.wind.active < 2) fail('G1 wind materials wrong');
  if (g1.gfx.grade !== true || g1.gfx.sky !== true) fail('G1 gfx defaults wrong');
  await shot(page, 'v29_forest.jpg');

  /* G2: тур по картам — палитра неба меняется, скриншоты */
  const maps = ['crypt', 'swamp', 'giants', 'citadel'];
  await page.evaluate(() => { window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true; window.__bg3.questDone('giants'); });
  for (const m of maps) {
    await page.evaluate((mm) => window.__bg3.switchMap(mm), m);
    await page.waitForFunction((mm) => window.__bg3.turn().mapId === mm, m, { timeout: 30000 });
    await page.waitForTimeout(2200);
    const st = await page.evaluate(() => window.__bg3.skyState());
    await shot(page, 'v29_' + m + '.jpg');
    console.log('G2 MAP', m, JSON.stringify({ map: st.map, clouds: st.clouds, motes: st.motes, dome: st.dome }));
    if (!st.dome || st.map !== m || st.motes < 3) fail('G2 sky state wrong on ' + m);
  }

  /* G3: рубильники gfx.sky/gfx.grade — живое переключение + persist */
  await page.evaluate(() => { window.__bg3.gfx.sky = false; window.__bg3.gfx.grade = false; window.__bg3.applyGfx(); });
  await page.waitForTimeout(900);
  const g3off = await page.evaluate(() => ({ gfx: window.__bg3.gfxState(), sky: window.__bg3.skyState() }));
  console.log('G3 OFF:', JSON.stringify(g3off));
  if (g3off.gfx.sky || g3off.gfx.grade) fail('G3 toggles did not apply');
  if (g3off.sky.dome) fail('G3 dome still visible with sky off');
  await shot(page, 'v29_forest_nofx.jpg');
  await page.evaluate(() => { window.__bg3.gfx.sky = true; window.__bg3.gfx.grade = true; window.__bg3.applyGfx(); });
  await page.waitForTimeout(900);
  const g3on = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('bg3w_gfx_v1') || '{}');
    return { gfx: window.__bg3.gfxState(), savedSky: saved.sky, savedGrade: saved.grade };
  });
  console.log('G3 ON:', JSON.stringify(g3on));
  if (!g3on.gfx.sky || !g3on.gfx.grade || !g3on.savedSky || !g3on.savedGrade) fail('G3 toggles back/persist wrong');

  /* G4: бой в лагере — частицы/ореолы/пыль в кадре (урок v2.8: телепорт + уход от патруля).
     Урок v2.9: после тура по картам отряд на цитадели — лесной лагерь там разобран
     (teardown снимает врагов), бой стартуем только на лесу. */
  await page.evaluate(() => window.__bg3.switchMap('forest'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'forest', null, { timeout: 30000 });
  await page.waitForTimeout(2200);/* FBX-деревья лагеря подтягиваются */
  await page.evaluate(() => {
    const heroes = window.__bg3.units.filter((u) => u.side === 'hero' && u.alive);
    const spots = [[13, 24], [14, 23], [12, 23], [15, 24], [11, 24], [16, 23]];
    heroes.forEach((h, i) => { const s = spots[i] || [13, 25]; h.x = s[0]; h.z = s[1]; h.mesh.position.set((s[0] - 13.5) * 1.6, 0, (s[1] - 13.5) * 1.6); });
    window.__bg3.blessForce(4);/* ореолы благословенных в кадре */
    heroes.forEach((h) => { if (h.blessed) h.blessed = ['Крепость глубин']; });
  });
  await page.evaluate(() => window.__bg3.startCombat(window.__bg3.S.campGroup.slice()));
  await waitCombat(page);
  await sleep(2600);
  const g4 = await page.evaluate(() => ({ combat: window.__bg3.turn().combatOn, chars: window.__bg3.charStats() }));
  await shot(page, 'v29_combat.jpg');
  console.log('G4 COMBAT:', JSON.stringify(g4));
  if (!g4.combat) fail('G4 combat not started');
  if (g4.chars.rings < 2) fail('G4 bless rings wrong');
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

  /* G5: сейв/лоад + чистый reload — gfx persist, консоль чиста */
  await page.evaluate(() => window.__bg3.doSave(1));
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(3500);
  const g5 = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('bg3w_gfx_v1') || '{}');
    return { gfx: window.__bg3.gfxState(), savedSky: saved.sky, savedGrade: saved.grade, map: window.__bg3.turn().mapId };
  });
  await shot(page, 'v29_reload.jpg');
  const realErr = errors.filter((e) => !NOISE.some((n) => e.includes(n)) && !e.startsWith('CONSOLE: Failed to load resource'));
  const bad404 = errors.filter((e) => e.startsWith('HTTP') && !NOISE.some((n) => e.includes(n)) && !e.includes('/api/'));
  console.log('G5 RELOAD:', JSON.stringify({ ...g5, errors: realErr.length, bad404: bad404.length }));
  if (bad404.length) console.log('G5 bad404:', bad404.slice(0, 6).join(' | '));
  if (!g5.gfx.grade || !g5.gfx.sky || !g5.savedSky || !g5.savedGrade) fail('G5 gfx persist wrong');
  if (realErr.length) fail('G5 console errors: ' + realErr.slice(0, 4).join(' | '));

  await browser.close();
  console.log('PW_V29: ALL GATES GREEN');
})().catch((e) => { console.error('FATAL:', e.message); console.error(e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : ''); console.error('PAGE ERRORS:', g_errors.slice(0, 6).join(' | ') || '-'); process.exit(1); });
