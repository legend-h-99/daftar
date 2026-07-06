import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ScanInvoiceDto {
  /**
   * The photographed purchase invoice as a base64 data string. Optional for
   * the mock provider (which never reads it); required by real providers.
   * ~7MB cap keeps oversized uploads out of the JSON body.
   */
  @IsOptional()
  @IsString()
  @MaxLength(10_000_000)
  imageBase64?: string;
}
