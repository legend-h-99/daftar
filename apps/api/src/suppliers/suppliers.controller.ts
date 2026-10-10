import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SupplierCrudService } from '../application/use-cases/suppliers/supplier-crud.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';
import { PaginationDto, toPaginationParams } from '../common/dto/pagination.dto';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly supplierService: SupplierCrudService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateSupplierDto) {
    return this.supplierService.create(user.businessId as string, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData, @Query() pagination: PaginationDto) {
    const { limit, skip } = toPaginationParams(pagination);
    return this.supplierService.findAll(user.businessId as string, limit, skip);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.supplierService.update(user.businessId as string, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.supplierService.remove(user.businessId as string, id);
  }
}
