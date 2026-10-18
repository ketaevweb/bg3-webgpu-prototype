'use client';
/* ================= HUD MENUS (Фаза 6 рефакторинга) =================
   Панель настроек графики (G), меню сохранений (K, сэкспорт/импорт JSON),
   экран победы/поражения, лист персонажа. Данные/колбэки собирают
   движковые модули (save/settings.ts, save/slots.ts, systems/progression.ts,
   ui/party.ts). Классы/id 1:1 с прежним DOM — game.css не изменён. */
import { useUi, uiSet } from '@/game/ui/store';

/* ---- настройки графики: пресеты + строки-сегменты ---- */
export function GfxPanel(){
  const open=useUi(s=>s.gfxOpen);
  const presets=useUi(s=>s.gfxPresets);
  const rows=useUi(s=>s.gfxRows);
  const onClose=useUi(s=>s.gfxOnClose);
  if(!open)return null;
  return (
    <div id="gfx" className="panel" style={{display:'block'}}>
      <h3>Настройки графики</h3>
      <div id="gfxBody">
        <div style={{fontSize:'11px',color:'#a89f86',margin:'2px 0 3px'}}>Пресет качества:</div>
        <div className="gpre">
          {presets.map((p,i)=><button key={i} onClick={p.pick}>{p.name}</button>)}
        </div>
        {rows.map((r,i)=>(
          <div key={i} className="grow">
            <span className="gl">{r.label}</span>
            <div className="seg">
              {r.segs.map((sg,j)=>
                <button key={j} className={sg.active?'on':undefined} onClick={sg.pick}>{sg.name}</button>)}
            </div>
          </div>
        ))}
      </div>
      <button style={{marginTop:'6px'}} onClick={onClose}>Закрыть (G)</button>
    </div>
  );
}

/* ---- меню сохранений: 3 слота + скрытый input импорта JSON ---- */
export function SavesPanel(){
  const open=useUi(s=>s.savesOpen);
  const cur=useUi(s=>s.savesCur);
  const slots=useUi(s=>s.savesSlots);
  const onImportFile=useUi(s=>s.onImportFile);
  const onClose=useUi(s=>s.savesOnClose);
  if(!open)return null;
  return (
    <div id="saves" className="panel" style={{display:'block'}}>
      <h3>Скрижали судьбы · сохранения</h3>
      <div id="curSave">{cur}</div>
      <div id="saveList">
        {slots.map(sl=>(
          <div key={sl.i} className="slot">
            <div className="smeta">Слот {sl.i}{sl.has?'':' — пуст'}</div>
            <div className="ssub">{sl.sub}</div>
            {sl.cloudHas&&<div className="scloud">☁ в облаке: {sl.cloudWhen}</div>}
            {sl.serverHas&&<div className="scloud">⇅ на сервере: {sl.serverWhen}</div>}
            <div className="sbtns">
              <button onClick={sl.onSave}>Сохранить</button>
              <button disabled={!sl.has} onClick={sl.onLoad}>Загрузить</button>
              <button disabled={!sl.has} onClick={sl.onExport}>Экспорт JSON</button>
              <button onClick={sl.onImport}>Импорт JSON</button>
              <button disabled={!sl.has} title="Дублировать в облачную скрижаль (IndexedDB)" onClick={sl.onCloudPush}>В облако</button>
              <button disabled={!sl.cloudHas} title="Восстановить слот из облачной скрижали" onClick={sl.onCloudPull}>Из облака</button>
              <button disabled={!sl.has} title="Дублировать в серверную скрижаль (переживёт смену машины)" onClick={sl.onServerPush}>На сервер</button>
              <button disabled={!sl.serverHas} title="Восстановить слот из серверной скрижали" onClick={sl.onServerPull}>С сервера</button>
              <button disabled={!sl.has} className="danger" onClick={sl.onDelete}>Удалить</button>
            </div>
          </div>
        ))}
      </div>
      <input id="importFile" type="file" accept=".json,application/json" style={{display:'none'}}
        ref={el=>uiSet({importInput:el})}
        onChange={e=>onImportFile(e)}/>
      <button style={{marginTop:'6px'}} onClick={onClose}>Закрыть (K)</button>
    </div>
  );
}

/* ---- v1.6: панель снаряжения — сумка отряда + слоты героев ---- */
export function BagPanel(){
  const open=useUi(s=>s.bagOpen);
  const items=useUi(s=>s.bagItems);
  const party=useUi(s=>s.bagParty);
  const onClose=useUi(s=>s.bagOnClose);
  if(!open)return null;
  return (
    <div id="bag" className="panel" style={{display:'block'}}>
      <h3>Снаряжение отряда</h3>
      <div id="bagBody">
        {party.map((p,i)=>(
          <div key={'h'+i} className="baghero">
            <div className="bhn">{p.name} <span className="bhc">· {p.clsName}</span></div>
            <div className="bhslots">
              {p.slots.map((sl,j)=>(
                <span key={j} className="bhslot">
                  <i>{sl.label}:</i> {sl.item??'—'}
                  {sl.item&&<button title="Снять в сумку" onClick={sl.remove}>×</button>}
                </span>
              ))}
            </div>
          </div>
        ))}
        <div className="bagsep">Сумка отряда {items.length?`(${items.length})`:'— пуста'}</div>
        {items.length===0&&<div className="bagempty">Снаряжение падает сюда: сундук на перевале, лавка Дамрока и награды за задания.</div>}
        {items.map((it,i)=>(
          <div key={'i'+i} className="bagitem">
            <div className="bin"><b>{it.n}</b><span className="bsl">{it.slot}</span></div>
            <div className="bid">{it.d}</div>
            <button onClick={it.equip}>Надеть…</button>
          </div>
        ))}
      </div>
      <button style={{marginTop:'6px'}} onClick={onClose}>Закрыть (I)</button>
    </div>
  );
}

