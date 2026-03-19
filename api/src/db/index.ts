import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../config.js";

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

export const db = drizzle({ client: pool });

export async function verifyConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function closeConnection(): Promise<void> {
  await pool.end();
}
