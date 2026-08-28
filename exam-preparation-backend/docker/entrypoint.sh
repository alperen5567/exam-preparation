#!/bin/sh
set -e

# Default PORT if not set
export PORT=${PORT:-4000}

# Wait for Postgres if DATABASE_URL uses it
if [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL detected; waiting for database..."
  # lightweight wait loop using built-in net module
  ATTEMPTS=0
  until node -e "const net = require('net'); const url = new URL(process.env.DATABASE_URL); const c = net.createConnection({ host: url.hostname, port: url.port || 5432 }); c.on('connect', () => { c.end(); process.exit(0); }); c.on('error', () => { process.exit(1); });"; do
    ATTEMPTS=$((ATTEMPTS+1))
    if [ $ATTEMPTS -gt 60 ]; then echo "[entrypoint] DB not reachable after 60 tries"; exit 1; fi
    echo "[entrypoint] waiting ($ATTEMPTS)..."; sleep 2;
  done
fi

# Prisma generate & migrate (safe if Prisma is present)
if [ -d prisma ]; then
  echo "[entrypoint] Running prisma generate"
  npx prisma generate || true
  if [ "$RUN_MIGRATIONS" != "false" ]; then
    echo "[entrypoint] Running prisma migrate deploy"
    npx prisma migrate deploy || true
  fi
fi

exec "$@"
