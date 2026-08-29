export type StockMovementType = 'PURCHASE' | 'SALE' | 'ADJUSTMENT';

export interface StockMovement {
  id: string;
  businessId: string;
  materialId: string;
  type: StockMovementType;
  qty: number;
  balanceAfter: number;
  costAmount: number | null;
  refType: string | null;
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
  refType?: string;
  refId?: string;
  note?: string;
}
