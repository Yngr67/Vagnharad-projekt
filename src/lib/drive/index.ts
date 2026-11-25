import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { FakeDriveClient, type FakeFile } from "./fake-client";
import { createGoogleDriveClient } from "./google-client";
import type { DriveClient } from "./types";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".md": "text/markdown",
  ".txt": "text/plain",
};

/** Väljer Drive-klient: riktig (service account) eller fejk (DRIVE_CLIENT=fake, för utveckling/test). */
export function getDriveClient(): DriveClient {
  if (process.env.DRIVE_CLIENT === "fake") return fakeFromDir(process.env.DRIVE_FAKE_DIR ?? "tests/fixtures/out");
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON saknas");
  return createGoogleDriveClient(json);
}

/** Fejk-Drive från en mapp med påhittade testfiler. Tidplaner hamnar i "Tidplaner", övrigt i "Möten". */
function fakeFromDir(dir: string): FakeDriveClient {
  const files: FakeFile[] = readdirSync(dir)
    .filter((n) => MIME[path.extname(n)] && n !== "scanned.pdf")
    .map((n) => {
      const isSchedule = n.startsWith("p6-");
      return {
        id: `fake-${n}`,
        name: isSchedule
          ? n.includes("v2") ? "XX99 Testtidplan okt.pdf" : "XX99 Testtidplan sep.pdf"
          : n.replace(/^protokoll/, "Protokoll byggmöte"),
        mimeType: MIME[path.extname(n)],
        folderPath: isSchedule ? "Tidplaner" : "Möten",
        modifiedTime: "2026-09-20T08:00:00Z",
        md5Checksum: `fake-${n}`,
        trashed: false,
        content: new Uint8Array(readFileSync(path.join(dir, n))),
      };
    });
  return new FakeDriveClient(files);
}
