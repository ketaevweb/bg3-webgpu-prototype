'use client';
/* ================= EDITOR PANEL (v3.3 «Кузница») =================
   React-панель редактора «как в Unity»: тулбар (⏸/⏭/темп/выбор кликом/
   спавн), слева Hierarchy (дерево сцены с поиском), справа Inspector
   (живые секции полей выбранного юнита + кнопки действий и статусов),
   вкладка «Мир» (глобальные параметры) и консоль действий снизу.
   Компонент только ЧИТАЕТ zustand-стор ui/editorStore.ts и зовёт
   колбэки act.* — вся логика в editor/bridge.ts (движковая сторона). */
import { useState } from 'react';
import { useEd } from '@/game/ui/editorStore';
import type { EdField, EdSection } from '@/game/ui/editorStore';

/* ---------- контролы полей инспектора ---------- */
function Row({r,onSet}:{r:EdField;onSet:(k:string,v:number|boolean|string)=>void}){
  if(r.type==='bool'){
    return (
      <label className="edRow">
        <span>{r.label}</span>
        <input type="checkbox" checked={!!r.value} onChange={e=>onSet(r.k,e.target.checked)}/>
      </label>
    );
  }
  if(r.type==='sel'){
    return (
      <label className="edRow">
        <span>{r.label}</span>
        <select value={String(r.value)} onChange={e=>onSet(r.k,e.target.value)}>
          {(r.opts||[]).map(([v,lab])=><option key={v} value={v}>{lab}</option>)}
        </select>
      </label>
    );
  }
  if(r.type==='str'){
    return (
      <label className="edRow">
        <span>{r.label}</span>
        <input type="text" defaultValue={String(r.value)}
          onBlur={e=>{if(e.target.value!==String(r.value))onSet(r.k,e.target.value);}}
          onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur();}}/>
      </label>
    );
  }
  return (
    <label className="edRow">
      <span>{r.label}</span>
      <input type="number" value={Number.isFinite(Number(r.value))?Number(r.value):0}
        min={r.min} max={r.max} step={r.step??1}
        onChange={e=>onSet(r.k,Number(e.target.value))}/>
    </label>
  );
}

function Section({sec,onSet}:{sec:EdSection;onSet:(k:string,v:number|boolean|string)=>void}){
  return (
    <div className="edSec">
      <div className="edSecT">{sec.title}</div>
      {sec.rows.map(r=><Row key={r.k+r.label} r={r} onSet={onSet}/>)}
    </div>
  );
}

/* ---------- тулбар: пауза/шаг/темп/спавн ---------- */
function Toolbar(){
  const st=useEd();
  const [spawnK,setSpawnK]=useState('bruiser');
  return (
    <div className="edHead">
      <b className="edTitle">🛠 Кузница Дозора</b>
      <button className={'edTb'+(st.paused?' on':'')} title={st.paused?'Продолжить (PLAY)':'Пауза симуляции'}
        onClick={()=>st.act.setPaused(!st.paused)}>{st.paused?'▶ Play':'⏸ Пауза'}</button>
      <button className="edTb" title="Один кадр симуляции (на паузе)" onClick={()=>st.act.step()}>⏭ Шаг</button>
      <label className="edTime" title="Темп времени (timeScale как в Unity)">
        ×{st.timeScale.toFixed(1)}
        <input type="range" min={0.1} max={3} step={0.1} value={st.timeScale}
          onChange={e=>st.act.setTime(Number(e.target.value))}/>
      </label>
      <label className="edPick" title="Клик по канвасу выбирает юнита вместо действий игры">
        <input type="checkbox" checked={st.pickMode} onChange={e=>st.act.setPick(e.target.checked)}/>
        выбор кликом
      </label>
      <span className="edSpawn">
        <select value={spawnK} onChange={e=>setSpawnK(e.target.value)} title="Кого заспавнить (у камеры)">
          {(st.spawnList.length?st.spawnList:[{k:'bruiser',label:'…'}]).map(s=>
            <option key={s.k} value={s.k}>{s.label}</option>)}
        </select>
        <button className="edTb" onClick={()=>st.act.spawn(spawnK)}>+ спавн</button>
      </span>
      <button className="edTb edX" title="Закрыть (`/ё)" onClick={()=>st.act.setOpen(false)}>✕</button>
    </div>
  );
}

