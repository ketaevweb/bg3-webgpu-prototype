#!/usr/bin/env python3
"""Парсинг Synty preset-prefab: имена GameObject с m_IsActive: 1."""
import sys, re, os, glob

def active_parts(prefab_path):
    txt = open(prefab_path, errors='ignore').read()
    # блоки GameObject: m_Name + m_IsActive
    parts = []
    for m in re.finditer(r'm_Name: (Chr_\S+)\n.*?m_IsActive: (\d)', txt, re.S):
        name, act = m.group(1), m.group(2)
        if act == '1':
            parts.append(name)
    return parts

if __name__ == '__main__':
    root = '/tmp/mfh'
    out = {}
    for n in sys.argv[1:] if len(sys.argv) > 1 else [str(i) for i in range(1, 121)]:
        hits = glob.glob(f'{root}/*/*/pathname')
        pass
    # проще: один индекс pathname → файл
    idx = {}
    for pf in glob.glob(f'{root}/*/*/pathname'):
        rel = open(pf, errors='ignore').read().strip().lstrip('00')
        idx[os.path.basename(rel)] = os.path.join(os.path.dirname(pf), 'asset')
    wanted = sys.argv[1:] or []
    for w in wanted:
        f = idx.get(w)
        if not f:
            print(f'!! {w}: prefab не найден'); continue
        parts = active_parts(f)
        print(f'== {w} ({len(parts)} активных частей) ==')
        print('  ' + ', '.join(parts))
