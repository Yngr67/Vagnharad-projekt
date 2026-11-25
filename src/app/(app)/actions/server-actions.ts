"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { approveProposal, createAction, rejectProposal, updateAction, type ActionPatch } from "@/lib/actions/service";
import type { ActionRow } from "@/lib/db/schema";

const PRIORITIES = ["hog", "medel", "lag"] as const;
const STATUSES = ["foreslagen", "oppen", "klar", "avvisad"] as const;

const text = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? "").trim();
  return v === "" ? null : v.slice(0, 2000);
};
const date = (form: FormData, key: string) => {
  const v = text(form, key);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};
const oneOf = <T extends string>(v: string | null, allowed: readonly T[]): T | undefined =>
  allowed.includes(v as T) ? (v as T) : undefined;

function refresh() {
  revalidatePath("/actions");
  revalidatePath("/");
}

export async function addAction(form: FormData): Promise<void> {
  const title = text(form, "title");
  if (!title) return;
  await createAction(getDb(), {
    projectId: Number(form.get("projectId")),
    title,
    owner: text(form, "owner"),
    dueDate: date(form, "dueDate"),
    priority: oneOf(text(form, "priority"), PRIORITIES) ?? "medel",
    subproject: text(form, "subproject"),
    description: text(form, "description"),
  });
  refresh();
}

export async function editAction(form: FormData): Promise<void> {
  const patch: ActionPatch = {
    owner: text(form, "owner"),
    dueDate: date(form, "dueDate"),
    subproject: text(form, "subproject"),
    description: text(form, "description"),
  };
  const title = text(form, "title");
  if (title) patch.title = title;
  const priority = oneOf(text(form, "priority"), PRIORITIES);
  if (priority) patch.priority = priority;
  const status = oneOf(text(form, "status"), STATUSES);
  if (status) patch.status = status as ActionRow["status"];
  await updateAction(getDb(), Number(form.get("id")), patch);
  refresh();
}

export async function closeAction(form: FormData): Promise<void> {
  await updateAction(getDb(), Number(form.get("id")), { status: "klar" });
  refresh();
}

export async function reopenAction(form: FormData): Promise<void> {
  await updateAction(getDb(), Number(form.get("id")), { status: "oppen" });
  refresh();
}

export async function approve(form: FormData): Promise<void> {
  await approveProposal(getDb(), Number(form.get("id")));
  refresh();
}

export async function reject(form: FormData): Promise<void> {
  await rejectProposal(getDb(), Number(form.get("id")));
  refresh();
}
