import { existsSync } from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Db } from "./client";

export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

/** Kör alla migreringar. Utan journal (inga migreringar ännu) görs inget. */
export async function runMigrations(db: Db): Promise<void> {
  if (!existsSync(path.join(MIGRATIONS_FOLDER, "meta", "_journal.json"))) return;
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
