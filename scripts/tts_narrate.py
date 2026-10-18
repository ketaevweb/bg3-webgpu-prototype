#!/usr/bin/env python3
"""Озвучка полного отчёта по проекту «Врата Бальдура» (piper-tts, русский голос ruslan)."""
import subprocess, wave, os, sys, re

BASE = "/home/z/my-project"
PIPER = "/home/z/.venv/bin/piper"
MODEL = f"{BASE}/scripts/piper/ru_RU-ruslan-medium.onnx"
TXT = f"{BASE}/scripts/narration_ru.txt"
CHUNKS = f"{BASE}/scripts/tts_chunks"
FINAL_WAV = f"{BASE}/scripts/tts_chunks/final_narration.wav"
FINAL_MP3 = f"{BASE}/download/bg3_polny_otchet_ru.mp3"

os.makedirs(CHUNKS, exist_ok=True)
os.makedirs(os.path.dirname(FINAL_MP3), exist_ok=True)

def split_chunks(text, limit=900):
    """Разбить абзац на куски <=limit по границам предложений."""
    sentences = re.findall(r"[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$", text)
    chunks, cur = [], ""
    for s in sentences:
        if cur and len(cur) + len(s) > limit:
            chunks.append(cur.strip())
            cur = s
        else:
            cur += s
    if cur.strip():
        chunks.append(cur.strip())
    return chunks

def synth(text, out_wav):
    """piper: stdin -> wav (22050 Hz, mono, 16 bit)."""
    p = subprocess.run(
        [PIPER, "-m", MODEL, "-f", out_wav, "--sentence-silence", "0.25"],
        input=text.encode("utf-8"), capture_output=True)
    if p.returncode != 0 or not os.path.exists(out_wav) or os.path.getsize(out_wav) < 1000:
        print(f"PIPER FAIL: {p.stderr.decode()[:300]}", file=sys.stderr)
        raise RuntimeError(f"piper failed for chunk: {text[:60]}...")

def main():
    raw = open(TXT, encoding="utf-8").read()
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", raw) if p.strip()]
    print(f"Абзацев: {len(paragraphs)}")

    # 1) Синтез всех кусков
    jobs = []  # (kind, wav_path) kind: 'speech' | 'pause'
    n = 0
    for pi, para in enumerate(paragraphs):
        for ci, chunk in enumerate(split_chunks(para)):
            n += 1
            wav = f"{CHUNKS}/narr_{n:03d}.wav"
            if not (os.path.exists(wav) and os.path.getsize(wav) > 1000):
                synth(chunk, wav)
            print(f"  кусок {n:03d}: {len(chunk)} зн. -> {os.path.basename(wav)}")
            jobs.append(("speech", wav))
            if ci < len(split_chunks(para)) - 1:
                jobs.append(("gap", None))
        jobs.append(("para", None))
    if jobs and jobs[-1][0] == "para":
        jobs.pop()

    # 2) Сборка с паузами
    with wave.open(jobs[0][1], "rb") as w0:
        params = w0.getparams()
    fr, sw, ch = params.framerate, params.sampwidth, params.nchannels
    silence_gap = b"\x00" * int(fr * 0.15) * sw * ch   # между кусками абзаца
    silence_para = b"\x00" * int(fr * 0.55) * sw * ch  # между абзацами

    total = 0
    with wave.open(FINAL_WAV, "wb") as out:
        out.setnchannels(ch); out.setsampwidth(sw); out.setframerate(fr)
        for i, (kind, path) in enumerate(jobs):
            if kind in ("gap", "para"):
                out.writeframes(silence_para if kind == "para" else silence_gap)
                continue
            with wave.open(path, "rb") as w:
                assert (w.getframerate(), w.getsampwidth(), w.getnchannels()) == (fr, sw, ch), path
                frames = w.readframes(w.getnframes())
            out.writeframes(frames)
            total += len(frames)

    dur = total / (fr * sw * ch)
    print(f"WAV: {FINAL_WAV}  {dur:.1f} c  {os.path.getsize(FINAL_WAV)/1e6:.1f} МБ")

    # 3) Финальный MP3
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", FINAL_WAV,
                    "-codec:a", "libmp3lame", "-b:a", "96k", FINAL_MP3], check=True)
    print(f"MP3: {FINAL_MP3}  {os.path.getsize(FINAL_MP3)/1e6:.1f} МБ")

    # 4) Текст-компаньон в download
    with open(f"{BASE}/download/bg3_polny_otchet_ru.txt", "w", encoding="utf-8") as f:
        f.write(raw)
    print("TXT: download/bg3_polny_otchet_ru.txt")

if __name__ == "__main__":
    main()
