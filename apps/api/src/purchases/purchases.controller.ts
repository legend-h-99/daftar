import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreatePurchaseUseCase, CreatePurchaseCommand } from '../application/use-cases/purchases/create-purchase.use-case';
import { DeletePurchaseUseCase } from '../application/use-cases/purchases/delete-purchase.use-case';
import { ScanPurchaseUseCase } from '../application/use-cases/purchases/scan-purchase.use-case';
import { PURCHASE_REPOSITORY, IPurchaseRepository } from '../application/ports/repositories/purchase.repository.port';
import { PURCHASE_SUMMARY_QUERY, IPurchaseSummaryQuery } from '../application/ports/queries/purchase-summary.query.port';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ScanInvoiceDto } from './dto/scan-invoice.dto';
import { FindPurchasesQueryDto } from './dto/find-purchases-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(
    private readonly createPurchase: CreatePurchaseUseCase,
    private readonly deletePurchase: DeletePurchaseUseCase,
    private readonly scanPurchase: ScanPurchaseUseCase,
    @Inject(PURCHASE_REPOSITORY) private readonly purchaseRepo: IPurchaseRepository,
    @Inject(PURCHASE_SUMMARY_QUERY) private readonly summaryQuery: IPurchaseSummaryQuery,
  ) {}

  // 12MB base64 bodies: keep the OCR surface from becoming a memory-DoS vector.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('scan')
  scan(@CurrentUser() user: CurrentUserData, @Body() dto: ScanInvoiceDto) {
    return this.scanPurchase.execute(user.businessId as string, dto.imageBase64);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreatePurchaseDto) {
    const cmd: CreatePurchaseCommand = {
      supplierId: dto.supplierId,
      supplierName: dto.supplierName,
      notes: dto.notes,
      purchaseDate: dto.date,
      items: dto.items,
    };
    return this.createPurchase.execute(user.businessId as string, cmd);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData, @Query() query: FindPurchasesQueryDto) {
    return this.purchaseRepo.findAll(user.businessId as string, undefined, query.month);
  }

  @Get('summary')
  summary(@CurrentUser() user: CurrentUserData) {
    return this.summaryQuery.summary(user.businessId as string);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    const purchase = await this.purchaseRepo.findById(user.businessId as string, id);
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.deletePurchase.execute(user.businessId as string, id);
  }
}
