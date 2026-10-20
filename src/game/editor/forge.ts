/* ================= FORGE (v3.4 «Мастерская») =================
   Расширение кузницы до полноценного редактора «как в Unity»:
   • Гизмо TransformControls — перемещение/поворот/масштаб выбранного
     юнита (W/E/R), шаг сетки на отпускании (x/z всегда целые клетки);
   • фокус камеры по двойному клику в иерархии (мост зовёт edFocus);
   • «кисть»: выбранный спавн/декор ставится кликом по земле;
   • drag&drop: из палитры/иерархии на канвас (спавн юнита, декор,
     перенос юнита на клетку);
   • дублирование юнита (кнопка/Ctrl+D) — та же фабрика или шаблон;
   • редактор анимаций рига: клипы/скорость/перезагрузка рига;
   • декор мира: каталог POLYGON Nature, постановка/удаление/правка,
     persist в localStorage и восстановление после сборки карты;
   • правка диалогов: обёртка DLGS (dlgEd.ts) + редактор узла.
   Модуль НЕ импортирует bridge.ts (одно направление: bridge → forge);
   колбэки моста приходят через initForge(). */
import * as THREE from 'three/webgpu';
import { G, units, barrels, pick, GW } from '../state';
import { TILE, GRID, HALF, W } from '../constants';
import { clamp } from '../utils';
import { passable, unitAt } from '../world/grid';
import { camera, controls, renderer, scene } from '../render/renderer';
import { makeUnit } from '../entities/units';
import { GOB, makeGoblin, makeSkeleton, makeSkeletonKnight, makeCultist,
  makeDrowned, makeOgre, makeGrat, makeNecro, makeUlva, makeGarrum, makeMalveh,
  makeIlva, makeKaya, makeOlkha, makeHaldir, applyElite } from '../entities/roster';
import { upgradeUnitRig, animOptsFor } from '../animation';
import type { Unit } from '../types';
import { useEd, uiEdSet, type GizmoMode } from '../ui/editorStore';
import { initGizmo, gizmoAttach, gizmoDetach, gizmoSetMode, gizmoSetSnap,
  gizmoHovering, gizmoDragging, gizmoAttached } from './gizmo';
import { ED_PROPS, edPlaceProp, edPropList, edPropById, edPropSelect, propLabel,
  syncProps, type EdProp } from './worldEd';
import { dlgEdStats } from './dlgEd';

/* ---------- колбэки моста (инижектируются bridge.ts) ---------- */
export interface ForgeApi{
  log:(m:string)=>void;
  select:(id:number|null)=>void;
  focus:(id:number)=>void;
  refreshTree:()=>void;
  findUnit:(id:number)=>Unit|null;
}
let api:ForgeApi={log:()=>{},select:()=>{},focus:()=>{},refreshTree:()=>{},findUnit:()=>null};
export function initForge(a:ForgeApi):void{api=a;}
function log(m:string):void{api.log(m);}

/* ---------- служебное (копии bridge-хелперов — без цикла) ---------- */
function freeNear(x:number,z:number):[number,number]{
  for(let r=0;r<=5;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
    const nx=clamp(x+dx,0,GRID-1),nz=clamp(z+dz,0,GRID-1);
    if(passable(GW,nx,nz,null)&&!unitAt(GW,nx,nz,null))return [nx,nz];
  }
  return [clamp(x,0,GRID-1),clamp(z,0,GRID-1)];
}
function camTile():[number,number]{
  return [clamp(Math.round(controls.target.x/TILE+HALF),0,GRID-1),
    clamp(Math.round(controls.target.z/TILE+HALF),0,GRID-1)];
}
function placeUnit(u:Unit,x:number,z:number):Unit{
  const [fx,fz]=freeNear(clamp(x,0,GRID-1),clamp(z,0,GRID-1));
  u.x=fx;u.z=fz;
  u.mesh.position.set(W(fx),0,W(fz));
  return u;
}
/* клетка из события мыши (луч в плоскость земли) */
const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();
const ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function tileFromEvent(e:{clientX:number;clientY:number}):[number,number]|null{
  ptr.x=(e.clientX/innerWidth)*2-1;
  ptr.y=-(e.clientY/innerHeight)*2+1;
  ray.setFromCamera(ptr,camera);
  const p=new THREE.Vector3();
  if(!ray.ray.intersectPlane(ground,p))return null;
  const tx=Math.round(p.x/TILE+HALF),tz=Math.round(p.z/TILE+HALF);
  if(tx<0||tx>=GRID||tz<0||tz>=GRID)return null;
  return [tx,tz];
}
/* декор под курсором (луч по мешам пропов) */
function propFromEvent(e:{clientX:number;clientY:number}):EdProp|null{
  ptr.x=(e.clientX/innerWidth)*2-1;
  ptr.y=-(e.clientY/innerHeight)*2+1;
  ray.setFromCamera(ptr,camera);
  const hits=ray.intersectObjects(edPropList().map(p=>p.mesh),true);
  if(!hits.length)return null;
  let o:THREE.Object3D|null=hits[0].object;
  while(o&&o.userData.edPropId===undefined)o=o.parent;
  return o?edPropById(o.userData.edPropId as number):null;
}

