import { Prisma } from '@prisma/client';
import {
  CreateMaterialData,
  Material,
  MaterialUnit,
  UpdateMaterialPricingData,
} from '../../domain/entities/material.entity';
import { IMaterialRepository } from '../../application/ports/repositories/material.repository.port';

type Db = Prisma.TransactionClient;

// Prisma Material is structurally compatible with our domain Material; widen at boundary.
const m = <T>(p: PromiseLike<T>): Promise<Material> => p as unknown as Promise<Material>;
const ms = <T>(p: PromiseLike<T>): Promise<Material[]> => p as unknown as Promise<Material[]>;

export class PrismaMaterialRepository implements IMaterialRepository {
  constructor(private readonly db: Db) {}

  async findById(businessId: string, id: string): Promise<Material | null> {
    const r = await this.db.material.findFirst({ where: { id, businessId } });
    return r as unknown as Material | null;
  }

  async findByNameAndUnit(businessId: string, name: string, unit: MaterialUnit): Promise<Material | null> {
    const r = await this.db.material.findFirst({ where: { businessId, name, unit } });
    return r as unknown as Material | null;
  }

  findAllByBusiness(businessId: string): Promise<Material[]> {
    return ms(this.db.material.findMany({ where: { businessId }, orderBy: { name: 'asc' } }));
  }

  findManyByIds(ids: string[]): Promise<Material[]> {
    return ms(this.db.material.findMany({ where: { id: { in: ids } } }));
  }

  create(data: CreateMaterialData): Promise<Material> {
    return m(this.db.material.create({ data }));
  }

  update(id: string, data: Partial<Material>): Promise<Material> {
    return m(this.db.material.update({ where: { id }, data }));
  }

  incrementStock(id: string, qty: number): Promise<Material> {
    return m(this.db.material.update({ where: { id }, data: { stockQty: { increment: qty } } }));
  }

  decrementStock(id: string, qty: number): Promise<Material> {
    return m(this.db.material.update({ where: { id }, data: { stockQty: { decrement: qty } } }));
  }

  setStock(id: string, qty: number): Promise<Material> {
    return m(this.db.material.update({ where: { id }, data: { stockQty: qty } }));
  }

  updatePricing(id: string, data: UpdateMaterialPricingData): Promise<Material> {
    return m(this.db.material.update({ where: { id }, data }));
  }
}
