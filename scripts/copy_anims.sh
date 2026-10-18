#!/bin/bash
# v1.7: копирование выбранных анимаций Unity → public/anims/
set -e
PKG=/home/z/my-project/upload/extract/pkg
OUT=/home/z/my-project/public/anims
mkdir -p "$OUT"
copy() { # $1=пакет $2=grep-паттерн pathname $3=имя выхода
  local pf
  pf=$(find "$PKG/$1" -name pathname -exec grep -l -- "$2" {} \; | head -1)
  if [ -z "$pf" ]; then echo "MISS $3 ($2)"; return 1; fi
  cp "$(dirname "$pf")/asset" "$OUT/$3"
  echo "OK $3 ($(stat -c%s "$OUT/$3") bytes)"
}
# blink32 (Blink — FREE 32 RPG Animations; AdvancedSkeleton-риг Root_M/Spine1_M/Chest_M)
copy blink32 "Movement/Idle.fbx"              idle.fbx
copy blink32 "Combat/IdleCombat"              idle_combat.fbx
copy blink32 "Movement/RunForward"            run.fbx
copy blink32 "MeleeAttack_OneHanded"          attack_1h.fbx
copy blink32 "MeleeAttack_TwoHanded"          attack_2h.fbx
copy blink32 "Combat/SpellCast"               cast.fbx
copy blink32 "Combat/GetHit"                  hit.fbx
copy blink32 "Combat/Death"                   death.fbx
copy blink32 "Combat/PunchLeft"               punch_l.fbx
copy blink32 "Combat/PunchRight"              punch_r.fbx
copy blink32 "Combat/BlockingLoop"            block.fbx
# doublel (UE4-риг pelvis/spine_01..) — шаг в Locomotion, InPlace
copy doublel "Walk_A_F_InPlace"               walk.fbx
echo "---- total ----"
du -sh "$OUT"; ls "$OUT"
