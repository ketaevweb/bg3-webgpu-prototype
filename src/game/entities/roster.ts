/* ================= ROSTER (Фаза 4c рефакторинга) =================
   Шаблоны врагов (GOB/SKEL/SKEL_KNIGHT/CULT), фабрики, элита,
   отряд героев и спавн врагов по карте/прогрессу.
   Перенесено дословно из engine.ts. */
import { S, G, gobCount, units, SWAMP, GIANTS, CITADEL } from '../state';
import { makeUnit } from './units';
import type { Unit, UnitTemplate } from '../types';

const GOB:Record<string,UnitTemplate>={
  bruiser:{name:'Гоблин-задира',short:'Задира',hp:7,ac:13,xp:50,color:0x5d8f3f,
    weapon:{name:'Скимитар',dice:[1,6],abil:'str',melee:true,range:1}},
  archer:{name:'Гоблин-лучник',short:'Лучник',hp:7,ac:13,xp:50,color:0x6b7d3f,dex:14,
    weapon:{name:'Короткий лук',dice:[1,6],abil:'dex',range:8},
    dagger:{name:'Кинжал',dice:[1,4],abil:'str',melee:true,range:1}},
  shaman:{name:'Гоблин-шаман',short:'Шаман',hp:9,ac:12,xp:75,color:0x7a4f9e,dex:14,keepDist:true,
    weapon:{name:'Отравленный дротик',dice:[1,4],abil:'dex',range:6,status:{type:'poison',turns:2}},
    dagger:{name:'Кинжал',dice:[1,4],abil:'str',melee:true,range:1}},
  chief:{name:'Гоблин-вожак',short:'Вожак',hp:15,ac:14,xp:100,color:0x8f4a3a,
    weapon:{name:'Тесак',dice:[1,8],abil:'str',melee:true,range:1}},
  /* v1.3: элитный задира лагеря — бьёт больно, лут богатый */
  veteran:{name:'Гоблин-ветеран',short:'Ветеран',hp:14,ac:14,xp:110,color:0x4f7a35,
    weapon:{name:'Двуручный тесак',dice:[1,10],abil:'str',melee:true,range:1}},
};
export function makeGoblin(t:UnitTemplate,x:number,z:number){
  gobCount[t.short]=(gobCount[t.short]||0)+1;
  const n=gobCount[t.short];
  return makeUnit({
    name:t.name+(n>1?' №'+n:''), short:t.short+(n>1?' '+n:''), side:'goblin',
    cls:'goblin',clsName:'Гоблин',x,z,
    str:12,dex:t.dex||12,con:12,int:8,wis:8,cha:8,
    hp:t.hp,maxhp:t.hp,ac:t.ac,speed:6,xp:t.xp,color:t.color,
    weapon:t.weapon,dagger:t.dagger||null,keepDist:!!t.keepDist,features:[],
  });
}
/* ================= v0.8: НЕЖИТЬ КРИПТЫ ================= */
const SKEL:UnitTemplate={name:'Скелет-страж',short:'Скелет',hp:11,ac:13,xp:60,color:0xcfc7b0,
  weapon:{name:'Ржавый меч',dice:[1,6],abil:'str',melee:true,range:1}};
export function makeSkeleton(x:number,z:number){
  gobCount[SKEL.short]=(gobCount[SKEL.short]||0)+1;
  const n=gobCount[SKEL.short];
  return makeUnit({
    name:SKEL.name+(n>1?' №'+n:''),short:SKEL.short+(n>1?' '+n:''),side:'goblin',
    cls:'undead',clsName:'Скелет',x,z,
    str:13,dex:12,con:10,int:2,wis:8,cha:6,
    hp:SKEL.hp,maxhp:SKEL.hp,ac:SKEL.ac,speed:6,xp:SKEL.xp,color:SKEL.color,skin:0xd8d2be,
    weapon:SKEL.weapon,dagger:null,keepDist:false,features:[],
  });
}
/* ================= v1.3: ЭЛИТА И СПЕЛЛКАСТЕРЫ КРИПТЫ =================
   applyElite — общий «класс элиты»: крупнее, золотое кольцо,
   двойное золото и реликвия из лут-таблицы. */
