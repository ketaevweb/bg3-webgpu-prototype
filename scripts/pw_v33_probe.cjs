/* Локализация 404 soldier.glb: шаг за шагом с таймстампами ответов. */
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('response', (r) => {
    if (r.status() >= 400) console.log('[NET]', Date.now() % 100000, r.status(), r.url());
  });
  page.on('console', (m) => { if (m.type() === 'warning' && /rig|fallback/i.test(m.text())) console.log('[WARN]', Date.now() % 100000, m.text().slice(0, 120)); });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 90000 });
  console.log('STEP boot done');
  await sleep(5000);
  console.log('STEP spawn');
  await page.evaluate(() => { window.__bg3.edOpen(); window.__bg3.edSpawn('bruiser'); });
  await sleep(4000);
  console.log('STEP map crypt');
  await page.evaluate(() => window.__bg3.edMap('crypt'));
  await sleep(7000);
  const rigs = await page.evaluate(() => {
    const us = window.__bg3.units.filter((u) => u.side !== 'hero');
    return { enemies: us.length,
      synty: us.filter((u) => u._mixer && /rivals|heroes/.test(String(u._rigUrl || ''))).length,
      urls: [...new Set(us.map((u) => String(u._rigUrl || '').split('/').pop()))] };
  });
  console.log('CRYPT RIGS:', JSON.stringify(rigs));
  if (rigs.synty !== rigs.enemies) console.log('!!! НЕ ВСЕ НА SYNTY: ' + rigs.synty + '/' + rigs.enemies);
  console.log('STEP map forest');
  await page.evaluate(() => window.__bg3.edMap('forest'));
  await sleep(7000);
  console.log('STEP combat');
  await page.evaluate(() => { window.__bg3.startCombat(window.__bg3.S.campGroup.slice()); });
  await sleep(3000);
  console.log('STEP arenaWipe');
  await page.evaluate(() => { try { window.__bg3.arenaWipe(); } catch (e) { console.log('wipe err', e.message); } });
  await sleep(2500);
  console.log('DONE');
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
