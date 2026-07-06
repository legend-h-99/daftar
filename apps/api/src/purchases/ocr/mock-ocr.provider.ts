import { Injectable } from '@nestjs/common';
import {
  OcrMaterialContext,
  OcrProvider,
  OcrPurchaseDraft,
  OcrExtractedItem,
} from './ocr.provider';

/**
 * Development stand-in for a real OCR engine. It does NOT read the image;
 * it produces a realistic draft from the business's own materials so the
 * full review-and-confirm flow (including stock linkage) can be exercised
 * end-to-end without an external service. The UI labels the result as
 * تجريبي (demo) via provider: 'mock'.
 */
@Injectable()
export class MockOcrProvider implements OcrProvider {
  async extractPurchaseDraft(
    _imageBase64: string | undefined,
    context: { materials: OcrMaterialContext[] },
  ): Promise<OcrPurchaseDraft> {
    const known = context.materials.slice(0, 3);

    const items: OcrExtractedItem[] =
      known.length > 0
        ? known.map((m, i) => ({
            materialId: m.id,
            name: m.name,
            unit: m.unit,
            // Deterministic but varied demo quantities/prices.
            quantity: [5, 2, 10][i % 3],
            unitPrice: Math.round(m.unitPrice * 100) / 100 || 3.5,
            confidence: [0.92, 0.81, 0.66][i % 3],
          }))
        : [
            // No materials yet: propose new ones so confirming the draft
            // also creates the inventory items automatically.
            { name: 'طحين', unit: 'KG', quantity: 10, unitPrice: 3, confidence: 0.88 },
            { name: 'سكر', unit: 'KG', quantity: 5, unitPrice: 4.5, confidence: 0.74 },
          ];

    const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

    return {
      supplierName: 'مؤسسة التموين الغذائي',
      date: new Date().toISOString().slice(0, 10),
      items,
      total: Math.round(total * 100) / 100,
      confidence: 0.8,
      provider: 'mock',
    };
  }
}
