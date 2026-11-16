"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Optional sign-in (Google). Read in the browser from /api/me, so league pages stay pre-built.
 * When sign-in isn't set up on the server, nothing renders.
 */
export type Me = {
  configured: boolean;
  /** Yahoo leagues are switched on. */
  yahoo?: boolean;
  account: { name: string; sleeper: string | null; leagues: { id: string; name: string }[]; admin?: boolean } | null;
};

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
        aria-label="Sign in"
        className="flex size-10 items-center justify-center rounded-full border border-white/15 text-sm font-semibold whitespace-nowrap text-[var(--paper)] transition-colors hover:bg-white/8 sm:size-auto sm:px-3.5 sm:py-2"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </svg>
        <span className="hidden sm:inline">Sign in</span>
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
          {a.admin ? (
            <Link href="/l/admin" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 font-semibold text-[var(--wood)] hover:bg-white/8">
              Admin
            </Link>
          ) : null}
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

/* ── Your leagues ──────────────────────────────────────────── */
/**
 * Leagues you've opened through Rafterlore, kept until you remove them. Signed in: on the account
 * (every device). Signed out: in this browser; signing in moves them onto the account.
 */
type Saved = { id: string; name: string };
const LOCAL = "rl:my-leagues";
const MAX = 30;
let local: Saved[] | null = null;
const localSubs = new Set<() => void>();
const readLocal = (): Saved[] => {
  if (local) return local;
  try {
    const v = JSON.parse(localStorage.getItem(LOCAL) ?? "[]") as Saved[];
    local = Array.isArray(v) ? v.filter((l) => l && typeof l.id === "string" && typeof l.name === "string") : [];
  } catch {
    local = [];
  }
  return local;
};
const writeLocal = (next: Saved[]) => {
  local = next.slice(0, MAX);
  try {
    localStorage.setItem(LOCAL, JSON.stringify(local));
  } catch {}
  localSubs.forEach((f) => f());
};

/** Called on every league page: keep it in "Your leagues" (newest first). */
export function rememberLocal(l: Saved) {
  writeLocal([l, ...readLocal().filter((x) => x.id !== l.id)]);
}

const EMPTY: Saved[] = [];
export function useMyLeagues() {
  const me = useMe();
  const mine = useSyncExternalStore(
    (f) => {
      localSubs.add(f);
      return () => localSubs.delete(f);
    },
    readLocal,
    () => EMPTY,
  );
  const account = me?.account ?? null;
  // Signing in: move this browser's leagues onto the account, once.
  const merged = useRef(false);
  useEffect(() => {
    if (!account || merged.current || !mine.length) return;
    merged.current = true;
    const missing = mine.filter((l) => !account.leagues.some((a) => a.id === l.id));
    void (async () => {
      if (missing.length) {
        const r = await fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ add: missing }) });
        if (!r.ok) return;
        setMe({ configured: true, account: ((await r.json()) as { account: Me["account"] }).account });
      }
      writeLocal([]);
    })();
  }, [account, mine]);
  return {
    ready: me !== null,
    leagues: account ? account.leagues : mine,
    remove: (id: string) => (account ? void updateMe({ forget: id }) : writeLocal(readLocal().filter((l) => l.id !== id))),
  };
}
