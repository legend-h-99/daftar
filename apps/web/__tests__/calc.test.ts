import { describe, it, expect } from "vitest";
import { calculateCosts, MAX_MARGIN } from "@/lib/calc";

describe("calculateCosts — هامش الربح من سعر البيع", () => {
  it("تكلفة 70 وهامش 30% → سعر 100", () => {
    expect(calculateCosts([], 70, 30).sellingPrice).toBeCloseTo(100);
  });

  it("لا يرجّع سعر يساوي التكلفة عند هامش 100% أو أكثر", () => {
    const { sellingPrice, totalCost } = calculateCosts([], 10, 100);
    expect(sellingPrice).toBeGreaterThan(totalCost);
    expect(sellingPrice).toBeCloseTo(10 / (1 - MAX_MARGIN / 100));
  });

  it("الهامش السالب يُعامل كصفر", () => {
    expect(calculateCosts([], 10, -20).sellingPrice).toBeCloseTo(10);
  });
});
