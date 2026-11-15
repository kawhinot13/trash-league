/**
 * A realistic Santa hat for the trophy: velvet with light and shadow, a fluffy fur brim and
 * pom-pom built from soft overlapping puffs. Viewbox is 300×220; the brim's bottom edge sits
 * at y≈190 so it can rest on the cup's rim.
 */
const puffs = (n: number, x0: number, x1: number, y: (t: number) => number, r: number) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const j = ((i * 37) % 11) / 11; // fixed jitter, same on server and client
    return { cx: x0 + (x1 - x0) * t, cy: y(t) + (j - 0.5) * 6, r: r * (0.85 + j * 0.3) };
  });

export function TrophyHat({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  // brim: a solid band along a gentle arc, roughed up with many soft puffs on both edges
  const arc = (t: number) => 182 - Math.sin(t * Math.PI) * 10;
  const brim = [
    ...puffs(24, 28, 252, (t) => arc(t) - 11, 11),
    ...puffs(24, 32, 248, (t) => arc(t) + 11, 11),
    ...puffs(18, 30, 250, arc, 13),
  ];
  const pom = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const k = 12 + ((i * 7) % 5);
    return { cx: 262 + Math.cos(a) * k, cy: 152 + Math.sin(a) * k, r: 9 + ((i * 3) % 4) };
  });
  return (
    <svg viewBox="0 0 300 220" className={className} style={style} aria-hidden>
      <defs>
        <linearGradient id="th-velvet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2283f" />
          <stop offset="0.45" stopColor="#b5122a" />
          <stop offset="1" stopColor="#6e0716" />
        </linearGradient>
        <radialGradient id="th-sheen" cx="0.35" cy="0.3" r="0.6">
          <stop offset="0" stopColor="#ff6b7d" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff6b7d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="th-fur" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#f1ece2" />
          <stop offset="1" stopColor="#c9c1b3" />
        </radialGradient>
        <filter id="th-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        <filter id="th-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <g filter="url(#th-shadow)">
        {/* body: cone rising from the brim, slumping over to the right */}
        <path
          d="M40 176 C 52 112 92 52 160 36 C 214 24 252 52 262 96 C 268 122 266 140 262 152 C 248 128 226 112 204 116 C 188 120 194 150 222 176 Z"
          fill="url(#th-velvet)"
        />
        <path d="M40 176 C 52 112 92 52 160 36 C 214 24 252 52 262 96 C 268 122 266 140 262 152 C 248 128 226 112 204 116 C 188 120 194 150 222 176 Z" fill="url(#th-sheen)" />
        {/* the back of the hat, seen under the drooping tip */}
        <path d="M204 116 C 188 120 194 150 222 176 L 258 176 C 262 168 263 160 262 152 C 248 128 226 112 204 116 Z" fill="#7d0a1c" />
        {/* fold shadow where the tip bends over */}
        <path d="M204 116 C 220 108 246 116 262 152 C 250 132 232 122 212 124 Z" fill="#4e0510" opacity="0.6" />
        <path d="M96 150 C 110 100 140 66 176 54" stroke="#ff8a98" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" fill="none" />
        {/* fur brim */}
        <path
          d="M30 182 Q 140 152 250 182 L 250 190 Q 140 160 30 190 Z"
          fill="url(#th-fur)"
          stroke="url(#th-fur)"
          strokeWidth="24"
          strokeLinejoin="round"
        />
        <g filter="url(#th-soft)">
          {brim.map((p, i) => (
            <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="url(#th-fur)" />
          ))}
        </g>
        {/* pom-pom */}
        <g filter="url(#th-soft)">
          {pom.map((p, i) => (
            <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="url(#th-fur)" />
          ))}
          <circle cx="262" cy="152" r="17" fill="url(#th-fur)" />
        </g>
      </g>
    </svg>
  );
}
