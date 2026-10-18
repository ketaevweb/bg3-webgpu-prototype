/* gen_voices.cjs — ПРОБЫ реплик для озвучки (v2.5 «Голоса Глубины»).
   Поднимает dev-сервер, грузит игру в headless-chromium и через
   __bg3.dlgProbe/tutSteps/QUESTS/season() снимает ВСЕ тексты реплик
   1:1 с игровыми DLGS (без парсинга исходников и без дублей).
   Результат: scripts/voice_lines.json — {rawId, v(oice), t(ext)};
   ключи 'bannerraw:<текст>' синтезатор переводит в 'bann.<слаг>'.
   Синтез — scripts/voicesynth.ts (bun): scripts/voice_lines.json →
   public/voices/*.mp3 + manifest.json. Запуск: node scripts/gen_voices.cjs */
const { startDev, stopDev } = require('./devsrv.cjs');
const { chromium } = require('playwright');
const { spawnSync } = require('child_process');
const fs = require('fs');

const OUT = __dirname + '/voice_lines.json';

/* узлы DLGS по НПС (id совпадают с условиями в dialog.ts) */
const SPEC = {
  patrol: ['start', 'scared', 'pass', 'fight'],
  boss: ['start', 'cow', 'fight'],
  damrock: ['start', 'story', 'cratedone', 'discok', 'discfail', 'cryptinfo', 'swampinfo', 'giantsinfo', 'citadelinfo'],
  ilva: ['start', 'bossinfo'],
  kaya: ['start', 'rumor'],
  necro: ['start', 'brave', 'fight'],
  swampboss: ['start', 'brave', 'fight'],
  olkha: ['start', 'ulva'],
  haldir: ['start', 'haldeep'],
  /* ghost.start пропущен: текст с реальным золотом — динамика /api/tts */
  giantboss: ['start', 'scared', 'fight'],
  citadelboss: ['start', 'waver', 'fight'],
};

/* статические баннеры (bigBanner без цифр — слаги строит синтезатор) */
const BANNERS = [
  'ИСПЫТАНИЕ ГЛУБИН', 'БЕСКОНЕЧНОЕ ИСПЫТАНИЕ', 'ТЕНЬ ОТРЯДА', 'БЕЗДНА ЗОВЁТ',
  'ИСПЫТАНИЕ ПРОЙДЕНО!', 'СТЕЛА РЕКОРДОВ', 'СЕКИРА ПЕРЕВАЛА', 'ЗНАМЯ ДОЗОРА',
  'ХАЛЬДИР ПРИСОЕДИНИЛСЯ', 'ОЛЬХА ПРИСОЕДИНИЛАСЬ', 'ИЛВА ПРИСОЕДИНИЛАСЬ',
  'КАЯ ПРИСОЕДИНИЛАСЬ', 'ПОБЕДА!', 'ИГРА ЗАГРУЖЕНА', 'ВХОРИЛ КОСТЕПЁР',
  'ФАЗА 2: ТРЯСИНА ПРОСЫПАЕТСЯ', 'ФАЗА 2: ГОРЫ ДРОЖАТ',
  'ФАЗА 2: ГЛАС ГЛУБИН', 'ФАЗА 2: ПОДЪЁМ МЁРТВЫХ',
];
/* динамические по цифрам — известные форматы (слаги стабильны) */
const BANNER_NUM = [
  ...[1, 2, 3, 4, 5].map((i) => 'ВОЛНА ' + i + ' ИЗ 5'),
  ...[2, 3].map((i) => 'УРОВЕНЬ ' + i + '!'),
];

/* реплика опции → что произносить: цитата в «» — голос отряда,
   (ремарка) или механика без цитаты — рассказчик */
function optSpeech(t) {
  const body = t.replace(/^(\[[^\]]*\]\s*)+/, '').trim();
  const q = body.match(/«([^»]+)»/);
  if (q) return { v: 'hero', t: q[1] };
  const paren = body.match(/^\((.*)\)$/);
  if (paren) return { v: 'narrator', t: paren[1] };
  return body ? { v: 'narrator', t: body } : null;
}

