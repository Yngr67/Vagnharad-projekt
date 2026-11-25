import type { ReactNode } from "react";

export function Card({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section data-testid={testId} className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "ok" }) {
  const color = tone === "warn" && value > 0 ? "text-red-600" : tone === "ok" ? "text-green-700 dark:text-green-500" : "";
  return (
    <div className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
      <div className={`text-3xl font-semibold ${color}`}>{value}</div>
      <div className="text-sm text-neutral-500">{label}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-neutral-500">{children}</p>;
}

export const inputClass =
  "rounded border border-neutral-400 bg-transparent px-2 py-1 text-sm dark:border-neutral-600";
export const buttonClass =
  "rounded bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900";
export const linkClass = "text-blue-700 underline-offset-2 hover:underline dark:text-blue-400";
