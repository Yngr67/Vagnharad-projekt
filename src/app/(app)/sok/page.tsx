import { getDb } from "@/lib/db/client";
import { searchDocuments } from "@/lib/search/search";
import { driveUrl } from "@/lib/labels";
import { Empty, buttonClass, inputClass, linkClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").slice(0, 200);
  const hits = q ? await searchDocuments(getDb(), q) : [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Sök i dokument</h1>
      <form role="search" method="get" className="flex gap-2">
        <input type="search" name="q" defaultValue={q} placeholder="t.ex. markåtkomst eller &quot;förtida tillträde&quot;" className={`${inputClass} w-full max-w-xl`} />
        <button className={buttonClass}>Sök</button>
      </form>
      {q && hits.length === 0 && <Empty>Inga träffar för ”{q}”.</Empty>}
      <ul className="space-y-4">
        {hits.map((h) => (
          <li key={h.documentId} data-testid="search-hit">
            <a href={driveUrl(h.driveFileId)} target="_blank" rel="noreferrer" className={`${linkClass} font-medium`}>
              {h.name}
            </a>
            {/* snippet är escapad i searchDocuments; endast <mark> är HTML */}
            <p className="text-sm text-neutral-700 dark:text-neutral-300" dangerouslySetInnerHTML={{ __html: h.snippet }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
