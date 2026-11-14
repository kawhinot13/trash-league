"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { RICO_BASE } from "./rico-art";

/**
 * Kilroy was here, Trash edition: a cartoon RI3O peeks over a scorer's-table
 * plank at the bottom of the screen, looks around, says something, and ducks
 * the moment your cursor gets close. Tap him on a phone and he ducks too.
 * Purely decorative (aria-hidden), never blocks content for long.
 */

const INK = "#10141a";
const SKIN = "#bf7a4d";
const SHADE = "#9c5d3c";

// The head is drawn in a 888x956 space (the reference photo, straightened); this frames it.
const VB = { x: 60, y: 20, w: 710, h: 900 };
/** Down to just under the nose, in art units from the top of the frame. */
const PEEK_TO = 712 - VB.y;

const EYES = [
  {
    d: "M262 514 C284 488 342 484 368 510 C344 534 290 538 262 514 Z",
    lid: "M258 514 C282 482 344 478 372 508 C340 494 290 496 258 514 Z",
    under: "M276 546 C304 558 340 556 362 540",
    cx: 318,
  },
  {
    d: "M466 510 C492 484 550 488 574 514 C546 538 492 534 466 510 Z",
    lid: "M462 508 C490 478 552 482 578 514 C546 496 496 494 462 508 Z",
    under: "M474 540 C496 556 532 558 560 546",
    cx: 518,
  },
];

