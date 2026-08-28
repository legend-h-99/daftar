import { Prisma } from '@prisma/client';
import { IPurchaseRepository } from '../../application/ports/repositories/purchase.repository.port';
import {
  CreatePurchaseData,
  CreatePurchaseItemData,
  Purchase,
  PurchaseWithItems,
} from '../../domain/entities/purchase.entity';
import { getMonthRange } from '../../common/utils/month-range';

type Db = Prisma.TransactionClient;

const pw = <T>(p: PromiseLike<T>): Promise<PurchaseWithItems> => p as unknown as Promise<PurchaseWithItems>;
const pws = <T>(p: PromiseLike<T>): Promise<PurchaseWithItems[]> => p as unknown as Promise<PurchaseWithItems[]>;

export class PrismaPurchaseRepository implements IPurchaseRepository {
  constructor(private readonly db: Db) {}

  async findById(businessId: string, id: string): Promise<PurchaseWithItems | null> {
    const r = await this.db.purchase.findFirst({
      where: { id, businessId },
      include: { items: true, supplier: true },
    });
    return r as unknown as PurchaseWithItems | null;
  }

  findAll(businessId: string, supplierId?: string, month?: string): Promise<PurchaseWithItems[]> {
    const range = month ? getMonthRange(month) : undefined;
    return pws(
      this.db.purchase.findMany({
        where: {
          businessId,
          ...(supplierId && { supplierId }),
          ...(range && { date: { gte: range.start, lt: range.end } }),
        },
        include: { items: true, supplier: true },
        orderBy: { number: 'desc' },
      }),
    );
  }

  async maxNumber(businessId: string): Promise<number> {
    const agg = await this.db.purchase.aggregate({
      where: { businessId },
      _max: { number: true },
    });
    return agg._max.number ?? 0;
  }

  async create(data: CreatePurchaseData): Promise<Purchase> {
    const r = await this.db.purchase.create({
      data: {
        businessId: data.businessId,
        supplierId: data.supplierId,
        number: data.number,
        source: data.source,
        total: data.total,
        date: data.date,
        notes: data.notes,
      },
    });
    return r as unknown as Purchase;
  }

  async createItem(data: CreatePurchaseItemData): Promise<void> {
    await this.db.purchaseItem.create({ data });
  }

  remove(id: string): Promise<PurchaseWithItems> {
    return pw(this.db.purchase.delete({ where: { id }, include: { items: true, supplier: true } }));
  }
}
