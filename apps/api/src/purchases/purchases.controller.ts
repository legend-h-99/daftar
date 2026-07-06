import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ScanInvoiceDto } from './dto/scan-invoice.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  // 12MB base64 bodies: keep the OCR surface from becoming a memory-DoS vector.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('scan')
  scan(@CurrentUser() user: CurrentUserData, @Body() dto: ScanInvoiceDto) {
    return this.purchasesService.scan(user.businessId as string, dto.imageBase64);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreatePurchaseDto) {
    return this.purchasesService.create(user.businessId as string, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.purchasesService.findAll(user.businessId as string);
  }

  @Get('summary')
  summary(@CurrentUser() user: CurrentUserData) {
    return this.purchasesService.summary(user.businessId as string);
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.purchasesService.findOne(user.businessId as string, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.purchasesService.remove(user.businessId as string, id);
  }
}
