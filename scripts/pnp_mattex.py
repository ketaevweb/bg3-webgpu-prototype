#!/usr/bin/env python3
"""Build material-name -> texture-path map from POLYGON Nature .mat files."""
import os, re, collections

UPKG = '/home/z/my-project/upload/extract/pnp/upkg'

# guid -> texture path
guid2path = {}
for d in os.listdir(UPKG):
    pd = os.path.join(UPKG, d)
    pn = os.path.join(pd, 'pathname')
    if os.path.exists(pn):
        p = open(pn, encoding='utf-8', errors='replace').read().splitlines()[0].strip()
        guid2path[d] = p

rows = []
for d in sorted(os.listdir(UPKG)):
    pd = os.path.join(UPKG, d)
    matf = os.path.join(pd, 'asset')
    pn = os.path.join(pd, 'pathname')
    if not os.path.exists(matf) or not os.path.exists(pn):
        continue
    name = open(pn, encoding='utf-8', errors='replace').read().splitlines()[0].strip()
    if not name.endswith('.mat'):
        continue
    txt = open(matf, encoding='utf-8', errors='replace').read()
    # find _MainTex entry: "- _MainTex:\n        m_Texture: {fileID: 2800000, guid: XXX...}"
    tex = ''
    m = re.search(r'-\s*_MainTex:\s*\n\s*m_Texture:\s*\{[^}]*guid:\s*([0-9a-f]{32})', txt)
    if m:
        tex = guid2path.get(m.group(1), 'GUID?' + m.group(1))
    color = ''
    c = re.search(r'_Color:\s*\{r:\s*([\d.eE+-]+),\s*g:\s*([\d.eE+-]+),\s*b:\s*([\d.eE+-]+)', txt)
    if c:
        color = 'rgb(%s,%s,%s)' % (c.group(1), c.group(2), c.group(3))
    rows.append((os.path.basename(name), tex.split('/')[-1] if tex else '-', color))

print('%-42s %-40s %s' % ('MATERIAL', 'TEXTURE', 'COLOR'))
for n, t, c in sorted(rows):
    print('%-42s %-40s %s' % (n, t, c))
