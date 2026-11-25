import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";

export type SearchHit = { documentId: number; name: string; driveFileId: string; snippet: string };

/** Fulltextsökning (svensk ordlista) i alla dokuments Markdown. */
export async function searchDocuments(db: Db, q: string, limit = 20): Promise<SearchHit[]> {
  const query = q.trim();
  if (!query) return [];
  const rows = await db.execute<{ id: number; name: string; drive_file_id: string; snippet: string }>(sql`
    select id, name, drive_file_id,
      ts_headline('swedish', coalesce(markdown, name), websearch_to_tsquery('swedish', ${query}),
        'StartSel=⟦, StopSel=⟧, MaxFragments=2, MaxWords=30, MinWords=10') as snippet
    from documents
    where removed = false and search_vector @@ websearch_to_tsquery('swedish', ${query})
    order by ts_rank(search_vector, websearch_to_tsquery('swedish', ${query})) desc, id
    limit ${limit}
  `);
  return rows.map((r) => ({ documentId: Number(r.id), name: r.name, driveFileId: r.drive_file_id, snippet: safeSnippet(r.snippet) }));
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapar dokumenttext och gör om träffmarkeringarna till <mark>. Säker att rendera som HTML. */
function safeSnippet(raw: string): string {
  return raw
    .replace(/[&<>"']/g, (c) => ESCAPES[c])
    .replace(/\u27e6/g, "<mark>")
    .replace(/\u27e7/g, "</mark>");
}
