import type { PdfLine } from "@/lib/convert/pdf-lines";
import { parseP6Date, P6_DATE_TOKEN, type P6Date } from "./dates";
import type { ParsedActivity, ParsedSchedule } from "./types";

export type { ParsedActivity, ParsedSchedule } from "./types";

export class P6ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "P6ParseError";
  }
}

/** Hela rader som bara är tidsaxel eller teckenförklaring (kan börja med siffror). */
const AXIS_LINES: RegExp[] = [/^(\d{4}\s*)+$/, /^(Q\d?\s*)+$/, /^(A\s*)+$/];

/** Sidhuvud, sidfot, kolumnrubriker och teckenförklaring. Gäller bara rader utan radnummer. */
const FURNITURE: RegExp[] = [
  /Avstämningslinje:/,
  /^Baseline:/,
  /^#(\s|$)/,
  /^Activity (ID|Name)/,
  /^((Remaining|Start|Finish|Duration)\s*)+$/,
  /Level of Effort/,
  /Critical Remaining Work/,
  /^Milestone/,
  /WBS Summary/,
  /^Sida \d+ av \d+/,
  /^Project ID:/,
  /^Remaining Work/,
  /^Actual Work/,
  /^Utskriftsdatum:/,
  /^Layout Name:/,
];

/** Aktivitets-ID: "Tls10010", "A3190", "A514-1120", "Tls-10810" eller "OL42 7440". */
const CODE = /^(?:([A-Z]{2}\d{2} \d{3,5})|([A-Za-z]{1,5}-?\d+(?:-\d+)?))(?=\s|[A-ZÅÄÖ]|$)/;

type Token = { s: string; x: number };

export function parseP6Pdf(pages: PdfLine[][]): ParsedSchedule {
  const all = pages.flat();
  const header = readHeader(all.map((l) => l.text));
  const columns = findDateColumns(all);

  const activities: ParsedActivity[] = [];
  const unparsedLines: string[] = [];
  const seen = new Set<string>();
  const wbs: { x: number; name: string }[] = [];
  let lastName = "";

  for (const line of all) {
    const text = line.text;
    if (!text || AXIS_LINES.some((re) => re.test(text))) continue;
    const tokens = tokenize(line);
    if (!/^\d+$/.test(tokens[0]?.s ?? "")) {
      if (FURNITURE.some((re) => re.test(text))) continue;
      if (lastName && isLabelOf(text, lastName)) continue;
      unparsedLines.push(text);
      continue;
    }
    const row = splitRow(tokens.slice(1), columns);
    if (!row) {
      unparsedLines.push(text);
      continue;
    }
    const body = row.body;
    const bodyText = body.map((t) => t.s).join(" ");
    const wbsName = wbsTitle(body.map((t) => t.s));
    if (wbsName !== null) {
      const x = body[0].x;
      while (wbs.length && wbs[wbs.length - 1].x >= x - 1) wbs.pop();
      wbs.push({ x, name: wbsName });
      lastName = wbsName;
      continue;
    }
    const m = CODE.exec(bodyText);
    if (!m) {
      unparsedLines.push(text);
      continue;
    }
    const activityCode = m[0];
    const name = bodyText.slice(activityCode.length).trim();
    if (seen.has(activityCode)) {
      unparsedLines.push(text);
      continue;
    }
    seen.add(activityCode);
    lastName = name;
    const { start, finish } = row;
    activities.push({
      activityCode,
      name,
      wbsPath: wbs.map((w) => w.name),
      remainingDays: row.remaining,
      startDate: start?.date ?? null,
      finishDate: finish?.date ?? null,
      startActual: start?.actual ?? false,
      finishActual: finish?.actual ?? false,
      constrained: Boolean(start?.constrained || finish?.constrained),
      isMilestone:
        row.remaining === 0 && (!start || !finish || start.date === finish.date),
    });
  }

  return { ...header, activities, unparsedLines };
}

