import { NotFoundException } from '@nestjs/common';
import { UpdateInvoiceStatusUseCase } from './update-invoice-status.use-case';
import { IInvoiceRepository } from '../../ports/repositories/invoice.repository.port';
import { InvoiceWithDetails } from '../../../domain/entities/invoice.entity';

const BUSINESS_ID = 'biz-1';
const INVOICE_ID = 'inv-1';

describe('UpdateInvoiceStatusUseCase', () => {
  let repo: { findById: jest.Mock; updateStatus: jest.Mock };
  let useCase: UpdateInvoiceStatusUseCase;
  const updated = { id: INVOICE_ID, status: 'PARTIAL', paidAmount: 40 } as unknown as InvoiceWithDetails;

  beforeEach(() => {
    repo = {
      findById: jest.fn().mockResolvedValue({ id: INVOICE_ID }),
      updateStatus: jest.fn().mockResolvedValue(updated),
    };
    useCase = new UpdateInvoiceStatusUseCase(repo as unknown as IInvoiceRepository);
  });

  it('checks the invoice belongs to the business before updating', async () => {
    await useCase.execute(BUSINESS_ID, INVOICE_ID, { status: 'PARTIAL', paidAmount: 40 });
    expect(repo.findById).toHaveBeenCalledWith(BUSINESS_ID, INVOICE_ID);
    expect(repo.updateStatus).toHaveBeenCalledWith(INVOICE_ID, 'PARTIAL', 40);
  });

  it('passes status and paidAmount through and returns the repository result', async () => {
    await expect(
      useCase.execute(BUSINESS_ID, INVOICE_ID, { status: 'PARTIAL', paidAmount: 40 }),
    ).resolves.toBe(updated);
  });

  it('throws NotFound and does not update when the invoice is not found for this business', async () => {
    repo.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute(BUSINESS_ID, 'inv-404', { status: 'PAID', paidAmount: 100 }),
    ).rejects.toThrow(new NotFoundException('Invoice not found'));

    expect(repo.updateStatus).not.toHaveBeenCalled();
  });
});
