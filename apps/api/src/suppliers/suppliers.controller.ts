import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(user.businessId as string, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.suppliersService.findAll(user.businessId as string);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(user.businessId as string, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.suppliersService.remove(user.businessId as string, id);
  }
}
