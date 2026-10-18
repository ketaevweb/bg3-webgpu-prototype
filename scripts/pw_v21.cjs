/* v2.1 E2E (playwright): аура бездны, «Бездна зовёт» (подкрепление чемпиона),
   стела рекордов + журнал S.arenaLog, балансовая таблица глубины (КД-скейлинг),
   сейв/лоад 1:1 с журналом, чистый ремоут. Харнес — по урокам v1.7–v2.0. */
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

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30' })); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  const bad404 = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !bad404.includes(r.url())) bad404.push(r.status() + ' ' + r.url().replace('http://localhost:3000', '')); });

  /* G1: boot */
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  console.log('G1 BOOT:', await page.evaluate(() => JSON.stringify({
    heroes: window.__bg3.units.filter(u => u.side === 'hero').length,
    mapId: window.__bg3.turn().mapId,
  })));
  await page.evaluate(() => window.__bg3.forceSeason(-1));/* v2.4: нейтральный сезон — старые ассерты не зависят от недели */

  /* G2: постгейм — цитадель, Хальдир; стела + портал (испытание, best=0) */
  await page.evaluate(() => { window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true; window.__bg3.questDone('giants'); });
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__bg3.joinHaldir());
  await page.waitForTimeout(1200);
  const g2 = await page.evaluate(() => ({
    stela: window.__bg3.inters().includes('Стела рекордов (арена)'),
    arenaInter: window.__bg3.inters().includes('Испытание Глубин (арена)'),
    logLen: window.__bg3.S.arenaLog.length,
    heroes: window.__bg3.units.filter(u => u.side === 'hero').length,
  }));
  console.log('G2 POSTGAME (stela+portal):', JSON.stringify(g2));

  /* G3: испытание 5 волн → best=5, журнал: 1 запись (волна 5) */
  await page.evaluate(() => window.__bg3.arenaStart());
  for (let w = 1; w <= 5; w++) {
    await waitCombat(page);
    const st = await page.evaluate(() => window.__bg3.arenaState());
    if (st.wave !== w) { console.log('G3 WAVE MISMATCH: got ' + st.wave + ' want ' + w); process.exit(1); }
    await page.evaluate(() => window.__bg3.arenaWipe());
    await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
    await page.waitForTimeout(400);
  }
  const g3 = await page.evaluate(() => ({ best: window.__bg3.arenaState().best, logLen: window.__bg3.S.arenaLog.length, log0: window.__bg3.S.arenaLog[0] }));
  console.log('G3 TRIAL DONE:', JSON.stringify(g3), '(ожидание best=5, log 1 запись w=5)');

  /* G4: портал переменил лик; стела читается — в логе «Лучший заход: волна 5» */
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__bg3.callInter('Стела рекордов (арена)'));
  await page.waitForTimeout(400);
  const g4 = await page.evaluate(() => ({
    endlessLabel: window.__bg3.inters().includes('Бесконечное испытание (арена)'),
    stelaText: (document.getElementById('logbody') || {}).innerText || '',
  }));
  console.log('G4 STELA READ:', JSON.stringify({ endlessLabel: g4.endlessLabel, hasBest: g4.stelaText.includes('Лучший заход: волна 5'), hasWave5: g4.stelaText.includes('Волна 5') }));
  await shot(page, 'v21_stela.jpg');

  /* G5: бесконечный режим — волны 6→9 wipe'ами, на волне 10 СТОП (живой чемпион для G6–G8) */
  await page.evaluate(() => window.__bg3.arenaEndless());
  let champ = null;
  let g5 = null;
  for (let w = 6; w <= 10; w++) {
    await waitCombat(page);
    const st = await page.evaluate(() => window.__bg3.arenaState());
    if (st.wave !== w) { console.log('G5 WAVE MISMATCH: got ' + st.wave + ' want ' + w); process.exit(1); }
    if (w === 6) {
      g5 = await page.evaluate(() => {
        const d0 = window.__bg3.S.combatGroup.filter(e => e.alive)[0];
        return { depth: d0.depth, ac: d0.ac };
      });
    }
    if (w === 10) {
      champ = await page.evaluate(() => {
        const c = window.__bg3.S.combatGroup[0];
        return { name: c.name, champ: !!c.champ, elite: !!c.elite, ac: c.ac, maxhp: c.maxhp, reinforced: !!c.reinforced };
      });
      break;/* волна 10 идёт — не wipe: аура/подкрепление на живом чемпионе */
    }
    await page.evaluate(() => window.__bg3.arenaWipe());
    await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
    await page.waitForTimeout(300);
  }
  console.log('G5 W6 DEPTH TABLE:', JSON.stringify(g5), '(ожидание depth=1, ac 12=12+0)');

  /* G6: чемпион бездны на волне 10: champ/elite, КД 14=13+1 (k=5), hp 18=round(11×1.6) */
  if (!champ) { console.log('G6 NO CHAMPION'); process.exit(1); }
  console.log('G6 CHAMPION W10:', JSON.stringify(champ), '(ожидание champ, elite, ac 14, hp 18, не reinforced)');
  await shot(page, 'v21_champion_w10.jpg');

  /* G7: аура бездны — сосед чемпиона +2, герой 0, враг вдали 0 */
  const g8 = await page.evaluate(() => {
    const b = window.__bg3;
    const c = b.S.combatGroup[0];
    const e = b.S.combatGroup[1];
    e.x = c.x + 1; e.z = c.z;
    const near = b.aura(e);
    const hero = b.units.find(u => u.side === 'hero');
    const heroVal = b.aura(hero);
    const ex = e.x, ez = e.z;
    e.x = 20; e.z = 20;
    const far = b.aura(e);
    e.x = ex; e.z = ez;
    return { near, heroVal, far };
  });
  console.log('G7 AURA:', JSON.stringify(g8), '(ожидание near=2, hero=0, far=0)');
  await page.waitForTimeout(200);

  /* G9: «Бездна зовёт» — урон чемпиона до половины → +2 утопленника (глубинные) */
  const g9 = await page.evaluate(() => {
    const b = window.__bg3;
    const c = b.S.combatGroup[0];
    const before = b.S.combatGroup.filter(e => e.alive).length;
    b.hurt(c, Math.floor(c.maxhp / 2));/* 18 → 9 (ровно половина) */
    const grp = b.S.combatGroup.filter(e => e.alive);
    const reinf = grp.slice(-2);/* joinCombat push'ит в конец — последние 2 и есть подкрепление */
    return {
      before, after: grp.length,
      reinforced: !!c.reinforced, champHp: c.hp, champMax: c.maxhp,
      reinfHp: reinf.length === 2 ? reinf[0].maxhp : null,
      reinfAc: reinf.length === 2 ? reinf[0].ac : null,
      reinfDepth: reinf.length === 2 ? reinf[0].depth : null,
      reinfCls: reinf.length === 2 ? reinf[0].cls : null,
    };
  });
  console.log('G9 REINFORCE:', JSON.stringify(g9), '(ожидание after=before+2, reinforced, hp утопленников 22=round(14×1.6), КД 13=12+1, depth 5)');
  await shot(page, 'v21_reinforce_w10.jpg');

  /* G10: добиваем волну 10 → best=10; уход с карты → запись в журнал (w=10).
     v2.2: switchMap с ретраями — после shot() (loopStop/loopStart среди хода)
     busy может ещё держаться: switchMap при busy молча отказывает (урок v1.9). */
  await page.evaluate(() => window.__bg3.arenaWipe());
  await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.__bg3.switchMap('forest'));
    await page.waitForTimeout(1500);
    if (await page.evaluate(() => window.__bg3.turn().mapId === 'forest')) break;
  }
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'forest', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const g10 = await page.evaluate(() => ({
    best: window.__bg3.arenaState().best, wave: window.__bg3.arenaState().wave,
    logLen: window.__bg3.S.arenaLog.length, logLast: window.__bg3.S.arenaLog[window.__bg3.S.arenaLog.length - 1],
  }));
  console.log('G10 LEFT→JOURNAL:', JSON.stringify(g10), '(ожидание best=10, wave=0, журнал 2 записи, последняя w=10)');

  /* G11: сейв слот 3 → reload → doLoad 1:1 (журнал/рекорд/паладин/стела+портал) */
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__bg3.doSave(3));
  await page.waitForTimeout(800);
  const logSnapshot = await page.evaluate(() => window.__bg3.S.arenaLog);
  const goldBeforeSave = await page.evaluate(() => window.__bg3.S.gold);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => window.__bg3.doLoad(3));
  await page.waitForTimeout(3500);
  const g11 = await page.evaluate((exp) => {
    const b = window.__bg3;
    const sameLog = JSON.stringify(b.S.arenaLog) === JSON.stringify(exp.log);
    return {
      mapId: b.turn().mapId, best: b.arenaState().best,
      logLen: b.S.arenaLog.length, sameLog,
      gold: b.S.gold, goldMatch: b.S.gold === exp.gold,
      paladin: !!b.units.find(u => u.cls === 'paladin'),
      stela: b.inters().includes('Стела рекордов (арена)'),
      endlessLabel: b.inters().includes('Бесконечное испытание (арена)'),
    };
  }, { log: logSnapshot, gold: goldBeforeSave });
  console.log('G11 SAVE/LOAD 1:1:', JSON.stringify(g11));

  /* G12: чистый reload — 1 canvas, ошибок нет */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  const g12 = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, mapId: window.__bg3.turn().mapId }));
  const noise404 = bad404.filter(u => !u.includes('/models/rig/soldier.glb'));
  const hardErrors = errors.filter(e => !e.includes('status of 404'));
  console.log('G12 CLEAN RELOAD:', JSON.stringify(g12));
  console.log('404 non-fallback:', JSON.stringify(noise404));
  console.log('HARD ERRORS:', JSON.stringify(hardErrors));

  const checks = {
    g2: g2.stela && g2.arenaInter && g2.logLen === 0 && g2.heroes === 3,
    g3: g3.best === 5 && g3.logLen === 1 && !!g3.log0 && g3.log0.w === 5,
    g4: g4.endlessLabel && g4.stelaText.includes('Лучший заход: волна 5') && g4.stelaText.includes('Волна 5'),
    g5: g5.depth === 1 && g5.ac === 12,
    g6: champ.champ && champ.elite && champ.ac === 14 && champ.maxhp === 18 && !champ.reinforced,
    g8: g8.near === 2 && g8.heroVal === 0 && g8.far === 0,
    g9: g9.reinforced && g9.after === g9.before + 2 && g9.reinfHp === 22 && g9.reinfAc === 13 && g9.reinfDepth === 5,
    g10: g10.best === 10 && g10.wave === 0 && g10.logLen === 2 && !!g10.logLast && g10.logLast.w === 10,
    g11: g11.mapId === 'citadel' && g11.best === 10 && g11.sameLog && g11.logLen === 2 && g11.goldMatch && g11.paladin && g11.stela && g11.endlessLabel,
    g12: g12.canvases === 1 && noise404.length === 0 && hardErrors.length === 0,
  };
  console.log('CHECKS:', JSON.stringify(checks));
  const ok = Object.values(checks).every(Boolean);
  console.log(ok ? 'ALL GATES GREEN' : 'GATES FAILED');
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
