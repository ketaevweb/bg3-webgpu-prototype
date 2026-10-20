/* ================= WORLD DECOR EDITOR (v3.4 «Мастерская») =================
   Редактор мира: постановка моделей POLYGON Nature (деревья/кусты/камни/
   декор) по клеткам, удаление, поворот/масштаб/подъём и ПАМЯТЬ правок
   (localStorage bg3w_world_v1 — на каждую карту свой список). После
   buildMap() maps.ts зовёт restoreWorldEd(mapId) — расставленные игроком
   декорации возвращаются на место (и переживают reload страницы).
   Меши пишутся в worldGroup через placeNatureSync (общий кэш и ветра).
   Лист по зависимостям: three, nature, constants, state, utils. */
import * as THREE from 'three/webgpu';
import { key, clamp } from '../utils';
import { GRID, W } from '../constants';
import { solid, G } from '../state';
import { camera, controls } from '../render/renderer';
import { useEd, uiEdSet, edPushLog, type EdSection } from '../ui/editorStore';
import { placeNatureSync, type NatureOpts } from '../world/nature';

export interface EdProp{
  id:number;name:string;label:string;
  x:number;z:number;s:number;ry:number;y:number;solidCell:boolean;
  mesh:THREE.Object3D;
}

const props:EdProp[]=[];
let seq=0;
const LS_KEY='bg3w_world_v1';

/* ---------- каталог (v3.4) — модели гарантированно есть в паке ---------- */
export interface EdPropDef{name:string;label:string;h?:number;s?:number;solid?:boolean;group:string}
export const ED_PROPS:EdPropDef[]=[
  {name:'SM_Tree_Generic_Giant_01',label:'Дуб-гигант',h:4.6,group:'Деревья'},
  {name:'SM_Tree_Generic_01',label:'Дерево (обычное)',h:3.6,group:'Деревья'},
  {name:'SM_Tree_Round_01',label:'Дерево круглое',h:3.2,group:'Деревья'},
  {name:'SM_Tree_Birch_01',label:'Берёза',h:3.2,group:'Деревья'},
  {name:'SM_Tree_Willow_Medium_01',label:'Ива средняя',h:3.4,group:'Деревья'},
  {name:'SM_Tree_Willow_Large_01',label:'Ива большая',h:4.2,group:'Деревья'},
  {name:'SM_Tree_Pine_01',label:'Сосна',h:3.6,group:'Деревья'},
  {name:'SM_Tree_PolyPine_01',label:'Полипайн',h:3.4,group:'Деревья'},
  {name:'SM_Tree_Generic_Dead_01',label:'Сухостой',h:3.0,group:'Деревья'},
  {name:'SM_Tree_Swamp_Stump_01',label:'Болотный пень',h:1.2,group:'Деревья'},
  {name:'SM_Tree_Log_01',label:'Бревно',h:0.8,group:'Деревья'},
  {name:'SM_Plant_Bush_01',label:'Куст',s:0.6,group:'Кусты и травы'},
  {name:'SM_Plant_Bush_Leaves_01',label:'Куст лиственный',s:0.6,group:'Кусты и травы'},
  {name:'SM_Plant_Hedge_Bush_01',label:'Живая изгородь',s:0.7,group:'Кусты и травы'},
  {name:'SM_Plant_Grass_02',label:'Трава',s:0.55,group:'Кусты и травы'},
  {name:'SM_Plant_Fern_01',label:'Папоротник',s:0.55,group:'Кусты и травы'},
  {name:'SM_Plant_Undergrowth_01',label:'Подлесок',s:0.6,group:'Кусты и травы'},
  {name:'SM_Plant_Flowers_01',label:'Цветы',s:0.4,group:'Кусты и травы'},
  {name:'SM_Plant_PurpleFlower_01',label:'Фиолетовые цветы',s:0.4,group:'Кусты и травы'},
  {name:'SM_Plant_Reeds_01',label:'Камыш',s:0.6,group:'Кусты и травы'},
  {name:'SM_Plant_Mushrooms_01',label:'Грибы',s:0.4,group:'Кусты и травы'},
  {name:'SM_Rock_01',label:'Камень',s:0.7,group:'Камни'},
  {name:'SM_Rock_Rounded_01',label:'Валун округлый',s:0.7,group:'Камни'},
  {name:'SM_Rock_Boulder_01',label:'Валун-преграда',s:0.5,solid:true,group:'Камни'},
  {name:'SM_Rock_Pile_01',label:'Груда камней',s:0.7,group:'Камни'},
  {name:'SM_Rock_Cluster_Large_01',label:'Кластер камней',s:0.5,solid:true,group:'Камни'},
  {name:'SM_Rock_Wall_01',label:'Скальная стена',s:0.6,solid:true,group:'Камни'},
  {name:'SM_Prop_CampFire_01',label:'Костёр',s:0.5,group:'Декор'},
  {name:'SM_Prop_Chest_Wood_01',label:'Сундук',s:0.5,group:'Декор'},
  {name:'SM_Prop_Fence_01',label:'Забор',s:0.5,group:'Декор'},
  {name:'SM_Prop_RoadSign_01',label:'Дорожный указатель',s:0.5,group:'Декор'},
  {name:'SM_Prop_Grave_03',label:'Могила',s:0.5,group:'Декор'},
  {name:'SM_Prop_Skull_01',label:'Череп',s:0.4,group:'Декор'},
  {name:'SM_Prop_Skeleton_Ground_01',label:'Скелет (лежит)',s:0.5,group:'Декор'},
  {name:'SM_Prop_Pillar_01',label:'Колонна',s:0.5,solid:true,group:'Декор'},
  {name:'SM_Prop_Pillar_Broken_01',label:'Сломанная колонна',s:0.5,group:'Декор'},
  {name:'SM_Prop_StoneWall_01',label:'Каменная стена',s:0.5,solid:true,group:'Декор'},
  {name:'SM_Prop_TorchStick_01',label:'Факел',s:0.5,group:'Декор'},
];
export function propLabel(name:string):string{
  return ED_PROPS.find(d=>d.name===name)?.label||name;
}

