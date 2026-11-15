import { ogCard, ogSize } from "@/lib/app/og";

export const alt = "Rafterlore";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard("Your league, in the rafters", "Every season of your Sleeper basketball or football league: champions, records, trades graded and daily games.", [
    { label: "’23", gold: true },
    { label: "’24", gold: true },
    { label: "’25", gold: true },
    { label: "’26", gold: false },
  ]);
}
