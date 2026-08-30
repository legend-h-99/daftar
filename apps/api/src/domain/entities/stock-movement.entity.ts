export type StockMovementType = 'PURCHASE' | 'SALE' | 'ADJUSTMENT';

export interface StockMovement {
  id: string;
  businessId: string;
  materialId: string;
  type: StockMovementType;
  qty: number;
  balanceAfter: number;
  costAmount: number | null;
  refType: 'PURCHASE' | 'INVOICE' | null;
  refId: string | null;
  note: string | null;
  createdAt: Date;
}

export interface CreateMovementData {
  businessId: string;
  materialId: string;
  type: StockMovementType;
  qty: number;
  balanceAfter: number;
  costAmount?: number;
  refType?: 'PURCHASE' | 'INVOICE';
  refId?: string;
  note?: string;
}
