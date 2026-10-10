import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CreateInvoiceUseCase, CreateInvoiceCommand } from '../application/use-cases/invoices/create-invoice.use-case';
import { UpdateInvoiceStatusUseCase } from '../application/use-cases/invoices/update-invoice-status.use-case';
import { GenerateInvoicePdfUseCase } from '../application/use-cases/invoices/generate-invoice-pdf.use-case';
import { DeleteInvoiceUseCase } from '../application/use-cases/invoices/delete-invoice.use-case';
import { INVOICE_REPOSITORY, IInvoiceRepository } from '../application/ports/repositories/invoice.repository.port';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { FindInvoicesQueryDto } from './dto/find-invoices-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly createInvoice: CreateInvoiceUseCase,
    private readonly updateInvoiceStatus: UpdateInvoiceStatusUseCase,
    private readonly generatePdf: GenerateInvoicePdfUseCase,
    private readonly deleteInvoice: DeleteInvoiceUseCase,
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepo: IInvoiceRepository,
  ) {}

  @Post()
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateInvoiceDto) {
    const cmd: CreateInvoiceCommand = {
      customerId: dto.customerId,
      status: dto.status,
      dueDate: dto.dueDate,
      notes: dto.notes,
      items: dto.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      })),
    };
    return this.createInvoice.execute(user.businessId as string, cmd);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData, @Query() query: FindInvoicesQueryDto) {
    return this.invoiceRepo.findAll(user.businessId as string, {
      status: query.status,
      month: query.month,
      limit: query.limit,
      skip: query.skip,
    });
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.invoiceRepo.findById(user.businessId as string, id);
  }

  @Get(':id/pdf')
  async pdf(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.generatePdf.execute(user.businessId as string, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceStatusDto,
  ) {
    return this.updateInvoiceStatus.execute(user.businessId as string, id, {
      status: dto.status,
      paidAmount: dto.paidAmount ?? 0,
    });
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.deleteInvoice.execute(user.businessId as string, id);
  }
}
