/* ================= EDITOR GIZMO (v3.4 «Мастерская») =================
   Unity-гизмо для выбранного юнита: TransformControls (move/rotate/scale,
   клавиши W/E/R при открытой кузнице), шаг сетки (snap). Пока тянется
   гизмо — орбита камеры отключается (dragging-changed), а клики по
   стрелкам не проваливаются в игру: capture-фаза bindEditor() смотрит
   на hovering() и глушит pointerdown/up до игровых обработчиков.
   Правка применяется к юниту в onUserChange (обратный вызов моста). */
import * as THREE from 'three/webgpu';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { GizmoMode } from '../ui/editorStore';

let tc:TransformControls|null=null;
let helper:THREE.Object3D|null=null;
let onUserChange:(mode:GizmoMode)=>void=()=>{};
let onDragEnd:()=>void=()=>{};

/* инфраструктура сцены передаётся мостом (избегаем импорта renderer.ts
   отсюда — bridge.ts и так его тащит, здесь только типы) */
export function initGizmo(camera:THREE.Camera,dom:HTMLElement,scene:THREE.Scene,
  orbit:THREE.EventDispatcher&{enabled:boolean},change:(mode:GizmoMode)=>void,
  end:()=>void):void{
  if(tc)return;
  onUserChange=change;
  onDragEnd=end;
  tc=new TransformControls(camera,dom);
  helper=tc.getHelper();
  helper.visible=false;
  scene.add(helper);
  tc.addEventListener('dragging-changed',(e)=>{
    const dragging=(e as unknown as {value:boolean}).value;
    orbit.enabled=!dragging;
    if(!dragging)onDragEnd();/* конец перетаскивания — синхронизировать юнита */
  });
  tc.addEventListener('objectChange',()=>{
    if(tc)onUserChange(FROM_TC[tc.getMode()]||'move');
  });
}

/* GizmoMode ↔ TransformControls: 'move' → 'translate' */
const TO_TC:Record<string,'translate'|'rotate'|'scale'>={move:'translate',rotate:'rotate',scale:'scale'};
const FROM_TC:Record<string,GizmoMode>={translate:'move',rotate:'rotate',scale:'scale'};

export function gizmoAttach(mesh:THREE.Object3D):void{
  if(!tc||!helper)return;
  tc.attach(mesh);helper.visible=true;
}
export function gizmoDetach():void{
  if(!tc||!helper)return;
  tc.detach();helper.visible=false;
}
export function gizmoAttached():boolean{
  return !!tc&&tc.object!=null;
}
export function gizmoSetMode(m:GizmoMode):void{
  if(!tc)return;
  if(m==='none'){if(helper)helper.visible=false;return;}
  tc.setMode(TO_TC[m]);
  if(tc.object&&helper)helper.visible=true;
}
export function gizmoSetSnap(on:boolean):void{
  if(!tc)return;
  /* перемещение НЕ снапим на лету: центры клеток смещены на полтайла
     от мировых кратных TILE — клетка выставляется на отпускании (forge);
     поворот/масштаб снапятся сразу */
  tc.setTranslationSnap(null);
  tc.setRotationSnap(on?Math.PI/12:null);
  tc.setScaleSnap(on?0.1:null);
}
/* курсор над стрелками гизмо (для capture-глушки кликов) */
export function gizmoHovering():boolean{
  return !!tc&&tc.axis!=null;
}
export function gizmoDragging():boolean{
  return !!tc&&tc.dragging;
}
