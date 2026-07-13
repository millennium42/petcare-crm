# PetCare CRM — product contract

## Goal

Commercial-demo CRM for one veterinary clinic/petshop. It must feel SaaS-like without multi-tenant complexity and provide distinct operational and customer experiences.

## Stack and topology

- React + Vite frontend served by Nginx.
- Node.js + Express JSON API.
- MySQL 8 relational storage.
- JWT stored in an HttpOnly, SameSite cookie; bcrypt password hashes.
- Docker Compose services: `web`, `api`, `mysql`.
- Public port: web/Nginx `8080`; API `3000` and MySQL `3306` stay internal to Compose.
- Operational datetimes are clinic wall-clock values in `America/Sao_Paulo`; a time entered as 09:30 is stored, returned and displayed as 09:30.

## Roles

| Capability | admin | equipe | cliente |
| --- | --- | --- | --- |
| Dashboard operational | full | full | own summary |
| Create users / roles | yes | no | no |
| Manage customers and pets | yes | yes | no |
| Vaccines, services, appointments, notes | yes | yes | own read-only |
| Payments and reminders | yes | yes | own read-only |
| Customer portal | optional preview | no | own records only |

Every customer user is linked to exactly one `customer_id`. Customer authorization is enforced in SQL/API filters, never only in React.

## Entities

- `users`: identity, email, password hash, `admin|equipe|cliente`, optional customer link, active flag.
- `customers`: tutor name, email, phone, address, notes, active flag.
- `pets`: customer, name, species, breed, sex, birth date, weight, allergies, notes.
- `vaccines`: pet, name, dose, application date, next due date, veterinarian, status.
- `services`: pet/customer, `consulta|banho|tosa|exame|hotel|procedimento`, date, status, value in integer cents, notes.
- `appointments`: pet/customer, service type, scheduled time, status, notes.
- `medical_notes`: pet, optional appointment, author, clinical observation and timestamp.
- `payments`: customer, optional appointment, description, amount in integer cents, method, status, due/paid dates.
- `reminders`: customer, optional pet, kind, message, due time and status.

All foreign keys are indexed. Customer-owned data cascades only where safe; user and clinical authorship is preserved or nulled. Money is stored as integer cents.

A payment has `paid_date` if and only if its status is `pago`; leaving the paid state clears that date atomically.

## Required workflows

1. Sign in as admin, staff or customer and sign out.
2. Admin creates an internal or customer user and assigns a valid role.
3. Staff creates a customer and multiple pets.
4. Staff records vaccines, services, appointments and clinical observations for a pet.
5. Staff records payment and reminder status.
6. Dashboard shows customers, pets, today's appointments, open payments, due vaccines and upcoming reminders.
7. Customer sees only their profile, pets, vaccine history, services, appointments, payments and reminders.

When a staff form asks for both tutor/customer and pet, selecting a tutor must restrict the pet selector to only that tutor's pets.

## Demo data

- Admin: `admin@petcare.local` / `Demo123!`
- Staff: `equipe@petcare.local` / `Demo123!`
- Customer: `cliente@petcare.local` / `Demo123!`
- All records are fictional and include at least two customers, three pets, vaccines, each service category, appointments, notes, payments and reminders.

## Acceptance gates

- API unit tests pass.
- React production build passes.
- Docker images build and all three services become healthy/running.
- `/api/health` succeeds.
- Authenticated smoke proves login, role protection and customer data isolation.
- No secret or real personal data is committed.
- Peer review, security review, QA and release review have no unresolved blockers.
