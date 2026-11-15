import { league } from "@/lib/league";
import { HOLIDAY } from "@/lib/holiday";
import type { LoadedPack } from "@/packs/types";

/**
 * The Trash pack: everything that only makes sense for Trash. The generic league page stays
 * generic; this layers the league's lore on top when one of Trash's seasons is opened.
 */
export function trashPack(): LoadedPack {
  const rico = league.managers.find((m) => m.id === "RI3O");
  return {
    id: "trash",
    name: "The Trash pack",
    intro: "Lore that only makes sense in Trash. The full versions live on the league's own site.",
    nicknames: Object.fromEntries(league.managers.map((m) => [m.id, m.nick])),
    features: [
      { key: "mickey", title: "The Mickey Mouse ring inquiry", line: "Every playoff game of Oscar's title run, reviewed.", href: "/history#ring" },
      { key: "story", title: "The story so far", line: "Fifteen moments that made the league.", href: "/history#story" },
      { key: "movie", title: "Trash: the movie", line: "The whole history in four and a half minutes, animated and narrated.", href: "/history#movie" },
      { key: "storm", title: "The storm", line: "The Great Auction, and the vote it lost by one.", href: "/history#auction" },
      { key: "nicknames", title: "Nicknames", line: "Managers go by what the group chat calls them, here too." },
      { key: "rico", title: "Rico", line: "Keep scrolling. He's watching the trade market." },
      { key: "pig", title: "The pig", line: "Rarely, and without warning." },
      ...(HOLIDAY ? [{ key: "music", title: "Sleepmas Eve", line: "The league's holiday song, with a mute button." }] : []),
    ],
    overlay: { rico: rico ? { trades: rico.trades, record: `${rico.w}–${rico.l}` } : null, music: HOLIDAY },
  };
}
