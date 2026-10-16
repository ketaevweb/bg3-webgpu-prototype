/* ============================================================
 * BG3 Web Prototype v0.7 — слоумо-криты (time scale + виньетка)
 * scale — глобальный множитель dt: твины движка (выпады, взрывы,
 * полёт снарядов) замедляются автоматически. setTimeout-паузы
 * между ходами не масштабируются — темп боя сохраняется.
 * Виньетка рисуется div#slowfx (стили в game.css).
 * ============================================================ */

type Doc = Document | null;

function overlay(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const d: Doc = document;
  return d ? d.getElementById('slowfx') : null;
}

export const slowmo = {
  scale: 1,
  _t: 0,
  _dur: 0,
  _min: 1,

  /** Запуск слоумо: dur — общая длительность (с), minScale — минимальный масштаб. */
  trigger(dur: number, minScale: number) {
    // более сильный эффект перекрывает слабый
    if (this._t > 0 && this._min <= minScale) return;
    this._t = dur;
    this._dur = dur;
    this._min = minScale;
  },

  update(rdt: number) {
    if (this._t <= 0) {
      if (this.scale !== 1) this.scale = 1;
      const el = overlay();
      if (el && el.style.opacity !== '0') el.style.opacity = '0';
      return;
    }
    this._t = Math.max(0, this._t - rdt);
    const phase = this._dur > 0 ? 1 - this._t / this._dur : 1;
    // быстрое погружение, медленное восстановление: scale = min + (1-min)*phase²
    this.scale = this._min + (1 - this._min) * phase * phase;
    const el = overlay();
    if (el) el.style.opacity = String(Math.min(0.65, (1 - this.scale) / (1 - this._min || 1) * 0.65));
  },

  reset() {
    this._t = 0; this._dur = 0; this._min = 1; this.scale = 1;
    const el = overlay();
    if (el) el.style.opacity = '0';
  },
};
