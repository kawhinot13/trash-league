"use client";

import { useEffect, useState } from "react";

/** Days until Christmas (Eastern time), or a Merry Christmas on the day. Renders after mount. */
export function XmasCountdown() {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const f = () => {
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
      let xmas = new Date(now.getFullYear(), 11, 25);
      if (now > new Date(now.getFullYear(), 11, 26)) xmas = new Date(now.getFullYear() + 1, 11, 25);
      setDays(Math.ceil((xmas.getTime() - now.getTime()) / 86400000));
    };
    f();
    const t = setInterval(f, 60000);
    return () => clearInterval(t);
  }, []);
  if (days === null) return null;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#c8102e]/50 bg-[#c8102e]/15 px-3 py-1 text-sm font-semibold text-[#ffd7dc]">
      <span aria-hidden>🎄</span>
      {days <= 0 ? "Merry Christmas from the Trash league" : `${days} day${days === 1 ? "" : "s"} until Christmas`}
    </span>
  );
}
