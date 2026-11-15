import { ogCard, ogSize } from "@/lib/og";

export const alt = "Rivals";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard("Rivals", "Who owns who, and the rivalry machine for any two managers.");
}
