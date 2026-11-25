const FORMAT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dagens datum (YYYY-MM-DD) i svensk tid. */
export function todayInStockholm(now: Date = new Date()): string {
  return FORMAT.format(now);
}

/** Antal dagar från a till b (båda YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dagens datum för appen. APP_TODAY kan sättas i tester för ett fast datum. */
export function appToday(): string {
  const fixed = process.env.APP_TODAY;
  return fixed && /^\d{4}-\d{2}-\d{2}$/.test(fixed) ? fixed : todayInStockholm();
}
