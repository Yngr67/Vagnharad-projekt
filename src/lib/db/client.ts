import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let cached: { db: Db; close: () => Promise<void> } | undefined;

/** Returnerar en delad Drizzle-instans mot DATABASE_URL. */
export function getDb(): Db {
  if (cached) return cached.db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL saknas");
  cached = createDb(url);
  return cached.db;
}

export async function closeDb(): Promise<void> {
  await cached?.close();
  cached = undefined;
}

export function createDb(url: string): { db: Db; close: () => Promise<void> } {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
