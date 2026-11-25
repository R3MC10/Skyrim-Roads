#!/bin/sh
# serve the web build on 8765 with the robust test server (python http.server drops script downloads on busy machines)
D=$(cd "$(dirname "$0")" && pwd)
curl -s -o /dev/null localhost:8765/index.html || (setsid nohup node "$D/serve.js" 8765 /home/claude/web >/tmp/srv.log 2>&1 < /dev/null & sleep 1)
