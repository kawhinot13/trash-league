"use client";

import { useSyncExternalStore } from "react";

const Q = "(max-width: 639px)";
/** True on phone-width screens (false on the server and on first render, so markup stays stable). */
export function usePhone() {
  return useSyncExternalStore(
    (f) => {
      const m = window.matchMedia(Q);
      m.addEventListener("change", f);
      return () => m.removeEventListener("change", f);
    },
    () => window.matchMedia(Q).matches,
    () => false,
  );
}
