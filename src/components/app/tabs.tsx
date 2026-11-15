"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A league's sections. Scrolls sideways on narrow phones rather than wrapping. */
export function LeagueTabs({ id, live }: { id: string; live: boolean }) {
  const path = usePathname();
  const base = `/l/${id}`;
  const tabs = [
    { href: base, label: "Home", on: path === base },
    ...(live ? [{ href: `${base}/live`, label: "Live", on: path === `${base}/live` }] : [{ href: `${base}/live`, label: "Table", on: path === `${base}/live` }]),
    { href: `${base}/managers`, label: "Managers", on: path.startsWith(`${base}/managers`) },
    { href: `${base}/rivals`, label: "Rivals", on: path === `${base}/rivals` },
    { href: `${base}/history`, label: "History", on: path === `${base}/history` },
    { href: `${base}/front-office`, label: "Front office", on: path === `${base}/front-office` },
  ];
  return (
    <div className="mx-auto max-w-6xl overflow-x-auto px-4 [scrollbar-width:none] md:px-10">
      <ul className="flex gap-1 pb-2 text-sm font-semibold">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.on ? "page" : undefined}
              className={`block rounded-full px-4 py-2 whitespace-nowrap transition-colors duration-200 ${
                t.on ? "bg-white/10 text-[var(--paper)]" : "text-[var(--muted)] hover:text-[var(--paper)]"
              }`}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
