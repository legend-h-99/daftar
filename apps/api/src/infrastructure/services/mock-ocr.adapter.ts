import { Injectable } from '@nestjs/common';
import { IOcrService, OcrMaterialContext, OcrPurchaseDraft } from '../../application/ports/services/ocr.port';

@Injectable()
export class MockOcrAdapter implements IOcrService {
  async extractPurchaseDraft(
    _imageBase64: string | undefined,
    context: { materials: OcrMaterialContext[] },
  ): Promise<OcrPurchaseDraft> {
    const known = context.materials.slice(0, 3);

    const items = known.length > 0
      ? known.map((m, i) => ({
          materialId: m.id,
          name: m.name,
          unit: m.unit,
          quantity: [5, 2, 10][i % 3],
          unitPrice: Math.round(m.unitPrice * 100) / 100 || 3.5,
          confidence: [0.92, 0.81, 0.66][i % 3],
        }))
      : [
          { name: 'طحين', unit: 'KG' as const, quantity: 10, unitPrice: 3, confidence: 0.88 },
          { name: 'سكر', unit: 'KG' as const, quantity: 5, unitPrice: 4.5, confidence: 0.74 },
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
