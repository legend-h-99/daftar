import { IsEnum, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Unit } from '@prisma/client';

export class CreateMaterialDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(Unit)
  unit!: Unit;

  @IsNumber()
  @Min(0)
  purchasePrice!: number;

  @IsNumber()
  @Min(0.000001)
  purchaseQty!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderLevel?: number;

  /** VAT % included in the purchase price (e.g. 15). Informational. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  vatRate?: number;

  /** Opening stock balance when adding an item manually from the inventory screen. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialQty?: number;
}
