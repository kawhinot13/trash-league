"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const Trophy = dynamic(() => import("./trophy"), {
  ssr: false,
  loading: () => null,
});

export function Nav() {
  const links = [
    ["#standings", "Standings"],
    ["#champions", "Champions"],
    ["#story", "The story"],
    ["#crimes", "Trade crimes"],
    ["#managers", "Managers"],
    ["#movie", "The movie"],
  ];
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-5 md:px-10">
      <Link
        href="/"
        className="font-display text-2xl font-black tracking-tight"
      >
        Trash
      </Link>
      <nav
        aria-label="Sections"
        className="hidden gap-7 text-sm text-[var(--muted)] md:flex"
      >
        {links.map(([h, l]) => (
          <a
            key={h}
            href={h}
            className="transition-colors hover:text-[var(--paper)]"
          >
            {l}
          </a>
        ))}
      </nav>
    </header>
  );
}

/** The opening: TRASH is dropped into place letter by letter, the trophy floats in front. */
export function Hero({
  week,
  leaders,
}: {
  week: number | null;
  leaders: string[];
}) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".drop", {
          yPercent: -140,
          rotate: () => gsap.utils.random(-14, 14),
          duration: 1.1,
          ease: "bounce.out",
          stagger: 0.09,
        });
        gsap.from(".hero-copy", {
          opacity: 0,
          y: 16,
          duration: 0.8,
          delay: 1.0,
          ease: "power3.out",
        });
      });
    },
    { scope: ref },
  );
  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] flex-col overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 42%, rgba(233,196,106,0.16), transparent 70%), radial-gradient(120% 80% at 50% 120%, #08190f, transparent 60%)",
        }}
      />
      <Nav />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4">
        <h1 className="font-display flex select-none leading-[0.78] font-black tracking-[-0.03em] text-[clamp(7rem,31vw,30rem)]">
          {"TRASH".split("").map((c, i) => (
            <span key={i} className="drop inline-block will-change-transform">
              {c}
            </span>
          ))}
        </h1>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-[34vh] w-full max-w-[300px] -translate-y-[40%] md:h-[min(62vh,640px)] md:max-w-[720px] md:-translate-y-[46%]">
          <Trophy />
        </div>
      </div>
      <div className="hero-copy relative z-10 grid gap-6 px-5 pb-10 md:grid-cols-[1fr_auto] md:items-end md:px-10 md:pb-12">
        <p className="max-w-[46ch] text-lg leading-snug text-[var(--muted)] md:text-xl">
          A fantasy basketball league since 2023. Four seasons, three champions,
          ninety-three trades, and nobody has won it twice.
        </p>
        <a
          href="#standings"
          className="group inline-flex items-center gap-3 self-start rounded-full border border-[var(--line)] bg-[var(--bin-2)] px-5 py-3 text-sm md:self-end"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--gold)] opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-[var(--gold)]" />
          </span>
          <span>
            Season 4{week ? `, week ${week}` : ""} is live.{" "}
            <span className="text-[var(--muted)]">
              {leaders.join(" and ")} lead the table.
            </span>
          </span>
        </a>
      </div>
    </section>
  );
}