/* ---------- Hierarchy (дерево сцены) ---------- */
function Tree(){
  const st=useEd();
  const [q,setQ]=useState('');
  const rows=st.tree.filter(r=>!q||r.label.toLowerCase().includes(q.toLowerCase())||r.sub.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="edTree">
      <div className="edTreeH">
        <span>Иерархия · {st.tree.length}</span>
        <input type="text" placeholder="поиск…" value={q} onChange={e=>setQ(e.target.value)}/>
      </div>
      <div className="edTreeList">
        {rows.map(r=>(
          <div key={r.id} className={'edTreeRow'+(st.selId===r.id?' on':'')+(r.alive?'':' dead')}
            onClick={()=>st.act.select(r.id)}>
            <span className="edIco">{r.barrel?'🛢':(r.side==='hero'?'🛡':'⚔')}{r.boss?'★':''}</span>
            <span className="edLbl">{r.label}</span>
            <span className="edSub">{r.sub}</span>
          </div>
        ))}
        {!rows.length&&<div className="edEmpty">Пусто</div>}
      </div>
    </div>
  );
}

/* ---------- инспектор выбранного юнита ---------- */
function UnitInspector(){
  const st=useEd();
  if(!st.insp)return <div className="edEmpty edInspEmpty">Выберите юнита в иерархии слева (или включите «выбор кликом» и щёлкните по фигурке).</div>;
  return (
    <div className="edInsp">
      {st.insp.map(sec=><Section key={sec.title} sec={sec} onSet={st.act.setField}/>)}
      <div className="edSec">
        <div className="edSecT">Статусы</div>
        <div className="edBtns">
          <button onClick={()=>st.act.status('poison',3)}>+ яд</button>
          <button onClick={()=>st.act.status('burn',2)}>+ огонь</button>
          <button onClick={()=>st.act.status('fear',2)}>+ страх</button>
          <button onClick={()=>st.act.status('dodge',2)}>+ уклонение</button>
          <button onClick={()=>st.act.status('faith',2)}>+ вера</button>
          <button onClick={()=>st.act.statusClear()}>✕ очистить</button>
        </div>
      </div>
      <div className="edSec">
        <div className="edSecT">Действия</div>
        <div className="edBtns">
          <button className="edGood" onClick={()=>st.act.heal()}>Лечить</button>
          <button className="edBad" onClick={()=>st.act.kill()}>Добить</button>
          <button onClick={()=>st.act.focus()}>Камера</button>
          <button className="edBad" onClick={()=>st.act.del()}>Убрать со сцены</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- вкладка «Мир» ---------- */
function WorldInspector(){
  const st=useEd();
  if(!st.globals.length)return null;
  return (
    <div className="edInsp">
      {st.globals.map(sec=><Section key={sec.title} sec={sec} onSet={st.act.setField}/>)}
      <div className="edHint">
        Карта переключается как в игре (с фейдом); графика и сезон применяются на живую.
      </div>
    </div>
  );
}

/* ---------- консоль редактора ---------- */
function Console(){
  const st=useEd();
  return (
    <div className="edCon">
      <div className="edConH">
        <span>Консоль кузницы</span>
        <button onClick={()=>st.act.clearLog()}>очистить</button>
      </div>
      {st.log.map(l=><div key={l.id} className="edConRow">› {l.msg}</div>)}
      {!st.log.length&&<div className="edEmpty">Пока тихо…</div>}
    </div>
  );
}

export default function EditorPanel(){
  const open=useEd(s=>s.open);
  const tab=useEd(s=>s.tab);
  const setTab=useEd(s=>s.act.setTab);
  if(!open)return null;
  return (
    <div className="edWrap">
      <div className="edPanel">
        <Toolbar/>
        <div className="edTabs">
          <button className={tab==='unit'?'on':''} onClick={()=>setTab('unit')}>Юнит</button>
          <button className={tab==='world'?'on':''} onClick={()=>setTab('world')}>Мир</button>
        </div>
        <div className="edCols">
          <Tree/>
          {tab==='unit'?<UnitInspector/>:<WorldInspector/>}
        </div>
        <Console/>
      </div>
    </div>
  );
}
