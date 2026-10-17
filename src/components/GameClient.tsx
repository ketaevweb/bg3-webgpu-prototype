'use client';

import { useEffect, useRef } from 'react';
import '@/game/game.css';
import Hud from '@/components/hud/Hud';

/**
 * Тонкая React-обёртка над игровым движком.
 * - императивные слои: #scene (канвас), #ov (HP-полоски/флоат-текст
 *   покадрово), #fade (переход карт), #slowfx (виньетка слоу-мо);
 * - весь остальной HUD — React-компоненты (src/components/hud/*) на
 *   zustand-сторе ui/store.ts (Фаза 6 рефакторинга);
 * - движок (three/webgpu) грузится динамически только на клиенте;
 * - bootGame() возвращает dispose() для чистого размонтирования.
 */
export default function GameClient() {
  const disposeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { bootGame } = await import('@/game/engine');
        if (cancelled) return;
        disposeRef.current = bootGame();
      } catch (err) {
        console.error('[bg3] boot failed:', err);
      }
    })();
    return () => {
      cancelled = true;
      disposeRef.current?.();
      disposeRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0f0c' }}>
      {/* императивные слои (реестр UI — src/game/hud.ts) */}
      <div id="scene" />
      <div id="ov" />
      {/* React-HUD (zustand-стор) */}
      <Hud />
      {/* полноэкранные эффекты поверх HUD */}
      <div id="fade" />
      <div id="slowfx" />
    </div>
  );
}
