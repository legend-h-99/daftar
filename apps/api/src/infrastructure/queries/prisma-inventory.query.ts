import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IInventoryQuery,
  InventoryItem,
  StockMovementWithMaterial,
} from '../../application/ports/queries/inventory.query.port';

@Injectable()
export class PrismaInventoryQuery implements IInventoryQuery {
  constructor(private readonly prisma: PrismaService) {}

  async list(businessId: string): Promise<InventoryItem[]> {
    const materials = await this.prisma.material.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
    return materials.map((m) => ({
      ...m,
      lowStock: m.reorderLevel !== null && m.stockQty <= m.reorderLevel,
    })) as InventoryItem[];
  }

  movements(businessId: string, materialId?: string): Promise<StockMovementWithMaterial[]> {
    return this.prisma.stockMovement.findMany({
      where: { businessId, materialId },
      include: { material: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }) as unknown as Promise<StockMovementWithMaterial[]>;
  }
}
