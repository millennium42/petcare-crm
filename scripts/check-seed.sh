#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
result="$(docker compose exec -T mysql sh -lc 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot petcare -N -e "SELECT COUNT(*) FROM users WHERE password_hash LIKE '\''\$2b\$12\$%'\''; SELECT COUNT(*) FROM pets; SELECT COUNT(*) FROM services;"')"
expected=$'3\n3\n6'
if [[ "$result" != "$expected" ]]; then
  printf 'Unexpected seed counts/hash cost:\n%s\n' "$result" >&2
  exit 1
fi
echo 'Seed check passed: bcrypt cost 12, 3 users, 3 pets and 6 service categories.'
