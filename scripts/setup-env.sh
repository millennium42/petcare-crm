#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
if [[ -s .env ]]; then
  exit 0
fi

umask 077
mysql_password="$(openssl rand -hex 24)"
root_password="$(openssl rand -hex 24)"
jwt_secret="$(openssl rand -hex 32)"
printf '%s\n' \
  'MYSQL_DATABASE=petcare' \
  'MYSQL_USER=petcare' \
  "MYSQL_PASSWORD=$mysql_password" \
  "MYSQL_ROOT_PASSWORD=$root_password" \
  "JWT_SECRET=$jwt_secret" \
  'COOKIE_SECURE=false' \
  'WEB_PORT=8080' > .env
echo 'Created .env with random local infrastructure secrets.'
