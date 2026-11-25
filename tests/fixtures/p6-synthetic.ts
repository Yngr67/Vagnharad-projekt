// Helt påhittad tidplan som efterliknar layouten i en Primavera P6-utskrift.
// Inga riktiga namn, ID:n eller datum.

export const COL = { row: 20, id: 40, name: 120, remaining: 330, start: 370, finish: 430, bar: 500 };

export type FixtureRow =
  | { kind: "wbs"; n: number; level: number; idText: string; name: string; rem: number; start: string; finish: string }
  | {
      kind: "act";
      n: number;
      id: string;
      name: string;
      rem: number;
      start?: string;
      finish?: string;
      glued?: boolean;
      labelBelow?: boolean;
    }
  | { kind: "junk"; n: number; text: string };

export const PAGE_HEADER = [
  "Projekttidplan Testbana (Tb) - Testtidplan Avstämningslinje: 15-Sep-26",
  "Baseline: Testbana - Bas 1.0",
  "2026 2027 2028 2029",
];
export const PAGE_FOOTER = [
  "Remaining Level of Effort WBS Summary",
  "Actual Level of Effort Critical Remaining Work Milestone",
  "Project ID: XX99 Remaining Work Actual Work Milestone Comple...",
  "Utskriftsdatum: 20-Sep-26",
  "Layout Name: Testlayout",
];

export const PAGES: FixtureRow[][] = [
  [
    { kind: "wbs", n: 1, level: 0, idText: "Testbana", name: "Testbana", rem: 900, start: "01-Jan-25 A", finish: "30-Jun-29" },
    { kind: "wbs", n: 2, level: 1, idText: "Projektledning", name: "Projektledning", rem: 900, start: "01-Jan-25 A", finish: "30-Jun-29" },
    { kind: "act", n: 3, id: "Prv100", name: "Provmilstolpe start", rem: 0, start: "15-Sep-26" },
    { kind: "wbs", n: 4, level: 1, idText: "Upphandlings", name: "Upphandlingsarbete", rem: 120, start: "01-Feb-25 A", finish: "30-Apr-27" },
    { kind: "act", n: 5, id: "Prv110", name: "Ta fram förfrågningsunderlag", rem: 30, start: "01-Feb-25 A", finish: "10-Oct-26" },
    { kind: "act", n: 6, id: "Prv120", name: "Provmilstolpe underlag klart", rem: 0, finish: "10-Oct-26", labelBelow: true },
    { kind: "act", n: 7, id: "XY12 3400", name: "Anbudsdag testbro", rem: 0, finish: "20-Nov-26" },
    { kind: "act", n: 8, id: "B210-1120", name: "Överklagandetid testplan", rem: 25, start: "16-Feb-26 A", finish: "05-Nov-26", glued: true },
  ],
  [
    { kind: "wbs", n: 9, level: 1, idText: "Produktion", name: "Produktion", rem: 700, start: "01-Jun-27", finish: "30-Jun-29" },
    { kind: "act", n: 10, id: "Prv200", name: "Byggstart testbro", rem: 0, start: "01-Jun-27*" },
    { kind: "act", n: 11, id: "Prv210", name: "Bygga testbro", rem: 500, start: "02-Jun-27*", finish: "30-Jun-29" },
    { kind: "junk", n: 12, text: "?? oläsbar rad utan datum" },
    { kind: "act", n: 13, id: "Prv220", name: "Provmilstolpe slut", rem: 0, finish: "30-Jun-29" },
  ],
];

export const EXPECTED_ACTIVITY_COUNT = 8;
