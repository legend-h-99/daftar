import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, IUnitOfWork } from '../../ports/unit-of-work.port';
import { Material, MaterialUnit } from '../../../domain/entities/material.entity';

export interface CreateMaterialCommand {
  name: string;
  unit: MaterialUnit;
  purchasePrice: number;
  purchaseQty: number;
  initialQty?: number;
  reorderLevel?: number;
  vatRate?: number;
}

@Injectable()
export class CreateMaterialUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork) {}

  async execute(businessId: string, cmd: CreateMaterialCommand): Promise<Material> {
    const unitPrice = cmd.purchasePrice / cmd.purchaseQty;
    const initialQty = cmd.initialQty ?? 0;

    return this.uow.execute(async (ctx) => {
      const material = await ctx.material.create({
        businessId,
        name: cmd.name,
        unit: cmd.unit,
        purchasePrice: cmd.purchasePrice,
        purchaseQty: cmd.purchaseQty,
        unitPrice,
        reorderLevel: cmd.reorderLevel,
        vatRate: cmd.vatRate ?? 0,
        stockQty: initialQty,
      });

      if (initialQty > 0) {
        await ctx.stockMovement.create({
          businessId,
          materialId: material.id,
          type: 'ADJUSTMENT',
          qty: initialQty,
          balanceAfter: initialQty,
          note: 'رصيد افتتاحي',
        });
      }

      return material;
    });
  }
}
