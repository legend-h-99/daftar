import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CalculateProductDto } from './dto/calculate-product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';
import { PaginationDto, toPaginationParams } from '../common/dto/pagination.dto';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // NOTE: declared before ':id' so it isn't shadowed by the dynamic route.
  @Post('calculate')
  calculate(@Body() dto: CalculateProductDto) {
    return this.productsService.calculate(dto);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.businessId as string, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query() pagination: PaginationDto,
  ) {
    return this.productsService.findAll(user.businessId as string, toPaginationParams(pagination));
  }

  @Get(':id')
  findOne(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.productsService.findOne(user.businessId as string, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.businessId as string, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.productsService.remove(user.businessId as string, id);
  }
}
