/* Скриншот контактного листа: node contact_shot.mjs rivals|heroes */
import { spawn } from 'child_process';
import { chromium } from 'playwright';

const dir = process.argv[2] ?? 'rivals';
const files = (process.argv[3] ?? '').split(',').filter(Boolean).map((f) => f.endsWith('.glb') ? f : f + '.glb').join(',');
const out = `/home/z/my-project/upload/e2e/contact_${dir}.png`;

/* статический сервер на корне проекта */
const srv = spawn('python3', ['-m', 'http.server', '8077', '-d', '/home/z/my-project'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 920 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[pg]', m.text().slice(0, 160)); });
  await page.goto(`http://localhost:8077/scripts/contact/index.html?dir=${dir}&files=${files}`);
  await page.waitForFunction(() => document.title === 'READY', null, { timeout: 30000 });
  await page.waitForTimeout(1500);/* пара секунд idle-анимации */
  await page.screenshot({ path: out });
  console.log('SHOT', out);
  await browser.close();
} finally {
  srv.kill();
}
