"use client";

/**
 * Shared GSAP setup. Import gsap, plugins and useGSAP from here (never from
 * "gsap" directly) so plugins are always registered exactly once.
 *
 *   import { gsap, ScrollTrigger, SplitText, useGSAP } from "@/lib/gsap";
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);
  gsap.defaults({ ease: "power3.out", duration: 0.9 });
}

/** Editorial easing curves, reused across the site. */
export const EASE = {
  out: "power3.out",
  inOut: "power2.inOut",
  expo: "expo.out",
} as const;

export { gsap, ScrollTrigger, SplitText, useGSAP };
