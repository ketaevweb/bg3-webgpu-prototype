/* ================= API /api/tts (v2.5 «Голоса Глубин») =================
   Динамическая озвучка строк, которых нет в офлайн-манифесте:
   реплика призрака с реальным золотом казны, номера бесконечных волн,
   уровни — всё, что зависит от состояния. Синтез piper (scripts/piper,
   модели в voicecfg.VOICES) + ffmpeg-обработка тона; результат кэшируется
   на диске (.voicecache/<voice>-<md5>.mp3) — повторные запросы мгновенны.
   GET /api/tts?v=<voiceId>&t=<текст> → audio/mpeg (или 400/503, no-throw
   на клиенте — голос просто не прозвучит). Только бэкенд: child_process. */
import { NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { VOICES, ttsNormalize } from "@/game/voicecfg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_DIR = path.join(process.cwd(), ".voicecache");

function fail(status: number, msg: string) {
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const v = url.searchParams.get("v") || "";
  const raw = url.searchParams.get("t") || "";
  const def = VOICES[v];
  if (!def) return fail(400, "unknown voice");
  const text = ttsNormalize(raw).slice(0, 400);
  if (!text) return fail(400, "empty text");

  const hash = createHash("md5").update(v + "|" + text).digest("hex");
  const outFile = path.join(CACHE_DIR, v + "-" + hash + ".mp3");
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 1000) {
      return new NextResponse(fs.readFileSync(outFile) as unknown as BodyInit, {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" },
      });
    }
    /* 1) piper: текст → wav (22050 моно) */
    const piper = process.env.PIPER_BIN || "/home/z/.venv/bin/piper";
    const model = path.join(process.cwd(), "scripts", "piper", "ru_RU-" + def.base + "-medium.onnx");
    if (!fs.existsSync(model)) return fail(503, "model missing");
    const tmpWav = path.join(os.tmpdir(), "bg3v_" + hash + ".wav");
    const p = spawnSync(piper, ["-m", model, "-f", tmpWav, "--sentence-silence", "0.18"], {
      input: text, timeout: 60000,
    });
    if (p.status !== 0 || !fs.existsSync(tmpWav) || fs.statSync(tmpWav).size < 1000) {
      return fail(503, "piper failed");
    }
    /* 2) ffmpeg: высота/эхо/срез/громкость по характеру голоса → mp3 */
    const pitch = def.pitch ?? 0;
    const rate = Math.pow(2, pitch / 12);
    const chain: string[] = [];
    if (rate !== 1) chain.push("asetrate=22050*" + rate.toFixed(5), "aresample=22050", "atempo=" + (1 / rate).toFixed(5));
    if (def.lowpass) chain.push("lowpass=f=" + def.lowpass);
    if (def.echo) chain.push("aecho=" + def.echo);
    chain.push("volume=" + (def.gain ?? 0) + "dB");
    const f = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", tmpWav,
      "-af", chain.join(","), "-codec:a", "libmp3lame", "-b:a", "96k", outFile],
      { timeout: 60000 });
    try { fs.unlinkSync(tmpWav); } catch {}
    if (f.status !== 0 || !fs.existsSync(outFile) || fs.statSync(outFile).size < 1000) {
      return fail(503, "ffmpeg failed");
    }
    return new NextResponse(fs.readFileSync(outFile) as unknown as BodyInit, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-cache" },
    });
  } catch {
    return fail(503, "tts unavailable");
  }
}
