/* ================= VITALS (Фаза 5 рефакторинга) =================
   healUnit выделен из systems/combat.ts. Причина: progression.victorySequence
   лечит отряд после боя, а combat.die зовёт awardXP/checkEnd из progression —
   прямой импорт progression→combat замыкал цикл. Лечение живёт ниже боевого
   ядра и не тянет логику смерти (REFACTORING.md §5, разбор циклов Фазы 5).
   Перенесено дословно из combat.ts. */
import { ftextAbove, log } from '../ui/overlays';
import { sfx } from '../audio';
import { fx, glows } from '../render/renderer';
import { bus } from '../bus';
import type { Unit } from '../types';

export function healUnit(u:Unit,amt:number,why:string){
  if(!u.alive)return;
  const before=u.hp;
  u.hp=Math.min(u.maxhp,u.hp+amt);
  bus.refreshBossBar.call();/* v0.8 */
  ftextAbove(u,'+'+(u.hp-before),'#8fd36a');
  sfx.heal();
  fx.burstAtMesh(u,{count:18,color:0x8fd36a,speed:1.5,size:0.11,life:0.9,gravity:-1.1});
  glows.flashAtMesh(u,0x8fd36a,1.1);
  log(u.name+' восстанавливает '+(u.hp-before)+' HP ('+why+').','g-heal');
  bus.refreshParty.call();
}
