import jwt from "jsonwebtoken";

export const COOKIE_NAME = "petcare_session";

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error("JWT_SECRET deve ter pelo menos 32 caracteres");
  return value;
}

export function issueToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, customer_id: user.customer_id ?? null },
    secret(),
    { algorithm: "HS256", expiresIn: "8h", issuer: "petcare-api", audience: "petcare-web" },
  );
}

export function decodeSession(token) {
  const payload = jwt.verify(token, secret(), {
    algorithms: ["HS256"],
    issuer: "petcare-api",
    audience: "petcare-web",
  });
  return { id: Number(payload.sub), role: payload.role, customer_id: payload.customer_id ?? null };
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  };
}

export function authenticate(pool) {
  return async (req, res, next) => {
    try {
      const raw = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
      if (!raw) return res.status(401).json({ error: "Autenticação necessária" });
      const tokenUser = decodeSession(decodeURIComponent(raw.slice(COOKIE_NAME.length + 1)));
      const [rows] = await pool.execute(
        "SELECT id, role, customer_id, active FROM users WHERE id = ? LIMIT 1",
        [tokenUser.id],
      );
      const currentUser = rows[0];
      if (!currentUser?.active) return res.status(401).json({ error: "Sessão inválida ou expirada" });
      req.user = { id: currentUser.id, role: currentUser.role, customer_id: currentUser.customer_id };
      next();
    } catch {
      res.status(401).json({ error: "Sessão inválida ou expirada" });
    }
  };
}

export function allow(...allowed) {
  return (req, res, next) => allowed.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: "Acesso não permitido" });
}

export function customerScope(user, column = "customer_id") {
  if (user.role !== "cliente") return { sql: "", params: [] };
  if (!user.customer_id) {
    const error = new Error("Usuário cliente sem cadastro vinculado");
    error.status = 403;
    throw error;
  }
  return { sql: ` WHERE ${column} = ?`, params: [user.customer_id] };
}
