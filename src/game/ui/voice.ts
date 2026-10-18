/* ================= VOICE (v2.5 «Голоса Глубин» + v2.6 громкость) =================
   Озвучка реплик и баннеров: офлайн-манифест (public/voices/manifest.json,
   генератор scripts/gen_voices.cjs) + динамика через /api/tts (piper на
   сервере, дисковый кэш) — для строк с интерполяцией (золото призрака,
   номера бесконечных волн). ЛИСТ: импортирует только voicecfg (данные);
   окно/AudioContext — лениво, каждый вызов защищён (без WebGL — молчим).
   Управление — настройка «Голоса» (gfx.voice, панель G); голос не мешает
   SFX: отдельный AudioContext и свой GainNode. E2E: voiceState() через
   __bg3.voice (on/ready/lines/last/hist/dyn) — звуки не проверяются,
   только факты воспроизведения. */
import { bannerSlug, ttsNormalize } from '../voicecfg';

interface ManLine{v:string;d:number;}
interface Manifest{ver:number;lines:Record<string,ManLine>;}

export interface DynReq{v:string;t:string;}

let man:Manifest|null=null;
let on=true;
let vol=1;/* v2.6: громкость голосов 0..1 (панель G «Громкость») */
let ctx:AudioContext|null=null;
let gain:GainNode|null=null;
let cur:AudioBufferSourceNode|null=null;
let lastId='';let lastAt=0;let dynCount=0;let lastDynOk=true;let gen=0;
const bufs=new Map<string,AudioBuffer>();
const hist:string[]=[];/* последние 12 прозвучавших ключей (E2E) */

export function voiceEnabled():boolean{return on&&!!man;}
export function setEnabled(v:boolean){
  on=!!v;
  if(!v){gen++;/* отложенные загрузки — в расход */stopVoice();}
}

/* v2.6: громкость голосов (0..1); живая правка gain + сохранение для
   unlock() — контекст создаётся лениво, при первом звуке */
export function setVolume(v:number){
  vol=Math.max(0,Math.min(1,v||0));
  try{if(gain)gain.gain.value=0.9*vol;}catch{}
}

/* манифест грузится один раз (bootGame после loadGfx); no-throw */
export async function initVoice():Promise<void>{
  try{
    const r=await fetch('/voices/manifest.json',{cache:'no-cache'});
    if(!r.ok){man=null;return;}
    man=await r.json() as Manifest;
  }catch{man=null;}
}

function unlock():void{
  try{
    if(typeof window==='undefined')return;
    if(!ctx){
      const AC=window.AudioContext||((window as unknown as{webkitAudioContext?:typeof AudioContext}).webkitAudioContext);
      if(!AC)return;
      ctx=new AC();
      gain=ctx.createGain();
      gain.gain.value=0.9*vol;
      gain.connect(ctx.destination);
    }
    if(ctx.state==='suspended')void ctx.resume();
  }catch{/* аудио недоступно — голоса молчат */}
}

function stopVoice():void{
  try{if(cur){cur.stop();cur.disconnect();}}catch{}
  cur=null;
}

async function decodeBuf(data:ArrayBuffer):Promise<AudioBuffer|null>{
  try{if(!ctx)return null;return await ctx.decodeAudioData(data);}catch{return null;}
}

async function loadBuf(id:string):Promise<AudioBuffer|null>{
  const hit=bufs.get(id);
  if(hit)return hit;
  try{
    const r=await fetch('/voices/'+id+'.mp3');
    if(!r.ok)return null;
    const b=await decodeBuf(await r.arrayBuffer());
    if(b)bufs.set(id,b);
    return b;
  }catch{return null;}
}

function startBuf(b:AudioBuffer):void{
  if(!ctx||!gain)return;
  stopVoice();
  const src=ctx.createBufferSource();
  src.buffer=b;src.connect(gain);
  src.onended=()=>{if(cur===src)cur=null;};
  src.start();
  cur=src;
}

function remember(id:string):void{
  lastId=id;lastAt=Date.now();
  hist.push(id);
  if(hist.length>12)hist.shift();
}

/* главная точка входа: ключ манифеста; промах + dyn → синтез на сервере.
   Реплика запоминается В МОМЕНТ СТАРТА (история полная — E2E), а звучит,
   если не перебита следующей (gen — как в BG3: новая линия перебивает
   старую; загрузка устаревшей не играет). closeDlg глушит текущую. */
export async function play(id:string,dyn?:DynReq):Promise<boolean>{
  if(!voiceEnabled())return false;
  unlock();
  const line=man?man.lines[id]:undefined;
  if(line){
    remember(id);
    const g=++gen;
    const b=await loadBuf(id);
    if(g!==gen||!on)return false;
    if(b){startBuf(b);return true;}
    return false;
  }
  if(dyn)return say(dyn.v,dyn.t,id);
  return false;
}

/* динамика: текст синтезируется /api/tts (кэш на сервере по хэшу) */
export async function say(v:string,text:string,key:string):Promise<boolean>{
  if(!voiceEnabled())return false;
  unlock();
  const t=ttsNormalize(text).slice(0,400);
  if(!t)return false;
  const g=++gen;
  remember(key);
  try{
    const r=await fetch('/api/tts?v='+encodeURIComponent(v)+'&t='+encodeURIComponent(t));
    if(!r.ok){lastDynOk=false;return false;}
    const b=await decodeBuf(await r.arrayBuffer());
    lastDynOk=true;dynCount++;
    if(!b||g!==gen||!on)return false;
    startBuf(b);
    return true;
  }catch{lastDynOk=false;return false;}
}

/* баннер: слаг из текста; в манифесте — файл, иначе — рассказчик с сервера */
export function banner(text:string):void{
  if(!voiceEnabled())return;
  const slug='bann.'+bannerSlug(text);
  if(man&&man.lines[slug])void play(slug);
  else void say('narrator',text.toLowerCase(),slug);
}

/* инспектор E2E (только чтение) */
export function voiceState(){
  return{on,ready:!!man,lines:man?Object.keys(man.lines).length:0,
    last:lastId,lastAt,playing:!!cur,dyn:dynCount,lastDynOk,hist:[...hist],vol};
}

/* фасад для модулей игры: единая точка вызова озвучки */
export const voice={play,say,banner,stopVoice,setEnabled,initVoice,voiceState,voiceEnabled,setVolume};
