#!/bin/bash
cd /home/z/my-project/upload/extract/pkg
declare -A P=( [blink32]="../as/Blink/Animation/FREE - 32 RPG Animations.unitypackage" [doublel]="../as/DoubleL/Animation/RPGAnimationsPackFREE.unitypackage" [expl_rpg]="../as/Explosive/Animation/RPG Character Mecanim Animation Pack FREE.unitypackage" [expl_fighter]="../as/Explosive/AnimationBipedal/Fighter Pack Bundle FREE.unitypackage" [expl_war1]="../as/Explosive/AnimationBipedal/Warrior Pack Bundle 1 FREE.unitypackage" [expl_war2]="../as/Explosive/AnimationBipedal/Warrior Pack Bundle 2 FREE.unitypackage" [expl_war3]="../as/Explosive/AnimationBipedal/Warrior Pack Bundle 3 FREE.unitypackage" [ki_basic]="../as/Kevin Iglesias/Animation/Human Basic Motions FREE.unitypackage" [ki_melee]="../as/Kevin Iglesias/Animation/Human Melee Animations FREE.unitypackage" [magicpot]="../as/Magicpot Inc/AnimationBipedal/Fighting Motions Vol1.unitypackage" )
for k in blink32 expl_rpg ki_melee expl_war1 ki_basic magicpot expl_war2 expl_war3 doublel expl_fighter; do
  if [ -f "$k/.done" ]; then continue; fi
  mkdir -p "$k"
  tar -xzf "${P[$k]}" -C "$k" 2>/dev/null && touch "$k/.done" && echo "OK $k" || echo "FAIL $k"
done
echo "ALL_DONE"
