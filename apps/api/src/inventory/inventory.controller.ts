import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { AdjustStockUseCase, AdjustStockCommand } from '../application/use-cases/inventory/adjust-stock.use-case';
import { INVENTORY_QUERY, IInventoryQuery } from '../application/ports/queries/inventory.query.port';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly adjustStock: AdjustStockUseCase,
    @Inject(INVENTORY_QUERY) private readonly inventoryQuery: IInventoryQuery,
  ) {}

  @Get()
  list(@CurrentUser() user: CurrentUserData) {
    return this.inventoryQuery.list(user.businessId as string);
  }

  @Get('movements')
  movements(
    @CurrentUser() user: CurrentUserData,
    @Query('materialId') materialId?: string,
  ) {
    return this.inventoryQuery.movements(user.businessId as string, materialId || undefined);
  }

  @Post('adjust')
  adjust(@CurrentUser() user: CurrentUserData, @Body() dto: AdjustStockDto) {
    const cmd: AdjustStockCommand = { materialId: dto.materialId, newQty: dto.newQty, note: dto.note };
    return this.adjustStock.execute(user.businessId as string, cmd);
  }
}
