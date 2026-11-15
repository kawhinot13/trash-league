/**
 * Site-wide snowfall: a few dozen CSS flakes, transform/opacity only, so it runs on the
 * compositor and costs almost nothing. Hidden for reduced motion (see globals.css).
 * Positions are fixed numbers (no Math.random) so server and client render the same.
 */
const FLAKES = Array.from({ length: 44 }, (_, i) => {
  const r = (n: number) => ((i * 9301 + 49297 * n) % 233280) / 233280;
  return {
    left: r(1) * 100,
    size: 2 + r(2) * 4,
    dur: 9 + r(3) * 12,
    delay: -r(4) * 20,
    drift: (r(5) - 0.5) * 120,
    o: 0.35 + r(6) * 0.5,
  };
});

export function Snowfall() {
  return (
    <div aria-hidden className="xmas-snow pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="xmas-flake"
          style={
            {
              left: `${f.left}%`,
              width: f.size,
              height: f.size,
              opacity: f.o,
              animationDuration: `${f.dur}s`,
              animationDelay: `${f.delay}s`,
              "--drift": `${f.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
