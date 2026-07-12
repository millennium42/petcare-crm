# API contract

All endpoints use JSON under `/api`. Authentication uses the `petcare_session` HttpOnly cookie. Errors have `{ "error": "human-readable message" }`.

## Authentication

- `POST /auth/login` `{ email, password }`
- `POST /auth/logout`
- `GET /auth/me`

## Operational resources

- `GET|POST /users` — admin only.
- `GET|POST /customers` — admin/equipe; customer receives only own record through portal.
- `GET|POST /pets` — admin/equipe; customer GET is filtered to own pets.
- `GET|POST /vaccines` — admin/equipe writes; customer GET is filtered by ownership.
- `GET|POST /services` — admin/equipe writes; customer GET is filtered by ownership.
- `GET|POST /appointments` — admin/equipe writes; customer GET is filtered by ownership.
- `PATCH /appointments/:id/status` — admin/equipe.
- `GET|POST /medical-notes` — admin/equipe writes; customer GET is filtered by ownership.
- `GET|POST /payments` — admin/equipe writes; customer GET is filtered by ownership.
- `PATCH /payments/:id/status` — admin/equipe.
- `GET|POST /reminders` — admin/equipe writes; customer GET is filtered by ownership.
- `PATCH /reminders/:id/status` — admin/equipe.
- `GET /dashboard` — role-aware summary.
- `GET /portal` — admin preview or linked customer, returns the complete customer-area aggregate.
- `GET /health` — public liveness/readiness summary without secrets.

List endpoints return `{ items: [] }`; detail aggregates may return named collections. POST returns the created record with HTTP 201. Invalid input is 400, missing auth 401, forbidden role/ownership 403, missing record 404 and duplicate email 409.

## Input rules

- Emails are normalized to lowercase and validated.
- Required strings are trimmed and length-limited.
- IDs and money cents are positive integers.
- Enum-like fields are allow-listed.
- Dates must be ISO date/datetime strings accepted by MySQL.
- Passwords are at least 8 characters and never returned.
- Unknown client-supplied ownership links are checked before insert.
