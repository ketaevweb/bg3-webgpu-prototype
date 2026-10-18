/* devsrv.cjs — запуск/остановка dev-сервера внутри E2E-прогона.
   В этой среде фоновые процессы умирают между вызовами шелла, поэтому
   сервер живёт ровно столько, сколько жив раннер (spawn + process group). */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

function startDev(logPath) {
  const out = fs.openSync(logPath || 'devsrv.log', 'a');
  const child = spawn('npm', ['run', 'dev'], { cwd: process.cwd(), detached: true, stdio: ['ignore', out, out] });
  const t0 = Date.now();
  return new Promise((res, rej) => {
    const poll = () => {
      http.get('http://localhost:3000/api/scores', r => { r.resume(); if (r.statusCode === 200) { res(child); return; } retry(); })
        .on('error', retry);
    };
    const retry = () => { if (Date.now() - t0 > 180000) { rej(new Error('dev server timeout')); return; } setTimeout(poll, 1500); };
    poll();
  });
}
function stopDev(child) {
  if (!child || !child.pid) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 2500);
}
module.exports = { startDev, stopDev };
