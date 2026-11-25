"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { createActionFromActivity } from "@/lib/actions/service";

export async function createFromActivity(form: FormData): Promise<void> {
  await createActionFromActivity(getDb(), {
    projectId: Number(form.get("projectId")),
    versionId: Number(form.get("versionId")),
    activityCode: String(form.get("activityCode")),
  });
  revalidatePath("/tidplan");
  revalidatePath("/actions");
  revalidatePath("/");
}
