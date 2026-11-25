import { asc, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";
import { CONVERT_LABEL, DOC_TYPE_LABEL, driveUrl, formatDateTime } from "@/lib/labels";
import { Empty, linkClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const docs = await getDb().select().from(documents).orderBy(asc(documents.removed), desc(documents.lastSyncedAt));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dokument</h1>
      {docs.length === 0 ? (
        <Empty>Inga dokument synkade ännu.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr>
                <th className="py-2 pr-4">Namn</th>
                <th className="py-2 pr-4">Typ</th>
                <th className="py-2 pr-4">Mapp</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Synkad</th>
                <th className="py-2">Meddelande</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className={`border-t border-neutral-200 align-top dark:border-neutral-800 ${d.removed ? "opacity-50" : ""}`}>
                  <td className="py-2 pr-4">{d.name}</td>
                  <td className="py-2 pr-4">{DOC_TYPE_LABEL[d.docType]}</td>
                  <td className="py-2 pr-4">{d.folderPath || "/"}</td>
                  <td className={`py-2 pr-4 ${d.convertStatus === "error" ? "text-red-600" : ""}`}>
                    {d.removed ? "Borttagen i Drive" : CONVERT_LABEL[d.convertStatus]}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(d.lastSyncedAt)}</td>
                  <td className="py-2">
                    {d.importError && (
                      <details>
                        <summary className={d.importError.startsWith("Varning:") ? "text-amber-700" : "text-red-600"}>
                          {d.importError.split("\n")[0]}
                        </summary>
                        <pre className="mt-1 whitespace-pre-wrap text-xs">{d.importError}</pre>
                      </details>
                    )}
                    {!d.removed && (
                      <a href={driveUrl(d.driveFileId)} target="_blank" rel="noreferrer" className={linkClass}>
                        Öppna i Drive
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
