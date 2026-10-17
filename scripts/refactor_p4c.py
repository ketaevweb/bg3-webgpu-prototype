#!/usr/bin/env python3
# Фаза 4c: вынос entities/figure, entities/units, entities/roster из engine.ts
P='/home/z/my-project/src/game/engine.ts'
lines=open(P,encoding='utf-8').read().split('\n')
assert len(lines)==2563, f'unexpected {len(lines)}'
def e(l,p): assert lines[l-1].startswith(p), f'line {l}: {lines[l-1][:70]!r}'
e(66,'function enemiesOf(u)')
e(67,'function meleeWeaponOf(e)')
e(68,'')
e(184,'/* ================= ЮНИТЫ ================= */')
e(185,'function buildFigure(cfg){')
e(235,'}')
e(236,'const GOB:Record<string,UnitTemplate>={')
e(386,'}')
e(387,'/* HERO_TINT')
e(431,'function spawnEnemies(){')
e(450,'}')
e(659,'/* v0.8: размещение отряда в точках входа */')
e(660,'function placeHeroes(list){')
e(668,'}')
e(1617,'function aliveHeroes(){')
e(1872,'function removeUnit(u){')
e(1878,'}')

# снизу вверх: removeUnit(1872-1878), aliveHeroes(1617), placeHeroes(659-667),
# spawnEnemies(431-452), roster(236-386), юниты(184-235), helpers(66-67)
del lines[1871:1878]
del lines[1616:1617]
del lines[658:668]
del lines[430:450]
del lines[235:386]
del lines[183:235]
del lines[65:67]
out='\n'.join(lines)

OLD="import { tween, faceTo, lunge, boomFX, shake, tickTweens, projMesh } from './fx/tweens';"
NEW=OLD+"""
import { buildFigure } from './entities/figure';
import { enemiesOf, meleeWeaponOf, aliveHeroes, placeHeroes, removeUnit } from './entities/units';
import { buildHeroes, spawnEnemies } from './entities/roster';"""
assert OLD in out
out=out.replace(OLD,NEW)
# UnitTemplate больше не используется в engine
out=out.replace("import type { Barrel, Quest, SaveData, StatusType, Unit, UnitTemplate, Weapon } from './types';",
                "import type { Barrel, Quest, SaveData, StatusType, Unit, Weapon } from './types';")
open(P,'w',encoding='utf-8').write(out)
print('OK', len(out.split('\n')))
