/* ================= EDITOR BRIDGE (v3.3 «Кузница») =================
   Движковая сторона редактора «как в Unity»: снимок иерархии сцены,
   инспектор юнита (живое редактирование полей), спавн/удаление/убить/
   исцелить/фокус, глобальные параметры (золото/темп/лимит FPS/графика/
   сезон/карта), Пауза-Шаг-Темп игрового цикла (G.paused/stepOnce/
   timeScale — симуляция стоит, рендер и камера живут) и «выбор кликом»
   (capture-фаза на document — перехватывает клик ДО игрового обработчика).
   Панель — React (EditorPanel.tsx) поверх ui/editorStore.ts.
   Правило безопасности: ничего не переписываем — только читаем состояние
   и мутируем поля in-place теми же объектами, что и игра. */
import type * as THREE from 'three/webgpu';
import type { Abil, MapId, StatusType, Unit } from '../types';
import { G, S, units, barrels, pick, GW, MAP_NAME } from '../state';
import { TILE, GRID, HALF, W } from '../constants';
import { clamp } from '../utils';
import { passable, unitAt } from '../world/grid';
import { camera, controls, renderer } from '../render/renderer';
import { removeUnit } from '../entities/units';
import { GOB, makeGoblin, makeSkeleton, makeSkeletonKnight, makeCultist,
  makeDrowned, makeOgre, makeGrat, makeNecro, makeUlva, makeGarrum, makeMalveh,
  makeIlva, makeKaya, makeOlkha, makeHaldir, applyElite } from '../entities/roster';
import { damageUnit } from '../systems/combat';
import { switchMap } from '../world/maps';
import { forceSeason } from '../interact/season';
import { gfx, applyGfx } from '../save/settings';
import { upgradeUnitRig, animOptsFor } from '../animation';
import { bus } from '../bus';
import { useEd, uiEdSet, edPushLog } from '../ui/editorStore';

/* ---------- каталог спавна (v3.3) ---------- */
export const ED_SPAWN:{k:string;label:string;make:(x:number,z:number)=>Unit}[]=[
  {k:'bruiser',label:'Гоблин-задира',make:(x,z)=>makeGoblin(GOB.bruiser,x,z)},
  {k:'archer',label:'Гоблин-лучник',make:(x,z)=>makeGoblin(GOB.archer,x,z)},
  {k:'shaman',label:'Гоблин-шаман',make:(x,z)=>makeGoblin(GOB.shaman,x,z)},
  {k:'chief',label:'Гоблин-вожак',make:(x,z)=>makeGoblin(GOB.chief,x,z)},
  {k:'veteran',label:'Гоблин-ветеран (элита)',make:(x,z)=>applyElite(makeGoblin(GOB.veteran,x,z))},
  {k:'skeleton',label:'Скелет-страж',make:makeSkeleton},
  {k:'knight',label:'Скелет-рыцарь (элита)',make:makeSkeletonKnight},
  {k:'cultist',label:'Культист Костепёра',make:(x,z)=>makeCultist('cultist',x,z)},
  {k:'acolyte',label:'Ученик Костепёра (элита)',make:(x,z)=>makeCultist('acolyte',x,z)},
  {k:'deep',label:'Культист Глубин',make:(x,z)=>makeCultist('deep',x,z)},
  {k:'drowned',label:'Утопленник',make:makeDrowned},
  {k:'ogre',label:'Огр перевала',make:makeOgre},
  {k:'grat',label:'★ Грат Костолом (босс)',make:makeGrat},
  {k:'necro',label:'★ Вхорил Костепёр (босс)',make:(x,z)=>placeUnit(makeNecro(),x,z)},
  {k:'ulva',label:'★ Ульва, Матерь Топей (босс)',make:(x,z)=>placeUnit(makeUlva(),x,z)},
  {k:'garrum',label:'★ Гаррум Камнегрыз (босс)',make:(x,z)=>placeUnit(makeGarrum(),x,z)},
  {k:'malveh',label:'★ Малвех, лорд-комендант (босс)',make:(x,z)=>placeUnit(makeMalveh(),x,z)},
  {k:'ilva',label:'Илва (спутница)',make:makeIlva},
  {k:'kaya',label:'Кая (спутница)',make:makeKaya},
  {k:'olkha',label:'Ольха (спутница)',make:makeOlkha},
  {k:'haldir',label:'Хальдир (спутница)',make:makeHaldir},
];

