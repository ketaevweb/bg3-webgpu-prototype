/* ================= UI STORE (Фаза 6 рефакторинга) =================
   Zustand-стор — граница «движок ⇄ React-HUD». Движковые модули ПИШУТ
   view-модели (вместе с колбэками), React-компоненты только ЧИТАЮТ стор
   и зовут колбэки. Стор — ЛИСТ графа: ни одного рантайм-импорта из
   движковых модулей (только type-import, стирается) — three/webgpu не
   попадает в основной бандл, SSR безопасен.
   Тексты и структура классов — 1:1 с прежним innerHTML (game.css без
   изменений; React рендерит те же id, что были в HUD_HTML).
   Колбэки-биндинги (sys.*, *OnClose, onImportFile) привязывают владельцы
   при загрузке модулей (settings/slots/shop/quests/engine) — как шина bus. */
import { create } from 'zustand';

/* ---- view-модели ---- */
export interface LogEntry{id:number;msg:string;cls?:string}
export interface StatusView{css:string;label:string}
export interface PartyCardView{
  name:string;clsName:string;level:number;
  hp:number;maxhp:number;ac:number;potions:number;
  statuses:StatusView[];xp:number;need:number;
  active:boolean;open:()=>void;
}
export interface InitChipView{short:string;init:number;side:string;cur:boolean;dead:boolean}
export interface PipView{label:string;value:string|null}
export interface ActionBtnView{label:string;cls?:string;disabled:boolean;onClick:()=>void}
export interface ActionbarView{visible:boolean;waiting:boolean;pips:PipView[];btns:ActionBtnView[]}
export interface DlgOptView{t:string;req:boolean;onClick:()=>void}
export interface DlgView{name:string;text:string;opts:DlgOptView[]}
export interface ShopRowView{n:string;d:string;price:number;canBuy:boolean;buy:()=>void}
export interface ChoiceView{title:string;options:{label:string;onClick:()=>void}[]}
export interface JournalItemView{name:string;done:boolean;desc:string;objs:{t:string;done:boolean}[];reward:string}
export interface TrackerQuestView{name:string;objs:{t:string;done:boolean}[]}
export interface SheetView{
  name:string;sub:string;
  row:{k:string;v:string}[];
  ab:{l:string;v:number;m:string}[];
  weapon:{name:string;dice:string;mod:string;mode:string};
  armor:{name:string;ac:number};potions:string;
  spells?:{cells?:string;lines:string[]};
  features:string[];
  xpPct:number;xpText:string;
}
export interface SlotRowView{
  i:number;has:boolean;meta:string;sub:string;
  onSave:()=>void;onLoad:()=>void;onExport:()=>void;onImport:()=>void;onDelete:()=>void;
  /* v1.4: облачная скрижаль (IndexedDB-зеркало слота) */
  cloudHas:boolean;cloudWhen:string|null;onCloudPull:()=>void;onCloudPush:()=>void;
  /* v1.5: серверная скрижаль (зеркало слота на сервере /api/tablets) */
  serverHas:boolean;serverWhen:string|null;onServerPull:()=>void;onServerPush:()=>void;
}
/* v1.4: карточка обучения («Наставник») — продвигается реальными действиями игрока */
export interface TutView{title:string;text:string;i:number;n:number;onSkip:()=>void}
/* v1.6: панель снаряжения — предметы в сумке + слоты героев */
export interface BagItemView{n:string;d:string;slot:string;equip:()=>void}
/* v1.9: снимок миникарты (рисует React-canvas, данные собирает ui/minimap.ts) */
export interface MiniMapView{ver:number;grid:number;solid:number[];dots:number[];cur:{x:number;z:number}|null}
/* v2.4: панель «Летопись Глубин» (T/🏆) — сезон, рекорд, журнал, серверный топ */
export interface SeasonView{name:string;desc:string;idx:number}
export interface RecordsView{
  season:SeasonView|null;
  best:number;
  journal:{w:number;when:string}[];
  server:{n:string;best:number}[]|null;/* null — сервер ещё читается */
}
export interface BagSlotView{label:string;item:string|null;remove:()=>void}
export interface BagHeroView{name:string;clsName:string;slots:BagSlotView[]}
export interface GfxSegView{name:string;active:boolean;pick:()=>void}
export interface GfxRowView{label:string;segs:GfxSegView[]}
export interface GfxPresetView{name:string;pick:()=>void}
export interface TipView{html:string;x:number;y:number}
export interface EndView{title:string;color:string;stats:string;canContinue:boolean}
export interface TopbarView{round:string;turn:string;turnColor:string|null}
export interface SysView{
  sndIcon:string;
  onSnd:()=>void;onGfx:()=>void;onSaves:()=>void;onLoadFromEnd:()=>void;
  onBag:()=>void;/* v1.6: панель снаряжения */
  onMm:()=>void;/* v1.9: миникарта (M) */
  onRecords:()=>void;/* v2.4: летопись Глубин (T) */
  onFs:()=>void;/* v2.7: полноэкранный режим (F/⛶) */
  onTalk:()=>void;/* v2.7: говорить/осмотреть (E) — тач-кнопка */
  touch:boolean;/* v2.7: тач-устройство (coarse) — мобильная раскладка */
  canFs:boolean;/* v2.7: Fullscreen API доступен (iPhone — false) */
  fsTitle:string;/* v2.7: тултип кнопки ⛶ (состояние FS) */
}

