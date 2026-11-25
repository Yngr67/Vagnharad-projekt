"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "./ui";

type Report = {
  scanned: number;
  changed: number;
  skipped: number;
  removed: number;
  newScheduleVersions: number;
  errors: { fileId: string; message: string }[];
};

export function SyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Fel ${res.status}`);
      setReport(body);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-sm">
      <button onClick={sync} disabled={busy} className={buttonClass}>
        {busy ? "Synkar…" : "Synka nu"}
      </button>
      {report && (
        <p data-testid="sync-report" className="mt-2 text-neutral-600 dark:text-neutral-400">
          {report.scanned} filer, {report.changed} ändrade, {report.newScheduleVersions} nya tidplanversioner
          {report.removed > 0 && `, ${report.removed} borttagna`}
          {report.errors.length > 0 && (
            <span className="text-red-600"> · {report.errors.length} fel (se Dokument)</span>
          )}
        </p>
      )}
      {error && <p className="mt-2 text-red-600">Synken misslyckades: {error}</p>}
    </div>
  );
}
