/**
 * Writes Trash's Dumpster Dive calendar ahead (src/data/dive-calendar.json): days already written up to
 * today never change; the next 30 days are planned from the current data. Run after the daily data
 * refresh: `npm run calendar`. (Rafterlore leagues keep their calendar with their data; see jobs.ts.)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { divePool } from "@/lib/dive";
import { extendCalendar, type Calendar } from "@/lib/core/dive";

const path = "src/data/dive-calendar.json";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const before: Calendar = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
const after = extendCalendar(divePool(), before, today);
writeFileSync(path, JSON.stringify(after, null, 1) + "\n");
const changed = Object.keys(after).filter((d) => d <= today && JSON.stringify(after[d]) !== JSON.stringify(before[d] ?? null));
console.log(`dive calendar: ${Object.keys(after).length} days through ${Object.keys(after).sort().pop()}; locked days changed: ${changed.length ? changed.join(", ") : "none"}`);