const ABIL_RU:Record<Abil,string>={str:'СИЛ',dex:'ЛОВ',con:'Тел',int:'ИНТ',wis:'МДР',cha:'ХАР'};
const ABIL_OPTS:[string,string][]=(['str','dex','con','int','wis','cha'] as const).map(a=>[a,ABIL_RU[a]]);
const STATUS_RU:Record<StatusType,string>={
  burn:'горение',poison:'яд',bless:'благословение',fear:'страх',dodge:'уклонение',faith:'вера'};

/* ---------- служебное ---------- */
function findUnit(id:number):Unit|null{
  return units.find(u=>u.id===id)||barrels.find(b=>b.id===id)||null;
}
function edLog(msg:string){edPushLog(msg);}

/* подсветка выбранного: кольцо фигурки красим в cyan, прежний цвет помним */
let ringSaved:{mesh:THREE.Object3D;hex:number}|null=null;
function paintRing(u:Unit,on:boolean){
  const ring=u.mesh.userData.ring as THREE.Mesh|undefined;
  if(!ring)return;
  const mat=(ring as unknown as {material:{color:{getHex():number;setHex(h:number):void}}}).material;
  if(!mat||!mat.color)return;
  if(on){ringSaved={mesh:u.mesh,hex:mat.color.getHex()};mat.color.setHex(0x38c8ff);}
  else if(ringSaved&&ringSaved.mesh===u.mesh){mat.color.setHex(ringSaved.hex);ringSaved=null;}
}

/* валидная свободная клетка рядом с запросом (спираль по чебышёву) */
function freeNear(x:number,z:number):[number,number]{
  for(let r=0;r<=5;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
    const nx=clamp(x+dx,0,GRID-1),nz=clamp(z+dz,0,GRID-1);
    if(passable(GW,nx,nz,null)&&!unitAt(GW,nx,nz,null))return [nx,nz];
  }
  return [clamp(x,0,GRID-1),clamp(z,0,GRID-1)];
}
function placeUnit(u:Unit,x:number,z:number):Unit{
  const [fx,fz]=freeNear(clamp(x,0,GRID-1),clamp(z,0,GRID-1));
  u.x=fx;u.z=fz;
  u.mesh.position.set(W(fx),0,W(fz));
  return u;
}
/* «пришить» mesh-позицию к x/z после правки координат инспектором */
function syncMesh(u:Unit){
  const [fx,fz]=freeNear(u.x,u.z);
  u.x=fx;u.z=fz;
  u.mesh.position.set(W(fx),0,W(fz));
}
function camTile():[number,number]{
  return [clamp(Math.round(controls.target.x/TILE+HALF),0,GRID-1),
    clamp(Math.round(controls.target.z/TILE+HALF),0,GRID-1)];
}

/* ---------- иерархия сцены (Hierarchy) ---------- */
function treeRows(){
  const row=(u:Unit)=>{
    const kind=u.isBarrel?'Бочка':(u.clsName||u.cls);
    const marks=(u.isBoss?' ★':'')+(u.elite?' · элита':'');
    return {id:u.id,label:(u.short||u.name)+(u.alive?'':' ☠'),
      sub:kind+marks,side:u.side,alive:u.alive,boss:!!u.isBoss,barrel:!!u.isBarrel};
  };
  return [
    ...units.filter(u=>u.side==='hero').map(row),
    ...units.filter(u=>u.side!=='hero'&&!u.isBarrel).map(row),
    ...barrels.map(row),
  ];
}

/* ---------- инспектор юнита ---------- */
interface Sec{title:string;rows:{k:string;label:string;type:'num'|'int'|'bool'|'str'|'sel';
  value:number|boolean|string;min?:number;max?:number;step?:number;opts?:[string,string][]}[]}
