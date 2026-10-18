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
export type MapId='forest'|'crypt'|'swamp'|'giants';/* v1.6: +перевал великанов */
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
  /* ресурсы хода (заполняются makeUnit'ом и beginTurn; обязательны) */
  actionMax:number;action:number;bonus:number;reaction:number;
  moveLeft:number;dashUsed?:boolean;disengaging?:boolean;
  swUsed:boolean;dawnUsed:boolean;poisonBlade:number;surge:number;
  /* v1.6: надетое снаряжение (id из GEAR); бонусы учтены в ac/maxhp/weapon */
  gear?:{weapon?:string;armor?:string;trinket?:string};
  /* заклинания/предметы */
  slots:number;slotsMax:number;potions:number;oil?:number;relic?:string|null;
  /* флаги роли/ИИ */
  keepDist:boolean;elite?:boolean;caster?:boolean;healer?:boolean;
  summoned?:boolean;summoner?:Unit|null;
  bossBrain?:boolean;isBoss?:boolean;mainBoss?:boolean;cryptBoss?:boolean;
  swampBoss?:boolean;/* v1.5: Ульва, Матерь Топей */
  giantBoss?:boolean;/* v1.6: Гаррум Камнегрыз */
  phase2?:boolean;fearImmune?:boolean;isBarrel?:true;
  pacified?:boolean;/* v0.6: запуган — реакция атаки недоступна */
  /* кэш DOM-полоски над головой (updateOverlays) */
  _el?:HTMLElement|null;
  /* инициатива/участие в бою */
  init?:number;inCombat?:boolean;
  /* представление */
  mesh:THREE.Object3D;rig:THREE.Object3D;phase:number;
  /* транзитный флаг анимации перемещения (animateMove) */
  moving?:boolean;
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
  swampDone:boolean;olkhaJoined:boolean;/* v1.5 */
  giantsDone:boolean;giantsChest:boolean;/* v1.6 */
  patrolGroup:Unit[];campGroup:Unit[];combatGroup:Unit[];cryptGroup:Unit[];swampGroup:Unit[];giantsGroup:Unit[];
  /* v1.6: сумка отряда — ненадетые предметы снаряжения (id GEAR) */
  bag:string[];
  dlgNpc:string|null;
  cageMesh:THREE.Object3D|null;ilvaMesh:THREE.Object3D|null;crateMesh:THREE.Object3D|null;
  kayaMesh:THREE.Object3D|null;olkhaMesh:THREE.Object3D|null;/* v1.5 */
  barrelsUsed:Set<string>;
}

/* --- формат сейва v2 (ЗАМОРОЖЕН — REFACTORING.md §8) --- */
export interface HeroSave{
  cls:string;level:number;xp:number;
  hp:number;maxhp:number;ac:number;
  str:number;dex:number;con:number;int:number;wis:number;cha:number;
  slotsMax:number;potions:number;oil:number;
  armor?:string;relic?:string|null;
  gear?:{weapon?:string;armor?:string;trinket?:string};/* v1.6: надетое снаряжение */
  weapon:Weapon|null;
  x?:number;z?:number;
}
export interface SaveFlags{
  patrolDone:boolean;campDone:boolean;cageSeen:boolean;knowsBoss:boolean;
  hasCrate:boolean;ilvaFreed:boolean;chestLooted:boolean;necroSlain:boolean;
  kayaJoined:boolean;
  /* v1.5: новые флаги — опциональные, сейв v2 остаётся совместимым */
  swampDone?:boolean;olkhaJoined?:boolean;
  /* v1.6: перевал великанов + сундук с секирой */
  giantsDone?:boolean;giantsChest?:boolean;
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
  bag?:string[];/* v1.6: сумка отряда — опционально, v2 совместим */
}

/* курсор выбора тайла/сущности (raycast) */
export interface PickState{
  tile:{x:number;z:number}|null;
  ent:Unit|null;
  inter:Interact|null;
}

/* ================= ФАЗА 5: типы разрыва циклов и строгого режима ================= */

/* сетка мира — контекст чистых функций world/grid.ts (переехал из grid.ts:
   types.ts — единственный источник доменных типов, state.ts больше не
   импортирует grid — цикл state⇄grid разорван) */
export interface GridWorld{
  solid:Set<string>;         /* непроходимая декорация */
  units:Unit[];              /* живые сущности (вкл. фигурки-преграды) */
  barrels:Unit[];            /* бочки/урны (Unit с isBarrel:true) */
  fires:Map<string,FireTile>;/* горящие тайлы */
}

