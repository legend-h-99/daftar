export type MaterialUnit = 'KG' | 'GRAM' | 'LITER' | 'ML' | 'PIECE';

export interface Material {
  id: string;
  businessId: string;
  name: string;
  unit: MaterialUnit;
  stockQty: number;
  unitPrice: number;
  purchasePrice: number;
  purchaseQty: number;
  vatRate: number;
  reorderLevel: number | null;
  createdAt: Date;
}

export interface CreateMaterialData {
  businessId: string;
  name: string;
  unit: MaterialUnit;
  unitPrice: number;
  purchasePrice: number;
  purchaseQty: number;
  stockQty: number;
  vatRate?: number;
  reorderLevel?: number;
}

export interface UpdateMaterialPricingData {
  unitPrice: number;
  purchasePrice: number;
  purchaseQty: number;
}
