/* v2.3 E2E (playwright): ТЕНЬ ОТРЯДА (зеркальная волна-босс на k%10===0),
   апгрейд реликвий у призрака (S.relicUp, эффект eq/uneq через relicBoost),
   серверный лидерборд глубины (/api/scores + летопись у стелы).
   Харнес — по урокам v1.7–v2.2: фильтр 404-фолбэка soldier.glb, arenaStart
   ОДИН раз, прыжок глубины arenaSetWave вместо 10 вайпов, поэлементные checks. */
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
  const g1 = await page.evaluate(() => JSON.stringify({
    heroes: window.__bg3.units.filter(u => u.side === 'hero').length,
    mapId: window.__bg3.turn().mapId,
  }));
  console.log('G1 BOOT:', g1);
  if (!g1.includes('"heroes":2') || !g1.includes('forest')) fail('G1 boot wrong');
  await page.evaluate(() => window.__bg3.forceSeason(-1));/* v2.4: нейтральный сезон — старые ассерты не зависят от недели */

  /* G2: постгейм — цитадель, Хальдир; стела + призрак + портал */
  await page.evaluate(() => { window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true; window.__bg3.questDone('giants'); });
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__bg3.joinHaldir());
  await page.waitForTimeout(1200);
  const g2 = await page.evaluate(() => ({
    stela: window.__bg3.inters().includes('Стела рекордов (арена)'),
    ghost: window.__bg3.inters().includes('Призрак коменданта (обмен реликвий)'),
    heroes: window.__bg3.units.filter(u => u.side === 'hero').length,
    hero0: window.__bg3.units.find(u => u.side === 'hero').name,
  }));
  console.log('G2 POSTGAME:', JSON.stringify(g2));
  if (!g2.stela || !g2.ghost || g2.heroes !== 3) fail('G2 postgame incomplete');

  /* G3: бесконечный режим → прыжок на волну 14 → волна 15 = ТЕНЬ ОТРЯДА */
  await page.evaluate(() => window.__bg3.arenaEndless());
  await waitCombat(page);
  let st = await page.evaluate(() => window.__bg3.arenaState());
  if (st.wave !== 6) fail('G3 wave6 got ' + st.wave);
  await page.evaluate(() => window.__bg3.arenaWipe());
  await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
  await page.evaluate(() => window.__bg3.arenaSetWave(14));/* прыжок: таймер 1700мс спавнит волну 14 */
  await page.waitForTimeout(2100);
  await waitCombat(page);
  const g3a = await page.evaluate(() => ({
    wave: window.__bg3.arenaState().wave,
    names: window.__bg3.S.combatGroup.filter(e => e.alive).map(e => e.short),
  }));
  console.log('G3a WAVE14 (k=9, без зеркала):', JSON.stringify(g3a));
  if (g3a.wave !== 14 || g3a.names.some(n => n.includes('Тень') || n.includes('Чемпион'))) fail('G3a wave14 wrong');
  await page.evaluate(() => window.__bg3.arenaWipe());
  await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
  await page.waitForTimeout(2100);
  await waitCombat(page);
  const g3 = await page.evaluate(() => {
    const b = window.__bg3;
    const heroes = b.units.filter(u => u.side === 'hero' && u.alive);
    const shadows = b.S.combatGroup.filter(e => e.alive && e.name.startsWith('Тень: '));
    const k = 10, mult = 1 + 0.12 * k;
    const pair = heroes.map(h => {
      const s = shadows.find(x => x.name === 'Тень: ' + h.name);
      return s ? { name: s.name, hpOk: s.maxhp === Math.round(h.maxhp * mult), hp: s.maxhp, wantHp: Math.round(h.maxhp * mult),
        acOk: s.ac === h.ac + 2, ac: s.ac, diceOk: s.weapon.dice[1] === h.weapon.dice[1] + Math.floor(k / 2), dice: s.weapon.dice[1], xp: s.xp } : null;
    });
    return { wave: b.arenaState().wave, endless: b.arenaState().endless, heroN: heroes.length, shadowN: shadows.length, pair,
      anyChampion: b.S.combatGroup.some(e => e.name.includes('Чемпион')) };
  });
  console.log('G3b MIRROR W15:', JSON.stringify(g3), '(ожидание: shadowN=heroN=3, hp ×2.2, КД +2, кость +5, xp 330, без чемпиона)');
  if (g3.wave !== 15 || !g3.endless || g3.shadowN !== g3.heroN || g3.anyChampion) fail('G3 mirror composition wrong');
  if (g3.pair.some(p => !p || !p.hpOk || !p.acOk || !p.diceOk) || g3.pair[0].xp !== 330) fail('G3 mirror stats wrong: ' + JSON.stringify(g3.pair));
  await shot(page, 'v23_mirror_w15.jpg');

  /* G4: добиваем зеркало → волна 16 обычная; рекорд 15 улетел в /api/scores */
  await page.evaluate(() => window.__bg3.arenaWipe());
  await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
  await page.waitForTimeout(2100);
  await waitCombat(page);
  const g4 = await page.evaluate(async (hero0) => {
    const b = window.__bg3;
    const names = b.S.combatGroup.filter(e => e.alive).map(e => e.short);
    const r = await fetch('/api/scores'); const rows = await r.json();
    return { wave: b.arenaState().wave, best: b.arenaState().best, endlessWaveNormal: !names.some(n => n.includes('Тень') || n.includes('Чемпион')),
      bestRow: rows.find(s => s.name === hero0 && s.best === 15) || null, rows: rows.length };
  }, g2.hero0);
  console.log('G4 W16 + SCORE:', JSON.stringify(g4), '(ожидание wave 16, best 15, обычная волна, запись {hero0,15} на сервере)');
  if (g4.wave !== 16 || g4.best !== 15 || !g4.endlessWaveNormal || !g4.bestRow) fail('G4 wave16/score wrong');
  await page.evaluate(() => window.__bg3.arenaWipe());
  await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
  /* уход с карты в окне таймера волны 17 (1700мс): teardown рвёт заход — журнал получает w16, best=16 */
  await page.evaluate(() => window.__bg3.switchMap('forest'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'forest', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3000);

  /* G5+G6: покупка Сердца бездны → диалог призрака: опция [Улучшение], клик по DOM */
  const g5 = await page.evaluate(() => {
    const b = window.__bg3;
    b.S.gold = 2600;
    return { buy: b.buyRelic('abyss_heart'), gold: b.S.gold, upgraded0: b.S.relicUp.includes('abyss_heart') };
  });
  /* upgraded0 здесь ещё false — реликвия куплена, но НЕ улучшена (для DOM-клика) */
  console.log('G5 BUY HEART:', JSON.stringify(g5), '(ожидание buy=true, gold 2200, upgraded0=false)');
  if (!g5.buy || g5.gold !== 2200 || g5.upgraded0) fail('G5 buy heart wrong');
  await page.evaluate(() => window.__bg3.callInter('Призрак коменданта (обмен реликвий)'));
  await page.waitForTimeout(600);
  const g6 = await page.evaluate(() => {
    const opts = Array.from(document.querySelectorAll('#dlgOpts button')).map(b => b.textContent || '');
    return { open: !!document.getElementById('dlgBox') && document.getElementById('dlgBox').style.display !== 'none',
      hasUpHeart: opts.some(t => t.includes('[Улучшение] Сердце бездны')),
      hasUpShard: opts.some(t => t.includes('[Улучшение] Осколок')), hasUpSeal: opts.some(t => t.includes('[Улучшение] Печать')),
      hasBuySeal: opts.some(t => t.includes('[Реликвия] Печать глубин')), buyShard: opts.some(t => t.includes('[Реликвия] Осколок портала')),
      idxUpHeart: opts.findIndex(t => t.includes('[Улучшение] Сердце бездны')), n: opts.length };
  });
  console.log('G6 GHOST DIALOG:', JSON.stringify(g6), '(ожидание: [Улучшение] только для купленного Сердца, покупка Печати/Осколка видна)');
  if (!g6.open || !g6.hasUpHeart || g6.hasUpShard || g6.hasUpSeal || !g6.hasBuySeal || !g6.buyShard) fail('G6 dialog options wrong');
  await page.screenshot({ path: 'upload/e2e/v23_ghost_upgrade.jpg', quality: 82, type: 'jpeg' });
  await page.evaluate((i) => document.querySelectorAll('#dlgOpts button')[i].click(), g6.idxUpHeart);
  await page.waitForTimeout(500);
  const g6b = await page.evaluate(() => ({ gold: window.__bg3.S.gold, up: window.__bg3.S.relicUp }));
  console.log('G6b UPGRADE VIA DOM:', JSON.stringify(g6b), '(ожидание gold 1700, relicUp=[abyss_heart])');
  if (g6b.gold !== 1700 || JSON.stringify(g6b.up) !== JSON.stringify(['abyss_heart'])) fail('G6b dom upgrade wrong');
  await page.evaluate(() => { const btns = document.querySelectorAll('#dlgOpts button'); btns[btns.length - 1].click(); });/* [Уйти] */
  await page.waitForTimeout(300);

  /* G7: эффекты усиленных реликвий: HP +18, КД +3, атака +2; отказы (надета/уже усилена) */
  const g7 = await page.evaluate(() => {
    const b = window.__bg3;
    const out = {};
    const f = b.units.find(u => u.cls === 'fighter');
    const f0 = f.maxhp;
    b.giveGear('abyss_heart', 'fighter');
    out.hpUp = f.maxhp - f0;                    /* 18 */
    b.unequipGear('fighter', 'trinket');
    out.hpBack = f.maxhp - f0;                  /* 0 (симметрия) */
    out.upAgain = b.upgradeRelic('abyss_heart');/* false — уже усилена */
    out.buySeal = b.buyRelic('deep_seal');      /* −600 → 1100 */
    out.upSeal = b.upgradeRelic('deep_seal');   /* −900 → 200 (в сумке — можно) */
    const wz = b.units.find(u => u.cls === 'wizard');
    const ac0 = wz.ac;
    b.giveGear('deep_seal', 'wizard');
    out.acUp = wz.ac - ac0;                     /* 3 */
    b.unequipGear('wizard', 'trinket');
    out.acBack = wz.ac - ac0;                   /* 0 */
    b.S.gold = 1200;
    out.buyShard = b.buyRelic('portal_shard');  /* −500 → 700 */
    b.giveGear('portal_shard', 'fighter');      /* надет: базовый +1 */
    out.shardEquipped = f.atkBonus || 0;
    out.upEquipped = b.upgradeRelic('portal_shard');/* false — снять сначала */
    out.goldKept = b.S.gold;                    /* 700 */
    b.unequipGear('fighter', 'trinket');
    out.upShard = b.upgradeRelic('portal_shard');/* −700 → 0 */
    b.giveGear('portal_shard', 'fighter');
    out.shardUp = f.atkBonus || 0;              /* 2 */
    out.goldEnd = b.S.gold;
    out.relicUp = [...b.S.relicUp];
    return out;
  });
  console.log('G7 RELIC UPGRADES:', JSON.stringify(g7), '(ожидание hp +18/0, ac +3/0, атака 1→2, отказы, gold 700→0, relicUp ×3)');
  if (g7.hpUp !== 18 || g7.hpBack !== 0 || g7.upAgain || !g7.buySeal || !g7.upSeal) fail('G7 heart/seal wrong');
  if (g7.acUp !== 3 || g7.acBack !== 0 || !g7.buyShard || g7.shardEquipped !== 1 || g7.upEquipped || g7.goldKept !== 700) fail('G7 seal/shard gates wrong');
  if (!g7.upShard || g7.shardUp !== 2 || g7.goldEnd !== 0 || g7.relicUp.length !== 3) fail('G7 shard upgrade wrong');

  /* G8: API-гейты: топ отсортирован, невалидный POST → 400 */
  const g8 = await page.evaluate(async () => {
    const bad1 = await fetch('/api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '', best: 15 }) });
    const bad2 = await fetch('/api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X', best: 0 }) });
    const rows = await (await fetch('/api/scores')).json();
    const sorted = rows.every((r, i) => i === 0 || rows[i - 1].best > r.best || (rows[i - 1].best === r.best && rows[i - 1].when <= r.when));
    return { s1: bad1.status, s2: bad2.status, n: rows.length, sorted, top5: rows.slice(0, 5).map(r => r.name + ':' + r.best) };
  });
  console.log('G8 API GATES:', JSON.stringify(g8), '(ожидание 400/400, сортировка best desc)');
  if (g8.s1 !== 400 || g8.s2 !== 400 || !g8.sorted) fail('G8 api wrong');

  /* G9: стела — журнал + серверная летопись в логе */
  await page.evaluate(() => window.__bg3.callInter('Стела рекордов (арена)'));
  await page.waitForTimeout(900);
  const g9 = await page.evaluate(() => {
    const t = (document.getElementById('logbody') || {}).innerText || '';
    return { best: t.includes('Лучший заход: волна 16'), server: t.includes('Летопись Глубин (сервер)'), w16: t.includes('Волна 16'), srow: t.includes('волна 16') };
  });
  console.log('G9 STELA:', JSON.stringify(g9));
  if (!g9.best || !g9.server || !g9.w16 || !g9.srow) fail('G9 stela wrong');

  /* G10: сейв слот 3 → reload → doLoad 1:1 (relicUp/золото/сумка/усиленный эффект) */
  await page.evaluate(() => window.__bg3.doSave(3));
  await page.waitForTimeout(800);
  const snap = await page.evaluate(() => ({
    relicUp: window.__bg3.S.relicUp, gold: window.__bg3.S.gold, bag: window.__bg3.S.bag,
    best: window.__bg3.arenaState().best, fhp: window.__bg3.units.find(u => u.cls === 'fighter').maxhp,
  }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => window.__bg3.doLoad(3));
  await page.waitForTimeout(3500);
  const g10 = await page.evaluate((exp) => {
    const b = window.__bg3;
    const f = b.units.find(u => u.cls === 'fighter');
    const pre = { relicUp: [...b.S.relicUp], gold: b.S.gold, bag: [...b.S.bag] };/* до надевания: замена талисмана меняет сумку */
    const f0 = f.maxhp;
    b.giveGear('abyss_heart', 'fighter');
    return { mapId: b.turn().mapId, ...pre, best: b.arenaState().best,
      fhpMatch: f0 === exp.fhp, hpUpAfterLoad: f.maxhp - f0,
      ghost: b.inters().includes('Призрак коменданта (обмен реликвий)'), stela: b.inters().includes('Стела рекордов (арена)'),
      endlessLabel: b.inters().includes('Бесконечное испытание (арена)'), paladin: !!b.units.find(u => u.cls === 'paladin') };
  }, snap);
  console.log('G10 SAVE/LOAD 1:1:', JSON.stringify(g10), '(ожидание relicUp ×3, gold 0, best как в снапе, надевание Сердца после лоада даёт +18)');
  if (!g10.fhpMatch || g10.hpUpAfterLoad !== 18 || g10.best !== snap.best || !g10.ghost || !g10.stela || !g10.endlessLabel || !g10.paladin) fail('G10 save/load wrong');
  if (JSON.stringify(g10.relicUp) !== JSON.stringify(snap.relicUp) || g10.gold !== snap.gold || JSON.stringify(g10.bag) !== JSON.stringify(snap.bag)) fail('G10 relicUp/gold/bag mismatch');

  /* G11: чистый reload — 1 canvas, ошибок нет (кроме штатного 404-фолбэка) */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  const g11 = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, mapId: window.__bg3.turn().mapId }));
  const noise404 = bad404.filter(u => !u.includes('/models/rig/soldier.glb') && !u.includes('/api/scores'));/* /api/scores 400 — наш негативный тест G8 */
  const hardErrors = errors.filter(e => !e.includes('status of 404') && !e.includes('soldier.glb') && !e.includes('status of 400'));
  console.log('G11 CLEAN RELOAD:', JSON.stringify(g11), 'hardErrors=' + hardErrors.length, 'noise404=' + noise404.length);
  if (g11.canvases !== 1 || hardErrors.length || noise404.length) fail('G11 clean reload wrong: ' + JSON.stringify(hardErrors.concat(noise404).slice(0, 4)));

  console.log('ALL V23 GATES GREEN');
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
