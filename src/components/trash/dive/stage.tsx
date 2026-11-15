"use client";

import confetti from "canvas-confetti";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import type { Players } from "@/lib/extras";
import { Face, pname } from "../player";
import { sfx } from "./sfx";
import { HOLIDAY } from "@/lib/holiday";

/** Stage geometry, in SVG units (viewBox 0 0 400 440). */
const W = 400;
const H = 440;
const RIM = 118;
const depthY = (s: number) => 168 + s * 1.78;

export const tierOf = (s: number | null) =>
  s === null
    ? { label: "Not in the bin", short: "Miss", color: "var(--ticket)", hex: "#d6342c" }
    : s >= 90
      ? { label: "Dumpster diver", short: "Diver", color: "var(--wood)", hex: "#c98a4b" }
      : s >= 60
        ? { label: "Deep cut", short: "Deep", color: "#7fd49a", hex: "#7fd49a" }
        : s >= 25
          ? { label: "Solid pull", short: "Solid", color: "var(--paper)", hex: "#f6f3ea" }
          : { label: "Everybody said that", short: "Obvious", color: "var(--muted)", hex: "#a4b8ab" };

export type StageApi = {
  open: () => void;
  drop: (pid: string | null, score: number | null) => Promise<void>;
  reset: () => void;
};

const INK = "#10141a";

/** Trash that floats inside the bin; each bobs on its own loop and jiggles on impact. */
function Props() {
  return (
    <g>
      {/* crumpled paper */}
      <g className="dd-prop" style={{ animationDuration: "5.2s" }}>
        <path d="M96 196 C88 184 104 172 116 178 C128 170 140 186 132 196 C138 208 120 214 112 206 C100 212 90 206 96 196 Z" fill="#e9e3d2" stroke={INK} strokeWidth="3" />
        <path d="M104 190 L116 196 M120 186 L124 200" stroke="#b9b09a" strokeWidth="2" />
      </g>
      {/* soda can */}
      <g className="dd-prop" style={{ animationDuration: "6.1s", animationDelay: "-1s" }}>
        <g transform="rotate(-24 290 236)">
          <rect x="276" y="218" width="28" height="44" rx="5" fill="#d6342c" stroke={INK} strokeWidth="3" />
          <rect x="276" y="226" width="28" height="7" fill="#f6f3ea" opacity=".8" />
        </g>
      </g>
      {/* pizza box */}
      <g className="dd-prop" style={{ animationDuration: "7s", animationDelay: "-2s" }}>
        <g transform="rotate(8 170 292)">
          <rect x="132" y="272" width="78" height="40" rx="3" fill="#c98a4b" stroke={INK} strokeWidth="3" />
          <ellipse cx="186" cy="290" rx="10" ry="6" fill="#8a5a2c" opacity=".7" />
          <path d="M140 280 H178" stroke={INK} strokeWidth="2" opacity=".5" />
        </g>
      </g>
      {/* banana peel */}
      <g className="dd-prop" style={{ animationDuration: "5.6s", animationDelay: "-3s" }}>
        <path d="M262 318 C268 300 288 296 300 304 C290 306 284 314 286 330 C280 318 272 318 262 330 C262 324 262 322 262 318 Z" fill="#f2cf4a" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      </g>
      {/* fish bones, at the very bottom */}
      <g className="dd-prop" style={{ animationDuration: "8s", animationDelay: "-4s" }}>
        <path d="M110 370 H170 M120 362 L126 378 M134 362 L140 378 M148 362 L154 378" stroke="#e9e3d2" strokeWidth="3" strokeLinecap="round" />
        <path d="M170 370 L184 360 L184 380 Z" fill="#e9e3d2" stroke={INK} strokeWidth="2" />
        <circle cx="104" cy="370" r="7" fill="#e9e3d2" stroke={INK} strokeWidth="2" />
      </g>
    </g>
  );
}

