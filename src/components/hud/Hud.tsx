'use client';
/* ================= HUD ROOT (Фаза 6 рефакторинга) =================
   Корневая композиция React-HUD: читает zustand-стор ui/store.ts и
   рендерит те же id/классы, что были в HUD_HTML — game.css работает
   без изменений. Компоненты НЕ импортируют движковые модули (только
   стор) — вызовы в движок идут через колбэки в view-моделях. */
import { useUi } from '@/game/ui/store';
import { LogPanel, PartyCards, QuestTracker, ActionBar } from './panels';
import { DialogBox, ShopPanel, JournalPanel, ChoicePanel } from './dialogs';
import { GfxPanel, SavesPanel, EndScreen, SheetModal } from './menus';

/* ---- системные кнопки: звук / графика / сохранения ---- */
function SysButtons(){
  const sys=useUi(s=>s.sys);
  return <>
    <button id="sndBtn" title="Звук вкл/выкл" onClick={sys.onSnd}>{sys.sndIcon}</button>
    <button id="gfxBtn" title="Настройки графики (G)" onClick={sys.onGfx}>⚙</button>
    <button id="saveBtn" title="Сохранения (K)" onClick={sys.onSaves}>💾</button>
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

/* ---- большой баннер (ПОБЕДА / НОВОЕ ЗАДАНИЕ / УРОВЕНЬ) ---- */
function Banner(){
  const banner=useUi(s=>s.banner);
  const bannerOn=useUi(s=>s.bannerOn);
  return <div id="banner" style={{opacity:bannerOn?1:0}}>{banner}</div>;
}

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
    <BossBar/>
    <LogPanel/>
    <PartyCards/>
    <QuestTracker/>
    <Hint/>
    <Banner/>
    <Tip/>
    <ActionBar/>
    <DialogBox/>
    <ShopPanel/>
    <JournalPanel/>
    <ChoicePanel/>
    <GfxPanel/>
    <SavesPanel/>
    <EndScreen/>
    <SheetModal/>
  </>;
}
