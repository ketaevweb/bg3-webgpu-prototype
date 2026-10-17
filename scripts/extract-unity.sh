#!/bin/bash
# v1.6 asset pipeline: extract Synty POLYGON unitypackages, restore real filenames from `pathname`
set -u
SRC=/home/z/my-project/.zscripts/rar-extract
OUT=/home/z/my-project/.zscripts/assets

extract() {
  local pkg="$1" dest="$2"
  rm -rf "$dest"; mkdir -p "$dest"
  cd "$dest"
  tar xzf "$pkg" 2>/dev/null
  # restore names: for each GUID dir with pathname, move asset -> real filename
  local n=0
  for p in "$dest"/*/pathname; do
    [ -f "$p" ] || continue
    local dir=$(dirname "$p")
    local orig=$(cat "$p")
    [ -z "$orig" ] && continue
    local target="$dest$orig"   # orig starts with Assets/...
    if [ -f "$dir/asset" ]; then
      mkdir -p "$(dirname "$target")"
      mv -f "$dir/asset" "$target"
      n=$((n+1))
    fi
  done
  echo "$dest -> restored $n assets"
}

extract "$SRC/POLYGON_Nature_Unity_2021_3_v1_1_7.unitypackage" "$OUT/nature/"
extract "$SRC/Polygon_NatureBiomes_SwampMarshland_Unity_Package_2020_3_v1_02_unitypackage" "$OUT/swampbiome/"

echo "=== NATURE: top dirs ==="
find "$OUT/nature/Assets" -maxdepth 2 -type d 2>/dev/null | head -15
echo "=== NATURE: FBX count ==="
find "$OUT/nature" -iname "*.fbx" 2>/dev/null | wc -l
echo "=== SWAMP: FBX count ==="
find "$OUT/swampbiome" -iname "*.fbx" 2>/dev/null | wc -l
