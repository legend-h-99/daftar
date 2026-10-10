import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MATERIAL_REPOSITORY, IMaterialRepository } from '../../ports/repositories/material.repository.port';
import { Material } from '../../../domain/entities/material.entity';
import { RecostProductsUseCase } from '../products/recost-products.use-case';

export interface UpdateMaterialCommand {
  name?: string;
  unit?: string;
  purchasePrice?: number;
  purchaseQty?: number;
  reorderLevel?: number;
  vatRate?: number;
}

@Injectable()
export class UpdateMaterialUseCase {
  constructor(
    @Inject(MATERIAL_REPOSITORY) private readonly materialRepo: IMaterialRepository,
    private readonly recostProducts: RecostProductsUseCase,
  ) {}

  async execute(businessId: string, id: string, cmd: UpdateMaterialCommand): Promise<Material> {
    const material = await this.materialRepo.findById(businessId, id);
    if (!material) throw new NotFoundException('Material not found');

    const purchasePrice = cmd.purchasePrice ?? material.purchasePrice;
    const purchaseQty = cmd.purchaseQty ?? material.purchaseQty;
    const unitPrice = purchasePrice / purchaseQty;
    const priceChanged = unitPrice !== material.unitPrice;

    const updated = await this.materialRepo.update(id, {
      name: cmd.name ?? material.name,
      unit: cmd.unit ?? material.unit,
      purchasePrice,
      purchaseQty,
      unitPrice,
      reorderLevel: cmd.reorderLevel ?? material.reorderLevel,
      vatRate: cmd.vatRate ?? material.vatRate,
    } as Partial<Material>);

    if (priceChanged) {
      await this.recostProducts.execute(businessId, [id]);
    }

    return updated;
  }
}