(async () => {
  const cfg = JSON.parse(spawnSync('bun', ['-e',
    "import {VOICES,NPC_VOICE} from '/home/z/my-project/src/game/voicecfg.ts';console.log(JSON.stringify({VOICES,NPC_VOICE}))",
  ], { encoding: 'utf8' }).stdout);
  if (!cfg.VOICES || !cfg.NPC_VOICE) { console.error('FAIL: voicecfg dump'); process.exit(1); }

  const lines = {};
  const put = (id, v, t) => { if (t && t.trim()) lines[id] = { v, t: t.trim() }; };

  const srv = await startDev();
  console.log('[gen] dev server up (pid ' + srv.pid + ')');
  try {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('bg3w_gfx_v1', JSON.stringify({ shadows: 'off', bloom: false, glow: false, particles: 'low', res: '50', fps: '30', voice: false }));
      } catch {}
    });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!window.__bg3, null, { timeout: 60000 });
    await page.waitForTimeout(9000);

    /* реплики НПС + опции (RAW-индексы опций — ключи стабильны) */
    for (const [npc, nodes] of Object.entries(SPEC)) {
      const v = cfg.NPC_VOICE[npc];
      if (!v) { console.error('FAIL: no voice for npc ' + npc); process.exit(1); }
      for (const id of nodes) {
        const n = await page.evaluate(([np, nid]) => window.__bg3.dlgProbe(np, nid), [npc, id]);
        if (!n) { console.error('WARN: probe null ' + npc + '.' + id); continue; }
        put('dlg.' + npc + '.' + id, v, n.text);
        n.opts.forEach((t, i) => {
          const sp = optSpeech(t);
          if (sp) put('dlg.' + npc + '.' + id + '.o' + i, sp.v, sp.t);
        });
      }
    }

    /* наставник */
    const tut = await page.evaluate(() => window.__bg3.tutSteps());
    tut.forEach((s) => put('tut.' + s.id, 'narrator', s.title + '. ' + s.text));

    /* сезоны (5) — через форс, потом назад к реальной неделе */
    const seasons = await page.evaluate(() => {
      const out = [];
      for (let i = 0; i < 5; i++) {
        window.__bg3.forceSeason(i);
        const s = window.__bg3.season();
        out.push({ idx: s.idx, name: s.name, desc: s.desc });
      }
      window.__bg3.forceSeason(null);
      return out;
    });
    seasons.forEach((s) => put('season.' + s.idx, 'narrator',
      'Сезон глубины: ' + s.name + '. ' + s.desc + '.'));

    /* задания — имена из QUESTS (данные статики) */
    const quests = await page.evaluate(() => {
      const out = [];
      for (const [id, q] of Object.entries(window.__bg3.QUESTS)) out.push({ id, name: q.name });
      return out;
    });
    quests.forEach((q) => {
      put('quest.' + q.id + '.start', 'narrator', 'Новое задание: ' + q.name + '.');
      put('quest.' + q.id + '.done', 'narrator', 'Задание выполнено: ' + q.name + '.');
    });

    /* баннеры */
    for (const t of [...BANNERS, ...BANNER_NUM]) put('bannerraw:' + t, 'narrator', t.toLowerCase());

    await browser.close();
  } finally {
    stopDev(srv);
    console.log('[gen] dev server stopped');
  }

  fs.writeFileSync(OUT, JSON.stringify(lines, null, 1));
  const counts = {};
  for (const l of Object.values(lines)) counts[l.v] = (counts[l.v] || 0) + 1;
  console.log('[gen] lines: ' + Object.keys(lines).length + ' → ' + OUT);
  console.log('[gen] by voice: ' + JSON.stringify(counts));
})().catch((e) => { console.error('GEN FATAL:', e.message); process.exit(1); });
