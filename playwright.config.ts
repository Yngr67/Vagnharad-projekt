import { defineConfig } from "@playwright/test";
import { scryptSync, randomBytes } from "node:crypto";

const PORT = 3100;
export const E2E_PASSWORD = "e2e-losenord-123";
const salt = randomBytes(16);
const e2eHash = `scrypt:${salt.toString("hex")}:${scryptSync(E2E_PASSWORD, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex")}`;

export const E2E_DB = "postgres://app:app@localhost:5432/projektstod_e2e";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: E2E_DB,
      DRIVE_CLIENT: "fake",
      DRIVE_FAKE_DIR: "tests/fixtures/out",
      APP_TODAY: "2026-11-10",
      APP_PASSWORD_HASH: e2eHash,
      SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-00",
      SYNC_TOKEN: "e2e-sync-token-0001",
      AI_ENABLED: "false",
    },
  },
});
