import { RevealTitle } from "./polish";

/** Section titles and the hardwood "court" panel: shared by the Trash site and Rafterlore. */
export function SectionHead({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto mb-6 max-w-6xl px-5 md:mb-14 md:px-10">
      <RevealTitle id={id}>{title}</RevealTitle>
      {children ? (
        <div className="mt-3 max-w-[60ch] text-base leading-relaxed text-[var(--muted)] md:mt-5 md:text-lg">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* ── The court: hardwood section wrapper ───────────── */
export function Court({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="relative overflow-hidden py-14 text-[#1d140b] md:py-32"
      style={{
        background:
          "repeating-linear-gradient(90deg, var(--wood) 0 84px, var(--wood-2) 84px 86px)",
      }}
    >
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full opacity-40"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="18"
          fill="none"
          stroke="#fff"
          strokeWidth="0.35"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="50"
          y1="0"
          x2="50"
          y2="100"
          stroke="#fff"
          strokeWidth="0.35"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative mx-auto max-w-6xl px-5 md:px-10">
        <div className="mb-8">
          <RevealTitle id={id}>{title}</RevealTitle>
        </div>
        {children}
      </div>
    </section>
  );
}

/* ── Live standings, set on the court ───────────────── */
