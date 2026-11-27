import { describe, it, expect } from "vitest";
import { toMarkdown } from "@/lib/convert/to-markdown";
import { pdfToLines } from "@/lib/convert/pdf-lines";
import { fixture } from "../helpers/fixtures";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("toMarkdown", () => {
  it("docx keeps heading, list and table", async () => {
    const r = await toMarkdown(fixture("protokoll.docx"), DOCX);
    expect(r.status).toBe("ok");
    expect(r.markdown).toMatch(/^# Mötesprotokoll testmöte/m);
    expect(r.markdown).toMatch(/^-\s+Kontrollera provmilstolpen/m);
    expect(r.markdown).toMatch(/\| --- \|/);
    expect(r.markdown).toContain("Testperson B");
  });

  it("pdf with text becomes markdown with page headings", async () => {
    const r = await toMarkdown(fixture("p6-synthetic.pdf"), "application/pdf");
    expect(r.status).toBe("ok");
    expect(r.markdown).toContain("## Sida 1");
    expect(r.markdown).toContain("## Sida 2");
    expect(r.markdown).toContain("Provmilstolpe start");
  });

  it("pdf without text is needs_ocr", async () => {
    const r = await toMarkdown(fixture("scanned.pdf"), "application/pdf");
    expect(r.status).toBe("needs_ocr");
  });

  it("text passes through", async () => {
    const r = await toMarkdown(new TextEncoder().encode("# Rubrik\n\nText"), "text/markdown");
    expect(r).toEqual({ status: "ok", markdown: "# Rubrik\n\nText" });
  });

  it("unknown mime is unsupported", async () => {
    const r = await toMarkdown(new Uint8Array([1, 2, 3]), "image/png");
    expect(r.status).toBe("unsupported");
  });
});

describe("pdfToLines", () => {
  it("groups items into lines sorted by x with positions", async () => {
    const pages = await pdfToLines(fixture("p6-synthetic.pdf"));
    expect(pages).toHaveLength(2);
    const row = pages[0].find((l) => l.text.startsWith("3 Prv100"));
    expect(row?.text).toBe("3 Prv100 Provmilstolpe start 0 15-Sep-26 Provmilstolpe start");
    expect(row?.items[0]).toMatchObject({ str: "3" });
    expect(row?.items[1].x).toBeCloseTo(40, 0);
  });
});
