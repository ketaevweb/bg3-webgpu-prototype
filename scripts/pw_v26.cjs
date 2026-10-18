/* v2.6 E2E (playwright): ЭХО БИТВЫ — боевые реплики героев + громкость.
   Гейты: манифест 190 + все 36 bark-файлов, механика barkProbe (кулдаун/
   force/неизвестный герой), реальный бой: start-барк волны, kill при вайпе,
   hurt/down под ударами врагов, громкость gfx.vol (панель G + persist),
   сейв/лоад, чистый reload. Харнес — по урокам v1.7–v2.5. */
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
const waitCalm = (page) => page.waitForFunction(() => window.__bg3 && !window.__bg3.turn().combatOn, null, { timeout: 20000 });
/* новый ключ в истории по суффиксу (hero в barks случаен — ищем «любой *.start» после снапшота) */
const waitNewSuffix = (page, seenJson, suffix, timeout = 45000) => page.waitForFunction(
  (x) => { const [seen, suf] = JSON.parse(x); return window.__bg3.voice().hist.some((h) => h.endsWith(suf) && !seen.includes(h)); },
  JSON.stringify([seenJson, suffix]), { timeout });
const fail = (msg) => { console.log('FAIL: ' + msg); process.exit(1); };
const histSnap = (page) => page.evaluate(() => window.__bg3.voice().hist.slice());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30', voice: true, vol: '80' })); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  const bad404 = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !bad404.includes(r.url())) bad404.push(r.status() + ' ' + r.url().replace('http://localhost:3000', '')); });

  /* G1: boot + манифест + целостность файлов + все 36 bark-ключей */
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__bg3.voice().ready, null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const g1 = await page.evaluate(async () => {
    const v = window.__bg3.voice();
    const man = await (await fetch('/voices/manifest.json')).json();
    const barkKeys = Object.keys(man.lines).filter((k) => k.startsWith('bark.'));
    const miss = [];
    for (const id of Object.keys(man.lines)) {
      const r = await fetch('/voices/' + id + '.mp3');
      if (!r.ok) miss.push(id);
    }
    const kinds = window.__bg3.barkKinds();
    return { lines: v.lines, barkKeys, miss, heroes: kinds.heroes, cd: kinds.cd, vol: v.vol };
  });
  console.log('G1 BOOT+MANIFEST:', JSON.stringify({ lines: g1.lines, bark: g1.barkKeys.length, miss: g1.miss.length, heroes: g1.heroes.length, cd: g1.cd, vol: g1.vol }));
  if (g1.lines < 190 || g1.miss.length) fail('G1 manifest/files broken: ' + g1.miss.slice(0, 4).join(','));
  if (g1.barkKeys.length !== 36) fail('G1 bark keys expected 36, got ' + g1.barkKeys.length);
  if (g1.heroes.length !== 2 || g1.cd !== 4000 || g1.vol !== 0.8) fail('G1 barkKinds/voice wrong: ' + JSON.stringify({ h: g1.heroes, cd: g1.cd, vol: g1.vol }));

  /* G2: barkProbe — кулдаун/force/неизвестный герой */
  const g2 = await page.evaluate(async () => {
    const out = {};
    const s1 = window.__bg3.barkProbe('start', 'торик'); out.startOk = s1.ok && s1.id === 'bark.torik.start';
    const s2 = window.__bg3.barkProbe('crit', 'торик'); out.cdReject = !s2.ok && s2.id === 'bark.torik.crit';
    const s3 = window.__bg3.barkProbe('down', 'мирелла'); out.downForce = s3.ok && s3.id === 'bark.mirella.down';
    const s4 = window.__bg3.barkProbe('crit', 'гоблин'); out.unknown = !s4.ok;
    await new Promise((r) => setTimeout(r, 4300));
    const s5 = window.__bg3.barkProbe('crit', 'илва'); out.afterCd = s5.ok && s5.id === 'bark.ilva.crit';
    return out;
  });
  console.log('G2 BARK PROBE:', JSON.stringify(g2));
  if (!g2.startOk || !g2.cdReject || !g2.downForce || !g2.unknown || !g2.afterCd) fail('G2 barkProbe broken: ' + JSON.stringify(g2));

  /* G3: громкость — gfx.vol → applyGfx → voice().vol */
  const g3 = await page.evaluate(() => {
    window.__bg3.gfx.vol = '80';
    window.__bg3.applyGfx();
    const v80 = window.__bg3.voice().vol;
    window.__bg3.gfx.vol = '100';
    window.__bg3.applyGfx();
    const v100 = window.__bg3.voice().vol;
    window.__bg3.gfx.vol = '80';/* оставляем 80% — persist проверим после reload */
    window.__bg3.applyGfx();
    return { v80, v100 };
  });
  console.log('G3 VOLUME:', JSON.stringify(g3));
  if (g3.v80 !== 0.8 || g3.v100 !== 1) fail('G3 volume wrong: ' + JSON.stringify(g3));

  /* G4: реальный бой — арена волна 6, start-барк живого героя */
  await sleep(4300);/* кулдаун после probe-барьков G2/G3 */
  await page.evaluate(() => { window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true; window.__bg3.questDone('giants'); });
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__bg3.forceSeason(0));
  const seen4 = await histSnap(page);/* ДО старта боя — start-барк будет «новым» */
  await page.evaluate(() => window.__bg3.arenaEndless());
  await waitCombat(page);
  await waitNewSuffix(page, seen4, '.start', 20000);
  const g4 = await page.evaluate(() => ({ wave: window.__bg3.arenaState().wave, season: window.__bg3.season().idx }));
  console.log('G4 ARENA START BARK:', JSON.stringify(g4));
  if (g4.wave !== 6) fail('G4 wave 6 expected, got ' + g4.wave);
  await shot(page, 'v26_arena_bark.jpg');

  /* G5: kill при вайпе (источник — первый герой) — пауза > кулдауна */
  await sleep(4300);
  await page.evaluate(() => window.__bg3.arenaWipe());
  await waitCalm(page);
  const seen5 = await histSnap(page);
  await waitNewSuffix(page, seen5.filter((h) => !h.endsWith('.kill')), '.kill', 25000);
  console.log('G5 KILL BARK: ok');
  await page.waitForFunction(() => window.__bg3.turn().combatOn, null, { timeout: 25000 });/* волна 7 */

  /* G6: hurt/down — враги волны 7 бьют героев; герои в инициативе первые —
     их ходы авто-пропускаем (heroPass), иначе AI враги не получат ни хода */
  const seen6 = await histSnap(page);
  const passTimer = setInterval(() => { page.evaluate(() => window.__bg3.heroPass()).catch(() => {}); }, 600);
  try {
    await page.waitForFunction((x) => {
      const seen = JSON.parse(x);
      return window.__bg3.voice().hist.some((h) => (h.endsWith('.hurt') || h.endsWith('.down')) && !seen.includes(h));
    }, JSON.stringify(seen6), { timeout: 90000 });
    console.log('G6 HURT/DOWN BARK: ok');
  } catch {
    const st = await page.evaluate(() => ({ combat: window.__bg3.turn().combatOn, phase: window.__bg3.turn().phase, hp: window.__bg3.units.filter((u) => u.side === 'hero').map((u) => u.hp + '/' + u.maxhp) }));
    fail('G6 no hurt/down bark: ' + JSON.stringify(st));
  } finally { clearInterval(passTimer); }

  /* G7: остановка цепочки (урок v2.5 G8): счётчик 0 при живой волне → вайп → no-op */
  await page.evaluate(() => window.__bg3.arenaSetWave(0));
  await page.evaluate(() => window.__bg3.arenaWipe());
  await waitCalm(page);
  const g7 = await page.evaluate(() => ({ wave: window.__bg3.arenaState().wave, best: window.__bg3.S.arenaBest, combat: window.__bg3.turn().combatOn }));
  console.log('G7 CHAIN STOPPED:', JSON.stringify(g7));
  if (g7.combat || g7.wave !== 0 || g7.best < 6) fail('G7 chain stop failed: ' + JSON.stringify(g7));

  /* G8: сейв/лоад — рекорд и голоса живы, громкость из gfx */
  await page.evaluate(() => window.__bg3.doSave(3));
  await page.evaluate(() => window.__bg3.doLoad(3));
  await page.waitForTimeout(2500);
  const g8 = await page.evaluate(() => ({
    best: window.__bg3.S.arenaBest, ready: window.__bg3.voice().ready,
    on: window.__bg3.voice().on, vol: window.__bg3.voice().vol,
    heroes: window.__bg3.units.filter((u) => u.side === 'hero').length,
  }));
  console.log('G8 SAVE/LOAD:', JSON.stringify(g8));
  if (g8.best < 6 || !g8.ready || !g8.on || g8.heroes < 2) fail('G8 save/load broken: ' + JSON.stringify(g8));

  /* G9: чистый reload — vol persist 80%, 0 ошибок (шум soldier.glb отфильтрован) */
  const errBefore = errors.length, badBefore = bad404.length;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__bg3.voice().ready, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const g9 = await page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas').length,
    vol: window.__bg3.voice().vol,
    barkFiles: window.__bg3.barkKinds().heroes.length,
  }));
  const eNew = errors.slice(errBefore).filter((e) => !e.includes('status of 404'));
  const bNew = bad404.slice(badBefore).filter((u) => !u.includes('/models/rig/soldier.glb'));
  console.log('G9 CLEAN RELOAD:', JSON.stringify(g9), 'errors:', eNew.length, 'bad404:', bNew.length);
  if (g9.canvases !== 1 || g9.vol !== 0.8 || eNew.length || bNew.length) {
    fail('G9 clean reload failed: ' + JSON.stringify(g9) + ' | ' + eNew.concat(bNew).slice(0, 4).join(' | '));
  }

  await browser.close();
  console.log('PW_V26: ALL 9 GATES GREEN');
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
