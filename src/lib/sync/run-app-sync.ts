import { getDb } from "@/lib/db/client";
import { getDriveClient } from "@/lib/drive";
import { runSync, type SyncReport } from "./run-sync";

const DEFAULT_ROOT = "1lwRXzjFeMqyTWVt2iBrNuJHTtTvoovPJ";
let running: Promise<SyncReport> | null = null;

/** Kör synken med appens inställningar. Pågår redan en synk returneras samma körning. */
export function runAppSync(): Promise<SyncReport> {
  if (running) return running;
  running = runSync(getDb(), getDriveClient(), {
    rootFolderId: process.env.DRIVE_ROOT_FOLDER_ID || DEFAULT_ROOT,
  }).finally(() => {
    running = null;
  });
  return running;
}
