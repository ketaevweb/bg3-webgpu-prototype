'use client';
/* ================= HUD PANELS (Фаза 6 рефакторинга) =================
   Журнал боя, карточки отряда, трекер заданий, панель действий.
   Каждый компонент подписан на свой срез стора (zustand-селектор) —
   перерисовка точечная. Разметка/классы 1:1 с прежним innerHTML. */
import { useEffect, useRef } from 'react';
import { useUi } from '@/game/ui/store';

/* ---- журнал боя (пополнение из pushLog, автоскролл вниз) ---- */
export function LogPanel(){
  const log=useUi(s=>s.log);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const el=ref.current;
    if(el)el.scrollTop=el.scrollHeight;
  },[log]);
  return (
    <div id="log" className="panel">
      <h3>Журнал боя</h3>
      <div id="logbody" ref={ref}>
        {log.map(e=><p key={e.id} className={e.cls}>{e.msg}</p>)}
      </div>
    </div>
  );
}

/* ---- карточки героев/спутниц (клик — лист персонажа) ---- */
export function PartyCards(){
  const party=useUi(s=>s.party);
  return (
    <div id="party">
      {party.map((h,i)=>(
        <div key={i} className={'panel pcard'+(h.active?' active':'')} onClick={h.open}>
          <div className="prow">
            <span className="pname">{h.name}</span>
            <span className="pcls">{h.clsName} · ур. {h.level}</span>
          </div>
          <div className="pbar"><i style={{width:Math.max(0,h.hp/h.maxhp*100)+'%'}}/></div>
          <div className="pinfo">
            <span>HP {Math.max(0,h.hp)}/{h.maxhp} • КД {h.ac}</span>
            <span>Зелий: {h.potions}</span>
          </div>
          <div className="pst">
            {h.statuses.map((s,j)=>
              <span key={j} className="stb" style={{background:s.css}}>{s.label}</span>)}
            <span style={{color:'#8f866d',marginLeft:'auto'}}>XP {h.xp}/{h.need}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- трекер заданий + золото ---- */
export function QuestTracker(){
  const tracker=useUi(s=>s.tracker);
  return (
    <div id="qtrack" className="panel">
      <h3>Задания · <span id="goldTxt">{tracker.gold}</span></h3>
      <div id="qbody">
        {tracker.quests.length===0
          ? <div className="qo">Активных заданий нет. Поговорите с Дамроком или идите на север.</div>
          : tracker.quests.map((q,i)=>(
            <div key={i} className="q">
              <div className="qn">{q.name}</div>
              {q.objs.map((o,j)=>
                <div key={j} className={'qo'+(o.done?' done':'')}>{o.done?'✓':'·'} {o.t}</div>)}
            </div>
          ))}
      </div>
    </div>
  );
}

/* ---- панель действий боя (пипсы + кнопки ACTIONS) ---- */
export function ActionBar(){
  const ab=useUi(s=>s.actionbar);
  if(!ab.visible)return null;
  return (
    <div id="actionbar" className="panel" style={{display:'block'}}>
      <div id="pips">
        {ab.waiting
          ? <span>Ход противника…</span>
          : ab.pips.map((p,i)=>
            p.value===null
              ? <span key={i}>{p.label}</span>
              : <span key={i}>{p.label}{' '}<b>{p.value}</b></span>)}
      </div>
      <div id="btns">
        {ab.waiting
          ? <button disabled>Ожидание…</button>
          : ab.btns.map((b,i)=>(
            <button key={i} className={b.cls} disabled={b.disabled} onClick={b.onClick}>{b.label}</button>
          ))}
      </div>
    </div>
  );
}
