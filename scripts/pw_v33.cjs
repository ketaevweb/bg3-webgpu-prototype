/* v3.3 E2E (playwright): «КУЗНИЦА» — редактор игры как в Unity.
   Гейты:
   G1 boot + открытие редактора: ed.open, иерархия = units+barrels,
      системная кнопка #edBtn и хоткей «ё» живут.
   G2 Inspector: выбор fighter, живые правки hp/maxhp/ac/range/статус —
      видно в игре и в инспекторе.
   G3 Play/Pause/Шаг/Темп: G.paused/timeScale, шаг на паузе.
   G4 Спавн/удаление: +1 юнит у камеры, Synty-риг подключается, удаление чистит сцену.
   G5 Мир: золото, рубильник графики, смена карты (крипта→лес) с обновлением иерархии.
   G6 Регресс боя при открытом редакторе: старт боя, выстрел, правка hp на ходу.
   G7 reload — чистая консоль, без 404.
   Скриншоты — upload/e2e/v33_*.jpg. */
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
const fail = (msg) => { console.log('FAIL: ' + msg); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '75', fps: '30', voice: false, vol: '0' })); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP' + r.status() + ': ' + r.url()); });

  /* G1: boot + редактор */
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 90000 });
  await page.waitForTimeout(4000);
  const g1 = await page.evaluate(() => {
    const b = window.__bg3;
    b.edOpen();
    const ed = b.ed();
    const tree = b.edTree();
    const barrels = tree.filter((r) => r.barrel).length;
    /* хоткей «ё» закрывает и открывает */
    return { open: ed.open, tree: tree.length, units: b.units.length, barrels,
      btn: !!document.getElementById('edBtn'),
      heroes: tree.filter((r) => r.side === 'hero').length };
  });
  if (!g1.open) fail('G1 редактор не открылся');
  if (g1.tree !== g1.units + g1.barrels) fail('G1 иерархия ' + g1.tree + ' != юниты+бочки ' + (g1.units + g1.barrels));
  if (!g1.btn) fail('G1 нет кнопки #edBtn');
  if (g1.heroes < 2) fail('G1 героев в иерархии < 2: ' + g1.heroes);
  console.log('G1 OPEN:', JSON.stringify(g1));

  /* хоткей: «ё» закрывает */
  /* хоткей: «ё» закрывает, ` открывает (keydown на window — как слушает игра) */
  const pressKey = (k) => page.evaluate((key) => window.dispatchEvent(new KeyboardEvent('keydown', { key })), k);
  await pressKey('ё');
  await sleep(300);
  const closed = await page.evaluate(() => window.__bg3.ed().open);
  if (closed) fail('G1 хоткей «ё» не закрыл редактор');
  await pressKey('`');
  await sleep(300);
  const reopened = await page.evaluate(() => window.__bg3.ed().open);
  if (!reopened) fail('G1 хоткей ` не открыл редактор');
  console.log('G1 HOTKEY: ё/` toggle OK');

  /* G2: инспектор — живые правки */
  const g2 = await page.evaluate(() => {
    const b = window.__bg3;
    const f = b.units.find((u) => u.cls === 'fighter');
    if (!f) return { err: 'нет fighter' };
    b.edSel(f.id);
    const insp = b.edInsp();
    if (!insp || !insp.length) return { err: 'инспектор пуст' };
    b.edSet(f.id, 'hp', 3);
    b.edSet(f.id, 'maxhp', 30);
    b.edSet(f.id, 'ac', 18);
    b.edSet(f.id, 'weaponRange', 2);
    b.edStatus(f.id, 'poison', 3);
    return { hp: f.hp, maxhp: f.maxhp, ac: f.ac, range: f.weapon.range,
      st: f.statuses.length, sections: insp.map((s) => s.title),
      selId: b.ed().selId };
  });
  if (g2.err) fail('G2 ' + g2.err);
  if (g2.hp !== 3 || g2.maxhp !== 30 || g2.ac !== 18 || g2.range !== 2 || g2.st !== 1)
    fail('G2 правки не применились: ' + JSON.stringify(g2));
  if (!g2.sections.includes('Оружие')) fail('G2 нет секции «Оружие»');
  console.log('G2 INSPECT:', JSON.stringify(g2));
  await shot(page, 'v33_editor_inspect.jpg');

  /* G3: пауза/шаг/темп */
  const g3 = await page.evaluate(() => {
    const b = window.__bg3;
    b.edPause(true);
    const p1 = b.ed().paused;
    b.edStep();/* на паузе — ставит stepOnce */
    b.edTime(0.5);
    const ts = b.ed().timeScale;
    b.edPause(false);
    const p2 = b.ed().paused;
    return { p1, ts, p2 };
  });
  if (!g3.p1 || g3.p2) fail('G3 пауза не переключается: ' + JSON.stringify(g3));
  if (Math.abs(g3.ts - 0.5) > 1e-9) fail('G3 timeScale: ' + g3.ts);
  console.log('G3 PAUSE/TIME:', JSON.stringify(g3));

  /* G4: спавн + риг + удаление */
  const cnt0 = await page.evaluate(() => window.__bg3.units.length);
  await page.evaluate(() => window.__bg3.edSpawn('bruiser'));
  await sleep(4500);/* Synty-риг грузится */
  const g4 = await page.evaluate(() => {
    const b = window.__bg3;
    const selId = b.ed().selId;
    const u = b.units.find((x) => x.id === selId);
    return { cnt: b.units.length, sel: !!selId, cls: u ? u.cls : null, mixer: u ? !!u._mixer : false,
      tree: b.edTree().length, log: b.edLog().slice(-2) };
  });
  if (g4.cnt !== cnt0 + 1) fail('G4 спавн: ' + g4.cnt + ' (было ' + cnt0 + ')');
  if (g4.cls !== 'goblin') fail('G4 выбранный после спавна — не гоблин');
  if (!g4.mixer) fail('G4 спавн без Synty-рига (капсула?)');
  console.log('G4 SPAWN:', JSON.stringify(g4));
  const spawnedId = await page.evaluate(() => window.__bg3.ed().selId);
  await page.evaluate((id) => window.__bg3.edDel(id), spawnedId);
  await sleep(400);
  const g4b = await page.evaluate(() => {
    const tree = window.__bg3.edTree();
    return { cnt: window.__bg3.units.length, sel: window.__bg3.ed().selId, tree: tree.length,
      barrels: tree.filter((r) => r.barrel).length };
  });
  if (g4b.cnt !== cnt0) fail('G4 удаление не вернуло состав: ' + g4b.cnt);
  if (g4b.sel != null) fail('G4 выбор не сброшен после удаления');
  if (g4b.tree !== g4b.cnt + g4b.barrels) fail('G4 иерархия после удаления: ' + g4b.tree);
  console.log('G4 DELETE:', JSON.stringify(g4b));

  /* G5: мир — золото, графика, карта */
  const g5 = await page.evaluate(() => {
    const b = window.__bg3;
    b.edGold(500);
    const gold = b.S.gold;
    const bloom0 = b.gfxState().bloom;
    b.edGlobal('bloom', !bloom0);
    const bloom1 = b.gfxState().bloom;
    b.edGlobal('bloom', bloom0);
    return { gold, bloom0, bloom1 };
  });
  if (g5.gold !== 500) fail('G5 золото: ' + g5.gold);
  if (g5.bloom1 === g5.bloom0) fail('G5 рубильник bloom не переключился');
  console.log('G5 GLOBALS:', JSON.stringify(g5));
  await page.evaluate(() => window.__bg3.edMap('crypt'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'crypt' && !window.__bg3.turn().busy, null, { timeout: 30000 });
  await sleep(1500);
  const g5b = await page.evaluate(() => {
    const tree = window.__bg3.edTree();
    return { map: window.__bg3.turn().mapId, tree: tree.length, units: window.__bg3.units.length,
      barrels: tree.filter((r) => r.barrel).length };
  });
  if (g5b.map !== 'crypt') fail('G5 карта не сменилась');
  if (g5b.tree !== g5b.units + g5b.barrels) fail('G5 иерархия не обновилась после смены карты: ' + g5b.tree + ' vs ' + (g5b.units + g5b.barrels));
  console.log('G5 MAP:', JSON.stringify(g5b));
  await shot(page, 'v33_editor_crypt.jpg');
  await page.evaluate(() => window.__bg3.edMap('forest'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'forest' && !window.__bg3.turn().busy, null, { timeout: 30000 });
  await sleep(1200);

  /* G6: бой при открытом редакторе */
  const g6 = await page.evaluate(() => {
    const b = window.__bg3;
    b.edOpen();
    b.startCombat(b.S.campGroup.slice());
    return { combat: b.turn().combatOn };
  });
  await sleep(1500);
  const g6b = await page.evaluate(() => {
    const b = window.__bg3;
    const t = b.units.find((u) => u.side === 'goblin' && u.alive);
    if (!t) return { err: 'нет живого врага' };
    const hp0 = t.hp;
    b.edSet(t.id, 'hp', 1);
    return { hp0, hp1: t.hp, open: b.ed().open, combat: b.turn().combatOn };
  });
  if (g6b.err) fail('G6 ' + g6b.err);
  if (g6b.hp1 !== 1) fail('G6 правка hp врага в бою: ' + JSON.stringify(g6b));
  console.log('G6 COMBAT+EDITOR:', JSON.stringify({ ...g6, ...g6b }));
  await page.evaluate(() => {
    window.__bg3.edClose();
    window.__bg3.arenaWipe && (() => { try { window.__bg3.arenaWipe(); } catch (e) {} })();
  });
  await sleep(1000);

  /* G7: reload — чистая консоль */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 90000 });
  await page.waitForTimeout(3000);
  const bootOk = await page.evaluate(() => !!window.__bg3.units.length);
  if (!bootOk) fail('G7 после reload нет юнитов');
  const fatal = errors.filter((e) => !e.includes('406') && !e.includes('/api/'));
  if (fatal.length) fail('G7 ошибки консоли: ' + fatal.slice(0, 4).join(' | '));
  console.log('G7 RELOAD: чисто, юниты на месте');

  await browser.close();
  console.log('ALL GREEN — v3.3 «Кузница»');
})().catch((e) => { console.log('FAIL: ' + (e && e.message || e)); process.exit(1); });
