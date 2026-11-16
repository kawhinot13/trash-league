import { ogCard, ogSize } from "@/lib/og";

export const alt = "Waivers";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard("Waivers", "Everyone on the wire, ranked for Trash's scoring, straight from Sleeper.");
}
