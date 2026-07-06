import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PurchaseSource, Unit } from '@prisma/client';

export class PurchaseItemDto {
  /** Existing inventory material. Omit to auto-create a new material from this line. */
  @IsOptional()
  @IsString()
  materialId?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(Unit)
  unit!: Unit;

  @IsNumber()
  @Min(0.000001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreatePurchaseDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  /** Free-text supplier (e.g. from OCR) — matched by name or created on the fly. */
  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(PurchaseSource)
  source?: PurchaseSource;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}
