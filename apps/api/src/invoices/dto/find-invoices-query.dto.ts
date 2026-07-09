import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

export class FindInvoicesQueryDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be in YYYY-MM format' })
  month?: string;
}
