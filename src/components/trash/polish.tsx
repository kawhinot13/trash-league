"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";
import { NumberTicker } from "@/components/ui/number-ticker";

const READY = "trash:ready";
/** Run `fn` once the preloader has cleared (or immediately when there is none). */
export const onReady = (fn: () => void) => {
  if (typeof window === "undefined") return () => {};
  const w = window as unknown as { __trashReady?: boolean };
  if (w.__trashReady) {
    fn();
    return () => {};
  }
  window.addEventListener(READY, fn, { once: true });
  return () => window.removeEventListener(READY, fn);
};
const markReady = () => {
  (window as unknown as { __trashReady?: boolean }).__trashReady = true;
  window.dispatchEvent(new Event(READY));
};

/* ── Preloader: once per visit, ~1.5s, skipped for reduced motion ── */
// Decided once per page load, so React's double-run of effects in development can't skip it.
let skipPreloader: boolean | null = null;
export function Preloader() {
  const [show, setShow] = useState(true);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    // Decide once: skip for reduced motion or a repeat visit in this tab.
    if (skipPreloader === null) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let seen = false;
      try {
        seen = sessionStorage.getItem("trash-loaded") === "1";
        sessionStorage.setItem("trash-loaded", "1");
      } catch {}
      skipPreloader = reduce || seen;
    }
    if (skipPreloader) {
      const id = requestAnimationFrame(() => {
        setShow(false);
        markReady();
      });
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    let raf = 0;
    let done: ReturnType<typeof setTimeout> | undefined;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1300);
      setPct(Math.round(100 * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else done = setTimeout(() => setShow(false), 180);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, []);
  return (
    <AnimatePresence onExitComplete={markReady}>
      {show ? (
        <motion.div
          key="loader"
          aria-hidden
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--bin)]"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
          initial={{ clipPath: "inset(0 0 0% 0)" }}
        >
          <div className="relative font-display text-[clamp(5rem,22vw,16rem)] leading-none font-black tracking-[-0.03em]">
            <span className="text-transparent [-webkit-text-stroke:2px_rgba(246,243,234,0.25)]">
              TRASH
            </span>
            <span
              className="absolute inset-0 text-[var(--gold)]"
              style={{
                clipPath: `inset(${100 - pct}% 0 0 0)`,
                transition: "clip-path 80ms linear",
              }}
            >
              TRASH
            </span>
          </div>
          <p className="mt-6 font-display text-2xl font-bold text-[var(--muted)] tabular-nums">
            {pct}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ── Floating glass nav with a morphing pill on the active section ── */
const LINKS = [
  ["standings", "Standings"],
  ["champions", "Champions"],
  ["story", "Story"],
  ["crimes", "Crimes"],
  ["owns", "Who owns who"],
  ["managers", "Managers"],
] as const;
export function GlassNav() {
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    // Each link's id sits on a heading; watch the section that contains it.
    const owner = new Map<Element, string | null>();
    document.querySelectorAll("main section").forEach((sec) => owner.set(sec, null));
    for (const [id] of LINKS) {
      const sec = document.getElementById(id)?.closest("section");
      if (sec) owner.set(sec, id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting && owner.has(e.target)) setActive(owner.get(e.target) ?? null);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    owner.forEach((_, el) => io.observe(el));
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      if (window.scrollY < 200) setActive(null);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 md:pt-4">
        <nav
          aria-label="Sections"
          className={`pointer-events-auto flex w-full max-w-5xl items-center justify-between gap-2 rounded-full border px-2 py-2 pl-5 transition-[background-color,border-color,box-shadow] duration-500 ${
            scrolled
              ? "border-white/12 bg-[rgba(10,30,22,0.62)] shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl"
              : "border-transparent bg-transparent"
          }`}
        >
          <a
            href="#top"
            className="font-display text-2xl font-black tracking-tight"
          >
            Trash
          </a>
          <ul className="hidden items-center gap-1 text-sm md:flex">
            {LINKS.map(([id, label]) => {
              const isOn = active === id;
              return (
                <li key={id} className="relative">
                  {isOn ? (
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
                  <a
                    href={`#${id}`}
                    aria-current={isOn ? "true" : undefined}
                    className={`relative block rounded-full px-3.5 py-2 transition-colors duration-200 ${isOn ? "text-[var(--paper)]" : "text-[var(--muted)] hover:text-[var(--paper)]"}`}
                  >
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-2">
            <a
              href="#movie"
              className="rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[var(--bin)] transition-transform duration-200 hover:scale-[1.04] active:scale-[0.97]"
            >
              Watch the movie
            </a>
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
                <span className="font-display text-2xl font-black">Trash</span>
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
                {[...LINKS, ["movie", "The movie"] as const].map(
                  ([id, label]) => (
                    <li key={id}>
                      <a
                        href={`#${id}`}
                        onClick={() => setOpen(false)}
                        className="block rounded-2xl px-3 py-3.5 font-display text-3xl font-bold active:bg-white/8"
                      >
                        {label}
                      </a>
                    </li>
                  ),
                )}
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
  const reduce = useReducedMotion();
  return (
    <div className="relative z-10 mx-auto -mt-10 max-w-5xl px-4 md:-mt-14">
      <dl className="grid grid-cols-2 overflow-hidden rounded-[28px] border border-white/12 bg-[rgba(16,40,30,0.55)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur-xl md:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`px-6 py-6 md:py-8 ${i % 2 ? "border-l border-white/10" : ""} ${i > 1 ? "border-t border-white/10 md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}
          >
            <dd className="font-display text-5xl leading-none font-black tabular-nums md:text-6xl">
              {reduce ? (
                s.value
              ) : (
                <NumberTicker
                  value={s.value}
                  startValue={0}
                  className="text-[var(--paper)]"
                />
              )}
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
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 105,
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
