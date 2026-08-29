import {
  CreateInvoiceData,
  Invoice,
  InvoiceFilter,
  InvoiceStatus,
  InvoiceWithDetails,
} from '../../../domain/entities/invoice.entity';

export const INVOICE_REPOSITORY = Symbol('INVOICE_REPOSITORY');

export interface IInvoiceRepository {
  findById(businessId: string, id: string): Promise<InvoiceWithDetails | null>;
  findAll(businessId: string, filter: InvoiceFilter): Promise<InvoiceWithDetails[]>;

  /** Returns MAX(number) for the business, or 0 if none exist yet. */
  maxNumber(businessId: string): Promise<number>;

  create(data: CreateInvoiceData): Promise<InvoiceWithDetails>;
  updateStatus(id: string, status: InvoiceStatus, paidAmount: number): Promise<InvoiceWithDetails>;
  remove(id: string): Promise<void>;
}
