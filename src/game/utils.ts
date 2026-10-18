/* ================= UTILS (Фаза 2 рефакторинга) =================
   Чистые утилиты — лист, никого не импортирует.
   W() живёт в constants.ts: она зависит от TILE/HALF, а листья не
   импортируют других листьев. */

/* DOM по селектору (id-реестр UI появится в Фазе 3) */
export const $=(q:string):HTMLElement=>document.querySelector(q) as HTMLElement;

/* v2.7: базовый путь приложения (GitHub Pages: /bg3-webgpu-prototype).
   Фиксируется на этапе сборки через NEXT_PUBLIC_BASE_PATH (deploy_ghpages.sh);
   в обычной сборке/деве — пустая строка, пути не меняются. */
export const BASE=process.env.NEXT_PUBLIC_BASE_PATH??'';

export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));

/* модификатор характеристики D&D: (значение-10)/2 вниз */
export const mod=(s:number)=>Math.floor((s-10)/2);

export const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

/* ключ тайла сетки */
export const key=(x:number,z:number)=>x+'_'+z;

/* расстояние Чебышёва по координатам сетки (8-связность) */
export const cheb=(a:{x:number,z:number},b:{x:number,z:number})=>
  Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z));
