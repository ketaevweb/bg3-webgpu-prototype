/* ================= HUD (Фаза 6 рефакторинга) =================
   HUD_HTML и панельный DOM убраны — интерфейс рендерят React-компоненты
   (src/components/hud/*) из zustand-стора ui/store.ts. Здесь остались
   только ИМПЕРАТИВНЫЕ слои, которым React противопоказан:
   - #scene — канвас-хост (render/renderer.ts, один раз при boot);
   - #ov    — покадровые HP-полоски над юнитами и всплывающий текст
              (ui/overlays.ts, проекция 3D→экран каждый кадр);
   - #fade  — фейд перехода между картами (world/maps.ts);
   - #slowfx— виньетка слоу-мо (slowmo.ts, getElementById).
   game.css не изменён: позиционирование этих слоёв завязано на id. */
export const UI={
  scene:'#scene',ov:'#ov',fade:'#fade',slowfx:'#slowfx',
} as const;

export type UiId=typeof UI[keyof typeof UI];
