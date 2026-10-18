/* v1.8 E2E (playwright): «Цитадель Долгого Дозора» — гейт, карта, стена,
   печать сундука, бой с Малвехом (фаза 2 «Глас глубин»), финал кампании,
   сундук/знамя, сейв/лоад, чистый ремоут. Урок v1.7: gfx-пресет через
   addInitScript, снимки — loopStop+render+toDataURL в одном таске. */
const fs = require('fs');
const { chromium } = require('playwright');

const shot = async (page, name) => {
  const data = await page.evaluate(() => {
    window.__bg3.loopStop();
    const r = window.__bg3.rnd(), s = window.__bg3.scn(), c = window.__bg3.cam();
    r.render(s, c);
    const url = document.querySelector('canvas').toDataURL('image/jpeg', 0.82);
    return url;
  });
  fs.writeFileSync('upload/e2e/' + name, Buffer.from(data.split(',')[1], 'base64'));
};

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
  /* клик по кнопке конца хода — точный JS-клик (text= ловит strict-mode-ошибки) */
  const endTurnClick = async () => {
    for (let i = 0; i < 10; i++) {
      const ok = await page.evaluate(() => {
        const b = [...document.querySelectorAll('#btns button')].find(x => x.textContent === 'Завершить ход');
        if (b && !b.disabled) { b.click(); return true; }
        return false;
      });
      if (ok) return true;
      await page.waitForTimeout(400);
    }
    return false;
  };

  /* G1: boot v1.8 */
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  console.log('G1 BOOT:', await page.evaluate(() => JSON.stringify({
    heroes: window.__bg3.units.filter(u => u.side === 'hero').length,
    mapId: window.__bg3.turn().mapId,
    version: document.body.innerText.includes('v1.8') || 'see-log',
  })));

  /* G2: прокачка отряда для живучести (XP за ранние квесты — реальные questDone) */
  await page.evaluate(() => { window.__bg3.questDone('main'); window.__bg3.questDone('crypt'); window.__bg3.questDone('swamp'); });
  await page.waitForTimeout(400);
  console.log('G2 LEVELS:', await page.evaluate(() => JSON.stringify(window.__bg3.units.filter(u => u.side === 'hero').map(h => h.cls + ':' + h.level))));

  /* G3: перевал — тропа цитадели + гейт (Гаррум жив) */
  await page.evaluate(() => window.__bg3.switchMap('giants'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'giants', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const gate = await page.evaluate(() => {
    const b = window.__bg3;
    const hasTrail = b.inters().some(l => l.includes('Тракт к цитадели'));
    b.callInter('Тракт к цитадели (на северо-восток)');
    return { hasTrail, before: 'giants', after: b.turn().mapId };
  });
  console.log('G3 GATE BLOCKED:', JSON.stringify(gate)); /* after должен остаться giants */
  await page.evaluate(() => window.__bg3.questDone('giants'));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__bg3.callInter('Тракт к цитадели (на северо-восток)'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3500); /* FBX-декор */

  /* G4: карта цитадели — гарнизон, стена/ворота, квест, печать сундука */
  const cit = await page.evaluate(() => {
    const b = window.__bg3;
    const boss = b.units.find(u => u.citadelBoss);
    return {
      mapId: b.turn().mapId,
      garrison: b.units.filter(u => u.side === 'goblin' && u.alive && !u.summoned).length,
      boss: boss ? { name: boss.name, hp: boss.maxhp, ac: boss.ac, cls: boss.cls, melee: boss.weapon.melee } : null,
      quest: b.QUESTS.citadel ? b.QUESTS.citadel.state : 'MISSING',
      enterObj: b.QUESTS.citadel && b.QUESTS.citadel.objs[0] && b.QUESTS.citadel.objs[0].done,
      wallSolid: b.solidAt(7, 10), gate13: b.solidAt(13, 10), gate14: b.solidAt(14, 10),
      chestInter: b.inters().some(l => l === 'Открыть сундук цитадели'),
    };
  });
  console.log('G4 CITADEL:', JSON.stringify(cit));
  const seal = await page.evaluate(() => {
    const b = window.__bg3;
    b.callInter('Открыть сундук цитадели');
    return { bannerStolen: b.bag().includes('watch_banner'), chestFlag: b.S.citadelChest };
  });
  console.log('G4 SEAL (ожидание: не украдено):', JSON.stringify(seal));
  await shot(page, 'v18_citadel.jpg');
  await page.evaluate(() => window.__bg3.loopStart());

  /* G5: бой — реальные болты по боссу (лог урона), мобы подрезаны до 2 HP и
     подтянуты к отряду (рендер песочницы ~30с/раунд ИИ); фаза 2 на полсмерти */
  await page.evaluate(() => {
    const b = window.__bg3;
    const Wf = v => (v - 13.5) * 1.6;
    const tp = (u, x, z) => { u.x = x; u.z = z; u.mesh.position.set(Wf(x), 0, Wf(z)); };
    const mal = b.S.citadelGroup.find(u => u.citadelBoss);
    const rest = b.S.citadelGroup.filter(u => !u.citadelBoss);
    if (mal) tp(mal, 14, 20);
    if (rest[0]) tp(rest[0], 10, 20); if (rest[1]) tp(rest[1], 18, 20); if (rest[2]) tp(rest[2], 13, 19);
    if (rest[3]) tp(rest[3], 16, 19); if (rest[4]) tp(rest[4], 11, 19);
    for (const u of b.S.citadelGroup) if (u.alive && !u.citadelBoss) u.hp = 2;
    /* живучесть отряда для E2E (проверяем механику босса, не выживание):
      hp=maxhp=99 у героев; босс сразу на полсмерти — фаза 2 в первый же ход */
    for (const h of b.units.filter(u => u.side === 'hero')) { h.hp = 99; h.maxhp = 99; }
    const mal2 = b.S.citadelGroup.find(u => u.citadelBoss); if (mal2) mal2.hp = 30;
    b.startCombat(b.S.citadelGroup.filter(u => u.alive));
  });
  await page.waitForTimeout(1200);
  let phase2Seen = false, casts = 0, bossDown = false, boltsIntoBoss = 0;
  for (let i = 0; i < 300; i++) {
    const st = await page.evaluate(() => window.__bg3.turn());
    if (!st.combatOn) break;
    const p2 = await page.evaluate(() => {
      const b = window.__bg3, m = b.units.find(u => u.citadelBoss);
      return m ? { phase2: !!m.phase2, ac: m.ac, alive: m.alive, hp: m.hp, summons: b.units.filter(u => u.summoned && u.alive).length } : null;
    });
    if (p2 && p2.phase2 && !phase2Seen) { phase2Seen = true; console.log('G5 PHASE2:', JSON.stringify(p2)); }
    if (p2 && p2.alive && p2.phase2 && p2.hp > 4 && boltsIntoBoss >= 1) {
      await page.evaluate(() => { window.__bg3.units.find(u => u.citadelBoss).hp = 3; }); /* добивание */
    }
    if (!(st.hero && st.action > 0)) { await page.waitForTimeout(500); continue; }
    const target = await page.evaluate(() => {
      const b = window.__bg3;
      const h = b.units.find(u => u.side === 'hero' && u.alive && u.action > 0);
      if (!h) return null;
      const cands = b.units.filter(u => u.side === 'goblin' && u.alive && !u.isBarrel);
      const m = cands.find(u => u.citadelBoss);
      const list = m ? [m, ...cands.filter(u => u !== m)] : cands;
      for (const t of list) {
        const dd = Math.max(Math.abs(t.x - h.x), Math.abs(t.z - h.z));
        if (dd <= 9) return { x: t.x, z: t.z, name: t.name };
      }
      return null;
    });
    if (target) {
      casts++;
      if (target.name.includes('Малвех')) boltsIntoBoss++;
      const res = await page.evaluate(async (t) => {
        const b = window.__bg3;
        b.aim('bolt');
        await b.fire(t.x, t.z);
        const m = b.units.find(u => u.citadelBoss);
        return { bossAlive: m ? m.alive : null, bossHp: m ? m.hp : -1 };
      }, target);
      if (target.name.includes('Малвех')) console.log('G5 BOLT#' + boltsIntoBoss + ' → Малвех:', JSON.stringify(res));
      if (res.bossAlive === false) { bossDown = true; console.log('G5 BOSS DOWN after', casts, 'casts'); }
    }
    await endTurnClick();
    await page.waitForTimeout(400);
  }
  console.log('G5 COMBAT DONE:', JSON.stringify({ phase2Seen, casts, boltsIntoBoss, bossDown }));

  /* G6: финал кампании — экран «ДОЛГОЙ ДОЗОР!» */
  await page.waitForTimeout(2600); /* showEnd — setTimeout 2000 */
  const fin = await page.evaluate(() => {
    const b = window.__bg3;
    const h1 = document.querySelector('#end h1');
    return {
      citadelDone: b.S.citadelDone, campaignDone: b.S.campaignDone,
      quest: b.QUESTS.citadel.state,
      endTitle: h1 ? h1.textContent : null,
      endStats: (document.querySelector('#end p') || {}).textContent || null,
    };
  });
  console.log('G6 FINALE:', JSON.stringify(fin));
  await shot(page, 'v18_finale.jpg');
  await page.evaluate(() => window.__bg3.loopStart());

  /* G7: сундук — Знамя Дозора + экипировка (+2 КД) */
  const chest = await page.evaluate(() => {
    const b = window.__bg3;
    const gold0 = b.S.gold;
    b.callInter('Открыть сундук цитадели');
    return { goldGain: b.S.gold - gold0, banner: b.bag().includes('watch_banner'), flag: b.S.citadelChest };
  });
  console.log('G7 CHEST:', JSON.stringify(chest));
  const eq = await page.evaluate(() => {
    const b = window.__bg3;
    const f = b.units.find(u => u.cls === 'fighter' && u.side === 'hero');
    if (!f) return null;
    const ac0 = f.ac;
    b.giveGear('watch_banner', 'fighter');
    return { ac0, ac1: f.ac, armorOk: f.ac - ac0 === 2 };
  });
  console.log('G7 BANNER EQUIP (+2 КД):', JSON.stringify(eq));

  /* G8: сейв/лоад на цитадели — 1:1, Малвех не встаёт */
  await page.evaluate(() => window.__bg3.doSave(2));
  await page.waitForTimeout(700);
  const sv = await page.evaluate(() => {
    const b = window.__bg3;
    return {
      mapId: b.turn().mapId, gold: b.S.gold, bag: b.bag(),
      heroes: b.units.filter(u => u.side === 'hero').map(h => ({ cls: h.cls, hp: h.hp, ac: h.ac })),
    };
  });
  await page.evaluate(() => window.__bg3.doLoad(2));
  await page.waitForTimeout(2500);
  const loaded = await page.evaluate(() => {
    const b = window.__bg3;
    return {
      mapId: b.turn().mapId, gold: b.S.gold, bag: b.bag(),
      citadelDone: b.S.citadelDone, campaignDone: b.S.campaignDone,
      enemies: b.units.filter(u => u.side === 'goblin' && u.alive).length,
      heroes: b.units.filter(u => u.side === 'hero').map(h => ({ cls: h.cls, hp: h.hp, ac: h.ac })),
    };
  });
  const same = sv.gold === loaded.gold && JSON.stringify(sv.heroes) === JSON.stringify(loaded.heroes) && loaded.bag.join() === sv.bag.join();
  console.log('G8 SAVE/LOAD 1:1:', same, JSON.stringify({ loaded }));
  await shot(page, 'v18_loaded.jpg');
  await page.evaluate(() => window.__bg3.loopStart());

  /* G9: чистый ремоут */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(8000);
  console.log('G9 RELOAD:', await page.evaluate(() => JSON.stringify({
    canvas: document.querySelectorAll('canvas').length,
    mapId: window.__bg3.turn().mapId,
    heroes: window.__bg3.units.filter(u => u.side === 'hero').length,
  })));

  await browser.close();
  console.log('404s:', bad404.length ? bad404.slice(0, 10) : 'none');
  console.log('ERRORS:', errors.length ? errors.slice(0, 8) : 'none');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
