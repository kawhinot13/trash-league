"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";
import { NumberTicker } from "@/components/ui/number-ticker";
import { StringLights } from "@/components/holiday/lights";
import { HOLIDAY } from "@/lib/holiday";
import { MusicToggle } from "@/components/holiday/music";

/** Run `fn` once the page has painted. (There used to be a preloader to wait for; it was
 * removed because it also popped up when navigating to Home from another page.) */
export const onReady = (fn: () => void) => {
  if (typeof window === "undefined") return () => {};
  const id = requestAnimationFrame(() => fn());
  return () => cancelAnimationFrame(id);
};

/* ── Phone tab bar: the main sections at thumb reach, the rest under "More" ── */
const TAB_LABELS = new Set(["Home", "Live", "Stats"]);
const ICONS: Record<string, React.ReactNode> = {
  Home: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  Live: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4" />
    </>
  ),
  Games: (
    <>
      <rect x="3" y="7" width="18" height="11" rx="4" />
      <path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01" />
    </>
  ),
  Stats: <path d="M5 19V11M12 19V5M19 19v-6" />,
  More: (
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>
  ),
};
function TabBar({
  links,
  cta,
  isOn,
  onMore,
  moreOn,
}: {
  links: readonly (readonly [string, string])[];
  cta: { href: string; label: string } | null;
  isOn: (href: string) => boolean;
  onMore: () => void;
  moreOn: boolean;
}) {
  const main = links.filter(([, l]) => TAB_LABELS.has(l));
  const tabs: { key: string; label: string; href?: string; on: boolean }[] = [
    ...main.slice(0, 2).map(([href, label]) => ({ key: label, label, href, on: !moreOn && isOn(href) })),
    ...(cta ? [{ key: "Games", label: "Games", href: cta.href, on: false }] : []),
    ...main.slice(2).map(([href, label]) => ({ key: label, label, href, on: !moreOn && isOn(href) })),
  ];
  const moreActive = moreOn || links.some(([href, l]) => !TAB_LABELS.has(l) && isOn(href));
  const cls = (on: boolean) =>
    `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold transition-colors ${on ? "text-[var(--paper)]" : "text-[var(--muted)]"}`;
  const icon = (k: string) => (
    <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[k]}
    </svg>
  );
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-[61] border-t border-white/10 bg-[rgba(10,30,22,0.94)] px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {tabs.map((t) => (
          <li key={t.key} className="flex flex-1">
            <Link href={t.href!} aria-current={t.on ? "page" : undefined} className={cls(t.on)}>
              {t.key === "Games" ? (
                <span className="flex size-9 items-center justify-center rounded-full bg-[var(--paper)] text-[var(--bin)]">{icon("Games")}</span>
              ) : (
                icon(t.key)
              )}
              <span>{t.label}</span>
            </Link>
          </li>
        ))}
        <li className="flex flex-1">
          <button type="button" onClick={onMore} aria-expanded={moreOn} className={cls(moreActive)}>
            {icon("More")}
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

