#!/bin/sh
# Lambda cold start: 9router (AI) + Litestream (SQLite) + uygulama.
set -e

# 9router: veri dizinini /tmp'ye kopyala (konteyner kökü salt-okunur).
if [ -d /app/.9router-data ] && command -v 9router >/dev/null 2>&1; then
  rm -rf /tmp/router-home && mkdir -p /tmp/router-home
  cp -a /app/.9router-data /tmp/router-home/.9router
  HOME=/tmp/router-home nohup 9router --no-browser --skip-update --host 127.0.0.1 --port 20128 \
    >/tmp/9router.log 2>&1 &
  for i in $(seq 1 30); do
    if node -e "fetch('http://127.0.0.1:20128/v1/models').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
      break
    fi
    sleep 1
  done
fi

if [ -n "${DB_BUCKET:-}" ]; then
  litestream restore -if-db-not-exists -if-replica-exists -config /app/apps/builder/litestream.yml "${DB_PATH}" || true
  exec litestream replicate -config /app/apps/builder/litestream.yml -exec "node /app/apps/builder/server-node.mjs"
fi
exec node /app/apps/builder/server-node.mjs
