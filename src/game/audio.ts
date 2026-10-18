/* ============================================================
 * BG3 Web Prototype v0.7 — процедурный звук (WebAudio, без ассетов)
 * Все эффекты синтезируются на лету: осцилляторы + шум + фильтры.
 * AudioContext создаётся лениво при первом жесте пользователя
 * (autoplay policy). Каждый вызов защищён try/catch.
 * ============================================================ */

import type { MapId } from './types';/* v1.9: сцены-мотивы (type-only — лист не нарушен) */

type WeaponLike = { range?: number; melee?: boolean; fire?: boolean };
type StingerKind = 'combat' | 'victory' | 'defeat' | 'wave';

class Bg3Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: AudioBufferSourceNode | null = null;
  private _muted = false;

  get muted() { return this._muted; }
  isMuted() { return this._muted; }
  setMuted(v: boolean) {
    this._muted = v;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(v ? 0 : 0.5, this.ctx.currentTime, 0.03);
    }
  }

  /** Создаёт/возобновляет AudioContext (вызывать на первый жест). */
  unlock() {
    try {
      if (typeof window === 'undefined') return;
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this._muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        this.startAmbient();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { /* звук недоступен — играем молча */ }
  }

  private now() { return this.ctx ? this.ctx.currentTime : 0; }

  /** Простой тон с огибающей. */
  private tone(o: {
    type?: OscillatorType; f0: number; f1?: number; dur: number; gain?: number;
    delay?: number; attack?: number; dest?: AudioNode;
  }) {
    if (!this.ctx || !this.master) return;
    const t0 = this.now() + (o.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
    const peak = o.gain ?? 0.2;
    const atk = o.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(o.dest ?? this.master);
    osc.start(t0); osc.stop(t0 + o.dur + 0.05);
  }

  private noiseBuf(dur: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Шумовой всплеск через фильтр. */
  private noise(o: {
    dur: number; gain?: number; type?: BiquadFilterType; f0: number; f1?: number;
    q?: number; delay?: number;
  }) {
    if (!this.ctx || !this.master) return;
    const t0 = this.now() + (o.delay ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf(o.dur);
    const flt = this.ctx.createBiquadFilter();
    flt.type = o.type ?? 'bandpass';
    flt.frequency.setValueAtTime(o.f0, t0);
    if (o.f1 !== undefined) flt.frequency.exponentialRampToValueAtTime(Math.max(10, o.f1), t0 + o.dur);
    flt.Q.value = o.q ?? 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(o.gain ?? 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t0);
  }

  /** Фоновый ветер: зацикленный шум через низкий фильтр + медленное дыхание. */
  private startAmbient() {
    if (!this.ctx || !this.master || this.ambient) return;
    const dur = 4;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(2, n, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < n; i++) { // brown noise
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 320;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 0.02;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(); lfo.start();
    this.ambient = src;
  }

  /* ---------------- игровые события ---------------- */

  swing(w?: WeaponLike) {
    if (w && w.range && w.range > 1 && !w.melee) {
      // выстрел/метание — короткий свист повыше
      this.noise({ dur: 0.16, f0: 2400, f1: 500, gain: 0.12, q: 2 });
      this.tone({ type: 'triangle', f0: 900, f1: 300, dur: 0.1, gain: 0.05 });
    } else {
      this.noise({ dur: 0.14, f0: 900, f1: 260, gain: 0.14, q: 1.4 });
    }
  }

  impact(w?: WeaponLike) {
    if (w && w.fire) {
      this.noise({ dur: 0.22, f0: 1800, f1: 300, gain: 0.16, q: 0.8 });
      this.tone({ type: 'sawtooth', f0: 140, f1: 60, dur: 0.16, gain: 0.1 });
    } else {
      // глухой удар + металл
      this.tone({ type: 'triangle', f0: 170, f1: 55, dur: 0.12, gain: 0.22 });
      this.noise({ dur: 0.07, f0: 3200, f1: 1200, gain: 0.09, q: 3 });
    }
  }

  crit() {
    // восходящий ризер + металлический звон
    this.tone({ type: 'sawtooth', f0: 180, f1: 900, dur: 0.34, gain: 0.12 });
    this.tone({ type: 'square', f0: 1250, f1: 950, dur: 0.3, gain: 0.07, delay: 0.1 });
    this.noise({ dur: 0.3, f0: 5000, f1: 900, gain: 0.1, q: 2, delay: 0.08 });
  }

  heal() {
    this.tone({ type: 'sine', f0: 523, dur: 0.16, gain: 0.12 });
    this.tone({ type: 'sine', f0: 784, dur: 0.22, gain: 0.12, delay: 0.09 });
    this.tone({ type: 'sine', f0: 1047, dur: 0.3, gain: 0.09, delay: 0.18 });
  }

  bless() {
    this.tone({ type: 'sine', f0: 392, dur: 0.5, gain: 0.08 });
    this.tone({ type: 'sine', f0: 494, dur: 0.5, gain: 0.08, delay: 0.04 });
    this.tone({ type: 'sine', f0: 587, dur: 0.55, gain: 0.08, delay: 0.08 });
  }

  poison() {
    this.tone({ type: 'sine', f0: 220, f1: 130, dur: 0.3, gain: 0.1 });
    this.noise({ dur: 0.28, f0: 600, f1: 200, gain: 0.07, q: 5 });
  }

  ignite() {
    this.noise({ dur: 0.32, f0: 1400, f1: 400, gain: 0.13, q: 0.7 });
  }

  death() {
    this.tone({ type: 'triangle', f0: 130, f1: 40, dur: 0.4, gain: 0.2 });
    this.noise({ dur: 0.25, f0: 700, f1: 120, gain: 0.1, q: 0.8 });
  }

  explosion() {
    this.noise({ dur: 0.65, f0: 2800, f1: 90, gain: 0.5, q: 0.4, type: 'lowpass' });
    this.tone({ type: 'sine', f0: 95, f1: 28, dur: 0.55, gain: 0.4 });
    this.noise({ dur: 0.4, f0: 4500, f1: 700, gain: 0.14, q: 2, delay: 0.03 });
  }

  fireCast() {
    this.noise({ dur: 0.4, f0: 300, f1: 2600, gain: 0.13, q: 1.2 });
    this.tone({ type: 'sawtooth', f0: 120, f1: 420, dur: 0.35, gain: 0.07 });
  }

  /** Переход между картами: низкий свип-портал (v0.8). */
  portal() {
    this.tone({ type: 'sine', f0: 420, f1: 62, dur: 0.9, gain: 0.16 });
    this.noise({ dur: 0.9, f0: 700, f1: 90, gain: 0.13, q: 0.6, type: 'lowpass' });
    this.tone({ type: 'sine', f0: 58, f1: 170, dur: 0.7, gain: 0.1, delay: 0.4 });
  }

  /** Стрёкот костей / некромантия (v0.8). */
  bones() {
    this.noise({ dur: 0.28, f0: 2300, f1: 800, gain: 0.11, q: 3 });
    this.noise({ dur: 0.2, f0: 1700, f1: 600, gain: 0.09, q: 3, delay: 0.15 });
    this.tone({ type: 'sawtooth', f0: 72, f1: 44, dur: 0.55, gain: 0.12, attack: 0.05 });
  }

  /** Костяной шквал — AoE босса (v0.8). */
  nova() {
    this.noise({ dur: 0.45, f0: 1000, f1: 180, gain: 0.2, q: 0.9 });
    this.tone({ type: 'square', f0: 170, f1: 55, dur: 0.3, gain: 0.12 });
  }

  gold() {
    this.tone({ type: 'sine', f0: 1320, dur: 0.09, gain: 0.1 });
    this.tone({ type: 'sine', f0: 1760, dur: 0.14, gain: 0.1, delay: 0.06 });
  }

  xp() {
    this.tone({ type: 'triangle', f0: 660, f1: 880, dur: 0.12, gain: 0.08 });
  }

  levelUp() {
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.22, gain: 0.13, delay: i * 0.11 }));
    this.tone({ type: 'sine', f0: 1568, dur: 0.5, gain: 0.09, delay: 0.46 });
  }

  dialog() {
    this.tone({ type: 'square', f0: 320, f1: 260, dur: 0.07, gain: 0.05 });
  }

  ui() {
    this.tone({ type: 'square', f0: 900, dur: 0.035, gain: 0.045 });
  }

  /* v1.9: короткий мотив прибытия на карту — по 2–3 ноты на локацию,
     играется после сборки мира (buildMap). Тихий, фактурный стаер. */
  sceneMotif(id: MapId) {
    if (id === 'forest') {
      /* тракт: пасторальный мажор */
      this.tone({ type: 'triangle', f0: 392, dur: 0.3, gain: 0.07 });
      this.tone({ type: 'triangle', f0: 494, dur: 0.34, gain: 0.07, delay: 0.16 });
      this.tone({ type: 'sine', f0: 587, dur: 0.5, gain: 0.06, delay: 0.32 });
    } else if (id === 'crypt') {
      /* крипта: низкая секунда и стрёкот костей */
      this.tone({ type: 'sawtooth', f0: 98, dur: 0.7, gain: 0.1, attack: 0.06 });
      this.tone({ type: 'sawtooth', f0: 104, f1: 92, dur: 0.6, gain: 0.08, delay: 0.3, attack: 0.06 });
      this.noise({ dur: 0.24, f0: 2300, f1: 800, gain: 0.06, q: 3, delay: 0.15 });
    } else if (id === 'swamp') {
      /* болота: чавкающий спуск и гулкий бурдон */
      this.tone({ type: 'sine', f0: 160, f1: 78, dur: 0.6, gain: 0.1 });
      this.noise({ dur: 0.34, f0: 420, f1: 140, gain: 0.07, q: 2.4, delay: 0.1 });
      this.tone({ type: 'sine', f0: 65, dur: 0.8, gain: 0.08, delay: 0.36, attack: 0.08 });
    } else if (id === 'giants') {
      /* перевал: рог в квинту */
      this.tone({ type: 'sawtooth', f0: 147, dur: 0.5, gain: 0.09, attack: 0.05 });
      this.tone({ type: 'sawtooth', f0: 220, dur: 0.62, gain: 0.09, delay: 0.24, attack: 0.05 });
      this.noise({ dur: 0.5, f0: 500, f1: 120, gain: 0.05, q: 0.8, type: 'lowpass' });
    } else {
      /* цитадель: изумрудный мотив — тритон вниз, хор глубин */
      this.tone({ type: 'sine', f0: 233, dur: 0.55, gain: 0.09, attack: 0.05 });
      this.tone({ type: 'sine', f0: 165, dur: 0.7, gain: 0.09, delay: 0.28, attack: 0.05 });
      this.tone({ type: 'triangle', f0: 330, f1: 155, dur: 0.8, gain: 0.05, delay: 0.5 });
    }
  }

  stinger(kind: StingerKind) {
    if (kind === 'wave') {/* v1.9: арена — короткий рог волны */
      this.tone({ type: 'sawtooth', f0: 174, dur: 0.4, gain: 0.12, attack: 0.03 });
      this.tone({ type: 'sawtooth', f0: 261, dur: 0.5, gain: 0.1, delay: 0.18, attack: 0.03 });
      return;
    }
    if (kind === 'combat') {
      this.tone({ type: 'sawtooth', f0: 110, dur: 0.7, gain: 0.14, attack: 0.05 });
      this.tone({ type: 'sawtooth', f0: 165, dur: 0.7, gain: 0.1, attack: 0.05 });
      this.tone({ type: 'sawtooth', f0: 220, f1: 210, dur: 0.5, gain: 0.08, delay: 0.25 });
    } else if (kind === 'victory') {
      const seq = [392, 523, 659, 784];
      seq.forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.26, gain: 0.12, delay: i * 0.13 }));
      this.tone({ type: 'sine', f0: 1047, dur: 0.6, gain: 0.1, delay: 0.55 });
    } else {
      const seq = [392, 330, 262, 196];
      seq.forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.34, gain: 0.12, delay: i * 0.17 }));
    }
  }
}

export const sfx = new Bg3Audio();
