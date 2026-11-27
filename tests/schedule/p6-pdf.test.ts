import { describe, it, expect, beforeAll } from "vitest";
import { pdfToLines, type PdfLine } from "@/lib/convert/pdf-lines";
import { parseP6Pdf, P6ParseError, type ParsedSchedule } from "@/lib/schedule/p6-pdf";
import { fixture } from "../helpers/fixtures";
import { EXPECTED_ACTIVITY_COUNT } from "../fixtures/p6-synthetic";

let pages: PdfLine[][];
let s: ParsedSchedule;
const act = (code: string) => s.activities.find((a) => a.activityCode === code);

beforeAll(async () => {
  pages = await pdfToLines(fixture("p6-synthetic.pdf"));
  s = parseP6Pdf(pages);
});

describe("parseP6Pdf", () => {
  it("reads header", () => {
    expect(s.projectCode).toBe("XX99");
    expect(s.dataDate).toBe("2026-09-15");
    expect(s.baselineName).toBe("Testbana - Bas 1.0");
    expect(s.printDate).toBe("2026-09-20");
  });

  it("reads activity with actual start", () => {
    expect(act("Prv110")).toMatchObject({
      name: "Ta fram förfrågningsunderlag",
      remainingDays: 30,
      startDate: "2025-02-01",
      startActual: true,
      finishDate: "2026-10-10",
      finishActual: false,
      isMilestone: false,
    });
  });

  it("reads glued code+name", () => {
    expect(act("B210-1120")?.name).toBe("Överklagandetid testplan");
  });

  it("reads code with space", () => {
    expect(act("XY12 3400")?.name).toBe("Anbudsdag testbro");
  });

  it("single-date milestone", () => {
    expect(act("Prv100")).toMatchObject({ isMilestone: true, startDate: "2026-09-15", finishDate: null });
    expect(act("Prv120")).toMatchObject({ isMilestone: true, startDate: null, finishDate: "2026-10-10" });
  });

  it("reads constrained date", () => {
    expect(act("Prv200")).toMatchObject({ constrained: true, startDate: "2027-06-01", isMilestone: true });
  });

  it("builds WBS path from doubled titles", () => {
    expect(act("Prv110")?.wbsPath).toEqual(["Testbana", "Upphandlingsarbete"]);
    expect(act("Prv210")?.wbsPath).toEqual(["Testbana", "Produktion"]);
  });

  it("ignores repeated page furniture", () => {
    expect(s.activities).toHaveLength(EXPECTED_ACTIVITY_COUNT);
    expect(s.activities.some((a) => /Sida|Remaining|Activity/.test(a.name))).toBe(false);
  });

  it("reports unparseable lines in unparsedLines", () => {
    expect(s.unparsedLines).toEqual(["12 ?? oläsbar rad utan datum"]);
  });

  it("throws P6ParseError without Project ID", () => {
    const noId = pages.map((p) => p.filter((l) => !l.text.includes("Project ID")));
    expect(() => parseP6Pdf(noId)).toThrow(P6ParseError);
  });
});
