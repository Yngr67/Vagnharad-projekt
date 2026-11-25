import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { createDb } from "../src/lib/db/client";
import { runMigrations } from "../src/lib/db/migrate";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL saknas");
const { db, close } = createDb(url);
runMigrations(db)
  .then(() => console.log("Migreringar klara"))
  .finally(close);
