#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

on_error() {
  docker compose ps
  docker compose logs --tail=120
}
trap on_error ERR

bash scripts/setup-env.sh
npm ci --no-audit --no-fund
npm test
npm run build
docker compose config --quiet
docker compose up --build -d

for _ in $(seq 1 60); do
  if curl -fsS http://localhost:${WEB_PORT:-8080}/api/health >/dev/null; then
    break
  fi
  sleep 2
done

curl -fsS http://localhost:${WEB_PORT:-8080}/api/health >/dev/null
bash scripts/check-seed.sh
node scripts/smoke.mjs "http://localhost:${WEB_PORT:-8080}/api"
docker compose ps