function inspSections(u:Unit):Sec[]{
  const f=(k:string,label:string,type:'num'|'int'|'bool'|'str'|'sel',
    value:number|boolean|string,extra?:{min?:number;max?:number;step?:number;opts?:[string,string][]}) =>
    ({k,label,type,value,...(extra||{})});
  const sec:Sec[]=[];
  if(u.weapon){
    sec.push({title:'Состояние',rows:[
      f('name','Имя','str',u.name),
      f('hp','Хиты','int',u.hp,{min:0,max:999}),
      f('maxhp','Макс. хиты','int',u.maxhp,{min:1,max:999}),
      f('ac','КД (защита)','int',u.ac,{min:1,max:40}),
      f('speed','Скорость (кл./ход)','int',u.speed,{min:0,max:30}),
    ]});
    sec.push({title:'Ресурсы хода',rows:[
      f('action','Действия','int',u.action,{min:0,max:5}),
      f('bonus','Бонусные действия','int',u.bonus,{min:0,max:5}),
      f('moveLeft','Шаги осталось','int',u.moveLeft,{min:0,max:60}),
      f('slots','Ячейки заклинаний','int',u.slots,{min:0,max:9}),
      f('potions','Зелья','int',u.potions,{min:0,max:9}),
    ]});
    sec.push({title:'Атрибуты',rows:[
      ...(['str','dex','con','int','wis','cha'] as const).map(a=>f(a,ABIL_RU[a],'int',u[a],{min:1,max:30})),
      f('level','Уровень','int',u.level,{min:1,max:20}),
      f('xp','Опыт','int',u.xp,{min:0,max:999999}),
    ]});
    sec.push({title:'Оружие',rows:[
      f('weaponName','Название','str',u.weapon.name),
      f('weaponN','Кость: количество','int',u.weapon.dice[0],{min:0,max:9}),
      f('weaponD','Кость: грани','int',u.weapon.dice[1],{min:2,max:20}),
      f('weaponRange','Дальность (кл.)','int',u.weapon.range,{min:1,max:14}),
      f('weaponAbil','Характеристика','sel',u.weapon.abil,{opts:ABIL_OPTS}),
      f('dmgBonus','Бонус урона','int',u.dmgBonus??0,{min:-5,max:20}),
    ]});
  }else{/* бочка/урна — частичный юнит */
    sec.push({title:'Контейнер',rows:[
      f('hp','Хиты','int',u.hp,{min:0,max:999}),
      f('maxhp','Макс. хиты','int',u.maxhp,{min:1,max:999}),
    ]});
  }
  sec.push({title:'Позиция и вид',rows:[
    f('x','X (0–27)','int',u.x,{min:0,max:GRID-1}),
    f('z','Z (0–27)','int',u.z,{min:0,max:GRID-1}),
    f('scale','Размер фигурки','num',u.mesh.scale.x,{min:0.3,max:3,step:0.05}),
    f('elite','Элита','bool',!!u.elite),
    f('keepDist','Держит дистанцию (ИИ)','bool',!!u.keepDist),
    f('healer','Целитель (ИИ)','bool',!!u.healer),
  ]});
  return sec;
}

/* ---------- глобальные параметры (вкладка «Мир») ---------- */
function globalsSections():Sec[]{
  return [
    {title:'Мир',rows:[
      {k:'mapId',label:'Карта',type:'sel',value:G.mapId as string,
        opts:Object.entries(MAP_NAME).map(([v,l])=>[v,l]) as [string,string][]},
      {k:'seasonForced',label:'Сезон Глубин',type:'sel',
        value:G.seasonForced===null?'real':String(G.seasonForced),
        opts:[['real','Реальная неделя'],['-1','Вне сезона'],['0','Кровавый прилив'],
          ['1','Костяная стужа'],['2','Мора глубин'],['3','Ярость толпы'],['4','Дань глубин']]},
    ]},
    {title:'Экономика и время',rows:[
      {k:'gold',label:'Золото отряда',type:'int',value:S.gold,min:0,max:999999},
      {k:'timeScale',label:'Темп времени ×',type:'num',value:G.timeScale,min:0.1,max:3,step:0.1},
      {k:'fpsLimit',label:'Лимит FPS (0 — макс)',type:'int',value:G.fpsLimit,min:0,max:120},
    ]},
    {title:'Графика (панель G)',rows:[
      {k:'bloom',label:'Bloom-пасс',type:'bool',value:gfx.bloom},
      {k:'grade',label:'Кинолюк',type:'bool',value:gfx.grade!==false},
      {k:'sky',label:'Небо и облака',type:'bool',value:gfx.sky!==false},
    ]},
  ];
}

/* ---------- применение правок ---------- */
const NUM_KEYS=new Set(['hp','maxhp','ac','speed','action','bonus','moveLeft','slots','potions',
  'str','dex','con','int','wis','cha','level','xp','weaponN','weaponD','weaponRange','dmgBonus','x','z']);
