"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { ShimmerButton } from "@/components/ui/shimmer-button";

export const HeroCanvas = dynamic(() => import("@/components/hero-object"), {
  ssr: false,
  loading: () => null,
});

const ease = [0.22, 1, 0.36, 1] as const;

const notes = [
  {
    n: "01",
    title: "Weight",
    body: "Lenis gives every scroll a little inertia: the page glides to a stop instead of jumping.",
  },
  {
    n: "02",
    title: "Timing",
    body: "GSAP ScrollTrigger ties the type to your scroll position, so the reading pace is yours.",
  },
  {
    n: "03",
    title: "Depth",
    body: "A real-time three.js object leans toward your cursor, or your thumb, as you move.",
  },
];

export function Notes() {
  const reduce = useReducedMotion();
  return (
    <ol className="grid gap-px bg-[var(--rule)] md:grid-cols-3">
      {notes.map((item, i) => (
        <li key={item.n} className="bg-[var(--paper)] p-6 md:p-10">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: 0.9, ease, delay: i * 0.08 }}
          >
            <span className="font-mono text-xs tracking-widest text-[var(--signal)]">
              {item.n}
            </span>
            <h3 className="mt-6 font-heading text-4xl italic md:text-5xl">
              {item.title}
            </h3>
            <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-[var(--ink-soft)]">
              {item.body}
            </p>
          </motion.div>
        </li>
      ))}
    </ol>
  );
}

export function SubscribeButton() {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="inline-block"
    >
      <ShimmerButton
        background="#111010"
        shimmerColor="#e2401c"
        shimmerSize="0.08em"
        className="px-8 py-4 text-sm font-medium tracking-[0.18em] uppercase"
      >
        Subscribe to the issue
        <span
          aria-hidden
          className="ml-3 transition-transform duration-300 group-hover:translate-x-1"
        >
          →
        </span>
      </ShimmerButton>
    </motion.div>
  );
}