/* ---- v2.4: панель «Летопись Глубин» (T / 🏆) — сезон, рекорд, журнал, серверный топ ---- */
export function RecordsPanel(){
  const open=useUi(s=>s.recordsOpen);
  const rec=useUi(s=>s.records);
  const onClose=useUi(s=>s.recordsOnClose);
  if(!open||!rec)return null;
  return (
    <div id="records" className="panel" style={{display:'block'}}>
      <h3>Летопись Глубин</h3>
      {rec.season
        ?<div className="rseason"><div className="rsn">Сезон глубины: «{rec.season.name}»</div><div className="rsd">{rec.season.desc} · смена — на следующей неделе</div></div>
        :<div className="rseason"><div className="rsd">Портал вне сезонного круга.</div></div>}
      <div className="rhead">Лучший заход</div>
      <div className="rrow"><span>Волна {rec.best}</span><span>рекорд отряда</span></div>
      <div className="rhead">Журнал заходов (последние 8)</div>
      {rec.journal.length
        ?rec.journal.map((j,i)=><div key={'j'+i} className="rrow"><span>Волна {j.w}</span><span>{j.when}</span></div>)
        :<div className="rsd">Журнал пуст — заходы пишутся при завершении испытания или срыве.</div>}
      <div className="rhead">Летопись Глубин · сервер, топ-10</div>
      {rec.server===null
        ?<div className="rsd">…читаю летопись сервера…</div>
        :(rec.server.length
          ?rec.server.map((r,i)=><div key={'s'+i} className="rrow"><span>{(i+1)+'. '+r.n}</span><span>волна {r.best}</span></div>)
          :<div className="rsd">Сервер молчит — или рекордов ещё нет.</div>)}
      <button style={{marginTop:'6px'}} onClick={onClose}>Закрыть (T)</button>
    </div>
  );
}

/* ---- экран победы/поражения ---- */
export function EndScreen(){
  const end=useUi(s=>s.end);
  const endHidden=useUi(s=>s.endHidden);
  const sys=useUi(s=>s.sys);
  if(!end||endHidden)return null;
  return (
    <div id="end" style={{display:'flex'}}>
      <h1 style={{color:end.color}}>{end.title}</h1>
      <p>{end.stats}</p>
      {end.canContinue &&
        <button onClick={()=>uiSet({endHidden:true})}>Продолжить исследование</button>}
      <button onClick={sys.onLoadFromEnd}>Загрузить игру</button>
      <button onClick={()=>location.reload()}>Играть снова</button>
    </div>
  );
}

/* ---- лист персонажа (клик по карточке; Esc/клик по фону — закрыть) ---- */
export function SheetModal(){
  const sheet=useUi(s=>s.sheet);
  if(!sheet)return null;
  return (
    <div id="sheet" style={{display:'flex'}}
      onClick={e=>{if(e.target===e.currentTarget)uiSet({sheet:null});}}>
      <div id="sheetbox">
        <h2>{sheet.name}</h2>
        <div className="sub">{sheet.sub}</div>
        <div className="srow">
          {sheet.row.map((r,i)=><div key={i}><span>{r.k}</span><b>{r.v}</b></div>)}
        </div>
        <div className="abgrid">
          {sheet.ab.map((a,i)=>
            <div key={i} className="ab"><span>{a.l}</span><b>{a.v}</b><i>{a.m}</i></div>)}
        </div>
        <h3>Снаряжение</h3>
        <p>Оружие: <b>{sheet.weapon.name}</b> — {sheet.weapon.dice}{sheet.weapon.mod}, {sheet.weapon.mode}</p>
        <p>Доспех: <b>{sheet.armor.name}</b> (КД {sheet.armor.ac})</p>
        <p>{sheet.potions}</p>
        {sheet.spells&&<>
          {sheet.spells.cells&&<p>Ячейки заклинаний: <b>{sheet.spells.cells}</b></p>}
          {sheet.spells.lines.map((l,i)=><p key={i}>{l}</p>)}
        </>}
        <h3>Умения</h3>
        {sheet.features.map((f,i)=><p key={i}>• {f}</p>)}
        <div className="pbar" style={{marginTop:'10px'}}>
          <i style={{width:sheet.xpPct+'%'}}/>
        </div>
        <p style={{marginTop:'3px'}}>{sheet.xpText}</p>
      </div>
    </div>
  );
}
