import mammoth from "mammoth";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

/** Gör om första raden i varje tabell till rubrikrad så att GFM-tabeller skapas. */
function promoteFirstRowToHeader(html: string): string {
  return html.replace(/<table>\s*(<tbody>)?\s*<tr>([\s\S]*?)<\/tr>/g, (_m, tbody: string | undefined, row: string) => {
    const header = row.replace(/<td(\s[^>]*)?>/g, "<th>").replace(/<\/td>/g, "</th>");
    return `<table><thead><tr>${header}</tr></thead>${tbody ?? ""}`;
  });
}

export function createTurndown(): TurndownService {
  const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced" });
  td.use(gfm);
  return td;
}

export async function docxToMarkdown(buf: Uint8Array): Promise<string> {
  const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(buf) });
  return createTurndown().turndown(promoteFirstRowToHeader(value)).trim();
}
