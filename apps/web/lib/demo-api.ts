import {
  Business,
  Customer,
  DashboardSummary,
  Expense,
  InventoryMaterial,
  Invoice,
  Material,
  OcrDraft,
  Product,
  Purchase,
  PurchasesSummary,
  StockMovement,
  User,
} from "./types";

export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
  process.env.NEXT_PUBLIC_API_URL === "demo";

export const DEMO_TOKEN = "demo-token-daftar";
export const DEMO_OTP = "123456";

const today = new Date().toISOString();

const user: User = {
  id: "demo-user",
  phone: "0500000001",
  name: "مستخدم تجريبي",
};

const business: Business = {
  id: "demo-business",
  name: "مطبخ أم سلطان",
  city: "الرياض",
  vatEnabled: true,
  vatNumber: "300000000000003",
};

const materials: InventoryMaterial[] = [
  {
    id: "mat-rice",
    name: "أرز بسمتي",
    unit: "KG",
    purchasePrice: 92,
    purchaseQty: 10,
    unitPrice: 9.2,
    vatRate: 15,
    stockQty: 8.5,
    reorderLevel: 5,
    lowStock: false,
  },
  {
    id: "mat-chicken",
    name: "دجاج مبرد",
    unit: "KG",
    purchasePrice: 84,
    purchaseQty: 6,
    unitPrice: 14,
    vatRate: 15,
    stockQty: 2.2,
    reorderLevel: 3,
    lowStock: true,
  },
  {
    id: "mat-box",
    name: "علب تغليف",
    unit: "PIECE",
    purchasePrice: 75,
    purchaseQty: 100,
    unitPrice: 0.75,
    vatRate: 15,
    stockQty: 28,
    reorderLevel: 40,
    lowStock: true,
  },
];

const products: Product[] = [
  {
    id: "prod-kabsa",
    name: "كبسة دجاج",
    category: "وجبات",
    profitMargin: 45,
    overheadCost: 3,
    recipeItems: [
      {
        id: "ri-rice",
        materialId: "mat-rice",
        name: "أرز بسمتي",
        unit: "KG",
        unitPrice: 9.2,
        quantityUsed: 0.25,
        type: "RAW",
      },
      {
        id: "ri-chicken",
        materialId: "mat-chicken",
        name: "دجاج مبرد",
        unit: "KG",
        unitPrice: 14,
        quantityUsed: 0.5,
        type: "RAW",
      },
      {
        id: "ri-box",
        materialId: "mat-box",
        name: "علب تغليف",
        unit: "PIECE",
        unitPrice: 0.75,
        quantityUsed: 1,
        type: "PACKAGING",
      },
    ],
    rawCost: 9.3,
    packagingCost: 0.75,
    totalCost: 13.05,
    sellingPrice: 24,
  },
  {
    id: "prod-cinnamon",
    name: "سينابون",
    category: "حلويات",
    profitMargin: 50,
    overheadCost: 2,
    recipeItems: [],
    rawCost: 5.5,
    packagingCost: 1,
    totalCost: 8.5,
    sellingPrice: 17,
  },
];

const customers: Customer[] = [
  { id: "cust-nora", name: "نورة العتيبي", phone: "0551112233" },
  { id: "cust-sara", name: "سارة محمد", phone: "0552223344" },
  { id: "cust-huda", name: "هدى خالد", phone: "0553334455" },
];

const invoices: Invoice[] = [
  {
    id: "inv-1007",
    number: "1007",
    customerId: "cust-nora",
    customer: customers[0],
    items: [{ productId: "prod-kabsa", name: "كبسة دجاج", unitPrice: 24, quantity: 8 }],
    subtotal: 192,
    vatAmount: 28.8,
    total: 220.8,
    status: "UNPAID",
    issueDate: today,
    dueDate: today,
    notes: "طلب عزيمة صغيرة",
    createdAt: today,
  },
  {
    id: "inv-1006",
    number: "1006",
    customerId: "cust-sara",
    customer: customers[1],
    items: [{ productId: "prod-cinnamon", name: "سينابون", unitPrice: 17, quantity: 12 }],
    subtotal: 204,
    vatAmount: 30.6,
    total: 234.6,
    status: "PARTIAL",
    paidAmount: 120,
    issueDate: today,
    dueDate: today,
    createdAt: today,
  },
  {
    id: "inv-1005",
    number: "1005",
    customerId: "cust-huda",
    customer: customers[2],
    items: [{ productId: "prod-kabsa", name: "كبسة دجاج", unitPrice: 24, quantity: 5 }],
    subtotal: 120,
    vatAmount: 18,
    total: 138,
    status: "PAID",
    paidAmount: 138,
    issueDate: today,
    createdAt: today,
  },
];

const expenses: Expense[] = [
  { id: "exp-1", category: "RENT", amount: 900, date: today, note: "إيجار المطبخ" },
  { id: "exp-2", category: "DELIVERY", amount: 180, date: today, note: "توصيل الطلبات" },
  { id: "exp-3", category: "MARKETING", amount: 240, date: today, note: "إعلانات إنستغرام" },
];

