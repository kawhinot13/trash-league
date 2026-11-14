"use client";

import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import type { Manager } from "@/lib/league";

/** Reduced-motion preference, read after hydration so server and client HTML always match. */
function useCalm() {
  const [calm, setCalm] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setCalm(window.matchMedia("(prefers-reduced-motion: reduce)").matches));
    return () => cancelAnimationFrame(id);
  }, []);
  return calm;
}

/* ── The story: a pinned, horizontally scrolling reel ─────────── */
export type StoryItem = {
  img: string;
  when: string;
  title: string;
  text: string;
};
export function Story({ items }: { items: StoryItem[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLOListElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        () => {
          const el = track.current!;
          const dist = () => el.scrollWidth - window.innerWidth + 80;
          gsap.to(el, {
            x: () => -dist(),
            ease: "none",
            scrollTrigger: {
              trigger: wrap.current,
              start: "top top",
              end: () => `+=${dist()}`,
              pin: true,
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          });
        },
      );
      return () => ScrollTrigger.refresh();
    },
    { scope: wrap },
  );
  return (
    <div
      ref={wrap}
      className="relative md:flex md:h-[100svh] md:items-center md:overflow-hidden"
    >
      <ol
        ref={track}
        className="flex flex-col gap-10 px-5 md:flex-row md:gap-8 md:px-10"
      >
        {items.map((it, i) => (
          <li key={it.title} className="md:w-[340px] md:shrink-0">
            <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-[var(--bin-2)]">
              <Image
                src={it.img}
                alt={`Cartoon still: ${it.title}`}
                fill
                sizes="(min-width:768px) 340px, 100vw"
                className="object-cover object-top"
              />
              <span className="font-display absolute top-3 left-4 text-5xl font-black text-white/90 [text-shadow:0_2px_12px_rgba(0,0,0,.5)]">
                {i + 1}
              </span>
            </div>
            <p className="mt-4 text-sm text-[var(--gold)]">{it.when}</p>
            <h3 className="font-display mt-1 text-4xl leading-none font-black">
              {it.title}
            </h3>
            <p className="mt-2 max-w-[38ch] leading-relaxed text-[var(--muted)]">
              {it.text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── Who owns who: head-to-head grid ─────────────────────────── */
export function OwnsGrid({
  names,
  h2h,
  colors,
}: {
  names: string[];
  h2h: Record<string, Record<string, number>>;
  colors: Record<string, string>;
}) {
  const [hover, setHover] = useState<{ a: string; b: string } | null>(null);
  const rec = (a: string, b: string) =>
    [h2h[a]?.[b] ?? 0, h2h[b]?.[a] ?? 0] as const;
  const sel = hover ?? { a: "jgood432", b: "Edizzle6" };
  const [w, l] = rec(sel.a, sel.b);
  const verdict =
    w === l
      ? "dead even with"
      : w > l
        ? w >= 5 && l <= 1
          ? "owns"
          : "has the edge on"
        : l >= 5 && w <= 1
          ? "is owned by"
          : "trails";
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-5 md:grid-cols-[1fr_300px] md:px-10">
      <div className="overflow-x-auto rounded-3xl bg-[var(--bin-2)] p-3 md:p-5">
        <table className="mx-auto border-separate border-spacing-[3px] text-xs">
          <caption className="sr-only">
            Head-to-head wins, row manager against column manager, per Sleeper
          </caption>
          <thead>
            <tr>
              <th />
              {names.map((n) => (
                <th key={n} scope="col" className="relative h-28 w-8 min-w-8">
                  <span className="absolute bottom-1 left-1/2 origin-bottom-left -rotate-[60deg] font-medium whitespace-nowrap text-[var(--muted)]">
                    {n}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map((a) => (
              <tr key={a}>
                <th
                  scope="row"
                  className="pr-2 text-right font-medium whitespace-nowrap text-[var(--muted)]"
                >
                  {a}
                </th>
                {names.map((b) => {
                  if (a === b)
                    return (
                      <td key={b} className="size-8 rounded-md bg-black/20" />
                    );
                  const [x, y] = rec(a, b);
                  const share = x + y ? x / (x + y) : 0.5;
                  const on = hover?.a === a && hover?.b === b;
                  return (
                    <td key={b} className="p-0">
                      <button
                        type="button"
                        onMouseEnter={() => setHover({ a, b })}
                        onFocus={() => setHover({ a, b })}
                        aria-label={`${a} is ${x} and ${y} against ${b}`}
                        className="font-display flex size-8 items-center justify-center rounded-md text-sm font-bold tabular-nums transition-transform"
                        style={{
                          background:
                            x + y === 0
                              ? "transparent"
                              : share > 0.5
                                ? `rgba(233,196,106,${(share - 0.5) * 2})`
                                : `rgba(214,52,44,${(0.5 - share) * 1.6})`,
                          color: share > 0.75 ? "#0f2a20" : "var(--paper)",
                          transform: on ? "scale(1.25)" : undefined,
                          outline: on ? "2px solid var(--paper)" : undefined,
                        }}
                      >
                        {x + y ? x : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside
        aria-live="polite"
        className="rounded-3xl bg-[var(--bin-2)] p-6 md:sticky md:top-24 md:self-start"
      >
        <div className="flex items-center gap-3">
          <Image
            src={`/avatars/${sel.a}.jpg`}
            alt=""
            width={64}
            height={64}
            className="rounded-full"
            style={{ boxShadow: `0 0 0 3px ${colors[sel.a]}` }}
          />
          <Image
            src={`/avatars/${sel.b}.jpg`}
            alt=""
            width={48}
            height={48}
            className="rounded-full opacity-70"
          />
        </div>
        <p className="mt-5 text-lg leading-snug">
          <strong>{sel.a}</strong> {verdict} <strong>{sel.b}</strong>.
        </p>
        <p className="font-display mt-3 text-7xl font-black tabular-nums">
          {w}–{l}
        </p>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Hover or tab through the grid. Gold means the row manager wins the
          matchup, red means they lose it.
        </p>
      </aside>
    </div>
  );
}

/* ── Manager trading cards with a 3D tilt ─────────────────────── */
function TiltCard({ m, place }: { m: Manager; place: number }) {
  const reduce = useCalm();
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rx = useSpring(useTransform(y, [0, 1], [10, -10]), {
    stiffness: 220,
    damping: 18,
  });
  const ry = useSpring(useTransform(x, [0, 1], [-12, 12]), {
    stiffness: 220,
    damping: 18,
  });
  const glare = useTransform(
    [x, y] as never,
    ([a, b]: number[]) =>
      `radial-gradient(circle at ${a * 100}% ${b * 100}%, rgba(255,255,255,0.28), transparent 55%)`,
  );
  return (
    <motion.li
      style={
        reduce
          ? undefined
          : { rotateX: rx, rotateY: ry, transformPerspective: 900 }
      }
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width);
        y.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        x.set(0.5);
        y.set(0.5);
      }}
      className="list-none"
    >
      <Link
        href={`/managers/${m.id}`}
        className="relative block overflow-hidden rounded-[22px] border-[6px] p-0"
        style={{
          borderColor: m.titles.length ? "var(--gold)" : "#e8e1cf",
          background: "#e8e1cf",
        }}
      >
        <div
          className="relative flex h-44 items-end justify-center overflow-hidden"
          style={{ background: m.color }}
        >
          <span className="font-display absolute -top-4 -left-1 text-[7rem] leading-none font-black text-black/15">
            {place}
          </span>
          <Image
            src={`/avatars/${m.id}.jpg`}
            alt=""
            width={120}
            height={120}
            className="relative mb-[-28px] rounded-full ring-[6px] ring-[#e8e1cf]"
          />
        </div>
        <div className="px-4 pt-9 pb-4 text-center text-[#1b1710]">
          <p className="font-display text-3xl leading-none font-black">
            {m.nick}
          </p>
          <p className="mt-1 text-xs text-[#5b5444]">{m.id}</p>
          <dl className="mt-4 grid grid-cols-3 gap-1 text-center">
            {[
              ["Record", `${m.w}–${m.l}${m.t ? `–${m.t}` : ""}`],
              [
                "Playoffs",
                `${m.playoffs}/${Math.min(3, m.seasons.filter((s) => s.code !== "s4").length)}`,
              ],
              ["Trades", String(m.trades)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-black/5 py-2">
                <dt className="text-[10px] text-[#5b5444]">{k}</dt>
                <dd className="font-display text-xl font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 h-5 text-sm font-semibold text-[#8a6a12]">
            {m.titles.length
              ? `Champion, ${m.titles.map((t) => t.replace("s", "Season ")).join(", ")}`
              : ""}
          </p>
        </div>
        {reduce ? null : (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: glare }}
          />
        )}
      </Link>
    </motion.li>
  );
}
export function ManagerCards({ managers }: { managers: Manager[] }) {
  return (
    <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-5 sm:grid-cols-2 md:px-10 lg:grid-cols-4">
      {managers.map((m, i) => (
        <TiltCard key={m.id} m={m} place={i + 1} />
      ))}
    </ul>
  );
}

/* ── Rain for the Great Storm ─────────────────────────────────── */
export function Rain() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    let flash = 0;
    const drops = Array.from({ length: 220 }, () => ({
      x: Math.random(),
      y: Math.random(),
      v: 0.6 + Math.random() * 0.8,
    }));
    const resize = () => {
      c.width = c.clientWidth * devicePixelRatio;
      c.height = c.clientHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) raf = requestAnimationFrame(tick);
    });
    io.observe(c);
    function tick() {
      const { width: w, height: h } = c;
      ctx.clearRect(0, 0, w, h);
      if (Math.random() < 0.004) flash = 1;
      if (flash > 0) {
        ctx.fillStyle = `rgba(220,232,255,${flash * 0.35})`;
        ctx.fillRect(0, 0, w, h);
        flash -= 0.08;
      }
      ctx.strokeStyle = "rgba(190,215,255,0.45)";
      ctx.lineWidth = 1.2 * devicePixelRatio;
      ctx.beginPath();
      for (const d of drops) {
        d.y += 0.012 * d.v;
        if (d.y > 1) {
          d.y = -0.05;
          d.x = Math.random();
        }
        const x = d.x * w;
        const y = d.y * h;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4 * devicePixelRatio, y + 22 * devicePixelRatio * d.v);
      }
      ctx.stroke();
      raf = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [reduce]);
  return (
    <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />
  );
}

/** Vote meter that stops just short of the line. No vote counts are known, so none are shown. */
export function Ballot() {
  const reduce = useCalm();
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setSeen(true),
      { threshold: 0.6 },
    );
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="mt-10"
      role="img"
      aria-label="The Great Auction vote stopped one vote short of passing"
    >
      <div className="relative h-16 rounded-xl bg-black/30">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-xl bg-[var(--gold)]"
          initial={reduce ? { width: "90%" } : { width: "0%" }}
          animate={seen ? { width: "90%" } : undefined}
          transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
        />
        <div className="absolute inset-y-[-10px] left-[94%] w-1 rounded bg-[var(--ticket)]" />
      </div>
      <div className="mt-3 flex justify-between text-sm">
        <span className="text-[var(--muted)]">Votes for</span>
        <span className="text-[var(--ticket)]">One vote short of the line</span>
      </div>
    </div>
  );
}
