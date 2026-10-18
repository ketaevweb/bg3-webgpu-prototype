/* диагностика pw_v21 G10: состояние G перед switchMap('forest') после w10 */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30' })); } catch {}
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)); });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => { window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true; window.__bg3.questDone('giants'); });
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const waitCombat = () => page.waitForFunction(() => window.__bg3.turn().combatOn, null, { timeout: 30000 });
  await page.evaluate(() => window.__bg3.arenaEndless());
  for (let w = 6; w <= 10; w++) {
    await waitCombat();
    if (w === 10) break;
    await page.evaluate(() => window.__bg3.arenaWipe());
    await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
    await page.waitForTimeout(2100);
  }
  /* w10 идёт: подкрепление как в G9 v21, затем wipe */
  await page.evaluate(() => {
    const c = window.__bg3.S.combatGroup[0];
    window.__bg3.hurt(c, Math.floor(c.maxhp / 2));
  });
  await page.waitForTimeout(1500);
  const diag1 = await page.evaluate(() => {
    const G = window.__bg3.S && window.__bg3;
    return { combatOn: window.__bg3.turn().combatOn, phase: window.__bg3.turn().phase, busyField: window.__bg3.S ? 'S ok' : 'no S', wave: window.__bg3.arenaState() };
  });
  console.log('DIAG w10 in combat:', JSON.stringify(diag1));
  /* wipe + диагностика busy прямо в одном evaluate */
  const diag2 = await page.evaluate(() => {
    const b = window.__bg3;
    b.arenaWipe();
    const snap = (k) => JSON.stringify({ combatOn: b.turn().combatOn, phase: b.turn().phase, wave: b.arenaState().wave, mapId: b.turn().mapId });
    return { afterWipe: snap(1) };
  });
  console.log('DIAG after wipe:', JSON.stringify(diag2));
  await page.waitForTimeout(400);
  const diag3 = await page.evaluate(() => {
    const b = window.__bg3;
    const t = b.turn();
    /* внутренности G недоступны напрямую — busy виден по попытке switchMap */
    return { phase: t.phase, combatOn: t.combatOn, mapId: t.mapId, wave: b.arenaState().wave, dlgOpen: !!document.getElementById('dlgBox') && document.getElementById('dlgBox').style.display !== 'none' };
  });
  console.log('DIAG pre-switch:', JSON.stringify(diag3), 'errs=' + errs.length);
  await page.evaluate(() => window.__bg3.switchMap('forest'));
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => window.__bg3.turn().mapId + '/' + window.__bg3.turn().phase);
    console.log('t+' + (i + 1) + 's: ' + st);
    if (st.startsWith('forest')) break;
  }
  console.log('errs:', JSON.stringify(errs.slice(0, 6)));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
