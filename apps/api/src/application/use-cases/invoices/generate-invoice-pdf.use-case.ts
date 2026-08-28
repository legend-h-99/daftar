import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BUSINESS_REPOSITORY, IBusinessRepository } from '../../ports/repositories/business.repository.port';
import { INVOICE_REPOSITORY, IInvoiceRepository } from '../../ports/repositories/invoice.repository.port';
import { PDF_GENERATOR, IPdfGenerator, GeneratedPdf } from '../../ports/services/pdf-generator.port';

@Injectable()
export class GenerateInvoicePdfUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepo: IInvoiceRepository,
    @Inject(BUSINESS_REPOSITORY) private readonly businessRepo: IBusinessRepository,
    @Inject(PDF_GENERATOR) private readonly pdfGenerator: IPdfGenerator,
  ) {}

  async execute(businessId: string, invoiceId: string): Promise<GeneratedPdf> {
    const [invoice, business] = await Promise.all([
      this.invoiceRepo.findById(businessId, invoiceId),
      this.businessRepo.findById(businessId),
    ]);

    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!business) throw new NotFoundException('Business not found');

    return this.pdfGenerator.generateInvoicePdf(invoice, business);
  }
}
