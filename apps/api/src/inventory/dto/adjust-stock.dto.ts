import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AdjustStockDto {
  @IsString()
  materialId!: string;

  /** The new absolute quantity after the manual count/adjustment. */
  @IsNumber()
  @Min(0)
  newQty!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
