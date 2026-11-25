import { docxToMarkdown } from "./docx";
import { pdfToLines } from "./pdf-lines";

export type ConvertResult = { status: "ok" | "needs_ocr" | "unsupported"; markdown: string };

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIN_CHARS_PER_PAGE = 20;

/** Gör om en fil till Markdown. Kastar vid trasiga filer (anroparen sparar felet). */
export async function toMarkdown(buf: Uint8Array, mimeType: string): Promise<ConvertResult> {
  if (mimeType === DOCX) return { status: "ok", markdown: await docxToMarkdown(buf) };
  if (mimeType === "application/pdf") return pdfToMarkdown(buf);
  if (mimeType.startsWith("text/")) return { status: "ok", markdown: new TextDecoder().decode(buf) };
  return { status: "unsupported", markdown: "" };
}

async function pdfToMarkdown(buf: Uint8Array): Promise<ConvertResult> {
  const pages = await pdfToLines(buf);
  const chars = pages.flat().reduce((n, l) => n + l.text.replace(/\s/g, "").length, 0);
  if (pages.length === 0 || chars / pages.length < MIN_CHARS_PER_PAGE) {
    return { status: "needs_ocr", markdown: "" };
  }
  const markdown = pages
    .map((lines, i) => `## Sida ${i + 1}\n\n${lines.map((l) => l.text).join("\n")}`)
    .join("\n\n");
  return { status: "ok", markdown };
}
