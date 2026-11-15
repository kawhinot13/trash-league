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
      <Link href={home} className="font-display max-w-[52vw] truncate text-2xl leading-7 font-black tracking-tight md:max-w-[16rem]">
        {logo}
      </Link>
    </span>
  ) : (
    <Link
      href={home}
      className={`font-display text-2xl font-black tracking-tight${logo === "Trash" ? "" : " max-w-[52vw] truncate md:max-w-[16rem]"}`}
    >
      {logo}
    </Link>
  );
  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 md:pt-4">
        <nav
          aria-label="Sections"
          className={`pointer-events-auto relative flex w-full max-w-5xl items-center justify-between gap-2 rounded-full border px-2 py-2 pl-5 transition-[background-color,border-color,box-shadow] duration-500 ${
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
                className="rounded-full bg-[var(--paper)] px-4 py-2 text-sm font-semibold whitespace-nowrap text-[var(--bin)] transition-transform duration-200 active:scale-[0.97]"
              >
                {cta.label}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              className="flex size-10 items-center justify-center rounded-full bg-white/8 md:hidden"
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
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </nav>
      </header>
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
              aria-label="Sections"
              className="mx-3 mt-3 rounded-3xl border border-white/12 bg-[rgba(16,40,30,0.85)] p-3"
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
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
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={isOn(href) ? "page" : undefined}
                      className={`block rounded-2xl px-3 py-3.5 font-display text-3xl font-bold active:bg-white/8 ${isOn(href) ? "text-[var(--paper)]" : "text-[var(--paper)]/70"}`}
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
      className="font-display scroll-mt-28 text-[clamp(3.2rem,9vw,7.5rem)] leading-[0.85] font-black tracking-[-0.02em]"
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
