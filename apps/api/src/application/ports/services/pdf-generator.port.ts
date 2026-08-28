import { InvoiceWithDetails } from '../../../domain/entities/invoice.entity';
import { Business } from '../../../domain/entities/business.entity';

export const PDF_GENERATOR = Symbol('PDF_GENERATOR');

export interface GeneratedPdf {
  buffer: Buffer;
  filename: string;
}

export interface IPdfGenerator {
  generateInvoicePdf(invoice: InvoiceWithDetails, business: Business): Promise<GeneratedPdf>;
}
