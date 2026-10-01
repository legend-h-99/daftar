import { describe, expect, it } from "vitest";
import { currentDateStr } from "@/lib/format";

describe("currentDateStr", () => {
  it("uses the local calendar date rather than the previous UTC date", () => {
    const localMidnight = new Date(2026, 9, 1, 0, 30);
    expect(currentDateStr(localMidnight)).toBe("2026-10-01");
  });
});
