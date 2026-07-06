import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { RecipeItemType, Unit } from '@prisma/client';

export class RecipeItemDto {
  @IsOptional()
  @IsString()
  materialId?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(Unit)
  unit!: Unit;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0.000001)
  quantityUsed!: number;

  @IsEnum(RecipeItemType)
  type!: RecipeItemType;
}