/* ---------- каталог спавна (переехал из bridge v3.3) ---------- */
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
const spawnKeys=new WeakMap<Unit,string>();
export function edSpawnAt(k:string,x?:number,z?:number):Unit|null{
  const def=ED_SPAWN.find(s=>s.k===k);
  if(!def){log('Неизвестный спавн: '+k);return null;}
  const [cx,cz]=camTile();
  const tx=x??cx,tz=z??cz;
  const [fx,fz]=freeNear(clamp(tx,0,GRID-1),clamp(tz,0,GRID-1));
  const u=def.make(fx,fz);
  spawnKeys.set(u,k);
  log('Заспавнен: '+u.name+' ('+u.x+','+u.z+')');
  api.refreshTree();
  api.select(u.id);
  api.focus(u.id);
  void upgradeUnitRig(u,animOptsFor(u)).then(ok=>{
    log(ok?('Риг подключен: '+u.name):(u.name+' — Synty-рига нет, осталась капсула.'));
  }).catch(()=>{log(u.name+' — риг не подключился (капсула).');});
  return u;
}

/* ---------- дублирование юнита ---------- */
const CLS_SPAWN:Record<string,string>={goblin:'bruiser',undead:'skeleton',
  cultist:'cultist',necro:'necro',ogre:'ogre',drowned:'drowned',swampboss:'ulva'};
function spawnKeyOf(u:Unit):string|null{
  const k=spawnKeys.get(u);
  if(k)return k;
  if(u.isBarrel)return null;
  if(u.cls&&CLS_SPAWN[u.cls])return CLS_SPAWN[u.cls];
  return null;
}
export function edDuplicateUnit(id:number):void{
  const u=api.findUnit(id);
  if(!u)return;
  if(u.isBarrel){log('Бочку нельзя дублировать (контейнер карты).');return;}
  const k=spawnKeyOf(u);
  let nu:Unit|null=null;
  if(k){
    nu=edSpawnAt(k,u.x+1,u.z);
    if(!nu)return;
  }else{
    /* шаблонный клон (герои/NPC/боссы без фабрики): makeUnit с копией профиля */
    nu=makeUnit({
      x:0,z:0,
      name:u.name+' (копия)',short:(u.short||u.name).slice(0,9)+'к',
      cls:u.cls,clsName:u.clsName,side:u.side,
      hp:u.hp,maxhp:u.maxhp,ac:u.ac,speed:u.speed,
      str:u.str,dex:u.dex,con:u.con,int:u.int,wis:u.wis,cha:u.cha,
      prof:u.prof,level:u.level,xp:u.xp,
      color:u.color,skin:u.skin,tipColor:u.tipColor,
      features:[...u.features],
      weapon:{...u.weapon,dice:[...u.weapon.dice]},
      dagger:u.dagger?{...u.dagger,dice:[...u.dagger.dice]}:null,
      slots:u.slots,slotsMax:Math.max(u.slotsMax,u.slots),potions:u.potions,
      keepDist:u.keepDist,healer:u.healer,caster:u.caster,
      aura:u.aura,atkBonus:u.atkBonus,dmgBonus:u.dmgBonus,
    });
    placeUnit(nu,u.x+1,u.z);
    void upgradeUnitRig(nu,animOptsFor(nu)).catch(()=>{ });
    log('Создан шаблонный клон: '+nu.name);
    api.refreshTree();
    api.select(nu.id);
  }
  /* скопировать боевой профиль источника на клона (для фабричного пути) */
  if(nu&&k){
    nu.name=u.name+' (копия)';
    nu.hp=u.hp;nu.maxhp=u.maxhp;nu.ac=u.ac;nu.speed=u.speed;
    nu.level=u.level;nu.xp=u.xp;
    nu.str=u.str;nu.dex=u.dex;nu.con=u.con;nu.int=u.int;nu.wis=u.wis;nu.cha=u.cha;
    nu.weapon={...u.weapon,dice:[...u.weapon.dice]};
    if(u.dagger)nu.dagger={...u.dagger,dice:[...u.dagger.dice]};
    nu.dmgBonus=u.dmgBonus;nu.keepDist=u.keepDist;nu.healer=u.healer;nu.caster=u.caster;
    nu.slots=u.slots;nu.slotsMax=Math.max(u.slotsMax,u.slots);nu.potions=u.potions;
    if(u.elite&&!nu.elite)applyElite(nu);
    nu.hp=u.hp;nu.maxhp=u.maxhp;/* applyElite мог поднять статы — вернуть профиль */
    log(u.name+' → дубликат создан: '+nu.name);
    api.select(nu.id);
  }
}

