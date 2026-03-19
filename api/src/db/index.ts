import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";

const queryClient = postgres(config.databaseUrl, { max: 10 });

export const db = drizzle(queryClient);

export async function verifyConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function closeConnection(): Promise<void> {
  await queryClient.end();
}
