import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Stock overview: every material with its live quantity and low-stock flag. */
  async list(businessId: string) {
    const materials = await this.prisma.material.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
    return materials.map((m) => ({
      ...m,
      lowStock: m.reorderLevel !== null && m.stockQty <= m.reorderLevel,
    }));
  }

  /** Append-only movement ledger, newest first. */
  movements(businessId: string, materialId?: string) {
    return this.prisma.stockMovement.findMany({
      where: { businessId, materialId },
      include: { material: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Manual stock adjustment (e.g. after a physical count). Records the delta
   * as an ADJUSTMENT movement so the ledger always explains the balance.
   */
  async adjust(businessId: string, dto: AdjustStockDto) {
    return this.prisma.$transaction(async (tx) => {
      const material = await tx.material.findFirst({
        where: { id: dto.materialId, businessId },
      });
      if (!material) {
        throw new NotFoundException('Material not found');
      }

      const delta = dto.newQty - material.stockQty;
      const updated = await tx.material.update({
        where: { id: material.id },
        data: { stockQty: dto.newQty },
      });

      await tx.stockMovement.create({
        data: {
          businessId,
          materialId: material.id,
          type: 'ADJUSTMENT',
          qty: delta,
          balanceAfter: updated.stockQty,
          note: dto.note,
        },
      });

      return updated;
    });
  }
}
