import { createApp } from "./app.js";
import { createPool, waitForDatabase } from "./db.js";

const port = Number(process.env.PORT || 3000);
if (!process.env.DB_PASSWORD) throw new Error("DB_PASSWORD é obrigatório");
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET deve ter pelo menos 32 caracteres");

const pool = createPool();
await waitForDatabase(pool);
createApp(pool).listen(port, "0.0.0.0", () => console.log(`PetCare API ouvindo na porta ${port}`));
