#!/bin/bash
# Стерильный перезапуск браузера + проверка позы
pkill -9 -f "agent-browser" 2>/dev/null
sleep 1
rm -rf /tmp/agent-browser-chrome-* 2>/dev/null
cd /home/z/my-project
timeout 40 agent-browser open http://localhost:3000 2>&1 | head -1
