export const INVENTORY_QUERY = Symbol('INVENTORY_QUERY');

export interface InventoryItem {
  id: string;
  businessId: string;
  name: string;
  unit: string;
  stockQty: number;
  unitPrice: number;
  purchasePrice: number;
  purchaseQty: number;
  vatRate: number;
  reorderLevel: number | null;
  createdAt: Date;
  lowStock: boolean;
}

export interface StockMovementWithMaterial {
  id: string;
  businessId: string;
  materialId: string | null;
  type: string;
  qty: number;
  balanceAfter: number;
  costAmount: number | null;
  refType: string | null;
  refId: string | null;
  note: string | null;
  createdAt: Date;
  material: { name: string; unit: string } | null;
}

export interface IInventoryQuery {
  list(businessId: string): Promise<InventoryItem[]>;
  movements(businessId: string, materialId?: string): Promise<StockMovementWithMaterial[]>;
}
