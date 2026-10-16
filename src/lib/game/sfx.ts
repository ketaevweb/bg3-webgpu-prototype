/** Синтезированные звуки на WebAudio — без внешних файлов. */

export type SfxName =
  | 'hit'
  | 'crit'
  | 'miss'
  | 'heal'
  | 'fire'
  | 'dice'
  | 'death'
  | 'coin'
  | 'level'
  | 'good'
  | 'bad'
  | 'click';

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = typeof localStorage !== 'undefined' && localStorage.getItem('bg3-muted') === '1';
} catch {
  /* приватный режим — просто играем со звуком по умолчанию */
}

export const isMuted = (): boolean => muted;

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem('bg3-muted', muted ? '1' : '0');
  } catch {
    /* ignore */
  }
  return muted;
}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  f0: number,
  f1: number,
  dur: number,
  type: OscillatorType = 'square',
  vol = 0.08,
  delay = 0
): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(f0, 1), t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

export function sfx(n: SfxName): void {
  if (muted) return;
  switch (n) {
    case 'hit':
      tone(190, 70, 0.13, 'square', 0.07);
      break;
    case 'crit':
      tone(240, 90, 0.18, 'sawtooth', 0.09);
      tone(700, 1400, 0.14, 'square', 0.05, 0.06);
      break;
    case 'miss':
      tone(320, 250, 0.08, 'sine', 0.045);
      break;
    case 'heal':
      tone(520, 880, 0.22, 'sine', 0.06);
      tone(660, 1100, 0.2, 'sine', 0.04, 0.08);
      break;
    case 'fire':
      tone(340, 90, 0.24, 'sawtooth', 0.06);
      break;
    case 'dice':
      tone(600, 320, 0.06, 'triangle', 0.05);
      tone(480, 260, 0.06, 'triangle', 0.05, 0.07);
      break;
    case 'death':
      tone(170, 45, 0.45, 'sawtooth', 0.08);
      break;
    case 'coin':
      tone(880, 880, 0.07, 'square', 0.05);
      tone(1180, 1180, 0.1, 'square', 0.05, 0.07);
      break;
    case 'level':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.14, 'triangle', 0.06, i * 0.11));
      break;
    case 'good':
      [523, 659, 784].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.06, i * 0.12));
      break;
    case 'bad':
      tone(280, 120, 0.5, 'sawtooth', 0.08);
      break;
    case 'click':
      tone(700, 700, 0.05, 'sine', 0.04);
      break;
  }
}
