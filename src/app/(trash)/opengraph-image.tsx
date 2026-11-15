import { ogCard, ogSize } from "@/lib/og";

export const alt = "Trash";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard("Trash", "Three daily games, live standings and four seasons of league history.");
}
