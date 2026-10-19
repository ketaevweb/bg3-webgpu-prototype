#!/usr/bin/env python3
"""Инвентаризация unitypackage: читает asset.meta/pathname в каждом хэш-каталоге."""
import os, sys, json

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
items = []
for d in sorted(os.listdir(ROOT)):
    p = os.path.join(ROOT, d)
    if not os.path.isdir(p):
        continue
    pathfile = os.path.join(p, 'pathname')
    if not os.path.isfile(pathfile):
        continue
    with open(pathfile, 'r', errors='ignore') as f:
        rel = f.read().strip()
    # размер основного файла (asset)
    size = 0
    asset = os.path.join(p, 'asset')
    if os.path.isfile(asset):
        size = os.path.getsize(asset)
    items.append((rel, size, d))

for rel, size, d in items:
    ext = os.path.splitext(rel)[1].lower()
    if ext in ('.fbx', '.glb', '.gltf', '.png', '.jpg', '.jpeg', '.tif', '.tga', '.wav', '.mp3', '.ogg'):
        print(f"{ext:6s} {size:>10d}  {rel}   [{d}]")

print("\n--- ВСЕГО ---")
from collections import Counter
c = Counter(os.path.splitext(rel)[1].lower() for rel, _, _ in items)
for ext, n in sorted(c.items()):
    print(f"{ext or '(нет расширения)':24s} {n}")
