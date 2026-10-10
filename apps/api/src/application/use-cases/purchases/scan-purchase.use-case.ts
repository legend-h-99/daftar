import { Inject, Injectable } from '@nestjs/common';
import { MATERIAL_REPOSITORY, IMaterialRepository } from '../../ports/repositories/material.repository.port';
import { OCR_SERVICE, IOcrService, OcrPurchaseDraft } from '../../ports/services/ocr.port';

@Injectable()
export class ScanPurchaseUseCase {
  constructor(
    @Inject(MATERIAL_REPOSITORY) private readonly materialRepo: IMaterialRepository,
    @Inject(OCR_SERVICE) private readonly ocr: IOcrService,
  ) {}

  async execute(businessId: string, imageBase64?: string): Promise<OcrPurchaseDraft> {
    const materials = await this.materialRepo.findAllByBusiness(businessId);
    return this.ocr.extractPurchaseDraft(imageBase64, {
      materials: materials.map((m) => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        unitPrice: m.unitPrice,
      })),
    });
  }
}
