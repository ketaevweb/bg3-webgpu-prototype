/* ================= SYSTEMS/COMBAT (Фазы 2–3 рефакторинга) =================
   Чистая боевая математика D&D-стиля. Функции не мутируют состояние и не
   знают о сцене — только аргументы. Фаза 3: доменные типы Unit/Weapon.
   doAttack/damageUnit/healUnit/addStatus переезжают сюда в Фазе 4d
   (нужен контекст G и fx/HUD). */

import { clamp, mod } from '../utils';
import { d } from '../rng';
import type { Unit, Weapon } from '../types';

/* модификатор атаки: характеристика оружия + мастерство; яд/страх штрафуют */
export function attackMod(u:Unit, w:Weapon){
  let m=mod(u[w.abil])+(u.prof||0);
  if(u.statuses.some(s=>s.type==='poison'))m-=2;
  if(u.statuses.some(s=>s.type==='fear'))m-=2;
  return m;
}

/* благословение: +1d4 к броску атаки */
export function blessed(u:Unit){return u.statuses.some(s=>s.type==='bless')?d(4):0;}

/* шанс попадания 5%..95% (уклонение +3 КД, щит веры +2 КД) */
export function hitChance(u:Unit, t:Unit, w:Weapon){
  let ac=t.ac;
  if(t.statuses&&t.statuses.some(s=>s.type==='dodge'))ac+=3;/* v1.2: уклонение Илвы */
  if(t.statuses&&t.statuses.some(s=>s.type==='faith'))ac+=2;/* v1.2: щит веры Кая */
  const need=ac-attackMod(u,w);
  return clamp((21-need)/20,0.05,0.95);
}

/* средний урон оружия: n·(m+1)/2 + модификатор характеристики */
export function avgDamage(u:Unit, w:Weapon){
  return w.dice[0]*(w.dice[1]/2+0.5)+mod(u[w.abil]);
}