function RicoFace({
  look,
  blink,
  brow,
}: {
  look: { x: number; y: number };
  blink: boolean;
  brow: boolean;
}) {
  return (
    <svg
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      className="block h-auto w-full overflow-visible"
      aria-hidden
    >
      <g dangerouslySetInnerHTML={{ __html: RICO_BASE }} />
      <g
        fill="#1c1410"
        stroke={INK}
        strokeWidth="6"
        strokeLinejoin="round"
        style={{
          transform: `translateY(${brow ? -18 : 0}px)`,
          transition: "transform 180ms cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <path d="M232 470 C262 446 320 438 374 442 L372 470 C330 466 280 470 240 488 Z" />
        <path d="M470 442 C524 436 580 444 610 466 L602 486 C566 470 520 466 472 470 Z" />
      </g>
      {EYES.map((e, i) => (
        <g
          key={i}
          style={{
            transformBox: "view-box",
            transformOrigin: `${e.cx}px 510px`,
            transform: `scaleY(${blink ? 0.08 : 1})`,
            transition: "transform 70ms ease-out",
          }}
        >
          <clipPath id={`rico-eye-${i}`}>
            <path d={e.d} />
          </clipPath>
          <path d={e.d} fill="#fbf6ec" stroke={INK} strokeWidth="10" strokeLinejoin="round" />
          <g clipPath={`url(#rico-eye-${i})`}>
            <g
              style={{
                transform: `translate(${look.x * 14}px, ${look.y * 6}px)`,
                transition: "transform 160ms cubic-bezier(0.23, 1, 0.32, 1)",
              }}
            >
              <circle cx={e.cx} cy={510} r="21" fill="#3a2316" />
              <circle cx={e.cx} cy={510} r="10" fill="#0b0b0b" />
              <circle cx={e.cx + 7} cy={503} r="5" fill="#fff" />
            </g>
          </g>
          <path d={e.lid} fill={SHADE} stroke={INK} strokeWidth="10" strokeLinejoin="round" />
        </g>
      ))}
      {EYES.map((e, i) => (
        <path key={i} d={e.under} fill="none" stroke="#7a442c" strokeWidth="7" strokeLinecap="round" />
      ))}
    </svg>
  );
}

/** Four cartoon fingertips hooked over the plank. */
const Hand = ({ flip }: { flip?: boolean }) => (
  <svg
    viewBox="0 0 64 30"
    className="block h-auto w-full"
    style={{ transform: flip ? "scaleX(-1)" : undefined }}
    aria-hidden
  >
    {[4, 18, 32, 46].map((x, i) => (
      <g key={x}>
        <path
          d={`M${x} 30 L${x} ${12 - (i === 1 || i === 2 ? 3 : 0)} C${x} ${2 - (i === 1 || i === 2 ? 3 : 0)} ${x + 14} ${2 - (i === 1 || i === 2 ? 3 : 0)} ${x + 14} ${12 - (i === 1 || i === 2 ? 3 : 0)} L${x + 14} 30 Z`}
          fill={SKIN}
          stroke={INK}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d={`M${x + 4} ${10 - (i === 1 || i === 2 ? 3 : 0)} h6`} stroke={SHADE} strokeWidth="2" strokeLinecap="round" />
      </g>
    ))}
  </svg>
);

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function RicoPeek({ trades, record }: { trades: number; record: string }) {
  const reduce = useReducedMotion();
  const [up, setUp] = useState(false);
  const [x, setX] = useState(40);
  const [say, setSay] = useState<string | null>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [brow, setBrow] = useState(false);
  const [w, setW] = useState(160);
  const [side, setSide] = useState<"l" | "r">("l");
  const [room, setRoom] = useState(220);
  const head = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const dodges = useRef(0);
  const peeks = useRef(0);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const LINES = [
    `${trades} trades. Got anything for me?`,
    "Just checking the wire.",
    `Career ${record}. It's a process.`,
    "Is the Lock-In Index still up?",
    "Who's selling?",
  ];

  // peek and duck call each other on timers, so they live on a ref that's refreshed each render.
  type Api = { peek: (line?: string) => void; duck: (next: number, line?: string) => void };
  const api = useRef<Api>({ peek: () => {}, duck: () => {} });
  useEffect(() => {
    api.current.peek = (line?: string) => {
      // Stay out of the way: never peek while the tab is hidden or a game is on screen.
      const busy = [...document.querySelectorAll("[data-no-rico]")].some((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
      });
      if (document.hidden || busy) {
        later(() => api.current.peek(line), 15000);
        return;
      }
      const vw = window.innerWidth;
      const size = vw < 640 ? 92 : 150;
      setW(size);
      const nx = rand(12, Math.max(14, vw - size - 76));
      setX(nx);
      // the bubble opens toward the middle of the screen so it never runs off an edge
      const s = nx + (size + 64) / 2 > vw / 2 ? "r" : "l";
      setSide(s);
      const anchor = nx + 32 + size * (s === "l" ? 0.45 : 0.55);
      setRoom(Math.min(220, (s === "l" ? vw - anchor : anchor) - 14));
      setUp(true);
      setLook({ x: rand(-1, 1), y: 0.4 });
      peeks.current += 1;
      later(() => setBrow(true), 700);
      later(() => setBrow(false), 1100);
      later(() => setSay(line ?? LINES[(peeks.current - 1) % LINES.length]), 900);
      later(() => setBlink(true), 2100);
      later(() => setBlink(false), 2230);
      later(() => setLook({ x: -1, y: 0.3 }), 2600);
      later(() => setLook({ x: 1, y: 0.3 }), 3400);
      later(() => api.current.duck(rand(35000, 55000)), 5200);
    };
    api.current.duck = (next: number, line?: string) => {
      clear();
      setSay(null);
      setUp(false);
      later(() => api.current.peek(line), next);
    };
  });

  // First visit: wait until they've scrolled past the hero and had a moment to read.
  useEffect(() => {
    let started = false;
    const go = () => {
      if (started || window.scrollY < window.innerHeight * 1.2) return;
      started = true;
      later(() => api.current.peek(), reduce ? 15000 : 10000);
    };
    window.addEventListener("scroll", go, { passive: true });
    go();
    return () => {
      window.removeEventListener("scroll", go);
      clear();
    };
  }, [reduce]);

  // Desktop: track the cursor with his eyes, and duck if it gets close.
  useEffect(() => {
    if (!up) return;
    // At most one update per frame: pointermove can fire far faster than the screen refreshes.
    let queued = false;
    let last: PointerEvent | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      last = e;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (last) check(last);
      });
    };
    const check = (e: PointerEvent) => {
      if (!head.current) return;
      const r = head.current.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      const nx = Math.round(Math.max(-1, Math.min(1, dx / 300)) * 10) / 10;
      const ny = Math.round(Math.max(-1, Math.min(1, dy / 300)) * 10) / 10;
      setLook((l) => (l.x === nx && l.y === ny ? l : { x: nx, y: ny }));
      if (d < r.width * 0.95) {
        dodges.current += 1;
        const tired = dodges.current >= 3;
        if (tired) dodges.current = 0;
        api.current.duck(tired ? 45000 : rand(5000, 8000), tired ? undefined : "Too slow.");
      }
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [up]);

  const plankW = w + 64;
  const visible = (w * PEEK_TO) / VB.w; // down to just under the nose
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-0 z-40 select-none"
      style={{ left: x, width: plankW }}
    >
      <AnimatePresence>
        {up && say ? (
          <motion.div
            key={say}
            initial={{ opacity: 0, scale: reduce ? 1 : 0.9, y: reduce ? 0 : 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.3 }}
            className="absolute z-10 w-max rounded-2xl border-[3px] bg-[var(--paper)] px-3 py-2 text-sm font-semibold text-[var(--bin)] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            style={{
              borderColor: INK,
              bottom: visible + 30,
              maxWidth: room,
              ...(side === "l" ? { left: 32 + w * 0.45 } : { right: 32 + w * 0.45 }),
              transformOrigin: side === "l" ? "0% 100%" : "100% 100%",
            }}
          >
            {say}
            <span
              className={`absolute -bottom-[9px] size-4 rotate-45 border-r-[3px] border-b-[3px] bg-[var(--paper)] ${side === "l" ? "left-5" : "right-5"}`}
              style={{ borderColor: INK }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        initial={false}
        animate={{ y: up ? 0 : visible + 40, opacity: reduce ? (up ? 1 : 0) : 1 }}
        transition={
          up
            ? { type: "spring", duration: reduce ? 0.01 : 0.7, bounce: 0.25 }
            : { duration: reduce ? 0.15 : 0.16, ease: [0.55, 0, 1, 0.45] }
        }
      >
        {/* head, clipped at the top of the plank */}
        <div className="relative overflow-hidden" style={{ height: visible, marginLeft: 32, width: w }}>
          <motion.div
            ref={head}
            className="pointer-events-auto absolute inset-x-0 top-0 cursor-pointer"
            onPointerDown={(e) => {
              if (e.pointerType !== "mouse") api.current.duck(rand(30000, 45000));
            }}
            animate={up && !reduce ? { rotate: [0, -4, 3, 0] } : { rotate: 0 }}
            transition={{ duration: 3.2, delay: 1.4, ease: "easeInOut" }}
            style={{ transformOrigin: "50% 100%" }}
          >
            <RicoFace look={look} blink={blink} brow={brow} />
          </motion.div>
        </div>
        {/* the wall: a scorer's-table plank with the classic scrawl */}
        <div
          className="relative h-7 rounded-t-md border-[3px] border-b-0"
          style={{
            borderColor: INK,
            background:
              "repeating-linear-gradient(90deg, var(--wood) 0 46px, var(--wood-2) 46px 48px)",
          }}
        >
          <span className="font-display absolute right-2 bottom-0.5 -rotate-2 text-[11px] font-black tracking-wide text-[var(--paper)]/85">
            RI3O WAS HERE
          </span>
          <div className="absolute -top-[15px]" style={{ left: 32 + w * 0.04, width: w * 0.3 }}>
            <Hand />
          </div>
          <div className="absolute -top-[15px]" style={{ left: 32 + w * 0.66, width: w * 0.3 }}>
            <Hand flip />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
