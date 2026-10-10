import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaInvoiceRepository } from './prisma-invoice.repository';
import { IInvoiceRepository } from '../../application/ports/repositories/invoice.repository.port';
import {
  CreateInvoiceData,
  InvoiceFilter,
  InvoiceStatus,
  InvoiceWithDetails,
} from '../../domain/entities/invoice.entity';

@Injectable()
export class PrismaInvoiceStandaloneRepository implements IInvoiceRepository {
  private readonly repo: PrismaInvoiceRepository;

  constructor(prisma: PrismaService) {
    this.repo = new PrismaInvoiceRepository(prisma as never);
  }

  findById(businessId: string, id: string): Promise<InvoiceWithDetails | null> {
    return this.repo.findById(businessId, id);
  }

  findAll(businessId: string, filter: InvoiceFilter): Promise<InvoiceWithDetails[]> {
    return this.repo.findAll(businessId, filter);
  }

  maxNumber(businessId: string): Promise<number> {
    return this.repo.maxNumber(businessId);
  }

  create(data: CreateInvoiceData): Promise<InvoiceWithDetails> {
    return this.repo.create(data);
  }

  updateStatus(id: string, status: InvoiceStatus, paidAmount: number): Promise<InvoiceWithDetails> {
    return this.repo.updateStatus(id, status, paidAmount);
  }

  remove(id: string): Promise<void> {
    return this.repo.remove(id);
  }
}
