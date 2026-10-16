'use client';

import { useEffect, useRef } from 'react';
import '@/game/game.css';
import { HUD_HTML } from '@/game/hud';

/**
 * Тонкая React-обёртка над игровым движком.
 * - HUD инжектится синхронно (чистая разметка, SSR-safe);
 * - движок (three/webgpu) грузится динамически только на клиенте;
 * - bootGame() возвращает dispose() для чистого размонтирования.
 */
export default function GameClient() {
  const hostRef = useRef<HTMLDivElement>(null);
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
    <div
      ref={hostRef}
      style={{ position: 'fixed', inset: 0, background: '#0b0f0c' }}
      dangerouslySetInnerHTML={{ __html: HUD_HTML }}
    />
  );
}
