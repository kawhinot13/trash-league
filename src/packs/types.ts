/** What a custom pack adds to the generic league page. */
export type PackFeature = {
  key: string;
  title: string;
  line: string;
  /** Where the feature lives (packs can link into a league's own site). */
  href?: string;
};
export type LoadedPack = {
  id: string;
  name: string;
  intro: string;
  /** Sleeper display name -> what the league actually calls them. */
  nicknames: Record<string, string>;
  features: PackFeature[];
  /** Props for the pack's client overlay (mascots, music); null for none. */
  overlay: Record<string, unknown> | null;
};
