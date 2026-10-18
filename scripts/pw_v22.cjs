/* v2.2 E2E (playwright): ауры боссов кампании (Грат/Гаррум/Малвех через spawnBoss),
   обмен реликвий у стелы (призрак коменданта: Сердце бездны/Осколок портала/Печать глубин),
   калибровка XP глубинных волн (xp ×(1+0.12k), сверх предела — золото).
   Харнес — по урокам v1.7–v2.1: фильтр 404-фолбэка soldier.glb, arenaStart ОДИН раз,
   поэлементные checks-объекты с JSON-выводом. */
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
const fail = (msg) => { console.log('FAIL: ' + msg); process.exit(1); };

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
  await page.evaluate(() => window.__bg3.forceSeason(-1));/* v2.4: нейтральный сезон — старые ассерты не зависят от недели */

  /* G2: постгейм — цитадель, Хальдир; стела + ПРИЗРАК (обмен) + портал */
  await page.evaluate(() => { window.__bg3.S.citadelDone = true; window.__bg3.S.campaignDone = true; window.__bg3.questDone('giants'); });
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__bg3.joinHaldir());
  await page.waitForTimeout(1200);
  const g2 = await page.evaluate(() => ({
    stela: window.__bg3.inters().includes('Стела рекордов (арена)'),
    ghost: window.__bg3.inters().includes('Призрак коменданта (обмен реликвий)'),
    arenaInter: window.__bg3.inters().includes('Испытание Глубин (арена)'),
    heroes: window.__bg3.units.filter(u => u.side === 'hero').length,
    relicOwned0: window.__bg3.S.bag.includes('deep_seal'),
  }));
  console.log('G2 POSTGAME (стела+призрак+портал):', JSON.stringify(g2));
  if (!g2.stela || !g2.ghost || !g2.arenaInter || g2.heroes !== 3) fail('G2 postgame incomplete');

  /* G3: ауры боссов кампании — парные пробы spawnBoss (aura(att) бустит ТОЛЬКО врагов,
     герой-атакующий всегда 0 — семантика v2.1): Малвех 2, Гаррум 2, Грат 1 */
  const g3 = await page.evaluate(async () => {
    const b = window.__bg3;
    const out = {};
    /* пара 1: Малвех [14,7] + Гаррум [14,9] — взаимные пробы (соседняя аура = 2) */
    const mv = b.spawnBoss('malveh', 14, 7);
    const gr = b.spawnBoss('garrum', 14, 9);
    out.malvehFromGarrum = b.aura(mv);/* источник: Гаррум (2) */
    out.garrumFromMalveh = b.aura(gr);/* источник: Малвех (2) */
    mv.alive = false; mv.mesh.removeFromParent();
    gr.alive = false; gr.mesh.removeFromParent();
    /* пара 2: Грат [20,10] + Грат [20,12] — аура вождя = 1 */
    const gt1 = b.spawnBoss('grat', 20, 10);
    const gt2 = b.spawnBoss('grat', 20, 12);
    out.gratFromGrat = b.aura(gt2);/* источник: Грат (1) */
    gt1.alive = false; gt1.mesh.removeFromParent();
    /* контроль: атакующий вдали от всех носителей ауры */
    const far = b.spawnBoss('garrum', 24, 22);
    out.far = b.aura(far);
    far.alive = false; far.mesh.removeFromParent();
    gt2.alive = false; gt2.mesh.removeFromParent();
    return out;
  });
  console.log('G3 BOSS AURAS:', JSON.stringify(g3), '(ожидание malveh=2, garrum=2, grat=1, far=0)');
  if (g3.malvehFromGarrum !== 2 || g3.garrumFromMalveh !== 2 || g3.gratFromGrat !== 1 || g3.far !== 0) fail('G3 auras wrong');

  /* G4: калибровка XP — все герои на пределе (3) → опыт в золото */
  const g4 = await page.evaluate(() => {
    const b = window.__bg3;
    const heroes = b.units.filter(u => u.side === 'hero');
    for (const h of heroes) { h.level = 3; h.xp = 999; }
    const gold0 = b.S.gold;
    b.awardXP(100);
    return { heroes: heroes.length, gold0, gold1: b.S.gold, delta: b.S.gold - gold0 };
  });
  console.log('G4 XP→GOLD:', JSON.stringify(g4), '(ожидание delta=30: 3 героя × 100 XP / 10)');
  if (g4.delta !== 30) fail('G4 xp conversion wrong');

  /* G5: испытание 5 волн → best=5, журнал [w5]; базовый XP утопленника волны 1 */
  await page.evaluate(() => window.__bg3.arenaStart());
  let baseXp = 0;
  for (let w = 1; w <= 5; w++) {
    await waitCombat(page);
    const st = await page.evaluate(() => window.__bg3.arenaState());
    if (st.wave !== w) fail('G5 wave mismatch: got ' + st.wave + ' want ' + w);
    if (w === 1) baseXp = await page.evaluate(() => window.__bg3.S.combatGroup.filter(e => e.alive)[0].xp);
    await page.evaluate(() => window.__bg3.arenaWipe());
    await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
    await page.waitForTimeout(400);
  }
  const g5 = await page.evaluate(() => ({ best: window.__bg3.arenaState().best, logLen: window.__bg3.S.arenaLog.length, log0: window.__bg3.S.arenaLog[0] }));
  console.log('G5 TRIAL DONE:', JSON.stringify(g5), 'baseXp=' + baseXp, '(ожидание best=5, log 1 запись w=5)');
  if (g5.best !== 5 || g5.logLen !== 1) fail('G5 trial state wrong');

  /* G6: портал сменил лик; стела читается; скрин стелы с призраком */
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__bg3.callInter('Стела рекордов (арена)'));
  await page.waitForTimeout(400);
  const g6 = await page.evaluate(() => ({
    endlessLabel: window.__bg3.inters().includes('Бесконечное испытание (арена)'),
    stelaText: (document.getElementById('logbody') || {}).innerText || '',
  }));
  console.log('G6 STELA READ:', JSON.stringify({ endlessLabel: g6.endlessLabel, hasBest: g6.stelaText.includes('Лучший заход: волна 5'), hasWave5: g6.stelaText.includes('Волна 5') }));
  if (!g6.endlessLabel || !g6.stelaText.includes('Лучший заход: волна 5')) fail('G6 stela/portal swap wrong');
  await shot(page, 'v22_stela_ghost.jpg');

  /* G7: волна 6 — XP-калибровка: утопленник 79=round(70×1.12), глубина 1, КД 12 */
  await page.evaluate(() => window.__bg3.arenaEndless());
  await waitCombat(page);
  const g7 = await page.evaluate(() => {
    const grp = window.__bg3.S.combatGroup.filter(e => e.alive);
    const dr = grp.find(e => e.name.includes('Утопленник'));
    const kn = grp.find(e => e.short.startsWith('Рыцарь'));
    return {
      wave: window.__bg3.arenaState().wave,
      shorts: grp.map(e => e.short + '|' + e.name),
      drXp: dr ? dr.xp : null, drDepth: dr ? dr.depth : null, drAc: dr ? dr.ac : null, drHp: dr ? dr.maxhp : null,
      knXp: kn ? kn.xp : null,
    };
  });
  console.log('G7 W6 XP CALIBRATION:', JSON.stringify(g7), '(ожидание drXp 78=round(70×1.12), depth 1, ac 12, hp 16; knXp 179=round(160×1.12))');
  if (g7.drXp !== Math.round(baseXp * 1.12) || g7.drDepth !== 1 || g7.drHp !== 16 || g7.knXp !== 179) fail('G7 xp calibration wrong');

  /* G8: волны 7→10 → чемпион: aura=2 (v2.2), xp 96=round(60×1.6) — глубина ЛИНЕЙНА (1+0.12·k), hp 18; аура сосед/герой/вдали */
  let champ = null;
  for (let w = 7; w <= 10; w++) {
    await page.evaluate(() => window.__bg3.arenaWipe());
    await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
    await page.waitForTimeout(2100);/* таймер следующей волны 1700мс + запас */
    await waitCombat(page);
    const st = await page.evaluate(() => window.__bg3.arenaState());
    if (st.wave !== w) fail('G8 wave mismatch: got ' + st.wave + ' want ' + w);
    if (w === 10) {
      champ = await page.evaluate(() => {
        const b = window.__bg3;
        const c = b.S.combatGroup[0];
        const e = b.S.combatGroup[1];
        e.x = c.x + 1; e.z = c.z;
        const near = b.aura(e);
        const hero = b.units.find(u => u.side === 'hero');
        const heroVal = b.aura(hero);
        const ex = e.x, ez = e.z; e.x = 20; e.z = 20;
        const far = b.aura(e);
        e.x = ex; e.z = ez;
        return { name: c.name, champ: !!c.champ, elite: !!c.elite, aura: c.aura, ac: c.ac, maxhp: c.maxhp, xp: c.xp, near, heroVal, far };
      });
      break;
    }
  }
  console.log('G8 CHAMPION W10:', JSON.stringify(champ), '(ожидание champ, elite, aura 2, ac 14, hp 18, xp 96; near=2, hero=0, far=0)');
  if (!champ || !champ.champ || champ.aura !== 2 || champ.xp !== 96 || champ.maxhp !== 18 || champ.near !== 2 || champ.heroVal !== 0 || champ.far !== 0) fail('G8 champion/aura wrong');
  await shot(page, 'v22_champion_w10.jpg');

  /* G8b: «Бездна зовёт» (регресс v2.1) — урон до половины → +2 утопленника */
  const g8b = await page.evaluate(() => {
    const b = window.__bg3;
    const c = b.S.combatGroup[0];
    const before = b.S.combatGroup.filter(e => e.alive).length;
    b.hurt(c, Math.floor(c.maxhp / 2));
    const grp = b.S.combatGroup.filter(e => e.alive);
    const reinf = grp.slice(-2);
    return { before, after: grp.length, reinforced: !!c.reinforced, reinfHp: reinf.length === 2 ? reinf[0].maxhp : null, reinfDepth: reinf.length === 2 ? reinf[0].depth : null };
  });
  console.log('G8b REINFORCE (регресс):', JSON.stringify(g8b), '(ожидание after=before+2, hp 22=round(14×1.6), depth 5)');
  if (g8b.after !== g8b.before + 2 || g8b.reinfHp !== 22) fail('G8b reinforce broken');

  /* G9: добиваем волну 10 → уход с карты → журнал [w5, w10] */
  await page.evaluate(() => window.__bg3.arenaWipe());
  await page.waitForFunction(() => !window.__bg3.turn().combatOn, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__bg3.switchMap('forest'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'forest', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const g9 = await page.evaluate(() => ({
    best: window.__bg3.arenaState().best, wave: window.__bg3.arenaState().wave,
    logLen: window.__bg3.S.arenaLog.length, logLast: window.__bg3.S.arenaLog[window.__bg3.S.arenaLog.length - 1],
  }));
  console.log('G9 LEFT→JOURNAL:', JSON.stringify(g9), '(ожидание best=10, wave=0, журнал 2 записи, последняя w=10)');
  if (g9.best !== 10 || g9.logLen !== 2 || !g9.logLast || g9.logLast.w !== 10) fail('G9 journal wrong');

  /* G10: обмен реликвий у призрака — покупка/уникальность/нехватка золота; диалог на скрин */
  await page.evaluate(() => window.__bg3.switchMap('citadel'));
  await page.waitForFunction(() => window.__bg3.turn().mapId === 'citadel', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  const g10 = await page.evaluate(() => {
    const b = window.__bg3;
    b.S.gold = 2000;
    const out = {};
    out.buyHeart = b.buyRelic('abyss_heart');
    out.goldAfterHeart = b.S.gold;
    out.buyHeartAgain = b.buyRelic('abyss_heart');/* уже в сумке — отказ */
    const f = b.units.find(u => u.cls === 'fighter');
    const hp0 = f.maxhp;
    b.giveGear('abyss_heart', 'fighter');
    out.fighterHp0 = hp0; out.fighterHp1 = f.maxhp;
    out.buySeal = b.buyRelic('deep_seal');
    out.goldAfterSeal = b.S.gold;
    const wz = b.units.find(u => u.cls === 'wizard');
    const ac0 = wz.ac;
    b.giveGear('deep_seal', 'wizard');
    out.wizAc0 = ac0; out.wizAc1 = wz.ac;
    out.buyShard = b.buyRelic('portal_shard');
    out.goldAfterShard = b.S.gold;
    const pl = b.units.find(u => u.cls === 'paladin');
    b.giveGear('portal_shard', 'paladin');
    out.palAtk = pl.atkBonus || 0;
    /* нехватка золота: возвращаем Печать глубин в «непроданное» и обнуляем казну */
    wz.gear.trinket = undefined; wz.ac = ac0;
    b.S.bag = b.S.bag.filter(id => id !== 'deep_seal');
    b.S.gold = 100;
    out.buySealPoor = b.buyRelic('deep_seal');
    out.goldPoor = b.S.gold;
    return out;
  });
  console.log('G10 RELICS:', JSON.stringify(g10), '(ожидание buy=true ×3, повтор=false, HP+10, КД+2, атака паладина +1, бедность → false, золото не списано)');
  if (!g10.buyHeart || g10.goldAfterHeart !== 1600 || g10.buyHeartAgain || g10.fighterHp1 !== g10.fighterHp0 + 10) fail('G10 heart wrong');
  if (!g10.buySeal || g10.goldAfterSeal !== 1000 || g10.wizAc1 !== g10.wizAc0 + 2) fail('G10 seal wrong');
  if (!g10.buyShard || g10.goldAfterShard !== 500 || g10.palAtk !== 1) fail('G10 shard wrong');
  if (g10.buySealPoor || g10.goldPoor !== 100) fail('G10 poor-gate wrong');
  /* диалог призрака — DOM + скрин */
  await page.evaluate(() => { window.__bg3.S.gold = 2000; window.__bg3.callInter('Призрак коменданта (обмен реликвий)'); });
  await page.waitForTimeout(600);
  const dlg = await page.evaluate(() => {
    const box = document.getElementById('dlgBox');
    const opts = Array.from(document.querySelectorAll('#dlgOpts button')).map(b => b.textContent || '');
    return { open: !!box && box.style.display !== 'none', name: (document.getElementById('dlgName') || {}).textContent, opts };
  });
  console.log('G10b GHOST DIALOG:', JSON.stringify({ open: dlg.open, name: dlg.name, opts: dlg.opts }));
  if (!dlg.open || dlg.name !== 'Призрак коменданта' || !dlg.opts.some(t => t.includes('Печать глубин'))) fail('G10b dialog wrong');
  await page.screenshot({ path: 'upload/e2e/v22_ghost_dialog.jpg', quality: 82, type: 'jpeg' });
  await page.evaluate((n) => document.querySelectorAll('#dlgOpts button')[n - 1].click(), dlg.opts.length);/* [Уйти] */
  await page.waitForTimeout(300);

  /* G11: сейв слот 3 → reload → doLoad 1:1 (журнал/рекорд/золото/паладин/реликвии/призрак) */
  await page.evaluate(() => window.__bg3.doSave(3));
  await page.waitForTimeout(800);
  const snap = await page.evaluate(() => ({
    log: window.__bg3.S.arenaLog, gold: window.__bg3.S.gold, bag: window.__bg3.S.bag, fhp: window.__bg3.units.find(u => u.cls === 'fighter').maxhp,
  }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => window.__bg3.doLoad(3));
  await page.waitForTimeout(3500);
  const g11 = await page.evaluate((exp) => {
    const b = window.__bg3;
    return {
      mapId: b.turn().mapId, best: b.arenaState().best,
      logLen: b.S.arenaLog.length, logMatch: JSON.stringify(b.S.arenaLog) === JSON.stringify(exp.log),
      gold: b.S.gold, goldMatch: b.S.gold === exp.gold,
      bagMatch: JSON.stringify(b.S.bag) === JSON.stringify(exp.bag),
      paladin: !!b.units.find(u => u.cls === 'paladin'),
      ghost: b.inters().includes('Призрак коменданта (обмен реликвий)'),
      stela: b.inters().includes('Стела рекордов (арена)'),
      endlessLabel: b.inters().includes('Бесконечное испытание (арена)'),
      fighterHpMatch: b.units.find(u => u.cls === 'fighter').maxhp === exp.fhp,
      sealStillUnowned: !b.S.bag.includes('deep_seal'),
    };
  }, snap);
  console.log('G11 SAVE/LOAD 1:1:', JSON.stringify(g11));
  if (!g11.logMatch || !g11.goldMatch || !g11.bagMatch || !g11.paladin || !g11.ghost || !g11.endlessLabel || !g11.fighterHpMatch || !g11.sealStillUnowned) fail('G11 save/load wrong');

  /* G12: чистый reload — 1 canvas, ошибок нет (кроме штатного 404-фолбэка) */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  const g12 = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, mapId: window.__bg3.turn().mapId }));
  const noise404 = bad404.filter(u => !u.includes('/models/rig/soldier.glb'));
  const hardErrors = errors.filter(e => !e.includes('status of 404') && !e.includes('soldier.glb'));
  console.log('G12 CLEAN RELOAD:', JSON.stringify(g12), 'hardErrors=' + hardErrors.length, 'noise404=' + noise404.length);
  if (g12.canvases !== 1 || hardErrors.length || noise404.length) fail('G12 clean reload wrong: ' + JSON.stringify(hardErrors.concat(noise404).slice(0, 4)));

  console.log('ALL V22 GATES GREEN');
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
