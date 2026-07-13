import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcrypt";
import { allow, authenticate, COOKIE_NAME, cookieOptions, customerScope, issueToken } from "./auth.js";
import { assertValid, input, roles, serviceTypes } from "./validation.js";

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const staff = allow("admin", "equipe");
const DUMMY_PASSWORD_HASH = "$2b$12$mhgTUyir1GDTb08KU5CME.OvDfFFFctxzFMcD57LO.yR6lqU/UMLK";

export function mysqlDateTime(value) {
  const normalized = value.replace("T", " ");
  return normalized.length === 16 ? `${normalized}:00` : normalized;
}

async function find(pool, sql, params, label) {
  const [rows] = await pool.execute(sql, params);
  if (!rows[0]) {
    const error = new Error(`${label} não encontrado`);
    error.status = 404;
    throw error;
  }
  return rows[0];
}

async function insert(pool, table, data) {
  const columns = Object.keys(data);
  const [result] = await pool.execute(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    Object.values(data),
  );
  return find(pool, `SELECT * FROM ${table} WHERE id = ?`, [result.insertId], "Registro");
}

async function ensureCustomer(pool, id) {
  return find(pool, "SELECT id FROM customers WHERE id = ? AND active = 1", [id], "Cliente");
}

async function ensurePet(pool, petId, customerId = null) {
  const params = [petId];
  const owned = customerId ? " AND customer_id = ?" : "";
  if (customerId) params.push(customerId);
  return find(pool, `SELECT id, customer_id FROM pets WHERE id = ? AND active = 1${owned}`, params, "Pet");
}

async function ensureAppointment(pool, appointmentId, customerId = null, petId = null) {
  const params = [appointmentId];
  let owned = "";
  if (customerId) { owned += " AND customer_id = ?"; params.push(customerId); }
  if (petId) { owned += " AND pet_id = ?"; params.push(petId); }
  return find(pool, `SELECT id, customer_id, pet_id FROM appointments WHERE id = ?${owned}`, params, "Agendamento");
}

function list(pool, sql, scopeColumn = "customer_id") {
  return asyncRoute(async (req, res) => {
    const scope = customerScope(req.user, scopeColumn);
    const [items] = await pool.execute(`${sql}${scope.sql} ORDER BY 1 DESC LIMIT 200`, scope.params);
    res.json({ items });
  });
}

function registerResource(app, pool, path, config) {
  app.get(path, authenticate(pool), allow(...config.readRoles), list(pool, config.select, config.scopeColumn));
  app.post(path, authenticate(pool), allow(...config.writeRoles), asyncRoute(async (req, res) => {
    const data = await config.parse(req, pool);
    res.status(201).json(await insert(pool, config.table, data));
  }));
}

