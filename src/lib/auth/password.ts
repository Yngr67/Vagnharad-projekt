import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Format: "scrypt:<salt-hex>:<hash-hex>". Inga $-tecken, så .env-läsare (Next, Docker) kan inte förvanska den.
const KEYLEN = 64;

function derive(plain: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(plain, salt, KEYLEN, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${(await derive(plain, salt)).toString("hex")}`;
}

/** Jämför ett lösenord i klartext med en hash från hashPassword. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const m = /^scrypt:([0-9a-f]{32}):([0-9a-f]{128})$/.exec(stored ?? "");
  if (!m) return false;
  const expected = Buffer.from(m[2], "hex");
  const actual = await derive(plain, Buffer.from(m[1], "hex"));
  return timingSafeEqual(actual, expected);
}
