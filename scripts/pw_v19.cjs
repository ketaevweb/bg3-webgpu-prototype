/* v1.9 E2E (playwright): «Слава Дозора» — миникарта (M), постгейм-цитадель
   (Хальдир + портал арены), шестой спутник-паладин, «Испытание Глубин»
   (5 волн), рекорд/награда, сейв/лоад 1:1 с новыми флагами, чистый ремоут.
   Харнес — по урокам v1.7/v1.8: gfx-пресет через addInitScript, точные
   JS-клики, короткие бои (виртуальный добив через __bg3.arenaWipe). */
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

  /* G1: boot v1.9 */
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  console.log('G1 BOOT:', await page.evaluate(() => JSON.stringify({
    heroes: window.__bg3.units.filter(u => u.side === 'hero').length,
    mapId: window.__bg3.turn().mapId,
    bootLog: 'v1.9 in logs',
  })));

  /* G2: миникарта — клавиша M открывает, снимок данные содержит, повторное M закрывает */
  await page.keyboard.press('m');
  await page.waitForTimeout(700);
  const mm1 = await page.evaluate(() => {
    const el = document.getElementById('mm');
    const cv = document.getElementById('mmCv');
    let painted = 0;
    if (cv) {
      const g = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < g.length; i += 4) { if (g[i] !== 16 || g[i + 1] !== 22 || g[i + 2] !== 15) painted++; }
    }
    const mm = window.__bg3.mm();
    return { open: !!el, painted, grid: mm && mm.grid, solid: mm && mm.solid.length, dots: mm && mm.dots.length / 3 };
  });
  console.log('G2 MINIMAP OPEN:', JSON.stringify(mm1));
  await shot(page, 'v19_minimap.jpg');
  await page.keyboard.press('m');
  await page.waitForTimeout(400);
  console.log('G2 MINIMAP CLOSED:', JSON.stringify(await page.evaluate(() => ({ open: !!document.getElementById('mm') }))));

  /* G3: кнопка 🗺 тоже открывает */
  await page.evaluate(() => { const b = document.getElementById('mmBtn'); if (b) b.click(); });
  await page.waitForTimeout(500);
  console.log('G3 MM BTN:', JSON.stringify(await page.evaluate(() => ({ open: !!document.getElementById('mm') }))));
  await page.evaluate(() => { const b = document.getElementById('mmBtn'); if (b) b.click(); });
  await page.waitForTimeout(300);

  /* G4: постгейм — флаги финала, цитадель: Хальдир-сцена и портал арены */
  await page.evaluate(() => { window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true; window.__bg3.questDone('giants'); });
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const g4 = await page.evaluate(() => {
    const b = window.__bg3;
    return {
      garrison: b.units.filter(u => u.side === 'goblin' && u.alive).length,
      haldirScene: b.inters().some(l => l.includes('капитаном Дозора')),
      arenaInter: b.inters().some(l => l.includes('Испытание Глубин')),
      heroes: b.units.filter(u => u.side === 'hero').length,
    };
  });
  console.log('G4 POSTGAME CITADEL:', JSON.stringify(g4));
  await shot(page, 'v19_postgame_citadel.jpg');

  /* G5: Хальдир присоединяется — шестой класс paladin в отряде */
  await page.evaluate(() => window.__bg3.joinHaldir());
  await page.waitForTimeout(1200);
  const g5 = await page.evaluate(() => {
    const b = window.__bg3;
    const pal = b.units.find(u => u.cls === 'paladin');
    return { joined: !!pal, side: pal && pal.side, hp: pal && pal.hp, flag: b.S.haldirJoined, heroes: b.units.filter(u => u.side === 'hero').length };
  });
  console.log('G5 HALDIR JOINED:', JSON.stringify(g5));

  /* G6: арена стартует — волна 1 (2 утопленника), бой включён */
  await page.evaluate(() => window.__bg3.arenaStart());
  await page.waitForTimeout(1500);
  const g6 = await page.evaluate(() => {
    const b = window.__bg3;
    return { combat: b.turn().combatOn, wave: b.arenaState().wave, enemies: b.S.combatGroup.filter(e => e.alive).length, cls0: b.S.combatGroup[0] && b.S.combatGroup[0].cls };
  });
  console.log('G6 ARENA W1:', JSON.stringify(g6));
  await shot(page, 'v19_arena_w1.jpg');

  /* G7: пять волн — wipe после каждой, рекорд растёт, награды капают */
  const gold0 = await page.evaluate(() => window.__bg3.S.gold);
  const waves = [];
  for (let w = 1; w <= 5; w++) {
    await page.evaluate(() => window.__bg3.arenaWipe());
    await page.waitForTimeout(2600);
    waves.push(await page.evaluate((exp) => {
      const b = window.__bg3;
      return {
        best: b.arenaState().best,
        wave: b.arenaState().wave,
        combat: b.turn().combatOn,
        enemies: b.S.combatGroup.filter(e => e.alive).length,
        gold: b.S.gold,
        heroesAlive: b.units.filter(u => u.side === 'hero' && u.alive).length,
      };
    }, w));
  }
  console.log('G7 WAVES:', JSON.stringify(waves));
  console.log('G7 GOLD:', JSON.stringify({ before: gold0, after: await page.evaluate(() => window.__bg3.S.gold) }));
  const g7done = await page.evaluate(() => ({ wave: window.__bg3.arenaState().wave, best: window.__bg3.arenaState().best, combat: window.__bg3.turn().combatOn }));
  console.log('G7 ARENA DONE:', JSON.stringify(g7done));
  await shot(page, 'v19_arena_done.jpg');

  /* G8: арена повторяема — второй заход проходим до конца (5 волн вновь) */
  await page.evaluate(() => window.__bg3.arenaStart());
  await page.waitForTimeout(1200);
  console.log('G8 REPLAY:', JSON.stringify(await page.evaluate(() => ({ wave: window.__bg3.arenaState().wave, combat: window.__bg3.turn().combatOn }))));
  for (let w = 0; w < 5; w++) {
    await page.evaluate(() => window.__bg3.arenaWipe());
    await page.waitForTimeout(2500);
  }
  console.log('G8 REPLAY DONE:', JSON.stringify(await page.evaluate(() => ({ wave: window.__bg3.arenaState().wave, best: window.__bg3.arenaState().best, combat: window.__bg3.turn().combatOn }))));
  /* мы остаёмся на цитадели — фаза explore, бой завершён */
  await page.waitForTimeout(800);

  /* G9: сейв/лоад 1:1 — новые флаги haldirJoined/arenaBest в слоте 2 */
  const snap = await page.evaluate(() => {
    const b = window.__bg3;
    const sv = b.gameSnapshot();
    return { flags: { haldirJoined: sv.flags.haldirJoined, arenaBest: sv.flags.arenaBest, campaignDone: sv.flags.campaignDone }, heroes: sv.heroes.map(h => h.cls), gold: sv.gold, mapId: sv.mapId };
  });
  console.log('G9 SNAPSHOT:', JSON.stringify(snap));
  await page.evaluate(() => window.__bg3.doSave(2));
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => window.__bg3.doLoad(2));
  await page.waitForTimeout(3500);
  const g9 = await page.evaluate(() => {
    const b = window.__bg3;
    const pal = b.units.find(u => u.cls === 'paladin');
    return {
      mapId: b.turn().mapId,
      flags: { haldirJoined: b.S.haldirJoined, arenaBest: b.S.arenaBest, campaignDone: b.S.campaignDone },
      paladin: !!pal, palHp: pal && pal.hp,
      heroes: b.units.filter(u => u.side === 'hero').length,
      haldirScene: b.inters().some(l => l.includes('капитаном Дозора')),
      arenaInter: b.inters().some(l => l.includes('Испытание Глубин')),
      gold: b.S.gold,
    };
  });
  console.log('G9 LOADED:', JSON.stringify(g9));
  await shot(page, 'v19_loaded_citadel.jpg');

  /* G10: чистый ремоут */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(8000);
  console.log('G10 CLEAN RELOAD:', JSON.stringify(await page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas').length,
    mapId: window.__bg3.turn().mapId,
    heroes: window.__bg3.units.filter(u => u.side === 'hero').length,
  }))));

  console.log('ERRORS:', errors.length ? errors.slice(0, 8) : 'none');
  console.log('BAD404:', bad404.length ? bad404.slice(0, 8) : 'none');
  await browser.close();
  process.exit(0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
