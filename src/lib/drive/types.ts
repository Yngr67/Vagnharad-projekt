export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  /** Mappväg under rotmappen, t.ex. "Tidplaner" eller "Möten/2026". Tom sträng = rotmappen. */
  folderPath: string;
  modifiedTime: string;
  md5Checksum: string | null;
  trashed: boolean;
};

export interface DriveClient {
  listTree(rootFolderId: string): Promise<DriveFile[]>;
  download(id: string): Promise<Uint8Array>;
  exportMarkdown(id: string): Promise<string>;
}

export const GOOGLE_DOC = "application/vnd.google-apps.document";
export const GOOGLE_FOLDER = "application/vnd.google-apps.folder";
