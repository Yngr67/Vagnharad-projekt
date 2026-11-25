// Kontroll av tidplanläsaren mot en riktig P6-PDF (filen checkas aldrig in).
// Användning: npx tsx scripts/dev-parse.ts /sökväg/till/tidplan.pdf
import { readFileSync } from "node:fs";
import { pdfToLines } from "../src/lib/convert/pdf-lines";
import { parseP6Pdf } from "../src/lib/schedule/p6-pdf";

const file = process.argv[2];
if (!file) {
  console.error("Ange sökväg till en PDF.");
  process.exit(1);
}
pdfToLines(new Uint8Array(readFileSync(file))).then((pages) => {
  const s = parseP6Pdf(pages);
  console.log(`Projekt: ${s.projectCode}  Avstämning: ${s.dataDate}  Baslinje: ${s.baselineName}`);
  console.log(`Aktiviteter: ${s.activities.length}  Milstolpar: ${s.activities.filter((a) => a.isMilestone).length}`);
  console.log(`WBS-grupper: ${new Set(s.activities.map((a) => a.wbsPath.join(" / "))).size}`);
  console.log(`Ej tolkade rader (${s.unparsedLines.length}):`);
  for (const l of s.unparsedLines) console.log(`  ${l}`);
  if (process.argv.includes("--lines")) for (const l of pages.flat()) console.log(l.text);
});
