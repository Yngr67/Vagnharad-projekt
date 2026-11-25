import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";
import { COL, PAGES, PAGE_FOOTER, PAGE_HEADER, type FixtureRow } from "./p6-synthetic";

export const OUT = path.resolve(__dirname, "out");

async function makeP6Pdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const size = 7;
  for (const [pi, rows] of PAGES.entries()) {
    const page = pdf.addPage([842, 595]);
    let y = 570;
    const text = (s: string, x: number, yy = y) => page.drawText(s, { x, y: yy, size, font, color: rgb(0, 0, 0) });
    for (const h of PAGE_HEADER) {
      text(h, COL.row);
      y -= 12;
    }
    // kolumnrubriker
    text("#", COL.row);
    text("Activity ID", COL.id);
    text("Activity Name", COL.name);
    text("Remaining", COL.remaining);
    text("Start", COL.start);
    text("Finish", COL.finish);
    y -= 9;
    text("Duration", COL.remaining);
    y -= 12;
    text("A A A A A A A A", COL.bar);
    y -= 12;
    for (const r of rows) drawRow(r, text, () => (y -= 11), () => y);
    y = 60;
    for (const f of PAGE_FOOTER) {
      text(f, COL.row);
      y -= 10;
    }
    text(`Sida ${pi + 1} av ${PAGES.length}`, 700, 30);
  }
  return pdf.save();
}

function drawRow(
  r: FixtureRow,
  text: (s: string, x: number, y?: number) => void,
  next: () => void,
  y: () => number,
) {
  text(String(r.n), COL.row);
  if (r.kind === "junk") {
    text(r.text, COL.id);
  } else if (r.kind === "wbs") {
    text(r.idText, COL.id + r.level * 8);
    text(r.name, COL.name + r.level * 8);
    text(String(r.rem), COL.remaining);
    text(r.start, COL.start);
    text(r.finish, COL.finish);
  } else {
    if (r.glued) text(`${r.id}${r.name}`, COL.id);
    else {
      text(r.id, COL.id);
      text(r.name, COL.name);
    }
    text(String(r.rem), COL.remaining);
    if (r.start) text(r.start, COL.start);
    if (r.finish) text(r.finish, COL.finish);
    if (r.labelBelow) {
      text(r.name, COL.bar, y() - 6);
      next();
    } else text(r.name, COL.bar);
  }
  next();
}

async function makeScannedPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  page.drawRectangle({ x: 50, y: 50, width: 400, height: 600, color: rgb(0.8, 0.8, 0.8) });
  return pdf.save();
}

async function makeDocx(): Promise<Buffer> {
  const cell = (s: string) => new TableCell({ children: [new Paragraph(s)] });
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Mötesprotokoll testmöte", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun("Närvarande: Testperson A")] }),
          new Paragraph({ text: "Kontrollera provmilstolpen", bullet: { level: 0 } }),
          new Paragraph({ text: "Skicka underlag", bullet: { level: 0 } }),
          new Table({
            rows: [
              new TableRow({ children: [cell("Action"), cell("Ansvarig"), cell("Klart")] }),
              new TableRow({ children: [cell("Boka möte"), cell("Testperson B"), cell("2026-12-01")] }),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

export async function makeFixtures(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, "p6-synthetic.pdf"), await makeP6Pdf());
  writeFileSync(path.join(OUT, "scanned.pdf"), await makeScannedPdf());
  writeFileSync(path.join(OUT, "protokoll.docx"), await makeDocx());
}

export default async function globalSetup(): Promise<void> {
  await makeFixtures();
}
