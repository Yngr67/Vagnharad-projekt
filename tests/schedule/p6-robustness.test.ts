import { describe, it, expect } from "vitest";
import type { PdfLine } from "@/lib/convert/pdf-lines";
import { parseP6Pdf } from "@/lib/schedule/p6-pdf";

/** Bygger en rad där varje ord blir en egen textbit med växande x. */
function line(text: string, x0 = 20): PdfLine {
  let x = x0;
  const items = text.split(" ").map((str) => {
    const it = { str, x, width: str.length * 3 };
    x += str.length * 3 + 3;
    return it;
  });
  return { text, y: 0, items };
}

const header = [
  line("Projekttidplan Test Avstämningslinje: 01-Oct-26"),
  line("Project ID: XX98"),
];

describe("P6 parser robustness (final review)", () => {
  it("unrecognised activity id goes to unparsedLines and does not become WBS", () => {
    const s = parseP6Pdf([
      [
        ...header,
        line("1 Testbana Testbana 100 01-Jan-26 A 30-Jun-27"),
        line("2 1000 Schakt för ledning 5 01-Oct-26 12-Oct-26"),
        line("3 Prv300 Gjuta platta 10 13-Oct-26 30-Oct-26"),
      ],
    ]);
    expect(s.unparsedLines).toEqual(["2 1000 Schakt för ledning 5 01-Oct-26 12-Oct-26"]);
    expect(s.activities.map((a) => [a.activityCode, a.wbsPath])).toEqual([["Prv300", ["Testbana"]]]);
  });

  it("row-numbered activity containing legend words is kept", () => {
    const s = parseP6Pdf([[...header, line("9 A1060 WBS Summary rapport 5 01-Oct-26 12-Oct-26")]]);
    expect(s.activities.map((a) => a.name)).toEqual(["WBS Summary rapport"]);
    expect(s.unparsedLines).toEqual([]);
  });

  it("year and legend lines are still ignored", () => {
    const s = parseP6Pdf([[...header, line("2026 2027 2028"), line("A A A A"), line("Q1 Q2 Q3 Q4")]]);
    expect(s.unparsedLines).toEqual([]);
  });
});
