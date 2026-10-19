/* ================= BARKS (v2.6 «Эхо битвы» + v2.8 «Глас бездны») =================
   Боевые реплики героев — как barks в BG3: на события боя герой
   выкрикивает короткую фразу СВОИМ голосом (HERO_VOICE+BARKS из
   voicecfg). Гандикап спама — общий кулдаун 4 c между барьками
   (как в BG3); падение героя (down) — force, перебивает всё.
   v2.8: enemyBark — НОСИТЕЛЬ АУРЫ (Грат/Костепёр/Ульва/Гаррум/Малвех/
   Чемпион бездны) при первом применении ауры в бою ревёт свою реплику
   (ENEMY_VOICE+ENEMY_BARKS): флаг src.enemyBarked живёт на юните до
   пересоздания, кулдаун героев не трогается.
   Ключ манифеста: bark.<герой>.<событие> (герой — Unit.short в
   нижнем регистре, транслит не нужен — файлы генерируются по тем же
   ключам). Призраки-саммонцы и чужие герои молчат; мёртвый герой
   не барькает. ЛИСТ-слой: state (данные) + voicecfg + voice — циклы
   исключены. E2E: barkProbe(kind, hero?) / ebarkProbe(key) через __bg3
   — возвращают {ok,id} без побочных звуков мимо кулдауна. */
import { BARKS, ENEMY_VOICE, ENEMY_BARKS, enemyBarkId } from '../voicecfg';
import type { BarkKind } from '../voicecfg';
import { bannerSlug } from '../voicecfg';
import { units } from '../state';
import { voice } from './voice';

export const BARK_CD=4000;/* мс между барьками (гандикап как в BG3) */
let lastAt=0;/* время последнего УСПЕШНОГО барька */

const barksOf=(key:string):Record<BarkKind,string>|undefined=>{
  if(!key)return undefined;
  return BARKS[key.toLowerCase()];
};

/* живые герои, для которых есть реплики (призраки-саммонцы — мимо) */
export function barkHeroes():string[]{
  const out:string[]=[];
  for(const u of units){
    if(u.side!=='hero'||!u.alive||u.summoned)continue;
    const key=(u.short||'').toLowerCase();
    if(barksOf(key))out.push(key);
  }
  return out;
}

/* главный вход: kind — событие; hero — конкретный герой (Unit) или null
   (случайный живой). force — перебить кулдаун (только down). */
export function bark(kind:BarkKind,hero?:unknown,force=false):boolean{
  try{
    if(!voice.voiceEnabled())return false;
    const now=Date.now();
    if(!force&&now-lastAt<BARK_CD)return false;
    let key='';
    if(hero!==undefined&&hero!==null){
      key=barkKey(hero);
      if(!key)return false;/* переданный герой не умеет барькать — молчим */
    }else{
      const list=barkHeroes();
      if(!list.length)return false;
      key=list[Math.floor(Math.random()*list.length)];
    }
    const texts=barksOf(key);
    if(!texts||!texts[kind])return false;
    const id='bark.'+bannerSlug(key)+'.'+kind;
    void voice.play(id);
    lastAt=now;
    return true;
  }catch{return false;}
}

/* barkKey по Unit: short в нижнем регистре, если для него есть реплики */
function barkKey(u:unknown):string{
  try{
    const short=(u as {short?:string}).short||'';
    const key=short.toLowerCase();
    return barksOf(key)?key:'';
  }catch{return '';}
}

/* E2E-проба: механика без ожидания боя — возвращает {ok,id}.
   Кулдаун честный (как в бою); force=true для down. */
export function barkProbe(kind:BarkKind,heroKey?:string):{ok:boolean;id:string}{
  const key=heroKey?heroKey.toLowerCase():'';
  const texts=barksOf(key);
  const id='bark.'+bannerSlug(key||'?')+'.'+kind;
  if(!texts||!texts[kind])return {ok:false,id};
  const now=Date.now();
  /* down в бою — force (перебивает кулдаун) — probe честно повторяет это */
  if(now-lastAt<BARK_CD&&kind!=='down')return {ok:false,id};
  void voice.play(id);
  lastAt=now;
  return {ok:true,id};
}

/* фасад для модулей игры */
export const barks={bark,barkHeroes,barkProbe,BARK_CD};

/* ================= v2.8 «ГЛАС БЕЗДНЫ»: реплики врагов =================
   Хук — systems/combat.ts (doAttack, bossAura): когда удар союзника
   усиливает аура носителя (Грат и др.), носитель ревёт ОДИН раз за
   жизнь юнита (пересоздание — новая карта/волна — возвращает голос).
   Саммонцы и юниты без каталога молчат; no-throw. */
let ebarkCount=0;/* v2.8: счётчик успешных ревов (E2E-инспектор) */

export function enemyBark(src:unknown):boolean{
  try{
    if(!src)return false;
    const u=src as {side?:string;alive?:boolean;short?:string;summoned?:boolean;enemyBarked?:boolean};
    if(u.side==='hero'||u.alive===false||u.summoned)return false;
    const key=(u.short||'').toLowerCase();
    if(!ENEMY_BARKS[key]||!ENEMY_VOICE[key])return false;
    if(u.enemyBarked)return false;
    u.enemyBarked=true;
    void voice.play(enemyBarkId(key));
    ebarkCount++;
    return true;
  }catch{return false;}
}

/* E2E-проба каталога: {ok,id} без флагов и звуков */
export function ebarkProbe(key:string):{ok:boolean;id:string}{
  const k=(key||'').toLowerCase();
  const id=enemyBarkId(k||'?');
  return {ok:!!ENEMY_BARKS[k]&&!!ENEMY_VOICE[k],id};
}

export function ebarkState(){return {count:ebarkCount,catalog:Object.keys(ENEMY_BARKS)};}