export function createApp(pool) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "32kb", strict: true }));

  app.get("/api/health", asyncRoute(async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ error: "Banco de dados indisponível", status: "error" });
    }
  }));

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Muitas tentativas de login; tente novamente em alguns minutos" },
  });

  app.post("/api/auth/login", loginLimiter, asyncRoute(async (req, res) => {
    const check = input(req.body);
    const email = check.email();
    check.requiredString("password", 128);
    assertValid(check);

    const [rows] = await pool.execute(
      "SELECT id, name, email, password_hash, role, customer_id, active FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    const user = rows[0];
    const passwordMatches = await bcrypt.compare(req.body.password, user?.password_hash || DUMMY_PASSWORD_HASH);
    if (!user?.active || !passwordMatches) {
      return res.status(401).json({ error: "E-mail ou senha inválidos" });
    }

    const sessionUser = { id: user.id, name: user.name, email: user.email, role: user.role, customer_id: user.customer_id };
    res.cookie(COOKIE_NAME, issueToken(sessionUser), cookieOptions()).json({ user: sessionUser });
  }));

  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined }).status(204).end();
  });

  app.get("/api/auth/me", authenticate(pool), asyncRoute(async (req, res) => {
    const user = await find(
      pool,
      "SELECT id, name, email, role, customer_id FROM users WHERE id = ? AND active = 1",
      [req.user.id],
      "Usuário",
    );
    res.json({ user });
  }));

  app.get("/api/users", authenticate(pool), allow("admin"), asyncRoute(async (_req, res) => {
    const [items] = await pool.query(
      "SELECT id, name, email, role, customer_id, active, created_at, updated_at FROM users ORDER BY id DESC LIMIT 200",
    );
    res.json({ items });
  }));

  app.post("/api/users", authenticate(pool), allow("admin"), asyncRoute(async (req, res) => {
    const check = input(req.body);
    check.requiredString("name", 120);
    check.email();
    const password = check.requiredString("password", 128);
    if (password && password.length < 8) check.errors.push("password deve ter pelo menos 8 caracteres");
    const role = check.oneOf("role", roles);
    const customerId = check.positiveInt("customer_id", role !== "cliente");
    const values = assertValid(check);
    if (role === "cliente") await ensureCustomer(pool, customerId);
    values.customer_id = role === "cliente" ? customerId : null;
    values.password_hash = await bcrypt.hash(password, 12);
    delete values.password;
    const user = await insert(pool, "users", values);
    delete user.password_hash;
    res.status(201).json(user);
  }));

  registerResource(app, pool, "/api/customers", {
    table: "customers",
    readRoles: ["admin", "equipe"],
    writeRoles: ["admin", "equipe"],
    select: "SELECT id, name, email, phone, address, notes, active, created_at, updated_at FROM customers",
    parse: async (req) => {
      const check = input(req.body);
      check.requiredString("name", 120); check.email(); check.requiredString("phone", 30);
      check.optionalString("address", 255); check.optionalString("notes", 2000);
      return assertValid(check);
    },
  });

  registerResource(app, pool, "/api/pets", {
    table: "pets",
    readRoles: roles,
    writeRoles: ["admin", "equipe"],
    select: "SELECT id, customer_id, name, species, breed, sex, birth_date, weight_kg, allergies, notes, active, created_at, updated_at FROM pets",
    parse: async (req) => {
      const check = input(req.body);
      const customerId = check.positiveInt("customer_id"); check.requiredString("name", 100);
      check.requiredString("species", 80); check.optionalString("breed", 100);
      check.oneOf("sex", ["macho", "femea", "desconhecido"]); check.date("birth_date", true);
      check.positiveNumber("weight_kg", true); check.optionalString("allergies", 1000); check.optionalString("notes", 2000);
      const values = assertValid(check); await ensureCustomer(pool, customerId); return values;
    },
  });

  registerResource(app, pool, "/api/vaccines", {
    table: "vaccines",
    readRoles: roles,
    writeRoles: ["admin", "equipe"],
    scopeColumn: "p.customer_id",
    select: "SELECT v.id, v.pet_id, v.name, v.dose, v.application_date, v.next_due_date, v.veterinarian, v.status, v.created_at, v.updated_at FROM vaccines v JOIN pets p ON p.id = v.pet_id",
    parse: async (req) => {
      const check = input(req.body); const petId = check.positiveInt("pet_id"); check.requiredString("name", 120);
      check.optionalString("dose", 80); check.date("application_date"); check.date("next_due_date", true);
      check.optionalString("veterinarian", 120); check.oneOf("status", ["aplicada", "pendente", "atrasada"]);
      const values = assertValid(check); await ensurePet(pool, petId); return values;
    },
  });

  registerResource(app, pool, "/api/services", {
    table: "services",
    readRoles: roles,
    writeRoles: ["admin", "equipe"],
    select: "SELECT id, customer_id, pet_id, type, service_date, status, value_cents, notes, created_at, updated_at FROM services",
    parse: async (req) => {
      const check = input(req.body); const customerId = check.positiveInt("customer_id"); const petId = check.positiveInt("pet_id");
      check.oneOf("type", serviceTypes); check.date("service_date", false, true);
      check.oneOf("status", ["agendado", "em_andamento", "concluido", "cancelado"]); check.positiveInt("value_cents"); check.optionalString("notes", 2000);
      const values = assertValid(check); values.service_date = mysqlDateTime(values.service_date); await ensurePet(pool, petId, customerId); return values;
    },
  });

  registerResource(app, pool, "/api/appointments", {
    table: "appointments",
    readRoles: roles,
    writeRoles: ["admin", "equipe"],
    select: "SELECT id, customer_id, pet_id, service_type, scheduled_at, status, notes, created_at, updated_at FROM appointments",
    parse: async (req) => {
      const check = input(req.body); const customerId = check.positiveInt("customer_id"); const petId = check.positiveInt("pet_id");
      check.oneOf("service_type", serviceTypes); check.date("scheduled_at", false, true);
      check.oneOf("status", ["agendado", "confirmado", "concluido", "cancelado"]); check.optionalString("notes", 2000);
      const values = assertValid(check); values.scheduled_at = mysqlDateTime(values.scheduled_at); await ensurePet(pool, petId, customerId); return values;
    },
  });

  registerResource(app, pool, "/api/medical-notes", {
    table: "medical_notes",
    readRoles: roles,
    writeRoles: ["admin", "equipe"],
    scopeColumn: "p.customer_id",
    select: "SELECT m.id, m.pet_id, m.appointment_id, m.author_user_id, m.observation, m.created_at, m.updated_at FROM medical_notes m JOIN pets p ON p.id = m.pet_id",
    parse: async (req, db) => {
      const check = input(req.body); const petId = check.positiveInt("pet_id"); const appointmentId = check.positiveInt("appointment_id", true);
      check.requiredString("observation", 5000); const values = assertValid(check); await ensurePet(db, petId);
      if (appointmentId) await ensureAppointment(db, appointmentId, null, petId);
      values.author_user_id = req.user.id; return values;
    },
  });

  registerResource(app, pool, "/api/payments", {
    table: "payments",
    readRoles: roles,
    writeRoles: ["admin", "equipe"],
    select: "SELECT id, customer_id, appointment_id, description, amount_cents, method, status, due_date, paid_date, created_at, updated_at FROM payments",
    parse: async (req) => {
      const check = input(req.body); const customerId = check.positiveInt("customer_id"); const appointmentId = check.positiveInt("appointment_id", true);
      check.requiredString("description", 255); check.positiveInt("amount_cents"); check.oneOf("method", ["dinheiro", "pix", "cartao", "boleto", "outro"]);
      const status = check.oneOf("status", ["pendente", "pago", "atrasado", "cancelado"]); check.date("due_date", true); check.date("paid_date", true);
      const values = assertValid(check); await ensureCustomer(pool, customerId); if (appointmentId) await ensureAppointment(pool, appointmentId, customerId);
      if (status === "pago" && !values.paid_date) { const error = new Error("paid_date é obrigatório para pagamento pago"); error.status = 400; throw error; }
      return values;
    },
  });

  registerResource(app, pool, "/api/reminders", {
    table: "reminders",
    readRoles: roles,
    writeRoles: ["admin", "equipe"],
    select: "SELECT id, customer_id, pet_id, kind, message, due_at, status, created_at, updated_at FROM reminders",
    parse: async (req) => {
      const check = input(req.body); const customerId = check.positiveInt("customer_id"); const petId = check.positiveInt("pet_id", true);
      check.oneOf("kind", ["vacina", "agendamento", "pagamento", "retorno", "outro"]); check.requiredString("message", 1000);
      check.date("due_at", false, true); check.oneOf("status", ["pendente", "enviado", "concluido", "cancelado"]);
      const values = assertValid(check); values.due_at = mysqlDateTime(values.due_at); await ensureCustomer(pool, customerId);
      if (petId) await ensurePet(pool, petId, customerId); return values;
    },
  });

  const statusRoute = (path, table, allowedStatuses) => app.patch(path, authenticate(pool), staff, asyncRoute(async (req, res) => {
    const check = input(req.body); const status = check.oneOf("status", allowedStatuses); assertValid(check);
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) { const error = new Error("id deve ser um inteiro positivo"); error.status = 400; throw error; }
    const paidDate = table === "payments" ? ", paid_date = IF(? = 'pago', COALESCE(paid_date, CURRENT_DATE), paid_date)" : "";
    const params = table === "payments" ? [status, status, id] : [status, id];
    const [result] = await pool.execute(`UPDATE ${table} SET status = ?${paidDate} WHERE id = ?`, params);
    if (!result.affectedRows) return res.status(404).json({ error: "Registro não encontrado" });
    res.json(await find(pool, `SELECT * FROM ${table} WHERE id = ?`, [id], "Registro"));
  }));
  statusRoute("/api/appointments/:id/status", "appointments", ["agendado", "confirmado", "concluido", "cancelado"]);
  statusRoute("/api/payments/:id/status", "payments", ["pendente", "pago", "atrasado", "cancelado"]);
  statusRoute("/api/reminders/:id/status", "reminders", ["pendente", "enviado", "concluido", "cancelado"]);

  app.get("/api/dashboard", authenticate(pool), asyncRoute(async (req, res) => {
    const scope = customerScope(req.user, "customer_id");
    const where = scope.sql || "";
    const params = scope.params;
    const petWhere = req.user.role === "cliente" ? " WHERE customer_id = ?" : "";
    const vaccineWhere = req.user.role === "cliente" ? " AND p.customer_id = ?" : "";
    const [[customers], [pets], [appointments], [payments], [vaccines], [reminders], [appointmentRows], [vaccineRows], [reminderRows]] = await Promise.all([
      req.user.role === "cliente" ? Promise.resolve([[{ total: 1 }]]) : pool.query("SELECT COUNT(*) total FROM customers WHERE active = 1"),
      pool.execute(`SELECT COUNT(*) total FROM pets${petWhere}`, params),
      pool.execute(`SELECT COUNT(*) total FROM appointments${where}${where ? " AND" : " WHERE"} DATE(scheduled_at) = CURRENT_DATE AND status <> 'cancelado'`, params),
      pool.execute(`SELECT COALESCE(SUM(amount_cents), 0) amount_cents, COUNT(*) total FROM payments${where}${where ? " AND" : " WHERE"} status IN ('pendente','atrasado')`, params),
      pool.execute(`SELECT COUNT(*) total FROM vaccines v JOIN pets p ON p.id = v.pet_id WHERE v.next_due_date <= DATE_ADD(CURRENT_DATE, INTERVAL 60 DAY) AND v.status <> 'aplicada'${vaccineWhere}`, params),
      pool.execute(`SELECT COUNT(*) total FROM reminders${where}${where ? " AND" : " WHERE"} due_at <= DATE_ADD(NOW(), INTERVAL 7 DAY) AND status = 'pendente'`, params),
      pool.execute(`SELECT a.id, a.pet_id, a.customer_id, a.service_type, a.scheduled_at, a.status, p.name pet_name, c.name customer_name FROM appointments a JOIN pets p ON p.id = a.pet_id JOIN customers c ON c.id = a.customer_id WHERE a.status <> 'cancelado' AND a.scheduled_at >= CURRENT_DATE${req.user.role === "cliente" ? " AND a.customer_id = ?" : ""} ORDER BY a.scheduled_at LIMIT 5`, params),
      pool.execute(`SELECT v.id, v.pet_id, v.name, v.next_due_date, v.status, p.name pet_name FROM vaccines v JOIN pets p ON p.id = v.pet_id WHERE v.next_due_date IS NOT NULL AND v.next_due_date <= DATE_ADD(CURRENT_DATE, INTERVAL 60 DAY) AND v.status <> 'aplicada'${vaccineWhere} ORDER BY v.next_due_date LIMIT 5`, params),
      pool.execute(`SELECT id, customer_id, pet_id, kind, message, due_at, status FROM reminders${where}${where ? " AND" : " WHERE"} due_at <= DATE_ADD(NOW(), INTERVAL 7 DAY) AND status = 'pendente' ORDER BY due_at LIMIT 5`, params),
    ]);
    res.json({
      customers: customers[0].total,
      pets: pets[0].total,
      appointments_today: appointments[0].total,
      open_payments: payments[0],
      due_vaccines: vaccines[0].total,
      upcoming_reminders: reminders[0].total,
      appointments: appointmentRows,
      vaccines: vaccineRows,
      reminders: reminderRows,
    });
  }));

  app.get("/api/portal", authenticate(pool), allow("admin", "cliente"), asyncRoute(async (req, res) => {
    let customerId = req.user.customer_id;
    if (req.user.role === "admin") {
      const check = input(req.query); customerId = check.positiveInt("customer_id"); assertValid(check);
    }
    const customer = await find(pool, "SELECT id, name, email, phone, address, notes FROM customers WHERE id = ? AND active = 1", [customerId], "Cliente");
    const [pets, vaccines, services, appointments, medicalNotes, payments, reminders] = await Promise.all([
      pool.execute("SELECT * FROM pets WHERE customer_id = ? AND active = 1 ORDER BY name", [customerId]),
      pool.execute("SELECT v.* FROM vaccines v JOIN pets p ON p.id = v.pet_id WHERE p.customer_id = ? ORDER BY v.application_date DESC", [customerId]),
      pool.execute("SELECT * FROM services WHERE customer_id = ? ORDER BY service_date DESC", [customerId]),
      pool.execute("SELECT * FROM appointments WHERE customer_id = ? ORDER BY scheduled_at DESC", [customerId]),
      pool.execute("SELECT m.* FROM medical_notes m JOIN pets p ON p.id = m.pet_id WHERE p.customer_id = ? ORDER BY m.created_at DESC", [customerId]),
      pool.execute("SELECT * FROM payments WHERE customer_id = ? ORDER BY due_date DESC", [customerId]),
      pool.execute("SELECT * FROM reminders WHERE customer_id = ? ORDER BY due_at", [customerId]),
    ]);
    res.json({ customer, pets: pets[0], vaccines: vaccines[0], services: services[0], appointments: appointments[0], medical_notes: medicalNotes[0], payments: payments[0], reminders: reminders[0] });
  }));

  app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada" }));
  app.use((error, _req, res, _next) => {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "E-mail já cadastrado" });
    const status = error.status || (error.type === "entity.parse.failed" ? 400 : 500);
    if (status >= 500) console.error(error);
    res.status(status).json({ error: status >= 500 ? "Erro interno" : error.message });
  });

  return app;
}
