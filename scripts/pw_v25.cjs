/* v2.5 E2E (playwright): ГОЛОСА ГЛУБИН — озвучка реплик и баннеров.
   Гейты: манифест+файлы, диалоговые голоса НПС/опций (RAW-индексы),
   динамика /api/tts (казна призрака, номера бесконечных волн),
   рассказчик заданий/сезонов/наставника, выключатель голосов (G),
   сейв/лоад, чистый reload. Харнес — по урокам v1.7–v2.4. */
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
/* аргументы waitForFunction — только сериализуемые значения (строки/числа) */
const waitLast = (page, id, timeout = 30000) => page.waitForFunction(
  (x) => window.__bg3.voice().last === x, id, { timeout });
const waitHist = (page, id, timeout = 40000) => page.waitForFunction(
  (x) => window.__bg3.voice().hist.includes(x), id, { timeout });
const waitDyn = (page, n, timeout = 40000) => page.waitForFunction(
  (x) => window.__bg3.voice().dyn >= x, n, { timeout });
const fail = (msg) => { console.log('FAIL: ' + msg); process.exit(1); };
const clickOpt = (page, needle) => page.evaluate((n) => {
  const btns = [...document.querySelectorAll('#dlgBox button')];
  const b = btns.find((x) => x.textContent && x.textContent.includes(n));
  if (b) { b.click(); return true; }
  return false;
}, needle);

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30', voice: true })); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  const bad404 = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !bad404.includes(r.url())) bad404.push(r.status() + ' ' + r.url().replace('http://localhost:3000', '')); });

  /* G1: boot + манифест озвучки + целостность файлов + голос наставника */
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__bg3.voice().ready, null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const g1 = await page.evaluate(async () => {
    const v = window.__bg3.voice();
    const man = await (await fetch('/voices/manifest.json')).json();
    const miss = [];
    for (const id of Object.keys(man.lines)) {
      const r = await fetch('/voices/' + id + '.mp3');
      if (!r.ok) miss.push(id);
    }
    return { heroes: window.__bg3.units.filter((u) => u.side === 'hero').length,
      mapId: window.__bg3.turn().mapId, lines: v.lines, miss, hist: v.hist };
  });
  console.log('G1 BOOT+VOICES:', JSON.stringify({ heroes: g1.heroes, mapId: g1.mapId, lines: g1.lines, miss: g1.miss.length, hist: g1.hist }));
  if (g1.heroes !== 2 || g1.mapId !== 'forest') fail('G1 boot wrong');
  if (g1.lines < 150 || g1.miss.length) fail('G1 manifest/files broken: ' + g1.miss.join(','));
  if (!g1.hist.includes('tut.move')) fail('G1 narrator tutorial voice not fired');

  /* G2: голос НПС — Дамрок (denis), реплика узла из манифеста */
  await page.evaluate(() => window.__bg3.openDlg('damrock'));
  await waitLast(page, 'dlg.damrock.start');
  await page.waitForTimeout(700);
  const g2 = await page.evaluate(() => ({
    text: document.querySelector('#dlgText') && document.querySelector('#dlgText').textContent,
    npc: window.__bg3.S.dlgNpc,
  }));
  console.log('G2 NPC VOICE:', JSON.stringify({ npc: g2.npc, text: (g2.text || '').slice(0, 40) }));
  if (g2.npc !== 'damrock' || !(g2.text || '').includes('Дамрок')) fail('G2 damrock dlg wrong');
  await shot(page, 'v25_dlg_damrock.jpg');
  await page.evaluate(() => window.__bg3.closeDlg());

  /* G3: голос опции (RAW-индекс) — «Покажи товар» = o0, лавка открыта */
  await page.evaluate(() => window.__bg3.openDlg('damrock'));
  await waitLast(page, 'dlg.damrock.start');
  if (!await clickOpt(page, 'Покажи товар')) fail('G3 option button not found');
  await waitLast(page, 'dlg.damrock.start.o0');
  const g3 = await page.evaluate(() => ({ shop: !!document.querySelector('#shop') }));
  console.log('G3 OPTION VOICE:', JSON.stringify(g3));
  if (!g3.shop) fail('G3 shop not opened');
  await page.keyboard.press('Escape');

  /* G4: голос опции с соцпроверкой — «скидка» = o3 (история) */
  await page.evaluate(() => window.__bg3.openDlg('damrock'));
  await waitLast(page, 'dlg.damrock.start');
  if (!await clickOpt(page, 'скидка')) fail('G4 option button not found');
  await waitHist(page, 'dlg.damrock.start.o3');
  console.log('G4 SOCIAL OPT VOICE: o3 в истории — ок');
  await page.evaluate(() => window.__bg3.closeDlg());

  /* G5: динамика /api/tts — призрак (казна в тексте), синтез на сервере */
  await page.evaluate(() => { window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true; window.__bg3.questDone('giants'); });
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__bg3.openDlg('ghost'));
  await page.waitForFunction(() => {
    const v = window.__bg3.voice();
    return v.dyn >= 1 && v.last === 'dlg.ghost.start' && v.lastDynOk;
  }, null, { timeout: 40000 });
  console.log('G5 GHOST DYNAMIC TTS: ok (казна озвучена сервером)');

  /* G6: рассказчик заданий — quest.main.done (баннер молчит) */
  await page.evaluate(() => window.__bg3.closeDlg());
  await page.evaluate(() => window.__bg3.questDone('main'));
  await waitHist(page, 'quest.main.done');
  console.log('G6 QUEST NARRATOR: quest.main.done — ок');

  /* G7: арена — сезон рассказчиком + статичный баннер + волна динамикой */
  await page.evaluate(() => window.__bg3.forceSeason(0));
  await page.evaluate(() => window.__bg3.arenaEndless());
  await waitCombat(page);
  await waitHist(page, 'season.0');
  await waitDyn(page, 2);
  await waitHist(page, 'bann.beskonechnoe-ispytanie');
  const g7 = await page.evaluate(() => window.__bg3.arenaState().wave);
  console.log('G7 ARENA VOICES:', JSON.stringify({ wave: g7, dyn: '>=2' }));
  if (g7 !== 6) fail('G7 wave 6 expected');
  await shot(page, 'v25_arena_voice.jpg');

  /* G8: вайпы волн 6→7→8 с полной синхронизацией (уроки pw_v20+таймлайн-
     проба): вайп N → arenaNext(N) (рекорд N, счётчик N+1, таймер 1.7 c)
     → спавн N+1 → вайп… Волна 8 — чемпион. Остановка: счётчик 0 при живой
     волне 8 → вайп → arenaNext(0) — no-op, цепочка мертва, best=7 */
  await page.evaluate(() => window.__bg3.arenaWipe());/* вайп 6-й */
  await waitCalm(page);
  await page.waitForFunction(() => window.__bg3.turn().combatOn, null, { timeout: 20000 });/* волна 7 */
  await page.waitForFunction(() => window.__bg3.voice().dyn >= 3, null, { timeout: 40000 });/* баннер волны 7 — динамика */
  await page.evaluate(() => window.__bg3.arenaWipe());/* вайп 7-й */
  await waitCalm(page);
  await page.waitForFunction(() => window.__bg3.arenaState().best >= 7, null, { timeout: 20000 });
  await page.waitForFunction(() => window.__bg3.turn().combatOn, null, { timeout: 20000 });/* волна 8 */
  const g8 = await page.evaluate(() => window.__bg3.arenaState().wave);
  console.log('G8 WAVE 8 DYNAMIC:', JSON.stringify({ wave: g8 }));
  if (g8 !== 8) fail('G8 wave 8 expected, got ' + g8);
  await page.evaluate(() => window.__bg3.arenaSetWave(0));/* счётчик → 0 */
  await page.evaluate(() => window.__bg3.arenaWipe());/* вайп 8-й: arenaNext(0) — цепочка мертва */
  await waitCalm(page);
  const g8b = await page.evaluate(() => ({
    wave: window.__bg3.arenaState().wave, best: window.__bg3.S.arenaBest,
    combat: window.__bg3.turn().combatOn,
  }));
  console.log('G8 CHAIN STOPPED:', JSON.stringify(g8b));
  if (g8b.best !== 7 || g8b.combat || g8b.wave !== 0) fail('G8 chain stop failed: ' + JSON.stringify(g8b));

  /* G9: выключатель голосов (gfx.voice → панель G) */
  const g9 = await page.evaluate(async () => {
    const b = window.__bg3;
    const before = { at: b.voice().lastAt, hist: b.voice().hist.length };
    b.gfx.voice = false;
    const d1 = { prop: b.gfx.voice, on: b.voice().on };
    b.applyGfx();
    const d2 = { prop: b.gfx.voice, on: b.voice().on };
    const off = !b.voice().on;/* голоса выключены = on===false */
    await new Promise((res) => setTimeout(res, 900));
    const after = { at: b.voice().lastAt, hist: b.voice().hist.length };
    b.gfx.voice = true; b.applyGfx();
    return { off, d1, d2, frozen: before.at === after.at && before.hist === after.hist, backOn: b.voice().on };
  });
  console.log('G9 VOICE TOGGLE:', JSON.stringify(g9));
  if (!g9.off || !g9.frozen || !g9.backOn) fail('G9 toggle broken: ' + JSON.stringify(g9));

  /* G10: сейв/лоад 1:1 — голоса живут, рекорд арены сохранён */
  const pre10 = await page.evaluate(() => ({
    best: window.__bg3.S.arenaBest, wave: window.__bg3.arenaState().wave,
    combat: window.__bg3.turn().combatOn, phase: window.__bg3.turn().phase,
    gold: window.__bg3.S.gold,
  }));
  console.log('G10 PRE:', JSON.stringify(pre10));
  await page.evaluate(() => window.__bg3.doSave(3));
  await page.evaluate(() => window.__bg3.doLoad(3));
  await page.waitForTimeout(2500);
  const g10 = await page.evaluate(() => ({
    heroes: window.__bg3.units.filter((u) => u.side === 'hero').length,
    best: window.__bg3.S.arenaBest,
    ready: window.__bg3.voice().ready, on: window.__bg3.voice().on,
  }));
  console.log('G10 SAVE/LOAD:', JSON.stringify(g10));
  if (g10.heroes < 2 || g10.best !== 7 || !g10.ready || !g10.on) fail('G10 save/load or voices broken');

  /* G11: чистый reload — 0 ошибок (шум soldier.glb отфильтрован) */
  const errBefore = errors.length, badBefore = bad404.length;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__bg3.voice().ready, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const g11 = await page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas').length,
    heroes: window.__bg3.units.filter((u) => u.side === 'hero').length,
  }));
  const eNew = errors.slice(errBefore).filter((e) => !e.includes('status of 404'));
  const bNew = bad404.slice(badBefore).filter((u) => !u.includes('/models/rig/soldier.glb'));
  console.log('G11 CLEAN RELOAD:', JSON.stringify(g11), 'errors:', eNew.length, 'bad404:', bNew.length);
  if (g11.canvases !== 1 || g11.heroes !== 2 || eNew.length || bNew.length) {
    fail('G11 clean reload failed: ' + eNew.concat(bNew).slice(0, 4).join(' | '));
  }

  await browser.close();
  console.log('PW_V25: ALL 11 GATES GREEN');
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
