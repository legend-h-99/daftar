import { describe, it, expect } from "vitest";
import { zatcaQrPayload } from "@/lib/zatca";

function decode(b64: string): { tag: number; value: string }[] {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const out: { tag: number; value: string }[] = [];
  for (let i = 0; i < bytes.length; ) {
    const tag = bytes[i];
    const len = bytes[i + 1];
    out.push({ tag, value: new TextDecoder().decode(bytes.slice(i + 2, i + 2 + len)) });
    i += 2 + len;
  }
  return out;
}

describe("zatcaQrPayload", () => {
  it("يرمّز الحقول الخمسة بصيغة TLV مع أسماء عربية (UTF-8)", () => {
    const payload = zatcaQrPayload({
      sellerName: "مطبخ أم سلطان",
      vatNumber: "300000000000003",
      timestamp: "2026-10-02T10:00:00.000Z",
      total: 234.6,
      vatAmount: 30.6,
    });
    expect(decode(payload)).toEqual([
      { tag: 1, value: "مطبخ أم سلطان" },
      { tag: 2, value: "300000000000003" },
      { tag: 3, value: "2026-10-02T10:00:00.000Z" },
      { tag: 4, value: "234.60" },
      { tag: 5, value: "30.60" },
    ]);
  });
});
