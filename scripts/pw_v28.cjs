/* v2.8 E2E (playwright): ГЛУБИННЫЕ БЛАГОСЛОВЕНИЯ + ГЛАС БЕЗДНЫ + СЕЗОННЫЕ СОСТАВЫ.
   Гейты: манифест 196 (+6 ebark-файлов), благословения blessForce 2→12
   (КД/урон/жизни/скорость/ячейки — детерминированы рекордом, сейв v2 не меняется),
   панель T (благословения), ebarkProbe-каталог, живой рев Грата в бою лагеря
   (первое применение ауры), сезон 0 смывает кости волны 6 в утопленников,
   сезон 1 поднимает кости вместо культистов (волна 7), сейв/лоад 1:1,
   чистый reload. Харнес — по урокам v1.7–v2.7. */
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
const waitCalm = (page) => page.waitForFunction(() => window.__bg3 && !window.__bg3.turn().combatOn, null, { timeout: 25000 });
const fail = (msg) => { console.log('FAIL: ' + msg); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NOISE = ['soldier.glb', 'favicon'];
const g_errors = [];/* модуль-скоуп: виден из catch вне IIFE */

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30', voice: true, vol: '80' })); } catch {}
  });
  const page = await ctx.newPage();
  const errors = g_errors;
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP' + r.status() + ': ' + r.url()); });/* v2.8-диагностика: URL не-200 */

  /* G1: boot + манифест 196 + целостность файлов + каталог ebark + благословения 0 */
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__bg3.voice().ready, null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const g1 = await page.evaluate(async () => {
    const v = window.__bg3.voice();
    const man = await (await fetch('/voices/manifest.json')).json();
    const ebarks = Object.keys(man.lines).filter((k) => k.startsWith('ebark.'));
    const miss = [];
    for (const id of ebarks) { const r = await fetch('/voices/' + id + '.mp3'); if (!r.ok) miss.push(id); }
    const probe = { grat: window.__bg3.ebarkProbe('грат'), none: window.__bg3.ebarkProbe('дракон') };
    const st = window.__bg3.blessState();
    const torik = window.__bg3.units.find((u) => u.short === 'Торик');
    return { lines: v.lines, ebarks, miss, probe, st, ac: torik.ac, dmg: torik.dmgBonus || 0 };
  });
  console.log('G1 BOOT+MANIFEST:', JSON.stringify({ lines: g1.lines, ebark: g1.ebarks.length, miss: g1.miss.length, gratOk: g1.probe.grat.ok, gratId: g1.probe.grat.id, noneOk: g1.probe.none.ok, best: g1.st.best, count: g1.st.count, ac: g1.ac, dmg: g1.dmg }));
  if (g1.lines !== 196 || g1.ebarks.length !== 6 || g1.miss.length) fail('G1 manifest/ebark files wrong');
  if (!g1.probe.grat.ok || g1.probe.grat.id !== 'ebark.grat.aura' || g1.probe.none.ok) fail('G1 ebarkProbe wrong');
  if (g1.st.best !== 0 || g1.st.count !== 0 || g1.ac !== 16 || g1.dmg !== 0) fail('G1 fresh bless state wrong');

  /* G2: благословения 2→12: КД/урон/жизни/скорость/ячейки (детерминировано рекордом) */
  await page.evaluate(() => window.__bg3.blessForce(2));
  const g2a = await page.evaluate(() => {
    const t = window.__bg3.units.find((u) => u.short === 'Торик');
    return { count: window.__bg3.blessState().count, ac: t.ac };
  });
  await page.evaluate(() => window.__bg3.blessForce(12));
  await page.waitForTimeout(400);
  const g2 = await page.evaluate(() => {
    const t = window.__bg3.units.find((u) => u.short === 'Торик');
    const m = window.__bg3.units.find((u) => u.short === 'Мирелла');
    const st = window.__bg3.blessState();
    return { count: st.count, active: st.active,
      torik: { ac: t.ac, dmg: t.dmgBonus, hp: t.maxhp, speed: t.speed, blessed: t.blessed ? t.blessed.length : 0 },
      mirella: { ac: m.ac, dmg: m.dmgBonus, hp: m.maxhp, speed: m.speed, slotsMax: m.slotsMax, blessed: m.blessed ? m.blessed.length : 0 } };
  });
  console.log('G2 BLESS:', JSON.stringify(g2a), '→12:', JSON.stringify(g2));
  if (g2a.count !== 1 || g2a.ac !== 17) fail('G2 partial bless wrong (2 глубины)');
  if (g2.count !== 6 || g2.active.length !== 6) fail('G2 bless count wrong');
  if (g2.torik.ac !== 18 || g2.torik.dmg !== 2 || g2.torik.hp !== 24 || g2.torik.speed !== 7 || g2.torik.blessed !== 6) fail('G2 torik stats wrong');
  if (g2.mirella.ac !== 14 || g2.mirella.dmg !== 2 || g2.mirella.hp !== 16 || g2.mirella.speed !== 7 || g2.mirella.slotsMax !== 4) fail('G2 mirella stats wrong');

  /* G3: панель «Летопись Глубин» (T): блок благословений */
  await page.click('#recBtn');
  await page.waitForFunction(() => window.__bg3.records().open, null, { timeout: 10000 });
  await page.waitForTimeout(1500);
  const g3 = await page.evaluate(() => {
    const d = window.__bg3.records().data;
    const txt = document.querySelector('#records') ? document.querySelector('#records').innerText.toLowerCase() : '';
    return { bless: d.bless.length, firstName: d.bless[0] ? d.bless[0].name : '', panel: txt.includes('глубинные благословения (6 из 6)') };
  });
  await shot(page, 'v28_bless_panel.jpg');
  await page.evaluate(() => { const b = [...document.querySelectorAll('#records button')].find((x) => /Закрыть/.test(x.innerText)); if (b) b.click(); });
  console.log('G3 RECORDS PANEL:', JSON.stringify(g3));
  if (g3.bless !== 6 || g3.firstName !== 'Крепость глубин' || !g3.panel) fail('G3 records panel bless wrong');

  /* G4: живой рев Грата — бой лагеря Костей, аура при первом попадании гоблина.
     Урок v2.8: отряд при boot стоит у южного тракта — гоблины не доходят за
     60 проходов; телепортируем героев в лагерь ДО startCombat (кольцо вокруг
     Грата, клетки не заняты врагами/бочками). */
  await page.evaluate(() => {
    const g = window.__bg3.S.campGroup[0];
    const spots = [[0, 2], [-2, 0], [2, 1], [0, -2], [-2, 2], [3, 1]];
    const heroes = window.__bg3.units.filter((u) => u.side === 'hero' && u.alive);
    heroes.forEach((h, i) => {
      const s = spots[i] || [0, 3 + i];
      h.x = g.x + s[0]; h.z = g.z + s[1];
      h.mesh.position.set(g.mesh.position.x + s[0] * 1.6, 0, g.mesh.position.z + s[1] * 1.6);
    });
  });
  await page.evaluate(() => window.__bg3.startCombat(window.__bg3.S.campGroup.slice()));
  await waitCombat(page);
  let ebark = { count: 0, inHist: false, flag: false };
  for (let i = 0; i < 60 && !ebark.count; i++) {
    await page.evaluate(() => window.__bg3.heroPass());
    await sleep(900);
    ebark = await page.evaluate(() => {
      const g = window.__bg3.units.find((u) => u.short === 'Грат');
      return { count: window.__bg3.ebarkState().count,
        inHist: window.__bg3.voice().hist.some((h) => h === 'ebark.grat.aura'),
        flag: !!(g && g.enemyBarked) };
    });
  }
  await shot(page, 'v28_grat_ebark.jpg');
  console.log('G4 GRAT EBARK:', JSON.stringify(ebark));
  if (!ebark.count || !ebark.inHist || !ebark.flag) fail('G4 grat enemy bark not fired');
  await page.evaluate(() => {
    window.__bg3.arenaWipe();
    /* Урок v2.8: отряд в лагере — в 5 клетках от живого патруля (14,12) →
       checkTriggers открывает диалог патруля и блокирует switchMap.
       Уводим отряд на южный тракт В ТОМ ЖЕ evaluate (до тика интервала). */
    const heroes = window.__bg3.units.filter((u) => u.side === 'hero' && u.alive);
    const spots = [[13, 24], [14, 23], [12, 23], [15, 24], [11, 24], [16, 23]];
    heroes.forEach((h, i) => {
      const s = spots[i] || [13, 25];
      h.x = s[0]; h.z = s[1];
      h.mesh.position.set((s[0] - 13.5) * 1.6, 0, (s[1] - 13.5) * 1.6);
    });
  });
  /* победная последовательность держит busy — ждём фактического explore */
  await page.waitForFunction(() => { const t = window.__bg3.turn(); return !t.combatOn && !t.busy && t.phase === 'explore'; }, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__bg3.closeDlg());/* защитно: если диалог успел открыться */
  await page.waitForFunction(() => { const t = window.__bg3.turn(); return !t.busy && t.phase === 'explore'; }, null, { timeout: 10000 });

  /* G5: сезонные составы — сезон 0 «Кровавый прилив» волна 6: кости смываются в утопленники */
  await page.evaluate(() => { window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true; window.__bg3.questDone('giants'); });
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  /* диагностика v2.8: почему переход не доходит — печатаем turn() и ошибки */
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => window.__bg3.turn()).catch((e) => ({ evalErr: String(e).slice(0, 80) }));
    console.log('G5 DIAG', i, JSON.stringify(st), 'errs:', errors.length ? errors[errors.length - 1].slice(0, 120) : '-');
    if (st.mapId === 'citadel') break;
  }
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__bg3.forceSeason(0));
  await page.evaluate(() => window.__bg3.arenaEndless());
  await waitCombat(page);
  const g5 = await page.evaluate(() => {
    const es = window.__bg3.S.combatGroup.filter((e) => e.alive);
    return { n: es.length, drowned: es.filter((e) => e.clsName === 'Утопленник').length,
      skk: es.filter((e) => e.clsName === 'Скелет-рыцарь').length,
      wave: window.__bg3.arenaState().wave };
  });
  console.log('G5 BLOOD TIDE W6:', JSON.stringify(g5), '(ожидание: 3 утопленника — скелет-рыцарь смыт приливом)');
  if (g5.wave !== 6 || g5.n !== 3 || g5.drowned !== 3 || g5.skk !== 0) fail('G5 season0 wave6 swap wrong');

  /* G6: сезон 1 «Костяная стужа» волна 7: культисты подняты скелетами */
  await page.evaluate(() => window.__bg3.forceSeason(1));
  await page.evaluate(() => window.__bg3.arenaWipe());
  await waitCalm(page);
  await page.waitForTimeout(2300);
  await waitCombat(page);
  const g6 = await page.evaluate(() => {
    const es = window.__bg3.S.combatGroup.filter((e) => e.alive);
    return { n: es.length, skel: es.filter((e) => e.clsName === 'Скелет').length,
      drowned: es.filter((e) => e.clsName === 'Утопленник').length,
      cultist: es.filter((e) => /культист/i.test(e.clsName)).length };
  });
  console.log('G6 BONE COLD W7:', JSON.stringify(g6), '(ожидание: 3 скелета + 1 утопленник, культистов 0)');
  if (g6.n !== 4 || g6.skel !== 3 || g6.drowned !== 1 || g6.cultist !== 0) fail('G6 season1 wave7 swap wrong');
  /* остановка цепочки волн (урок v2.3: вайп волны N arm-ит таймер N+1) */
  await page.evaluate(() => { window.__bg3.arenaWipe(); window.__bg3.arenaSetWave(0); });
  await waitCalm(page);
  await page.waitForTimeout(2200);
  const g6b = await page.evaluate(() => ({ wave: window.__bg3.arenaState().wave, combat: window.__bg3.turn().combatOn }));
  console.log('G6 CHAIN STOP:', JSON.stringify(g6b));
  if (g6b.combat || g6b.wave !== 0) fail('G6 wave chain not stopped');

  /* G7: сейв/лоад 1:1 — благословения согласованы (рекорд 12 → count 6 после лоада) */
  const g7pre = await page.evaluate(() => {
    const t = window.__bg3.units.find((u) => u.short === 'Торик');
    const m = window.__bg3.units.find((u) => u.short === 'Мирелла');
    return { best: window.__bg3.blessState().best, t: { ac: t.ac, hp: t.maxhp, speed: t.speed }, m: { ac: m.ac, slotsMax: m.slotsMax } };
  });
  await page.evaluate(() => window.__bg3.doSave(1));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__bg3.doLoad(1));
  await page.waitForTimeout(3000);
  const g7 = await page.evaluate(() => {
    const t = window.__bg3.units.find((u) => u.short === 'Торик');
    const m = window.__bg3.units.find((u) => u.short === 'Мирелла');
    const st = window.__bg3.blessState();
    return { count: st.count, t: { ac: t.ac, hp: t.maxhp, speed: t.speed, dmg: t.dmgBonus }, m: { ac: m.ac, slotsMax: m.slotsMax } };
  });
  console.log('G7 SAVE/LOAD:', JSON.stringify({ pre: g7pre, post: g7 }));
  if (g7.count !== 6) fail('G7 bless count after load wrong');
  if (g7.t.ac !== g7pre.t.ac || g7.t.hp !== g7pre.t.hp || g7.t.speed !== g7pre.t.speed) fail('G7 torik stats not 1:1');
  if (g7.m.ac !== g7pre.m.ac || g7.m.slotsMax !== g7pre.m.slotsMax) fail('G7 mirella stats not 1:1');
  if (g7.t.dmg !== 2) fail('G7 torik dmgBonus after load wrong');

  /* G8: чистый reload — консоль без реальных ошибок */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__bg3.voice().ready, null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const realErr = errors.filter((e) => !NOISE.some((n) => e.includes(n)) && !e.startsWith('CONSOLE: Failed to load resource'));
  const bad404 = errors.filter((e) => e.startsWith('HTTP') && !NOISE.some((n) => e.includes(n)) && !e.includes('/api/'));
  const g8 = await page.evaluate(() => {
    const st = window.__bg3.blessState();
    return { count: st.count, best: st.best };
  });
  console.log('G8 RELOAD:', JSON.stringify({ ...g8, errors: realErr.length, bad404: bad404.length }));
  if (bad404.length) console.log('G8 bad404:', bad404.slice(0, 6).join(' | '));
  if (g8.count !== 6 || g8.best !== 12) fail('G8 bless state after reload wrong');
  if (realErr.length) fail('G8 console errors: ' + realErr.slice(0, 4).join(' | '));

  await browser.close();
  console.log('PW_V28: ALL GATES GREEN');
})().catch((e) => { console.error('FATAL:', e.message); console.error(e.stack ? e.stack.split('\n').slice(0, 4).join('\n') : ''); console.error('PAGE ERRORS:', errors.slice(0, 6).join(' | ') || '-'); process.exit(1); });
