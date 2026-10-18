/* ================= CONSTANTS (Фаза 2 рефакторинга) =================
   Глобальные константы игры — лист, никого не импортирует.
   W() здесь, а не в utils: зависит от TILE/HALF (листья не импортируют
   других листьев). STATUS/HERO_TINT — as const по стандарту TS. */

export const TILE=1.6;
export const GRID=28;
export const HALF=(GRID-1)/2;

/* сетка → мировые координаты сцены */
export const W=(v:number)=>(v-HALF)*TILE;

/* опыта до уровня: с 1-го на 2-й — 300, дальше — 900 */
export const XP_NEED=(l:number)=>l===1?300:900;

/* дальности заклинаний в клетках сетки */
export const RANGE_FB=7;   /* огненный шар */
export const RANGE_OIL=5;  /* огненное масло */
export const RANGE_SPORE=5;/* v1.5: облако спор */

/* визуальные справочники статусов (иконки, тултипы, журнал) */
export const STATUS={
  burn:{name:'Горение',tag:'Г',css:'#ff9a4d'},
  poison:{name:'Отравление',tag:'О',css:'#8fd36a'},
  bless:{name:'Благословение',tag:'Б',css:'#ffd54f'},
  fear:{name:'Страх',tag:'С',css:'#b08fd3'},
  dodge:{name:'Уклонение',tag:'У',css:'#9fc4e8'},/* v1.2 */
  faith:{name:'Щит веры',tag:'Щ',css:'#8fb8ff'},/* v1.2 */
} as const;

/* оттенки ригов героев (v1.2; v1.5: +друид; v1.9: +паладин) */
export const HERO_TINT={fighter:0x5a7fb0,wizard:0x9a6ab8,rogue:0x3f7a6a,cleric:0xc9a84a,druid:0x6a9a4a,paladin:0x9a5a5a} as const;

/* формат сейва (заморожен, REFACTORING.md §8) и число слотов */
export const SAVE_VER=2;
export const SLOT_N=3;
