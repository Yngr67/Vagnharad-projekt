import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type PdfItem = { str: string; x: number; width: number };
export type PdfLine = { text: string; y: number; items: PdfItem[] };

const Y_TOLERANCE = 2;

/** Läser PDF:ens textlager och grupperar textbitarna till rader (per sida), sorterade efter x. */
export async function pdfToLines(buf: Uint8Array): Promise<PdfLine[][]> {
  const task = getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const doc = await task.promise;
  try {
    const pages: PdfLine[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const raw: (PdfItem & { y: number })[] = [];
      for (const it of content.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        raw.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width });
      }
      pages.push(groupLines(raw));
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

function groupLines(raw: (PdfItem & { y: number })[]): PdfLine[] {
  raw.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; items: PdfItem[] }[] = [];
  for (const it of raw) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= Y_TOLERANCE);
    const item = { str: it.str, x: it.x, width: it.width };
    if (line) line.items.push(item);
    else lines.push({ y: it.y, items: [item] });
  }
  lines.sort((a, b) => b.y - a.y);
  return lines.map((l) => {
    l.items.sort((a, b) => a.x - b.x);
    let text = "";
    let prevEnd = -Infinity;
    for (const it of l.items) {
      const s = it.str.trim();
      if (text && (it.x > prevEnd + 0.5 || /\s$/.test(it.str))) text += " ";
      text += s;
      prevEnd = it.x + it.width;
    }
    return { text: text.replace(/\s+/g, " ").trim(), y: l.y, items: l.items };
  });
}
