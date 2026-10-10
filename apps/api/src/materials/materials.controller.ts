import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CreateMaterialUseCase, CreateMaterialCommand } from '../application/use-cases/materials/create-material.use-case';
import { UpdateMaterialUseCase, UpdateMaterialCommand } from '../application/use-cases/materials/update-material.use-case';
import { DeleteMaterialUseCase } from '../application/use-cases/materials/delete-material.use-case';
import { MATERIAL_REPOSITORY, IMaterialRepository } from '../application/ports/repositories/material.repository.port';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('materials')
export class MaterialsController {
  constructor(
    private readonly createMaterial: CreateMaterialUseCase,
    private readonly updateMaterial: UpdateMaterialUseCase,
    private readonly deleteMaterial: DeleteMaterialUseCase,
    @Inject(MATERIAL_REPOSITORY) private readonly materialRepo: IMaterialRepository,
  ) {}

  @Post()
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateMaterialDto) {
    const cmd: CreateMaterialCommand = {
      name: dto.name,
      unit: dto.unit,
      purchasePrice: dto.purchasePrice,
      purchaseQty: dto.purchaseQty,
      initialQty: dto.initialQty,
      reorderLevel: dto.reorderLevel,
      vatRate: dto.vatRate,
    };
    return this.createMaterial.execute(user.businessId as string, cmd);
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.materialRepo.findAllByBusiness(user.businessId as string);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    const cmd: UpdateMaterialCommand = {
      name: dto.name,
      unit: dto.unit,
      purchasePrice: dto.purchasePrice,
      purchaseQty: dto.purchaseQty,
      reorderLevel: dto.reorderLevel,
      vatRate: dto.vatRate,
    };
    return this.updateMaterial.execute(user.businessId as string, id, cmd);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.deleteMaterial.execute(user.businessId as string, id);
  }
}
