import { ogCard, ogSize } from "@/lib/og";

export const alt = "History";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard("History", "Trade court, the Mickey Mouse ring inquiry and the re-draft.");
}
