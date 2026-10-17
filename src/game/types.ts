/* ================= TYPES (Фаза 3 рефакторинга) =================
   Единственный источник доменных типов (REFACTORING.md §3). Лист —
   импортирует только типы three. Типы описывают СУЩЕСТВУЮЩЕЕ поведение
   v1.3, ничего не меняя в рантайме (аннотации стираются).
   TODO(refactor-p4a): GameCtx (runtime-мир) в state.ts;
   TODO(refactor-p5): зачистка остаточных any в engine.ts. */
import type * as THREE from 'three/webgpu';

/* --- примитивы --- */
export type Side='hero'|'goblin';
export type Abil='str'|'dex'|'con'|'int'|'wis'|'cha';
export type MapId='forest'|'crypt';
export type StatusType='burn'|'poison'|'bless'|'fear'|'dodge'|'faith';
export type QuestState='hidden'|'active'|'done';

/* фазы игрового цикла (движок) */
export type Phase='idle'|'ai'|'dialogue'|'explore'|'over'|'player'|'transition';

/* шаблон фабрики юнита (GOB/SKEL/CULT) — контекстная типизация литералов;
   обязательные поля — те, что есть у всех шаблонов v1.3 */
export type UnitTemplate=Partial<Unit>&{name:string;short:string;hp:number;ac:number;xp:number;color:number;};

export interface Status{type:StatusType;turns:number;}

export interface Weapon{
  name:string;
  dice:number[];          /* [количество, грани] */
  abil:Abil;              /* характеристика атаки */
  range:number;           /* дальность в клетках сетки */
  melee?:boolean;         /* ближняя атака */
  fire?:boolean;          /* огненные стрелы (BOLT) */
  smite?:boolean;         /* карание света (SMITE) */
  necro?:boolean;         /* жезл гнили некроманта */
  status?:Status;         /* статус при попадании (дротик шамана) */
}

/* Юнит. Бочка/урна — это Unit с isBarrel:true (структурно имеет
   hp/maxhp/ac/alive/x/z/mesh), отдельного класса нет. Боевые функции
   принимают Unit; барель-поля, которых нет (statuses и пр.), в бою
   с бочками не читаются — поведение v1.3 не меняется. */
export interface Unit{
  id:number;name:string;short:string;
  side:Side;cls:string;clsName?:string;
  alive:boolean;
  hp:number;maxhp:number;ac:number;
  x:number;z:number;
  speed:number;
  str:number;dex:number;con:number;int:number;wis:number;cha:number;
  prof:number;level:number;xp:number;
  color?:number;skin?:number;tipColor?:number;
  features:string[];
  weapon:Weapon;dagger:Weapon|null;
  armor?:string;staff?:boolean;
  statuses:Status[];
  /* ресурсы хода */
  actionMax:number;action?:number;bonus?:number;reaction:number;
  moveLeft:number;dashUsed?:boolean;disengaging?:boolean;
  swUsed:boolean;dawnUsed:boolean;poisonBlade:number;surge:number;
  /* заклинания/предметы */
  slots:number;slotsMax:number;potions:number;oil?:number;relic?:string|null;
  /* флаги роли/ИИ */
  keepDist:boolean;elite?:boolean;caster?:boolean;healer?:boolean;
  summoned?:boolean;summoner?:Unit|null;
  bossBrain?:boolean;isBoss?:boolean;mainBoss?:boolean;cryptBoss?:boolean;
  phase2?:boolean;fearImmune?:boolean;isBarrel?:true;
  pacified?:boolean;/* v0.6: запуган — реакция атаки недоступна */
  /* кэш DOM-полоски над головой (updateOverlays) */
  _el?:HTMLElement|null;
  /* инициатива/участие в бою */
  init?:number;inCombat?:boolean;
  /* представление */
  mesh:THREE.Object3D;rig:THREE.Object3D;phase:number;
}

export type Barrel=Unit&{isBarrel:true};

/* горящий тайл (fires: Map<ключ сетки, FireTile>) */
export interface FireTile{
  x:number;z:number;turns:number;
  g:THREE.Group;m1:THREE.Mesh;m2:THREE.Mesh;
}

/* интерактивная точка мира (addInteract) */
export interface Interact{
  x:number;z:number;r:number;label:string;fn:()=>void;
  mesh?:THREE.Object3D|null;talkName?:string;talkDesc?:string;
}

/* метаданные квеста */
export interface QuestObj{k:string;t:string;done:boolean;}
export interface Quest{name:string;state:QuestState;desc:string;objs:QuestObj[];}

/* метапрогресс и флаги (S; переедет в state.ts в Фазе 4a) */
export interface GameState{
  gold:number;discount:boolean;
  patrolDone:boolean;campDone:boolean;cageSeen:boolean;knowsBoss:boolean;
  hasCrate:boolean;ilvaFreed:boolean;mainShown:boolean;
  chestLooted:boolean;necroSlain:boolean;kayaJoined:boolean;
  patrolGroup:Unit[];campGroup:Unit[];combatGroup:Unit[];cryptGroup:Unit[];
  dlgNpc:string|null;
  cageMesh:THREE.Object3D|null;ilvaMesh:THREE.Object3D|null;crateMesh:THREE.Object3D|null;
  kayaMesh:THREE.Object3D|null;
  barrelsUsed:Set<string>;
}

/* --- формат сейва v2 (ЗАМОРОЖЕН — REFACTORING.md §8) --- */
export interface HeroSave{
  cls:string;level:number;xp:number;
  hp:number;maxhp:number;ac:number;
  str:number;dex:number;con:number;int:number;wis:number;cha:number;
  slotsMax:number;potions:number;oil:number;
  armor?:string;relic?:string|null;
  weapon:Weapon|null;
  x?:number;z?:number;
}
export interface SaveFlags{
  patrolDone:boolean;campDone:boolean;cageSeen:boolean;knowsBoss:boolean;
  hasCrate:boolean;ilvaFreed:boolean;chestLooted:boolean;necroSlain:boolean;
  kayaJoined:boolean;
}
export interface SaveQuest{state:QuestState;objs:boolean[];}
export interface SaveData{
  v:number;when:number;
  mapId:MapId;mapName:string;
  gold:number;discount:boolean;
  flags:SaveFlags;
  barrelsUsed:string[];
  quests:Record<string,SaveQuest>;
  heroes:HeroSave[];
}

/* курсор выбора тайла/сущности (raycast) */
export interface PickState{
  tile:{x:number;z:number}|null;
  ent:Unit|null;
  inter:Interact|null;
}
