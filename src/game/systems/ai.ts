/* ================= AI (Фазы 4–5 рефакторинга) =================
   Utility-ИИ: планы гоблинов/некроманта/целителя, оценка атак, бегство,
   исполнение хода. Перенесено дословно из engine.ts. Фаза 5: цикл turns⇄ai
   разорван — beginTurn зовёт aiTurn через шину bus (ai привязывает слот);
   healUnit — из vitals.ts; freeSpotNear — с явным контекстом сетки;
   best/hb-кандидаты типизированы (AIPlan/Scored). */
import { sleep, cheb, key, mod } from '../utils';
import { roll } from '../rng';
import { W } from '../constants';
import { G, units, barrels, fires, GW } from '../state';
import { bus } from '../bus';
import { hitChance, avgDamage, damageUnit, doAttack } from './combat';
import { healUnit } from './vitals';
import { reachNodes, nodePath, freeSpotNear, type AStarNode } from '../world/grid';
import { makeSkeleton, makeDrowned } from '../entities/roster';
import { aliveHeroes } from '../entities/units';
import { joinCombat, endTurn } from './turns';
import { animateMove } from './movement';
import { bigBanner, log, ftextAbove } from '../ui/overlays';
import { sfx } from '../audio';
import { fx, glows } from '../render/renderer';
import { shake } from '../fx/tweens';
import type { AIPlan, Unit } from '../types';

/* локальный тип оценочного кандидата (s — score, v — полезная нагрузка) */
type Scored<V>={s:number;v:V;}

