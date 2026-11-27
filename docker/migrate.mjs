// Skapar/uppdaterar databastabellerna vid start av appen.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL saknas");
const client = postgres(url, { max: 1, onnotice: () => {} });
for (let attempt = 1; ; attempt++) {
  try {
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
    break;
  } catch (e) {
    if (attempt >= 10) throw e;
    console.log(`Databasen svarar inte än (försök ${attempt}), väntar…`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
await client.end();
console.log("Databasen är uppdaterad.");
