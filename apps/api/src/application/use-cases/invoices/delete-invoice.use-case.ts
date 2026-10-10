import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { INVOICE_REPOSITORY, IInvoiceRepository } from '../../ports/repositories/invoice.repository.port';

@Injectable()
export class DeleteInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepo: IInvoiceRepository,
  ) {}

  async execute(businessId: string, id: string): Promise<{ deleted: boolean }> {
    const invoice = await this.invoiceRepo.findById(businessId, id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.invoiceRepo.remove(id);
    return { deleted: true };
  }
}
