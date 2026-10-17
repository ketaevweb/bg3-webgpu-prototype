#!/usr/bin/env python3
# Фаза 4a: вынос state/render/tweens из engine.ts
import re, sys

P = '/home/z/my-project/src/game/engine.ts'
src = open(P, encoding='utf-8').read()
lines = src.split('\n')
assert len(lines) == 2865, f'unexpected line count {len(lines)}'

# (start, end, replacement) — 1-based включительно; применяются снизу вверх
def expect(ln, prefix):
    assert lines[ln-1].startswith(prefix), f'line {ln} mismatch: {lines[ln-1][:80]!r}'

expect(2, "import * as THREE from 'three/webgpu';")
expect(24, 'const S:GameState=')
expect(27, '  cryptGroup:[],chestLooted:false')
expect(34, '/* ================= СОСТОЯНИЕ ================= */')
expect(35, 'let busy=false')
expect(43, 'let groundMesh:any=null')
expect(45, '/* ================= РЕНДЕРЕР / СЦЕНА ================= */')
expect(46, 'const renderer=new THREE.WebGPURenderer')
expect(56, 'function clearGroup(g)')
expect(58, '/* ==== v0.7: эффекты')
expect(69, 'controls.target.set(1,0,12);')
expect(71, '/* ================= СЕТКА / КАРТЫ')
expect(74, 'const solid=new Set<string>()')
expect(80, 'const CRYPT={')
expect(86, '};')
expect(199, '/* v0.8: атмосфера и свет')
expect(200, 'function applyAtmosphere(m){')
expect(204, 'let hemiLight:any=null,sunLight:any=null;')
expect(205, 'function applyLighting(m){')
expect(223, '}')
expect(803, '/* ================= ТВИНЫ / ЭФФЕКТЫ ================= */')
expect(804, 'function tween(dur,fn)')
expect(834, 'function shake(t)')
expect(837, 'projMesh.visible=false;scene.add(projMesh);')
expect(2744, '  for(let i=tweens.length-1;i>=0;i--){')
expect(2750, '  }')
expect(2776, "    console.log('[bg3] init: start');")
expect(2787, '  /* v0.7.x: bloom-пасс')
expect(2797, '  }')

NEW_IMPORTS = """import * as THREE from 'three/webgpu';
import { sfx } from './audio';
import { slowmo } from './slowmo';
import { upgradeUnitRig } from './animation';

/* Фаза 2 рефакторинга: чистые листья — rng/utils/constants/world-grid/боевая математика/лут.
   Фаза 3: доменные типы — types.ts. Фаза 4a: state (S/G/контейнеры), render, fx/tweens. */
import { d, roll, ri, srand } from './rng';
import { $, clamp, mod, sleep, key, cheb } from './utils';
import { TILE, GRID, HALF, W, XP_NEED, RANGE_FB, RANGE_OIL, STATUS, HERO_TINT, SAVE_VER, SLOT_N } from './constants';
import { astar, reachNodes, nodePath, passable, unitAt, barrelAt } from './world/grid';
import { attackMod, blessed, hitChance, avgDamage } from './systems/combat';
import { LOOT } from './systems/loot';
import { UI } from './hud';
import type { Barrel, Quest, SaveData, StatusType, Unit, UnitTemplate, Weapon } from './types';
import { S, G, busyOn, busyOff, units, barrels, fires, pick, solid, grass, GW, gobCount, interactables, CAGE, CRATE, MERCHANT, KAYA_SPOT, MAP_NAME, CRYPT } from './state';
import { renderer, scene, worldGroup, camera, controls, fx, glows, rigs, initRenderer, applyAtmosphere, applyLighting, clearGroup, setupPostFX } from './render/renderer';
import { tween, faceTo, lunge, boomFX, shake, tickTweens, projMesh } from './fx/tweens';"""

MAP_COMMENT = """/* ================= СЕТКА / КАРТЫ (v0.8: лес ↔ крипта) =================
   solid/grass/GW и константы карт (CAGE/CRYPT/…) — в state.ts (Фаза 4a).
   Ниже — сиды: заполнение наборов под конкретную карту. */"""

BOOT_HEAD = """    console.log('[bg3] init: start');
    initRenderer();"""

BLOOM_NEW = """  /* v0.7.x: bloom-пасс (TSL, WebGL2-фолбэк) — сборка в render/renderer.ts */
  await setupPostFX();"""

TICK = '  tickTweens(dt);'

ops = [  # bottom-up
    (2787, 2797, BLOOM_NEW),
    (2776, 2776, BOOT_HEAD),
    (2744, 2750, TICK),
    (803, 837, None),
    (199, 223, None),
    (71, 86, MAP_COMMENT),
    (58, 69, None),
    (45, 56, None),
    (34, 43, None),
    (24, 27, None),
    (2, 23, NEW_IMPORTS),
]
for a, b, rep in ops:
    lines[a-1:b] = ([rep] if rep is not None else [])

out = '\n'.join(lines)

# G-rewrite: переприсваиваемые скаляры замыкания → поля G
NAMES = 'busyCount|busy|combatOn|phase|targeting|turnIdx|current|uid|shakeT|groundMesh|fireLight|flameMesh|hemiLight|sunLight|postFX|mapId|TREES|ROCKS|TENTS|FIREPIT|BARREL_POS|order'
out = re.sub(r'(?<![\w.$])(' + NAMES + r')\b', r'G.\1', out)

# точечные фиксы: shorthand в литерале объекта (gameSnapshot) и заголовочный комментарий
out = out.replace('G.mapId,mapName:', 'mapId:G.mapId,mapName:')
out = out.replace("""/* ================= ТОЧКА ВХОДА (v0.7: fullstack src) =================
   Весь игровой стейт живёт в замыкании bootGame(), чтобы React мог
   безопасно монтировать/размонтировать игру (HMR, StrictMode). */""",
"""/* ================= ТОЧКА ВХОДА (v0.7: fullstack src) =================
   bootGame() — оркестратор: сборка, ввод, игровой цикл, dispose.
   Состояние — в state.ts (Фаза 4a), рендер — render/renderer.ts,
   твины — fx/tweens.ts; системы выносятся по REFACTORING.md §5 (4b–4h). */""")

open(P, 'w', encoding='utf-8').write(out)
print('OK, new length:', len(out.split('\n')))
