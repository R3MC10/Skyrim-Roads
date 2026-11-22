#!/bin/sh
curl -s -o /dev/null localhost:8794/hud.js || (cd /home/claude/web_hud && setsid nohup python3 -m http.server 8794 >/tmp/srv_hud.log 2>&1 < /dev/null & sleep 1)
