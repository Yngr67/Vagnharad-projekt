import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getOverview, type ActionStatus, type Milestone, STALE_AFTER_DAYS } from "@/lib/overview/get-overview";
import { appToday } from "@/lib/overview/today";
import { getActiveProject, getFilterOptions } from "@/lib/projects";
import { DOC_TYPE_LABEL, STATUS_LABEL, driveUrl, formatDateTime } from "@/lib/labels";
import { Card, Empty, Stat, buttonClass, inputClass, linkClass } from "@/components/ui";

export const dynamic = "force-dynamic";

type Search = { projekt?: string; ansvarig?: string; status?: string; delprojekt?: string };
const STATUSES = ["oppen", "klar"] as const;

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const db = getDb();
  const project = await getActiveProject(db, sp.projekt);
  if (!project) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Översikt</h1>
        <Empty>Ingen tidplan är inläst ännu. Tryck på ”Synka nu” uppe till höger för att hämta filerna från Drive.</Empty>
      </div>
    );
  }
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as ActionStatus) : undefined;
  const today = appToday();
  const o = await getOverview(db, {
    projectId: project.id,
    today,
    owner: sp.ansvarig || undefined,
    status,
    subproject: sp.delprojekt || undefined,
  });
  const options = await getFilterOptions(db, project.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {project.name} <span className="text-neutral-500">({project.code})</span>
          </h1>
          {o.version ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              tidplan per {o.version.dataDate} ({o.version.ageDays} dagar gammal) · idag {today}
              {o.version.stale && (
                <span className="ml-2 rounded bg-amber-200 px-2 py-0.5 text-amber-900">
                  ⚠ äldre än {STALE_AFTER_DAYS} dagar – be om en ny tidplan
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-neutral-500">Ingen tidplan inläst för projektet.</p>
          )}
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3 text-sm" method="get">
        <label className="flex flex-col">
          Ansvarig
          <select name="ansvarig" defaultValue={sp.ansvarig ?? ""} className={inputClass}>
            <option value="">Alla</option>
            {options.owners.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          Status
          <select name="status" defaultValue={status ?? ""} className={inputClass}>
            <option value="">Öppna och klara</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          Delprojekt
          <input name="delprojekt" list="delprojekt" defaultValue={sp.delprojekt ?? ""} className={inputClass} />
          <datalist id="delprojekt">
            {options.subprojects.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>
        <button className={buttonClass}>Filtrera</button>
        <Link href="/" className={linkClass}>
          Rensa
        </Link>
      </form>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Öppna actions" value={o.actionCounts.open} />
        <Stat label="Försenade" value={o.actionCounts.overdue} tone="warn" />
        <Stat label="Klara" value={o.actionCounts.done} tone="ok" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Milstolpar närmaste 14 dagarna" testId="upcoming-milestones">
          <MilestoneList items={o.upcomingMilestones} empty="Inga milstolpar de närmaste 14 dagarna." />
        </Card>
        <Card title="Passerade utan rapporterat utfall" testId="passed-milestones">
          <MilestoneList
            items={o.passedWithoutActual}
            empty="Inga – alla passerade milstolpar har rapporterats i tidplanen."
            warn
          />
          {o.passedWithoutActual.length > 0 && (
            <p className="mt-2 text-xs text-neutral-500">
              Datumet har passerat efter tidplanens avstämning. Kontrollera om milstolpen klarats.
            </p>
          )}
        </Card>
        <Card title="Senast synkade dokument">
          {o.recentDocuments.length === 0 ? (
            <Empty>Inga dokument ännu.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {o.recentDocuments.map((d) => (
                <li key={d.id} className="flex justify-between gap-2">
                  <a href={driveUrl(d.driveFileId)} target="_blank" rel="noreferrer" className={linkClass}>
                    {d.name}
                  </a>
                  <span className="shrink-0 text-neutral-500">
                    {DOC_TYPE_LABEL[d.docType]} · {formatDateTime(d.lastSyncedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Nyligen tillagda actions">
          {o.recentActions.length === 0 ? (
            <Empty>Inga actions.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {o.recentActions.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span>{a.title}</span>
                  <span className="shrink-0 text-neutral-500">
                    {a.owner ?? "–"} · {a.dueDate ?? "ingen deadline"} · {STATUS_LABEL[a.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function MilestoneList({ items, empty, warn }: { items: Milestone[]; empty: string; warn?: boolean }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="space-y-1 text-sm">
      {items.map((m) => (
        <li key={m.activityCode} className="flex gap-3">
          <span className={`shrink-0 tabular-nums ${warn ? "text-red-600" : ""}`}>{m.date}</span>
          <span>
            {m.name} <span className="text-neutral-500">({m.activityCode})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
