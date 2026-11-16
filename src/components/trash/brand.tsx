"use client";

import Image, { type ImageProps } from "next/image";
import Link from "next/link";
import { createContext, useContext, useMemo } from "react";
import { initialsOf } from "@/lib/core/names";
import { lineupTerms } from "@/lib/core/lineup-terms";

export { initialsOf, lineupTerms };

/**
 * Whose site the shared league components are rendering for. The defaults are the Trash site's own
 * (local photos, /managers links, "Trash" wording), so Trash renders exactly as before without a
 * provider. Rafterlore wraps a league's pages in <BrandProvider> with that league's settings.
 */
export type BrandConfig = {
  /** How copy names the league ("Trash"). */
  name: string;
  /** Seasonal decorations (the Trash site's holiday theme). Off unless set. */
  holiday?: boolean;
  /** Short name for tight labels ("Trash"; Rafterlore uses "League"). Defaults to `name`. */
  tag?: string;
  /** Path prefix for the league's pages ("" for Trash, "/l/<id>" on Rafterlore). */
  base: string;
  /** Prefix for browser-storage keys, so leagues on one site never share game progress. */
  storage: string;
  /** Daily-game leaderboard endpoint. */
  scores: string;
  /** Manager photos: Trash's local files, or a map of manager id to photo URL (null: monogram). */
  avatars: "local" | Record<string, string | null>;
  /** Player headshots: Trash's local files, Sleeper's CDN, or designed badges (no photos). */
  headshots: "local" | "sleeper" | "badge";
  /** For badges: pid -> [initials, position]. Players missing here get a badge from the name the caller passes. */
  badges?: Record<string, [string, string]>;
  /** Names of the three daily games. */
  games: { dive: string; wordle: string; lineup: string };
  /** Manager id -> Sleeper display name (handles, monograms). Trash's ids are its handles. */
  names?: Record<string, string>;
  /** The league's sport. Basketball when unset (the Trash site). */
  sport?: "nba" | "nfl";
  /**
   * How lineups score: one locked-in game per spot a week ("lock-in", basketball), every game a
   * starter plays ("daily", basketball), or one game a week ("weekly", football). Unset: the Trash
   * site (lock-in, with its own original wording).
   */
  lineup?: "lock-in" | "daily" | "weekly";
  /** Rosterdle hints (earned by missing, cost points). Off on the Trash site's Trashle. */
  wordleHints?: boolean;
  /** Where the league lives ("Yahoo"); Sleeper when unset. Used in copy like "per Sleeper". */
  source?: string;
  /** First season's year, for "since 2023" copy. Trash's when unset. */
  since?: string;
  /** Season code -> short year label ("’25"), for compact season lists. */
  short?: Record<string, string>;
};

export const TRASH_BRAND: BrandConfig = {
  name: "Trash",
  base: "",
  storage: "",
  scores: "/api/scores",
  avatars: "local",
  headshots: "local",
  games: { dive: "Dumpster Dive", wordle: "Trashle", lineup: "The Lineup" },
  holiday: true,
};

export type Brand = BrandConfig & {
  avatar: (id: string) => string | null;
  headshot: (pid: string) => string;
  manager: (id: string) => string;
  key: (k: string) => string;
};

const make = (c: BrandConfig): Brand => ({
  ...c,
  avatar: (id) => (c.avatars === "local" ? `/avatars/${id}.jpg` : (c.avatars[id] ?? null)),
  headshot: (pid) => (c.headshots === "local" ? `/players/${pid}.jpg` : `https://sleepercdn.com/content/nba/players/${pid}.jpg`),
  manager: (id) => `${c.base}/managers/${id}`,
  key: (k) => `${c.storage}${k}`,
});

const Ctx = createContext<Brand>(make(TRASH_BRAND));

export const useBrand = () => useContext(Ctx);

export function BrandProvider({ config, children }: { config: BrandConfig; children: React.ReactNode }) {
  const b = useMemo(() => make(config), [config]);
  return <Ctx.Provider value={b}>{children}</Ctx.Provider>;
}

/** A manager's photo, or a monogram when they have none. Same <Image> as before for Trash. */
export function MgrPhoto({ id, alt = "", ...rest }: Omit<ImageProps, "src" | "alt"> & { id: string; alt?: string }) {
  const brand = useBrand();
  const src = brand.avatar(id);
  if (src) return <Image src={src} alt={alt} {...rest} />;
  const size = Number(rest.width) || 40;
  return (
    <span
      aria-hidden
      className={`font-display inline-flex items-center justify-center bg-[var(--bin-3)] font-bold text-[var(--muted)] ${rest.className ?? ""}`}
      style={{ width: size, height: size, fontSize: size * 0.42, ...(rest.style ?? {}) }}
    >
      {(brand.names?.[id] ?? id).slice(0, 1).toUpperCase()}
    </span>
  );
}

