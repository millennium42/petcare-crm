# Privacy and LGPD baseline

PetCare CRM is a demonstration product with fictional data. Before processing real data, the deploying clinic must review this baseline with its privacy and legal advisers.

## Data processed

- Tutor identity and contact data: name, email, phone and address.
- Pet profile, allergies, vaccination, service and clinical observation history.
- Appointments, payment records and reminders.
- Staff account identity, role and authorship of clinical observations.

The demo does not require CPF, card numbers, biometrics or uploaded documents. Do not add them without a documented purpose and risk review.

## Purposes and access

- `admin`: administration, team accounts and all operational records.
- `equipe`: customer care, pet care, scheduling, clinical notes and finance operations.
- `cliente`: read-only access to records linked to their own tutor profile.

Authorization is enforced by the API. UI visibility alone is not considered access control.

## Production responsibilities

The deploying clinic is responsible for defining legal bases, privacy notices, retention periods, data-subject contact channels and incident response. It must also provide authenticated export/correction/deletion workflows appropriate to clinical and legal retention duties.

## Safe demo defaults

- Seed data is fictional.
- Passwords are bcrypt hashes; JWTs are HttpOnly cookies.
- Secrets are environment variables and `.env` is ignored.
- The database volume can be reset after a demonstration with `docker compose down -v`.
- Backups, TLS, audit retention and disaster recovery are deployment responsibilities, not claims of this local demo.
