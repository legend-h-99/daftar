import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiPost, ApiError } from "@/lib/api";

function mockResponse(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

async function errorFrom(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (err) {
    return err as ApiError;
  }
  throw new Error("expected the request to fail");
}

describe("رسائل أخطاء الخادم", () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("يعرض خطأ بيانات الدخول بالعربية بدل النص الإنجليزي", async () => {
    mockResponse(401, { message: "Invalid credentials", statusCode: 401, code: "INVALID_CREDENTIALS" });
    const err = await errorFrom(apiPost("/auth/email/login", { email: "a@b.co", password: "x" }, { auth: false }));
    expect(err.message).toBe("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    expect(err.code).toBe("INVALID_CREDENTIALS");
  });

  it("يعرض الرسالة بالإنجليزية عند اختيار اللغة الإنجليزية", async () => {
    store.daftar_language = "en";
    mockResponse(401, { message: "Invalid credentials", statusCode: 401, code: "INVALID_CREDENTIALS" });
    const err = await errorFrom(apiPost("/auth/email/login", {}, { auth: false }));
    expect(err.message).toBe("Incorrect email or password.");
  });

  it("يترجم رسائل تأكيد البريد وكثرة المحاولات واسم المحل", async () => {
    mockResponse(403, { message: "Please verify your email address first", code: "EMAIL_NOT_VERIFIED" });
    expect((await errorFrom(apiPost("/auth/email/login", {}, { auth: false }))).message).toContain("أكّد بريدك");
    mockResponse(429, { message: "Too many requests; try again shortly", code: "RATE_LIMITED" });
    expect((await errorFrom(apiPost("/auth/email/login", {}, { auth: false }))).message).toContain("محاولات كثيرة");
    mockResponse(400, { message: "Business name is required", code: "INVALID_BUSINESS_NAME" });
    expect((await errorFrom(apiPost("/onboarding", {}, { auth: false }))).message).toBe("أدخل اسم المحل (100 حرف كحد أقصى)");
  });

  it("يبقي رسالة الخادم كما هي إذا لم يكن لها رمز معروف", async () => {
    mockResponse(400, { message: "اسم المحل مكرر", statusCode: 400 });
    expect((await errorFrom(apiPost("/x", {}, { auth: false }))).message).toBe("اسم المحل مكرر");
  });
});

describe("ترويسات الطلبات", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("لا يرسل Content-Type مع طلب GET بلا جسم", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    const { apiGet } = await import("@/lib/api");
    await apiGet("/customers");
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("content-type");
  });
});

describe("مفتاح منع التكرار", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("يترجم إعادة استخدام المفتاح لفاتورة مختلفة", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    mockResponse(422, { message: "This idempotency key was already used for a different invoice", code: "IDEMPOTENCY_KEY_REUSED" });
    const err = await errorFrom(apiPost("/invoices", {}, { auth: false }));
    expect(err.message).toContain("أعد فتح صفحة الفاتورة");
  });
});
