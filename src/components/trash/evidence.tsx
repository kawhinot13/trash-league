/**
 * On phones, a trade crime's player panels fold away behind "See the evidence" so the page stays
 * short; from `sm` up they're always shown. Pure CSS (a hidden checkbox), so nothing shifts on load.
 */
export function Evidence({ id, count, children, className = "" }: { id: string; count: number; children: React.ReactNode; className?: string }) {
  const btn =
    "mt-5 inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-semibold transition-colors hover:bg-white/8 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--paper)] sm:hidden";
  return (
    <>
      <input type="checkbox" id={`ev-${id}`} className="peer sr-only" aria-label={`Show the players in this trade (${count})`} />
      <label htmlFor={`ev-${id}`} className={`${btn} peer-checked:hidden`}>
        See the evidence <span className="text-[var(--muted)]">({count} player{count === 1 ? "" : "s"})</span>
      </label>
      <label htmlFor={`ev-${id}`} className={`${btn} hidden peer-checked:inline-flex peer-checked:sm:hidden`}>
        Hide the evidence
      </label>
      <div className={`hidden peer-checked:grid sm:grid ${className}`}>{children}</div>
    </>
  );
}
