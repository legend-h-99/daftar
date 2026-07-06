import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class InvoiceItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0.000001)
  quantity!: number;
}
