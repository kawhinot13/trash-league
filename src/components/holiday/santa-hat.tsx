/** A cartoon Santa hat in the site's ink style. Position it with className. */
export function SantaHat({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 90" className={className} style={style} aria-hidden>
      <path d="M14 70 C 22 30 50 6 84 10 C 98 12 106 22 104 40 C 98 30 90 28 84 32 C 74 40 70 56 70 70 Z" fill="#c8102e" stroke="#10141a" strokeWidth="5" strokeLinejoin="round" />
      <path d="M40 30 C 52 20 66 16 80 18" stroke="#e8505f" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".7" />
      <rect x="6" y="62" width="76" height="20" rx="10" fill="#f6f3ea" stroke="#10141a" strokeWidth="5" />
      <circle cx="104" cy="44" r="12" fill="#f6f3ea" stroke="#10141a" strokeWidth="5" />
    </svg>
  );
}
