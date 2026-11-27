// Användning: echo -n 'ditt-lösenord' | npx tsx scripts/hash-password.ts
import { hashPassword } from "../src/lib/auth/password";

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", async () => {
  const pw = input.replace(/\r?\n$/, "");
  if (pw.length < 8) {
    console.error("Lösenordet måste vara minst 8 tecken.");
    process.exit(1);
  }
  console.log(await hashPassword(pw));
});
