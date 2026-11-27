import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { actions } from "@/lib/db/schema";
import { getActiveProject } from "@/lib/projects";
import { listActivities, listVersions, listWbsNames } from "@/lib/schedule/queries";
import { appToday } from "@/lib/overview/today";
import { Gantt } from "@/components/gantt";
import { Empty, buttonClass, inputClass } from "@/components/ui";
import { createFromActivity } from "./server-actions";

export const dynamic = "force-dynamic";

type Search = { projekt?: string; version?: string; wbs?: string; milstolpar?: string; fran?: string; till?: string; q?: string };
const isDate = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const db = getDb();
  const project = await getActiveProject(db, sp.projekt);
  const versions = project ? await listVersions(db, project.id) : [];
  if (!project || versions.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Tidplan</h1>
        <Empty>Ingen tidplan är inläst ännu.</Empty>
      </div>
    );
  }
  const version = versions.find((v) => String(v.id) === sp.version) ?? versions[0];
  const filters = {
    milestonesOnly: sp.milstolpar === "on",
    wbs: sp.wbs || undefined,
    from: isDate(sp.fran),
    to: isDate(sp.till),
    q: sp.q?.trim() || undefined,
  };
  const [rows, wbsNames, linked] = await Promise.all([
    listActivities(db, version.id, filters),
    listWbsNames(db, version.id),
    db
      .select({ code: actions.activityCode })
      .from(actions)
      .where(and(eq(actions.projectId, project.id), isNotNull(actions.activityCode))),
  ]);
  const hasAction = new Set(linked.map((l) => l.code));
  const today = appToday();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Tidplan – {project.code}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Avstämningsdatum {version.dataDate} · {version.documentName}
          {version.baselineName && ` · Baslinje: ${version.baselineName}`}
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col">
          Tidplanversion
          <select name="version" defaultValue={String(version.id)} className={inputClass}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.dataDate} – {v.documentName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          WBS
          <select name="wbs" defaultValue={filters.wbs ?? ""} className={inputClass}>
            <option value="">Alla</option>
            {wbsNames.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          Från
          <input type="date" name="fran" defaultValue={filters.from} className={inputClass} />
        </label>
        <label className="flex flex-col">
          Till
          <input type="date" name="till" defaultValue={filters.to} className={inputClass} />
        </label>
        <label className="flex flex-col">
          Sök
          <input name="q" defaultValue={filters.q} className={inputClass} />
        </label>
        <label className="flex items-center gap-1 pb-1">
          <input type="checkbox" name="milstolpar" defaultChecked={filters.milestonesOnly} /> Bara milstolpar
        </label>
        <button className={buttonClass}>Visa</button>
      </form>

      <p className="text-sm text-neutral-500">{rows.length} aktiviteter</p>
      <Gantt rows={rows} dataDate={version.dataDate} today={today} />

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr>
              <th className="py-2 pr-3">ID</th>
              <th className="py-2 pr-3">Namn</th>
              <th className="py-2 pr-3">WBS</th>
              <th className="py-2 pr-3">Start</th>
              <th className="py-2 pr-3">Slut</th>
              <th className="py-2 pr-3">Kvar</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-200 align-top dark:border-neutral-800">
                <td className="py-1.5 pr-3 whitespace-nowrap font-mono text-xs">{r.activityCode}</td>
                <td className="py-1.5 pr-3">
                  {r.isMilestone && <span title="Milstolpe">◆ </span>}
                  {r.name}
                </td>
                <td className="py-1.5 pr-3 text-neutral-500">{r.wbsPath.at(-1) ?? ""}</td>
                <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">
                  {r.startDate ?? ""} {r.startActual && <abbr title="Utfall (startad)">A</abbr>}
                  {r.constrained && <abbr title="Låst datum">*</abbr>}
                </td>
                <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">
                  {r.finishDate ?? ""} {r.finishActual && <abbr title="Utfall (klar)">A</abbr>}
                </td>
                <td className="py-1.5 pr-3 tabular-nums">{r.remainingDays ?? ""}</td>
                <td className="py-1.5 whitespace-nowrap">
                  {hasAction.has(r.activityCode) ? (
                    <span className="text-xs text-neutral-500">Action finns</span>
                  ) : (
                    <form action={createFromActivity}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="versionId" value={version.id} />
                      <input type="hidden" name="activityCode" value={r.activityCode} />
                      <button className="text-xs text-blue-700 hover:underline dark:text-blue-400">Skapa action</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
