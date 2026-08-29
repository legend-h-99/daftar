import { MaterialUnit } from './material.entity';

export type PurchaseSource = 'MANUAL' | 'OCR';

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  materialId: string | null;
  name: string;
  unit: MaterialUnit;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Purchase {
  id: string;
  businessId: string;
  supplierId: string | null;
  number: number;
  source: PurchaseSource;
  total: number;
  /** Mapped from Prisma's `date` field. */
  date: Date;
  notes: string | null;
  createdAt: Date;
}

export interface PurchaseWithItems extends Purchase {
  items: PurchaseItem[];
  supplier: { id: string; name: string } | null;
}

export interface CreatePurchaseData {
  businessId: string;
  supplierId?: string;
  number: number;
  source: PurchaseSource;
  total: number;
  date?: Date;
  notes?: string;
}

export interface CreatePurchaseItemData {
  purchaseId: string;
  materialId?: string;
  name: string;
  unit: MaterialUnit;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}
