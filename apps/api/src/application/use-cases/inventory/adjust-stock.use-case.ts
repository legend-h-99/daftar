import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UNIT_OF_WORK, IUnitOfWork } from '../../ports/unit-of-work.port';
import { Material } from '../../../domain/entities/material.entity';

export interface AdjustStockCommand {
  materialId: string;
  newQty: number;
  note?: string;
}

@Injectable()
export class AdjustStockUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
  ) {}

  async execute(businessId: string, cmd: AdjustStockCommand): Promise<Material> {
    return this.uow.execute(async (ctx) => {
      const material = await ctx.material.findById(businessId, cmd.materialId);
      if (!material) throw new NotFoundException('Material not found');

      const delta = cmd.newQty - material.stockQty;
      const updated = await ctx.material.setStock(material.id, cmd.newQty);

      await ctx.stockMovement.create({
        businessId,
        materialId: material.id,
        type: 'ADJUSTMENT',
        qty: delta,
        balanceAfter: updated.stockQty,
        note: cmd.note,
      });

      return updated;
    });
  }
}
