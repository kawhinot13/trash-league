"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Optional sign-in (Google). Read in the browser from /api/me, so league pages stay pre-built.
 * When sign-in isn't set up on the server, nothing renders.
 */
export type Me = { configured: boolean; account: { name: string; sleeper: string | null; leagues: { id: string; name: string }[] } | null };

let state: Me | null = null;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function setMe(next: Me) {
  state = next;
  emit();
}

function load() {
  loading ??= fetch("/api/me", { cache: "no-store" })
    .then((r) => r.json() as Promise<Me>)
    .then(setMe)
    .catch(() => setMe({ configured: false, account: null }));
  return loading;
}

/** The signed-in account (null while loading, or when signed out). */
export function useMe(): Me | null {
  const me = useSyncExternalStore(
    (f) => {
      subs.add(f);
      void load();
      return () => subs.delete(f);
    },
    () => state,
    () => null,
  );
  return me;
}

export async function updateMe(body: { sleeper?: string | null; forget?: string }) {
  const r = await fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (r.ok) {
    const j = (await r.json()) as { account: Me["account"] };
    setMe({ configured: true, account: j.account });
  }
}

/** Sign in / account menu for the nav. */
export function AccountButton() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!me?.configured) return null;
  if (!me.account) {
    const next = typeof window === "undefined" ? "/l" : window.location.pathname;
    return (
      <a
        href={`/api/auth/google?next=${encodeURIComponent(next)}`}
        className="rounded-full border border-white/15 px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-[var(--paper)] transition-colors hover:bg-white/8"
      >
        Sign in
      </a>
    );
  }
  const a = me.account;
  const signOut = async () => {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.reload();
  };
  const remove = async () => {
    if (!window.confirm("Delete your Rafterlore account? Your saved Sleeper username and leagues are erased. Leagues themselves stay.")) return;
    setBusy(true);
    await fetch("/api/me", { method: "DELETE" }).catch(() => {});
    window.location.reload();
  };
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Account: ${a.name || "signed in"}`}
        className="font-display flex size-10 items-center justify-center rounded-full bg-[var(--wood)] text-lg font-black text-[var(--bin)]"
      >
        {(a.name || "•").slice(0, 1).toUpperCase()}
      </button>
      {open ? (
        <div className="absolute top-12 right-0 z-50 w-64 rounded-2xl border border-white/12 bg-[rgba(10,30,22,0.97)] p-2 text-sm shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
          <p className="px-3 pt-2 pb-1 text-[var(--muted)]">
            Signed in{a.name ? ` as ${a.name}` : ""}
            {a.sleeper ? (
              <>
                <br />
                Sleeper: <span className="text-[var(--paper)]">{a.sleeper}</span>
              </>
            ) : null}
          </p>
          <Link href="/l" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 font-semibold hover:bg-white/8">
            Your leagues
          </Link>
          <button type="button" disabled={busy} onClick={signOut} className="block w-full rounded-xl px-3 py-2.5 text-left font-semibold hover:bg-white/8">
            Sign out
          </button>
          <button type="button" disabled={busy} onClick={remove} className="block w-full rounded-xl px-3 py-2.5 text-left text-[#ffb3a8] hover:bg-white/8">
            Delete account
          </button>
        </div>
      ) : null}
    </div>
  );
}
