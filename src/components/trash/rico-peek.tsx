"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { RICO_BASE, RICO_HAIR } from "./rico-art";

/**
 * Kilroy was here, Trash edition: a cartoon RI3O peeks over a scorer's-table
 * plank at the bottom of the screen, looks around, says something, and ducks
 * the moment your cursor gets close. Tap him on a phone and he ducks too.
 * Purely decorative (aria-hidden), never blocks content for long.
 */

const INK = "#10141a";
const SKIN = "#c27b4b";
const SHADE = "#a2633f";

// Head art lives in photo coordinates (traced from a tilted photo); LEVEL rotates it upright.
const LEVEL = 13.3;
// This window frames the upright head.
const VB = { x: 30, y: -20, w: 830, h: 880 };
/** Down to just under the nose, in art units from the top of the frame. */
const PEEK_TO = 694 - VB.y;

const EYE_L = "M258 541 C272 520 312 506 354 520 C336 546 292 556 258 541 Z";
const EYE_R = "M460 494 C478 470 524 456 564 470 C548 494 500 506 460 494 Z";
const EYES = [
  { d: EYE_L, cx: 306, cy: 530, lid: "M252 544 C268 516 314 500 360 518 C318 512 282 522 258 546 Z", under: "M268 556 C292 566 326 560 346 544" },
  { d: EYE_R, cx: 514, cy: 481, lid: "M454 497 C474 466 526 450 570 466 C528 462 490 470 460 498 Z", under: "M472 506 C500 514 536 506 556 490" },
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
      <g transform={`rotate(${LEVEL} 410 560)`}>
      <g dangerouslySetInnerHTML={{ __html: RICO_BASE }} />
      {EYES.map((e, i) => (
        <g
          key={i}
          style={{
            transformBox: "view-box",
            transformOrigin: `${e.cx}px ${e.cy}px`,
            transform: `scaleY(${blink ? 0.08 : 1})`,
            transition: "transform 70ms ease-out",
          }}
        >
          <clipPath id={`rico-eye-${i}`}>
            <path d={e.d} />
          </clipPath>
          <path d={e.d} fill="#fbf6ec" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
          <g
            clipPath={`url(#rico-eye-${i})`}
          >
            <g
              style={{
                transform: `translate(${look.x * 13}px, ${look.y * 6}px)`,
                transition: "transform 160ms cubic-bezier(0.23, 1, 0.32, 1)",
              }}
            >
              <circle cx={e.cx} cy={e.cy} r="21" fill="#3a2214" />
              <circle cx={e.cx} cy={e.cy} r="10" fill="#070707" />
              <circle cx={e.cx + 7} cy={e.cy - 7} r="5" fill="#fff" />
            </g>
          </g>
          <path d={e.lid} fill={INK} />
        </g>
      ))}
      {EYES.map((e, i) => (
        <path key={i} d={e.under} fill="none" stroke="#7d4429" strokeWidth="5" strokeLinecap="round" />
      ))}
      <g
        fill="#1b130f"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
        style={{
          transform: `translateY(${brow ? -16 : 0}px)`,
          transition: "transform 180ms cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <path d="M206 506 C222 484 268 470 318 464 C342 461 362 458 376 456 L380 478 C352 482 320 486 290 490 C258 494 232 502 214 514 Z" />
        <path d="M428 434 C460 420 512 412 556 422 C574 427 588 436 596 446 L586 460 C566 450 540 444 512 444 C480 444 456 450 434 456 Z" />
      </g>
      <g dangerouslySetInnerHTML={{ __html: RICO_HAIR }} />
      </g>
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
      if (document.hidden) {
        later(() => api.current.peek(line), 8000);
        return;
      }
      const vw = window.innerWidth;
      const size = vw < 640 ? 118 : 160;
      setW(size);
      const nx = rand(12, Math.max(14, vw - size - 76));
      setX(nx);
      // the bubble opens toward the middle of the screen so it never runs off an edge
      setSide(nx + (size + 64) / 2 > vw / 2 ? "r" : "l");
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
      later(() => api.current.duck(rand(18000, 30000)), 5200);
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
      later(() => api.current.peek(), reduce ? 9000 : 5000);
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
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !head.current) return;
      const r = head.current.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      setLook({ x: Math.max(-1, Math.min(1, dx / 300)), y: Math.max(-1, Math.min(1, dy / 300)) });
      if (d < r.width * 0.95) {
        dodges.current += 1;
        const tired = dodges.current >= 3;
        if (tired) dodges.current = 0;
        api.current.duck(tired ? 45000 : rand(2500, 4000), tired ? undefined : "Too slow.");
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
            className="absolute z-10 w-max max-w-[220px] rounded-2xl border-[3px] bg-[var(--paper)] px-3 py-2 text-sm font-semibold text-[var(--bin)] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            style={{
              borderColor: INK,
              bottom: visible + 30,
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
              if (e.pointerType !== "mouse") api.current.duck(rand(15000, 25000));
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
