"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { SparklesText } from "@/components/ui/sparkles-text";
import { SantaHat } from "@/components/holiday/santa-hat";
import { XmasCountdown } from "@/components/holiday/countdown";
import { HOLIDAY } from "@/lib/holiday";

// WebGL snow, hero only: loaded after hydration, pauses off-screen, off for reduced motion.
const PixelSnow = dynamic(() => import("@/components/PixelSnow"), { ssr: false, loading: () => null });
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { onReady } from "./polish";

/** The trophy: a still render of the old 3D model. WebGL was the single heaviest thing on the
 * site (seconds of main-thread work on phones), and a gentle CSS float looks the same. */
function Trophy({ holiday }: { holiday: boolean }) {
  return (
    <div className="trophy-float relative flex h-full w-full items-center justify-center">
      {holiday ? (
        <SantaHat className="absolute top-[3%] left-1/2 z-10 w-[34%] -translate-x-[28%] -rotate-[14deg] drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)]" />
      ) : null}
      <Image
        src="/trophy.webp"
        alt=""
        width={839}
        height={1068}
        priority
        sizes="(min-width: 768px) 480px, 240px"
        className="h-[86%] w-auto drop-shadow-[0_30px_60px_rgba(0,0,0,0.45)]"
      />
    </div>
  );
}

/**
 * Any league's name, centered like TRASH: every letter drops in, words stay whole, and the size
 * scales so the longest word fits the screen (short names get TRASH-size letters).
 */
