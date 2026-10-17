// HUD markup (injected by GameClient before engine boot)
// v0.8: + #bossbar, #fade
// v1.1: + #gfxBtn/#saveBtn, панели #gfx и #saves (3 слота + JSON export/import),
//         кнопка «Загрузить игру» на экране конца (#loadBtn2)
export const HUD_HTML = `<div id="scene"></div>
<div id="ov"></div>
<div id="topbar" class="panel">
  <div id="round">Подготовка…</div>
  <div id="turnb"></div>
  <div id="initRow"></div>
</div>
<div id="bossbar"><div id="bossname"></div><div class="bbar"><i id="bossfill"></i></div></div>
<button id="sndBtn" title="Звук вкл/выкл">🔊</button>
<button id="gfxBtn" title="Настройки графики (G)">⚙</button>
<button id="saveBtn" title="Сохранения (K)">💾</button>
<div id="log" class="panel"><h3>Журнал боя</h3><div id="logbody"></div></div>
<div id="party"></div>
<div id="hint"></div>
<div id="actionbar" class="panel"><div id="pips"></div><div id="btns"></div></div>
<div id="banner"></div>
<div id="tip"></div>
<div id="end"><h1 id="endtitle"></h1><p id="endstats"></p><button id="contBtn" style="display:none">Продолжить исследование</button><button id="loadBtn2">Загрузить игру</button><button onclick="location.reload()">Играть снова</button></div>
<div id="sheet"><div id="sheetbox"></div></div>
<div id="qtrack" class="panel"><h3>Задания · <span id="goldTxt">Золото: 0</span></h3><div id="qbody"></div></div>
<div id="dlgBox" class="panel"><div id="dlgName"></div><div id="dlgText"></div><div id="dlgOpts"></div></div>
<div id="shop" class="panel"><h3>Товары Дамрока</h3><div id="shopList"></div><button id="shopClose" style="margin-top:6px">Закрыть</button></div>
<div id="journal" class="panel"><h3>Журнал заданий</h3><div id="jbody"></div><button id="jClose" style="margin-top:6px">Закрыть (J)</button></div>
<div id="choice" class="panel"><h3 id="choiceTitle">Выбрать героя</h3><div id="choiceList"></div><button id="choiceCancel">Отмена</button></div>
<div id="gfx" class="panel"><h3>Настройки графики</h3><div id="gfxBody"></div><button id="gfxClose" style="margin-top:6px">Закрыть (G)</button></div>
<div id="saves" class="panel"><h3>Скрижали судьбы · сохранения</h3><div id="curSave"></div><div id="saveList"></div><input id="importFile" type="file" accept=".json,application/json" style="display:none"><button id="savesClose" style="margin-top:6px">Закрыть (K)</button></div>
<div id="fade"></div>
<div id="slowfx"></div>`;
