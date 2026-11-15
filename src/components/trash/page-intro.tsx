import { HOLIDAY } from "@/lib/holiday";

/** The calm top of every inner page: one title, one line, room to breathe under the nav. */
export function PageIntro({
  title,
  children,
  holiday = HOLIDAY,
}: {
  title: string;
  children?: React.ReactNode;
  holiday?: boolean;
}) {
  return (
    <header className="mx-auto max-w-6xl px-5 pt-32 pb-6 md:px-10 md:pt-40">
      <h1 className="font-display flex items-start gap-3 text-[clamp(3.6rem,11vw,8rem)] leading-[0.82] font-black">
        {title}
        {holiday ? (
          <svg viewBox="0 0 60 50" className="mt-1 w-[0.42em] shrink-0" aria-hidden>
            <path d="M30 26 C 18 10 6 14 2 6 C 12 4 14 14 22 12 C 20 4 28 2 30 0 C 32 10 26 16 30 26 Z" fill="#2f8a4a" stroke="#10141a" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M30 26 C 42 10 54 14 58 6 C 48 4 46 14 38 12 C 40 4 32 2 30 0" fill="#3fae5a" stroke="#10141a" strokeWidth="2.5" strokeLinejoin="round" />
            <circle cx="24" cy="32" r="7" fill="#d93a3a" stroke="#10141a" strokeWidth="2.5" />
            <circle cx="36" cy="33" r="7" fill="#c8102e" stroke="#10141a" strokeWidth="2.5" />
            <circle cx="30" cy="42" r="7" fill="#d93a3a" stroke="#10141a" strokeWidth="2.5" />
          </svg>
        ) : null}
      </h1>
      {children ? (
        <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-[var(--muted)]">
          {children}
        </p>
      ) : null}
    </header>
  );
}