export function applyElite(u:Unit){
  u.elite=true;
  u.mesh.scale.multiplyScalar(1.16);
  if(u.mesh.userData.ring)u.mesh.userData.ring.material.color.setHex(0xd8b45a);
  u.features.push('Элита племени Костей: крепче рядового и носит добычу получше');
  return u;
}
const SKEL_KNIGHT:UnitTemplate={name:'Скелет-рыцарь',short:'Рыцарь',hp:22,ac:15,xp:160,color:0xb8b09a,
  weapon:{name:'Древний клеймор',dice:[1,8],abil:'str',melee:true,range:1}};
export function makeSkeletonKnight(x:number,z:number){
  gobCount[SKEL_KNIGHT.short]=(gobCount[SKEL_KNIGHT.short]||0)+1;
  const n=gobCount[SKEL_KNIGHT.short];
  const u=makeUnit({
    name:SKEL_KNIGHT.name+(n>1?' №'+n:''),short:SKEL_KNIGHT.short+(n>1?' '+n:''),side:'goblin',
    cls:'undead',clsName:'Скелет-рыцарь',x,z,
    str:15,dex:12,con:12,int:2,wis:10,cha:6,
    hp:SKEL_KNIGHT.hp,maxhp:SKEL_KNIGHT.hp,ac:SKEL_KNIGHT.ac,speed:6,xp:SKEL_KNIGHT.xp,
    color:SKEL_KNIGHT.color,skin:0xd8d2be,
    weapon:SKEL_KNIGHT.weapon,dagger:null,keepDist:false,features:[],
  });
  return applyElite(u);
}
const CULT:Record<string,UnitTemplate>={
  cultist:{name:'Культист Костепёра',short:'Культист',hp:10,ac:12,xp:90,color:0x6a4f8e,dex:14,int:14,keepDist:true,
    weapon:{name:'Некротический сгусток',dice:[1,6],abil:'int',range:7,necro:true,status:{type:'poison',turns:2}},
    dagger:{name:'Ритуальный нож',dice:[1,4],abil:'str',melee:true,range:1}},
  acolyte:{name:'Ученик Костепёра',short:'Ученик',hp:14,ac:13,xp:150,color:0x4f3a72,dex:14,int:16,keepDist:true,healer:true,
    weapon:{name:'Луч могильного холода',dice:[1,8],abil:'int',range:8,necro:true},
    dagger:{name:'Ритуальный нож',dice:[1,4],abil:'str',melee:true,range:1}},
  /* v1.5: культисты Глубинного на болотах */
  deep:{name:'Культист Глубин',short:'Культист',hp:10,ac:12,xp:90,color:0x4f7a6e,dex:14,int:14,keepDist:true,
    weapon:{name:'Сгусток тины',dice:[1,6],abil:'int',range:7,necro:true,status:{type:'poison',turns:2}},
    dagger:{name:'Ритуальный нож',dice:[1,4],abil:'str',melee:true,range:1}},
};
export function makeCultist(kind:'cultist'|'acolyte'|'deep',x:number,z:number){
  const t=CULT[kind];
  gobCount[t.short]=(gobCount[t.short]||0)+1;
  const n=gobCount[t.short];
  const u=makeUnit({
    name:t.name+(n>1?' №'+n:''),short:t.short+(n>1?' '+n:''),side:'goblin',
    cls:'cultist',clsName:kind==='acolyte'?'Ученик некроманта':(kind==='deep'?'Культист Глубин':'Культист'),x,z,
    str:10,dex:t.dex,con:12,int:t.int,wis:12,cha:10,
    hp:t.hp,maxhp:t.hp,ac:t.ac,speed:6,xp:t.xp,color:t.color,skin:0xcfc2a8,
    staff:true,tipColor:kind==='acolyte'?0x9fe8b8:(kind==='deep'?0x8fe87f:0xc08fff),
    weapon:t.weapon,dagger:t.dagger||null,keepDist:!!t.keepDist,healer:!!t.healer,features:[],
  });
  if(kind==='acolyte')applyElite(u);
  return u;
}
export function makeNecro(){
  return makeUnit({
    name:'Вхорил Костепёр',short:'Костепёр',cls:'necro',clsName:'Некромант',side:'goblin',
    str:10,dex:12,con:14,int:16,wis:14,cha:14,
    hp:46,maxhp:46,ac:15,speed:5,xp:400,x:14,z:4,color:0x3f2f55,skin:0xcac2ae,staff:true,tipColor:0x7fffc0,
    keepDist:true,bossBrain:true,isBoss:true,cryptBoss:true,fearImmune:true,phase2:false,
    weapon:{name:'Жезл гнили',dice:[1,8],abil:'int',range:6,necro:true,status:{type:'poison',turns:2}},
    dagger:{name:'Костяной клинок',dice:[1,6],abil:'str',melee:true,range:1},
    features:['Костяной шквал — 2d6 некротического всем соседям (1 раз в ход)',
      'На половине хитов призывает скелетов из стен',
      'Не ведает страха — запугивание бесполезно',
      'Печать его сундука держится, пока он «жив»'],
  });
}
export function buildHeroes(){
  if(units.some(u=>u.side==='hero'))return;/* герои переживают смену карт */
  makeUnit({name:'Торик Кремень',short:'Торик',cls:'fighter',clsName:'Воин',side:'hero',
    str:16,dex:12,con:14,int:10,wis:12,cha:10,hp:14,maxhp:14,ac:16,speed:6,
    weapon:{name:'Длинный меч',dice:[1,8],abil:'str',melee:true,range:1},
    dagger:{name:'Кинжал',dice:[1,4],abil:'str',melee:true,range:1},
    armor:'Кольчуга',potions:2,x:13,z:24,color:0x8a93a6,
    features:['Второе дыхание — бонусное действие, лечение 1d10+1 (1/бой)',
      'Боевой стиль «Защита»: +1 КД (учтён в КД 16)',
      'Со 2 уровня: Дополнительное действие (1/бой)',
      'С 3 уровня: Доп. действие 2/бой']});
  makeUnit({name:'Мирелла Янтарная',short:'Мирелла',cls:'wizard',clsName:'Волшебница',side:'hero',
    str:8,dex:14,con:12,int:16,wis:12,cha:12,hp:10,maxhp:10,ac:12,speed:6,
    weapon:{name:'Посох',dice:[1,6],abil:'str',melee:true,range:1},
    dagger:{name:'Кинжал',dice:[1,4],abil:'str',melee:true,range:1},
    armor:'Роба',potions:2,slots:3,slotsMax:3,staff:true,x:14,z:25,color:0x4a5fae,
    features:['Огненные стрелы — заговор, 1d10+ИНТ огонь, без ячейки',
      'Огненный шар — действие + ячейка, 3d6 огонь, радиус 2.5 кл., задевает своих!',
      'Лечащее слово — бонус + ячейка, лечение 1d4+ИНТ',
      'Благословение — бонус + ячейка, +1d4 к атакам союзника (3 хода)',
      'Со 2 уровня: +5 HP, ИНТ +1, 4 ячейки; с 3 уровня — 5 ячеек']});
}
/* ================= v1.2: ФАБРИКИ СПУТНИКОВ (присоединение — в interact/, 4f) ================= */
export function makeIlva(x:number,z:number){
  return makeUnit({
    name:'Илва Острый Глаз',short:'Илва',cls:'rogue',clsName:'Плут',side:'hero',
    str:10,dex:16,con:12,int:12,wis:12,cha:14,hp:11,maxhp:11,ac:14,speed:6,
    weapon:{name:'Короткий лук',dice:[1,6],abil:'dex',range:8},
    dagger:{name:'Кинжал',dice:[1,4],abil:'dex',melee:true,range:1},
    armor:'Кожаный доспех',potions:1,x,z,color:0x3f7a6a,
    features:['Подлый удар — +1d6 урона, если рядом с целью есть союзник (с 3 ур. — 2d6)',
      'Отравленный клинок — бонус: следующая ближняя атака отравляет цель (2 хода)',
      'Уклонение — бонус: КД +3 до её следующего хода',
      'Со 2 уровня: +6 HP, ЛОВ +1'],
  });
}
export function makeKaya(x:number,z:number){
  return makeUnit({
    name:'Кая Заря',short:'Кая',cls:'cleric',clsName:'Жрица',side:'hero',
    str:13,dex:10,con:14,int:9,wis:16,cha:13,hp:12,maxhp:12,ac:15,speed:5,
    weapon:{name:'Булава',dice:[1,6],abil:'str',melee:true,range:1},
    dagger:null,armor:'Чешуйчатый доспех',potions:1,slots:2,slotsMax:2,x,z,color:0xc9b070,
    features:['Лечение — действие + ячейка: 1d8+МДР',
      'Щит веры — бонус + ячейка: +2 КД (3 хода)',
      'Карание света — действие + ячейка: 2d6 излучения, дальность 6 кл.',
      'Гнев рассвета — 1/бой: 2d6 излучения всем соседям (нежить — вдвойне)',
      'Со 2 уровня: +6 HP, МДР +1, 3 ячейки; с 3 уровня — 4 ячейки'],
  });
}
/* ================= v1.5: БОЛОТА — УТОПЛЕННИКИ, УЛЬВА, ОЛЬХА ================= */
const DROWNED:UnitTemplate={name:'Утопленник',short:'Утопленник',hp:14,ac:12,xp:70,color:0x5a7a62,
  weapon:{name:'Гнилые когти',dice:[1,6],abil:'str',melee:true,range:1}};
