import type { DriveFile } from "@/lib/drive/types";

export type DocType = "schedule" | "minutes" | "requirements" | "other";

export function classify(file: DriveFile): DocType {
  if (/(^|\/)Tidplaner(\/|$)/i.test(file.folderPath)) return "schedule";
  if (/protokoll|minnesanteckning/i.test(file.name)) return "minutes";
  if (/krav/i.test(file.folderPath)) return "requirements";
  return "other";
}
