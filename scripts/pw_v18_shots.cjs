/* v1.8 beauty-shots: цитадель у ворот + экран финала «ДОЛГОЙ ДОЗОР!» */
const fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '75', fps: '30' })); } catch {}
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => { window.__bg3.questDone('main'); window.__bg3.questDone('crypt'); window.__bg3.questDone('swamp'); window.__bg3.questDone('giants'); });
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(4500);

  /* кадр 1: ворота цитадели — стена, знамёна, двор, босс на севере */
  await page.evaluate(() => {
    const b = window.__bg3;
    const c = b.cam(), t = b.ctl();
    t.target.set((13.5 - 13.5) * 1.6, 1.0, (10 - 13.5) * 1.6);
    c.position.set((13.5 - 13.5) * 1.6 + 2.5, 16.5, (21 - 13.5) * 1.6);
    t.update();
  });
  await page.evaluate(() => {
    window.__bg3.loopStop();
    const r = window.__bg3.rnd(), s = window.__bg3.scn(), c = window.__bg3.cam();
    r.render(s, c);
    const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.86);
    return url;
  }).then(d => fs.writeFileSync('upload/e2e/v18_gate.jpg', Buffer.from(d.split(',')[1], 'base64')));
  await page.evaluate(() => window.__bg3.loopStart());

  /* кадр 2: бой + финал — быстрый прогон с телепортом */
  await page.evaluate(() => {
    const b = window.__bg3;
    const Wf = v => (v - 13.5) * 1.6;
    const tp = (u, x, z) => { u.x = x; u.z = z; u.mesh.position.set(Wf(x), 0, Wf(z)); };
    const mal = b.S.citadelGroup.find(u => u.citadelBoss);
    const rest = b.S.citadelGroup.filter(u => !u.citadelBoss);
    if (mal) tp(mal, 14, 20);
    rest.forEach((u, i) => tp(u, 10 + i * 2, 21 - (i % 2)));
    for (const u of b.S.citadelGroup) if (u.alive && !u.citadelBoss) u.hp = 2;
    for (const h of b.units.filter(u => u.side === 'hero')) { h.hp = 99; h.maxhp = 99; }
    mal.hp = 30;
    b.startCombat(b.S.citadelGroup.filter(u => u.alive));
  });
  /* ждём фазу 2 и валим босса одним болтом с подрезкой */
  for (let i = 0; i < 450; i++) {
    const st = await page.evaluate(() => window.__bg3.turn());
    if (!st.combatOn) break;
    const m = await page.evaluate(() => {
      const b = window.__bg3, mm = b.units.find(u => u.citadelBoss);
      /* адепт латает мобов — каждый ход возвращаем им hp=2 (E2E-скорость) */
      for (const u of b.units.filter(x => x.side === 'goblin' && x.alive && !x.citadelBoss && !x.isBarrel)) if (u.hp > 2) u.hp = 2;
      return mm ? { alive: mm.alive, phase2: !!mm.phase2, hp: mm.hp } : { alive: false };
    });
    if (m.alive && m.phase2 && m.hp > 3) await page.evaluate(() => { window.__bg3.units.find(u => u.citadelBoss).hp = 3; });
    if (!(st.hero && st.action > 0)) { await page.waitForTimeout(450); continue; }
    const tgt = await page.evaluate(() => {
      const b = window.__bg3;
      const h = b.units.find(u => u.side === 'hero' && u.alive && u.action > 0);
      if (!h) return null;
      const cands = b.units.filter(u => u.side === 'goblin' && u.alive && !u.isBarrel);
      const mm = cands.find(u => u.citadelBoss);
      const list = mm ? [mm, ...cands.filter(u => u !== mm)] : cands;
      for (const t of list) {
        const dd = Math.max(Math.abs(t.x - h.x), Math.abs(t.z - h.z));
        if (dd <= 9) return { x: t.x, z: t.z };
      }
      return null;
    });
    if (tgt) await page.evaluate(async (t) => { const b = window.__bg3; b.aim('bolt'); await b.fire(t.x, t.z); }, tgt);
    for (let k = 0; k < 8; k++) {
      const ok = await page.evaluate(() => {
        const b = [...document.querySelectorAll('#btns button')].find(x => x.textContent === 'Завершить ход');
        if (b && !b.disabled) { b.click(); return true; }
        return false;
      });
      if (ok) break;
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(3000);
  const endOk = await page.evaluate(() => (document.querySelector('#end h1') || {}).textContent || null);
  console.log('END TITLE:', endOk);
  console.log('STATE:', await page.evaluate(() => {
    const b = window.__bg3;
    return JSON.stringify({
      turn: b.turn(),
      enemies: b.units.filter(u => u.side === 'goblin' && u.alive).map(u => u.short + ':' + u.hp),
      heroes: b.units.filter(u => u.side === 'hero').map(u => u.short + ':' + u.hp + '/' + u.maxhp + ' alive:' + u.alive),
      campaign: b.S.campaignDone, q: b.QUESTS.citadel.state,
    });
  }));
  await page.screenshot({ path: 'upload/e2e/v18_finale_screen.png' });
  await browser.close();
  console.log('SHOTS DONE');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
