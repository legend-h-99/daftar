import { IMaterialRepository } from './repositories/material.repository.port';
import { IProductRepository } from './repositories/product.repository.port';
import { IInvoiceRepository } from './repositories/invoice.repository.port';
import { IPurchaseRepository } from './repositories/purchase.repository.port';
import { IStockMovementRepository } from './repositories/stock-movement.repository.port';

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

/**
 * Scoped repository bundle that all use cases receive inside a transaction.
 * Each member is a repository backed by the same atomic transaction context —
 * use cases never touch a transaction primitive directly.
 */
export interface IAtomicContext {
  material: IMaterialRepository;
  product: IProductRepository;
  invoice: IInvoiceRepository;
  purchase: IPurchaseRepository;
  stockMovement: IStockMovementRepository;
}

export interface IUnitOfWork {
  /**
   * Execute `work` in a single atomic transaction.
   * If `work` throws, all writes are rolled back.
   */
  execute<T>(work: (ctx: IAtomicContext) => Promise<T>): Promise<T>;

  /**
   * Same as `execute` but with Serializable isolation level.
   * Required for sequential-numbering operations (invoices, purchases).
   */
  executeSerializable<T>(work: (ctx: IAtomicContext) => Promise<T>): Promise<T>;
}
