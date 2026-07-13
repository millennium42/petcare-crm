# Architecture

PetCare CRM is a deliberately small three-service application.

```text
Browser -> Nginx/React (:8080) -> /api proxy -> Express (internal :3000) -> MySQL (internal :3306)
```

- Nginx makes the browser/API same-origin, so the JWT can stay in an HttpOnly cookie.
- Express owns validation, authentication, role checks and customer ownership filters.
- MySQL owns relational integrity and persistent demo data.
- MySQL, API and browser share the clinic wall-clock policy configured by `APP_TIMEZONE` (default `America/Sao_Paulo`); date/time values are transferred without implicit UTC conversion.
- The product is single-clinic by design. True tenancy, inventory, fiscal documents and payment gateways are outside this release.

The implementation follows the Code House gate order: product contract, database, API, frontend, integration, peer review, security, QA and release approval. Flowise is not a runtime dependency.
