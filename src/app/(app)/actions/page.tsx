import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listActions } from "@/lib/actions/service";
import { getActiveProject, getFilterOptions } from "@/lib/projects";
import { appToday } from "@/lib/overview/today";
import { PRIORITY_LABEL, SOURCE_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { ActionRow } from "@/lib/db/schema";
import { Empty, buttonClass, inputClass, linkClass } from "@/components/ui";
import { addAction, approve, closeAction, editAction, reject, reopenAction } from "./server-actions";

export const dynamic = "force-dynamic";

type Search = { projekt?: string; flik?: string; ansvarig?: string; status?: string; delprojekt?: string };
const STATUSES = ["oppen", "klar", "avvisad"] as const;

export default async function ActionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const db = getDb();
  const project = await getActiveProject(db, sp.projekt);
  if (!project) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Actions</h1>
        <Empty>Synka först så att projektet skapas från tidplanen.</Empty>
      </div>
    );
  }
  const inbox = sp.flik === "inkorg";
  const status = inbox
    ? "foreslagen"
    : (STATUSES as readonly string[]).includes(sp.status ?? "")
      ? (sp.status as ActionRow["status"])
      : undefined;
  const [list, proposals, options] = await Promise.all([
    listActions(db, {
      projectId: project.id,
      status,
      owner: inbox ? undefined : sp.ansvarig || undefined,
      subproject: inbox ? undefined : sp.delprojekt || undefined,
    }),
    listActions(db, { projectId: project.id, status: "foreslagen" }),
    getFilterOptions(db, project.id),
  ]);
  const today = appToday();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Actions – {project.code}</h1>
      <nav className="flex gap-4 text-sm">
        <Link href="/actions" className={inbox ? linkClass : "font-semibold"}>
          Alla
        </Link>
        <Link href="/actions?flik=inkorg" className={inbox ? "font-semibold" : linkClass}>
          Inkorg (förslag) {proposals.length > 0 && `· ${proposals.length}`}
        </Link>
      </nav>

      {!inbox && (
        <>
          <form action={addAction} aria-label="Ny action" className="grid gap-2 rounded-lg border border-neutral-300 p-3 text-sm md:grid-cols-6 dark:border-neutral-700">
            <input type="hidden" name="projectId" value={project.id} />
            <label className="flex flex-col md:col-span-2">
              Titel
              <input name="title" required className={inputClass} />
            </label>
            <label className="flex flex-col">
              Ansvarig
              <input name="owner" className={inputClass} />
            </label>
            <label className="flex flex-col">
              Deadline
              <input type="date" name="dueDate" className={inputClass} />
            </label>
            <label className="flex flex-col">
              Prioritet
              <select name="priority" defaultValue="medel" className={inputClass}>
                {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col">
              Delprojekt
              <input name="subproject" className={inputClass} />
            </label>
            <div className="md:col-span-6">
              <button className={buttonClass}>Lägg till</button>
            </div>
          </form>

          <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col">
              Filtrera ansvarig
              <select name="ansvarig" defaultValue={sp.ansvarig ?? ""} className={inputClass}>
                <option value="">Alla</option>
                {options.owners.map((o) => (
                  <option key={o}>{o}</option>
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
              <select name="delprojekt" defaultValue={sp.delprojekt ?? ""} className={inputClass}>
                <option value="">Alla</option>
                {options.subprojects.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <button className={buttonClass}>Filtrera</button>
          </form>
        </>
      )}

      {inbox && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Förslag från mötesprotokoll. De räknas inte förrän du godkänt dem.
        </p>
      )}

      {list.length === 0 ? (
        <Empty>{inbox ? "Inga förslag att granska." : "Inga actions."}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Titel</th>
                <th className="py-2 pr-3">Ansvarig</th>
                <th className="py-2 pr-3">Deadline</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Prio</th>
                <th className="py-2 pr-3">Källa</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const overdue = a.status === "oppen" && a.dueDate !== null && a.dueDate < today;
                return (
                  <tr key={a.id} className="border-t border-neutral-200 align-top dark:border-neutral-800">
                    <td className="py-2 pr-3">
                      <details>
                        <summary className="cursor-pointer">{a.title}</summary>
                        <EditForm a={a} />
                      </details>
                    </td>
                    <td className="py-2 pr-3">{a.owner ?? "–"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{a.dueDate ?? "–"}</td>
                    <td className={`py-2 pr-3 ${overdue ? "font-medium text-red-600" : ""}`}>
                      {overdue ? "Försenad" : STATUS_LABEL[a.status]}
                    </td>
                    <td className="py-2 pr-3">{PRIORITY_LABEL[a.priority]}</td>
                    <td className="py-2 pr-3 text-neutral-500">
                      {SOURCE_LABEL[a.source]}
                      {a.activityCode && ` (${a.activityCode})`}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      <Buttons a={a} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Buttons({ a }: { a: ActionRow }) {
  const btn = "text-xs text-blue-700 hover:underline dark:text-blue-400";
  const one = (action: (f: FormData) => Promise<void>, label: string) => (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={a.id} />
      <button className={`${btn} mr-3`}>{label}</button>
    </form>
  );
  if (a.status === "foreslagen") return <>{one(approve, "Godkänn")}{one(reject, "Avvisa")}</>;
  if (a.status === "oppen") return one(closeAction, "Markera klar");
  return one(reopenAction, "Öppna igen");
}

function EditForm({ a }: { a: ActionRow }) {
  return (
    <form action={editAction} className="mt-2 grid gap-2 text-sm md:grid-cols-2">
      <input type="hidden" name="id" value={a.id} />
      <label className="flex flex-col md:col-span-2">
        Titel
        <input name="title" defaultValue={a.title} className={inputClass} />
      </label>
      <label className="flex flex-col">
        Ansvarig
        <input name="owner" defaultValue={a.owner ?? ""} className={inputClass} />
      </label>
      <label className="flex flex-col">
        Deadline
        <input type="date" name="dueDate" defaultValue={a.dueDate ?? ""} className={inputClass} />
      </label>
      <label className="flex flex-col">
        Delprojekt
        <input name="subproject" defaultValue={a.subproject ?? ""} className={inputClass} />
      </label>
      <label className="flex flex-col">
        Prioritet
        <select name="priority" defaultValue={a.priority} className={inputClass}>
          {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col md:col-span-2">
        Beskrivning
        <textarea name="description" defaultValue={a.description ?? ""} rows={2} className={inputClass} />
      </label>
      <div>
        <button className={buttonClass}>Spara</button>
      </div>
    </form>
  );
}
