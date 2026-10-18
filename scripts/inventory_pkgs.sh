#!/bin/bash
# Инвентаризация unitypackage: pathname + тип ассета (FBX/anim/meta-клипы)
cd /home/z/my-project/upload/extract/pkg || exit 1
OUT=/home/z/my-project/upload/extract/INVENTORY.txt
: > "$OUT"
for pkg in blink32 doublel expl_rpg expl_fighter expl_war1 expl_war2 expl_war3 ki_basic ki_melee magicpot; do
  echo "##### $pkg" >> "$OUT"
  find "$pkg" -name pathname | while read -r pf; do
    d=$(dirname "$pf")
    pn=$(cat "$pf")
    a="$d/asset"
    if [ -f "$a" ]; then
      sz=$(stat -c%s "$a")
      magic=$(head -c 20 "$a" | tr -d '\0' | head -c 16)
      case "$pn" in
        *.fbx)   echo "  FBX   $sz  $pn  [$magic]" >> "$OUT" ;;
        *.anim)  echo "  ANIM  $sz  $pn" >> "$OUT" ;;
        *)       : ;;
      esac
    fi
  done
done
echo "DONE -> $OUT"
