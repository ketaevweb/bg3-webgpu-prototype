/* run_pw.cjs — раннер E2E: поднимает dev-сервер, прогоняет указанные
   pw-скрипты последовательно, гасит сервер. Использование:
   node scripts/run_pw.cjs scripts/pw_v23.cjs [scripts/pw_v20.cjs …] */
const { startDev, stopDev } = require('./devsrv.cjs');
const { spawnSync } = require('child_process');

(async () => {
  const scripts = process.argv.slice(2);
  if (!scripts.length) { console.error('no scripts given'); process.exit(1); }
  const srv = await startDev();
  console.log('[runner] dev server up (pid ' + srv.pid + ')');
  const results = [];
  let anyFail = false;
  try {
    for (const s of scripts) {
      console.log('\n[runner] === ' + s + ' ===');
      const r = spawnSync('node', [s], { stdio: 'inherit', timeout: 540000 });
      const code = r.status === null ? 124 : r.status;
      results.push(s + ' → exit ' + code);
      if (code !== 0) { anyFail = true; break; }
    }
  } finally {
    stopDev(srv);
    console.log('\n[runner] dev server stopped');
  }
  console.log('[runner] RESULTS: ' + results.join(' | '));
  process.exit(anyFail ? 1 : 0);
})().catch(e => { console.error('RUNNER FATAL:', e.message); process.exit(1); });