function applyUnitField(u:Unit,k:string,v:number|boolean|string){
  const num=typeof v==='number'?v:(parseFloat(String(v))||0);
  if(u.weapon&&NUM_KEYS.has(k)){
    switch(k){
      case 'hp':
        if(u.alive&&num<=0){damageUnit(u,999,null);edLog(u.name+' — добит уроном (лут/опыт по правилам).');}
        else u.hp=Math.round(clamp(num,0,u.maxhp));
        break;
      case 'maxhp':u.maxhp=Math.max(1,Math.round(num));u.hp=Math.min(u.hp,u.maxhp);break;
      case 'ac':u.ac=Math.round(clamp(num,1,40));break;
      case 'speed':u.speed=Math.round(clamp(num,0,30));break;
      case 'action':u.action=Math.round(clamp(num,0,5));break;
      case 'bonus':u.bonus=Math.round(clamp(num,0,5));break;
      case 'moveLeft':u.moveLeft=Math.round(clamp(num,0,60));break;
      case 'slots':u.slots=Math.round(clamp(num,0,9));u.slotsMax=Math.max(u.slotsMax,u.slots);break;
      case 'potions':u.potions=Math.round(clamp(num,0,9));break;
      case 'weaponN':u.weapon.dice[0]=Math.round(clamp(num,0,9));break;
      case 'weaponD':u.weapon.dice[1]=Math.round(clamp(num,2,20));break;
      case 'weaponRange':u.weapon.range=Math.round(clamp(num,1,14));break;
      case 'dmgBonus':u.dmgBonus=Math.round(clamp(num,-5,20));break;
      case 'level':u.level=Math.round(clamp(num,1,20));break;
      case 'xp':u.xp=Math.max(0,Math.round(num));break;
      case 'x':case 'z':syncMesh(u);break;
      default:(u as unknown as Record<string,number>)[k]=Math.round(clamp(num,1,30));break;
    }
    return;
  }
  switch(k){
    case 'name':if(typeof v==='string'&&v.trim())u.name=v.trim();break;
    case 'weaponName':if(u.weapon&&typeof v==='string'&&v.trim())u.weapon.name=v.trim();break;
    case 'weaponAbil':if(u.weapon)u.weapon.abil=String(v) as Abil;break;
    case 'hp':/* контейнер без weapon */
      if(u.alive&&num<=0){damageUnit(u,999,null);}else u.hp=Math.round(clamp(num,0,u.maxhp));break;
    case 'maxhp':u.maxhp=Math.max(1,Math.round(num));u.hp=Math.min(u.hp,u.maxhp);break;
    case 'x':u.x=Math.round(clamp(num,0,GRID-1));syncMesh(u);break;
    case 'z':u.z=Math.round(clamp(num,0,GRID-1));syncMesh(u);break;
    case 'scale':u.mesh.scale.setScalar(clamp(num,0.3,3));break;
    case 'elite':
      if(v&&!u.elite)applyElite(u);
      else if(!v&&u.elite){u.elite=false;edLog('Флаг элиты снят (размер и кольцо не откатываются).');}
      break;
    case 'keepDist':u.keepDist=!!v;break;
    case 'healer':u.healer=!!v;break;
    default:edLog('Поле «'+k+'» не редактируется.');
  }
}
export function edSetField(id:number,k:string,v:number|boolean|string){
  const u=findUnit(id);
  if(!u){edLog('Юнит #'+id+' не найден.');return;}
  applyUnitField(u,k,v);
  bus.refreshUI.call();bus.refreshParty.call();
  if(useEd.getState().selId===id)uiEdSet({insp:inspSections(u)});
  else uiEdSet(s=>({tree:treeRows(),treeVer:s.treeVer+1}));
}
export function edStatus(id:number,k:string,turns:number){
  const u=findUnit(id);
  if(!u)return;
  u.statuses.push({type:k as StatusType,turns:Math.max(1,Math.round(turns))});
  edLog(u.name+': статус «'+(STATUS_RU[k as StatusType]||k)+'» на '+turns+' х.');
  if(useEd.getState().selId===id)uiEdSet({insp:inspSections(u)});
}
export function edStatusClear(id:number){
  const u=findUnit(id);
  if(!u)return;
  u.statuses.length=0;
  edLog(u.name+': статусы очищены.');
  if(useEd.getState().selId===id)uiEdSet({insp:inspSections(u)});
}
function applyGlobal(k:string,v:number|boolean|string){
  const num=typeof v==='number'?v:(parseFloat(String(v))||0);
  switch(k){
    case 'gold':S.gold=Math.max(0,Math.round(num));bus.refreshTracker.call();break;
    case 'timeScale':G.timeScale=clamp(num,0.1,3);uiEdSet({timeScale:G.timeScale});break;
    case 'fpsLimit':G.fpsLimit=Math.round(clamp(num,0,120));break;
    case 'bloom':gfx.bloom=!!v;applyGfx();break;
    case 'grade':gfx.grade=!!v;applyGfx();break;
    case 'sky':gfx.sky=!!v;applyGfx();break;
    case 'mapId':void switchMap(String(v) as MapId).then(()=>{edLog('Карта: '+(MAP_NAME[String(v) as MapId]||v));refreshAll();});break;
    case 'seasonForced':{
      const s=String(v);
      forceSeason(s==='real'?null:parseInt(s,10));
      edLog('Сезон Глубин: '+(s==='real'?'реальная неделя':s));
      break;}
    default:edLog('Параметр «'+k+'» не редактируется.');
  }
}
export function edGlobalsSet(k:string,v:number|boolean|string){
  applyGlobal(k,v);
  uiEdSet({globals:globalsSections()});
}