function BigTitle({ title }: { title: string }) {
  const words = title.trim().split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length));
  // ~0.62em per letter in Big Shoulders Black: the longest word must fit in 92vw...
  const vw = Math.min(31, 92 / (longest * 0.62));
  // ...and the whole name must stay a block above the horizon (about 46% of the screen's height).
  const perLine = Math.max(longest, Math.floor(92 / (0.62 * vw)));
  const lines = Math.ceil(title.length / perLine);
  const vh = 46 / (lines * 0.84);
  const rem = Math.min(30, (vw / 31) * 30);
  return (
    <h1
      className="font-display flex max-w-[96vw] flex-wrap justify-center gap-x-[0.22em] text-center select-none leading-[0.84] font-black tracking-[-0.03em] [text-shadow:0_20px_60px_rgba(0,0,0,0.35)]"
      style={{ fontSize: `clamp(2.6rem, min(${vw.toFixed(2)}vw, ${vh.toFixed(2)}vh), ${rem.toFixed(2)}rem)` }}
    >
      {words.map((w, wi) => (
        <span key={wi} className="inline-flex whitespace-nowrap">
          {w.split("").map((c, i) => (
            <span key={i} className="drop inline-block will-change-transform">
              {c}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

/** The opening: TRASH drops in once the preloader clears, the gold trophy floats in front
 * of a rim-lit court horizon (inspired by Frax's planet glow, drawn as a basketball). */
export function Hero({
  week,
  leaders,
  title = "TRASH",
  blurb,
  live,
  holiday = HOLIDAY,
}: {
  week: number | null;
  leaders: string[];
  /** The giant centered title (the league's name). Trash: "TRASH". */
  title?: string;
  /** The line under the title. Trash's own when omitted. */
  blurb?: React.ReactNode;
  /** The pill linking to the live table. Trash's own when omitted; null hides it. */
  live?: { href: string; text: React.ReactNode } | null;
  /** Holiday decorations (snow, santa hat, the Trashmas line). */
  holiday?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(".drop", { yPercent: -140, opacity: 0 });
        gsap.set(".hero-copy", { opacity: 0, y: 16 });
        gsap.set(".horizon", { opacity: 0, scale: 0.94 });
        const go = () => {
          const tl = gsap.timeline();
          tl.to(
            ".horizon",
            { opacity: 1, scale: 1, duration: 1.6, ease: "power2.out" },
            0,
          )
            .to(
              ".drop",
              {
                yPercent: 0,
                opacity: 1,
                rotate: 0,
                duration: 1.05,
                ease: "bounce.out",
                stagger: 0.08,
              },
              0.1,
            )
            .to(
              ".hero-copy",
              { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" },
              0.9,
            )
            .from(
              ".contour",
              {
                strokeDashoffset: 1600,
                duration: 2.4,
                ease: "power2.out",
                stagger: 0.06,
              },
              0,
            );
        };
        return onReady(go);
      });
    },
    { scope: ref },
  );
  return (
    <section
      id="top"
      ref={ref}
      className="relative flex min-h-[100svh] flex-col overflow-hidden"
    >
      {/* atmosphere */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_38%,rgba(233,196,106,0.13),transparent_70%)]"
      />
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full opacity-[0.16]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <ellipse
            key={i}
            className="contour"
            cx="720"
            cy="980"
            rx={260 + i * 140}
            ry={150 + i * 82}
            stroke="#cfe3d6"
            strokeWidth="1"
            strokeDasharray="1600"
          />
        ))}
        <line
          className="contour"
          x1="720"
          y1="0"
          x2="720"
          y2="900"
          stroke="#cfe3d6"
          strokeWidth="1"
          strokeDasharray="1600"
        />
      </svg>
      <div
        aria-hidden
        className="horizon absolute left-1/2 top-[64%] h-[150vw] w-[150vw] -translate-x-1/2 rounded-full md:top-[70%] md:h-[110vw] md:w-[110vw]"
        style={{
          background:
            "radial-gradient(closest-side, #0a1f17 92%, transparent 100%)",
          boxShadow:
            "0 -2px 0 0 rgba(233,196,106,0.55), 0 -30px 90px -10px rgba(233,196,106,0.35), 0 -80px 200px -40px rgba(63,174,90,0.35)",
        }}
      >
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.22]"
          viewBox="0 0 100 100"
          fill="none"
        >
          <path d="M50 0 V100 M0 50 H100" stroke="#e9c46a" strokeWidth="0.12" />
          <path
            d="M14.6 14.6 Q50 40 85.4 14.6 M14.6 85.4 Q50 60 85.4 85.4"
            stroke="#e9c46a"
            strokeWidth="0.12"
          />
        </svg>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {holiday ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] opacity-90">
          <PixelSnow color="#f6f3ea" density={0.55} speed={0.6} dpr={1.5} />
        </div>
      ) : null}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pt-20">
        {title === "TRASH" ? (
          <h1 className="font-display flex select-none leading-[0.78] font-black tracking-[-0.03em] text-[clamp(7rem,31vw,30rem)] [text-shadow:0_20px_60px_rgba(0,0,0,0.35)]">
            {"TRASH".split("").map((c, i) => (
              <span key={i} className="drop inline-block will-change-transform">
                {c}
              </span>
            ))}
          </h1>
        ) : (
          <BigTitle title={title} />
        )}
        <div
          className={`pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-[34vh] w-full max-w-[300px] -translate-y-[40%] md:h-[min(62vh,640px)] md:max-w-[720px] md:-translate-y-[46%]${
            title.length > 8 ? " -z-10 opacity-90" : ""
          }`}
        >
          <Trophy holiday={holiday} />
        </div>
      </div>
      <div className="hero-copy relative z-10 grid gap-6 px-5 pb-24 md:grid-cols-[1fr_auto] md:items-end md:px-10 md:pb-28">
        <div className="flex flex-col gap-3">
        {holiday ? (
          <div className="flex flex-wrap items-center gap-3">
            <SparklesText className="font-display text-4xl font-black md:text-5xl" colors={{ first: "#e9c46a", second: "#d93a3a" }} sparklesCount={8}>
              Merry Trashmas
            </SparklesText>
            <XmasCountdown />
          </div>
        ) : null}
        <p className="max-w-[46ch] text-lg leading-snug text-[var(--muted)] md:text-xl">
          {blurb ?? (
            <>
              A fantasy basketball league since 2023. Four seasons, three champions,
              ninety-three trades, and nobody has won it twice.
            </>
          )}
        </p>
        </div>
        {live === null ? null : (
        <a
          href={live?.href ?? "/live"}
          className="group inline-flex items-center gap-3 self-start rounded-full border border-white/12 bg-[rgba(16,40,30,0.55)] px-5 py-3 text-sm transition-colors duration-200 hover:border-white/25 md:self-end"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--gold)] opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-[var(--gold)]" />
          </span>
          <span>
            {live ? (
              live.text
            ) : (
              <>
                Season 4{week ? `, week ${week}` : ""} is live.{" "}
                <span className="text-[var(--muted)]">
                  {leaders.join(" and ")} lead the table.
                </span>
              </>
            )}
          </span>
        </a>
        )}
      </div>
    </section>
  );
}
