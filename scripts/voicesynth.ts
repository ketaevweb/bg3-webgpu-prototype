/* voicesynth.ts — СИНТЕЗ озвучки v2.5 «Голоса Глубины» (bun).
   Вход:  scripts/voice_lines.json (пробы из gen_voices.cjs — тексты 1:1
   с DLGS/туториалом/сезонами/заданиями/баннерами).
   Выход: public/voices/<id>.mp3 (piper + ffmpeg-обработка тона по
   voicecfg.VOICES) + public/voices/manifest.json {id → {v, d}}.
   Ключи 'bannerraw:<текст>' → 'bann.'+bannerSlug(текст), голос рассказчика.
   Идемпотентен: существующие mp3 (>1КБ) не пересинтезируются.
   Запуск: bun scripts/voicesynth.ts */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { VOICES, ttsNormalize, bannerSlug } from '../src/game/voicecfg';

interface LineDef{v:string;t:string;}
interface ManLine{v:string;d:number;}

const ROOT=path.join(__dirname,'..');
const LINES=path.join(__dirname,'voice_lines.json');
const OUTDIR=path.join(ROOT,'public','voices');
const PIPER=process.env.PIPER_BIN||'/home/z/.venv/bin/piper';

function synthOne(id:string,voiceId:string,text:string):number{
  const def=VOICES[voiceId];
  if(!def)throw new Error('unknown voice '+voiceId);
  const model=path.join(ROOT,'scripts','piper','ru_RU-'+def.base+'-medium.onnx');
  const tmpWav=path.join(os.tmpdir(),'bg3g_'+id.replace(/[^a-z0-9]/gi,'_')+'.wav');
  const outMp3=path.join(OUTDIR,id+'.mp3');
  const t=ttsNormalize(text);
  const p=spawnSync(PIPER,['-m',model,'-f',tmpWav,'--sentence-silence','0.18'],
    {input:t,timeout:120000});
  if(p.status!==0||!fs.existsSync(tmpWav)||fs.statSync(tmpWav).size<1000)
    throw new Error('piper failed: '+id);
  const pitch=def.pitch??0;
  const rate=Math.pow(2,pitch/12);
  const chain:string[]=[];
  if(rate!==1)chain.push('asetrate=22050*'+rate.toFixed(5),'aresample=22050','atempo='+(1/rate).toFixed(5));
  if(def.lowpass)chain.push('lowpass=f='+def.lowpass);
  if(def.echo)chain.push('aecho='+def.echo);
  chain.push('volume='+(def.gain??0)+'dB');
  const f=spawnSync('ffmpeg',['-y','-v','error','-i',tmpWav,'-af',chain.join(','),
    '-codec:a','libmp3lame','-b:a','96k',outMp3],{timeout:120000});
  try{fs.unlinkSync(tmpWav);}catch{}
  if(f.status!==0||!fs.existsSync(outMp3)||fs.statSync(outMp3).size<1000)
    throw new Error('ffmpeg failed: '+id);
  const d=spawnSync('ffprobe',['-v','error','-show_entries','format=duration',
    '-of','default=nw=1:nk=1',outMp3],{encoding:'utf8'});
  return d.status===0?parseFloat(d.stdout)||0:0;
}

function main():void{
  const raw=JSON.parse(fs.readFileSync(LINES,'utf8')) as Record<string,LineDef>;
  fs.mkdirSync(OUTDIR,{recursive:true});
  /* bannerraw:<текст> → bann.<слаг>; остальное — как есть */
  const jobs:Record<string,{v:string;t:string}>={};
  for(const [rawId,line] of Object.entries(raw)){
    if(rawId.startsWith('bannerraw:')){
      const text=rawId.slice('bannerraw:'.length);
      jobs['bann.'+bannerSlug(text)]={v:line.v,t:text.toLowerCase()};
    }else jobs[rawId]=line;
  }
  const manifest:Record<string,ManLine>={};
  let done=0,skipped=0,total=0;
  for(const id of Object.keys(jobs).sort()){
    const outMp3=path.join(OUTDIR,id+'.mp3');
    let dur=0;
    if(fs.existsSync(outMp3)&&fs.statSync(outMp3).size>1000){
      const d=spawnSync('ffprobe',['-v','error','-show_entries','format=duration',
        '-of','default=nw=1:nk=1',outMp3],{encoding:'utf8'});
      dur=d.status===0?parseFloat(d.stdout)||0:0;
      skipped++;
    }else{
      dur=synthOne(id,jobs[id].v,jobs[id].t);
      done++;
      total+=fs.statSync(outMp3).size;
    }
    manifest[id]={v:jobs[id].v,d:Math.round(dur*10)/10};
  }
  fs.writeFileSync(path.join(OUTDIR,'manifest.json'),
    JSON.stringify({ver:1,lines:manifest},null,0));
  const secs=Object.values(manifest).reduce((a,m)=>a+m.d,0);
  console.log('[synth] generated: '+done+', kept: '+skipped+', total lines: '+
    Object.keys(manifest).length);
  console.log('[synth] audio: ~'+Math.round(secs)+' c ('+(secs/60).toFixed(1)+
    ' мин), новых байт: '+(total/1e6).toFixed(1)+' МБ');
}

main();