/** A player's headshot from the brand's source (a designed badge when the brand uses no photos). */
export function PlayerPhoto({
  pid,
  alt = "",
  name,
  pos,
  fallback,
  ...rest
}: Omit<ImageProps, "src" | "alt"> & {
  pid: string;
  alt?: string;
  name?: string;
  pos?: string;
  /** Shown instead of a photo when the player has none (photo brands only). */
  fallback?: React.ReactNode;
}) {
  const brand = useBrand();
  if (brand.headshots === "badge")
    return <PlayerBadge pid={pid} name={name} pos={pos} size={Number(rest.width) || undefined} fill={!!rest.fill} className={rest.className} />;
  if (fallback !== undefined) return <>{fallback}</>;
  return <Image src={brand.headshot(pid)} alt={alt} {...rest} />;
}

/**
 * A player from live Sleeper data (waiver wire, pickups, front office). Trash shows Sleeper's photo,
 * unoptimized, exactly as before; badge brands show the badge.
 */
export function LivePlayerPhoto({ pid, name, pos, ...rest }: Omit<ImageProps, "src" | "alt"> & { pid: string; name?: string; pos?: string }) {
  if (useBrand().headshots === "badge")
    return <PlayerBadge pid={pid} name={name} pos={pos} size={Number(rest.width) || undefined} fill={!!rest.fill} className={String(rest.className ?? "")} />;
  return <Image src={`https://sleepercdn.com/content/nba/players/${pid}.jpg`} alt="" {...rest} />;
}

/**
 * A player's badge instead of a photo: initials on a dark tile with a wood "collar" stripe and the
 * position underneath. Fixed size (`size`, a disc) or filling its box (`fill`, a card).
 */
export function PlayerBadge({
  pid,
  name,
  pos,
  size,
  fill,
  className = "",
}: {
  pid: string;
  name?: string;
  pos?: string;
  size?: number;
  fill?: boolean;
  className?: string;
}) {
  const known = useBrand().badges?.[pid];
  const ini = known?.[0] ?? (name ? initialsOf(name) : "");
  const where = known?.[1] ?? pos ?? "";
  const s = size ?? 40;
  const showPos = !!where && (fill || s >= 44);
  return (
    <span
      aria-hidden
      className={`font-display ${fill ? "absolute inset-0" : "relative"} inline-flex shrink-0 flex-col items-center justify-center overflow-hidden bg-[linear-gradient(160deg,var(--bin-3),var(--bin-2))] leading-none font-black text-[var(--paper)]/90 ${className}`}
      // Filling a box: size the text from the box itself (container units), so the initials and
      // position always fit, from the small list tiles to the big cards.
      style={fill ? { containerType: "size" } : { width: s, height: s }}
    >
      <span className="absolute inset-x-0 top-0 h-[12%] max-h-1.5 min-h-0.5 bg-[var(--wood)]/80" />
      <span style={{ fontSize: fill ? (showPos ? "min(1.5rem, 34cqh, 30cqw)" : "min(1.6rem, 46cqh, 34cqw)") : s * (showPos ? 0.34 : 0.4) }}>
        {ini || "·"}
      </span>
      {showPos ? (
        <span
          className="mt-[0.15em] font-sans font-bold tracking-[0.08em] text-[var(--wood)]"
          style={{ fontSize: fill ? "min(10px, 19cqh)" : Math.max(8, s * 0.17) }}
        >
          {where}
        </span>
      ) : null}
    </span>
  );
}

/** Link to a manager's profile on whichever site this is. */
export function MgrLink({ id, ...rest }: Omit<React.ComponentProps<typeof Link>, "href"> & { id: string }) {
  return <Link href={useBrand().manager(id)} {...rest} />;
}

/** id -> display name, for strings (labels, joined lists). Trash's ids already are handles. */
export function useNameOf() {
  const names = useBrand().names;
  return (id: string) => names?.[id] ?? id;
}

/** A manager's Sleeper handle (Trash's ids already are handles). */
export function Handle({ id }: { id: string }) {
  return <>{useBrand().names?.[id] ?? id}</>;
}

/** The platform the league lives on, in copy ("per Sleeper", "per Yahoo"). */
export function Src() {
  return <>{useBrand().source ?? "Sleeper"}</>;
}
export const useSource = () => useBrand().source ?? "Sleeper";

/** The league's name, for server components that render shared copy. */
export function LeagueName() {
  return <>{useBrand().name}</>;
}
