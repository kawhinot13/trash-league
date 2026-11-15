"use client";

import Image, { type ImageProps } from "next/image";
import Link from "next/link";
import { createContext, useContext, useMemo } from "react";

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
  /** Player headshots: Trash's local files, or Sleeper's CDN. */
  headshots: "local" | "sleeper";
  /** Names of the three daily games. */
  games: { dive: string; wordle: string; lineup: string };
  /** Manager id -> Sleeper display name (handles, monograms). Trash's ids are its handles. */
  names?: Record<string, string>;
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

/** A player's headshot from the brand's source. */
export function PlayerPhoto({ pid, alt = "", ...rest }: Omit<ImageProps, "src" | "alt"> & { pid: string; alt?: string }) {
  return <Image src={useBrand().headshot(pid)} alt={alt} {...rest} />;
}

/** Link to a manager's profile on whichever site this is. */
export function MgrLink({ id, ...rest }: Omit<React.ComponentProps<typeof Link>, "href"> & { id: string }) {
  return <Link href={useBrand().manager(id)} {...rest} />;
}

/** A manager's Sleeper handle (Trash's ids already are handles). */
export function Handle({ id }: { id: string }) {
  return <>{useBrand().names?.[id] ?? id}</>;
}

/** The league's name, for server components that render shared copy. */
export function LeagueName() {
  return <>{useBrand().name}</>;
}
