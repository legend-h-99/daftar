import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CreateProductUseCase, CreateProductCommand } from '../application/use-cases/products/create-product.use-case';
import { UpdateProductUseCase, UpdateProductCommand } from '../application/use-cases/products/update-product.use-case';
import { DeleteProductUseCase } from '../application/use-cases/products/delete-product.use-case';
import { PRODUCT_REPOSITORY, IProductRepository } from '../application/ports/repositories/product.repository.port';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CalculateProductDto } from './dto/calculate-product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';
import { PaginationDto, toPaginationParams } from '../common/dto/pagination.dto';
import { computeRecipeCosts } from '../domain/services/recipe-cost.calculator';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('products')
export class ProductsController {
  constructor(
    private readonly createProduct: CreateProductUseCase,
    private readonly updateProduct: UpdateProductUseCase,
    private readonly deleteProduct: DeleteProductUseCase,
    @Inject(PRODUCT_REPOSITORY) private readonly productRepo: IProductRepository,
  ) {}

  // NOTE: declared before ':id' so it isn't shadowed by the dynamic route.
  @Post('calculate')
  calculate(@Body() dto: CalculateProductDto) {
    return computeRecipeCosts(dto.recipeItems, dto.overheadCost ?? 0, dto.profitMargin);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateProductDto) {
    const cmd: CreateProductCommand = {
      name: dto.name,
      category: dto.category,
      overheadCost: dto.overheadCost,
      profitMargin: dto.profitMargin,
      recipeItems: dto.recipeItems,
    };
    return this.createProduct.execute(user.businessId as string, cmd);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData, @Query() pagination: PaginationDto) {
    const { limit, skip } = toPaginationParams(pagination);
    return this.productRepo.findAll(user.businessId as string, limit, skip);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    const product = await this.productRepo.findById(user.businessId as string, id);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const cmd: UpdateProductCommand = {
      name: dto.name,
      category: dto.category,
      overheadCost: dto.overheadCost,
      profitMargin: dto.profitMargin,
      recipeItems: dto.recipeItems,
    };
    return this.updateProduct.execute(user.businessId as string, id, cmd);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.deleteProduct.execute(user.businessId as string, id);
  }
}
