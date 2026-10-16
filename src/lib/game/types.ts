export type Phase = 'intro' | 'explore' | 'dialogue' | 'combat' | 'victory' | 'defeat';
export type ActorMode = 'ally' | 'foe' | 'neutral';
export type ActionMode = 'attack' | 'spell' | 'heal' | 'bless' | 'bash';
export type LogKind = 'info' | 'roll' | 'hit' | 'crit' | 'miss' | 'death' | 'heal' | 'story' | 'status' | 'fire';

// ==================== СТАТУС-ЭФФЕКТЫ ====================

export type StatusId = 'burning' | 'poison' | 'bless' | 'stun' | 'fear';

/** Активный статус на актёре. */
export interface StatusState {
  id: StatusId;
  turns: number;
}

export interface StatusDef {
  name: string;
  badge: string;
  color: string;
}

/** Каталог статусов: v0.3 + v0.4 (оглушение — пропуск хода, страх — помеха атакам). */
export const STATUS_DEFS: Record<StatusId, StatusDef> = {
  burning: { name: 'Горение', badge: 'ГОР', color: '#ff7a2e' },
  poison: { name: 'Отравление', badge: 'ЯД', color: '#8ed86a' },
  bless: { name: 'Благословение', badge: 'БЛА', color: '#ffe066' },
  stun: { name: 'Оглушение', badge: 'ОГЛ', color: '#9db8e8' },
  fear: { name: 'Страх', badge: 'СТР', color: '#c88fd8' },
};

export interface StatusView extends StatusState {
  name: string;
  badge: string;
  color: string;
}

// ==================== ТУЛТИП НАВЕДЕНИЯ ====================

/** Предсказание атаки активного героя по цели. */
export interface AttackPreview {
  label: string;
  dice: string;
  pct: number;
  adv: boolean;
  dis: boolean;
}

export interface HoverInfo {
  id: string;
  name: string;
  cls: string;
  hp: number;
  maxHp: number;
  ac: number;
  mode: ActorMode;
  alive: boolean;
  statuses: StatusView[];
  preview: AttackPreview | null;
}

export interface SpellDef {
  name: string;
  bonus: number;
  dmg: [number, number, number];
  range: number;
}

/** Тултип бочки (v0.4). */
export interface BarrelInfo {
  name: string;
  desc: string;
}

export interface ActorStats {
  id: string;
  name: string;
  cls: string;
  hp: number;
  maxHp: number;
  ac: number;
  speed: number;
  atkBonus: number;
  dmg: [number, number, number];
  range: number;
  spell?: SpellDef;
  potions: number;
  initBonus: number;
  /** Модификатор спасбросков (Телосложение/Мудрость, упрощённо). */
  saveBonus: number;
  mode: ActorMode;
  color: number;
}

export interface ActorView {
  id: string;
  name: string;
  cls: string;
  hp: number;
  maxHp: number;
  ac: number;
  mode: ActorMode;
  alive: boolean;
  hasSpell: boolean;
  statuses: StatusView[];
  reactionAvailable: boolean;
}

export interface LogEntry {
  id: number;
  kind: LogKind;
  text: string;
}

export interface DialogueOption {
  id: number;
  text: string;
  tag?: string;
}

export interface DialogueView {
  speaker: string;
  text: string;
  options: DialogueOption[];
}

/** Общее состояние партии: запасы, опыт, уровень. */
export interface PartyState {
  potions: number;
  gold: number;
  xp: number;
  level: number;
}

export interface PartyView extends PartyState {
  xpNext: number;
}

export interface Snapshot {
  phase: Phase;
  backend: string;
  selectedId: string | null;
  activeId: string | null;
  order: string[];
  round: number;
  movementLeft: number;
  actionAvailable: boolean;
  bonusAvailable: boolean;
  reactionAvailable: boolean;
  actionMode: ActionMode;
  healSlots: number;
  blessSlots: number;
  windReady: boolean;
  bashReady: boolean;
  bashCd: number;
  party: PartyView;
  actors: ActorView[];
  log: LogEntry[];
  dialogue: DialogueView | null;
}

/** Данные слота сохранения (IndexedDB). */
export interface SaveData {
  v: 3;
  savedAt: number;
  party: PartyState;
  heroes: { id: string; x: number; z: number; hp: number }[];
  others: { id: string; x: number; z: number; hp: number; alive: boolean }[];
  flags: { goblinsSpared: boolean; campArmed: boolean };
}
