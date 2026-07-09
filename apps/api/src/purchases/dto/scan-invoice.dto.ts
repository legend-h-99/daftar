import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// Accepts JPEG, PNG, or PDF — as raw base64 or as a data URI.
const IMAGE_BASE64_REGEX =
  /^(\/9j\/|iVBOR|JVBERi|data:(image\/(jpeg|png)|application\/pdf);base64,(\/9j\/|iVBOR|JVBERi))/;

export class ScanInvoiceDto {
  /**
   * The photographed purchase invoice as a base64 data string. Optional for
   * the mock provider (which never reads it); required by real providers.
   * ~7MB cap keeps oversized uploads out of the JSON body.
   */
  @IsOptional()
  @IsString()
  @MaxLength(10_000_000)
  @Matches(IMAGE_BASE64_REGEX, {
    message: 'imageBase64 must be a valid JPEG, PNG, or PDF in base64 or data-URI format',
  })
  imageBase64?: string;
}
