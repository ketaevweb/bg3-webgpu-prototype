#!/usr/bin/env python3
"""Copy POLYGON Nature Pack assets into public/models/nature/.
- FBX: replace all broken FBX-6.1 files (37/38) with pack v7400 files + add new models.
- PolygonNature.png: real palette from pack (FBX-referenced _MainTex).
- tex/: ground textures for tiling.
Skips *_LOD_* models. Prints summary."""
import os, shutil

UPKG = '/home/z/my-project/upload/extract/pnp/upkg'
DST = '/home/z/my-project/public/models/nature'
TEXDST = os.path.join(DST, 'tex')

# resolve name -> asset path (first match wins; prefer non-LOD)
index = {}
for d in os.listdir(UPKG):
    pd = os.path.join(UPKG, d)
    pn = os.path.join(pd, 'pathname')
    if not os.path.exists(pn):
        continue
    n = open(pn, encoding='utf-8', errors='replace').read().splitlines()[0].strip()
    base = n.split('/')[-1]
    if base not in index:
        index[base] = os.path.join(pd, 'asset')

FBX = """
SM_Plant_Grass_01 SM_Plant_Grass_02 SM_Plant_Grass_03 SM_Plant_Grass_04 SM_Plant_Grass_05
SM_Plant_Fern_01 SM_Plant_Fern_02 SM_Plant_Fern_03
SM_Plant_Undergrowth_01
SM_Plant_Bush_01 SM_Plant_Bush_02 SM_Plant_Bush_03
SM_Plant_Bush_Leaves_01 SM_Plant_Bush_Leaves_02 SM_Plant_Bush_Leaves_03
SM_Plant_Hedge_Bush_01 SM_Plant_Hedge_Bush_02
SM_Plant_Flowers_01 SM_Plant_FlowerPatch_01 SM_Plant_PurpleFlower_01
SM_Plant_Mushrooms_01 SM_Plant_Mushrooms_02 SM_Plant_Mushrooms_03 SM_Plant_Mushrooms_04 SM_Plant_Mushrooms_05 SM_Plant_Mushrooms_06
SM_Plant_Reeds_01 SM_Plant_Reeds_02
SM_Plant_Lillypad_Large_01 SM_Plant_Lillypad_Large_02 SM_Plant_Lillypad_Large_03 SM_Plant_Lillypad_Small_01
SM_Tree_Generic_01 SM_Tree_Generic_Giant_01 SM_Tree_Generic_Dead_01
SM_Tree_Round_01 SM_Tree_Round_02 SM_Tree_Round_03 SM_Tree_Round_04 SM_Tree_Round_05 SM_Tree_TallRound_01
SM_Tree_Birch_01 SM_Tree_Birch_02 SM_Tree_Birch_03 SM_Tree_Birch_04 SM_Tree_Birch_Small_01 SM_Tree_Birch_Dead_01
SM_Tree_Willow_Large_01 SM_Tree_Willow_Medium_01 SM_Tree_Willow_Small_01
SM_Tree_Pine_01 SM_Tree_Pine_02 SM_Tree_Pine_Dead_01 SM_Tree_Pine_Large_01 SM_Tree_Pine_Large_02
SM_Tree_PolyPine_01 SM_Tree_PolyPine_02 SM_Tree_PolyPine_03
SM_Tree_Dead_01 SM_Tree_Dead_02 SM_Tree_Dead_03
SM_Tree_Swamp_01 SM_Tree_Swamp_02 SM_Tree_Swamp_03 SM_Tree_Swamp_04
SM_Tree_Swamp_Stump_01 SM_Tree_Swamp_Stump_02 SM_Tree_Swamp_Root_01 SM_Tree_Swamp_Root_02
SM_Swamp_Root_01 SM_Swamp_Root_02
SM_Tree_Stump_01 SM_Tree_Stump_02 SM_Tree_Log_01 SM_Tree_Log_02
SM_Rock_01 SM_Rock_02 SM_Rock_03 SM_Rock_04 SM_Rock_Rounded_01 SM_Rock_Boulder_01
SM_Rock_Small_01 SM_Rock_Small_02 SM_Rock_Pile_01 SM_Rock_Pile_02 SM_Rock_Pile_03 SM_Rock_Pile_04 SM_Rock_Pile_05
SM_Rock_Pile_Curved_01 SM_Rock_Pile_Curved_02 SM_Rock_Cluster_Large_01 SM_Rock_Cluster_Large_02
SM_Rock_CaveEntrance_01 SM_Rock_Wall_01 SM_Rock_Wall_02
SM_Prop_CampFire_01 SM_Prop_Chest_Wood_01 SM_Prop_Bridge_Curved_01
SM_Prop_Fence_01 SM_Prop_Fence_02 SM_Prop_Grave_03 SM_Prop_Pillar_01
SM_Prop_Pillar_Broken_01 SM_Prop_Pillar_Broken_02 SM_Prop_Pillar_Arch_Broken_Moss_01
SM_Prop_RoadSign_01 SM_Prop_Skeleton_Ground_01 SM_Prop_Skull_01
SM_Prop_StoneWall_01 SM_Prop_StoneWall_02 SM_Prop_TorchStick_01
SM_Prop_Cloud_01 SM_Prop_Cloud_02 SM_Prop_Cloud_03
SM_Terrain_Mountain_01 SM_Terrain_Mountain_02 SM_Terrain_Mountain_03
SM_Terrain_DustPile_Small_01 SM_Terrain_DustPile_Small_02
SM_Terrain_Rubble_Pebbles_01 SM_Terrain_Rubble_Pebbles_02 SM_Terrain_Rubble_Pebbles_03
SM_Terrain_Swamp_Growth_01 SM_Terrain_Swamp_Growth_02 SM_Terrain_Swamp_Growth_03
SM_Terrain_GrassEdge_01 SM_Terrain_GrassEdge_02 SM_Terrain_GrassEdge_03 SM_Terrain_GrassEdge_04
"""

TEXTURES = ['PolygonNature_01.png']
GROUND = ['Grass.png', 'Mud.png', 'Moss.png', 'Rockwall.png', 'Cliffwall.png', 'Snow.png', 'Pebbles.png']

os.makedirs(DST, exist_ok=True)
os.makedirs(TEXDST, exist_ok=True)

ok = missing = 0
for name in FBX.split():
    src = index.get(name + '.fbx')
    if not src:
        print('MISSING FBX:', name)
        missing += 1
        continue
    shutil.copyfile(src, os.path.join(DST, name + '.fbx'))
    ok += 1

for t in TEXTURES:
    shutil.copyfile(index[t], os.path.join(DST, t))
shutil.copyfile(index['PolygonNature_01.png'], os.path.join(DST, 'PolygonNature.png'))

for t in GROUND:
    shutil.copyfile(index[t], os.path.join(TEXDST, t))

# summary
total = sum(os.path.getsize(os.path.join(DST, f)) for f in os.listdir(DST) if f.endswith('.fbx'))
nfbx = len([f for f in os.listdir(DST) if f.endswith('.fbx')])
texsz = sum(os.path.getsize(os.path.join(TEXDST, f)) for f in os.listdir(TEXDST))
print(f'copied {ok} FBX (missing {missing}); total {nfbx} FBX = {total/1e6:.1f} MB; tex = {texsz/1e6:.1f} MB')
