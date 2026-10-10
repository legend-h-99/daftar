import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaPurchaseRepository } from './prisma-purchase.repository';
import { IPurchaseRepository } from '../../application/ports/repositories/purchase.repository.port';
import {
  CreatePurchaseData,
  CreatePurchaseItemData,
  Purchase,
  PurchaseWithItems,
} from '../../domain/entities/purchase.entity';

@Injectable()
export class PrismaPurchaseStandaloneRepository implements IPurchaseRepository {
  private readonly repo: PrismaPurchaseRepository;

  constructor(prisma: PrismaService) {
    this.repo = new PrismaPurchaseRepository(prisma as never);
  }

  findById(businessId: string, id: string): Promise<PurchaseWithItems | null> {
    return this.repo.findById(businessId, id);
  }

  findAll(businessId: string, supplierId?: string, month?: string): Promise<PurchaseWithItems[]> {
    return this.repo.findAll(businessId, supplierId, month);
  }

  maxNumber(businessId: string): Promise<number> {
    return this.repo.maxNumber(businessId);
  }

  create(data: CreatePurchaseData): Promise<Purchase> {
    return this.repo.create(data);
  }

  createItem(data: CreatePurchaseItemData): Promise<void> {
    return this.repo.createItem(data);
  }

  remove(id: string): Promise<PurchaseWithItems> {
    return this.repo.remove(id);
  }
}
