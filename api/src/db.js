import mysql from "mysql2/promise";

export function createPool() {
  return mysql.createPool({
    host: process.env.DB_HOST || "mysql",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "petcare",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "petcare",
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    decimalNumbers: true,
  });
}

export async function waitForDatabase(pool, attempts = 20) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError;
}
