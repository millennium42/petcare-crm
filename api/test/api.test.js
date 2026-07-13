import test from "node:test";
import assert from "node:assert/strict";
import { mysqlDateTime } from "../src/app.js";
import { allow, authenticate, COOKIE_NAME, cookieOptions, customerScope, decodeSession, issueToken } from "../src/auth.js";
import { assertValid, input } from "../src/validation.js";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";

test("JWT preserva identidade, papel e vínculo do cliente", () => {
  const token = issueToken({ id: 7, role: "cliente", customer_id: 9 });
  assert.deepEqual(decodeSession(token), { id: 7, role: "cliente", customer_id: 9 });
  assert.deepEqual(customerScope(decodeSession(token)), { sql: " WHERE customer_id = ?", params: [9] });
  assert.equal(COOKIE_NAME, "petcare_session");
  assert.deepEqual(cookieOptions(), { httpOnly: true, sameSite: "lax", secure: false, maxAge: 28_800_000, path: "/" });
});

test("RBAC bloqueia cliente e libera equipe", () => {
  let nextCalled = false;
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  allow("admin", "equipe")({ user: { role: "cliente" } }, response, () => { nextCalled = true; });
  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
  allow("admin", "equipe")({ user: { role: "equipe" } }, response, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test("autenticação recarrega papel e vínculo atuais do banco", async () => {
  const token = issueToken({ id: 7, role: "admin", customer_id: null });
  const req = { headers: { cookie: `${COOKIE_NAME}=${token}` } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const pool = { execute: async () => [[{ id: 7, role: "cliente", customer_id: 9, active: 1 }]] };
  let nextCalled = false;
  await authenticate(pool)(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, { id: 7, role: "cliente", customer_id: 9 });

  const missingPool = { execute: async () => [[]] };
  await authenticate(missingPool)(req, res, () => assert.fail("usuário inexistente não pode avançar"));
  assert.equal(res.statusCode, 401);
});

test("validação normaliza e rejeita dados fora do contrato", () => {
  const valid = input({ email: "  ADMIN@PETCARE.LOCAL ", value_cents: 1500, date: "2026-07-12" });
  valid.email(); valid.positiveInt("value_cents"); valid.date("date");
  assert.deepEqual(assertValid(valid), { email: "admin@petcare.local", value_cents: 1500, date: "2026-07-12" });

  const invalid = input({ email: "invalido", value_cents: 0, date: "2026-02-31" });
  invalid.email(); invalid.positiveInt("value_cents"); invalid.date("date");
  assert.throws(() => assertValid(invalid), /email inválido/);
  assert.equal(invalid.errors.length, 3);

  const invalidDateTime = input({ scheduled_at: "2026-02-31T10:00" });
  invalidDateTime.date("scheduled_at", false, true);
  assert.throws(() => assertValid(invalidDateTime), /data ISO válida/);

  const utcDateTime = input({ scheduled_at: "2026-07-13T09:30:00Z" });
  utcDateTime.date("scheduled_at", false, true);
  assert.throws(() => assertValid(utcDateTime), /data ISO válida/);
});

test("horário operacional preserva 09:30 como 09:30", () => {
  assert.equal(mysqlDateTime("2026-07-13T09:30"), "2026-07-13 09:30:00");
});
