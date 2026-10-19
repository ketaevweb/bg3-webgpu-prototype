/* ================= VOICE CFG (v2.5+v2.6+v2.8 «Голоса Глубин/Эхо битвы/Глас бездны») =================
   Каталог голосов озвучки — ЕДИНЫЙ источник для трёх потребителей:
   ui/voice.ts (клиент: манифест+динамика), /api/tts (сервер: piper+ffmpeg)
   и scripts/gen_voices.cjs (офлайн-генератор манифеста, читает через bun).
   ЛИСТ: импортов нет (циклы исключены по построению).
   Голоса — нейро-TTS piper, русские модели (scripts/piper/*.onnx):
   ruslan (рассказчик), denis (торговцы/мрачные), dmitri (базовый муж.),
   irina (женские). Характер — параметрами: темп (len), сдвиг высоты
   (pitch, полутона), эхо (aecho) и срез верхов (lowpass) — призрак
   и слуги Глубин звучат «из-под воды», вожаки — ниже и тяжелее. */

export interface VoiceDef{
  base:'ruslan'|'denis'|'dmitri'|'irina';/* модель piper */
  len?:number;/* length_scale: больше — медленнее и солиднее */
  pitch?:number;/* сдвиг высоты, полутона (ffmpeg asetrate+atempo) */
  gain?:number;/* правка громкости, дБ */
  echo?:string;/* цепочка aecho in:out:delay:decay */
  lowpass?:number;/* срез верхов, Гц (потусторонность) */
}

export const VOICES:Record<string,VoiceDef>={
  narrator:{base:'ruslan',len:1.0,gain:-1,echo:'0.22:0.22:55:0.32'},/* рассказчик/наставник */
  hero:{base:'dmitri',len:1.0,gain:0},/* реплики отряда */
  damrock:{base:'denis',len:1.05,gain:0},/* Дамрок Бочкарь — торговец */
  haldir:{base:'dmitri',len:0.95,pitch:1,gain:-1},/* Хальдир — светлее, ровно */
  patrol:{base:'dmitri',len:0.85,pitch:3,gain:1},/* гоблин — выше и шустрее */
  grat:{base:'dmitri',len:1.12,pitch:-2,gain:2},/* Грат — ниже, тяжелее */
  necro:{base:'denis',len:1.18,pitch:-1,gain:0,echo:'0.4:0.35:90:0.4'},/* Костепёр — тянущее эхо */
  ghost:{base:'denis',len:1.1,gain:-2,echo:'0.6:0.44:120:0.5',lowpass:2800},/* призрак — из-под воды */
  garrum:{base:'dmitri',len:1.2,pitch:-4,gain:2},/* Гаррум — гром-камень */
  malveh:{base:'dmitri',len:1.12,pitch:-3,gain:1,echo:'0.3:0.3:80:0.38'},/* Малвех — тёмный лорд */
  kaya:{base:'irina',len:1.06,gain:0},/* Кая — тёплая жрица */
  ilva:{base:'irina',len:0.88,pitch:1.5,gain:0},/* Илва — живая разведчица */
  olkha:{base:'irina',len:1.1,pitch:0.5,gain:-1},/* Ольха — спокойная друидка */
  ulva:{base:'irina',len:1.15,pitch:-2,gain:0,echo:'0.35:0.33:70:0.4'},/* Ульва — Матерь Топей */
  mirella:{base:'irina',len:0.98,pitch:0.5,gain:0},/* v2.6: Мирелла — ясная волшебница */
  champion:{base:'dmitri',len:1.15,pitch:-3,gain:2,echo:'0.35:0.33:75:0.42'},/* v2.8: Чемпион бездны — ревёт из глубины */
};

/* ================= v2.8 «ГЛАС БЕЗДНЫ»: боевые реплики ВРАГОВ =================
   Носители ауры властителя (Unit.aura>0 — Грат/Костепёр/Ульва/Гаррум/
   Малвех/Чемпион бездны) при ПЕРВОМ применении ауры в бою ревут свою
   реплику СВОИМ голосом — как интро-крик босса в BG3. Ключ — Unit.short
   в нижнем регистре; голос — из VOICES. Кулдаун не общий с героями:
   флаг src.enemyBarked живёт на юните до пересоздания (новый вход на
   карту/новая волна — босс кричит вновь). Единый источник для
   ui/barks.ts (enemyBark) и voicesynth.ts (синтез ebark.*). */
export const ENEMY_VOICE:Record<string,string>={
  грат:'grat',костепёр:'necro',ульва:'ulva',гаррум:'garrum',малвех:'malveh',чемпион:'champion',
};
export const ENEMY_BARKS:Record<string,string>={
  грат:'Мясо само пришло в котёл! Рвите их, мелкие!',
  костепёр:'Мои ниточки дёргают — и мясо пляшет!',
  ульва:'Тина поднимется — и погладит вас, теплокровные...',
  гаррум:'ГРОМ! И КАМЕНЬ!',
  малвех:'Глубина заберёт вас — я лишь открою дверь!',
  чемпион:'БЕЗДНА ВЕДЁТ МЕНЯ! К плоти!',
};

