import { ogCard, ogSize } from "@/lib/og";

export const alt = "Managers";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard("Managers", "My guys, the Lock-In Index and who you manage like.");
}
