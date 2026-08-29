import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaMaterialRepository } from './prisma-material.repository';
import {
  CreateMaterialData,
  Material,
  MaterialUnit,
  UpdateMaterialPricingData,
} from '../../domain/entities/material.entity';
import { IMaterialRepository } from '../../application/ports/repositories/material.repository.port';

/**
 * Injectable singleton wrapper around PrismaMaterialRepository for use
 * outside of a Unit of Work (e.g., simple list queries).
 */
@Injectable()
export class PrismaMaterialStandaloneRepository implements IMaterialRepository {
  private readonly repo: PrismaMaterialRepository;

  constructor(prisma: PrismaService) {
    // Cast to TransactionClient shape — Prisma client satisfies it for non-tx use.
    this.repo = new PrismaMaterialRepository(prisma as never);
  }

  findById(businessId: string, id: string) { return this.repo.findById(businessId, id); }
  findByNameAndUnit(businessId: string, name: string, unit: MaterialUnit) { return this.repo.findByNameAndUnit(businessId, name, unit); }
  findAllByBusiness(businessId: string) { return this.repo.findAllByBusiness(businessId); }
  findManyByIds(ids: string[]) { return this.repo.findManyByIds(ids); }
  create(data: CreateMaterialData) { return this.repo.create(data); }
  update(id: string, data: Partial<Material>) { return this.repo.update(id, data); }
  incrementStock(id: string, qty: number) { return this.repo.incrementStock(id, qty); }
  decrementStock(id: string, qty: number) { return this.repo.decrementStock(id, qty); }
  setStock(id: string, qty: number) { return this.repo.setStock(id, qty); }
  updatePricing(id: string, data: UpdateMaterialPricingData) { return this.repo.updatePricing(id, data); }
}
