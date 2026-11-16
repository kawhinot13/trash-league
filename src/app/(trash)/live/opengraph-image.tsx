import { ogCard, ogSize } from "@/lib/og";

export const alt = "Live";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard("Live", "Season 4 table, power rankings and weekly recap, straight from Sleeper.");
}