/* ---------- действия над юнитом ---------- */
export function edSelect(id:number|null){
  const prev=useEd.getState().selId;
  if(prev!=null){const pu=findUnit(prev);if(pu)paintRing(pu,false);}
  if(id==null){uiEdSet({selId:null,insp:null});return;}
  const u=findUnit(id);
  if(!u){uiEdSet({selId:null,insp:null});return;}
  paintRing(u,true);
  uiEdSet({selId:id,insp:inspSections(u),tab:'unit'});
}
export function edHeal(id:number){
  const u=findUnit(id);if(!u)return;
  if(!u.alive){edLog(u.name+' мёртв — лечение невозможно (уберите и заспавните нового).');return;}
  u.hp=u.maxhp;
  edLog(u.name+' исцелён до '+u.maxhp+' хитов.');
  bus.refreshUI.call();bus.refreshParty.call();
  if(useEd.getState().selId===id)uiEdSet({insp:inspSections(u)});
}
export function edKill(id:number){
  const u=findUnit(id);if(!u)return;
  if(!u.alive){edLog(u.name+' уже мёртв.');return;}
  damageUnit(u,999,null);
  edLog(u.name+' добит редактором (лут/опыт по правилам).');
}
export function edDelete(id:number){
  const u=findUnit(id);if(!u)return;
  if(G.current===u){edLog('Нельзя убирать юнита активного хода — передайте ход.');return;}
  paintRing(u,false);
  removeUnit(u);
  if(u.isBarrel){const i=barrels.indexOf(u);if(i>=0)barrels.splice(i,1);}
  const oi=G.order.indexOf(u);if(oi>=0)G.order.splice(oi,1);
  for(const g of [S.patrolGroup,S.campGroup,S.combatGroup,S.cryptGroup,S.swampGroup,S.giantsGroup,S.citadelGroup]){
    const gi=g.indexOf(u);if(gi>=0)g.splice(gi,1);
  }
  edLog('Убрано из сцены: '+u.name);
  if(useEd.getState().selId===id)uiEdSet({selId:null,insp:null});
  refreshAll();
}
export function edFocus(id:number){
  const u=findUnit(id);if(!u)return;
  const p=u.mesh.position;
  controls.target.set(p.x,0.6,p.z);
  const dir=camera.position.clone().sub(controls.target);
  dir.y=Math.max(dir.y,7);
  const len=Math.min(Math.max(dir.length(),10),20);
  camera.position.copy(controls.target).add(dir.normalize().multiplyScalar(len));
  edLog('Камера наведена: '+u.name);
}
export function edSpawn(k:string){
  const def=ED_SPAWN.find(s=>s.k===k);
  if(!def){edLog('Неизвестный спавн: '+k);return;}
  const [tx,tz]=camTile();
  const [x,z]=freeNear(tx,tz);
  const u=def.make(x,z);
  edLog('Заспавнен: '+u.name+' ('+u.x+','+u.z+') — камера наведена.');
  refreshAll();
  edSelect(u.id);
  edFocus(u.id);
  void upgradeUnitRig(u,animOptsFor(u)).then(ok=>{
    edLog(ok?('Риг подключен: '+u.name):(u.name+' — Synty-рига нет, осталась капсула.'));
  }).catch(()=>{edLog(u.name+' — риг не подключился (капсула).');});
}