const purchases: Purchase[] = [
  {
    id: "pur-1",
    number: 41,
    supplier: { id: "sup-1", name: "تموينات الخير", phone: "0110000000" },
    date: today,
    total: 251,
    source: "OCR",
    notes: "فاتورة مواد أسبوعية",
    items: [
      { name: "أرز بسمتي", unit: "KG", quantity: 10, unitPrice: 9.2, lineTotal: 92 },
      { name: "دجاج مبرد", unit: "KG", quantity: 6, unitPrice: 14, lineTotal: 84 },
      { name: "علب تغليف", unit: "PIECE", quantity: 100, unitPrice: 0.75, lineTotal: 75 },
    ],
  },
];

const movements: StockMovement[] = [
  {
    id: "mov-1",
    type: "PURCHASE",
    qty: 10,
    balanceAfter: 8.5,
    createdAt: today,
    note: "شراء أسبوعي",
    material: { name: "أرز بسمتي", unit: "KG" },
  },
  {
    id: "mov-2",
    type: "SALE",
    qty: -4,
    balanceAfter: 2.2,
    createdAt: today,
    note: "مبيعات كبسة",
    material: { name: "دجاج مبرد", unit: "KG" },
  },
];

function dashboardSummary(): DashboardSummary {
  const totalSales = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const totalPurchases = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const unpaidInvoices = invoices.filter((invoice) => invoice.status !== "PAID");
  return {
    totalSales,
    totalPurchases,
    totalExpenses,
    netProfit: totalSales - totalPurchases - totalExpenses,
    unpaidInvoices,
    unpaidInvoicesCount: unpaidInvoices.length,
    unpaidInvoicesTotal: unpaidInvoices.reduce(
      (sum, invoice) => sum + invoice.total - (invoice.paidAmount ?? 0),
      0,
    ),
    unpaidInvoicesLimitedTo: 5,
    lowStock: materials
      .filter((material) => material.lowStock)
      .map((material) => ({
        id: material.id,
        name: material.name,
        unit: material.unit,
        stockQty: material.stockQty,
        reorderLevel: material.reorderLevel ?? 0,
      })),
  };
}

function jsonResponse<T>(data: T): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function created<T>(data: T): Response {
  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

export async function demoApiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const pathname = path.split("?")[0];

  if (method === "POST" && pathname === "/auth/otp/request") {
    return jsonResponse({ sent: true, devCode: DEMO_OTP });
  }
  if (method === "POST" && pathname === "/auth/otp/verify") {
    return jsonResponse({ accessToken: DEMO_TOKEN, user, hasBusiness: true, business });
  }
  if (method === "POST" && pathname === "/auth/logout") {
    return new Response(null, { status: 204 });
  }
  if (method === "GET" && pathname === "/auth/me") {
    return jsonResponse({ user, business });
  }
  if (method === "POST" && pathname === "/business") {
    return created({ accessToken: DEMO_TOKEN, business });
  }

  if (method === "GET" && pathname === "/dashboard/summary") return jsonResponse(dashboardSummary());
  if (method === "GET" && pathname === "/expenses") return jsonResponse(expenses);
  if (method === "GET" && pathname === "/inventory") return jsonResponse(materials);
  if (method === "GET" && pathname === "/inventory/movements") return jsonResponse(movements);
  if (method === "GET" && pathname === "/materials") return jsonResponse(materials satisfies Material[]);
  if (method === "GET" && pathname === "/products") return jsonResponse(products);
  if (method === "GET" && pathname.startsWith("/products/")) {
    return jsonResponse(products.find((product) => product.id === pathname.split("/")[2]) ?? products[0]);
  }
  if (method === "GET" && pathname === "/customers") return jsonResponse(customers);
  if (method === "GET" && pathname === "/invoices") return jsonResponse(invoices);
  if (method === "GET" && pathname.startsWith("/invoices/") && pathname.endsWith("/pdf")) {
    return new Response("فاتورة تجريبية من دفتر", {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    });
  }
  if (method === "GET" && pathname.startsWith("/invoices/")) {
    return jsonResponse(invoices.find((invoice) => invoice.id === pathname.split("/")[2]) ?? invoices[0]);
  }
  if (method === "GET" && pathname === "/purchases") return jsonResponse(purchases);
  if (method === "GET" && pathname === "/purchases/summary") {
    const summary: PurchasesSummary = {
      bySupplier: [{ name: "تموينات الخير", count: purchases.length, total: purchases[0].total }],
      byMonth: [{ month: new Date().toISOString().slice(0, 7), count: purchases.length, total: purchases[0].total }],
    };
    return jsonResponse(summary);
  }

  if (method === "POST" && pathname === "/purchases/scan") {
    const draft: OcrDraft = {
      supplierName: "تموينات الخير",
      date: today,
      provider: "demo",
      confidence: 0.91,
      total: 251,
      items: purchases[0].items.map((item) => ({
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        confidence: 0.9,
      })),
    };
    return jsonResponse(draft);
  }

  if (["POST", "PATCH"].includes(method)) {
    if (pathname.startsWith("/invoices/")) {
      return jsonResponse(invoices.find((invoice) => invoice.id === pathname.split("/")[2]) ?? invoices[0]);
    }
    return created({ id: `demo-${Date.now()}` });
  }
  if (method === "DELETE") return new Response(null, { status: 204 });

  return jsonResponse({});
}
