import { Unit } from '@prisma/client';

/** One line item extracted from a purchase-invoice photo. */
export interface OcrExtractedItem {
  /** Set when the extractor matched an existing inventory material. */
  materialId?: string;
  name: string;
  unit: Unit;
  quantity: number;
  unitPrice: number;
  /** 0..1 — surfaced in the UI so the user knows what to double-check. */
  confidence: number;
}

/**
 * A draft purchase extracted from an image. Nothing is saved until the user
 * confirms. Invoice text and model output are untrusted data: a provider must
 * extract only these typed fields, ignore embedded instructions, and never
 * perform actions or access secrets based on document content.
 */
export interface OcrPurchaseDraft {
  supplierName?: string;
  date?: string; // ISO yyyy-mm-dd
  items: OcrExtractedItem[];
  total?: number;
  confidence: number;
  provider: string;
}

export interface OcrMaterialContext {
  id: string;
  name: string;
  unit: Unit;
  unitPrice: number;
}

/**
 * Abstraction over the receipt/invoice extraction engine. The MVP ships a
 * mock implementation; swapping in a real provider (Google Vision, Azure
 * Document Intelligence, self-hosted model...) only requires a new class
 * bound to OCR_PROVIDER in purchases.module.ts — no other code changes.
 */
export interface OcrProvider {
  extractPurchaseDraft(
    imageBase64: string | undefined,
    context: { materials: OcrMaterialContext[] },
  ): Promise<OcrPurchaseDraft>;
}

export const OCR_PROVIDER = 'OCR_PROVIDER';
