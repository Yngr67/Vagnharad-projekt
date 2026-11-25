import type { NextRequest } from "next/server";
import { isAuthorized } from "@/lib/auth/request-auth";
import { runAppSync } from "@/lib/sync/run-app-sync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  if (!(await isAuthorized(req))) return Response.json({ error: "Ej inloggad" }, { status: 401 });
  try {
    return Response.json(await runAppSync());
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
