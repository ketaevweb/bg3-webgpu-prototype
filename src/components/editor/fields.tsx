'use client';
/* ================= EDITOR FIELDS (v3.4 «Мастерская») =================
   Общие контролы полей инспектора (число/текст/флаг/список) — читают
   view-модель EdField из стора. Используются EditorPanel и EditorTabs. */
import type { EdField, EdSection } from '@/game/ui/editorStore';

export function Row({r,onSet}:{r:EdField;onSet:(k:string,v:number|boolean|string)=>void}){
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

export function Section({sec,onSet}:{sec:EdSection;onSet:(k:string,v:number|boolean|string)=>void}){
  return (
    <div className="edSec">
      <div className="edSecT">{sec.title}</div>
      {sec.rows.map(r=><Row key={r.k+r.label} r={r} onSet={onSet}/>)}
    </div>
  );
}
