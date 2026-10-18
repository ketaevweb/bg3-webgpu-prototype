/* v2.4 E2E (playwright): СЕЗОНЫ ГЛУБИНЫ — еженедельный ротационный аффикс
   (реальная неделя + форс 0/1/3/4), косметика тени (тинт облика сезона),
   награда «Дань глубин» ×1.5, HUD-панель «Летопись Глубин» (T/🏆):
   сезон + рекорд + журнал + серверный топ-10, стела с сезоном.
   Харнес — по урокам v1.7–v2.3: фильтр 404-фолбэка soldier.glb, arenaStart
   ОДИН раз, поэлементные checks, золото интервально (лут [3..9]×врагов). */
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
const waitCalm = (page) => page.waitForFunction(() => window.__bg3 && !window.__bg3.turn().combatOn, null, { timeout: 15000 });
const fail = (msg) => { console.log('FAIL: ' + msg); process.exit(1); };
const SEASONS = ['Кровавый прилив', 'Костяная стужа', 'Мора глубин', 'Ярость толпы', 'Дань глубин'];

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
  const g1 = await page.evaluate(() => JSON.stringify({
    heroes: window.__bg3.units.filter(u => u.side === 'hero').length,
    mapId: window.__bg3.turn().mapId,
  }));
  console.log('G1 BOOT:', g1);
  if (!g1.includes('"heroes":2') || !g1.includes('forest')) fail('G1 boot wrong');

  /* G2: сезон по умолчанию = реальная неделя; forceSeason(-1) — вне сезона */
  const g2 = await page.evaluate(() => {
    const want = Math.floor(Date.now() / 604800000) % 5;
    const real = window.__bg3.season();
    window.__bg3.forceSeason(-1);
    const off = window.__bg3.season();
    window.__bg3.forceSeason(null);
    const back = window.__bg3.season();
    return { want, real, off, back };
  });
  console.log('G2 SEASON ROTATION:', JSON.stringify(g2));
  if (g2.real.idx !== g2.want || g2.real.name !== SEASONS[g2.want] || !g2.real.desc) fail('G2 real week season wrong');
  if (g2.off.idx !== -1 || g2.off.name !== '—' || g2.back.idx !== g2.want) fail('G2 force/off cycle wrong');

  /* G3: постгейм — цитадель, Хальдир; стела + призрак + портал */
  await page.evaluate(() => { window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true; window.__bg3.questDone('giants'); });
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__bg3.joinHaldir());
  await page.waitForTimeout(1200);
  const g3 = await page.evaluate(() => ({
    stela: window.__bg3.inters().includes('Стела рекордов (арена)'),
    ghost: window.__bg3.inters().includes('Призрак коменданта (обмен реликвий)'),
    heroes: window.__bg3.units.filter(u => u.side === 'hero').length,
    hero0: window.__bg3.units.find(u => u.side === 'hero').name,
  }));
  console.log('G3 POSTGAME:', JSON.stringify(g3));
  if (!g3.stela || !g3.ghost || g3.heroes !== 3) fail('G3 postgame incomplete');

  /* G4: сезон 0 «Кровавый прилив» (волна 6, k=1): кость +1 (число), hp ×1.12, тинт 0x8a2a2a */
  await page.evaluate(() => window.__bg3.forceSeason(0));
  await page.evaluate(() => window.__bg3.arenaEndless());
  await waitCombat(page);
  const g4 = await page.evaluate(() => {
    const b = window.__bg3;
    const es = b.S.combatGroup.filter(e => e.alive);
    const tint = (u) => {
      const body = u.rig && u.rig.children[0];
      return body && body.material && body.material.color ? body.material.color.getHex() : -1;
    };
    const pick = (cn) => es.filter(e => e.clsName === cn).map(e => ({ hp: e.maxhp, ac: e.ac, dice: [...e.weapon.dice], tint: tint(e), name: e.name }));
    return { wave: b.arenaState().wave, n: es.length, drowned: pick('Утопленник'), skk: pick('Скелет-рыцарь'),
      anyChamp: es.some(e => e.name.includes('Чемпион')), anyShadow: es.some(e => e.name.includes('Тень')) };
  });
  console.log('G4 BLOOD TIDE W6:', JSON.stringify(g4), '(ожидание: 3 врага, утопленник hp 16/ac 12/[2,6], скелет-рыцарь hp 25/ac 15/[2,8], тинт 0x8a2a2a)');
  if (g4.wave !== 6 || g4.n !== 3 || g4.anyChamp || g4.anyShadow) fail('G4 wave6 composition wrong');
  if (g4.drowned.length !== 2 || g4.skk.length !== 1) fail('G4 wave6 roster wrong');
  if (g4.drowned.some(d => d.hp !== 16 || d.ac !== 12 || d.dice[0] !== 2 || d.dice[1] !== 6 || d.tint !== 0x8a2a2a || !d.name.startsWith('Глубинный'))) fail('G4 drowned blood tide wrong');
  if (g4.skk.some(d => d.hp !== 25 || d.ac !== 15 || d.dice[0] !== 2 || d.dice[1] !== 8 || d.tint !== 0x8a2a2a)) fail('G4 skk blood tide wrong');
  await shot(page, 'v24_season_blood_w6.jpg');

  /* G5: сезон 1 «Костяная стужа» (волна 7, k=2): КД +2, hp ×1.24, тинт 0x7a9ac0 */
  await page.evaluate(() => window.__bg3.forceSeason(1));
  await page.evaluate(() => window.__bg3.arenaWipe());
  await waitCalm(page);
  await page.waitForTimeout(2300);/* таймер волны (1700мс) спавнит волну 7 под новым сезоном */
  await waitCombat(page);
  const g5 = await page.evaluate(() => {
    const b = window.__bg3;
    const es = b.S.combatGroup.filter(e => e.alive);
    const tint = (u) => { const bd = u.rig && u.rig.children[0]; return bd && bd.material && bd.material.color ? bd.material.color.getHex() : -1; };
    const pick = (cn) => es.filter(e => e.clsName === cn).map(e => ({ hp: e.maxhp, ac: e.ac, dice: [...e.weapon.dice], tint: tint(e) }));
    return { wave: b.arenaState().wave, n: es.length, deep: pick('Культист Глубин'), ac: pick('Ученик некроманта'), dr: pick('Утопленник') };
  });
  console.log('G5 BONE CHILL W7:', JSON.stringify(g5), '(ожидание: 4 врага, культист hp 12/ac 14/[1,7], ученик hp 17/ac 15/[1,9], утопленник hp 17/ac 14/[1,7], тинт 0x7a9ac0)');
  if (g5.wave !== 7 || g5.n !== 4 || g5.deep.length !== 2 || g5.ac.length !== 1 || g5.dr.length !== 1) fail('G5 wave7 composition wrong');
  if (g5.deep.some(d => d.hp !== 12 || d.ac !== 14 || d.dice[1] !== 7 || d.tint !== 0x7a9ac0)) fail('G5 deep bone chill wrong');
  if (g5.ac.some(d => d.hp !== 17 || d.ac !== 15 || d.dice[1] !== 9 || d.tint !== 0x7a9ac0)) fail('G5 acolyte bone chill wrong');
  if (g5.dr.some(d => d.hp !== 17 || d.ac !== 14 || d.dice[1] !== 7 || d.tint !== 0x7a9ac0)) fail('G5 drowned bone chill wrong');

  /* G6: сезон 3 «Ярость толпы» (волна 8, k=3): рецепт 3 врага +1 лишний = 4, тинт 0x9a5a30 */
  await page.evaluate(() => window.__bg3.forceSeason(3));
  await page.evaluate(() => window.__bg3.arenaWipe());
  await waitCalm(page);
  await page.waitForTimeout(2300);
  await waitCombat(page);
  const g6 = await page.evaluate(() => {
    const b = window.__bg3;
    const es = b.S.combatGroup.filter(e => e.alive);
    const tint = (u) => { const bd = u.rig && u.rig.children[0]; return bd && bd.material && bd.material.color ? bd.material.color.getHex() : -1; };
    return { wave: b.arenaState().wave, n: es.length, knights: es.filter(e => e.short.startsWith('Рыцарь')).length,
      allTint: es.every(e => tint(e) === 0x9a5a30), pref: es.every(e => e.name.startsWith('Глубинный')) };
  });
  console.log('G6 RAGE W8:', JSON.stringify(g6), '(ожидание: волна 8, 4 врага, 2 рыцаря, тинт 0x9a5a30)');
  if (g6.wave !== 8 || g6.n !== 4 || g6.knights !== 2 || !g6.allTint || !g6.pref) fail('G6 rage of the crowd wrong');

  /* G7: сезон 4 «Дань глубин» (волна 9, k=4): награда round(215×1.5)=323 (+лут), тинт 0xb09040 */
  const spy = await page.evaluate(() => {
    const S = window.__bg3.S;
    window.__goldOps = [];
    let v = S.gold;
    Object.defineProperty(S, 'gold', { get() { return v; }, set(x) { window.__goldOps.push({ from: v, to: x, d: x - v }); v = x; }, configurable: true });
    return v;
  });
  await page.evaluate(() => window.__bg3.forceSeason(4));
  await page.evaluate(() => window.__bg3.arenaWipe());
  await waitCalm(page);
  const goldA = await page.evaluate(() => window.__bg3.S.gold);
  await page.waitForTimeout(2300);
  await waitCombat(page);
  const g7a = await page.evaluate(() => {
    const b = window.__bg3;
    const es = b.S.combatGroup.filter(e => e.alive);
    const tint = (u) => { const bd = u.rig && u.rig.children[0]; return bd && bd.material && bd.material.color ? bd.material.color.getHex() : -1; };
    return { wave: b.arenaState().wave, n: es.length, allTint: es.every(e => tint(e) === 0xb09040) };
  });
  await page.evaluate(() => window.__bg3.arenaWipe());
  await waitCalm(page);
  await page.evaluate(() => window.__bg3.arenaSetWave(0));/* цепочка волн погашена: таймер волны 10 умрёт молча — G8–G10 без боя (урок v23: вайп волны N arm-ит таймер N+1) */
  const g7 = await page.evaluate((goldA) => {
    const ops = window.__goldOps;
    return { gold: window.__bg3.S.gold, best: window.__bg3.arenaState().best, delta: window.__bg3.S.gold - goldA,
      /* награды «Дань глубин» ×1.5: w8=round(190×1.5)=285, w9=round(215×1.5)=323 —
         по одному разу (остальные опы — лут и конверсия XP v2.2, они недетерминированы) */
      r285: ops.filter(o => o.d === 285).length, r323: ops.filter(o => o.d === 323).length, opsTail: ops.slice(-6) };
  }, goldA);
  console.log('G7 TRIBUTE W9:', JSON.stringify({ wave: g7a.wave, n: g7a.n, allTint: g7a.allTint, gold: g7.gold, best: g7.best, r285: g7.r285, r323: g7.r323 }), '\nG7 OPS TAIL:', JSON.stringify(g7.opsTail), '(ожидание: волна 9, 3 врага, тинт 0xb09040, награды 285 и 323 по одному разу, best 9)');
  if (g7a.wave !== 9 || g7a.n !== 3 || !g7a.allTint) fail('G7 wave9 tribute composition wrong');
  if (g7.r285 !== 1 || g7.r323 !== 1 || g7.best !== 9) fail('G7 tribute reward wrong: 285×' + g7.r285 + ' 323×' + g7.r323);

  /* G8: HUD-панель «Летопись Глубин» — клик по 🏆: сезон 4, рекорд 9, серверный топ */
  await page.evaluate(() => document.getElementById('recBtn').click());
  await page.waitForTimeout(900);/* async-чтение /api/scores */
  const g8 = await page.evaluate((hero0) => {
    const rec = window.__bg3.records();
    const el = document.getElementById('records');
    const L = ((el || {}).innerText || '').toLowerCase();/* innerText отдаёт h3 ВЕРХНИМ регистром (CSS text-transform) */
    return { open: rec.open, season: rec.data && rec.data.season ? rec.data.season.name : null, best: rec.data && rec.data.best,
      server: rec.data && rec.data.server, dom: L.includes('летопись глубин') && L.includes('дань глубин') && L.includes('волна 9'),
      topRow: rec.data && rec.data.server ? rec.data.server.some(r => r.n === hero0 && r.best === 9) : false,
      btnVisible: !!document.getElementById('recBtn'), elFound: !!el, tSample: L.slice(0, 120) };
  }, g3.hero0);
  console.log('G8 RECORDS PANEL:', JSON.stringify(g8), '(ожидание: открыта, сезон «Дань глубин», best 9, сервер содержит {hero0,9})');
  if (!g8.open || g8.season !== 'Дань глубин' || g8.best !== 9 || !g8.server || !g8.dom || !g8.topRow) fail('G8 records panel wrong: elFound=' + g8.elFound + ' t=' + JSON.stringify(g8.tSample));
  await page.screenshot({ path: 'upload/e2e/v24_records_panel.jpg', quality: 82, type: 'jpeg' });
  await page.evaluate(() => { const b = document.querySelectorAll('#records button'); b[b.length - 1].click(); });/* Закрыть (T) */
  await page.waitForTimeout(300);
  const g8b = await page.evaluate(() => window.__bg3.records().open);
  if (g8b) fail('G8 panel close wrong');

  /* G9: стела — сезон + лучший заход + серверная летопись в логе */
  await page.evaluate(() => window.__bg3.callInter('Стела рекордов (арена)'));
  await page.waitForTimeout(900);
  const g9 = await page.evaluate(() => {
    const t = (document.getElementById('logbody') || {}).innerText || '';
    return { best: t.includes('Лучший заход: волна 9'), season: t.includes('Сезон глубины: «Дань глубин»'), server: t.includes('Летопись Глубин (сервер)') };
  });
  console.log('G9 STELA:', JSON.stringify(g9));
  if (!g9.best || !g9.season || !g9.server) fail('G9 stela wrong');

  /* G10: сейв слот 3 → reload → doLoad 1:1 (сезон не в сейве — детерминирован неделей) */
  await page.evaluate(() => window.__bg3.doSave(3));
  await page.waitForTimeout(800);
  const snap = await page.evaluate(() => ({ gold: window.__bg3.S.gold, best: window.__bg3.arenaState().best }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => window.__bg3.doLoad(3));
  await page.waitForTimeout(3500);
  const g10 = await page.evaluate((snap) => {
    const b = window.__bg3;
    const wantIdx = Math.floor(Date.now() / 604800000) % 5;
    document.getElementById('recBtn').click();
    return new Promise((res) => setTimeout(() => {
      const rec = b.records();
      res({ gold: b.S.gold, best: b.arenaState().best, panelOpen: rec.open, seasonIdx: rec.data && rec.data.season ? rec.data.season.idx : -9,
        wantIdx, stela: b.inters().includes('Стела рекордов (арена)'), endlessLabel: b.inters().includes('Бесконечное испытание (арена)'),
        paladin: !!b.units.find(u => u.cls === 'paladin') });
    }, 900));
  }, snap);
  console.log('G10 SAVE/LOAD:', JSON.stringify(g10), '(ожидание: gold/best 1:1, панель открыта, сезон = реальная неделя после reload)');
  if (g10.gold !== snap.gold || g10.best !== snap.best || !g10.panelOpen || g10.seasonIdx !== g10.wantIdx || !g10.stela || !g10.endlessLabel || !g10.paladin) fail('G10 save/load wrong');

  /* G11: чистый reload — 1 canvas, ошибок нет (кроме штатного 404-фолбэка) */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  const g11 = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, mapId: window.__bg3.turn().mapId }));
  const noise404 = bad404.filter(u => !u.includes('/models/rig/soldier.glb'));
  const hardErrors = errors.filter(e => !e.includes('status of 404') && !e.includes('soldier.glb'));
  console.log('G11 CLEAN RELOAD:', JSON.stringify(g11), 'hardErrors=' + hardErrors.length, 'noise404=' + noise404.length);
  if (g11.canvases !== 1 || hardErrors.length || noise404.length) fail('G11 clean reload wrong: ' + JSON.stringify(hardErrors.concat(noise404).slice(0, 4)));

  console.log('ALL V24 GATES GREEN');
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
