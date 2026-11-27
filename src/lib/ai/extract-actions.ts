import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { actions, type DocumentRow } from "@/lib/db/schema";
import { getActiveProject } from "@/lib/projects";

export type ProposedAction = {
  title: string;
  owner: string | null;
  dueDate: string | null;
  description: string | null;
};

export interface ActionExtractor {
  extract(markdown: string): Promise<ProposedAction[]>;
}

export const DEFAULT_MODEL = "claude-opus-5-5";

const ExtractionSchema = z.object({
  actions: z.array(
    z.object({
      title: z.string().describe("Kort beskrivning av vad som ska göras, på svenska"),
      owner: z.string().nullable().describe("Ansvarig person eller organisation, eller null om det inte framgår"),
      dueDate: z.string().nullable().describe("Deadline som YYYY-MM-DD, eller null om ingen anges"),
      description: z.string().nullable().describe("Kort sammanhang från protokollet, eller null"),
    }),
  ),
});

const SYSTEM = `Du läser mötesprotokoll från ett infrastrukturprojekt och plockar ut åtgärdspunkter (actions):
saker som någon ska göra efter mötet. Ta inte med beslut som redan är genomförda, allmän information
eller punkter som uttryckligen är avslutade. Hitta inte på ansvariga eller datum som inte står i texten.
Svara endast med den strukturerade listan.`;

/** Extraktor som använder Claude. Anropas bara när AI_ENABLED=true. */
export function createAnthropicExtractor(apiKey: string, model: string): ActionExtractor {
  const client = new Anthropic({ apiKey });
  return {
    async extract(markdown) {
      const response = await client.beta.messages.parse({
        model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        messages: [{ role: "user", content: `<protokoll>\n${markdown}\n</protokoll>` }],
        output_config: { format: betaZodOutputFormat(ExtractionSchema) },
      });
      if (response.stop_reason === "refusal") throw new Error("AI:n avböjde att läsa protokollet");
      if (!response.parsed_output) throw new Error("AI:n gav inget tolkbart svar");
      return response.parsed_output.actions.map((a) => ({
        ...a,
        dueDate: a.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate) ? a.dueDate : null,
      }));
    },
  };
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** Dubblettnyckel: samma protokoll + samma (normaliserade) titel och ansvarig ⇒ samma action. */
export function actionKey(driveFileId: string, a: { title: string; owner: string | null }): string {
  const hash = createHash("sha1").update(`${normalize(a.title)}|${normalize(a.owner ?? "")}`).digest("hex");
  return `protokoll:${driveFileId}:${hash}`;
}

/** Skapar förslag (status "foreslagen") ur ett protokoll. Redan kända nycklar – även avvisade – hoppas över. */
export async function proposeActionsFromMinutes(
  db: Db,
  extractor: ActionExtractor,
  doc: DocumentRow,
): Promise<{ created: number; skipped: number }> {
  const project = await getActiveProject(db);
  if (!project || !doc.markdown) return { created: 0, skipped: 0 };
  const proposed = await extractor.extract(doc.markdown);
  const keyed = proposed
    .filter((a) => a.title.trim())
    .map((a) => ({ a, key: actionKey(doc.driveFileId, a) }));
  if (keyed.length === 0) return { created: 0, skipped: 0 };
  const existing = new Set(
    (
      await db
        .select({ k: actions.sourceKey })
        .from(actions)
        .where(inArray(actions.sourceKey, keyed.map((k) => k.key)))
    ).map((r) => r.k),
  );
  const fresh = keyed.filter((k, i) => !existing.has(k.key) && keyed.findIndex((x) => x.key === k.key) === i);
  if (fresh.length) {
    await db
      .insert(actions)
      .values(
        fresh.map(({ a, key }) => ({
          projectId: project.id,
          title: a.title.trim(),
          owner: a.owner,
          dueDate: a.dueDate,
          description: a.description,
          status: "foreslagen" as const,
          source: "protokoll" as const,
          documentId: doc.id,
          sourceKey: key,
        })),
      )
      .onConflictDoNothing({ target: actions.sourceKey });
  }
  return { created: fresh.length, skipped: keyed.length - fresh.length };
}

type Env = { AI_ENABLED?: string; ANTHROPIC_API_KEY?: string; ANTHROPIC_MODEL?: string; [key: string]: string | undefined };

/** Returnerar synkens protokoll-krok, eller undefined när AI är avstängt (då skapas ingen AI-klient). */
export function buildMinutesHook(
  db: Db,
  env: Env,
  factory: (apiKey: string, model: string) => ActionExtractor = createAnthropicExtractor,
): ((doc: DocumentRow) => Promise<void>) | undefined {
  if (env.AI_ENABLED !== "true") return undefined;
  if (!env.ANTHROPIC_API_KEY) throw new Error("AI_ENABLED=true men ANTHROPIC_API_KEY saknas");
  const extractor = factory(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || DEFAULT_MODEL);
  return async (doc) => {
    await proposeActionsFromMinutes(db, extractor, doc);
  };
}
