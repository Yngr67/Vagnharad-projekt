const MONTHS: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

export type P6Date = { date: string; actual: boolean; constrained: boolean };

export const P6_DATE_TOKEN = /^\d{2}-[A-Z][a-z]{2}-\d{2}\*?$/;

/** Tolkar P6-datum som "05-Nov-26", "03-Dec-24 A" eller "03-May-27*". */
export function parseP6Date(s: string): P6Date | null {
  const m = /^(\d{2})-([A-Z][a-z]{2})-(\d{2})(\*)?(?:\s+A)?(\*)?$/.exec(s.trim());
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (!month) return null;
  const day = Number(m[1]);
  const year = 2000 + Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return {
    date: d.toISOString().slice(0, 10),
    actual: /\sA\*?$/.test(s.trim()),
    constrained: Boolean(m[4] || m[5]),
  };
}