export function makeDrowned(x:number,z:number){
  gobCount[DROWNED.short]=(gobCount[DROWNED.short]||0)+1;
  const n=gobCount[DROWNED.short];
  return makeUnit({
    name:DROWNED.name+(n>1?' №'+n:''),short:DROWNED.short+(n>1?' '+n:''),side:'goblin',
    cls:'undead',clsName:'Утопленник',x,z,
    str:13,dex:10,con:14,int:3,wis:10,cha:6,
    hp:DROWNED.hp,maxhp:DROWNED.hp,ac:DROWNED.ac,speed:5,xp:DROWNED.xp,color:DROWNED.color,skin:0x7a9a82,
    weapon:DROWNED.weapon,dagger:null,keepDist:false,features:['Всплывает из трясины по зову Матери Топей'],
  });
}
export function makeUlva(){
  return makeUnit({
    name:'Ульва, Матерь Топей',short:'Ульва',cls:'swampboss',clsName:'Жрица Глубин',side:'goblin',
    str:11,dex:13,con:14,int:14,wis:17,cha:15,
    hp:54,maxhp:54,ac:15,speed:5,xp:450,x:SWAMP.BOSS[0],z:SWAMP.BOSS[1],
    color:0x3f5a45,skin:0x9ab88a,staff:true,tipColor:0x8fe87f,
    keepDist:true,bossBrain:true,isBoss:true,swampBoss:true,phase2:false,
    weapon:{name:'Хлыст трясины',dice:[1,8],abil:'wis',range:6,necro:true,status:{type:'poison',turns:2}},
    dagger:{name:'Ритуальный серп',dice:[1,6],abil:'str',melee:true,range:1},
    features:['Хватка трясины — на половине хитов поднимает утопленников из жижи',
      'Хлыст трясины отравляет на 2 хода',
      'Споры болот веками копились в её лёгких'],
  });
}
/* пятая спутница — друид Ольха (подключается на болотах, interact/swamp.ts) */
export function makeOlkha(x:number,z:number){
  return makeUnit({
    name:'Ольха Тисовая',short:'Ольха',cls:'druid',clsName:'Друид',side:'hero',
    str:11,dex:12,con:13,int:9,wis:16,cha:12,hp:12,maxhp:12,ac:13,speed:5,
    weapon:{name:'Посох тиса',dice:[1,6],abil:'str',melee:true,range:1},
    dagger:null,armor:'Кожаный доспех',potions:1,slots:2,slotsMax:2,
    staff:true,tipColor:0x9fe87f,x,z,color:0x6a9a4a,
    features:['Разряд молнии — действие + ячейка: 2d6+МДР молнии, дальность 7 кл.',
      'Облако спор — действие + ячейка: 1d6+МДР яда в радиусе 2 кл., отравление',
      'Со 2 уровня: +6 HP, МДР +1, 3 ячейки; с 3 уровня — 4 ячейки'],
  });
}
/* ================= v1.6: ПЕРЕВАЛ ВЕЛИКАНОВ — ОГРЫ, ГАРРУМ =================
   Огры — крупные капсулы (mesh масштаб 1.4), бьют больно; Гаррум —
   босс с валунами (дальний бой) и каменной кожей на полсмерти. */
