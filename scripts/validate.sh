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
npm run check --workspace petcare-web
docker compose config --quiet
docker compose up --build --wait --wait-timeout "${COMPOSE_WAIT_TIMEOUT:-360}"

curl -fsS http://localhost:${WEB_PORT:-8080}/api/health >/dev/null
bash scripts/check-seed.sh
bash scripts/check-relations.sh
node scripts/smoke.mjs "http://localhost:${WEB_PORT:-8080}/api"
docker compose ps
