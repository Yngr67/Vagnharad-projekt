import { readFileSync } from "node:fs";
import path from "node:path";

export const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(path.resolve(__dirname, "../fixtures/out", name)));
