'use client';
/* ================= HUD DIALOGS (Фаза 6 рефакторинга) =================
   Диалоговое окно, лавка Дамрока, журнал заданий, выбор героя.
   Данные и колбэки (в т.ч. socialCheck-ветвления опций) собирает
   движок (interact/dialog.ts, interact/shop.ts, interact/quests.ts);
   компоненты только рендерят стор. Классы/id 1:1 с прежним DOM. */
import { useUi } from '@/game/ui/store';

/* ---- диалоговый бокс (DLGS: имя, текст, опции) ---- */
export function DialogBox(){
  const dlg=useUi(s=>s.dlg);
  if(!dlg)return null;
  return (
    <div id="dlgBox" className="panel" style={{display:'block'}}>
      <div id="dlgName">{dlg.name}</div>
      <div id="dlgText">{dlg.text}</div>
      <div id="dlgOpts">
        {dlg.opts.map((o,i)=>(
          <button key={i} className={o.req?'req':undefined} onClick={o.onClick}>{o.t}</button>
        ))}
      </div>
    </div>
  );
}

/* ---- лавка Дамрока ---- */
export function ShopPanel(){
  const open=useUi(s=>s.shopOpen);
  const rows=useUi(s=>s.shopRows);
  const onClose=useUi(s=>s.shopOnClose);
  if(!open)return null;
  return (
    <div id="shop" className="panel" style={{display:'block'}}>
      <h3>Товары Дамрока</h3>
      <div id="shopList">
        {rows.map((it,i)=>(
          <div key={i} className="sitem">
            <div>
              <div className="sn">{it.n}</div>
              <div className="sd">{it.d}</div>
            </div>
            <div className="sp">{it.price} зол.</div>
            <button disabled={!it.canBuy} onClick={it.buy}>Купить</button>
          </div>
        ))}
      </div>
      <button style={{marginTop:'6px'}} onClick={onClose}>Закрыть</button>
    </div>
  );
}

/* ---- журнал заданий (J) ---- */
export function JournalPanel(){
  const open=useUi(s=>s.journalOpen);
  const items=useUi(s=>s.journalItems);
  const onClose=useUi(s=>s.journalOnClose);
  if(!open)return null;
  return (
    <div id="journal" className="panel" style={{display:'block'}}>
      <h3>Журнал заданий</h3>
      <div id="jbody">
        {items.map((q,i)=>(
          <div key={i} className="jq">
            <div className="jn">
              {q.name}
              <span className={'jst'+(q.done?' done':'')}>{q.done?'выполнено':'активно'}</span>
            </div>
            <div className="jd">{q.desc}</div>
            {q.objs.map((o,j)=>
              <div key={j} className={'jo'+(o.done?' done':'')}>{o.done?'✓':'○'} {o.t}</div>)}
            <div className="jr">Награда: {q.reward}</div>
          </div>
        ))}
      </div>
      <button style={{marginTop:'6px'}} onClick={onClose}>Закрыть (J)</button>
    </div>
  );
}

/* ---- выбор героя («Кому: …?») ---- */
export function ChoicePanel(){
  const choice=useUi(s=>s.choice);
  const onClose=useUi(s=>s.choiceOnClose);
  if(!choice)return null;
  return (
    <div id="choice" className="panel" style={{display:'block'}}>
      <h3 id="choiceTitle">{choice.title}</h3>
      <div id="choiceList">
        {choice.options.map((o,i)=>
          <button key={i} onClick={o.onClick}>{o.label}</button>)}
      </div>
      <button onClick={onClose}>Отмена</button>
    </div>
  );
}
