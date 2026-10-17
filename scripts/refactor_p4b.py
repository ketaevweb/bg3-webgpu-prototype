#!/usr/bin/env python3
# Фаза 4b: вынос ui/overlays, ui/markers, ui/party из engine.ts
P='/home/z/my-project/src/game/engine.ts'
lines=open(P,encoding='utf-8').read().split('\n')
assert len(lines)==2738, f'unexpected {len(lines)}'
def e(l,p): assert lines[l-1].startswith(p), f'line {l}: {lines[l-1][:70]!r}'
e(727,'function log(msg,cls){')
e(726,'/* ================= ИНТЕРФЕЙС: ЛОГ / ТЕКСТ / ПОДСКАЗКИ ================= */')
e(784,'/* ================= МАРКЕРЫ / ТОЧКИ ПУТИ ================= */')
e(821,'}')
e(2168,'function refreshParty(){')
e(2249,'}')
e(2250,"$(UI.sheet).addEventListener")

# снизу вверх: party (2168..2249), затем overlays+markers (724..822)
del lines[2167:2249]
del lines[725:821]
out='\n'.join(lines)

OLD="""import { S, G, busyOn, busyOff, units, barrels, fires, pick, solid, grass, GW, gobCount, interactables, CAGE, CRATE, MERCHANT, KAYA_SPOT, MAP_NAME, CRYPT } from './state';"""
NEW=OLD+"""
import { log, projectPos, ftextAbove, setHint, bigBanner, initOverlays, refreshIcons, updateOverlays } from './ui/overlays';
import { initMarkers, addMarker, clearMarkers, addDot, clearDots, showReach } from './ui/markers';
import { refreshParty, refreshBossBar, refreshInit, showSheet } from './ui/party';"""
assert OLD in out
out=out.replace(OLD,NEW)

# убрать теперь пустой хвост-комментарий «A* и достижимость» дубликат? — оставляем (комментарий о grid.ts)
open(P,'w',encoding='utf-8').write(out)
print('OK', len(out.split('\n')))
