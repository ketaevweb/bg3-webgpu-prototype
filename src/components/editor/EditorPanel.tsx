'use client';
/* ================= EDITOR PANEL (v3.4 «Мастерская») =================
   React-панель редактора «как в Unity»: тулбар (⏸/⏭/темп/гизмо W·E·R/
   кисть/спавн), слева Hierarchy (дерево сцены: клик — выбор, двойной —
   фокус камеры, drag — перенос юнита на землю), справа Inspector
   (живые секции полей + ИИ + анимации рига + действия), вкладки «Мир»
   (глобалы), «Декор» (каталог природы с persist) и «Диалоги» (правка
   текстов узлов), консоль действий снизу. Компонент только ЧИТАЕТ
   zustand-стор ui/editorStore.ts — вся логика в editor/bridge.ts+forge.ts. */
import { useState } from 'react';
import { useEd } from '@/game/ui/editorStore';
import { Row, Section } from './fields';
import { DecorTab, DlgTab } from './EditorTabs';

/* ---------- тулбар: пауза/шаг/темп/гизмо/спавн ---------- */
const GIZMOS:['move'|'rotate'|'scale'|'none',string,string][]=[
  ['move','⬆','Гизмо: переместить (W)'],
  ['rotate','⟳','Гизмо: повернуть (E)'],
  ['scale','⤢','Гизмо: масштаб (R)'],
  ['none','✕','Без гизмо (Q)'],
];
function Toolbar(){
  const st=useEd();
  const [spawnK,setSpawnK]=useState('bruiser');
  const brushUnit=st.brush===spawnK;
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
      <span className="edGiz" title="Гизмо выбранного юнита: W — переместить, E — повернуть, R — масштаб, Q — скрыть">
        {GIZMOS.map(([m,ico,tip])=>(
          <button key={m} className={'edTb'+(st.gizmoMode===m?' on':'')} title={tip}
            onClick={()=>st.act.setGizmo(m)}>{ico}</button>
        ))}
        <label className="edSnap" title="Шаг сетки: поворот 15°, клетка на отпускании">
          <input type="checkbox" checked={st.snap} onChange={e=>st.act.setSnap(e.target.checked)}/>шаг
        </label>
      </span>
      <label className="edPick" title="Клик по канвасу выбирает юнита вместо действий игры">
        <input type="checkbox" checked={st.pickMode} onChange={e=>st.act.setPick(e.target.checked)}/>
        выбор кликом
      </label>
      <span className="edSpawn" draggable
        onDragStart={e=>{e.dataTransfer.setData('text/bg3ed','spawn:'+spawnK);e.dataTransfer.effectAllowed='copy';}}
        title="Перетащите на землю — юнит появится там; 🖌 — кисть: клик по земле ставит юнита">
        <select value={spawnK} onChange={e=>setSpawnK(e.target.value)} title="Кого заспавнить">
          {(st.spawnList.length?st.spawnList:[{k:'bruiser',label:'…'}]).map(s=>
            <option key={s.k} value={s.k}>{s.label}</option>)}
        </select>
        <button className="edTb" onClick={()=>st.act.spawn(spawnK)}>+ спавн</button>
        <button className={'edTb'+(brushUnit?' on':'')} title="Кисть: клик по земле ставит выбранного юнита"
          onClick={()=>st.act.setBrush(brushUnit?null:spawnK)}>🖌</button>
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
            onClick={()=>st.act.select(r.id)}
            onDoubleClick={()=>st.act.dbl(r.id)}
            draggable
            onDragStart={e=>{e.dataTransfer.setData('text/bg3ed','move:'+r.id);e.dataTransfer.effectAllowed='move';}}
            title="Клик — выбрать · двойной клик — навести камеру · перетащить на землю — перенести юнита">
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
  if(!st.insp)return <div className="edEmpty edInspEmpty">Выберите юнита в иерархии слева (или включите «выбор кликом» и щёлкните по фигурке). Гизмо — W/E/R, двойной клик — камера.</div>;
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
      {!!st.animClips.length&&(
        <div className="edSec">
          <div className="edSecT">Анимации рига{st.animCur?(' · '+st.animCur):''}</div>
          <div className="edBtns">
            {st.animClips.map(c=><button key={c} className={st.animCur===c?'on':''}
              onClick={()=>st.act.animPlay(c)}>{c}</button>)}
          </div>
          <label className="edRow" title="Скорость анимаций этого юнита (mixer.timeScale)">
            <span>Скорость ×{st.animSpeed.toFixed(1)}</span>
            <input type="range" min={0.1} max={3} step={0.1} value={st.animSpeed}
              onChange={e=>st.act.animSpeed(Number(e.target.value))}/>
          </label>
          <div className="edBtns">
            <button onClick={()=>st.act.rigReload()} title="Пересоздать Synty-риг юнита (лечение сломанных фигур)">⟳ Перезагрузить риг</button>
          </div>
        </div>
      )}
      <div className="edSec">
        <div className="edSecT">Действия</div>
        <div className="edBtns">
          <button className="edGood" onClick={()=>st.act.heal()}>Лечить</button>
          <button className="edBad" onClick={()=>st.act.kill()}>Добить</button>
          <button onClick={()=>st.act.dup()} title="Создать копию юнита рядом (Ctrl+D)">Дублировать</button>
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
        Деревья/кусты/декор — на вкладке «Декор».
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
          <button className={tab==='decor'?'on':''} onClick={()=>setTab('decor')}>Декор</button>
          <button className={tab==='dlg'?'on':''} onClick={()=>setTab('dlg')}>Диалоги</button>
          <button className={tab==='world'?'on':''} onClick={()=>setTab('world')}>Мир</button>
        </div>
        <div className="edCols">
          <Tree/>
          {tab==='unit'?<UnitInspector/>
            :tab==='decor'?<DecorTab/>
            :tab==='dlg'?<DlgTab/>
            :<WorldInspector/>}
        </div>
        <Console/>
      </div>
    </div>
  );
}