const OGRE:UnitTemplate={name:'Огр перевала',short:'Огр',hp:30,ac:13,xp:220,color:0x8a6a4a,
  weapon:{name:'Дубище',dice:[2,6],abil:'str',melee:true,range:1}};
export function makeOgre(x:number,z:number){
  gobCount[OGRE.short]=(gobCount[OGRE.short]||0)+1;
  const n=gobCount[OGRE.short];
  const u=makeUnit({
    name:OGRE.name+(n>1?' №'+n:''),short:OGRE.short+(n>1?' '+n:''),side:'goblin',
    cls:'ogre',clsName:'Огр',x,z,
    str:17,dex:10,con:16,int:6,wis:8,cha:6,
    hp:OGRE.hp,maxhp:OGRE.hp,ac:OGRE.ac,speed:5,xp:OGRE.xp,color:OGRE.color,skin:0xb8a084,
    weapon:OGRE.weapon,dagger:null,keepDist:false,features:['От слова «нет» ломает мост вместе с теми, кто на нём стоит'],
  });
  u.mesh.scale.setScalar(1.42);/* огр выше героя на голову */
  return u;
}
export function makeGarrum(){
  return makeUnit({
    name:'Гаррум Камнегрыз',short:'Гаррум',cls:'giant',clsName:'Великан',side:'goblin',
    str:19,dex:12,con:18,int:8,wis:10,cha:12,
    hp:64,maxhp:64,ac:14,speed:6,xp:500,x:GIANTS.BOSS[0],z:GIANTS.BOSS[1],
    color:0x6a5a4a,skin:0xa89884,
    keepDist:true,bossBrain:true,isBoss:true,giantBoss:true,fearImmune:true,phase2:false,
    weapon:{name:'Брошенный валун',dice:[2,6],abil:'str',range:6},
    dagger:{name:'Громовая дубина',dice:[2,6],abil:'str',melee:true,range:1},
    features:['Швыряет валуны на шесть клеток — встречает гостей ещё на подходе',
      'На половине хитов каменеет: КД +3',
      'Оползень — каменный град вокруг него (всем соседям)',
      'Не ведает страха — запугивание бесполезно'],
  });
}
/* ================= v1.8: ЦИТАДЕЛЬ — РЫЦАРИ-ОСТУПНИКИ, АДЕПТ, МАЛВЕХ =================
   Гарнизон финала: рыцари Дозора, павшие под песню Глубинного (элитная
   тяжёлая пехота), адепт-целитель и лорд-комендант Малвех — финальный
   босс с «Гласом глубин» на полсмерти. */
