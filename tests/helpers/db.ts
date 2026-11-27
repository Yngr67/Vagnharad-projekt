import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { createDb, type Db } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";

export type TestDb = { db: Db; url: string; cleanup: () => Promise<void> };

/** Skapar en egen, tom testdatabas med migreringar körda. Tas bort vid cleanup. */
export async function setupTestDb(): Promise<TestDb> {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) throw new Error("TEST_DATABASE_URL saknas");
  const name = `t_${randomBytes(6).toString("hex")}`;
  const admin = postgres(base, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  const u = new URL(base);
  u.pathname = `/${name}`;
  const { db, close } = createDb(u.toString());
  await runMigrations(db);
  return {
    db,
    url: u.toString(),
    cleanup: async () => {
      await close();
      await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}