export function Stage({
  players,
  apiRef,
  round,
}: {
  players: Players;
  apiRef: Ref<StageApi>;
  /** When set, the lid opens for a fresh round every time this changes. */
  round?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const lid = useRef<SVGGElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const needle = useRef<SVGGElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const banner = useRef<HTMLDivElement>(null);
  const shine = useRef<HTMLSpanElement>(null);
  const bits = useRef<HTMLDivElement>(null);
  const fx = useRef<HTMLCanvasElement>(null);
  const [shown, setShown] = useState<{ pid: string | null; score: number | null } | null>(null);
  const reduce = useRef(false);

  const { contextSafe } = useGSAP(
    () => {
      reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap.set(card.current, { xPercent: -50, yPercent: -50, opacity: 0 });
      gsap.set(banner.current, { xPercent: -50, opacity: 0 });
      gsap.set(lid.current, { svgOrigin: "338 112", rotation: 0 });
    },
    { scope: root },
  );

  const px = (svgY: number) => ((root.current?.clientHeight ?? H) * svgY) / H;

  const burst = (score: number) => {
    const host = bits.current;
    if (!host || reduce.current) return;
    const colors = ["#d93a3a", "#3fae5a", "#e9c46a", "#f6f3ea", "#c8102e"];
    const n = 10 + Math.round(score / 8);
    for (let i = 0; i < n; i++) {
      const d = document.createElement("span");
      d.className = "absolute rounded-[2px]";
      Object.assign(d.style, {
        left: "50%",
        top: `${(RIM / H) * 100}%`,
        width: `${4 + Math.random() * 6}px`,
        height: `${4 + Math.random() * 6}px`,
        background: colors[i % colors.length],
      });
      host.appendChild(d);
      const a = Math.PI + Math.random() * Math.PI;
      const r = 60 + Math.random() * 90;
      gsap.to(d, {
        x: Math.cos(a) * r,
        y: Math.sin(a) * r * 0.8,
        rotation: Math.random() * 540,
        opacity: 0,
        duration: 0.8 + Math.random() * 0.4,
        ease: "power2.out",
        onComplete: () => d.remove(),
      });
    }
  };

  const shake = (amt: number) => {
    if (reduce.current || !root.current) return;
    gsap.fromTo(
      root.current,
      { x: 0 },
      {
        keyframes: [{ x: -amt }, { x: amt * 0.8 }, { x: -amt * 0.5 }, { x: amt * 0.25 }, { x: 0 }],
        duration: 0.4,
        ease: "none",
      },
    );
  };

  const countTo = (score: number, dur: number) => {
    const o = { v: 0 };
    let last = 0;
    gsap.to(o, {
      v: score,
      duration: dur,
      ease: "power2.out",
      onUpdate: () => {
        const v = Math.round(o.v);
        if (readout.current) readout.current.textContent = String(v);
        if (Math.floor(v / 10) !== Math.floor(last / 10)) sfx.tick();
        last = v;
      },
    });
    gsap.to(needle.current, { y: depthY(score) - depthY(0), duration: dur, ease: "power2.out" });
  };

  const slamBanner = () => {
    const b = banner.current;
    if (!b) return;
    if (reduce.current) {
      gsap.set(b, { opacity: 1, scale: 1, rotation: -3 });
      return;
    }
    gsap.fromTo(b, { opacity: 0, scale: 2.3, rotation: -12 }, { opacity: 1, scale: 1, rotation: -3, duration: 0.42, ease: "back.out(2.2)" });
    gsap.fromTo(shine.current, { xPercent: -120 }, { xPercent: 220, duration: 0.9, delay: 0.3, ease: "power2.inOut" });
  };

  const celebrate = () => {
    if (reduce.current || !fx.current) return;
    const shoot = confetti.create(fx.current, { resize: true, useWorker: true });
    const colors = ["#d93a3a", "#3fae5a", "#e9c46a", "#f6f3ea", "#c8102e"];
    void shoot({ particleCount: 90, spread: 75, startVelocity: 38, origin: { x: 0.5, y: RIM / H }, angle: 90, colors, scalar: 0.9, ticks: 160 });
    setTimeout(() => void shoot({ particleCount: 50, spread: 120, startVelocity: 28, origin: { x: 0.5, y: RIM / H }, colors, scalar: 0.7 }), 180);
  };

  const open = () => {
    setShown(null);
    gsap.set(card.current, { opacity: 0 });
    gsap.set(banner.current, { opacity: 0 });
    gsap.set(needle.current, { y: 0 });
    if (readout.current) readout.current.textContent = "0";
    gsap.fromTo(lid.current, { rotation: 0 }, { rotation: -118, duration: reduce.current ? 0 : 0.7, ease: "back.out(1.6)", delay: 0.15 });
  };
  useEffect(() => {
    if (round === undefined) return;
    // Next frame: the stage has laid out, so the lid animates from a known state.
    const id = requestAnimationFrame(open);
    return () => cancelAnimationFrame(id);
     
  }, [round]);

  useImperativeHandle(apiRef, () => ({
    open,
    reset: contextSafe(() => {
      setShown(null);
      gsap.set(card.current, { opacity: 0 });
      gsap.set(banner.current, { opacity: 0 });
      gsap.set(needle.current, { y: 0 });
      gsap.to(lid.current, { rotation: 0, duration: 0.3 });
    }),
    drop: contextSafe((pid: string | null, score: number | null) => {
      setShown({ pid, score });
      const el = card.current!;
      const h = root.current!.clientHeight;
      return new Promise<void>((done) => {
        if (reduce.current) {
          gsap.set(el, { opacity: 1, left: "50%", top: px(score === null ? 60 : depthY(score)), rotation: 0, scale: 1 });
          if (readout.current) readout.current.textContent = String(score ?? 0);
          gsap.set(needle.current, { y: score === null ? 0 : depthY(score) - depthY(0) });
          slamBanner();
          if (score === null) sfx.buzz();
          else sfx.chime(score);
          done();
          return;
        }
        sfx.whoosh();
        const tl = gsap.timeline({ onComplete: () => done() });
        tl.set(el, { opacity: 1, left: "14%", top: -h * 0.12, rotation: -30, scale: 0.75 });
        // the throw: an arc up and over the rim
        tl.to(el, { left: "50%", duration: 0.75, ease: "power1.out" }, 0);
        tl.to(el, { top: px(40), duration: 0.38, ease: "power2.out" }, 0);
        tl.to(el, { rotation: 200, scale: 0.9, duration: 0.75, ease: "power1.inOut" }, 0);

        if (score === null) {
          // the lid slams, the card bounces off and spins away
          tl.to(lid.current, { rotation: 0, duration: 0.18, ease: "power4.in", onComplete: () => { sfx.slam(); shake(9); } }, 0.2);
          tl.to(el, { top: px(RIM - 40), duration: 0.37, ease: "power2.in" }, 0.38);
          tl.to(el, { top: px(-40), left: "96%", rotation: 560, opacity: 0, duration: 0.7, ease: "power2.out" }, 0.75);
          tl.call(() => { slamBanner(); sfx.buzz(); }, [], 0.85);
          return;
        }
        const target = px(depthY(score));
        tl.to(el, { top: px(RIM + 10), duration: 0.37, ease: "power2.in" }, 0.38);
        tl.call(() => { sfx.thud(score); burst(score); shake(3 + score / 25); gsap.to(".dd-prop", { y: "+=5", duration: 0.12, yoyo: true, repeat: 1, stagger: 0.03 }); }, [], 0.75);
        // sinking through the trash, then a little settle
        tl.to(el, { top: target + px(10), rotation: 360 + (score % 2 ? 7 : -7), scale: 1, duration: 0.55 + score / 160, ease: "power2.in" }, 0.75);
        tl.to(el, { top: target, rotation: 360 + (score % 2 ? -3 : 3), duration: 0.6, ease: "elastic.out(1, 0.45)" });
        tl.call(() => countTo(score, 0.9), [], 0.8);
        tl.call(() => { slamBanner(); sfx.chime(score); if (score >= 90) { celebrate(); shake(10); gsap.fromTo(lid.current, { rotation: -118 }, { rotation: -100, yoyo: true, repeat: 3, duration: 0.09 }); } }, [], "-=0.35");
      });
    }),
  }));

  const t = shown ? tierOf(shown.score) : null;
  return (
    <div ref={root} className="relative mx-auto aspect-[400/440] w-full select-none" aria-hidden>
      {/* spotlight */}
      <div className="absolute inset-[-10%] rounded-full bg-[radial-gradient(closest-side,rgba(201,138,75,0.22),transparent)]" />

      {/* back layer: interior, depth zones, trash */}
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="dd-in" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1f4a39" />
            <stop offset="1" stopColor="#06120c" />
          </linearGradient>
        </defs>
        <path d={`M70 ${RIM} H330 L318 400 H82 Z`} fill="url(#dd-in)" />
        {[0, 25, 60, 90].map((s, i) => (
          <rect key={s} x="78" y={depthY(s)} width="244" height={depthY([25, 60, 90, 100][i]) - depthY(s)} fill={["#7fd49a", "#f6f3ea", "#7fd49a", "#c98a4b"][i]} opacity={[0.03, 0.03, 0.05, 0.08][i]} />
        ))}
        <Props />
        {/* depth scale, outside left */}
        <g fontSize="11" fill="#a4b8ab" fontFamily="var(--font-body)">
          <line x1="44" x2="44" y1={depthY(0)} y2={depthY(100)} stroke="#a4b8ab" strokeOpacity=".35" strokeWidth="2" />
          {[0, 25, 60, 90, 100].map((s) => (
            <g key={s}>
              <line x1="38" x2="50" y1={depthY(s)} y2={depthY(s)} stroke="#a4b8ab" strokeOpacity=".5" strokeWidth="2" />
              <text x="30" y={depthY(s) + 4} textAnchor="end">
                {s}
              </text>
            </g>
          ))}
          <g ref={needle}>
            <path d={`M52 ${depthY(0)} l12 -7 v14 Z`} fill="#f6f3ea" stroke={INK} strokeWidth="2" />
          </g>
        </g>
      </svg>

      {/* the card */}
      <div ref={card} className="absolute top-0 left-1/2 w-[20%] will-change-transform">
        <div
          className="overflow-hidden rounded-xl border-[3px] bg-[#0d241a] shadow-[0_12px_30px_rgba(0,0,0,0.5)]"
          style={{ borderColor: t ? t.hex : "#f6f3ea" }}
        >
          <div className="flex aspect-square items-center justify-center bg-[radial-gradient(circle_at_50%_30%,#2a5a45,#0d241a)]">
            {shown?.pid ? <Face pid={shown.pid} players={players} size={72} /> : <span className="font-display text-4xl font-black text-[var(--ticket)]">?</span>}
          </div>
          <p className="truncate px-1.5 py-1 text-center text-[10px] leading-tight font-bold sm:text-[11px]">
            {shown?.pid ? pname(players, shown.pid) : "Nobody"}
          </p>
        </div>
      </div>

      {/* front layer: glass cutaway, rim, ribs, wheels, lid */}
      <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="dd-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6f3ea" stopOpacity=".09" />
            <stop offset=".45" stopColor="#f6f3ea" stopOpacity=".02" />
            <stop offset=".5" stopColor="#f6f3ea" stopOpacity=".1" />
            <stop offset=".56" stopColor="#f6f3ea" stopOpacity=".02" />
          </linearGradient>
        </defs>
        <path d={`M70 ${RIM} H330 L318 400 H82 Z`} fill="url(#dd-glass)" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
        {/* ribs */}
        {[150, 250].map((x) => (
          <path key={x} d={`M${x} ${RIM + 6} L${x - (x < 200 ? 4 : -4)} 394`} stroke={INK} strokeOpacity=".5" strokeWidth="4" />
        ))}
        {/* rim */}
        <rect x="58" y={RIM - 10} width="284" height="16" rx="5" fill="#1f4a39" stroke={INK} strokeWidth="5" />
        <rect x="70" y="392" width="260" height="20" rx="4" fill="#1f4a39" stroke={INK} strokeWidth="5" />
        <text x="200" y="408" textAnchor="middle" fontSize="13" fontWeight="900" fill="#f6f3ea" fillOpacity=".5" fontFamily="var(--font-trash-display)" letterSpacing="3">
          TRASH
        </text>
        {/* wheels */}
        {[104, 296].map((x) => (
          <g key={x}>
            <circle cx={x} cy="420" r="13" fill={INK} />
            <circle cx={x} cy="420" r="5" fill="#a4b8ab" />
          </g>
        ))}
        {/* lid, hinged at the back right */}
        <g ref={lid}>
          <path d={`M56 ${RIM - 26} H340 L338 ${RIM - 8} H58 Z`} fill="#2a5a45" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
          <rect x="180" y={RIM - 33} width="40" height="8" rx="3" fill={INK} />
          {HOLIDAY ? (
            <path
              d={`M58 ${RIM - 26} Q 70 ${RIM - 40} 90 ${RIM - 30} Q 110 ${RIM - 44} 140 ${RIM - 31} Q 170 ${RIM - 42} 176 ${RIM - 30} L 226 ${RIM - 30} Q 250 ${RIM - 44} 280 ${RIM - 31} Q 310 ${RIM - 42} 338 ${RIM - 26} Z`}
              fill="#f6f3ea"
              stroke={INK}
              strokeWidth="3"
              strokeLinejoin="round"
            />
          ) : null}
        </g>
      </svg>

      {/* debris + confetti */}
      <div ref={bits} className="pointer-events-none absolute inset-0" />
      <canvas ref={fx} className="pointer-events-none absolute inset-[-20%] h-[140%] w-[140%]" />

      {/* score readout */}
      <div className="absolute top-[2%] right-[4%] text-right">
        <span ref={readout} className="font-display block text-5xl leading-none font-black tabular-nums" style={{ color: t?.color ?? "var(--paper)" }}>
          0
        </span>
        <span className="text-[11px] text-[var(--muted)]">niche points</span>
      </div>

      {/* tier banner */}
      <div ref={banner} className="absolute top-[34%] left-1/2 overflow-hidden rounded-lg border-[3px] px-4 py-1.5 whitespace-nowrap shadow-[0_10px_30px_rgba(0,0,0,0.5)]" style={{ borderColor: INK, background: t?.hex ?? "#f6f3ea" }}>
        <span className="font-display relative z-10 text-2xl font-black text-[#10141a] sm:text-3xl">{t?.label ?? ""}</span>
        <span ref={shine} className="absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/50" />
      </div>
    </div>
  );
}
