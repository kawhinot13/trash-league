/** A string of twinkling bulbs hung along the bottom edge of the nav. */
const COLORS = ["#d93a3a", "#e9c46a", "#3fae5a", "#4aa3e8", "#f6f3ea"];

export function StringLights({ count = 22 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-6 -bottom-3 h-6">
      <svg className="absolute inset-x-0 top-0 h-3 w-full" viewBox="0 0 100 10" preserveAspectRatio="none">
        <path d="M0 2 Q 12.5 9 25 2 T 50 2 T 75 2 T 100 2" fill="none" stroke="#163a2c" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: count }, (_, i) => {
        const x = (i + 0.5) / count;
        // follow the wire's sag
        const y = 2 + 7 * Math.abs(Math.sin(x * Math.PI * 4)) * 0.85;
        const c = COLORS[i % COLORS.length];
        return (
          <span
            key={i}
            className="xmas-bulb absolute"
            style={
              {
                left: `${x * 100}%`,
                top: `${y * 0.9}px`,
                background: c,
                "--glow": c,
                animationDelay: `${(i * 0.37) % 2.4}s`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
