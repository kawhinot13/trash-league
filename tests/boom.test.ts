import { describe, expect, it } from "vitest";
import { boomLine, boomOf } from "@/lib/core/boom";

describe("Boom index", () => {
  it("the big-game line is the league's 90th percentile game", () => {
    expect(boomLine(Array.from({ length: 100 }, (_, i) => i + 1))).toBe(91);
    expect(boomLine([])).toBe(0);
  });
  it("a spiky player booms more than a steady one with the same average", () => {
    const steady = boomOf([50, 50, 50, 50, 50, 50, 50, 50], 70);
    const spiky = boomOf([20, 80, 20, 80, 20, 80, 20, 80], 70);
    expect(steady.rate).toBe(0);
    expect(spiky.rate).toBe(0.5);
    expect(spiky.ceil).toBe(80);
    expect(steady.ceil).toBe(50);
  });
});
