import { Prisma } from '@prisma/client';
import { IInvoiceRepository } from '../../application/ports/repositories/invoice.repository.port';
import {
  CreateInvoiceData,
  InvoiceFilter,
  InvoiceStatus,
  InvoiceWithDetails,
} from '../../domain/entities/invoice.entity';
import { getMonthRange } from '../../common/utils/month-range';

type Db = Prisma.TransactionClient;

// Prisma returns types with extra fields (e.g. full Customer shape) that are
// structurally compatible with our domain types — we widen via `unknown` only
// at the infrastructure boundary. Domain and application code stay clean.
function asInvoice<T>(p: Promise<T>): Promise<InvoiceWithDetails> {
  return p as unknown as Promise<InvoiceWithDetails>;
}
function asInvoices<T>(p: Promise<T>): Promise<InvoiceWithDetails[]> {
  return p as unknown as Promise<InvoiceWithDetails[]>;
}

export class PrismaInvoiceRepository implements IInvoiceRepository {
  constructor(private readonly db: Db) {}

  async findById(businessId: string, id: string): Promise<InvoiceWithDetails | null> {
    const result = await this.db.invoice.findFirst({
      where: { id, businessId },
      include: { items: true, customer: true },
    });
    return result as unknown as InvoiceWithDetails | null;
  }

  async findAll(businessId: string, filter: InvoiceFilter): Promise<InvoiceWithDetails[]> {
    const range = filter.month ? getMonthRange(filter.month) : undefined;
    const results = await this.db.invoice.findMany({
      where: {
        businessId,
        status: filter.status,
        ...(range && { issueDate: { gte: range.start, lt: range.end } }),
      },
      include: { items: true, customer: true },
      orderBy: { number: 'desc' },
    });
    return results as unknown as InvoiceWithDetails[];
  }

  async maxNumber(businessId: string): Promise<number> {
    const agg = await this.db.invoice.aggregate({
      where: { businessId },
      _max: { number: true },
    });
    return agg._max.number ?? 0;
  }

  create(data: CreateInvoiceData): Promise<InvoiceWithDetails> {
    return asInvoice(
      this.db.invoice.create({
        data: {
          businessId: data.businessId,
          customerId: data.customerId,
          number: data.number,
          status: data.status,
          dueDate: data.dueDate,
          notes: data.notes,
          subtotal: data.subtotal,
          vatAmount: data.vatAmount,
          total: data.total,
          paidAmount: data.paidAmount,
          items: { create: data.items },
        },
        include: { items: true, customer: true },
      }),
    );
  }

  updateStatus(id: string, status: InvoiceStatus, paidAmount: number): Promise<InvoiceWithDetails> {
    return asInvoice(
      this.db.invoice.update({
        where: { id },
        data: { status, paidAmount },
        include: { items: true, customer: true },
      }),
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.invoice.delete({ where: { id } });
  }
}
