import type { DriveClient, DriveFile } from "./types";

export type FakeFile = DriveFile & { content: Uint8Array | string };

/** Drive-klient i minnet för tester och lokal utveckling. */
export class FakeDriveClient implements DriveClient {
  private files: FakeFile[];

  constructor(files: FakeFile[]) {
    this.files = files;
  }

  setFiles(files: FakeFile[]): void {
    this.files = files;
  }

  async listTree(): Promise<DriveFile[]> {
    return this.files.map(({ content: _c, ...f }) => f);
  }

  async download(id: string): Promise<Uint8Array> {
    const c = this.get(id).content;
    return typeof c === "string" ? new TextEncoder().encode(c) : c;
  }

  async exportMarkdown(id: string): Promise<string> {
    const c = this.get(id).content;
    return typeof c === "string" ? c : new TextDecoder().decode(c);
  }

  private get(id: string): FakeFile {
    const f = this.files.find((x) => x.id === id);
    if (!f) throw new Error(`Filen ${id} finns inte`);
    return f;
  }
}
