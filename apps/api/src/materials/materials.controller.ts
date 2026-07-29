import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserData } from '../common/types/auth.types';
import { PaginationDto, toPaginationParams } from '../common/dto/pagination.dto';

@UseGuards(JwtAuthGuard, BusinessGuard)
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateMaterialDto) {
    return this.materialsService.create(user.businessId as string, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query() pagination: PaginationDto,
  ) {
    return this.materialsService.findAll(user.businessId as string, toPaginationParams(pagination));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.materialsService.update(user.businessId as string, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.materialsService.remove(user.businessId as string, id);
  }
}
