import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../prisma/prisma.service';

// NOTE: InvoicesService only injects PrismaService — no ConfigService or other deps.
// create() and generatePdf() are excluded: they require $transaction and PDFKit mocking.

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: any;

  const mockInvoice = {
    id: 'inv-1',
    number: 1,
    businessId: 'biz-1',
    status: 'UNPAID',
    total: 100,
    paidAmount: 0,
    subtotal: 100,
    vatAmount: 0,
    issueDate: new Date('2026-01-01'),
    dueDate: null,
    notes: null,
    customerId: 'cust-1',
    customer: { id: 'cust-1', name: 'تجربة' },
    items: [],
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: PrismaService,
          useValue: {
            invoice: {
              // findMany is used by findAll
              findMany: jest.fn().mockResolvedValue([mockInvoice]),
              // NOTE: findOne uses findFirst (not findUnique) per the service implementation
              findFirst: jest.fn().mockResolvedValue(mockInvoice),
              update: jest.fn().mockResolvedValue({ ...mockInvoice, status: 'PAID', paidAmount: 100 }),
              delete: jest.fn().mockResolvedValue(mockInvoice),
              aggregate: jest.fn().mockResolvedValue({ _max: { number: 1 } }),
            },
          },
        },
      ],
    }).compile();
    service = module.get(InvoicesService);
    prisma = module.get(PrismaService);
  });

  it('findAll() returns only invoices for the given businessId', async () => {
    const result = await service.findAll('biz-1', {} as any);
    expect(result).toHaveLength(1);
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ businessId: 'biz-1' }) }),
    );
  });

  it('findOne() for existing invoice returns it with items and customer', async () => {
    const result = await service.findOne('biz-1', 'inv-1');
    expect(result.id).toBe('inv-1');
    expect(result.customer).toBeDefined();
    expect(result.items).toBeDefined();
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-1', businessId: 'biz-1' } }),
    );
  });

  it('findOne() for missing invoice throws NotFoundException', async () => {
    prisma.invoice.findFirst = jest.fn().mockResolvedValue(null);
    await expect(service.findOne('biz-1', 'nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('updateStatus() to PAID calls prisma.invoice.update with { status: "PAID" }', async () => {
    const dto = { status: 'PAID' as any, paidAmount: 100 };
    await service.updateStatus('biz-1', 'inv-1', dto);
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
  });

  it('remove() calls prisma.invoice.delete and returns { deleted: true }', async () => {
    const result = await service.remove('biz-1', 'inv-1');
    expect(prisma.invoice.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
    expect(result).toEqual({ deleted: true });
  });
});