/* ---------- гизмо: применение правок к юниту ---------- */
function tileOfMesh(u:Unit):[number,number]{
  return [clamp(Math.round(u.mesh.position.x/TILE+HALF),0,GRID-1),
    clamp(Math.round(u.mesh.position.z/TILE+HALF),0,GRID-1)];
}
function gizmoChange(mode:GizmoMode):void{
  const sel=useEd.getState().selId;
  const u=sel!=null?api.findUnit(sel):null;
  if(!u||u.isBarrel)return;
  /* поворот виден вживую; клетка/масштаб применяются на отпускании (gizmoEnd) */
  void mode;
}
function gizmoEnd():void{
  const sel=useEd.getState().selId;
  const u=sel!=null?api.findUnit(sel):null;
  if(!u||u.isBarrel)return;
  const mode=useEd.getState().gizmoMode;
  if(mode==='move'){
    const [tx,tz]=tileOfMesh(u);
    u.x=tx;u.z=tz;
    u.mesh.position.set(W(tx),0,W(tz));
    log(u.name+' перемещён на клетку ('+tx+','+tz+').');
    api.refreshTree();
  }else if(mode==='rotate'){
    const snap=useEd.getState().snap;
    let ry=u.mesh.rotation.y;
    if(snap)ry=Math.round(ry/(Math.PI/12))*(Math.PI/12);
    u.mesh.rotation.set(0,ry,0);
    log(u.name+' повёрнут на '+Math.round(ry*180/Math.PI)+'°.');
  }else if(mode==='scale'){
    const s=clamp((u.mesh.scale.x+u.mesh.scale.y+u.mesh.scale.z)/3,0.3,3);
    u.mesh.scale.setScalar(s);
    log(u.name+' масштаб ×'+s.toFixed(2)+'.');
  }
}
export function forgeOnSelect(u:Unit|null):void{
  if(!u||u.isBarrel){gizmoDetach();uiEdSet({animClips:[],animCur:'',animSpeed:1});return;}
  if(useEd.getState().gizmoMode!=='none')gizmoAttach(u.mesh);
  const clips=Object.keys((u as unknown as {_actions?:Record<string,unknown>})._actions||{});
  uiEdSet({animClips:clips,animCur:String((u as unknown as {_currentAnim?:string})._currentAnim||''),
    animSpeed:(u as unknown as {_mixer?:{timeScale:number}})._mixer?.timeScale??1});
}
export function forgeOnClose():void{gizmoDetach();}
export function forgeSetGizmo(m:GizmoMode):void{
  uiEdSet({gizmoMode:m});
  gizmoSetMode(m);
  const sel=useEd.getState().selId;
  const u=sel!=null?api.findUnit(sel):null;
  if(m==='none'||!u||u.isBarrel)gizmoDetach();
  else gizmoAttach(u.mesh);
}
export function forgeSetSnap(b:boolean):void{
  uiEdSet({snap:b});
  gizmoSetSnap(b);
  log('Шаг сетки: '+(b?'включен (поворот 15°, клетка на отпускании)':'выключен'));
}

