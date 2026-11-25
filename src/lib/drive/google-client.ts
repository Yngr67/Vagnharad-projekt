import { drive as driveApi, type drive_v3 } from "@googleapis/drive";
import { JWT } from "google-auth-library";
import { GOOGLE_FOLDER, type DriveClient, type DriveFile } from "./types";

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const FIELDS = "nextPageToken, files(id, name, mimeType, modifiedTime, md5Checksum, trashed)";

/** Drive-klient med service account (endast läsrätt). */
export function createGoogleDriveClient(serviceAccountJson: string): DriveClient {
  const key = JSON.parse(serviceAccountJson) as { client_email: string; private_key: string };
  const auth = new JWT({ email: key.client_email, key: key.private_key, scopes: [SCOPE] });
  const api = driveApi({ version: "v3", auth });

  async function listChildren(folderId: string): Promise<drive_v3.Schema$File[]> {
    const out: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;
    do {
      const res = await api.files.list({
        q: `'${folderId}' in parents`,
        fields: FIELDS,
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      out.push(...(res.data.files ?? []));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return out;
  }

  return {
    async listTree(rootFolderId) {
      const result: DriveFile[] = [];
      const queue: { id: string; path: string }[] = [{ id: rootFolderId, path: "" }];
      while (queue.length) {
        const { id, path } = queue.shift()!;
        for (const f of await listChildren(id)) {
          if (!f.id || !f.name || !f.mimeType) continue;
          if (f.mimeType === GOOGLE_FOLDER) {
            if (!f.trashed) queue.push({ id: f.id, path: path ? `${path}/${f.name}` : f.name });
            continue;
          }
          result.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            folderPath: path,
            modifiedTime: f.modifiedTime ?? "",
            md5Checksum: f.md5Checksum ?? null,
            trashed: Boolean(f.trashed),
          });
        }
      }
      return result;
    },
    async download(id) {
      const res = await api.files.get({ fileId: id, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
      return new Uint8Array(res.data as ArrayBuffer);
    },
    async exportMarkdown(id) {
      const res = await api.files.export({ fileId: id, mimeType: "text/markdown" }, { responseType: "text" });
      return String(res.data);
    },
  };
}
