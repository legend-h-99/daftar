import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IAtomicContext, IUnitOfWork } from '../../application/ports/unit-of-work.port';
import { PrismaMaterialRepository } from './prisma-material.repository';
import { PrismaProductRepository } from './prisma-product.repository';
import { PrismaInvoiceRepository } from './prisma-invoice.repository';
import { PrismaPurchaseRepository } from './prisma-purchase.repository';
import { PrismaStockMovementRepository } from './prisma-stock-movement.repository';

/**
 * Prisma implementation of IUnitOfWork.
 * Creates scoped repositories that all share the same transaction client,
 * so every write inside `work()` is committed or rolled back atomically.
 * Use cases receive IAtomicContext and never see Prisma types.
 */
@Injectable()
export class PrismaUnitOfWork implements IUnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  execute<T>(work: (ctx: IAtomicContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(this.buildContext(tx)));
  }

  executeSerializable<T>(work: (ctx: IAtomicContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      (tx) => work(this.buildContext(tx)),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private buildContext(tx: Prisma.TransactionClient): IAtomicContext {
    return {
      material: new PrismaMaterialRepository(tx),
      product: new PrismaProductRepository(tx),
      invoice: new PrismaInvoiceRepository(tx),
      purchase: new PrismaPurchaseRepository(tx),
      stockMovement: new PrismaStockMovementRepository(tx),
    };
  }
}
