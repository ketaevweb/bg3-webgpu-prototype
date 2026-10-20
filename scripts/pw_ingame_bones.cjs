/* Внутриигровая проба: реальный юнит-боец — миксер, действия, мировые позы костей. */
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(() => {
    try { localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'mid', res: '100', fps: '30', voice: false, vol: '0' })); } catch {}
  });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (/warn|error|\[bg3\]/i.test(m.type() + m.text())) logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__bg3.animStats().rigs.rigs >= 4, null, { timeout: 45000 });
  await sleep(2000);
  const rep = await page.evaluate(() => {
    const THREE = window.__bg3.THREE || null;
    const out = { hasTHREE: !!THREE };
    const u = window.__bg3.units.find((x) => x.cls === 'fighter');
    if (!u) return { err: 'no fighter' };
    out.rigUrl = u._rigUrl;
    out.gltfRig = u._gltfRig;
    out.cur = u._currentAnim;
    const mx = u._mixer;
    if (mx) {
      out.mixerTime = +mx.time.toFixed(2);
      out.timeScale = mx.timeScale;
      out.actions = Object.entries(u._actions).map(([k, a]) => `${k}:${a.isRunning() ? 'run' : 'off'}/w${+a.getEffectiveWeight().toFixed(2)}/t${+a.time.toFixed(2)}/${a.getClip().duration.toFixed(2)}s`);
      // корень модели
      const root = mx.getRoot();
      out.rootType = root.type;
      // измеряем кости
      const get = (n) => root.getObjectByName(n);
      const sL = get('Shoulder_L'), hL = get('Hand_L'), eL = get('Elbow_L');
      const V = (o) => { o.updateWorldMatrix(true, false); const e = o.matrixWorld.elements; return { x: e[12], y: e[13], z: e[14] }; };
      if (sL && hL) {
        root.updateMatrixWorld(true);
        const a = V(sL), b = V(hL);
        out.dyHandL = +(b.y - a.y).toFixed(3);
        out.dxHandL = +(b.x - a.x).toFixed(3);
        out.dzHandL = +(b.z - a.z).toFixed(3);
      } else out.bones = { sL: !!sL, hL: !!hL, eL: !!eL };
      // шпарим: вручную mixer.update и снова меряем
      if (sL && hL) {
        mx.update(0.5);
        root.updateMatrixWorld(true);
        const a2 = V(sL), b2 = V(hL);
        out.afterUpdate = { dy: +(b2.y - a2.y).toFixed(3), dx: +(b2.x - a2.x).toFixed(3), dz: +(b2.z - a2.z).toFixed(3) };
      }
    }
    // гоблин для сравнения
    const g = window.__bg3.units.find((x) => x.cls === 'goblin' && x._mixer);
    if (g) {
      const root = g._mixer.getRoot();
      const get = (n) => root.getObjectByName(n);
      const sL = get('Shoulder_L'), hL = get('Hand_L');
      if (sL && hL) {
        root.updateMatrixWorld(true);
        
        const V2=(o)=>{o.updateWorldMatrix(true,false);const e=o.matrixWorld.elements;return{y:e[13]};}; const v1=V2(sL), v2=V2(hL);
        out.goblinDyHandL = +(v2.y - v1.y).toFixed(3);
        out.goblinCur = g._currentAnim;
      }
    }
    return out;
  });
  console.log(JSON.stringify(rep, null, 1));
  console.log('CONSOLE:', logs.slice(0, 10));
  await browser.close();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
