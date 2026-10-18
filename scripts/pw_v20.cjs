/* v2.0 E2E (playwright): «Бесконечное испытание» — портал меняет лик после
   испытания (волны 6+ с глубинным усилением), чемпион бездны на 10-й волне,
   срыв испытания уходом с карты, сейв/лоад 1:1 с рекордом, чистый ремоут.
   Харнес — по урокам v1.7–v1.9: gfx-пресет через addInitScript, точные
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
const waitCombat = (page) => page.waitForFunction(() => window.__bg3 && window.__bg3.turn().combatOn, null, { timeout: 30000 });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30', voice: false })); } catch {}
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

  /* G2: постгейм — флаги финала, цитадель, Хальдир; портал = испытание (best=0) */
  await page.evaluate(() => { window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true; window.__bg3.questDone('giants'); });
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__bg3.joinHaldir());
  await page.waitForTimeout(1200);
  const g2 = await page.evaluate(() => {
    const b = window.__bg3;
    return {
      arenaInter: b.inters().includes('Испытание Глубин (арена)'),
      best: b.arenaState().best,
      heroes: b.units.filter(u => u.side === 'hero').length,
    };
  });
  console.log('G2 POSTGAME PORTAL(trial):', JSON.stringify(g2));

  /* G3: испытание — 5 волн wipe'ами (старт один раз; волны приходят сами), рекорд 1→5 */
  const gold0 = await page.evaluate(() => window.__bg3.S.gold);
  await page.evaluate(() => window.__bg3.arenaStart());
  for (let w = 1; w <= 5; w++) {
    await waitCombat(page);
    const st = await page.evaluate(() => window.__bg3.arenaState());
    if (st.wave !== w) { console.log('G3 WAVE MISMATCH: got ' + st.wave + ' want ' + w); process.exit(1); }
    await page.evaluate(() => window.__bg3.arenaWipe());
    await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
    await page.waitForTimeout(400);
  }
  const g3 = await page.evaluate((g0) => JSON.stringify({ best: window.__bg3.arenaState().best, wave: window.__bg3.arenaState().wave, gold: window.__bg3.S.gold, delta: window.__bg3.S.gold - g0 }), gold0);
  console.log('G3 TRIAL 5 WAVES:', g3, '(ожидание best=5, delta≈725+250..350 бонус)');

  /* G4: портал переменил лик — «Бесконечное испытание (арена)» */
  const g4 = await page.evaluate(() => ({
    endlessLabel: window.__bg3.inters().includes('Бесконечное испытание (арена)'),
    trialLabel: window.__bg3.inters().includes('Испытание Глубин (арена)'),
  }));
  console.log('G4 PORTAL SWAPPED:', JSON.stringify(g4));
  await shot(page, 'v20_portal_endless.jpg');

  /* G5: бесконечное испытание — волна 6: 3 врага, «Глубинный», усиленный hp (14→16) */
  await page.evaluate(() => window.__bg3.arenaEndless());
  await waitCombat(page);
  await page.waitForTimeout(600);
  const g5 = await page.evaluate(() => {
    const b = window.__bg3;
    const grp = b.S.combatGroup.filter(e => e.alive);
    return {
      st: b.arenaState(),
      n: grp.length,
      cls: grp.map(u => u.cls),
      names: grp.map(u => u.name),
      drownedHp: grp.filter(u => u.cls === 'undead')[0] ? grp.filter(u => u.cls === 'undead')[0].maxhp : null,
    };
  });
  console.log('G5 ENDLESS W6:', JSON.stringify(g5), '(ожидание hp утопленника 16 = 14×1.12)');
  await shot(page, 'v20_endless_w6.jpg');

  /* G6: добив волны 6 — рекорд 6, награда 140 (40+90+10 глубинной прибавки) */
  const g60 = await page.evaluate(() => window.__bg3.S.gold);
  await page.evaluate(() => window.__bg3.arenaWipe());
  await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const g6 = await page.evaluate((g0) => ({ best: window.__bg3.arenaState().best, delta: window.__bg3.S.gold - g0 }), g60);
  console.log('G6 W6 REWARD:', JSON.stringify(g6), '(ожидание best=6, 140 награда + лут undead 9..27)');

  /* G7: волны 7→10 — на 10-й чемпион бездны (элита, скелет hp 11×1.6→18) */
  for (let w = 7; w <= 10; w++) {
    await page.waitForFunction(() => window.__bg3.turn().combatOn, null, { timeout: 30000 });
    const st = await page.evaluate(() => window.__bg3.arenaState());
    if (st.wave !== w) { console.log('G7 WAVE MISMATCH: got ' + st.wave + ' want ' + w); process.exit(1); }
    if (w === 10) {
      const ch = await page.evaluate(() => {
        const c = window.__bg3.S.combatGroup[0];
        return { name: c.name, short: c.short, elite: !!c.elite, maxhp: c.maxhp, dice: c.weapon.dice.slice() };
      });
      console.log('G7 CHAMPION W10:', JSON.stringify(ch), '(ожидание скелет hp 18, dice [1,8], elite)');
      await shot(page, 'v20_champion_w10.jpg');
    }
    await page.evaluate(() => window.__bg3.arenaWipe());
    await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
    await page.waitForTimeout(300);
  }
  const g7 = await page.evaluate(() => ({ best: window.__bg3.arenaState().best, wave: window.__bg3.arenaState().wave }));
  console.log('G7 AFTER W10:', JSON.stringify(g7), '(ожидание best=10, волна 11 на подходе)');

  /* G8: срыв испытания уходом с карты в окне таймера → wave=0 */
  await page.evaluate(() => window.__bg3.switchMap('forest'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'forest', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const g8 = await page.evaluate(() => window.__bg3.arenaState());
  console.log('G8 LEFT MAP → TRIAL BROKEN:', JSON.stringify(g8), '(ожидание wave=0, best=10)');

  /* G9: возврат в цитадель — портал сразу бесконечный (rebuild по S.arenaBest≥5) */
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const g9 = await page.evaluate(() => ({
    endlessLabel: window.__bg3.inters().includes('Бесконечное испытание (арена)'),
    wave: window.__bg3.arenaState().wave,
  }));
  console.log('G9 REBUILD PORTAL(endless):', JSON.stringify(g9));

  /* G10: сейв слот 3 → чистый reload → doLoad 1:1 (рекорд/золото/паладин/портал) */
  const goldBeforeSave = await page.evaluate(() => window.__bg3.S.gold);
  await page.evaluate(() => window.__bg3.doSave(3));
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => window.__bg3.doLoad(3));
  await page.waitForTimeout(3500);
  const g10 = await page.evaluate((g0) => {
    const b = window.__bg3;
    const pal = b.units.find(u => u.cls === 'paladin');
    return {
      mapId: b.turn().mapId,
      best: b.arenaState().best,
      gold: b.S.gold, goldMatch: b.S.gold === g0,
      paladin: !!pal, heroes: b.units.filter(u => u.side === 'hero').length,
      endlessLabel: b.inters().includes('Бесконечное испытание (арена)'),
    };
  }, goldBeforeSave);
  console.log('G10 SAVE/LOAD 1:1:', JSON.stringify(g10));

  /* G11: чистый reload — 1 canvas, ошибок нет */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  const g11 = await page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas').length,
    mapId: window.__bg3.turn().mapId,
  }));
  console.log('G11 CLEAN RELOAD:', JSON.stringify(g11));
  const noise404 = bad404.filter(u => !u.includes('/models/rig/soldier.glb'));/* v1.7-фолбэк — штатный шум (probe: иных 404 нет) */
  const hardErrors = errors.filter(e => !e.includes('status of 404'));/* console-404 ×3 = тот же soldier.glb без URL в тексте */
  console.log('404 non-fallback:', JSON.stringify(noise404));
  console.log('HARD ERRORS:', JSON.stringify(hardErrors));

  const ok = g2.arenaInter && g2.best === 0 && g2.heroes === 3
    && g3.includes('"best":5')
    && g4.endlessLabel && !g4.trialLabel
    && g5.n === 3 && g5.drownedHp === 16 && g5.names.every(n => n.includes('Глубинный'))
    && g6.best === 6 && g6.delta >= 140 && g6.delta <= 300/* v2.2: 140 награда + лут волны + конверсия XP у капнутых героев (волна 6: ≤90 зол) + элитный лут рыцаря */
    && g7.best === 10
    && g8.wave === 0 && g8.best === 10
    && g9.endlessLabel && g9.wave === 0
    && g10.mapId === 'citadel' && g10.best === 10 && g10.goldMatch && g10.paladin && g10.endlessLabel
    && g11.canvases === 1 && noise404.length === 0 && hardErrors.length === 0;
  console.log(ok ? 'ALL GATES GREEN' : 'GATES FAILED');
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
