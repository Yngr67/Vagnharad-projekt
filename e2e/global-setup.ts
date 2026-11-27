import postgres from "postgres";
import { makeFixtures } from "../tests/fixtures/make-fixtures";
import { createDb } from "../src/lib/db/client";
import { runMigrations } from "../src/lib/db/migrate";
import { E2E_DB } from "../playwright.config";

export default async function globalSetup(): Promise<void> {
  await makeFixtures();
  const admin = postgres("postgres://app:app@localhost:5432/projektstod", { max: 1, onnotice: () => {} });
  await admin.unsafe("drop database if exists projektstod_e2e with (force)");
  await admin.unsafe("create database projektstod_e2e");
  await admin.end();
  const { db, close } = createDb(E2E_DB);
  await runMigrations(db);
  await close();
}