/* ---------- реестр ---------- */
export function edPropList():EdProp[]{return props;}
export function edPropById(id:number):EdProp|null{return props.find(p=>p.id===id)||null;}
export function edPropCount():number{return props.length;}

function persist(mapId:string):void{
  try{
    const all=JSON.parse(localStorage.getItem(LS_KEY)||'{}') as Record<string,
      {name:string;x:number;z:number;s:number;ry:number;y:number;solidCell:boolean}[]>;
    all[mapId]=props.map(p=>({name:p.name,x:p.x,z:p.z,s:p.s,ry:p.ry,y:p.y,solidCell:p.solidCell}));
    localStorage.setItem(LS_KEY,JSON.stringify(all));
  }catch{/* приватный режим — правки только на сессию */}
}

/* снять клетку-преграду (учитывать только клетки, свободные у карты) */
function applySolid(p:EdProp,on:boolean,undo:boolean):void{
  const k=key(p.x,p.z);
  if(on&&p.solidCell&&!undo)solid.add(k);
  if(undo&&p.solidCell)solid.delete(k);
}

export function edPlaceProp(mapId:string,name:string,x:number,z:number,
  o:{s?:number;h?:number;ry?:number;solid?:boolean}):Promise<EdProp|null>{
  const def=ED_PROPS.find(d=>d.name===name);
  const opts:NatureOpts={s:o.s??def?.s,spin:false,ry:o.ry??0,solid:false};
  if(def?.h)opts.h=o.h??def.h;
  return placeNatureSync(name,x,z,opts).then(mesh=>{
    const p:EdProp={id:++seq,name,label:propLabel(name),x,z,
      s:o.s??(def?.s??(def?.h?1:1)),ry:o.ry??0,y:opts.y??0,
      solidCell:!!(o.solid??def?.solid),mesh};
    mesh.userData.edPropId=p.id;
    props.push(p);
    if(p.solidCell)solid.add(key(x,z));
    persist(mapId);
    return p;
  }).catch(()=>null);
}

export function edRemoveProp(mapId:string,p:EdProp):void{
  const i=props.indexOf(p);
  if(i<0)return;
  applySolid(p,false,true);
  p.mesh.parent?.remove(p.mesh);
  props.splice(i,1);
  persist(mapId);
}

export function edClearProps(mapId:string):void{
  for(const p of [...props])edRemoveProp(mapId,p);
}

/* правка положения/масштаба/поворота живого пропа (инспектор) */
export function edPropRelocate(mapId:string,p:EdProp,x:number,z:number):void{
  applySolid(p,false,true);
  p.x=x;p.z=z;
  p.mesh.position.set(W(x),p.y,W(z));
  if(p.solidCell)solid.add(key(x,z));
  persist(mapId);
}
export function edPropTransform(mapId:string,p:EdProp,s:number,ry:number,y:number):void{
  p.s=s;p.ry=ry;p.y=y;
  p.mesh.scale.setScalar(s);
  p.mesh.rotation.y=ry;
  p.mesh.position.y=y;
  persist(mapId);
}