/* ---------- анимации рига ---------- */
const ONCE=new Set(['attack','hit','death']);
export function edAnimPlay(name:string):void{
  const sel=useEd.getState().selId;
  const u=sel!=null?api.findUnit(sel):null;
  if(!u||u.isBarrel)return;
  const actions=(u as unknown as {_actions?:Record<string,THREE.AnimationAction>})._actions;
  const mixer=(u as unknown as {_mixer?:{timeScale:number}})._mixer;
  const a=actions?.[name];
  if(!a){log('Клип «'+name+'» у '+u.name+' не найден.');return;}
  if(!u.alive&&(name!=='death')){log(u.name+' мёртв — доступны только «death»/rig.');return;}
  for(const [k,act] of Object.entries(actions||{}))if(k!==name)act.fadeOut(0.12);
  a.reset();
  if(ONCE.has(name)){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=(name==='death');}
  else a.setLoop(THREE.LoopRepeat,Infinity);
  a.fadeIn(0.12).play();
  (u as unknown as {_currentAnim?:string})._currentAnim=name;
  uiEdSet({animCur:name});
  log(u.name+': проигрываю клип «'+name+'»'+(mixer?(' ×'+mixer.timeScale.toFixed(1)):'')+'.');
}
export function edAnimSpeed(v:number):void{
  const sel=useEd.getState().selId;
  const u=sel!=null?api.findUnit(sel):null;
  if(!u||u.isBarrel)return;
  const mixer=(u as unknown as {_mixer?:{timeScale:number}})._mixer;
  if(!mixer){log('У '+u.name+' нет рига-миксера (капсула).');return;}
  mixer.timeScale=clamp(v,0.1,3);
  uiEdSet({animSpeed:mixer.timeScale});
  log(u.name+': скорость анимаций ×'+mixer.timeScale.toFixed(1));
}
export function edRigReload():void{
  const sel=useEd.getState().selId;
  const u=sel!=null?api.findUnit(sel):null;
  if(!u||u.isBarrel)return;
  log(u.name+': перезагружаю Synty-риг…');
  void upgradeUnitRig(u,animOptsFor(u)).then(ok=>log(ok?'Риг перезагружен: '+u.name:'Не удалось: '+u.name))
    .catch(()=>log('Риг не перезагрузился (капсула).'));
}

/* ---------- постановка декора кистью (инспектор декора — в worldEd) ---------- */
function placePropAt(name:string,tx:number,tz:number):void{
  void edPlaceProp(G.mapId as string,name,tx,tz,{}).then(p=>{
    if(p){api.log('Декор поставлен: '+p.label+' ('+tx+','+tz+')');syncProps();}
    else api.log('Не удалось поставить декор: '+propLabel(name));
  });
}

