#!/bin/sh
# Lambda cold start: SQLite'ı S3'ten geri yükle, sonra Litestream ile çalıştır.
set -e
if [ -n "${DB_BUCKET:-}" ]; then
  litestream restore -if-db-not-exists -if-replica-exists -config /app/apps/builder/litestream.yml "${DB_PATH}" || true
  exec litestream replicate -config /app/apps/builder/litestream.yml -exec "node /app/apps/builder/server-node.mjs"
fi
exec node /app/apps/builder/server-node.mjs
