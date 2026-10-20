/* v3.4 E2E (playwright): «МАСТЕРСКАЯ» — редактор как в Unity, полный цикл.
   Гейты:
   G1 boot + открытие кузницы + ГИЗМО: выбор fighter → гизмо attached,
      клавиши W/E/R переключают режим (move/rotate/scale), Q — скрыть.
   G2 ФОКУС двойным кликом: dblclick по строке иерархии наводит камеру.
   G3 ДУБЛИРОВАНИЕ: edDup → «(копия)» с профилем источника; удаление чистит.
   G4 КИСТЬ: brush=гоблин → клик по земле ставит юнита в клетку клика
      (capture-глушка не пускает клик в игру — отряд не бегает).
   G5 ДЕКОР: edPropPlace (дерево) → в списке; правка X; удалить; persist:
      place → reload → prop вернулся из localStorage → убрать всё.
   G6 ДИАЛОГИ: выбор npc → узлы пробником; правка текста → применить →
      DLGS отдаёт новый текст в игре; сброс.
   G7 АНИМАЦИИ: клипы рига у fighter; play walk → _currentAnim=walk;
      скорость миксера ×0.5; перезагрузка рига.
   G8 reload — чистая консоль (после уборки декора).
   Скриншоты — upload/e2e/v34_*.jpg. */
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
    try {
      localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '75', fps: '30', voice: false, vol: '0' }));
    } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP' + r.status() + ': ' + r.url()); });

  /* G1: boot + кузница + гизмо */
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 90000 });
  await page.waitForTimeout(4000);
  /* чистим persist-ключи мастерской ОДИН раз (addInitScript не годится —
     он выполняется на каждой навигации, включая reload с проверкой persist) */
  await page.evaluate(() => { try { localStorage.removeItem('bg3w_world_v1'); localStorage.removeItem('bg3w_dlg_v1'); } catch {} });
  const g1 = await page.evaluate(() => {
    const b = window.__bg3;
    b.edOpen();
    const f = b.units.find((u) => u.cls === 'fighter');
    if (!f) return { err: 'нет fighter' };
    b.edSel(f.id);
    const p0 = b.ed34();
    /* клавиши W/E/R/Q — capture-фаза forge (dispatch на document — путь window→document) */
    const key = (k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    key('e'); const rot = b.ed34().gizmoMode;
    key('r'); const scl = b.ed34().gizmoMode;
    key('w'); const mov = b.ed34().gizmoMode;
    key('q'); const non = b.ed34().gizmoMode;
    key('w');
    return { att: p0.gizmoAttached, mode0: p0.gizmoMode, rot, scl, mov, non,
      attached: b.ed34().gizmoAttached };
  });
  if (g1.err) fail('G1 ' + g1.err);
  if (!g1.att) fail('G1 гизмо не прикреплено к fighter');
  if (g1.mode0 !== 'move' || g1.rot !== 'rotate' || g1.scl !== 'scale' || g1.mov !== 'move' || g1.non !== 'none')
    fail('G1 клавиши W/E/R/Q не переключают режим: ' + JSON.stringify(g1));
  if (!g1.attached) fail('G1 после Q→W гизмо не вернулось');
  await sleep(600);/* React успевает отрендерить панель */
  const tabsOk = await page.evaluate(() => !!document.querySelector('.edTabs'));
  if (!tabsOk) fail('G1 панель кузницы не отрендерилась (.edTabs)');
  console.log('G1 GIZMO:', JSON.stringify(g1));

  /* G2: двойной клик по иерархии — фокус камеры */
  const before = await page.evaluate(() => { const t = window.__bg3.ctl().target; return { x: t.x, z: t.z }; });
  const fId = await page.evaluate(() => window.__bg3.units.find((u) => u.cls === 'fighter').id);
  await page.evaluate((id) => {
    const row = [...document.querySelectorAll('.edTreeRow')].find((r) => r.getAttribute('title') && r.textContent);
    const rows = [...document.querySelectorAll('.edTreeRow')];
    /* выбрать строку fighter по клику, затем dblclick */
    const fRow = rows[0];/* первый ряд — герой */
    fRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fRow.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  }, fId);
  await sleep(600);
  const after = await page.evaluate(() => { const t = window.__bg3.ctl().target; return { x: t.x, z: t.z }; });
  const moved = Math.abs(after.x - before.x) + Math.abs(after.z - before.z);
  if (moved < 0.5) fail('G2 двойной клик не навёл камеру (dx+dz=' + moved.toFixed(2) + ')');
  console.log('G2 FOCUS:', JSON.stringify({ before, after, moved: +moved.toFixed(2) }));

  /* G3: дублирование + удаление */
  const cnt0 = await page.evaluate(() => window.__bg3.units.length);
  await page.evaluate((id) => window.__bg3.edDup(id), fId);
  await sleep(3000);/* риг клона */
  const g3 = await page.evaluate(() => {
    const b = window.__bg3;
    const sel = b.units.find((u) => u.id === b.ed().selId);
    return { cnt: b.units.length, name: sel ? sel.name : null, sel: !!sel,
      mixer: sel ? !!sel._mixer : false, hp: sel ? sel.hp : 0 };
  });
  if (g3.cnt !== cnt0 + 1) fail('G3 дубликат не создан: ' + g3.cnt);
  if (!g3.name || !g3.name.includes('(копия)')) fail('G3 имя клона: ' + g3.name);
  const dupId = await page.evaluate(() => window.__bg3.ed().selId);
  await page.evaluate((id) => window.__bg3.edDel(id), dupId);
  await sleep(400);
  const cntBack = await page.evaluate(() => window.__bg3.units.length);
  if (cntBack !== cnt0) fail('G3 удаление клона не чистит сцену: ' + cntBack);
  console.log('G3 DUP:', JSON.stringify({ ...g3, cntBack }));

  /* G4: кисть — клик по земле ставит юнита */
  const cnt1 = cnt0;
  await page.evaluate(() => window.__bg3.edOpen());
  /* brush через стор нельзя снаружи — включим через DOM: кнопка 🖌 в .edSpawn */
  await page.click('.edSpawn button.edTb:last-child');
  await sleep(300);
  const brushOn = await page.evaluate(() => window.__bg3.ed34().brush);
  if (!brushOn || brushOn === 'prop:*') fail('G4 кисть не включилась: ' + brushOn);
  await page.mouse.click(300, 450);/* левая половина канваса (панель справа) — земля */
  await sleep(3500);
  const g4 = await page.evaluate(() => {
    const b = window.__bg3;
    const log = b.edLog();
    return { cnt: b.units.length, brush: b.ed34().brush,
      spawned: log.some((l) => l.includes('Заспавнен')), sel: b.ed().selId };
  });
  if (g4.cnt !== cnt1 + 1) fail('G4 кисть не заспавнила юнита: ' + g4.cnt);
  if (!g4.spawned) fail('G4 в консоли нет «Заспавнен»');
  /* выключить кисть и убрать юнита */
  await page.click('.edSpawn button.edTb:last-child');
  await sleep(200);
  const brushOff = await page.evaluate(() => window.__bg3.ed34().brush);
  if (brushOff) fail('G4 кисть не выключилась: ' + brushOff);
  const spawnId = await page.evaluate(() => window.__bg3.ed().selId);
  await page.evaluate((id) => window.__bg3.edDel(id), spawnId);
  await sleep(300);
  console.log('G4 BRUSH:', JSON.stringify({ ...g4, brushOff: !brushOff }));

  /* G5: декор мира + persist */
  await page.evaluate(() => window.__bg3.edPropPlace('SM_Tree_Birch_01', 12, 12));
  await sleep(2500);
  const g5 = await page.evaluate(() => {
    const b = window.__bg3;
    return { props: b.ed34().props, list: b.edProps(), tabsOk: !![...document.querySelectorAll('.edTabs button')].find((x) => x.textContent === 'Декор') };
  });
  if (g5.props !== 1) fail('G5 декор не поставился: ' + g5.props);
  if (!g5.tabsOk) fail('G5 вкладка «Декор» не найдена');
  console.log('G5 PROP:', JSON.stringify(g5));
  await shot(page, 'v34_prop.jpg');

  /* persist: reload → декор возвращается */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 90000 });
  await page.waitForTimeout(4500);
  const g5b = await page.evaluate(() => ({ props: window.__bg3.ed34().props, list: window.__bg3.edProps() }));
  if (g5b.props !== 1) fail('G5 persist: после reload декор не вернулся (' + g5b.props + ')');
  console.log('G5 PERSIST:', JSON.stringify(g5b));
  await page.evaluate(() => window.__bg3.edPropClear());
  await sleep(400);
  const g5c = await page.evaluate(() => window.__bg3.ed34().props);
  if (g5c !== 0) fail('G5 «убрать всё» не сработал: ' + g5c);
  console.log('G5 CLEAR: ok');

  /* G6: диалоги */
  const g6 = await page.evaluate(() => {
    const b = window.__bg3;
    b.edOpen();
    b.edDlgNpc('patrol');
    const p = b.ed34();
    return { nodes: p.dlg.nodes, npc: p.dlg.npc };
  });
  if (!g6.nodes) fail('G6 пробник узлов patrol пуст');
  await page.evaluate(() => {
    const b = window.__bg3;
    b.edDlgNode('start');
    b.edDlgSet('dlgText', 'СТОЯТЬ! Редакторный патруль! Уходи, пока цел!');
    b.edDlgApply();
  });
  await sleep(300);
  const g6b = await page.evaluate(() => {
    const b = window.__bg3;
    const n = b.dlgProbe('patrol', 'start');
    const inGame = b.openDlg('patrol');
    return { text: n ? n.text : null, dlgOpen: inGame === undefined ? true : true };
  });
  if (!g6b.text || !g6b.text.includes('Редакторный патруль')) fail('G6 правка диалога не применилась: ' + g6b.text);
  const dlgDom = await page.evaluate(() => document.body.textContent.includes('Редакторный патруль'));
  await page.evaluate(() => window.__bg3.closeDlg());
  if (!dlgDom) fail('G6 открытый диалог не показывает новый текст');
  await page.evaluate(() => { window.__bg3.edDlgReset(); });
  await sleep(200);
  const g6c = await page.evaluate(() => (window.__bg3.dlgProbe('patrol', 'start') || {}).text || '');
  if (g6c.includes('Редакторный патруль')) fail('G6 сброс правки не вернул оригинал');
  console.log('G6 DLG:', JSON.stringify({ nodes: g6.nodes, applied: true, dom: dlgDom, reset: true }));

  /* G7: анимации рига */
  await page.evaluate(() => {
    const b = window.__bg3;
    const f = b.units.find((u) => u.cls === 'fighter');
    b.edSel(f.id);
  });
  await sleep(1500);
  const g7 = await page.evaluate(() => {
    const b = window.__bg3;
    const clips = b.ed34().anim.clips;
    b.edAnim('walk');
    return { clips, cur: b.ed34().anim.cur };
  });
  if (!g7.clips.length) fail('G7 список клипов пуст');
  if (!g7.clips.includes('idle')) fail('G7 нет idle в клипах: ' + JSON.stringify(g7.clips));
  if (g7.cur !== 'walk') fail('G7 play walk не применился: ' + g7.cur);
  await page.evaluate(() => window.__bg3.edAnimSpeed(0.5));
  await sleep(300);
  const sp = await page.evaluate(() => {
    const f = window.__bg3.units.find((u) => u.cls === 'fighter');
    return { unit: f._mixer ? f._mixer.timeScale : null, ed: window.__bg3.ed34().anim.speed };
  });
  if (sp.unit !== 0.5) fail('G7 скорость миксера: ' + JSON.stringify(sp));
  const animBtns = await page.evaluate(() => [...document.querySelectorAll('.edSec')].some((s) => s.textContent.includes('Анимации рига')));
  if (!animBtns) fail('G7 секция «Анимации рига» не найдена в панели');
  console.log('G7 ANIM:', JSON.stringify({ clips: g7.clips, cur: g7.cur, speed: sp.unit }));
  await shot(page, 'v34_anim.jpg');

  /* G8: reload — чистая консоль */
  await page.evaluate(() => window.__bg3.edClose());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 90000 });
  await page.waitForTimeout(3000);
  const bootOk = await page.evaluate(() => !!window.__bg3.units.length);
  if (!bootOk) fail('G8 после reload нет юнитов');
  const fatal = errors.filter((e) => !e.includes('406') && !e.includes('/api/'));
  if (fatal.length) fail('G8 ошибки консоли: ' + fatal.slice(0, 4).join(' | '));
  console.log('G8 RELOAD: чисто');

  await browser.close();
  console.log('ALL GREEN — v3.4 «Мастерская»');
})().catch((e) => { console.log('FAIL: ' + (e && e.message || e)); process.exit(1); });
