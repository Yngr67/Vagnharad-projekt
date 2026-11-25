// Användning: echo -n 'ditt-lösenord' | npx tsx scripts/hash-password.ts
import bcrypt from "bcryptjs";

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  const pw = input.replace(/\r?\n$/, "");
  if (pw.length < 8) {
    console.error("Lösenordet måste vara minst 8 tecken.");
    process.exit(1);
  }
  console.log(bcrypt.hashSync(pw, 12));
});
