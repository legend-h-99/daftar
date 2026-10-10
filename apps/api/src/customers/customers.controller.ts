import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CustomerCrudService } from '../application/use-cases/customers/customer-crud.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';
import { PaginationDto, toPaginationParams } from '../common/dto/pagination.dto';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customerService: CustomerCrudService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateCustomerDto) {
    return this.customerService.create(user.businessId as string, dto);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData, @Query() pagination: PaginationDto) {
    const { limit, skip } = toPaginationParams(pagination);
    return this.customerService.findAll(user.businessId as string, limit, skip);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customerService.update(user.businessId as string, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.customerService.remove(user.businessId as string, id);
  }
}