/* ── Floating glass nav with a morphing pill on the active section ── */
const LINKS = [
  ["/", "Home"],
  ["/live", "Live"],
  ["/front-office", "Front office"],
  ["/managers", "Managers"],
  ["/rivals", "Rivals"],
  ["/history", "History"],
  ["/stats", "Stats"],
] as const;
export function GlassNav({
  logo = "Trash",
  home = "/",
  links = LINKS,
  cta = { href: "/#dive", label: "Daily games" },
  holiday = HOLIDAY,
  product,
  extra,
  mark,
  music = holiday,
}: {
  /** Wordmark at the left (the league's name). */
  logo?: string;
  /** The holiday song's toggle. Follows `holiday` unless set (Rafterlore: decor without the Trash song). */
  music?: boolean;
  /** A logo mark before the wordmark (Rafterlore's R; Trash has none). */
  mark?: React.ReactNode;
  /** Extra controls before the bright button (Rafterlore's account menu; Trash has none). */
  extra?: React.ReactNode;
  /** A small product mark above the wordmark, linking to `product.href` (Rafterlore; Trash has none). */
  product?: { name: string; href: string };
  /** Where the wordmark and the "Home" section point. */
  home?: string;
  links?: readonly (readonly [string, string])[];
  /** The bright button at the right; null hides it. */
  cta?: { href: string; label: string } | null;
  holiday?: boolean;
} = {}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const isOn = (href: string) => (href === home ? path === home : path.startsWith(href));
  const wordmark = product ? (
    <span className="flex min-w-0 flex-col">
      <Link
        href={product.href}
        className="text-[10px] leading-3 font-bold tracking-[0.22em] text-[var(--wood)] uppercase hover:text-[var(--paper)]"
      >
        {product.name}
      </Link>
      <Link href={home} className="font-display max-w-[60vw] truncate text-xl leading-6 font-black tracking-tight md:max-w-[16rem] md:text-2xl md:leading-7">
        {logo}
      </Link>
    </span>
  ) : (
    <Link
      href={home}
      className={`font-display text-2xl font-black tracking-tight${logo === "Trash" ? "" : " max-w-[60vw] truncate md:max-w-[16rem]"}`}
    >
      {logo}
    </Link>
  );
  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 md:pt-4">
        <nav
          aria-label="Sections"
          className={`pointer-events-auto relative flex w-full max-w-5xl items-center justify-between gap-2 rounded-full border px-1.5 py-1.5 pl-4 transition-[background-color,border-color,box-shadow] duration-500 md:px-2 md:py-2 md:pl-5 ${
            scrolled
              ? "border-white/12 bg-[rgba(10,30,22,0.86)] shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md"
              : "border-transparent bg-transparent"
          }`}
        >
          {holiday && scrolled ? <StringLights /> : null}
          {mark ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <Link href={product?.href ?? home} aria-label="Rafterlore home" className="shrink-0">
                {mark}
              </Link>
              {wordmark}
            </span>
          ) : (
            wordmark
          )}
          <ul className="hidden items-center gap-0.5 text-sm whitespace-nowrap md:flex">
            {links.map(([href, label]) => {
              const on = isOn(href);
              return (
                <li key={href} className="relative">
                  {on ? (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-white/10 ring-1 ring-white/15"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 32,
                      }}
                    />
                  ) : null}
                  <Link
                    href={href}
                    aria-current={on ? "page" : undefined}
                    className={`relative block rounded-full px-4 py-2 transition-colors duration-200 ${on ? "text-[var(--paper)]" : "text-[var(--muted)] hover:text-[var(--paper)]"}`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-2">
            {holiday && music ? <MusicToggle /> : null}
            {extra}
            {cta ? (
              <Link
                href={cta.href}
                className="hidden rounded-full bg-[var(--paper)] px-4 py-2 text-sm font-semibold whitespace-nowrap text-[var(--bin)] transition-transform duration-200 active:scale-[0.97] md:inline-block"
              >
                {cta.label}
              </Link>
            ) : null}
          </div>
        </nav>
      </header>
      <TabBar links={links} cta={cta} isOn={isOn} onMore={() => setOpen(true)} moreOn={open} />
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[60] bg-[rgba(6,18,13,0.72)] backdrop-blur-xl md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.nav
              aria-label="More sections"
              className="absolute inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] rounded-3xl border border-white/12 bg-[rgba(16,40,30,0.92)] p-3"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-3 py-2">
                <span className={`font-display text-2xl font-black${logo === "Trash" ? "" : " truncate"}`}>{logo}</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="flex size-10 items-center justify-center rounded-full bg-white/8"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <ul className="mt-1">
                {links.map(([href, label]) => (
                  <li key={href} className={TAB_LABELS.has(label) ? "hidden" : undefined}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={isOn(href) ? "page" : undefined}
                      className={`block rounded-2xl px-3 py-3 font-display text-2xl font-bold active:bg-white/8 ${isOn(href) ? "text-[var(--paper)]" : "text-[var(--paper)]/70"}`}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/* ── Glass stat strip with count-up numbers ── */
export function StatStrip({
  stats,
}: {
  stats: { value: number; label: string }[];
}) {
  return (
    <div className="relative z-10 mx-auto -mt-10 max-w-5xl px-4 md:-mt-14">
      <dl className="grid grid-cols-2 overflow-hidden rounded-[28px] border border-white/12 bg-[rgba(16,40,30,0.55)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_80px_-30px_rgba(0,0,0,0.7)] md:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`px-6 py-6 md:py-8 ${i % 2 ? "border-l border-white/10" : ""} ${i > 1 ? "border-t border-white/10 md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}
          >
            <dd className="font-display text-5xl leading-none font-black tabular-nums md:text-6xl">
              {<NumberTicker
                  value={s.value}
                  startValue={0}
                  className="text-[var(--paper)]"
                />}
            </dd>
            <dt className="mt-2 text-sm text-[var(--muted)]">{s.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── Section title that rises out of a mask, one line at a time ── */
export function RevealTitle({
  id,
  children,
}: {
  id: string;
  children: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        SplitText.create(ref.current, {
          type: "lines",
          mask: "lines",
          // Masks get "reveal-line-mask": globals.css gives them room below the line so letters
          // that dip under it (g, j, p, q, y) aren't clipped by the tight line height.
          linesClass: "reveal-line",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 135,
              duration: 0.9,
              ease: "expo.out",
              stagger: 0.08,
              scrollTrigger: {
                trigger: ref.current,
                start: "top 85%",
                once: true,
              },
            }),
        });
      });
    },
    { scope: ref },
  );
  return (
    <h2
      ref={ref}
      id={id}
      className="font-display scroll-mt-28 text-[clamp(2.5rem,9vw,7.5rem)] leading-[0.85] font-black tracking-[-0.02em]"
    >
      {children}
    </h2>
  );
}

/* ── Cursor-follow spotlight for glass panels ── */
export function Spotlight({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        ref.current!.style.setProperty("--mx", `${e.clientX - r.left}px`);
        ref.current!.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={`group/spot relative ${className}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background:
            "radial-gradient(420px circle at var(--mx) var(--my), rgba(233,196,106,0.10), transparent 60%)",
        }}
      />
      {children}
    </div>
  );
}

/** Reduced-motion preference, read after hydration so server and client HTML always match. */
function useCalm() {
  const [calm, setCalm] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCalm(window.matchMedia("(prefers-reduced-motion: reduce)").matches));
    return () => cancelAnimationFrame(id);
  }, []);
  return calm;
}

/* ── Live broadcast ticker (sports-TV crawl built from league data) ── */
export function Ticker({ items }: { items: { tag: string; text: string }[] }) {
  const reduce = useCalm();
  const row = (k: string) => (
    <ul
      className="flex shrink-0 items-center gap-10 pr-10"
      aria-hidden={k === "b"}
    >
      {items.map((it, i) => (
        <li key={k + i} className="flex items-center gap-3 whitespace-nowrap">
          <span className="rounded-full bg-[var(--gold)] px-2.5 py-0.5 text-xs font-bold text-[var(--bin)]">
            {it.tag}
          </span>
          <span className="text-sm text-[var(--paper)]/90">{it.text}</span>
          <span className="text-[var(--gold)]/50">✦</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div
      className="group relative mt-14 overflow-hidden border-y border-white/10 bg-[rgba(8,24,17,0.7)] py-3 md:mt-20"
      aria-label="League headlines"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[var(--bin)] to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[var(--bin)] to-transparent"
      />
      <div
        className={`flex w-max ${reduce ? "overflow-x-auto" : "animate-[ticker_60s_linear_infinite] group-hover:[animation-play-state:paused]"}`}
      >
        {row("a")}
        {reduce ? null : row("b")}
      </div>
    </div>
  );
}
