import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "../login/actions";
import { SyncButton } from "@/components/sync-button";

const NAV = [
  { href: "/", label: "Översikt" },
  { href: "/tidplan", label: "Tidplan" },
  { href: "/actions", label: "Actions" },
  { href: "/dokument", label: "Dokument" },
  { href: "/sok", label: "Sök" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-300 dark:border-neutral-700">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <span className="font-semibold">Projektstöd</span>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm hover:underline">
              {n.label}
            </Link>
          ))}
          <div className="ml-auto">
            <SyncButton />
          </div>
          <form action={logout}>
            <button className="text-sm text-neutral-500 hover:underline">Logga ut</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
