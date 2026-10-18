'use client';
/* ================= HUD ROOT (Фаза 6 рефакторинга) =================
   Корневая композиция React-HUD: читает zustand-стор ui/store.ts и
   рендерит те же id/классы, что были в HUD_HTML — game.css работает
   без изменений. Компоненты НЕ импортируют движковые модули (только
   стор) — вызовы в движок идут через колбэки в view-моделях. */
import { useEffect, useRef } from 'react';
import { useUi } from '@/game/ui/store';
import { LogPanel, PartyCards, QuestTracker, ActionBar } from './panels';
import { DialogBox, ShopPanel, JournalPanel, ChoicePanel } from './dialogs';
import { GfxPanel, SavesPanel, EndScreen, SheetModal, BagPanel } from './menus';

/* ---- системные кнопки: звук / миникарта / графика / сохранения / снаряжение ---- */
function SysButtons(){
  const sys=useUi(s=>s.sys);
  return <>
    <button id="sndBtn" title="Звук вкл/выкл" onClick={sys.onSnd}>{sys.sndIcon}</button>
    <button id="mmBtn" title="Миникарта (M)" onClick={sys.onMm}>🗺</button>
    <button id="gfxBtn" title="Настройки графики (G)" onClick={sys.onGfx}>⚙</button>
    <button id="saveBtn" title="Сохранения (K)" onClick={sys.onSaves}>💾</button>
    <button id="bagBtn" title="Снаряжение (I)" onClick={sys.onBag}>🎒</button>
  </>;
}

/* ---- верхняя панель: раунд/карта, чей ход, полоса инициативы ---- */
function TopBar(){
  const topbar=useUi(s=>s.topbar);
  const init=useUi(s=>s.init);
  return (
    <div id="topbar" className="panel">
      <div id="round">{topbar.round}</div>
      <div id="turnb" style={topbar.turn?{color:topbar.turnColor??undefined}:undefined}>{topbar.turn}</div>
      <div id="initRow">
        {init.map((c,i)=>(
          <span key={i} className={'chip '+c.side+(c.cur?' cur ':'')+(!c.dead?'':' dead')}>
            {c.short} {c.init}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---- боссбар ---- */
function BossBar(){
  const boss=useUi(s=>s.boss);
  if(!boss)return null;
  return (
    <div id="bossbar" style={{display:'block'}}>
      <div id="bossname">{boss.name}</div>
      <div className="bbar"><i style={{width:Math.max(0,boss.hpPct)+'%'}}/></div>
    </div>
  );
}

/* ---- подсказка над панелью действий ---- */
function Hint(){
  const hint=useUi(s=>s.hint);
  return <div id="hint">{hint}</div>;
}

/* ---- v1.4: карточка наставника (шаг продвигается реальными действиями игрока) ---- */
function TutCard(){
  const tut=useUi(s=>s.tut);
  if(!tut)return null;
  return (
    <div id="tut" className="panel">
      <h3>{tut.title}</h3>
      <div className="tutn">Наставник · шаг {tut.i} из {tut.n}</div>
      <div id="tutText">{tut.text}</div>
      <div className="tutbar"><i style={{width:(tut.i/tut.n*100)+'%'}}/></div>
      <button onClick={tut.onSkip}>Пропустить обучение</button>
    </div>
  );
}

/* ---- большой баннер (ПОБЕДА / НОВОЕ ЗАДАНИЕ / УРОВЕНЬ) ---- */
function Banner(){
  const banner=useUi(s=>s.banner);
  const bannerOn=useUi(s=>s.bannerOn);
  return <div id="banner" style={{opacity:bannerOn?1:0}}>{banner}</div>;
}

/* ---- v1.9: миникарта (M) — canvas-схема сетки из снимка стора ---- */
const MM_COLORS={bg:'#10160f',solid:'#3a4550',hero:'#7fd36a',enemy:'#e06c55',
  barrel:'#a8845a',fire:'#ff9a4d',inter:'#d8b45a',cur:'#ffffff'} as const;
function MiniMap(){
  const open=useUi(s=>s.minimapOpen);
  const mm=useUi(s=>s.minimap);
  const ref=useRef<HTMLCanvasElement|null>(null);
  useEffect(()=>{
    if(!open||!mm)return;
    const cv=ref.current,ctx=cv&&cv.getContext('2d');
    if(!cv||!ctx)return;
    const cell=cv.width/mm.grid;
    ctx.fillStyle=MM_COLORS.bg;ctx.fillRect(0,0,cv.width,cv.height);
    ctx.fillStyle=MM_COLORS.solid;
    for(const idx of mm.solid){
      const x=idx%mm.grid,z=(idx-x)/mm.grid;
      ctx.fillRect(x*cell,z*cell,cell,cell);
    }
    for(let i=0;i<mm.dots.length;i+=3){
      const x=mm.dots[i],z=mm.dots[i+1],k=mm.dots[i+2];
      ctx.fillStyle=k===0?MM_COLORS.hero:k===1?MM_COLORS.enemy:k===2?MM_COLORS.inter:k===3?MM_COLORS.barrel:MM_COLORS.fire;
      ctx.beginPath();
      ctx.arc(x*cell+cell/2,z*cell+cell/2,k===2?cell*0.34:cell*0.42,0,Math.PI*2);
      ctx.fill();
    }
    /* белая рамка — текущий герой (поле cur приходит в снимке) */
    const cur=mm.cur;
    if(cur){
      ctx.strokeStyle=MM_COLORS.cur;ctx.lineWidth=1.5;
      ctx.strokeRect(cur.x*cell+0.75,cur.z*cell+0.75,cell-1.5,cell-1.5);
    }
  },[open,mm]);
  if(!open)return null;
  return (
    <div id="mm" className="panel">
      <h3>{mm?('Карта · '+mm.grid+'×'+mm.grid):'Карта'}</h3>
      <canvas id="mmCv" ref={ref} width={224} height={224}/>
      <div id="mmLegend">
        <i style={{background:MM_COLORS.hero}}/>отряд <i style={{background:MM_COLORS.enemy}}/>враги
        <i style={{background:MM_COLORS.inter}}/>точки <i style={{background:MM_COLORS.solid}}/>стены
      </div>
      <div className="mmtip">M — скрыть</div>
    </div>
  );}

/* ---- тултип под курсором (HTML собирает движок — showTipFor) ---- */
function Tip(){
  const tip=useUi(s=>s.tip);
  if(!tip)return null;
  return (
    <div id="tip" style={{display:'block',left:tip.x,top:tip.y}}
      dangerouslySetInnerHTML={{__html:tip.html}}/>
  );
}

export default function Hud(){
  return <>
    <SysButtons/>
    <TopBar/>
    <TutCard/>
    <BossBar/>
    <LogPanel/>
    <PartyCards/>
    <QuestTracker/>
    <Hint/>
    <Banner/>
    <Tip/>
    <ActionBar/>
    <MiniMap/>
    <DialogBox/>
    <ShopPanel/>
    <JournalPanel/>
    <ChoicePanel/>
    <GfxPanel/>
    <SavesPanel/>
    <BagPanel/>
    <EndScreen/>
    <SheetModal/>
  </>;
}