/* режим прицеливания (G.targeting) */
export type TargetType='attack'|'bolt'|'sneak'|'smite'|'fireball'|'oil'|'bless'|'cure'|'heal'|'spark'|'spore';/* v1.5: +разряд молнии, облако спор */
export interface TargetingState{type:TargetType;}

/* опция и узел диалога (DLGS) */
export interface DlgOpt{
  t:string;
  show?:()=>boolean;
  req?:{skill:string;dc:number};
  ok?:string;fail?:string;
  end?:boolean;fn?:()=>void;
}
export interface DlgNode{name:string;text:string;opts?:DlgOpt[];}
export type DlgFn=(id:string)=>DlgNode|null|undefined;

/* действие панели боя (ACTIONS) */
export interface ActionDef{
  label:string;sub?:string;cls?:string;
  only?:(h:Unit)=>boolean;
  enabled:(h:Unit)=>boolean;
  run:(h:Unit)=>void;
}

/* товар лавки Дамрока (SHOP) */
export interface ShopItem{
  n:string;p:number;d:string;
  t:'potion'|'oil'|'ac'|'weapon'|'armor'|'cha'|'gear';
  v?:number;w?:Weapon;g?:string;/* v1.6: g — id снаряжения (GEAR) для t:'gear' */
}

/* план ИИ (planGoblin/planNecro → aiTurn) */
export type AIPlan=
  {type:'phase2'}|{type:'nova'}|{type:'dash'}|{type:'potion'}|
  {type:'heal';target:Unit}|{type:'attack';target:Unit}|
  {type:'move';path:{x:number;z:number}[]}|{type:'dis';path:{x:number;z:number}[]};

/* реликвия элиты (rollLoot) */
export interface Relic{n:string;apply:(h:Unit)=>string;}

/* параметры взрыва (explode) */
export interface ExplodeOpts{dice?:number[];radius?:number;}

/* отладочный хук __bg3 (E2E-проверки) */
export interface Bg3Debug{
  units:Unit[];S:GameState;QUESTS:Record<string,Quest>;
  switchMap:(id:MapId)=>Promise<void>;
  startCombat:(group:Unit[])=>void;
  questDone:(id:string)=>void;
  freeIlva:()=>Promise<void>;
  joinKaya:(x?:number,z?:number)=>unknown;
  gameSnapshot:()=>SaveData;
  doSave:(i:number)=>void;doLoad:(i:number)=>void;
  gfx:Record<string,unknown>;
  applyGfx:()=>void;
  openSaveMenu:(fromEnd:boolean)=>void;
  toggleGfx:()=>void;
  rollLoot:(t:Unit)=>void;
  LOOT:Record<string,{readonly gold:readonly [number,number];readonly potion:number;readonly oil:number}>;
  /* v1.4: наставник + облачные скрижали (E2E) */
  moveParty:(x:number,z:number)=>void;
  tut:()=>{step:number;done:boolean};
  cloudGet:(i:number)=>Promise<SaveData|null>;
  cloudPut:(i:number,sv:SaveData)=>Promise<boolean>;
  cloudPull:(i:number)=>Promise<void>;
  /* v1.5: болота + друид + серверные скрижали + E2E-прицеливание */
  joinOlkha:(x?:number,z?:number)=>unknown;
  /* v1.6: снаряжение (E2E) */
  bag:()=>string[];
  giveGear:(id:string,cls:string)=>void;
  unequipGear:(cls:string,slot:'weapon'|'armor'|'trinket')=>void;
  openBag:()=>void;
  gearKeys:()=>string[];
  serverGet:(i:number)=>Promise<SaveData|null>;
  serverPut:(i:number,sv:SaveData)=>Promise<boolean>;
  serverPull:(i:number)=>Promise<void>;
  aim:(t:string)=>void;
  cam:()=>unknown;ctl:()=>unknown;
  loopStop:()=>void;loopStart:()=>void;/* v1.7: пауза рендера для E2E-снимков */
  scn:()=>unknown;rnd:()=>unknown;/* v1.7: рендерер/сцена для E2E-снимка */
  step:(x:number,z:number)=>void;/* v1.7: боевое перемещение для E2E */
  fire:(x:number,z:number)=>Promise<void>;
  animStats:()=>unknown;/* v1.7: сводка анимационной системы (motion+rigs) */
}
declare global{interface Window{__bg3?:Bg3Debug;}}
