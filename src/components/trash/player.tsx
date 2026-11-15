import type { Players } from "@/lib/extras";
import { PlayerPhoto } from "@/components/trash/brand";

/** A player's headshot when we have one, otherwise a monogram disc. Never a fake face. */
export function Face({
  pid,
  players,
  size = 40,
}: {
  pid: string;
  players: Players;
  size?: number;
}) {
  const p = players[pid];
  const name = p?.[0] ?? "?";
  const ini = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  // Brands without photos get a badge for everyone; otherwise a monogram stands in for a missing photo.
  return (
    <PlayerPhoto
      pid={pid}
      alt=""
      width={size}
      height={size}
      name={p?.[0]}
      pos={p?.[1]?.[0]}
      className="shrink-0 rounded-full bg-[var(--bin-3)] object-cover object-top"
      style={{ width: size, height: size }}
      fallback={
        p?.[3] ? undefined : (
          <span
            aria-hidden
            className="font-display inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--bin-3)] font-bold text-[var(--muted)]"
            style={{ width: size, height: size, fontSize: size * 0.38 }}
          >
            {ini}
          </span>
        )
      }
    />
  );
}

export const pname = (players: Players, pid: string) =>
  pid.startsWith("pick:")
    ? `${pid.slice(5).replace(" R", " round ")} pick`
    : (players[pid]?.[0] ?? `Player ${pid}`);

export const lastName = (players: Players, pid: string) => {
  const n = pname(players, pid);
  const parts = n.split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : n;
};
