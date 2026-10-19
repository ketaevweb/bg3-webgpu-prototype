#!/usr/bin/env python3
"""Inventory the POLYGON Nature Pack unitypackage: map guid-dirs to real paths."""
import os, collections

ROOT = '/home/z/my-project/upload/extract/pnp/upkg'
items = []
for d in os.listdir(ROOT):
    pd = os.path.join(ROOT, d)
    if not os.path.isdir(pd):
        continue
    pn = os.path.join(pd, 'pathname')
    asset = os.path.join(pd, 'asset')
    path = open(pn, 'r', encoding='utf-8', errors='replace').read().splitlines()[0].strip() if os.path.exists(pn) else '?'
    size = os.path.getsize(asset) if os.path.exists(asset) else 0
    items.append((path, size, d))

items.sort()
byext = collections.Counter()
for p, s, g in items:
    ext = os.path.splitext(p)[1].lower() or '(none)'
    byext[ext] += 1

print('== EXT COUNTS ==')
for e, c in byext.most_common():
    print(f'{e}: {c}')

print('\n== FBX / MODEL FILES ==')
for p, s, g in items:
    if p.lower().endswith('.fbx'):
        print(f'{s:>10}  {p}')

print('\n== TEXTURES ==')
for p, s, g in items:
    ext = os.path.splitext(p)[1].lower()
    if ext in ('.png', '.tga', '.jpg'):
        print(f'{s:>10}  {p}')
