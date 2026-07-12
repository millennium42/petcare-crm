# Security baseline

- Passwords are hashed with bcrypt and never returned by the API.
- JWT authentication uses an HttpOnly, SameSite cookie with a short configured lifetime.
- Login is rate-limited and errors do not reveal whether an email exists.
- Helmet adds baseline HTTP security headers.
- All write endpoints validate inputs and require `admin` or `equipe`; user creation is `admin` only.
- Customer reads are filtered by the authenticated `customer_id` in the API/SQL layer.
- Database and JWT secrets come from environment variables.
- `scripts/setup-env.sh` generates local infrastructure secrets outside Git.
- Express and MySQL are reachable only on the private Compose network; Nginx is the sole public entry point.

For production: replace all demo credentials, set a random JWT secret, terminate TLS, set `COOKIE_SECURE=true`, restrict database port exposure, add centralized audit logs/backups, and run dependency/container scanning in CI.
