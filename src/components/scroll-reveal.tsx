"use client";

import { useRef } from "react";
import { gsap, SplitText, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/** Paragraph that "inks in" character by character as you scroll through it. */
export function ScrollReveal({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = SplitText.create(ref.current, { type: "words,chars" });
        gsap.fromTo(
          split.chars,
          { opacity: 0.12 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.04,
            scrollTrigger: {
              trigger: ref.current,
              start: "top 80%",
              end: "bottom 45%",
              scrub: 0.6,
            },
          },
        );
        return () => split.revert();
      });
    },
    { scope: ref },
  );

  return (
    <p ref={ref} className={cn(className)}>
      {children}
    </p>
  );
}

/** Headline whose lines rise out of a mask on load. */
export function RiseHeadline({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        SplitText.create(ref.current, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 110,
              duration: 1.2,
              ease: "expo.out",
              stagger: 0.1,
              delay: 0.15,
            }),
        });
      });
      gsap.set(ref.current, { autoAlpha: 1 });
    },
    { scope: ref },
  );

  return (
    <h1 ref={ref} className={cn("invisible", className)}>
      {children}
    </h1>
  );
}