export interface UiState{
  /* постоянные слои */
  log:LogEntry[];hint:string;banner:string|null;bannerOn:boolean;
  topbar:TopbarView;init:InitChipView[];party:PartyCardView[];
  boss:{name:string;hpPct:number}|null;
  actionbar:ActionbarView;tip:TipView|null;
  tracker:{gold:string;quests:TrackerQuestView[]};
  /* панели: mount-if-open или флаг видимости */
  dlg:DlgView|null;choice:ChoiceView|null;sheet:SheetView|null;
  end:EndView|null;endHidden:boolean;
  shopOpen:boolean;shopRows:ShopRowView[];
  bagOpen:boolean;bagItems:BagItemView[];bagParty:BagHeroView[];/* v1.6 */
  journalOpen:boolean;journalItems:JournalItemView[];
  gfxOpen:boolean;gfxPresets:GfxPresetView[];gfxRows:GfxRowView[];
  savesOpen:boolean;savesCur:string;savesSlots:SlotRowView[];
  tut:TutView|null;/* v1.4: видима, пока обучение не пройдено/не пропущено */
  minimapOpen:boolean;minimap:MiniMapView|null;/* v1.9: миникарта (M) */
  recordsOpen:boolean;records:RecordsView|null;/* v2.4: летопись Глубин (T) */
  importInput:HTMLInputElement|null;/* живой ref скрытого input#importFile (клик из doImport — внутри пользовательского жеста) */
  /* колбэки-биндинги (владельцы — движковые модули) */
  sys:SysView;
  shopOnClose:()=>void;journalOnClose:()=>void;
  gfxOnClose:()=>void;savesOnClose:()=>void;choiceOnClose:()=>void;
  bagOnClose:()=>void;/* v1.6 */
  recordsOnClose:()=>void;/* v2.4 */
  onImportFile:(e:{target:HTMLInputElement})=>void;
}

const initial={
  log:[] as LogEntry[],hint:'',banner:null as string|null,bannerOn:false,
  topbar:{round:'Подготовка…',turn:'',turnColor:null} as TopbarView,
  init:[] as InitChipView[],party:[] as PartyCardView[],
  boss:null as {name:string;hpPct:number}|null,
  actionbar:{visible:false,waiting:false,pips:[],btns:[]} as ActionbarView,
  tip:null as TipView|null,
  tracker:{gold:'Золото: 0',quests:[] as TrackerQuestView[]},
  dlg:null as DlgView|null,choice:null as ChoiceView|null,sheet:null as SheetView|null,
  end:null as EndView|null,endHidden:false,
  shopOpen:false,shopRows:[] as ShopRowView[],
  bagOpen:false,bagItems:[] as BagItemView[],bagParty:[] as BagHeroView[],
  journalOpen:false,journalItems:[] as JournalItemView[],
  gfxOpen:false,gfxPresets:[] as GfxPresetView[],gfxRows:[] as GfxRowView[],
  savesOpen:false,savesCur:'',savesSlots:[] as SlotRowView[],
  tut:null as TutView|null,
  minimapOpen:false,minimap:null as MiniMapView|null,
  recordsOpen:false,records:null as RecordsView|null,
  importInput:null as HTMLInputElement|null,
};

const noop=()=>{};
const noBinds={
  sys:{
    sndIcon:'🔊',onSnd:noop,onGfx:noop,onSaves:noop,onLoadFromEnd:noop,onBag:noop,onMm:noop,onRecords:noop,
    onFs:noop,onTalk:noop,touch:false,canFs:false,fsTitle:'Полный экран (F)',
  } as SysView,
  shopOnClose:noop,journalOnClose:noop,gfxOnClose:noop,savesOnClose:noop,choiceOnClose:noop,bagOnClose:noop,recordsOnClose:noop,
  onImportFile:(()=>{}) as (e:{target:HTMLInputElement})=>void,
};

export const useUi=create<UiState>()(()=>({...initial,...noBinds}));

/* движковые модули пишут через uiSet (в т.ч. функциональные merge-обновления) */
export const uiSet=useUi.setState;

let logSeq=0;
export function pushLog(msg:string,cls?:string){
  uiSet(s=>({log:[...s.log,{id:++logSeq,msg,cls}].slice(-80)}));
}

/* частичные апдейты верхней панели и видимости панели действий */
export function setTopbar(patch:Partial<TopbarView>){
  uiSet(s=>({topbar:{...s.topbar,...patch}}));
}
export function setRound(t:string){setTopbar({round:t});}
export function setActionbarVisible(visible:boolean){
  uiSet(s=>({actionbar:{...s.actionbar,visible}}));
}

/* чистый ремоут (dispose→resetState→resetUi): UI в состояние первого запуска;
   колбэки-биндинги переживают ремоут — привязаны на время жизни страницы */
export function resetUi(){
  const b=useUi.getState();
  uiSet({...initial,
    sys:b.sys,shopOnClose:b.shopOnClose,journalOnClose:b.journalOnClose,
    gfxOnClose:b.gfxOnClose,savesOnClose:b.savesOnClose,choiceOnClose:b.choiceOnClose,
    bagOnClose:b.bagOnClose,recordsOnClose:b.recordsOnClose,
    onImportFile:b.onImportFile});
}