/* ---------- восстановление после сборки карты ---------- */
export function restoreWorldEd(mapId:string):void{
  props.length=0;/* teardownWorld уже вычистил worldGroup — реестр сбрасываем */
  let all:Record<string,{name:string;x:number;z:number;s:number;ry:number;y:number;solidCell:boolean}[]>;
  try{all=JSON.parse(localStorage.getItem(LS_KEY)||'{}');}catch{all={};}
  const list=all[mapId]||[];
  for(const it of list){
    void edPlaceProp(mapId,it.name,it.x,it.z,{s:it.s,ry:it.ry,solid:it.solidCell});
  }
  if(list.length)console.log('[bg3] мир: восстановлено декораций:',list.length,'('+mapId+')');
}

/* E2E: статистика */
export function worldEdStats():{count:number} {
  return {count:props.length};
}

/* ================= WORLD DECOR EDITOR UI (v3.4) =================
   Инспектор пропа: секции полей (X/Z/масштаб/поворот/подъём/преграда),
   список/выбор/удаление/фокус/очистка. syncProps пишет стор. */
function propSections(p:EdProp):EdSection[]{
  const f=(k:string,label:string,type:'num'|'int'|'bool'|'str',value:number|boolean|string,
    extra?:{min?:number;max?:number;step?:number})=>({k,label,type,value,...(extra||{})});
  return [{title:'Декор: '+p.label,rows:[
    f('name','Модель','str',p.name),
    f('x','X (0–27)','int',p.x,{min:0,max:GRID-1}),
    f('z','Z (0–27)','int',p.z,{min:0,max:GRID-1}),
    f('s','Масштаб','num',p.s,{min:0.1,max:3,step:0.05}),
    f('ry','Поворот (°)','int',Math.round(p.ry*180/Math.PI),{min:-180,max:180,step:5}),
    f('y','Подъём (м)','num',p.y,{min:0,max:6,step:0.05}),
    f('solidCell','Преграда (клетка)','bool',p.solidCell),
  ]}];
}
export function syncProps():void{
  uiEdSet({props:edPropList().map(p=>({id:p.id,name:p.name,label:p.label,x:p.x,z:p.z}))});
  const sel=useEd.getState().propSel;
  const p=sel!=null?edPropById(sel):null;
  uiEdSet({propInsp:p?propSections(p):null});
}
export function edPropSelect(id:number|null):void{
  uiEdSet({propSel:id,tab:'decor'});
  syncProps();
  const p=id!=null?edPropById(id):null;
  if(p)log('Декор выбран: '+p.label);
}
export function edPropSetField(k:string,v:number|boolean|string):void{
  const sel=useEd.getState().propSel;
  const p=sel!=null?edPropById(sel):null;
  if(!p)return;
  const mapId=G.mapId as string;
  const num=typeof v==='number'?v:(parseFloat(String(v))||0);
  switch(k){
    case 'x':case 'z':{
      const nx=k==='x'?clamp(Math.round(num),0,GRID-1):p.x;
      const nz=k==='z'?clamp(Math.round(num),0,GRID-1):p.z;
      edPropRelocate(mapId,p,nx,nz);
      log(p.label+' переставлен ('+nx+','+nz+').');
      break;}
    case 's':edPropTransform(mapId,p,clamp(num,0.1,3),p.ry,p.y);break;
    case 'ry':edPropTransform(mapId,p,p.s,num*Math.PI/180,p.y);break;
    case 'y':edPropTransform(mapId,p,p.s,p.ry,clamp(num,0,6));break;
    case 'solidCell':
      if(!!v&&!p.solidCell){p.solidCell=true;log(p.label+': клетка-преграда добавлена.');}
      else if(!v&&p.solidCell){p.solidCell=false;log(p.label+': преграда снята.');}
      break;
    default:log('Поле декора «'+k+'» не редактируется.');
  }
  syncProps();
}
export function edPropDel():void{
  const sel=useEd.getState().propSel;
  const p=sel!=null?edPropById(sel):null;
  if(!p)return;
  edRemoveProp(G.mapId as string,p);
  log('Декор удалён: '+p.label);
  uiEdSet({propSel:null});
  syncProps();
}
export function edPropFocus():void{
  const sel=useEd.getState().propSel;
  const p=sel!=null?edPropById(sel):null;
  if(!p)return;
  const wp=p.mesh.position;
  controls.target.set(wp.x,0.6,wp.z);
  const dir=camera.position.clone().sub(controls.target);
  dir.y=Math.max(dir.y,7);
  const len=Math.min(Math.max(dir.length(),10),20);
  camera.position.copy(controls.target).add(dir.normalize().multiplyScalar(len));
}
export function edPropClear():void{
  edClearProps(G.mapId as string);
  uiEdSet({propSel:null,propInsp:null});
  syncProps();
  log('Все редакторские декорации карты убраны (правки карты стёрты).');
}


function log(m:string){edPushLog(m);}
