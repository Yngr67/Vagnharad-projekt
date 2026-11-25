import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { getDriveClient } from "@/lib/drive";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

function fakeKey(): string {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return JSON.stringify({
    client_email: "test@example.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  });
}

describe("getDriveClient", () => {
  it("reads the service account from GOOGLE_SERVICE_ACCOUNT_FILE", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sa-"));
    const file = path.join(dir, "sa.json");
    writeFileSync(file, fakeKey());
    delete process.env.DRIVE_CLIENT;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE = file;
    expect(typeof getDriveClient().listTree).toBe("function");
  });

  it("throws a clear error when no credentials are configured", () => {
    delete process.env.DRIVE_CLIENT;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
    expect(() => getDriveClient()).toThrow(/GOOGLE_SERVICE_ACCOUNT/);
  });
});
