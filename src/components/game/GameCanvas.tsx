'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEngine } from '@/lib/game/engine';
import type { BarrelInfo, HoverInfo, LogKind, Snapshot } from '@/lib/game/types';
import { isMuted, toggleMute } from '@/lib/game/sfx';

const LOG_COLORS: Record<LogKind, string> = {
  info: 'text-[#b0aa92]',
  roll: 'text-[#cbbf8e]',
  hit: 'text-[#ffb04d]',
  crit: 'text-[#ff6a50] font-bold',
  miss: 'text-[#8a8676]',
  death: 'text-[#ff8a7a] font-semibold',
  heal: 'text-[#8ed89a]',
  story: 'text-[#e2b86b]',
  status: 'text-[#c88fd8]',
  fire: 'text-[#ff9a5a]',
};

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-[#6b5a2e]/80 bg-[#141008]/90 shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

function HpBar({ hp, maxHp, foe }: { hp: number; maxHp: number; foe?: boolean }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-sm border border-black/60 bg-[#33120e]">
      <div
        className={`h-full transition-all duration-300 ${foe ? 'bg-[#c0392b]' : 'bg-[#46b05e]'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const SYS_BTN =
  'flex h-9 w-9 items-center justify-center rounded border border-[#6b5a2e]/70 bg-[#141008]/90 text-sm transition-colors hover:border-[#e2b86b] hover:bg-[#2a2110]';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [muted, setMuted] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; info: HoverInfo | null; barrel: BarrelInfo | null } | null>(null);
  const hoverRef = useRef({ x: -99, y: -99 });

  const onHoverMove = useCallback((e: React.PointerEvent) => {
    const eng = engineRef.current;
    if (!eng) return;
    const h = hoverRef.current;
    if (Math.abs(e.clientX - h.x) < 3 && Math.abs(e.clientY - h.y) < 3) return;
    hoverRef.current = { x: e.clientX, y: e.clientY };
    const id = eng.hoverActorAt(e.clientX, e.clientY);
    if (id) {
      setHover({ x: e.clientX, y: e.clientY, info: eng.inspect(id), barrel: null });
      return;
    }
    const barrel = eng.hoverBarrelAt(e.clientX, e.clientY);
    setHover({ x: e.clientX, y: e.clientY, info: null, barrel });
  }, []);

  useEffect(() => setMuted(isMuted()), []);

  useEffect(() => {
    let disposed = false;
    let engine: GameEngine | null = null;
    let cancelled = false;
    import('@/lib/game/engine')
      .then(({ GameEngine }) =>
        GameEngine.create(containerRef.current!, (s) => {
          if (!disposed) setSnap(s);
        })
      )
      .then((g) => {
        if (cancelled) {
          g.dispose();
          return;
        }
        engine = g;
        engineRef.current = g;
      })
      .catch((err) => console.error('Engine init failed:', err));
    return () => {
      cancelled = true;
      disposed = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, [gameKey]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [snap?.log.length, snap?.phase]);

  const restart = useCallback(() => setGameKey((k) => k + 1), []);
  const eng = engineRef.current;

  if (!snap) {
    return (
      <div className="relative h-full w-full select-none overflow-hidden bg-[#0b0e09] font-serif">
        <div ref={containerRef} className="absolute inset-0" key={gameKey} />
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0b0e09]">
          <div className="text-center text-[#e2b86b]">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#6b5a2e] border-t-[#e2b86b]" />
            <p className="tracking-widest">Пробуждаем тадпола...</p>
          </div>
        </div>
      </div>
    );
  }

  const actors = snap.actors;
  const allies = actors.filter((a) => a.mode === 'ally');
  const active = actors.find((a) => a.id === snap.activeId) ?? null;
  const combat = snap.phase === 'combat';
  const myTurn = combat && active?.mode === 'ally' && active.alive;
  const isWebGPU = snap.backend === 'WebGPU';
  const party = snap.party;
  const healMode = myTurn && snap.actionMode === 'heal';
  const blessMode = myTurn && snap.actionMode === 'bless';
  const bashMode = myTurn && snap.actionMode === 'bash';
  const spellMode = myTurn && snap.actionMode === 'spell';

  const onAllyCardClick = (id: string, wounded: boolean) => {
    if (!eng) return;
    if (healMode && wounded) eng.useHeal(id);
    else if (blessMode) eng.useBless(id);
    else eng.select(id);
  };

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#0b0e09] font-serif">
      {/* 3D-сцена */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        key={gameKey}
        onPointerMove={onHoverMove}
        onPointerLeave={() => setHover(null)}
      />

      {/* Тултип наведения: характеристики, статусы, шанс попадания, бочки */}
      {hover?.info && (
        <div
          className="pointer-events-none fixed z-40 w-[252px] rounded-lg border border-[#6b5a2e]/80 bg-[#141008]/95 p-2.5 shadow-[0_6px_28px_rgba(0,0,0,0.7)] backdrop-blur-sm"
          style={{
            left: Math.min(hover.x + 14, window.innerWidth - 266),
            top: Math.min(hover.y + 14, window.innerHeight - 208),
          }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-xs font-semibold ${
                hover.info.mode === 'foe'
                  ? 'text-[#ffb3a3]'
                  : hover.info.mode === 'ally'
                    ? 'text-[#ffe3a0]'
                    : 'text-[#d8cfa8]'
              }`}
            >
              {hover.info.name}
            </span>
            <span className="text-[10px] text-[#9a9478]">{hover.info.cls}</span>
          </div>
          <div className="mt-1 text-[10px] text-[#b0aa92]">
            HP {hover.info.hp}/{hover.info.maxHp} · КД {hover.info.ac}
            {!hover.info.alive && ' · повержен'}
          </div>
          {hover.info.statuses.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {hover.info.statuses.map((s) => (
                <span
                  key={s.id}
                  className="rounded px-1.5 py-0.5 text-[9px]"
                  style={{ color: s.color, border: `1px solid ${s.color}55` }}
                >
                  {s.badge} · {s.turns}
                </span>
              ))}
            </div>
          )}
          {hover.info.preview && (
            <div className="mt-1.5 border-t border-[#6b5a2e]/40 pt-1.5 text-[10px] leading-snug">
              <span className="text-[#e2b86b]">{hover.info.preview.label}</span> · шанс попадания{' '}
              <b className="text-[#e8dfc0]">{hover.info.preview.pct}%</b> · урон {hover.info.preview.dice}
              {hover.info.preview.adv && <span className="ml-1 text-[#8ed89a]">↑ преим.</span>}
              {hover.info.preview.dis && <span className="ml-1 text-[#ff8a7a]">↓ помеха</span>}
            </div>
          )}
        </div>
      )}

      {hover?.barrel && !hover.info && (
        <div
          className="pointer-events-none fixed z-40 w-[240px] rounded-lg border border-[#ff7a2e]/60 bg-[#140f08]/95 p-2.5 shadow-[0_6px_28px_rgba(0,0,0,0.7)] backdrop-blur-sm"
          style={{
            left: Math.min(hover.x + 14, window.innerWidth - 254),
            top: Math.min(hover.y + 14, window.innerHeight - 140),
          }}
        >
          <div className="text-xs font-semibold text-[#ff9a5a]">{hover.barrel.name}</div>
          <div className="mt-1 text-[10px] leading-snug text-[#d8cfa8]">{hover.barrel.desc}</div>
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(4,6,3,0.55) 100%)' }}
      />

      {/* Бейдж бэкенда + системные кнопки */}
      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`pointer-events-none rounded border px-2.5 py-1 text-[11px] tracking-wide ${
              isWebGPU
                ? 'border-[#e2b86b]/60 bg-[#141008]/90 text-[#e2b86b]'
                : 'border-[#6b5a2e]/50 bg-[#141008]/90 text-[#9a9478]'
            }`}
          >
            Рендер: {snap.backend}
          </span>
          <button title="Сохранить игру (вне боя)" onClick={() => void eng?.saveGame()} className={SYS_BTN}>
            💾
          </button>
          <button title="Загрузить игру" onClick={() => void eng?.loadGame()} className={SYS_BTN}>
            📂
          </button>
          <button
            title={muted ? 'Включить звук' : 'Выключить звук'}
            onClick={() => setMuted(toggleMute())}
            className={SYS_BTN}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
        <span className="pointer-events-none hidden rounded border border-[#6b5a2e]/40 bg-[#141008]/80 px-2.5 py-1 text-[10px] text-[#9a9478] md:block">
          ЛКМ — идти · тянуть — камера · колесо — зум · наведи на врага — шанс попадания
        </span>
      </div>

      {/* Карточки партии + казна */}
      <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">
        {allies.map((a) => {
          const isActive = combat && a.id === snap.activeId;
          const isSelected = !combat && a.id === snap.selectedId;
          const healTarget = healMode && a.alive && a.hp < a.maxHp && active?.id !== a.id;
          return (
            <button
              key={a.id}
              onClick={() => onAllyCardClick(a.id, a.hp < a.maxHp)}
              className={`w-44 rounded-lg border p-2 text-left transition-all md:w-52 ${
                isActive
                  ? 'border-[#e2b86b] bg-[#1d160a]/95 shadow-[0_0_12px_rgba(226,184,107,0.35)]'
                  : isSelected
                    ? 'border-[#b09a5a] bg-[#171208]/95'
                    : 'border-[#6b5a2e]/70 bg-[#141008]/90'
              } ${a.alive ? '' : 'opacity-45 grayscale'} ${
                healTarget ? 'border-[#46b05e] shadow-[0_0_10px_rgba(70,176,94,0.45)]' : ''
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-sm font-semibold ${isActive ? 'text-[#e2b86b]' : 'text-[#e8dfc0]'}`}>
                  {a.name}
                  {isActive && <span className="ml-1.5 text-[10px] text-[#9a9478]">ход</span>}
                </span>
                <span className="text-[10px] text-[#9a9478]">КД {a.ac}</span>
              </div>
              <div className="mt-1.5">
                <HpBar hp={a.hp} maxHp={a.maxHp} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[#9a9478]">
                <span>
                  {a.cls} · {a.hp}/{a.maxHp}
                </span>
                {healTarget && <span className="text-[#8ed89a]">исцелить ↗</span>}
              </div>
              {a.statuses.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.statuses.map((s) => (
                    <span
                      key={s.id}
                      title={s.name}
                      className="rounded px-1 py-0.5 text-[9px]"
                      style={{ color: s.color, border: `1px solid ${s.color}55` }}
                    >
                      {s.badge} {s.turns}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}

        {/* Казна и опыт партии */}
        <Panel className="w-44 p-2 md:w-52">
          <div className="flex items-center justify-between text-[11px] text-[#d8cfa8]">
            <span title="Золото">💰 {party.gold}</span>
            <span title="Зелья лечения (общие)">🧪 {party.potions}</span>
            <span title="Уровень партии">⭐ ур. {party.level}</span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-sm bg-[#241c0e]">
            <div
              className="h-full bg-[#e2b86b] transition-all duration-300"
              style={{ width: `${Math.min(100, (party.xp / party.xpNext) * 100)}%` }}
            />
          </div>
          <div className="mt-1 text-right text-[9px] text-[#9a9478]">
            опыт {party.xp}/{party.xpNext}
          </div>
        </Panel>
      </div>

      {/* Инициатива */}
      {combat && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
          <Panel className="flex items-center gap-1.5 px-3 py-2">
            <span className="mr-1 whitespace-nowrap text-[10px] uppercase tracking-wider text-[#9a9478]">
              Раунд {snap.round}
            </span>
            {snap.order.map((id) => {
              const a = actors.find((x) => x.id === id);
              if (!a) return null;
              const isActiveTurn = id === snap.activeId;
              return (
                <span
                  key={id}
                  title={`${a.name}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs ${
                    isActiveTurn
                      ? 'border-[#e2b86b] bg-[#2a2110] text-[#e2b86b] shadow-[0_0_10px_rgba(226,184,107,0.4)]'
                      : 'border-[#6b5a2e]/60 bg-[#171208] text-[#b0aa92]'
                  } ${a.alive ? '' : 'opacity-35 line-through'}`}
                >
                  {a.name.slice(0, 1)}
                </span>
              );
            })}
          </Panel>
        </div>
      )}

      {/* Журнал */}
      <Panel className="absolute bottom-3 left-3 z-20 hidden w-[300px] md:block md:w-[330px]">
        <div className="border-b border-[#6b5a2e]/50 px-3 py-1.5 text-[10px] uppercase tracking-widest text-[#9a9478]">
          Журнал приключений
        </div>
        <div ref={logRef} className="max-h-[168px] overflow-y-auto px-3 py-2">
          {snap.log.map((l) => (
            <p key={l.id} className={`mb-1 text-[11px] leading-snug ${LOG_COLORS[l.kind]}`}>
              {l.text}
            </p>
          ))}
        </div>
      </Panel>

      {/* Подсказка прицеливания: исцеление/благословение/удар щитом/заклинание */}
      {(healMode || blessMode || bashMode || spellMode) && (
        <div className="pointer-events-none absolute bottom-[92px] left-1/2 z-20 -translate-x-1/2">
          <Panel className="px-3 py-1.5 text-[11px] text-[#8ed89a]">
            {healMode
              ? '🌿 Исцеление: кликните по раненому союзнику — в сцене или на карточке (Esc — отмена)'
              : blessMode
                ? '✨ Благословение: кликните по союзнику — в сцене или на карточке (Esc — отмена)'
                : bashMode
                  ? '💥 Оглушающий удар: кликните по врагу рядом (Esc — отмена)'
                  : '🔥 Огненный снаряд: кликните по врагу, бочке или земле — поджечь траву! (Esc — отмена)'}
          </Panel>
        </div>
      )}

      {/* Панель действий */}
      {myTurn && active && (
        <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
          <Panel className="flex flex-wrap items-center justify-center gap-2 px-3 py-2.5">
            <span className="rounded border border-[#6b5a2e]/50 px-2 py-1 text-[10px] text-[#9fd8a0]">
              Шаг: {snap.movementLeft.toFixed(0)} м
            </span>
            <span
              className={`rounded border px-2 py-1 text-[10px] ${
                snap.actionAvailable
                  ? 'border-[#6b5a2e]/50 text-[#d8cfa8]'
                  : 'border-[#6b5a2e]/30 text-[#6f6a56] line-through'
              }`}
            >
              Действие
            </span>
            <span
              className={`rounded border px-2 py-1 text-[10px] ${
                snap.bonusAvailable
                  ? 'border-[#46b05e]/60 text-[#8ed89a]'
                  : 'border-[#6b5a2e]/30 text-[#6f6a56] line-through'
              }`}
            >
              Бонус
            </span>
            <span
              className={`rounded border px-2 py-1 text-[10px] ${
                snap.reactionAvailable
                  ? 'border-[#c88fd8]/60 text-[#c88fd8]'
                  : 'border-[#6b5a2e]/30 text-[#6f6a56] line-through'
              }`}
            >
              Реакция
            </span>
            <button
              onClick={() => eng?.setActionMode('attack')}
              disabled={!snap.actionAvailable}
              className={`min-h-[44px] rounded border px-3.5 text-xs tracking-wide transition-colors disabled:opacity-40 ${
                snap.actionMode === 'attack'
                  ? 'border-[#e2b86b] bg-[#2a2110] text-[#e2b86b]'
                  : 'border-[#6b5a2e] bg-[#1d160a] text-[#d8cfa8] hover:bg-[#2a2110]'
              }`}
            >
              Атака · {active.name === 'Лиара' ? '1d4+1' : '1d8+3'}
            </button>
            {active.hasSpell && (
              <button
                onClick={() => eng?.setActionMode('spell')}
                disabled={!snap.actionAvailable}
                className={`min-h-[44px] rounded border px-3.5 text-xs tracking-wide transition-colors disabled:opacity-40 ${
                  snap.actionMode === 'spell'
                    ? 'border-[#e2b86b] bg-[#2a2110] text-[#e2b86b]'
                    : 'border-[#6b5a2e] bg-[#1d160a] text-[#d8cfa8] hover:bg-[#2a2110]'
                }`}
              >
                🔥 Снаряд · 1d10 · 18 м
              </button>
            )}
            {active.hasSpell && (
              <button
                onClick={() => eng?.setActionMode(snap.actionMode === 'bless' ? 'attack' : 'bless')}
                disabled={!snap.actionAvailable || snap.blessSlots < 1}
                className={`min-h-[44px] rounded border px-3.5 text-xs tracking-wide transition-colors disabled:opacity-40 ${
                  blessMode
                    ? 'border-[#ffe066] bg-[#241f08] text-[#ffe066]'
                    : 'border-[#6b5a2e] bg-[#1d160a] text-[#e8dfc0] hover:bg-[#2a2110]'
                }`}
              >
                ✨ Благословение · +1d4 ({snap.blessSlots})
              </button>
            )}
            {active.hasSpell && (
              <button
                onClick={() => eng?.setActionMode(snap.actionMode === 'heal' ? 'attack' : 'heal')}
                disabled={!snap.bonusAvailable || snap.healSlots < 1}
                className={`min-h-[44px] rounded border px-3.5 text-xs tracking-wide transition-colors disabled:opacity-40 ${
                  healMode
                    ? 'border-[#46b05e] bg-[#12240f] text-[#8ed89a]'
                    : 'border-[#6b5a2e] bg-[#1d160a] text-[#8ed89a] hover:bg-[#2a2110]'
                }`}
              >
                🌿 Исцеление · 1d4+2 ({snap.healSlots})
              </button>
            )}
            {active.id === 'cardan' && (
              <button
                onClick={() => eng?.setActionMode(snap.actionMode === 'bash' ? 'attack' : 'bash')}
                disabled={!snap.bashReady}
                className={`min-h-[44px] rounded border px-3.5 text-xs tracking-wide transition-colors disabled:opacity-40 ${
                  bashMode
                    ? 'border-[#9db8e8] bg-[#101823] text-[#9db8e8]'
                    : 'border-[#6b5a2e] bg-[#1d160a] text-[#d8cfa8] hover:bg-[#2a2110]'
                }`}
              >
                💥 Удар щитом · 1d4+3{snap.bashCd > 0 ? ` (КД ${snap.bashCd})` : ''}
              </button>
            )}
            {active.id === 'cardan' && (
              <button
                onClick={() => eng?.useSecondWind()}
                disabled={!snap.bonusAvailable || !snap.windReady || active.hp >= active.maxHp}
                className="min-h-[44px] rounded border border-[#6b5a2e] bg-[#1d160a] px-3.5 text-xs tracking-wide text-[#d8cfa8] transition-colors hover:bg-[#2a2110] disabled:opacity-40"
              >
                💨 Второе дыхание · 1d10+2
              </button>
            )}
            <button
              onClick={() => eng?.usePotion()}
              disabled={!snap.actionAvailable || party.potions < 1 || active.hp >= active.maxHp}
              className="min-h-[44px] rounded border border-[#6b5a2e] bg-[#1d160a] px-3.5 text-xs tracking-wide text-[#8ed89a] transition-colors hover:bg-[#2a2110] disabled:opacity-40"
            >
              🧪 Зелье · 2d4+2 ({party.potions})
            </button>
            <button
              onClick={() => eng?.endTurn()}
              className="min-h-[44px] rounded border border-[#b09a5a] bg-[#2a2110] px-4 text-xs font-semibold tracking-wide text-[#e2b86b] transition-colors hover:bg-[#3a2d14]"
            >
              Завершить ход
            </button>
          </Panel>
        </div>
      )}

      {/* Панель исследования: отдых */}
      {snap.phase === 'explore' && !snap.dialogue && (
        <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
          <Panel className="flex items-center gap-3 px-3 py-2">
            <span className="hidden text-[10px] text-[#9a9478] sm:block">Клик — идти и говорить</span>
            <button
              onClick={() => eng?.shortRest()}
              className="min-h-[40px] rounded border border-[#6b5a2e] bg-[#1d160a] px-3.5 text-xs tracking-wide text-[#8ed89a] transition-colors hover:bg-[#2a2110]"
            >
              🛌 Короткий отдых
            </button>
          </Panel>
        </div>
      )}

      {/* Диалог */}
      {snap.dialogue && (
        <div className="absolute bottom-4 left-1/2 z-30 w-[min(94vw,660px)] -translate-x-1/2">
          <Panel className="p-4 md:p-5">
            <div className="mb-1 text-sm font-semibold uppercase tracking-widest text-[#e2b86b]">
              {snap.dialogue.speaker}
            </div>
            <p className="mb-3 text-[13px] leading-relaxed text-[#e8dfc0]">{snap.dialogue.text}</p>
            <div className="flex flex-col gap-1.5">
              {snap.dialogue.options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => eng?.chooseOption(o.id)}
                  className="group flex min-h-[44px] items-center justify-between gap-3 rounded border border-[#6b5a2e]/60 bg-[#1d160a]/80 px-3 py-2 text-left text-[13px] text-[#d8cfa8] transition-all hover:border-[#e2b86b] hover:bg-[#2a2110]"
                >
                  <span>{o.text}</span>
                  {o.tag === 'persuasion' && (
                    <span className="shrink-0 rounded border border-[#b09a5a]/60 px-1.5 py-0.5 text-[10px] text-[#e2b86b]">
                      Убеждение СЛ 10
                    </span>
                  )}
                  {o.tag === 'buy' && (
                    <span className="shrink-0 rounded border border-[#e2b86b]/60 px-1.5 py-0.5 text-[10px] text-[#e2b86b]">
                      10 золота
                    </span>
                  )}
                  {o.tag === 'attack' && (
                    <span className="shrink-0 rounded border border-[#c0392b]/60 px-1.5 py-0.5 text-[10px] text-[#ff8a7a]">
                      Бой
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Интро */}
      {snap.phase === 'intro' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0a0805]/93 backdrop-blur-[2px]">
          <div className="mx-4 max-w-xl text-center">
            <p className="mb-2 text-[11px] uppercase tracking-[0.35em] text-[#9a9478]">
              Three.js · WebGPU · Прототип CRPG · v0.4
            </p>
            <h1
              className="mb-3 text-5xl font-bold tracking-[0.14em] text-[#e2b86b] md:text-6xl"
              style={{ textShadow: '0 0 30px rgba(226,184,107,0.35), 0 2px 4px #000' }}
            >
              ВРАТА БАЛЬДУРА
            </h1>
            <p className="mb-6 text-sm leading-relaxed text-[#c9c2a4]">
              v0.4 — «Огонь и тактика»: путь по A* с превью и метками провокаций, взрывные и масляные бочки,
              распространяющийся огонь, гоблин-поджигатель с огненными стрелами и Utility-ИИ, который сам
              ищет бочки под взрыв. Плюс всё из v0.3: экономика действий, реакции и атаки по возможности,
              статусы, шанс попадания при наведении, Оглушающий удар щитом, опыт, лут, сейвы и звук.
            </p>
            <div className="mx-auto mb-7 grid max-w-md grid-cols-2 gap-1.5 text-[11px] text-[#9a9478]">
              <span className="text-right text-[#d8cfa8]">ЛКМ</span>
              <span className="text-left">идти (A*-маршрут) · атаковать</span>
              <span className="text-right text-[#d8cfa8]">Наведение</span>
              <span className="text-left">путь · шанс попадания · бочки</span>
              <span className="text-right text-[#d8cfa8]">🔴 точки</span>
              <span className="text-left">шаги, провоцирующие АоО</span>
              <span className="text-right text-[#d8cfa8]">ЛКМ-тянуть / колесо</span>
              <span className="text-left">камера / зум (WASD — панорама)</span>
            </div>
            <button
              onClick={() => eng?.begin()}
              className="min-h-[52px] rounded border border-[#e2b86b] bg-[#2a2110] px-10 text-sm font-semibold uppercase tracking-[0.2em] text-[#e2b86b] shadow-[0_0_24px_rgba(226,184,107,0.25)] transition-all hover:bg-[#3a2d14] hover:shadow-[0_0_36px_rgba(226,184,107,0.45)]"
            >
              Начать приключение
            </button>
            <p className="mt-4 text-[10px] text-[#6f6a56]">
              Рендер: {snap.backend}. Лучшие впечатления — Chrome / Edge 113+.
            </p>
          </div>
        </div>
      )}

      {/* Победа / поражение */}
      {(snap.phase === 'victory' || snap.phase === 'defeat') && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0a0805]/88 backdrop-blur-[2px]">
          <div className="mx-4 text-center">
            <h2
              className={`mb-3 text-5xl font-bold tracking-[0.18em] md:text-6xl ${
                snap.phase === 'victory' ? 'text-[#e2b86b]' : 'text-[#c0392b]'
              }`}
              style={{ textShadow: '0 2px 6px #000' }}
            >
              {snap.phase === 'victory' ? 'ПОБЕДА' : 'ПАРТИЯ ПАЛА'}
            </h2>
            <p className="mb-2 max-w-md text-sm leading-relaxed text-[#c9c2a4]">
              {snap.phase === 'victory'
                ? 'Стая Дроса разбита, дорога к руинам свободна. Странник благодарит партию, а её карманы звенят добытым золотом.'
                : 'Тьма поглощает Чионтарский лес. Но тадпол ещё пульсирует — история не окончена.'}
            </p>
            <p className="mb-8 text-[11px] text-[#9a9478]">
              Уровень {party.level} · опыт {party.xp} · золото {party.gold} · зелий {party.potions}
            </p>
            <button
              onClick={restart}
              className="min-h-[48px] rounded border border-[#e2b86b] bg-[#2a2110] px-8 text-sm font-semibold uppercase tracking-[0.15em] text-[#e2b86b] transition-all hover:bg-[#3a2d14]"
            >
              {snap.phase === 'victory' ? 'Играть снова' : 'Начать заново'}
            </button>
          </div>
        </div>
      )}

      {/* Градиент снизу */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0b0e09]/70 to-transparent" />
    </div>
  );
}
