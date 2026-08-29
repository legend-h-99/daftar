import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { INVOICE_REPOSITORY, IInvoiceRepository } from '../../ports/repositories/invoice.repository.port';
import { InvoiceStatus, InvoiceWithDetails } from '../../../domain/entities/invoice.entity';

export interface UpdateInvoiceStatusCommand {
  status: InvoiceStatus;
  paidAmount: number;
}

@Injectable()
export class UpdateInvoiceStatusUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepo: IInvoiceRepository,
  ) {}

  async execute(
    businessId: string,
    invoiceId: string,
    cmd: UpdateInvoiceStatusCommand,
  ): Promise<InvoiceWithDetails> {
    const existing = await this.invoiceRepo.findById(businessId, invoiceId);
    if (!existing) throw new NotFoundException('Invoice not found');

    return this.invoiceRepo.updateStatus(invoiceId, cmd.status, cmd.paidAmount);
  }
}