/* ---------- кисть / drag&drop / выбор декора кликом ---------- *//* ---------- кисть / drag&drop / выбор декора кликом ---------- */
let brushDown=false;
function placeBrush(e:{clientX:number;clientY:number}):void{
  const brush=useEd.getState().brush;
  if(!brush)return;
  const t=tileFromEvent(e);
  if(!t){log('Мимо арены — кисть ставит только в границы сетки.');return;}
  if(brush.startsWith('prop:'))placePropAt(brush.slice(5),t[0],t[1]);
  else edSpawnAt(brush,t[0],t[1]);
}
function onDocDown(e:PointerEvent){
  const st=useEd.getState();
  if(!st.open)return;
  if(e.target!==renderer.domElement)return;
  if(gizmoHovering()||gizmoDragging())return;
  if(st.brush){e.preventDefault();e.stopPropagation();brushDown=true;}
}
function onDocUp(e:PointerEvent){
  const st=useEd.getState();
  if(!st.open)return;
  if(e.target!==renderer.domElement)return;
  if(gizmoDragging())return;/* гизмо само завершит drag */
  if(brushDown&&st.brush){brushDown=false;e.preventDefault();e.stopPropagation();placeBrush(e);return;}
  if(st.propPick){
    e.preventDefault();e.stopPropagation();
    const p=propFromEvent(e);
    if(p){log('Декор выбран: '+p.label);edPropSelect(p.id);}
    else{uiEdSet({propSel:null,propInsp:null});log('Клик мимо декора — выбор снят.');}
  }
}
function onCanvasDragOver(e:DragEvent){if(useEd.getState().open)e.preventDefault();}
function onCanvasDrop(e:DragEvent){
  if(!useEd.getState().open)return;
  e.preventDefault();
  const data=e.dataTransfer?.getData('text/bg3ed')||'';
  if(!data)return;
  const t=tileFromEvent(e);
  if(!t){log('Бросок мимо арены.');return;}
  if(data.startsWith('spawn:'))edSpawnAt(data.slice(6),t[0],t[1]);
  else if(data.startsWith('prop:'))placePropAt(data.slice(5),t[0],t[1]);
  else if(data.startsWith('move:')){
    const u=api.findUnit(parseInt(data.slice(5),10));
    if(u){u.x=t[0];u.z=t[1];u.mesh.position.set(W(t[0]),0,W(t[1]));log(u.name+' перенесён на ('+t[0]+','+t[1]+')');api.refreshTree();}
  }
}
function onKey(e:KeyboardEvent){
  const st=useEd.getState();
  if(!st.open)return;
  const tgt=e.target as HTMLElement|null;
  if(tgt&&tgt.closest&&tgt.closest('input,textarea,select'))return;
  const k=e.key.toLowerCase();
  if(e.ctrlKey&&k==='d'){e.preventDefault();e.stopPropagation();if(st.selId!=null)edDuplicateUnit(st.selId);return;}
  if(k==='w'||k==='ц'){e.stopPropagation();forgeSetGizmo('move');}
  else if(k==='e'||k==='у'){e.stopPropagation();forgeSetGizmo('rotate');}
  else if(k==='r'||k==='к'){e.stopPropagation();forgeSetGizmo('scale');}
  else if(k==='q'||k==='й'){e.stopPropagation();forgeSetGizmo('none');}
}
/* гард для игрового pointerup (engine.ts): гизмо перетаскиваем — клик не играем */
export function edClickGuard():boolean{
  return gizmoDragging()||gizmoHovering();
}
/* E2E-пробник */
export function edProbe():Record<string,unknown>{
  const st=useEd.getState();
  return {open:st.open,gizmoMode:st.gizmoMode,gizmoAttached:gizmoAttached(),
    snap:st.snap,brush:st.brush,pickMode:st.pickMode,selId:st.selId,
    props:edPropList().length,propSel:st.propSel,propPick:st.propPick,
    dlg:{npc:st.dlgNpc,node:st.dlgNode,nodes:st.dlgNodes.length,edits:dlgEdStats().edits},
    anim:{clips:st.animClips,cur:st.animCur,speed:st.animSpeed},
    spawnKeys:ED_SPAWN.length,propsCatalog:ED_PROPS.length,
    units:units.length,barrels:barrels.length,pickEnt:pick.ent?.id??null};
}
export function forgePropProbe(n:number):EdProp|null{return edPropById(n);}

/* ---------- биндинг слушателей (зовёт bridge.bindEditor) ---------- */
export function forgeBind():()=>void{
  initGizmo(camera,renderer.domElement,scene,controls,gizmoChange,gizmoEnd);
  gizmoSetSnap(useEd.getState().snap);
  document.addEventListener('pointerdown',onDocDown,true);
  document.addEventListener('pointerup',onDocUp,true);
  document.addEventListener('keydown',onKey,true);
  const el=renderer.domElement;
  el.addEventListener('dragover',onCanvasDragOver);
  el.addEventListener('drop',onCanvasDrop);
  return ()=>{document.removeEventListener('pointerdown',onDocDown,true);
    document.removeEventListener('pointerup',onDocUp,true);
    document.removeEventListener('keydown',onKey,true);
    el.removeEventListener('dragover',onCanvasDragOver);
    el.removeEventListener('drop',onCanvasDrop);};
}
