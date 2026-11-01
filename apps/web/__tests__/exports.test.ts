import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Expense, Invoice, Purchase } from "@/lib/types";

vi.mock("@/lib/api", () => ({ apiGet: vi.fn() }));

import { apiGet } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { expensesCsv, fetchAllPages, invoicesCsv, purchasesCsv } from "@/lib/exports";
import { formatIsoDate } from "@/lib/format";

const lines = (csv: string) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");

describe("toCsv", () => {
  it("starts with a UTF-8 BOM so Excel reads Arabic correctly", () => {
    expect(toCsv(["الاسم"], [["نورة"]])).toBe("﻿الاسم\r\nنورة\r\n");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(lines(toCsv(["a"], [['x,y'], ['say "hi"'], ["one\ntwo"]])).slice(1).join("|")).toBe(
      '"x,y"|"say ""hi"""|"one\ntwo"',
    );
  });

  it.each(["=SUM(A1:A9)", "+966500000000", "-1", "@cmd", " =1+1", "\t=1+1"])(
    "neutralises the formula in %j",
    (text) => {
      const cell = lines(toCsv(["a"], [[text]]))[1];
      expect(cell.replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );

  it("keeps numbers as numbers, including negatives, and leaves empty cells blank", () => {
    expect(lines(toCsv(["a", "b", "c", "d"], [[-50.5, 0, null, undefined]]))[1]).toBe("-50.5,0,,");
  });
});

describe("formatIsoDate", () => {
  it("uses the local day, matching what the screen shows", () => {
    expect(formatIsoDate(new Date(2026, 9, 5, 23, 30))).toBe("2026-10-05");
  });

  it("keeps a date-only value unchanged", () => {
    expect(formatIsoDate("2026-10-15")).toBe("2026-10-15");
  });

  it("returns an empty string for missing or invalid dates", () => {
    expect(formatIsoDate(null)).toBe("");
    expect(formatIsoDate("not a date")).toBe("");
  });
});

describe("invoicesCsv", () => {
  const invoice = (overrides: Partial<Invoice>): Invoice => ({
    id: "1",
    number: "1007",
    customer: { id: "c", name: "نورة" },
    items: [{ name: "كبسة", unitPrice: 24, quantity: 8 }, { name: "سينابون", unitPrice: 17, quantity: 2 }],
    subtotal: 200,
    vatAmount: 30,
    total: 230,
    status: "UNPAID",
    issueDate: "2026-10-15",
    ...overrides,
  });

  it("writes the amounts as plain numbers with what is still owed", () => {
    const [, row] = lines(invoicesCsv([invoice({ status: "PARTIAL", paidAmount: 100.1 })], "ar"));
    expect(row).toBe("1007,2026-10-15,نورة,جزئي,كبسة × 8، سينابون × 2,200,30,230,100.1,129.9,,");
  });

  it("treats a paid invoice as fully collected even when paidAmount is empty", () => {
    const [, row] = lines(invoicesCsv([invoice({ status: "PAID", paidAmount: null })], "en"));
    expect(row).toContain(",Paid,");
    expect(row).toContain(",230,230,0,");
  });

  it("treats an unpaid invoice as nothing collected", () => {
    const [, row] = lines(invoicesCsv([invoice({ status: "UNPAID", paidAmount: null })], "ar"));
    expect(row).toContain(",230,0,230,");
  });

  it("falls back to the creation date and tolerates a list without items or customer", () => {
    const bare = invoice({ issueDate: null, createdAt: "2026-10-20", customer: null, items: undefined as never });
    const [, row] = lines(invoicesCsv([bare], "ar"));
    expect(row.startsWith("1007,2026-10-20,,غير مدفوعة,,")).toBe(true);
  });
});

describe("expensesCsv", () => {
  const expenses: Expense[] = [{ id: "e", category: "RENT", amount: 300, date: "2026-10-01", note: "شهر أكتوبر" }];

  it("adds cost of goods sold so the file matches the total on screen", () => {
    const [header, cost, rent] = lines(expensesCsv(expenses, 120.5, "ar"));
    expect(header).toBe("التاريخ,البند,المبلغ,ملاحظات");
    expect(cost).toContain(",تكلفة المخزون المباع,120.5,");
    expect(rent).toBe("2026-10-01,إيجار,300,شهر أكتوبر");
  });

  it("omits the cost row when there is no cost of goods sold", () => {
    expect(lines(expensesCsv(expenses, 0, "en"))).toEqual([
      "Date,Category,Amount,Notes",
      "2026-10-01,Rent,300,شهر أكتوبر",
    ]);
  });
});

describe("purchasesCsv", () => {
  it("writes one row per purchase with its items", () => {
    const purchase: Purchase = {
      id: "p",
      number: 12,
      supplier: { id: "s", name: "مورد الدقيق" },
      date: "2026-10-03",
      total: 90,
      source: "MANUAL",
      items: [{ name: "دقيق", unit: "KG", quantity: 2.5, unitPrice: 36, lineTotal: 90 }],
    };
    expect(lines(purchasesCsv([purchase], "ar"))[1]).toBe("12,2026-10-03,مورد الدقيق,دقيق × 2.5,90,");
  });
});

describe("fetchAllPages", () => {
  const rows = (start: number, count: number) =>
    Array.from({ length: count }, (_, index) => ({ id: String(start + index) }));

  beforeEach(() => vi.mocked(apiGet).mockReset());

  it("stops after one request when the first page is not full", async () => {
    vi.mocked(apiGet).mockResolvedValueOnce(rows(0, 3));
    await expect(fetchAllPages("/invoices?month=2026-10")).resolves.toHaveLength(3);
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet).toHaveBeenCalledWith("/invoices?month=2026-10");
  });

  it("collects every page beyond the API's 100-row default", async () => {
    vi.mocked(apiGet)
      .mockResolvedValueOnce(rows(0, 100))
      .mockResolvedValueOnce(rows(100, 100))
      .mockResolvedValueOnce(rows(200, 7));
    await expect(fetchAllPages("/invoices?month=2026-10")).resolves.toHaveLength(207);
    expect(apiGet).toHaveBeenNthCalledWith(2, "/invoices?month=2026-10&page=2");
    expect(apiGet).toHaveBeenNthCalledWith(3, "/invoices?month=2026-10&page=3");
  });

  it("does not loop forever when the API ignores the page number", async () => {
    vi.mocked(apiGet).mockResolvedValue(rows(0, 100));
    await expect(fetchAllPages("/expenses?month=2026-10")).resolves.toHaveLength(100);
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  it("removes a row repeated across pages", async () => {
    vi.mocked(apiGet)
      .mockResolvedValueOnce(rows(0, 100))
      .mockResolvedValueOnce(rows(99, 2));
    await expect(fetchAllPages("/expenses?month=2026-10")).resolves.toHaveLength(101);
  });

  it("passes a failed request up instead of exporting part of the month", async () => {
    vi.mocked(apiGet).mockResolvedValueOnce(rows(0, 100)).mockRejectedValueOnce(new Error("down"));
    await expect(fetchAllPages("/expenses?month=2026-10")).rejects.toThrow("down");
  });
});
