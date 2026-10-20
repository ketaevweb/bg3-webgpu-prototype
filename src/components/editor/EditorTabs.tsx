'use client';
/* ================= EDITOR TABS (v3.4 «Мастерская») =================
   Вкладки «Декор» (каталог POLYGON Nature: кисть/список/инспектор пропа,
   persist правок мира) и «Диалоги» (правка текстов узлов DLGS вживую).
   Компоненты только читают zustand-стор ui/editorStore.ts и зовут act.*. */
import { useState } from 'react';
import { useEd } from '@/game/ui/editorStore';
import { Section } from './fields';

/* ---------- вкладка «Декор» (редактор мира) ---------- */
export function DecorTab(){
  const st=useEd();
  const groups=[...new Set(st.propCatalog.map(c=>c.group))];
  const [group,setGroup]=useState(groups[0]||'');
  const [propK,setPropK]=useState(st.propCatalog[0]?.name||'');
  const items=st.propCatalog.filter(c=>!group||c.group===group);
  const brushOn=st.brush==='prop:'+propK;
  return (
    <div className="edInsp">
      <div className="edSec">
        <div className="edSecT">Каталог мира (POLYGON Nature)</div>
        <label className="edRow"><span>Группа</span>
          <select value={group} onChange={e=>{setGroup(e.target.value);
            const first=st.propCatalog.find(c=>c.group===e.target.value);
            if(first)setPropK(first.name);}}>
            {groups.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="edRow"><span>Модель</span>
          <select value={propK} onChange={e=>setPropK(e.target.value)}>
            {items.map(c=><option key={c.name} value={c.name}>{c.label}</option>)}
          </select>
        </label>
        <div className="edBtns">
          <button className={brushOn?'on':''} title="Кисть: клик по земле ставит выбранную модель (и drag&drop на канвас)"
            onClick={()=>st.act.setBrush(brushOn?null:'prop:'+propK)}>
            {brushOn?'🖌 кисть ВКЛ':'🖌 кисть'}
          </button>
          <button className={st.propPick?'on':''} title="Клик по декору на карте выбирает его"
            onClick={()=>st.act.propSetPick(!st.propPick)}>🎯 выбор кликом</button>
        </div>
        <div className="edHint">Кисть/drag ставит модель в клетку под курсором. Правки
          переживают reload и смену карты (localStorage, на каждую карту свои).</div>
      </div>
      <div className="edSec">
        <div className="edSecT">Декор на карте · {st.props.length}</div>
        <div className="edPropList">
          {st.props.map(p=>(
            <div key={p.id} className={'edPropRow'+(st.propSel===p.id?' on':'')}
              onClick={()=>st.act.propSelect(p.id)}>
              <span className="edLbl">{p.label}</span>
              <span className="edSub">{p.x},{p.z}</span>
            </div>
          ))}
          {!st.props.length&&<div className="edEmpty">Пока ничего не поставлено</div>}
        </div>
      </div>
      {st.propInsp&&st.propSel!=null&&(
        <>
          {st.propInsp.map(sec=><Section key={sec.title} sec={sec} onSet={st.act.propSetField}/>)}
          <div className="edSec">
            <div className="edSecT">Действия</div>
            <div className="edBtns">
              <button onClick={()=>st.act.propFocus()}>Камера</button>
              <button className="edBad" onClick={()=>st.act.propDel()}>Удалить</button>
              <button className="edBad" onClick={()=>st.act.propClear()}>Убрать всё</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- вкладка «Диалоги» (правка текстов) ---------- */
export function DlgTab(){
  const st=useEd();
  return (
    <div className="edInsp">
      <div className="edSec">
        <div className="edSecT">Выбор диалога</div>
        <label className="edRow"><span>Говорящий</span>
          <select value={st.dlgNpc} onChange={e=>st.act.dlgPickNpc(e.target.value)}>
            {(st.dlgNpcs.length?st.dlgNpcs:[['','—']]).map(([v,lab])=>
              <option key={v} value={v}>{lab}</option>)}
          </select>
        </label>
        <label className="edRow"><span>Узел</span>
          <select value={st.dlgNode} onChange={e=>st.act.dlgPickNode(e.target.value)}>
            {st.dlgNodes.map(id=><option key={id} value={id}>{id}</option>)}
          </select>
        </label>
        <div className="edHint">Правки применяются сразу в игре (открытый узел
          переоткрывается) и сохраняются между сессиями (localStorage).</div>
      </div>
      {(st.dlgInsp||[]).map(sec=><Section key={sec.title} sec={sec}
        onSet={(k,v)=>st.act.dlgSetField(k,String(v))}/>)}
      {st.dlgNpc&&st.dlgNode&&(
        <div className="edSec">
          <div className="edSecT">Применение</div>
          <div className="edBtns">
            <button className="edGood" onClick={()=>st.act.dlgApply()}>✔ Применить</button>
            <button onClick={()=>st.act.dlgReset()}>✕ Сбросить узел</button>
          </div>
        </div>
      )}
    </div>
  );
}
