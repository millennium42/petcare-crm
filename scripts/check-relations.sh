#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

sql() {
  docker compose exec -T mysql sh -c 'exec mysql -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" --batch --skip-column-names'
}

constraint_count="$(sql <<'SQL'
SELECT COUNT(*)
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND CONSTRAINT_NAME IN (
    'fk_medical_notes_appointment_pet',
    'fk_payments_appointment_customer',
    'fk_reminders_pet_customer'
  );
SQL
)"
test "$constraint_count" = "3"

mismatch_count="$(sql <<'SQL'
SELECT
  (SELECT COUNT(*) FROM medical_notes m JOIN appointments a ON a.id = m.appointment_id WHERE m.pet_id <> a.pet_id)
  + (SELECT COUNT(*) FROM payments p JOIN appointments a ON a.id = p.appointment_id WHERE p.customer_id <> a.customer_id)
  + (SELECT COUNT(*) FROM reminders r JOIN pets p ON p.id = r.pet_id WHERE r.customer_id <> p.customer_id);
SQL
)"
test "$mismatch_count" = "0"

expect_fk_failure() {
  local label="$1"
  local statement="$2"
  local output
  if output="$(sql 2>&1 <<SQL
START TRANSACTION;
$statement
ROLLBACK;
SQL
)"; then
    echo "$label accepted an inconsistent relationship" >&2
    exit 1
  fi
  case "$output" in
    *"ERROR 1452"*) ;;
    *) echo "$label failed with an unexpected error: $output" >&2; exit 1 ;;
  esac
}

expect_fk_failure "medical note" "INSERT INTO medical_notes (pet_id, appointment_id, observation) VALUES (1, 3, 'compound relationship test');"
expect_fk_failure "payment" "INSERT INTO payments (customer_id, appointment_id, description, amount_cents, method, status) VALUES (1, 3, 'compound relationship test', 100, 'pix', 'pendente');"
expect_fk_failure "reminder" "INSERT INTO reminders (customer_id, pet_id, kind, message, due_at, status) VALUES (1, 3, 'retorno', 'compound relationship test', '2030-01-20 10:00:00', 'pendente');"

echo "Compound relations OK: constraints present, data consistent and three invalid pairs rejected."