export function planNecro(u:Unit):AIPlan|null{/* v0.8: ИИ некроманта — шквал, дистанция, фаза призыва */
  const heroes=aliveHeroes();
  if(!heroes.length)return null;
  if(!u.phase2&&u.hp<=u.maxhp*0.5)return{type:'phase2'};
  if(u.action>0&&heroes.filter(h=>cheb(u,h)<=1).length>=2)return{type:'nova'};
  if(u.action>0){
    let best:Scored<Unit>|null=null;
    for(const h of heroes)if(cheb(u,h)<=u.weapon.range){
      const s=evalAttack(u,h)+(h.hp<=h.maxhp*0.4?1.6:0);
      if(!best||s>best.s)best={s,v:h};
    }
    if(best)return{type:'attack',target:best.v};
  }
  if(u.keepDist&&u.moveLeft>=1){
    const close=heroes.some(h=>cheb(u,h)<3);
    if(close){
      const nodes=reachNodes(GW,u,true);
      let best:Scored<AStarNode>|null=null;
      const curD=Math.min(...heroes.map(h=>cheb(u,h)));
      for(const node of nodes.values()){
        if(node.g<=0)continue;
        const dmin=Math.min(...heroes.map(h=>cheb(node,h)));
        const s=dmin*0.9-node.g*0.12;
        if(!best||s>best.s)best={s,v:node};
      }
      if(best&&Math.min(...heroes.map(h=>cheb(best.v,h)))>curD)return{type:'move',path:nodePath(best.v)};
    }
  }
  if(u.moveLeft>=1&&u.action>0){
    const nodes=reachNodes(GW,u,true);
    let best:Scored<AStarNode>|null=null;
    for(const node of nodes.values()){
      if(node.g<=0)continue;
      for(const h of heroes){
        const dd=cheb(node,h);
        if(dd>u.weapon.range)continue;
        const s=evalAttack(u,h)-node.g*0.05+(dd>=4?0.8:0);
        if(!best||s>best.s)best={s,v:node};
      }
    }
    if(best)return{type:'move',path:nodePath(best.v)};
  }
  /* v1.4: fallback сближения — план move выше ищет только атакующие позиции,
     поэтому при дистанции героя > moveLeft+range кастер стоял на месте
     (латентный баг v0.4, вскрыт E2E v1.4 дальним стартом боя) */
  if(u.moveLeft>=1){
    const nodes=reachNodes(GW,u,true);
    let best:Scored<AStarNode>|null=null;
    const curD=Math.min(...heroes.map(h=>cheb(u,h)));
    for(const node of nodes.values()){
      if(node.g<=0)continue;
      const dmin=Math.min(...heroes.map(h=>cheb(node,h)));
      const s=-dmin*0.9-node.g*0.1;
      if(!best||s>best.s)best={s,v:node};
    }
    if(best&&Math.min(...heroes.map(h=>cheb(best.v,h)))<curD)return{type:'move',path:nodePath(best.v)};
  }
  if(u.bonus>0&&u.action>0)return{type:'dash'};
  return null;
}
export function evalAttack(u:Unit,h:Unit):number{
  const w=u.weapon;
  const exp=hitChance(u,h,w)*avgDamage(u,w);
  let s=exp*1.15;
  if(exp>=h.hp-0.5)s+=6;
  s+=(1-h.hp/h.maxhp)*2.5;
  return s;
}
export function threatened(u:Unit):boolean{
  return units.some(e=>e.side==='hero'&&e.alive&&cheb(e,u)<=1);
}
export function bestFleeNode(u:Unit):AStarNode|null{
  const heroes=units.filter(x=>x.side==='hero'&&x.alive);
  if(!heroes.length)return null;
  const nodes=reachNodes(GW,u,true);
  let best:Scored<AStarNode>|null=null;
  for(const node of nodes.values()){
    if(node.g<=0)continue;
    const dmin=Math.min(...heroes.map(h=>cheb(node,h)));
    let s=dmin*1.1-node.g*0.08;
    if(fires.has(key(node.x,node.z)))s-=5;
    if(!best||s>best.s)best={s,v:node};
  }
  return best?best.v:null;
}
export function planGoblin(u:Unit):AIPlan|null{
  const heroes=units.filter(x=>x.side==='hero'&&x.alive);
  if(!heroes.length)return null;
  const gobs=units.filter(x=>x.side==='goblin'&&x.alive);
  /* v1.3: ученик некроманта первым делом латает раненых слуг */
  if(u.healer&&u.action>0){
    let hb:Scored<Unit>|null=null;
    for(const w of gobs){
      if(w===u||w.hp>=w.maxhp*0.65)continue;
      const s=(1-w.hp/w.maxhp)*3+(w.isBoss?1.2:0);
      if(cheb(u,w)<=u.weapon.range&&(!hb||s>hb.s))hb={s,v:w};
    }
    if(hb)return{type:'heal',target:hb.v};
  }
  if(u.bonus>0&&u.potions>0&&u.hp<u.maxhp*0.45)return{type:'potion'};
  if(u.action>0){
    for(const b of barrels)if(b.alive){
      const near=heroes.filter(h=>Math.hypot(h.x-b.x,h.z-b.z)<=2.4).length;
      const own=gobs.filter(g=>Math.hypot(g.x-b.x,g.z-b.z)<=2.4).length;
      if(near>0&&own===0){
        const inR=u.weapon.melee?cheb(u,b)<=1:cheb(u,b)<=u.weapon.range;
        if(inR)return{type:'attack',target:b};
      }
    }
  }
  if(u.action>0){
    let best:Scored<Unit>|null=null;
    for(const h of heroes)if(cheb(u,h)<=u.weapon.range){
      const s=evalAttack(u,h);
      if(!best||s>best.s)best={s,v:h};
    }
    if(best)return{type:'attack',target:best.v};
  }
  if(u.keepDist&&u.moveLeft>=1){
    const close=heroes.some(h=>cheb(u,h)<3);
    if(close){
      const nodes=reachNodes(GW,u,true);
      let best:Scored<AStarNode>|null=null;
      const curD=Math.min(...heroes.map(h=>cheb(u,h)));
      for(const node of nodes.values()){
        if(node.g<=0)continue;
        const dmin=Math.min(...heroes.map(h=>cheb(node,h)));
        let s=dmin*0.9-node.g*0.12;
        if(fires.has(key(node.x,node.z)))s-=5;
        if(!best||s>best.s)best={s,v:node};
      }
      if(best&&Math.min(...heroes.map(h=>cheb(best.v,h)))>curD)return{type:'move',path:nodePath(best.v)};
    }
  }
  if(u.action>0&&u.hp<u.maxhp*0.3&&threatened(u)){
    const node=bestFleeNode(u);
    if(node)return{type:'dis',path:nodePath(node)};
  }
  if(u.moveLeft>=1&&u.action>0){
    const nodes=reachNodes(GW,u,true);
    let best:Scored<AStarNode>|null=null;
    for(const node of nodes.values()){
      if(node.g<=0)continue;
      for(const h of heroes){
        const dd=cheb(node,h);
        const ok=u.weapon.melee?dd<=1:dd<=u.weapon.range;
        if(!ok)continue;
        let s=evalAttack(u,h)-node.g*0.05;
        if(!u.weapon.melee&&dd>=3&&dd<=6)s+=1.2;
        if(!u.weapon.melee&&dd<2)s-=0.8;
        if(fires.has(key(node.x,node.z)))s-=5;
        if(!best||s>best.s)best={s,v:node};
      }
    }
    if(best)return{type:'move',path:nodePath(best.v)};
  }
  /* v1.4: fallback сближения (см. planNecro) — гоблин идёт к ближайшему
     герою, если атакующей позиции не нашлось; без него дальний бой
     залипал: «ускоряется» каждый ход без единого шага */
  if(u.moveLeft>=1){
    const nodes=reachNodes(GW,u,true);
    let best:Scored<AStarNode>|null=null;
    const curD=Math.min(...heroes.map(h=>cheb(u,h)));
    for(const node of nodes.values()){
      if(node.g<=0)continue;
      const dmin=Math.min(...heroes.map(h=>cheb(node,h)));
      const s=-dmin*0.9-node.g*0.1;
      if(!best||s>best.s)best={s,v:node};
    }
    if(best&&Math.min(...heroes.map(h=>cheb(best.v,h)))<curD)return{type:'move',path:nodePath(best.v)};
  }
  if(u.bonus>0&&u.action>0)return{type:'dash'};
  return null;
}
export async function aiTurn(u:Unit){
  await sleep(500);
  let guard=0;
  while(G.combatOn&&u.alive&&guard++<6){
    const plan:AIPlan|null=u.bossBrain?planNecro(u):planGoblin(u);/* v0.8: у босса свой мозг */
    if(!plan)break;
    if(plan.type==='phase2'){/* v0.8: подъём мёртвых; v1.5: Ульва поднимает утопленников; v1.6: Гаррум каменеет */
      u.phase2=true;
      const swamp=u.swampBoss===true;
      const giant=u.giantBoss===true;
      bigBanner(swamp?'ФАЗА 2: ТРЯСИНА ПРОСЫПАЕТСЯ':(giant?'ФАЗА 2: ГОРЫ ДРОЖАТ':'ФАЗА 2: ПОДЪЁМ МЁРТВЫХ'));
      if(giant){
        u.ac+=3;
        log('Гаррум: «КАМЕНЬ — МОЯ КОЖА!» Шкура великана твердеет: КД '+u.ac+'.','g-enemy');
        sfx.nova();
        fx.burstAtMesh(u,{count:44,color:0xb0b8c0,speed:3.0,size:0.15,life:1.2,gravity:-0.6});
        glows.flashAtMesh(u,0xb0b8c0,2.6);
        shake(0.5);
        await sleep(700);continue;
      }
      log(swamp?'Ульва: «ТОНИТЕ. ТОНИТЕ ВСЕ!»':'Костепёр: «ВСТАНЬТЕ, МОИ ВЕРНЫЕ КОСТИ!»','g-enemy');
      sfx.bones();
      fx.burstAtMesh(u,{count:44,color:swamp?0x8fd36a:0x9fe8b8,speed:3.2,size:0.15,life:1.2,gravity:-1.1});
      glows.flashAtMesh(u,swamp?0x8fd36a:0x9fe8b8,2.6);
      shake(0.35);
      for(let i=0;i<2;i++){
        const spot=freeSpotNear(GW,u,2);
        if(!spot)break;
        const sum=swamp?makeDrowned(spot.x,spot.z):makeSkeleton(spot.x,spot.z);/* v1.5: фабрика по боссу */
        sum.summoned=true;
        joinCombat(sum);
      }
      await sleep(700);continue;
    }
    if(plan.type==='nova'){/* v0.8: костяной шквал; v1.6: у Гаррума — оползень */
      u.action--;
      const giant=u.giantBoss===true;
      if(giant){
        log('ОПОЛЗЕНЬ! Гаррум обрушивает каменный град вокруг себя!','g-enemy');
        sfx.nova();shake(0.45);
        const cx=W(u.x),cz=W(u.z);
        fx.burst(cx,0.9,cz,{count:42,color:0xb0b8c0,speed:4.4,life:0.9,gravity:2.2,spread:0.8});
        fx.burst(cx,0.4,cz,{count:16,color:0x8a8578,speed:3.0,life:0.8,gravity:1.4,spread:0.6});
        glows.flash(cx,cz,3.0,0xd8d8d0);
        for(const h of aliveHeroes())if(cheb(u,h)<=1){
          const dmg=roll(2,6);
          ftextAbove(h,'−'+dmg,'#b8c0c8');
          log('Каменный град бьёт '+h.name+': '+dmg+' урона.','g-enemy');
          damageUnit(h,dmg,u);
        }
        await sleep(500);continue;
      }
      log('КОСТЯНОЙ ШКВАЛ! Костепёр выплёскивает могильную силу вокруг себя!','g-enemy');
      sfx.nova();
      shake(0.4);
      const cx=W(u.x),cz=W(u.z);
      fx.burst(cx,0.7,cz,{count:40,color:0x9fe8b8,speed:4.6,life:0.8,gravity:1.6,spread:0.8});
      fx.burst(cx,0.4,cz,{count:18,color:0x6a8a9f,speed:3.2,life:0.9,gravity:1.2,spread:0.6});
      glows.flash(cx,cz,3.2,0x7fd0a0);
      for(const h of aliveHeroes())if(cheb(u,h)<=1){
        const dmg=roll(2,6);
        ftextAbove(h,'−'+dmg,'#b08fd3');
        log('Костяной шквал бьёт '+h.name+': '+dmg+' некротического урона.','g-enemy');
        damageUnit(h,dmg,u);
      }
      await sleep(500);continue;
    }
    if(plan.type==='heal'){/* v1.3: могильная песнь ученика */
      u.action--;
      healUnit(plan.target,roll(2,4)+mod(u.int),'могильная песнь');
      glows.flashAtMesh(plan.target,0x9fe8b8,1.1);
      await sleep(450);continue;
    }
    if(plan.type==='potion'){
      u.bonus--;u.potions--;
      healUnit(u,roll(2,4)+2,'зелье');
      await sleep(450);continue;
    }
    if(plan.type==='dis'){
      u.action--;u.disengaging=true;
      log(u.name+' уходит из-под удара!','g-enemy');
      await animateMove(u,plan.path);
      await sleep(300);continue;
    }
    if(plan.type==='move'){
      await animateMove(u,plan.path);
      await sleep(250);continue;
    }
    if(plan.type==='dash'){
      u.bonus--;u.moveLeft+=3;
      log(u.name+' ускоряется!','g-enemy');
      await sleep(300);continue;
    }
    if(plan.type==='attack'){
      u.action--;
      await doAttack(u,plan.target,u.weapon);
      await sleep(350);continue;
    }
  }
  if(G.combatOn)endTurn();
}

/* ---- регистрация на шине (Фаза 5: разрыв цикла turns→ai) ---- */
bus.aiTurn.bind(aiTurn);
