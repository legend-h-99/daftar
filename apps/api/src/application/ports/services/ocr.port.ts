import { MaterialUnit } from '../../../domain/entities/material.entity';

export const OCR_SERVICE = Symbol('OCR_SERVICE');

export interface OcrMaterialContext {
  id: string;
  name: string;
  unit: MaterialUnit;
  unitPrice: number;
}

export interface OcrExtractedItem {
  materialId?: string;
  name: string;
  unit: MaterialUnit;
  quantity: number;
  unitPrice: number;
  confidence: number;
}

export interface OcrPurchaseDraft {
  supplierName?: string;
  date?: string;
  items: OcrExtractedItem[];
  total?: number;
  confidence: number;
  provider: string;
}

export interface IOcrService {
  extractPurchaseDraft(
    imageBase64: string | undefined,
    context: { materials: OcrMaterialContext[] },
  ): Promise<OcrPurchaseDraft>;
}
