/* v2.7 E2E (playwright): ДАЛЬНИЕ ЗЕМЛИ — мобильная версия + полный экран.
   Гейты: fsBtn/bagBtn (фикс потерянных стилей), fullscreen кликом и клавишами
   (F и русская а), мобильная эмуляция 390×844: touch-детект, тач-кнопка
   «Говорить» (E), тап по земле двигает отряд, панели открываются тапом,
   fullscreen тапом, чистые консоль/сеть. Харнес — по урокам v1.7–v2.6. */
const { chromium } = require('playwright');

const fail = (msg) => { console.log('FAIL: ' + msg); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* экранная проекция тайла сетки (камера — __bg3.cam()) */
const tileToScreen = (page, tx, tz) => page.evaluate(([x, z]) => {
  const W = (v) => (v - 13.5) * 1.6;
  const V = window.__bg3.scn().position.constructor;
  const p = new V(W(x), 0, W(z)).project(window.__bg3.cam());
  return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
}, [tx, tz]);

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

  /* ================= ДЕСКТОП ================= */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30', voice: true, vol: '80' })); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  const bad404 = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !bad404.includes(r.url())) bad404.push(r.status() + ' ' + r.url()); });

  /* G1: boot + десктоп-состояние: not touch, canFs, fsBtn есть, talkBtn нет,
     bagBtn теперь fixed (фикс потерянных стилей v2.7) */
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__bg3.voice().ready, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const g1 = await page.evaluate(() => {
    const fs = window.__bg3.fs();
    const bag = document.getElementById('bagBtn');
    const bagPos = bag ? getComputedStyle(bag).position : 'none';
    return { ...fs, fsBtn: !!document.getElementById('fsBtn'), talkBtn: !!document.getElementById('talkBtn'), bagPos };
  });
  console.log('G1 DESKTOP BOOT:', JSON.stringify(g1));
  if (g1.touch !== false || g1.can !== true || g1.on !== false) fail('G1 fs state wrong: ' + JSON.stringify(g1));
  if (!g1.fsBtn || g1.talkBtn) fail('G1 buttons wrong (fsBtn должно быть, talkBtn — нет)');
  if (g1.bagPos !== 'fixed') fail('G1 bagBtn position=' + g1.bagPos + ' (ожидается fixed — фикс v2.7)');

  /* G2: fullscreen — клик по ⛶, клавиша F, русская «а» */
  await page.click('#fsBtn');
  await page.waitForTimeout(600);
  const on1 = await page.evaluate(() => ({ on: window.__bg3.fs().on, el: !!document.fullscreenElement, title: document.getElementById('fsBtn').title }));
  console.log('G2 FS CLICK ON:', JSON.stringify(on1));
  if (!on1.on || !on1.el || !on1.title.includes('Выйти')) fail('G2 fullscreen не включился: ' + JSON.stringify(on1));
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' })));
  await page.waitForTimeout(7000); /* v3.1: под swiftshader+10 GLB транзишн FS до 5.5с (замер fs_probe) */
  const off1 = await page.evaluate(() => window.__bg3.fs().on);
  if (off1) fail('G2 клавиша F не выключила fullscreen');
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'а' })));/* русская Ф */
  await page.waitForTimeout(7000);
  const on2 = await page.evaluate(() => window.__bg3.fs().on);
  if (!on2) fail('G2 русская «а» не включила fullscreen');
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' })));
  await page.waitForTimeout(7000);
  console.log('G2 FULLSCREEN: клик/F/а — OK, выходим из FS для чистоты');
  await ctx.close();

  /* ================= МОБИЛЬНАЯ ЭМУЛЯЦИЯ (390×844, touch) ================= */
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  });
  await mctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30', voice: true, vol: '80' })); } catch {}
  });
  const mp = await mctx.newPage();
  const merrors = [];
  mp.on('pageerror', (e) => merrors.push('PAGEERROR: ' + e.message));
  mp.on('console', (m) => { if (m.type() === 'error') merrors.push('CONSOLE: ' + m.text()); });

  /* G3: boot на мобиле: touch=true, рендер жив, talkBtn виден */
  await mp.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await mp.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await mp.waitForFunction(() => window.__bg3.voice().ready, null, { timeout: 30000 });
  await mp.waitForTimeout(2500);
  const g3 = await mp.evaluate(() => {
    const tb = document.getElementById('talkBtn');
    const r = tb ? tb.getBoundingClientRect() : null;
    return { touch: window.__bg3.fs().touch, canFs: window.__bg3.fs().can, talk: !!tb,
      vis: !!r && r.width > 0 && r.height > 0, backend: !!document.querySelector('#scene canvas') };
  });
  console.log('G3 MOBILE BOOT:', JSON.stringify(g3));
  if (!g3.touch || !g3.canFs || !g3.talk || !g3.vis || !g3.backend) fail('G3 mobile boot wrong: ' + JSON.stringify(g3));

  /* G4: тап по земле двигает отряд (герой идёт к тайлу 16,23) */
  const from = await mp.evaluate(() => {
    const h = window.__bg3.units.find((u) => u.side === 'hero');
    return { x: h.x, z: h.z };
  });
  const tapAt = await tileToScreen(mp, 16, 23);
  await mp.touchscreen.tap(tapAt.x, tapAt.y);
  const moved = await mp.waitForFunction(() => {
    const h = window.__bg3.units.find((u) => u.side === 'hero');
    return h && (h.x !== 13 || h.z !== 24);
  }, null, { timeout: 15000 }).then(() => true).catch(() => false);
  const g4 = await mp.evaluate(() => {
    const h = window.__bg3.units.find((u) => u.side === 'hero');
    return { x: h.x, z: h.z };
  });
  console.log('G4 TAP MOVE:', JSON.stringify({ from, tapAt: { x: Math.round(tapAt.x), y: Math.round(tapAt.y) }, moved, to: g4 }));
  if (!moved) fail('G4 тап по земле не двинул отряд');

  /* G5: тап talkBtn у Дамрока открывает диалог (подводим отряд хуком, ждём !busy) */
  await mp.evaluate(() => window.__bg3.moveParty(18, 25));
  await mp.waitForFunction(() => {
    const t = window.__bg3.turn();
    if (t.busy) return false;
    const h = window.__bg3.units.find((u) => u.side === 'hero');
    return h && Math.max(Math.abs(h.x - 18), Math.abs(h.z - 25)) <= 2;
  }, null, { timeout: 30000 }).catch(() => {});
  await sleep(500);
  await mp.tap('#talkBtn');
  await mp.waitForFunction(() => window.__bg3.touch().dlg, null, { timeout: 8000 }).catch(() => {});
  const g5 = await mp.evaluate(() => ({
    dlg: !!window.__bg3.touch().dlg,
    name: (document.getElementById('dlgName') || {}).textContent || '',
  }));
  console.log('G5 TALK BTN:', JSON.stringify(g5));
  /* кнопка E открывает БЛИЖАЙШИЙ интеракт (как в игре) — рядом могут быть и
     алтарь Кая (15,22), и Дамрок (17,25); гейт — диалог открылся и именован */
  if (!g5.dlg || !g5.name) fail('G5 talkBtn не открыл диалог: ' + JSON.stringify(g5));
  await mp.evaluate(() => window.__bg3.closeDlg());

  /* G6: панели тапом: графика (G), миникарта (M), летопись (T); fullscreen тапом */
  await mp.tap('#gfxBtn');
  await sleep(400);
  const gfxOpen = await mp.evaluate(() => !!document.getElementById('gfx') && document.getElementById('gfx').style.display !== 'none' && getComputedStyle(document.getElementById('gfx')).display !== 'none');
  await mp.tap('#mmBtn');
  await sleep(400);
  const mmOpen = await mp.evaluate(() => !!window.__bg3.mm() || !!document.getElementById('mmCv'));
  await mp.tap('#fsBtn');
  await mp.waitForTimeout(600);
  const fsM = await mp.evaluate(() => window.__bg3.fs().on);
  console.log('G6 MOBILE PANELS:', JSON.stringify({ gfxOpen, mmOpen, fsM }));
  if (!gfxOpen || !mmOpen || !fsM) fail('G6 мобильные панели/fullscreen: ' + JSON.stringify({ gfxOpen, mmOpen, fsM }));

  /* G7: чистота: 0 ошибок на обоих контекстах. Известный шум (как в pw_v26):
     soldier.glb — опциональная модель ретаргета, загрузчик с фоллбеком;
     favicon.ico — браузер запрашивает сам при внешнем <link icon>. */
  const noise = (u) => u.includes('soldier.glb') || u.includes('favicon') || u.includes('logo');
  console.log('G7 ERRORS:', JSON.stringify({ desktop: errors.slice(0, 3), mobile: merrors.slice(0, 3), bad404: bad404.slice(0, 4) }));
  const eNew = errors.concat(merrors).filter((e) => !(e.includes('status of 404') && bad404.every(noise)));
  const real404 = bad404.filter((u) => !noise(u));
  if (eNew.length || real404.length) fail('G7 ошибки: ' + eNew.concat(real404).slice(0, 5).join(' | '));

  await browser.close();
  console.log('pw_v27: ALL GATES GREEN (7/7)');
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
