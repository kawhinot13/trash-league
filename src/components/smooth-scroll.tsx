"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { useEffect, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

/**
 * Drives Lenis from GSAP's ticker so ScrollTrigger and Lenis stay frame-locked.
 * useLenis() hands us the instance only once it exists; wiring it up any
 * earlier leaves Lenis eating wheel events without ever moving the page.
 */
function GsapSync() {
  const lenis = useLenis();
  useEffect(() => {
    if (!lenis) return;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.off("scroll", ScrollTrigger.update);
    };
  }, [lenis]);
  return null;
}

/** Lenis smooth scroll. Skipped entirely for prefers-reduced-motion: native scrolling only. */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [smooth, setSmooth] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSmooth(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!smooth) return <>{children}</>;
  return (
    <ReactLenis root options={{ autoRaf: false, lerp: 0.1, smoothWheel: true }}>
      <GsapSync />
      {children}
    </ReactLenis>
  );
}
