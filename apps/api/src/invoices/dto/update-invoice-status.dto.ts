import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus)
  status!: InvoiceStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;
}
