export const STATUS_LABEL = { foreslagen: "Föreslagen", oppen: "Öppen", klar: "Klar", avvisad: "Avvisad" } as const;
export const PRIORITY_LABEL = { hog: "Hög", medel: "Medel", lag: "Låg" } as const;
export const SOURCE_LABEL = { manuell: "Manuell", protokoll: "Protokoll", tidplan: "Tidplan" } as const;
export const DOC_TYPE_LABEL = { schedule: "Tidplan", minutes: "Protokoll", requirements: "Krav", other: "Övrigt" } as const;
export const CONVERT_LABEL = { ok: "OK", needs_ocr: "Kräver OCR", unsupported: "Stöds ej", error: "Fel" } as const;

export const driveUrl = (fileId: string) => `https://drive.google.com/file/d/${fileId}/view`;

export const formatDateTime = (d: Date) =>
  new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Stockholm" }).format(d);
