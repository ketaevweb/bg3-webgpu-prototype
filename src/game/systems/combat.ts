/* ================= SYSTEMS/COMBAT (Фаза 2 рефакторинга) =================
   Чистая боевая математика D&D-стиля. Функции не мутируют состояние и не
   знают о сцене — только аргументы. doAttack/damageUnit/healUnit/addStatus
   переезжают сюда в Фазе 4d (нужен контекст G и fx/HUD).
   TODO(refactor-p3): доменные типы Unit/Weapon из types.ts вместо any. */

import { clamp, mod } from '../utils';
import { d } from '../rng';

/* модификатор атаки: характеристика оружия + мастерство; яд/страх штрафуют */
export function attackMod(u:any, w:any){
  let m=mod(u[w.abil])+(u.prof||0);
  if(u.statuses.some((s:any)=>s.type==='poison'))m-=2;
  if(u.statuses.some((s:any)=>s.type==='fear'))m-=2;
  return m;
}

/* благословение: +1d4 к броску атаки */
export function blessed(u:any){return u.statuses.some((s:any)=>s.type==='bless')?d(4):0;}

/* шанс попадания 5%..95% (уклонение +3 КД, щит веры +2 КД) */
export function hitChance(u:any, t:any, w:any){
  let ac=t.ac;
  if(t.statuses&&t.statuses.some((s:any)=>s.type==='dodge'))ac+=3;/* v1.2: уклонение Илвы */
  if(t.statuses&&t.statuses.some((s:any)=>s.type==='faith'))ac+=2;/* v1.2: щит веры Кая */
  const need=ac-attackMod(u,w);
  return clamp((21-need)/20,0.05,0.95);
}

/* средний урон оружия: n·(m+1)/2 + модификатор характеристики */
export function avgDamage(u:any, w:any){
  return w.dice[0]*(w.dice[1]/2+0.5)+mod(u[w.abil]);
}
