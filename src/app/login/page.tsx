"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });
  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-semibold">Projektstöd</h1>
      <form action={action} className="space-y-4">
        <label className="block">
          <span className="text-sm">Lösenord</span>
          <input
            name="password"
            type="password"
            autoFocus
            required
            className="mt-1 w-full rounded border border-neutral-400 bg-transparent px-3 py-2"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          disabled={pending}
          className="w-full rounded bg-neutral-900 px-3 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          Logga in
        </button>
      </form>
    </main>
  );
}
