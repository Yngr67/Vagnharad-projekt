import bcrypt from "bcryptjs";

/** Jämför ett lösenord i klartext med en bcrypt-hash. */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}
