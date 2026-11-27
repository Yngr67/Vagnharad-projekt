import type { ScheduleActivityRow } from "@/lib/db/schema";

const DAY = 86_400_000;
const t = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** Enkelt Gantt-diagram: staplar för aktiviteter, romber för milstolpar, linjer för avstämning och idag. */
export function Gantt({ rows, dataDate, today }: { rows: ScheduleActivityRow[]; dataDate: string; today: string }) {
  const dated = rows.filter((r) => r.startDate || r.finishDate);
  if (dated.length === 0) return null;
  const dates = dated.flatMap((r) => [r.startDate, r.finishDate].filter((d): d is string => Boolean(d)));
  dates.push(dataDate, today);
  const min = Math.min(...dates.map(t)) - 7 * DAY;
  const max = Math.max(...dates.map(t)) + 7 * DAY;
  const pct = (d: string) => `${(((t(d) - min) / (max - min)) * 100).toFixed(2)}%`;
  const years: number[] = [];
  for (let y = new Date(min).getUTCFullYear() + 1; y <= new Date(max).getUTCFullYear(); y++) years.push(y);

  return (
    <div className="relative overflow-hidden rounded border border-neutral-300 dark:border-neutral-700" aria-label="Gantt-diagram">
      <div className="relative h-5 border-b border-neutral-300 text-[10px] text-neutral-500 dark:border-neutral-700">
        {years.map((y) => (
          <span key={y} className="absolute top-0.5 -translate-x-1/2" style={{ left: pct(`${y}-01-01`) }}>
            {y}
          </span>
        ))}
      </div>
      <div className="relative">
        <Line left={pct(dataDate)} className="bg-blue-500" title={`Avstämning ${dataDate}`} />
        <Line left={pct(today)} className="bg-red-500" title={`Idag ${today}`} />
        {dated.map((r) => {
          const s = r.startDate ?? r.finishDate!;
          const f = r.finishDate ?? r.startDate!;
          const done = r.finishActual;
          return (
            <div key={r.id} className="relative h-5" title={`${r.activityCode} ${r.name}: ${s} – ${f}`}>
              {r.isMilestone ? (
                <span
                  className={`absolute top-1 h-3 w-3 -translate-x-1/2 rotate-45 ${done || r.startActual ? "bg-neutral-400" : "bg-neutral-900 dark:bg-neutral-100"}`}
                  style={{ left: pct(f) }}
                />
              ) : (
                <span
                  className={`absolute top-1 h-3 rounded-sm ${done ? "bg-neutral-400" : r.startActual ? "bg-green-600" : "bg-sky-600"}`}
                  style={{ left: pct(s), width: `max(2px, calc(${pct(f)} - ${pct(s)}))` }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 border-t border-neutral-300 px-2 py-1 text-[11px] text-neutral-500 dark:border-neutral-700">
        <span><span className="inline-block h-2 w-3 bg-blue-500" /> avstämning</span>
        <span><span className="inline-block h-2 w-3 bg-red-500" /> idag</span>
        <span><span className="inline-block h-2 w-3 bg-green-600" /> pågår</span>
        <span><span className="inline-block h-2 w-3 bg-sky-600" /> ej startad</span>
      </div>
    </div>
  );
}

function Line({ left, className, title }: { left: string; className: string; title: string }) {
  return <div title={title} className={`absolute top-0 bottom-0 z-10 w-px ${className}`} style={{ left }} />;
}
