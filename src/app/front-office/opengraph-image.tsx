import { ogCard, ogSize } from "@/lib/og";

export const alt = "Front office";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard("Front office", "Scout your team and test any trade before you send it.");
}
