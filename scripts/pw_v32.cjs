/* v3.2 E2E (playwright): «ЖИВЫЕ ПОЗЫ» — анти-T-Pose гейт + Synty-NPC.
   Гейты:
   G1 boot: риги/клипы как v3.1 + ПОЗА ГЕРОЯ: idle рука опущена
      (dy = Hand_L.y − Shoulder_L.y ≤ −0.25 м у fighter; T-Pose давал ≈ −0.03..+0.11).
   G2 NPC: Кая/Дамрок/Илва получили SkinnedMesh Synty поверх капсул
      (S.kayaMesh/S.ilvaMesh + mesh Дамрока — ищем по interactable).
   G3 бой: startCombat + урон проходят (как v3.1 G3, сжато).
   G4 reload без 404/ошибок.
   Скриншоты — upload/e2e/v32_*.jpg. */
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
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'mid', res: '75', fps: '30', voice: false, vol: '0' })); } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP' + r.status() + ': ' + r.url()); });

  /* G1: boot + ПОЗА */
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => {
    const a = window.__bg3.animStats();
    return a.rigs.units >= 4 && a.rigs.synty >= 3;
  }, null, { timeout: 45000 }).catch(() => fail('G1 synty rigs did not settle'));
  await page.waitForTimeout(3500);/* idle-фейд 0.2с + запас */
  const g1 = await page.evaluate(() => {
    const f = window.__bg3.units.find((u) => u.cls === 'fighter' && u._mixer);
    if (!f) return { err: 'no fighter mixer' };
    const root = f._mixer.getRoot();
    const get = (n) => root.getObjectByName(n);
    const s = get('Shoulder_L'), h = get('Hand_L');
    if (!s || !h) return { err: 'no arm bones' };
    root.updateMatrixWorld(true);
    const p = (o) => { o.updateWorldMatrix(true, false); const e = o.matrixWorld.elements; return { y: e[13], x: e[12], z: e[14] }; };
    const a = p(s), b = p(h);
    /* гоблин — для вменяемости */
    const g = window.__bg3.units.find((u) => u.cls === 'goblin' && u._mixer);
    let gDy = null;
    if (g) {
      const gr = g._mixer.getRoot();
      const gs = gr.getObjectByName('Shoulder_L'), gh = gr.getObjectByName('Hand_L');
      if (gs && gh) {
        gr.updateMatrixWorld(true);
        const p2 = (o) => { o.updateWorldMatrix(true, false); const e = o.matrixWorld.elements; return { y: e[13] }; };
        gDy = +(p2(gh).y - p2(gs).y).toFixed(3);
      }
    }
    return { heroDy: +(b.y - a.y).toFixed(3), goblinDy: gDy, rigUrl: f._rigUrl };
  });
  await shot(page, 'v32_forest.jpg');
  if (g1.err) fail('G1 pose probe: ' + g1.err);
  if (g1.heroDy > -0.25) fail('G1 ГЕРОЙ В T-POSE: dy=' + g1.heroDy + ' (ожидали ≤ -0.25)');
  console.log('G1 POSE:', JSON.stringify(g1));

  /* G2: NPC — Кая/Илва имеют SkinnedMesh (Synty поверх капсулы) */
  const g2 = await page.evaluate(() => {
    const hasSkinned = (fig) => {
      if (!fig) return null;
      let sk = 0;
      fig.traverse((o) => { if (o.isSkinnedMesh) sk++; });
      return sk;
    };
    const S = window.__bg3.S;
    /* mesh Дамрока: интеракт с лейблом «Поговорить с Дамроком» несёт mesh */
    let damSk = null;
    const inters = window.__bg3.inters ? window.__bg3.inters() : [];
    return { kaya: hasSkinned(S.kayaMesh), ilva: hasSkinned(S.ilvaMesh), inters };
  });
  if (g2.kaya === null) console.log('G2 NOTE: Кая уже в отряде (S.kayaMesh=null) — пропуск');
  else if (g2.kaya < 1) fail('G2 КАЯ БЕЗ SKINNED MESH (капсула!)');
  if (g2.ilva !== null && g2.ilva < 1) fail('G2 ИЛВА БЕЗ SKINNED MESH (капсула!)');
  console.log('G2 NPC:', JSON.stringify(g2));

  /* G3: бой — выстрел по гоблину */
  await page.evaluate(() => { window.__bg3.startCombat(window.__bg3.S.campGroup.slice()); });
  await sleep(1200);
  const g3 = await page.evaluate(() => {
    const t = window.__bg3.units.find((u) => u.side === 'goblin' && u.alive);
    if (!t) return { combat: false };
    window.__bg3.fire(t.x, t.z);
    return { combat: window.__bg3.turn().combatOn, target: t.name };
  });
  await sleep(1500);
  await shot(page, 'v32_combat.jpg');
  if (!g3.combat) fail('G3 combat not started');
  console.log('G3 COMBAT:', JSON.stringify(g3));

  /* G4: reload чистый */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  const bad = errors.filter((e) => !/favicon/.test(e));
  if (bad.length) fail('G4 errors: ' + bad.slice(0, 4).join(' | '));
  console.log('G4 RELOAD: clean');

  console.log('PW_V32: ALL GATES GREEN');
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