/* DLGS-ключ → голос (реплики НПС в showNode) */
export const NPC_VOICE:Record<string,string>={
  patrol:'patrol',boss:'grat',damrock:'damrock',ilva:'ilva',kaya:'kaya',
  necro:'necro',swampboss:'ulva',olkha:'olkha',haldir:'haldir',ghost:'ghost',
  giantboss:'garrum',citadelboss:'malveh',
};

/* ================= v2.6 «ЭХО БИТВЫ»: боевые реплики героев =================
   Краткие выкрики в бою — как barks в BG3: герой отзывается на событие
   (начало боя, крит, убийство, ранение, падение, победа) своим голосом.
   HERO_VOICE — ключ героя (по Unit.short, нижний регистр) → голос из
   VOICES; BARKS — тексты: [герой][событие]. Единый источник для
   ui/barks.ts (выбор/кулдаун) и voicesynth.ts (синтез манифеста).
   Ключи файлов — транслит bannerSlug (bark.torik.start). */
export const HERO_VOICE:Record<string,string>={
  торик:'hero',мирелла:'mirella',илва:'ilva',кая:'kaya',ольха:'olkha',хальдир:'haldir',
};
export type BarkKind='start'|'crit'|'kill'|'hurt'|'down'|'won';
export const BARK_KINDS:BarkKind[]=['start','crit','kill','hurt','down','won'];/* порядок стабилен (манифест) */
export const BARKS:Record<string,Record<BarkKind,string>>={
  торик:{
    start:'К оружию! Держим строй!',crit:'Вот это удар!',
    kill:'Ещё один!',hurt:'Я держусь... держусь!',
    down:'Не конец... для меня...',won:'Так им! Ни шагу назад!',
  },
  мирелла:{
    start:'Огонь готов!',crit:'Сила стихий!',
    kill:'Испепелена!',hurt:'Ячейки... на исходе!',
    down:'Досадно... я почти справилась...',won:'Чисто сработано.',
  },
  илва:{
    start:'Тихо... ага, к бою!',crit:'Прямо в щель доспеха!',
    kill:'Легко и изящно.',hurt:'Эй! Я же под уклонением!',
    down:'Ушла в тень... навсегда.',won:'Ни шума, ни пыли.',
  },
  кая:{
    start:'Рассвет с нами!',crit:'Свет покарал!',
    kill:'Да будет так.',hurt:'Силы слабеют...',
    down:'Я ухожу... к свету.',won:'Все живы? Хорошо.',
  },
  ольха:{
    start:'Глубина не пройдёт!',crit:'Гнев тиса!',
    kill:'Круг замкнулся.',hurt:'Корни держат... едва.',
    down:'Возвращаюсь... к земле.',won:'Природа выдохнула.',
  },
  хальдир:{
    start:'Дозор не отступает!',crit:'Карающим ударом!',
    kill:'За Дозор!',hurt:'Клятва держит!',
    down:'Дозор... помнит...',won:'Долг исполнен.',
  },
};

/* v2.8: ключ ebark-файла в манифесте: ebark.<транслит-short>.aura */
export function enemyBarkId(key:string):string{return 'ebark.'+bannerSlug(key)+'.aura';}

/* ---- числа словами 0..999 (баннеры: «ВОЛНА 12» → «волна двенадцать») ---- */
const ONES=['','один','два','три','четыре','пять','шесть','семь','восемь','девять'];
const TEENS=['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
const TENS=['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
const HUNDREDS=['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];

export function numRu(n:number):string{
  n=Math.round(n);
  if(n<0||n>999)return String(n);
  const h=Math.floor(n/100),rest=n%100;
  const out=h?HUNDREDS[h]:'';
  if(rest>=10&&rest<20)return (out?out+' ':'')+TEENS[rest-10];
  const t=Math.floor(rest/10),o=rest%10;
  const parts:string[]=[];
  if(out)parts.push(out);
  if(t)parts.push(TENS[t]);
  if(o)parts.push(ONES[o]);
  return parts.join(' ')||'ноль';
}

/* подготовка текста к TTS: числа → слова, символы → слова */
export function ttsNormalize(t:string):string{
  let s=t.replace(/\+/g,' плюс ').replace(/×/g,' умножить на ')
        .replace(/%/g,' процентов').replace(/−|—|–/g,',').replace(/…/g,',');
  s=s.replace(/\d+/g,(m)=>numRu(parseInt(m,10)));
  return s.replace(/\s+/g,' ').trim();
}

/* слаг баннера (клиент и генератор — одна реализация): «ВОЛНА 2 ИЗ 5»
   → 'volna-2-iz-5' — ключ bann.<slug> в манифесте */
const TRANSLIT:Record<string,string>={
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',
  м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',
  ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
};
export function bannerSlug(text:string):string{
  let s='';
  for(const ch of text.toLowerCase()){
    if(TRANSLIT[ch]!==undefined)s+=TRANSLIT[ch];
    else if(/[a-z0-9]/.test(ch))s+=ch;
    else s+='-';
  }
  return s.replace(/-+/g,'-').replace(/^-|-$/g,'');
}
