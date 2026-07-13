# Database migrations

MySQL initialization files are append-only and run in lexical order on a new volume. Migration `003_compound_relationships.sql` upgrades the original schema with database-enforced ownership pairs.

## Guarantees added by 003

- `medical_notes(appointment_id, pet_id)` references `appointments(id, pet_id)`.
- `payments(appointment_id, customer_id)` references `appointments(id, customer_id)`.
- `reminders(pet_id, customer_id)` references `pets(id, customer_id)`.

The referenced appointment pairs are unique. The three foreign keys use `ON DELETE RESTRICT` because the ownership column is required and cannot participate in `SET NULL`. The API has no hard-delete endpoint; records are retained or deactivated explicitly.

## Existing volume

Do not re-run a numbered migration that is already installed. Before applying 003:

1. create and verify a database backup;
2. run the three mismatch queries below and require zero rows;
3. schedule a maintenance window for index creation and metadata locks;
4. execute the migration once;
5. run `bash scripts/check-relations.sh` and the authenticated smoke.

```sql
SELECT m.id FROM medical_notes m JOIN appointments a ON a.id = m.appointment_id WHERE m.pet_id <> a.pet_id;
SELECT p.id FROM payments p JOIN appointments a ON a.id = p.appointment_id WHERE p.customer_id <> a.customer_id;
SELECT r.id FROM reminders r JOIN pets p ON p.id = r.pet_id WHERE r.customer_id <> p.customer_id;
```

Example with Compose:

```bash
docker compose exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < database/003_compound_relationships.sql
bash scripts/check-relations.sh
```

Never disable `foreign_key_checks` to force this migration. Re-enabling it does not validate rows created while checks were disabled.
