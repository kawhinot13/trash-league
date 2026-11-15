/** Gold cartoon pig with flapping wings (wings animate via the .pig-wing class). Faces right. viewBox 0 0 420 300. */
const INK = "#10141a";

export function GoldPig() {
  return (
    <svg viewBox="0 0 420 300" className="block h-auto w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="pig-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.45" stopColor="#f2c14e" />
          <stop offset="1" stopColor="#c78f22" />
        </linearGradient>
        <linearGradient id="pig-wing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f3e3b0" />
        </linearGradient>
      </defs>
      {/* back wing */}
      <g transform="translate(-62 6)"><g className="pig-wing pig-wing-back" style={{ transformOrigin: "190px 120px" }}>
        <path d="M190 120 C 160 50 120 20 70 24 C 96 40 104 60 92 72 C 118 74 132 86 128 100 C 152 98 172 108 190 120 Z" fill="url(#pig-wing)" stroke={INK} strokeWidth="7" strokeLinejoin="round" opacity=".9" />
      </g></g>
      {/* curly tail */}
      <path d="M70 160 C 40 150 30 120 52 112 C 70 108 72 132 56 134 C 44 136 42 120 50 116" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path d="M70 160 C 40 150 30 120 52 112 C 70 108 72 132 56 134 C 44 136 42 120 50 116" fill="none" stroke="#f2c14e" strokeWidth="4" strokeLinecap="round" />
      {/* legs */}
      {[110, 150, 250, 290].map((x, i) => (
        <path key={x} d={`M${x} 214 L ${x - 6 + (i % 2) * 4} 262 L ${x + 22} 262 L ${x + 26} 214 Z`} fill="url(#pig-gold)" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
      ))}
      {/* body */}
      <ellipse cx="200" cy="168" rx="140" ry="76" fill="url(#pig-gold)" stroke={INK} strokeWidth="8" />
      <path d="M100 130 C 140 104 220 98 280 116" fill="none" stroke="#fff6d6" strokeWidth="10" strokeLinecap="round" opacity=".7" />
      <ellipse cx="200" cy="214" rx="96" ry="18" fill="#b88220" opacity=".35" />
      {/* head */}
      <circle cx="320" cy="150" r="62" fill="url(#pig-gold)" stroke={INK} strokeWidth="8" />
      {/* ears */}
      <path d="M290 98 L 296 58 L 324 92 Z" fill="#e6b03a" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
      <path d="M332 92 L 352 56 L 364 100 Z" fill="#e6b03a" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
      {/* snout */}
      <ellipse cx="374" cy="166" rx="30" ry="24" fill="#f7cf63" stroke={INK} strokeWidth="7" />
      <ellipse cx="366" cy="166" rx="5" ry="8" fill={INK} />
      <ellipse cx="384" cy="166" rx="5" ry="8" fill={INK} />
      {/* eye + cheek */}
      <circle cx="334" cy="132" r="9" fill={INK} />
      <circle cx="337" cy="129" r="3" fill="#fff" />
      <ellipse cx="320" cy="176" rx="14" ry="8" fill="#ef8f6a" opacity=".5" />
      <path d="M346 196 C 356 204 368 204 376 198" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      {/* front wing */}
      <g transform="translate(-78 14) scale(0.9)"><g className="pig-wing" style={{ transformOrigin: "220px 130px" }}>
        <path d="M220 130 C 196 52 150 14 92 14 C 122 32 132 56 118 70 C 148 72 166 86 160 104 C 188 100 206 112 220 130 Z" fill="url(#pig-wing)" stroke={INK} strokeWidth="8" strokeLinejoin="round" />
        <path d="M200 112 C 182 74 150 46 112 34 M184 116 C 166 92 146 80 128 76" fill="none" stroke="#d8c48a" strokeWidth="5" strokeLinecap="round" />
      </g></g>
    </svg>
  );
}

/** Rico's pink button-up, from the photo. viewBox 0 0 400 260, collar at the top centre. */
export function RicoShirt() {
  return (
    <svg viewBox="0 0 400 260" className="block h-auto w-full" aria-hidden>
      <path d="M40 260 C 40 140 100 60 160 40 L 240 40 C 300 60 360 140 360 260 Z" fill="#f3b9cf" stroke={INK} strokeWidth="9" strokeLinejoin="round" />
      <path d="M300 90 C 330 140 344 200 346 260 L 300 260 C 300 200 300 140 300 90 Z" fill="#dc9bb6" />
      <path d="M160 40 L 200 110 L 240 40" fill="#bf7a4d" stroke={INK} strokeWidth="8" strokeLinejoin="round" />
      <path d="M160 40 L 150 92 L 196 104 Z M240 40 L 250 92 L 204 104 Z" fill="#f7cfde" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
      <path d="M200 110 V 260" stroke={INK} strokeWidth="5" />
      {[140, 180, 220].map((y) => (
        <circle key={y} cx="212" cy={y} r="5" fill="#fff" stroke={INK} strokeWidth="3" />
      ))}
      <rect x="236" y="150" width="56" height="44" rx="6" fill="none" stroke={INK} strokeWidth="5" />
      <path d="M176 60 C 186 92 214 92 224 60" fill="none" stroke="#e9c46a" strokeWidth="4" />
    </svg>
  );
}
