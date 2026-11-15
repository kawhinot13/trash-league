"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { RicoFace } from "../trash/rico-peek";
import { GirlFace } from "./girl";
import { GoldPig, RicoShirt } from "./pig-art";

/**
 * The flying gold pig. On each visit there's a 1 in 100 chance Rico and his date ride a
 * fart-propelled gold pig across the screen for 8 seconds. Add ?pig to the URL to force it.
 * Never shown with reduced motion, never blocks a click.
 */
const DURATION = 8;
const PUFFS = 9;

function Puff({ i }: { i: number }) {
  const size = 34 + ((i * 13) % 26);
  return (
    <motion.span
      className="absolute rounded-full"
      style={{
        left: "2%",
        top: `${44 + ((i * 7) % 18)}%`,
        width: size,
        height: size,
        background: "radial-gradient(circle at 35% 35%, #e3f2a8, #a9cc5a 60%, #7fa83c)",
        border: "3px solid #4d6b22",
        boxShadow: `${size * 0.3}px ${-size * 0.15}px 0 -${size * 0.12}px #c5e07a`,
      }}
      initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
      animate={{ x: [-10, -140 - (i % 3) * 30], y: [0, -20 + (i % 4) * 14], scale: [0.4, 1.5], opacity: [0.95, 0] }}
      transition={{ duration: 1.1, repeat: Infinity, delay: i * (1.1 / PUFFS), ease: "easeOut" }}
    />
  );
}

export function PigRide() {
  const [on, setOn] = useState(false);
  const [vw, setVw] = useState(1200);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const forced = new URLSearchParams(window.location.search).has("pig");
    if (reduce || !(forced || Math.random() < 0.01)) return;
    const start = setTimeout(() => {
      setVw(window.innerWidth);
      setOn(true);
    }, forced ? 600 : 2500);
    const stop = setTimeout(() => setOn(false), (forced ? 600 : 2500) + DURATION * 1000);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, []);

  return (
    <AnimatePresence>
      {on ? (
        <motion.div
          key="pig"
          aria-hidden
          className="pointer-events-none fixed top-[18%] left-0 z-[70] w-[clamp(240px,34vw,440px)]"
          initial={{ x: -Math.min(440, Math.max(240, vw * 0.34)) * 1.4 }}
          animate={{ x: [-Math.min(440, Math.max(240, vw * 0.34)) * 1.4, vw + 120], y: [0, -50, 20, -70, 10, -30, 0], rotate: [-4, 3, -3, 4, -2, 3, -4] }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION, ease: "linear", times: [0, 0.17, 0.33, 0.5, 0.67, 0.83, 1] }}
        >
          {/* fart trail out the back */}
          <div className="absolute inset-0">
            {Array.from({ length: PUFFS }, (_, i) => (
              <Puff key={i} i={i} />
            ))}
            <motion.span
              className="font-display absolute -left-[22%] top-[30%] -rotate-12 text-[clamp(1.6rem,3vw,2.6rem)] font-black text-[#e8f7a8] [text-shadow:0_3px_0_#2f4512,0_0_14px_rgba(197,224,122,0.7)] [-webkit-text-stroke:2px_#2f4512]"
              animate={{ opacity: [0, 1, 0], y: [8, -8, -18], scale: [0.7, 1.15, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.6 }}
            >
              PFFFT
            </motion.span>
          </div>
          {/* riders: torsos sit behind the pig's back edge, heads above */}
          <div className="absolute top-[-4%] left-[38%] w-[25%] rotate-[4deg]">
            <div className="relative w-full" style={{ marginBottom: "-38%" }}>
              <GirlFace />
            </div>
          </div>
          <div className="absolute top-[-17%] left-[54%] w-[27%] rotate-[-5deg]">
            <div className="relative w-[78%] translate-x-[14%]">
              <RicoFace look={{ x: -0.5, y: 0.2 }} blink={false} brow={false} />
            </div>
            <div className="-mt-[14%] w-full">
              <RicoShirt />
            </div>
          </div>
          {/* the pig, bobbing as it flaps */}
          <motion.div
            className="relative"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.45, repeat: Infinity, ease: "easeInOut" }}
          >
            <GoldPig />
          </motion.div>
          {/* sparkle trail */}
          {[0, 1, 2].map((k) => (
            <motion.span
              key={k}
              className="absolute size-2 rounded-full bg-[#ffe08a] shadow-[0_0_10px_3px_#ffe08a]"
              style={{ left: `${10 + k * 12}%`, top: `${20 + k * 25}%` }}
              animate={{ opacity: [0, 1, 0], scale: [0.4, 1.3, 0.4] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: k * 0.3 }}
            />
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
