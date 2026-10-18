#!/usr/bin/env bash
# ================= deploy_ghpages.sh (v2.7 «Дальние земли») =================
# Сборка статического экспорта Next.js и деплой в ветку gh-pages.
# GitHub Pages — только статика, поэтому:
#   1) src/app/api временно убирается (route-хендлеры не экспортируются);
#   2) билд с GH_PAGES=1 → output:'export', basePath /bg3-webgpu-prototype;
#   3) out/ → ветка gh-pages (orphan-коммит, push -f), .nojekyll обязателен
#      (папка _next/ без него игнорируется Jekyll'ом).
# Клиентские фоллбеки: /api/* на Pages отдают 404 → сейвы/скрижали/лидерборд
# молча работают только локально (localStorage/IndexedDB), озвучка
# public/voices (манифест + 190 mp3) работает полностью.
# Токен: GH_TOKEN из окружения (НЕ хардкодится и в логи не печатается).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${GH_TOKEN:?Нужен GH_TOKEN (github PAT с scope repo)}"
REPO="ketaevweb/bg3-webgpu-prototype"

echo "[1/5] Убираю API-роуты на время экспорта…"
if [ -d src/app/api ]; then mv src/app/api scripts/_api_off; fi
restore() { [ -d scripts/_api_off ] && { mv scripts/_api_off src/app/api; echo "API-роуты восстановлены."; }; }
trap restore EXIT

echo "[2/5] next build (GH_PAGES: статический экспорт, basePath)…"
GH_PAGES=1 NEXT_PUBLIC_BASE_PATH=/bg3-webgpu-prototype npx next build
[ -f out/index.html ] || { echo "out/index.html не найден — экспорт не удался"; exit 1; }

echo "[3/5] Готовлю out/ (.nojekyll для _next/)…"
touch out/.nojekyll
echo "bg3-webgpu-prototype — v2.7 «Дальние земли». Статический экспорт Next.js для GitHub Pages. Игра: https://ketaevweb.github.io/bg3-webgpu-prototype/" > out/README.md

echo "[4/5] Пуш в gh-pages…"
cd out
git init -q .
git config user.name "bg3-deploy-bot"
git config user.email "deploy@users.noreply.github.com"
git checkout -q -b gh-pages
git add -A
git commit -q -m "gh-pages: v2.7 «Дальние земли» (мобильная версия + полный экран) — статический экспорт Next.js"
git remote add origin "https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git"
git push -q -f origin gh-pages
cd ..

echo "[5/5] Включаю GitHub Pages (source: gh-pages / root)…"
enable_res=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: token ${GH_TOKEN}" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO}/pages" \
  -d '{"source":{"branch":"gh-pages","path":"/"}}') || enable_res="curl-fail"
case "$enable_res" in
  201|204) echo "Pages включён/обновлён (HTTP $enable_res).";;
  409)     echo "Pages уже включён (409 — ок).";;
  *)       echo "Pages API вернул HTTP $enable_res — проверю вручную через GET.";;
esac

echo "Готово. Сайт: https://ketaevweb.github.io/bg3-webgpu-prototype/"
echo "(первая сборка Pages занимает 1–3 минуты)"
