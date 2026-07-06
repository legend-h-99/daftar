import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserData) {
    return this.inventoryService.list(user.businessId as string);
  }

  @Get('movements')
  movements(
    @CurrentUser() user: CurrentUserData,
    @Query('materialId') materialId?: string,
  ) {
    return this.inventoryService.movements(user.businessId as string, materialId || undefined);
  }

  @Post('adjust')
  adjust(@CurrentUser() user: CurrentUserData, @Body() dto: AdjustStockDto) {
    return this.inventoryService.adjust(user.businessId as string, dto);
  }
}
