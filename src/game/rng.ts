/* ================= RNG (Фаза 2 рефакторинга) =================
   Чистый генератор случайности — лист, никого не импортирует.
   - mulberry32/srand: фиксированный сид 20251017 → детерминизм декора мира
     (трава, деревья, камни, рассадка декора). Модульный синглтон — допустимо
     по REFACTORING.md §4 (rng — исключение из правила контекста).
   - d/roll/ri: боевая и лутовая случайность на Math.random — как и было. */

export function mulberry32(a:number){
  return function(){
    a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;
  };
}

export const srand=mulberry32(20251017);

/* k-гранник: d(6) = 1..6 */
export const d=(s:number)=>1+Math.floor(Math.random()*s);

/* сумма n гранников */
export const roll=(n:number,s:number)=>{let t=0;for(let i=0;i<n;i++)t+=d(s);return t;};

/* целое в отрезке [a,b] включительно */
export const ri=(a:number,b:number)=>a+Math.floor(Math.random()*(b-a+1));
