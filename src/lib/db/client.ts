import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

let cached: Db | undefined;

/** Returnerar en delad Drizzle-instans mot DATABASE_URL. */
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL saknas");
  cached = createDb(url).db;
  return cached;
}

export function createDb(url: string): { db: Db; close: () => Promise<void> } {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  return { db: drizzle(client, { schema }), close: () => client.end() };
}
