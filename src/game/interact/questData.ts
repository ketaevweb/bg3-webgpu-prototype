/* ================= QUEST DATA (Фаза 5 рефакторинга) =================
   Данные квестов (QUESTS/QUEST_REWARD) выделены из interact/quests.ts.
   Причина: progression.showEnd читает QUESTS, а quests.questDone зовёт
   awardXP из progression — данные уезжают в лист, разрывая цикл
   quests⇄progression (REFACTORING.md §5, разбор циклов Фазы 5).
   quests.ts реэкспортирует их для совместимости импортов. Формат — v1.3
   дословно (структура читается gameSnapshot/applyGame, v2 заморожен). */
import type { Quest } from '../types';

export const QUESTS:Record<string,Quest>={
  main:{name:'Кости и пепел',state:'active',
    desc:'Гоблины племени Костей перекрыли торговый тракт. Разгромите их лагерь на севере и убейте вожака.',
    objs:[{k:'boss',t:'Убить вожака Грата Костолома',done:false}]},
  prisoner:{name:'Свободу разведчице',state:'hidden',
    desc:'Западнее гоблинского лагеря в клетке томится Илва — разведчица Долгого Дозора.',
    objs:[{k:'free',t:'Освободить Илву',done:false}]},
  crate:{name:'Похищенный товар',state:'hidden',
    desc:'Гоблины утащили у Дамрока ящик с товаром. Он где-то в их лагере.',
    objs:[{k:'find',t:'Найти ящик в лагере',done:false},{k:'return',t:'Вернуть ящик Дамроку',done:false}]},
  crypt:{name:'Сердце крипты',state:'hidden',/* v0.8 */
    desc:'Мертвецы тракта — не гоблинская работа. Под курганом на северо-востоке открылась крипта, где сидит некромант Вхорил Костепёр и дёргает за ниточки своих костяных кукол.',
    objs:[{k:'enter',t:'Спуститься в крипту',done:false},{k:'boss',t:'Уничтожить Костепёра',done:false}]},
  swamp:{name:'Шёпот глубин',state:'hidden',/* v1.5 */
    desc:'За криптой тракт тонет в трясине: культисты Глубинного завелись на болотах, и жрица ихняя Ульва будит тину песнями. Дамрок говорил: гниловар огня не боится — а вот громовой разряд ей вреден.',
    objs:[{k:'enter',t:'Найти источник шёпота на болотах',done:false},{k:'boss',t:'Уничтожить Ульву, Матерь Топей',done:false}]},
  giants:{name:'Перевал великанов',state:'hidden',/* v1.6 */
    desc:'Северный тракт к цитадели Долгого Дозора проходит через перевал, где обустроились огры. Их вожак Гаррум Камнегрыз швыряет валуны в каждого, кто подойдёт к мосту. Дорога на север должна быть свободна.',
    objs:[{k:'enter',t:'Пройти на перевал и найти вожака',done:false},{k:'boss',t:'Победить Гаррума Камнегрыза',done:false}]},
};
export const QUEST_REWARD:Record<string,string>={
  main:'300 XP, 150 зол.',
  prisoner:'150 XP, 100 зол., кулон красноречия',
  crate:'150 XP, 100 зол., вечная скидка',
  crypt:'300 XP, 150 зол., перстень Костепёра',
  swamp:'350 XP, 200 зол., Болотный жемчуг',
  giants:'400 XP, 250 зол., Каменное сердце',
};

/* v1.6 (фикс из E2E): сброс квестов в исходное — нужен чистому ремоуту
   (dispose→resetState): модульные состояния QUESTS переживали ремоут,
   из-за чего после Fast-Refresh квесты оставались «done». */
export function resetQuests(){
  QUESTS.main.state='active';QUESTS.main.objs.forEach(o=>{o.done=false;});
  for(const id of ['prisoner','crate','crypt','swamp','giants']){
    QUESTS[id].state='hidden';QUESTS[id].objs.forEach(o=>{o.done=false;});
  }
}