/* ---------- пауза / шаг / темп ---------- */
export function edSetPaused(p:boolean){
  G.paused=!!p;
  uiEdSet({paused:G.paused});
  edLog(G.paused?'ПАУЗА: симуляция стоит, рендер и камера живут (надёжнее вне боя).':'PLAY: симуляция идёт.');
}
export function edStep(){
  if(!G.paused){edLog('Шаг доступен только на паузе (⏸).');return;}
  G.stepOnce=true;
  edLog('Шаг: один кадр симуляции.');
}
export function edSetTime(v:number){
  G.timeScale=clamp(v,0.1,3);
  uiEdSet({timeScale:G.timeScale});
  edLog('Темп времени ×'+G.timeScale.toFixed(1));
}

/* ---------- открытие/закрытие + выбор кликом ---------- */
export function edIsOpen(){return useEd.getState().open;}
export function edOpen(){
  uiEdSet({open:true});
  refreshAll();
  edLog('Кузница открыта. Клавиша ` (ё) — открыть/скрыть.');
}
export function edClose(){
  const st=useEd.getState();
  if(st.selId!=null){const u=findUnit(st.selId);if(u)paintRing(u,false);}
  uiEdSet({open:false,selId:null,insp:null});
}
export function edToggle(){if(useEd.getState().open)edClose();else edOpen();}
export function edSpawnKeys(){return ED_SPAWN.map(d=>d.k);}

function refreshAll(){
  uiEdSet(s=>({tree:treeRows(),treeVer:s.treeVer+1,globals:globalsSections(),
    spawnList:ED_SPAWN.map(d=>({k:d.k,label:d.label}))}));
  const sel=useEd.getState().selId;
  if(sel!=null){const u=findUnit(sel);uiEdSet({insp:u?inspSections(u):null});}
}

/* capture-фаза на document: перехватываем клик ДО игрового обработчика
   (обработчик игры висит на самом канвасе — capture-листенеры предков
   гарантированно срабатывают раньше листенеров цели) */
export function bindEditor():()=>void{
  const onUp=(e:PointerEvent)=>{
    const st=useEd.getState();
    if(!st.open||!st.pickMode)return;
    if(!(e.target===renderer.domElement))return;
    if(pick.ent){edSelect(pick.ent.id);e.stopPropagation();e.preventDefault();}
  };
  document.addEventListener('pointerup',onUp,true);
  /* лёгкий тик: дерево/глобалы/инспектор отражают жизнь сцены (смерти, ходы) */
  const iv=setInterval(()=>{
    if(!useEd.getState().open)return;
    uiEdSet(s=>({tree:treeRows(),treeVer:s.treeVer+1,globals:globalsSections()}));
    const sel=useEd.getState().selId;
    if(sel!=null){const u=findUnit(sel);if(u)uiEdSet({insp:inspSections(u)});}
  },1200);
  return ()=>{document.removeEventListener('pointerup',onUp,true);clearInterval(iv);};
}

/* ---------- биндинги колбэков панели (side-effect при загрузке, как в settings.ts) ---------- */
uiEdSet(s=>({act:{...s.act,
  setOpen:(o)=>o?edOpen():edClose(),
  setPaused:edSetPaused,
  step:edStep,
  setTime:edSetTime,
  setTab:(t)=>uiEdSet({tab:t}),
  select:(id)=>edSelect(id),
  setField:(k,v)=>{const sel=useEd.getState().selId;if(sel!=null)edSetField(sel,k,v);},
  status:(k,t)=>{const sel=useEd.getState().selId;if(sel!=null)edStatus(sel,k,t);},
  statusClear:()=>{const sel=useEd.getState().selId;if(sel!=null)edStatusClear(sel);},
  heal:()=>{const sel=useEd.getState().selId;if(sel!=null)edHeal(sel);},
  kill:()=>{const sel=useEd.getState().selId;if(sel!=null)edKill(sel);},
  del:()=>{const sel=useEd.getState().selId;if(sel!=null)edDelete(sel);},
  focus:()=>{const sel=useEd.getState().selId;if(sel!=null)edFocus(sel);},
  spawn:edSpawn,
  setPick:(b)=>uiEdSet({pickMode:b}),
  clearLog:()=>uiEdSet({log:[]}),
}}));
