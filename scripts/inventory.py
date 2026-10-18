#!/usr/bin/env python3
# Инвентаризация unitypackage-папок: pathname -> тип/размер ассета
import os, sys

BASE = '/home/z/my-project/upload/extract/pkg'
OUT = '/home/z/my-project/upload/extract/INVENTORY.txt'
pkgs = ['blink32','doublel','expl_rpg','expl_fighter','expl_war1','expl_war2',
        'expl_war3','ki_basic','ki_melee','magicpot']

with open(OUT, 'w') as out:
    for pkg in pkgs:
        root = os.path.join(BASE, pkg)
        if not os.path.isdir(root):
            out.write(f'##### {pkg} MISSING\n'); continue
        out.write(f'##### {pkg}\n')
        for guid in sorted(os.listdir(root)):
            gdir = os.path.join(root, guid)
            if not os.path.isdir(gdir): continue
            ppath = os.path.join(gdir, 'pathname')
            apath = os.path.join(gdir, 'asset')
            if not os.path.isfile(ppath): continue
            try:
                pn = open(ppath, 'r', errors='replace').read().strip()
            except Exception as e:
                pn = f'<err {e}>'
            if not os.path.isfile(apath): continue
            sz = os.path.getsize(apath)
            with open(apath, 'rb') as f:
                head = f.read(24)
            low = pn.lower()
            kind = None
            if head.startswith(b'Kaydara') or head.startswith(b'; FBX') or low.endswith('.fbx'):
                kind = 'FBX'
            elif low.endswith('.anim'):
                kind = 'ANIM'
            if kind:
                out.write(f'  {kind:4} {sz:>9}  {pn}\n')
print('lines:', sum(1 for _ in open(OUT)))
