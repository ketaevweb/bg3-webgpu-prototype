/* pw_pages.cjs — smoke-тест ЖИВОГО сайта на GitHub Pages (v2.7).
   Гейты: boot (WebGPU/WebGL2), озвучка-манифест (basePath), десктоп fsBtn,
   мобильная эмуляция: touch-детект + talkBtn + тап-движение, чистая консоль
   (известный шум: soldier.glb/favicon). Серверные API на Pages 404 —
   фоллбеки должны молчать. */
const { chromium } = require('playwright');
const URL = 'https://ketaevweb.github.io/bg3-webgpu-prototype/';
const fail = (m) => { console.log('FAIL: ' + m); process.exit(1); };

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

  /* === десктоп === */
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 90000 });
  await page.waitForFunction(() => window.__bg3.voice().ready, null, { timeout: 60000 }).catch(() => {});
  const g1 = await page.evaluate(() => ({
    boot: true, fs: window.__bg3.fs(), voice: window.__bg3.voice().ready,
    lines: window.__bg3.voice().lines,
    fsBtn: !!document.getElementById('fsBtn'), talk: !!document.getElementById('talkBtn'),
    canvas: !!document.querySelector('#scene canvas'),
  }));
  console.log('P1 DESKTOP:', JSON.stringify(g1));
  if (!g1.canvas || !g1.fsBtn || g1.talk || !g1.fs.can) fail('P1 десктоп: ' + JSON.stringify(g1));
  /* Pages — статика: манифест должен быть прочитан (190 реплик) */
  if (!g1.voice || g1.lines < 190) fail('P1 манифест не прочитан на Pages (basePath?): lines=' + g1.lines);
  /* fullscreen на живом сайте */
  await page.click('#fsBtn');
  await page.waitForTimeout(700);
  const fsOn = await page.evaluate(() => window.__bg3.fs().on);
  console.log('P2 DESKTOP FS:', fsOn);
  if (!fsOn) fail('P2 fullscreen не включился на Pages');
  await ctx.close();

  /* === мобила === */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  const merrors = [];
  mp.on('pageerror', (e) => merrors.push('PAGEERROR: ' + e.message));
  mp.on('console', (m) => { if (m.type() === 'error') merrors.push('CONSOLE: ' + m.text()); });
  await mp.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await mp.waitForFunction(() => !!window.__bg3, null, { timeout: 90000 });
  await mp.waitForTimeout(2500);
  const g3 = await mp.evaluate(() => {
    const tb = document.getElementById('talkBtn');
    const r = tb ? tb.getBoundingClientRect() : null;
    return { touch: window.__bg3.fs().touch, talkVis: !!r && r.width > 0, canvas: !!document.querySelector('#scene canvas') };
  });
  console.log('P3 MOBILE:', JSON.stringify(g3));
  if (!g3.touch || !g3.talkVis || !g3.canvas) fail('P3 мобила: ' + JSON.stringify(g3));
  /* тап-движение на живом сайте */
  const tapAt = await mp.evaluate(() => {
    const W = (v) => (v - 13.5) * 1.6;
    const V = window.__bg3.scn().position.constructor;
    const p = new V(W(16), 0, W(23)).project(window.__bg3.cam());
    return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
  });
  await mp.touchscreen.tap(tapAt.x, tapAt.y);
  const moved = await mp.waitForFunction(() => {
    const h = window.__bg3.units.find((u) => u.side === 'hero');
    return h && (h.x !== 13 || h.z !== 24);
  }, null, { timeout: 15000 }).then(() => true).catch(() => false);
  console.log('P4 MOBILE TAP MOVE:', moved);
  if (!moved) fail('P4 тап-движение не работает на Pages');
  const noise = (t) => t.includes('soldier.glb') || t.includes('favicon') || t.includes('logo') || t.includes('status of 404');
  const realErr = errors.concat(merrors).filter((e) => !noise(e));
  console.log('P5 ERRORS:', JSON.stringify({ all: errors.concat(merrors).length, real: realErr.length, sample: realErr.slice(0, 3) }));
  if (realErr.length) fail('P5 ошибки: ' + realErr.slice(0, 4).join(' | '));
  await browser.close();
  console.log('pw_pages: ALL GATES GREEN (5/5) — GitHub Pages LIVE');
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
