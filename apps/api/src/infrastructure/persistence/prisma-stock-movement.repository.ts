import { Prisma } from '@prisma/client';
import { IStockMovementRepository, StockMovementWithMaterial } from '../../application/ports/repositories/stock-movement.repository.port';
import { CreateMovementData, StockMovement } from '../../domain/entities/stock-movement.entity';

type Db = Prisma.TransactionClient;

export class PrismaStockMovementRepository implements IStockMovementRepository {
  constructor(private readonly db: Db) {}

  async create(data: CreateMovementData): Promise<StockMovement> {
    return this.db.stockMovement.create({ data });
  }

  async findByBusiness(
    businessId: string,
    materialId?: string,
  ): Promise<StockMovementWithMaterial[]> {
    return this.db.stockMovement.findMany({
      where: { businessId, ...(materialId && { materialId }) },
      include: { material: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }) as Promise<StockMovementWithMaterial[]>;
  }
}
