// Shared domain types mirroring the backend API contract.

export type MaterialUnit = "KG" | "GRAM" | "LITER" | "ML" | "PIECE";

export const UNIT_LABELS: Record<MaterialUnit, string> = {
  KG: "كيلو",
  GRAM: "جرام",
  LITER: "لتر",
  ML: "مل",
  PIECE: "حبة",
};

export interface User {
  id: string;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  name?: string | null;
}

export interface Business {
  id: string;
  name: string;
  city?: string | null;
  vatEnabled: boolean;
  vatNumber?: string | null;
}

export interface Material {
  id: string;
  name: string;
  unit: MaterialUnit;
  purchasePrice: number;
  purchaseQty: number;
  unitPrice: number;
  /** VAT % included in the purchase price (informational). */
  vatRate: number;
  stockQty: number;
  reorderLevel?: number | null;
}

/** Material as returned by GET /inventory (with the computed low-stock flag). */
export interface InventoryMaterial extends Material {
  lowStock: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
}

export type PurchaseSource = "MANUAL" | "OCR";

export interface PurchaseItem {
  id?: string;
  materialId?: string | null;
  name: string;
  unit: MaterialUnit;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Purchase {
  id: string;
  number: number;
  supplier?: Supplier | null;
  date: string;
  total: number;
  notes?: string | null;
  source: PurchaseSource;
  items: PurchaseItem[];
}

export type StockMovementType = "PURCHASE" | "SALE" | "ADJUSTMENT";

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  PURCHASE: "شراء",
  SALE: "بيع",
  ADJUSTMENT: "تعديل يدوي",
};

export interface StockMovement {
  id: string;
  type: StockMovementType;
  qty: number;
  balanceAfter: number;
  note?: string | null;
  createdAt: string;
  material: { name: string; unit: MaterialUnit };
}

export interface OcrDraftItem {
  materialId?: string;
  name: string;
  unit: MaterialUnit;
  quantity: number;
  unitPrice: number;
  confidence: number;
}

export interface OcrDraft {
  supplierName?: string;
  date?: string;
  items: OcrDraftItem[];
  total?: number;
  confidence: number;
  provider: string;
}

export interface PurchasesSummary {
  bySupplier: { name: string; count: number; total: number }[];
  byMonth: { month: string; count: number; total: number }[];
}

export interface LowStockMaterial {
  id: string;
  name: string;
  unit: MaterialUnit;
  stockQty: number;
  reorderLevel: number;
}

export type RecipeItemType = "RAW" | "PACKAGING";

export interface RecipeItem {
  id?: string;
  materialId?: string | null;
  name: string;
  unit: MaterialUnit;
  unitPrice: number;
  quantityUsed: number;
  type: RecipeItemType;
}

export interface Product {
  id: string;
  name: string;
  category?: string | null;
  profitMargin: number;
  overheadCost?: number | null;
  recipeItems: RecipeItem[];
  rawCost: number;
  packagingCost: number;
  totalCost: number;
  sellingPrice: number;
}

export interface CalculateResult {
  rawCost: number;
  packagingCost: number;
  totalCost: number;
  sellingPrice: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
}

export type InvoiceStatus = "PAID" | "UNPAID" | "PARTIAL";

export interface InvoiceItem {
  id?: string;
  productId?: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface Invoice {
  id: string;
  number: string;
  customerId?: string | null;
  customer?: Customer | null;
  items: InvoiceItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  status: InvoiceStatus;
  paidAmount?: number | null;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export type ExpenseCategory =
  | "RENT"
  | "SALARIES"
  | "INGREDIENTS"
  | "PACKAGING"
  | "MARKETING"
  | "DELIVERY"
  | "UTILITIES"
  | "OTHER";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: "إيجار",
  SALARIES: "رواتب",
  INGREDIENTS: "مواد خام",
  PACKAGING: "تغليف",
  MARKETING: "تسويق",
  DELIVERY: "توصيل",
  UTILITIES: "فواتير خدمات",
  OTHER: "أخرى",
};

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  note?: string | null;
}

export interface UnpaidInvoiceSummary {
  id: string;
  number: string;
  customerName?: string | null;
  total: number;
  dueDate?: string | null;
  status: InvoiceStatus;
}

export interface DashboardSummary {
  totalSales: number;
  totalPurchases: number;
  costOfGoodsSold: number;
  operatingExpenses: number;
  totalExpenses: number;
  netProfit: number;
  unpaidInvoices: UnpaidInvoiceSummary[];
  unpaidInvoicesCount: number;
  unpaidInvoicesTotal: number;
  unpaidInvoicesLimitedTo: number;
  lowStock: LowStockMaterial[];
}