function readHeader(texts: string[]): Omit<ParsedSchedule, "activities" | "unparsedLines"> {
  const find = (re: RegExp) => {
    for (const t of texts) {
      const m = re.exec(t);
      if (m) return m[1].trim();
    }
    return null;
  };
  const projectCode = find(/Project ID:\s*(\S+)/);
  if (!projectCode) throw new P6ParseError("Hittar inte 'Project ID:' i tidplanen");
  const dataRaw = find(/Avstämningslinje:\s*(\d{2}-[A-Z][a-z]{2}-\d{2})/);
  const dataDate = dataRaw ? parseP6Date(dataRaw)?.date : null;
  if (!dataDate) throw new P6ParseError("Hittar inte 'Avstämningslinje:' i tidplanen");
  const printRaw = find(/Utskriftsdatum:\s*(\d{2}-[A-Z][a-z]{2}-\d{2})/);
  return {
    projectCode,
    dataDate,
    baselineName: find(/^Baseline:\s*(.+?)(?:\s+#\s.*)?$/),
    printDate: printRaw ? (parseP6Date(printRaw)?.date ?? null) : null,
  };
}

/** x-läge för kolumnerna "Start" och "Finish" (för att placera ensamma datum). */
function findDateColumns(lines: PdfLine[]): { start: number; finish: number } | null {
  let start: number | null = null;
  let finish: number | null = null;
  for (const l of lines) {
    for (const it of l.items) {
      const s = it.str.trim();
      if (s === "Start" && start === null) start = it.x;
      if (s === "Finish" && finish === null) finish = it.x;
    }
    if (start !== null && finish !== null) return { start, finish };
  }
  return null;
}

/** Delar radens textbitar i ord med ungefärligt x-läge. */
function tokenize(line: PdfLine): Token[] {
  const out: Token[] = [];
  for (const it of line.items) {
    const str = it.str;
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(str))) {
      const x = it.x + (str.length ? (m.index / str.length) * it.width : 0);
      // Radnummer ihopskrivet med ID ("22Tls10010") förekommer inte; ord delas bara på blanksteg.
      out.push({ s: m[0], x });
    }
  }
  return out;
}

type Row = { body: Token[]; remaining: number; start: P6Date | null; finish: P6Date | null };

/** Hittar "kvarvarande dagar + datum" och returnerar texten före som radens kropp. */
function splitRow(tokens: Token[], cols: { start: number; finish: number } | null): Row | null {
  for (let i = 1; i < tokens.length; i++) {
    if (!P6_DATE_TOKEN.test(tokens[i].s) || !/^\d+$/.test(tokens[i - 1].s) || i - 1 === 0) continue;
    const body = tokens.slice(0, i - 1);
    const remaining = Number(tokens[i - 1].s);
    const dates: { d: P6Date; x: number }[] = [];
    let j = i;
    while (j < tokens.length && dates.length < 2 && P6_DATE_TOKEN.test(tokens[j].s)) {
      const actual = tokens[j + 1]?.s === "A";
      const d = parseP6Date(tokens[j].s + (actual ? " A" : ""));
      if (!d) break;
      dates.push({ d, x: tokens[j].x });
      j += actual ? 2 : 1;
    }
    if (dates.length === 0) return null;
    if (dates.length === 2) return { body, remaining, start: dates[0].d, finish: dates[1].d };
    const only = dates[0];
    const isStart = cols ? Math.abs(only.x - cols.start) < Math.abs(only.x - cols.finish) : false;
    return { body, remaining, start: isStart ? only.d : null, finish: isStart ? null : only.d };
  }
  return null;
}

/**
 * WBS-rubriker skrivs ut både i ID- och namnkolumnen ("Projektledning Projektledning",
 * ibland avkortat: "Upphandlings Upphandlingsarbete", eller ord för ord omväxlande).
 * Returnerar rubrikens namn, eller null om raden är en aktivitet.
 */
export function wbsTitle(words: string[]): string | null {
  if (words.length === 0) return null;
  // Halvor: första ordet återkommer längre fram → namnkolumnen börjar där.
  const again = words.indexOf(words[0], 1);
  if (again > 0) return words.slice(again).join(" ");
  // Avkortat ID följt av namn: "Upphandlings Upphandlingsarbete"
  if (words.length >= 2 && words[1].startsWith(words[0]) && !CODE.test(words.join(" "))) {
    return words.slice(1).join(" ");
  }
  // Omväxlande ord för ord: "Hantering Hantering kontrakt kontrakt"
  if (words.length % 2 === 0) {
    const pairs: string[] = [];
    for (let k = 0; k < words.length; k += 2) {
      const [a, b] = [words[k], words[k + 1]];
      if (a === b || b.startsWith(a)) pairs.push(b);
      else if (a.startsWith(b)) pairs.push(a);
      else return null;
    }
    return pairs.join(" ");
  }
  // Inga tecken på dubblering: inte en WBS-rubrik. Är det inte heller ett känt aktivitets-ID
  // hamnar raden bland "ej tolkade rader" i stället för att tyst bli en rubrik.
  return null;
}

/** Stapeletiketter i Gantt-delen upprepar aktivitetens (ev. avkortade) namn. */
function isLabelOf(text: string, name: string): boolean {
  return text === name || name.startsWith(text) || text.startsWith(name);
}