const KNIGHT:UnitTemplate={name:'Рыцарь-отступник',short:'Рыцарь',hp:26,ac:15,xp:200,color:0x5a6a7a,
  weapon:{name:'Клеймор Дозора',dice:[2,6],abil:'str',melee:true,range:1}};
export function makeKnight(x:number,z:number){
  gobCount[KNIGHT.short]=(gobCount[KNIGHT.short]||0)+1;
  const n=gobCount[KNIGHT.short];
  const u=makeUnit({
    name:KNIGHT.name+(n>1?' №'+n:''),short:KNIGHT.short+(n>1?' '+n:''),side:'goblin',
    cls:'knight',clsName:'Рыцарь-отступник',x,z,
    str:16,dex:12,con:14,int:8,wis:10,cha:8,
    hp:KNIGHT.hp,maxhp:KNIGHT.hp,ac:KNIGHT.ac,speed:6,xp:KNIGHT.xp,
    color:KNIGHT.color,skin:0xcac2ae,
    weapon:KNIGHT.weapon,dagger:null,keepDist:false,features:['Дозорный рыцарь, ушедший за песней Глубинного. Бьёт тяжело и стоит крепко'],
  });
  return applyElite(u);
}
export function makeAdept(x:number,z:number){
  gobCount['Адепт']=(gobCount['Адепт']||0)+1;
  const n=gobCount['Адепт'];
  const u=makeUnit({
    name:'Адепт Глубин'+(n>1?' №'+n:''),short:'Адепт'+(n>1?' '+n:''),side:'goblin',
    cls:'cultist',clsName:'Адепт Глубин',x,z,
    str:10,dex:14,con:12,int:16,wis:14,cha:12,
    hp:18,maxhp:18,ac:13,speed:6,xp:180,color:0x3f6a5a,skin:0xcfc2a8,
    staff:true,tipColor:0x8fe87f,
    weapon:{name:'Струя бездны',dice:[1,8],abil:'int',range:8,necro:true},
    dagger:{name:'Ритуальный нож',dice:[1,4],abil:'str',melee:true,range:1},
    keepDist:true,healer:true,features:['Латает раненых «могильной песнью» — сначала вырубите его'],
  });
  return applyElite(u);
}
export function makeMalveh(){
  return makeUnit({
    name:'Малвех, лорд-комендант',short:'Малвех',cls:'lord',clsName:'Лорд-комендант',side:'goblin',
    str:18,dex:12,con:16,int:14,wis:14,cha:16,
    hp:72,maxhp:72,ac:16,speed:5,xp:600,x:CITADEL.BOSS[0],z:CITADEL.BOSS[1],
    color:0x2f4f45,skin:0xb8c2ae,staff:false,tipColor:0x6fd3a0,
    keepDist:false,bossBrain:true,isBoss:true,citadelBoss:true,fearImmune:true,phase2:false,
    weapon:{name:'Клеймо коменданта',dice:[2,6],abil:'str',melee:true,range:1},
    dagger:{name:'Копьё бездны',dice:[1,8],abil:'int',range:6,necro:true,status:{type:'poison',turns:2}},
    features:['Клеймо коменданта — двуручный меч Дозора, 2d6+СИЛ в упор',
      'Волна бездны — некротический шквал вокруг него (всем соседям)',
      'На половине хитов: «ГЛАС ГЛУБИН» — зовёт утопленников из-под двора, КД +2',
      'Не ведает страха — запугивание бесполезно',
      'Печать сундука держится, пока он «жив»'],
  });
}
export function spawnEnemies(){/* v0.8: враги зависят от карты и прогресса; v1.2: +1 враг под отряд из 4 */
  for(const k in gobCount)delete gobCount[k];
  if(G.mapId==='forest'){
    S.patrolGroup=S.patrolDone?[]:[makeGoblin(GOB.bruiser,12,13),makeGoblin(GOB.bruiser,14,12)];
    if(S.campDone){S.campGroup=[];return;}
    const grat=makeGoblin(GOB.chief,21,6);
    grat.name='Грат Костолом';grat.short='Грат';grat.hp=grat.maxhp=22;grat.xp=200;
    grat.isBoss=true;grat.mainBoss=true;grat.str=14;
    /* v1.3: ветеран — элита лагеря Костей */
    S.campGroup=[grat,makeGoblin(GOB.shaman,19,4),makeGoblin(GOB.bruiser,23,5),makeGoblin(GOB.archer,24,4),makeGoblin(GOB.bruiser,20,7),applyElite(makeGoblin(GOB.veteran,22,8))];
  }else if(G.mapId==='swamp'){/* v1.5: гарнизон болот — жрица, культисты Глубин, утопленники */
    S.patrolGroup=[];S.campGroup=[];
    if(S.swampDone){S.swampGroup=[];return;}/* убитая Ульва не поднимается вновь */
    S.swampGroup=[makeUlva(),makeCultist('deep',10,6),makeCultist('deep',18,6),makeCultist('acolyte',11,4),
      makeDrowned(10,12),makeDrowned(18,12),makeDrowned(14,12)];
  }else if(G.mapId==='giants'){/* v1.6: гарнизон перевала — огры и Гаррум Камнегрыз */
    S.patrolGroup=[];S.campGroup=[];
    if(S.giantsDone){S.giantsGroup=[];return;}/* убитый Гаррум не встаёт вновь */
    S.giantsGroup=[makeGarrum(),makeOgre(10,8),makeOgre(18,8),applyElite(makeOgre(21,5))];
  }else if(G.mapId==='citadel'){/* v1.8: гарнизон цитадели — Малвех, рыцари, адепт, культисты */
    S.patrolGroup=[];S.campGroup=[];
    if(S.citadelDone){S.citadelGroup=[];return;}/* убитый Малвех не встаёт вновь */
    S.citadelGroup=[makeMalveh(),makeKnight(10,8),makeKnight(18,8),makeAdept(12,4),
      makeCultist('deep',16,5),makeCultist('deep',11,6)];
  }else{
    S.patrolGroup=[];S.campGroup=[];
    if(S.necroSlain){S.cryptGroup=[];return;}/* v1.1: убитый некромант не поднимается вновь */
    const necro=makeNecro();
    /* v1.3: гарнизон крипты — культисты, ученик-целитель и элитный скелет-рыцарь */
    S.cryptGroup=[necro,makeSkeleton(12,5),makeSkeleton(16,5),
      makeSkeletonKnight(14,6),makeCultist('cultist',11,4),makeCultist('cultist',17,4),
      makeCultist('acolyte',15,6)];
  }
}
