import { MARK_PATH, MARK_VIEWBOX } from "@/components/app/mark-path";

/** Rafterlore's ribbon R. Takes the text color (white on the dark site). */
export function RMark({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  );
}

/**
 * Loading mark: the ribbon's outline draws itself, then fills in, on a loop. With reduced motion it
 * is simply the logo. Pure CSS (globals.css .r-loader), so it shows before any script runs.
 */
export function RLoader({ label = "Loading", className = "size-20" }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-5">
      <svg viewBox={MARK_VIEWBOX} className={`r-loader overflow-visible ${className}`} aria-hidden>
        <path d={MARK_PATH} pathLength={1} />
      </svg>
      <span className="text-sm font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">{label}</span>
    </div>
  );
}
