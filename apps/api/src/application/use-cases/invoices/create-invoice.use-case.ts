import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BUSINESS_REPOSITORY, IBusinessRepository } from '../../ports/repositories/business.repository.port';
import { UNIT_OF_WORK, IUnitOfWork, IAtomicContext } from '../../ports/unit-of-work.port';
import { InvoiceStatus, InvoiceWithDetails } from '../../../domain/entities/invoice.entity';

const VAT_RATE = 0.15;
const MAX_RETRIES = 5;

export interface CreateInvoiceCommand {
  customerId?: string;
  status?: InvoiceStatus;
  dueDate?: string;
  notes?: string;
  items: Array<{
    productId?: string;
    name: string;
    unitPrice: number;
    quantity: number;
  }>;
}

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    @Inject(BUSINESS_REPOSITORY) private readonly businessRepo: IBusinessRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
  ) {}

  async execute(businessId: string, cmd: CreateInvoiceCommand): Promise<InvoiceWithDetails> {
    const business = await this.businessRepo.findById(businessId);
    if (!business) throw new NotFoundException('Business not found');

    // Financial math lives here — never trust client totals.
    const items = cmd.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.unitPrice * i.quantity,
    }));
    const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
    const vatAmount = business.vatEnabled ? subtotal * VAT_RATE : 0;
    const total = subtotal + vatAmount;

    // Serializable + retry: defends sequential numbering against concurrent races.
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.uow.executeSerializable(async (ctx) => {
          const nextNumber = (await ctx.invoice.maxNumber(businessId)) + 1;

          const invoice = await ctx.invoice.create({
            businessId,
            customerId: cmd.customerId,
            number: nextNumber,
            status: cmd.status ?? 'UNPAID',
            dueDate: cmd.dueDate ? new Date(cmd.dueDate) : undefined,
            notes: cmd.notes,
            subtotal,
            vatAmount,
            total,
            paidAmount: 0,
            items,
          });

          await this.consumeStockForSale(ctx, businessId, invoice.id, items);

          return invoice;
        });
      } catch (err: unknown) {
        lastError = err;
        // Retry only on unique-constraint violation for [businessId, number].
        if (!isUniqueConstraintError(err)) throw err;
      }
    }
    throw lastError;
  }

  /** Resolves which materials are consumed by each product, then decrements stock. */
  private async consumeStockForSale(
    ctx: IAtomicContext,
    businessId: string,
    invoiceId: string,
    items: Array<{ productId?: string; quantity: number }>,
  ): Promise<void> {
    const productIds = [...new Set(items.flatMap((i) => (i.productId ? [i.productId] : [])))];
    if (productIds.length === 0) return;

    const products = await ctx.product.findManyByIds(businessId, productIds);

    // Aggregate consumption across all invoice lines (a product may appear on multiple lines).
    const consumed = new Map<string, { qty: number; unitPrice: number }>();
    for (const item of items) {
      if (!item.productId) continue;
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;

      for (const line of product.recipeItems) {
        if (!line.materialId) continue;
        const used = line.quantityUsed * item.quantity;
        const current = consumed.get(line.materialId) ?? { qty: 0, unitPrice: line.unitPrice };
        consumed.set(line.materialId, { qty: current.qty + used, unitPrice: line.unitPrice });
      }
    }

    for (const [materialId, { qty, unitPrice }] of consumed) {
      if (qty <= 0) continue;
      const updated = await ctx.material.decrementStock(materialId, qty);
      await ctx.stockMovement.create({
        businessId,
        materialId,
        type: 'SALE',
        qty: -qty,
        balanceAfter: updated.stockQty,
        costAmount: qty * unitPrice,
        refType: 'INVOICE',
        refId: invoiceId,
      });
    }
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>)['code'] === 'P2002'
  );
}
